const { default: makeWASocket, initAuthCreds, BufferJSON, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

let sock = null;
let qrCodeBase64 = "";
let statusRobo = "Iniciando...";

let dadosAutenticacao = {
    creds: initAuthCreds(),
    keys: {}
};

async function conectarWhatsApp() {
    statusRobo = "Gerando QR Code...";
    
    const state = {
        creds: dadosAutenticacao.creds,
        keys: {
            get: (type, ids) => {
                const data = {};
                for (const id of ids) {
                    let value = dadosAutenticacao.keys[`${type}-${id}`];
                    if (value) {
                        if (type === 'app-state-sync-key') value = BufferJSON.fromJSON(value);
                        data[id] = value;
                    }
                }
                return data;
            },
            set: (data) => {
                for (const type in data) {
                    for (const id in data[type]) {
                        if (data[type][id]) {
                            dadosAutenticacao.keys[`${type}-${id}`] = JSON.parse(JSON.stringify(data[type][id], BufferJSON.replacer));
                        } else {
                            delete dadosAutenticacao.keys[`${type}-${id}`];
                        }
                    }
                }
            }
        }
    };

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Robo Rodizio", "Chrome", "1.0.0"],
        // ESTA LINHA IMPEDE O TRAVAMENTO NA RENDER:
        syncFullHistory: false
    });

    sock.ev.on('creds.update', (update) => {
        Object.assign(dadosAutenticacao.creds, update);
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            QRCode.toDataURL(qr, (err, url) => {
                if (!err) {
                    qrCodeBase64 = url;
                    statusRobo = "Aguardando leitura do QR Code";
                }
            });
        }

        if (connection === 'close') {
            qrCodeBase64 = "";
            const deveReiniciar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            statusRobo = "Carregando código...";
            if (deveReiniciar) conectarWhatsApp();
        } else if (connection === 'open') {
            qrCodeBase64 = "";
            statusRobo = "Online e conectado!";
        }
    });
}

app.get('/', (req, res) => {
    if (qrCodeBase64) {
        res.send(`
            <meta http-equiv="refresh" content="15">
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h2 style="color: #25D366;">Escaneie o QR Code abaixo:</h2>
                <br>
                <img src="${qrCodeBase64}" style="width:280px; height:280px; border:3px solid #25D366; padding:10px; border-radius:8px;"/>
                <p>A página atualiza sozinha se o código mudar.</p>
            </div>
        `);
    } else {
        res.send(`
            <meta http-equiv="refresh" content="5">
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h2>Status: ${statusRobo}</h2>
                <p>Aguarde o processamento leve do servidor...</p>
            </div>
        `);
    }
});

app.listen(PORT, () => {
    conectarWhatsApp();
});
