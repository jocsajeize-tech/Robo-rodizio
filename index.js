const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

// Pasta estável para gravação de credenciais no Back4app
const SESSAO_PATH = '/tmp/sessao_whatsapp';

let sock;
let qrCodeBase64 = "";
let statusRobo = "Inicializando robô...";

async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSAO_PATH);
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }),
        browser: ["Robo Rodizio", "Chrome", "1.0.0"],
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

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
            statusRobo = "Conexão fechada. Reconectando...";
            if (deveReiniciar) conectarWhatsApp();
        } else if (connection === 'open') {
            qrCodeBase64 = "";
            statusRobo = "Online e conectado!";
            console.log("Robô conectado com sucesso!");
        }
    });
}

app.get('/', (req, res) => {
    if (qrCodeBase64) {
        res.send(`
            <meta http-equiv="refresh" content="10">
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h2 style="color: #25D366;">Escaneie o QR Code abaixo:</h2>
                <br>
                <img src="${qrCodeBase64}" style="width:280px; height:280px; border:3px solid #25D366; padding:10px; border-radius:8px;"/>
                <p>A página atualiza o código sozinha se expirar.</p>
            </div>
        `);
    } else {
        res.send(`<meta http-equiv="refresh" content="5"><div style="text-align:center; font-family:sans-serif; margin-top:50px;"><h2>Status: ${statusRobo}</h2></div>`);
    }
});

app.listen(PORT, () => {
    conectarWhatsApp();
});
