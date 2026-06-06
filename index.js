const { default: makeWASocket, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

let sock = null;
let qrCodeBase64 = "";
let statusRobo = "Iniciando...";

// Estrutura de autenticação salva 100% na memória RAM para evitar falhas no disco da Render
let credsMemory = {
    creds: {
        noiseKey: { private: Buffer.alloc(32), public: Buffer.alloc(32) },
        pairingEphemeralKeyPair: { private: Buffer.alloc(32), public: Buffer.alloc(32) },
        signedIdentityKey: { private: Buffer.alloc(32), public: Buffer.alloc(32) },
        signedPreKey: { keyPair: { private: Buffer.alloc(32), public: Buffer.alloc(32) }, signature: Buffer.alloc(64), keyId: 1 },
        registrationId: Math.floor(Math.random() * 2000),
        advSecretKey: "",
        processedHistoryMessages: [],
        nextPreKeyId: 1,
        firstUnuploadedPreKeyId: 1,
        accountSettings: { unarchiveChats: false },
        registered: false,
        me: undefined,
        signalIdentities: [],
        platform: 'android',
        lastPropHash: undefined
    },
    keys: {}
};

async function conectarWhatsApp() {
    statusRobo = "Gerando conexões estáveis na memória...";
    
    // Simula o gerenciador de estado nativo usando os dados da memória RAM
    const state = {
        creds: credsMemory.creds,
        keys: {
            get: (type, ids) => {
                const data = {};
                for(const id of ids) {
                    if(credsMemory.keys[`${type}-${id}`]) {
                        data[id] = credsMemory.keys[`${type}-${id}`];
                    }
                }
                return data;
            },
            set: (data) => {
                for(const type in data) {
                    for(const id in data[type]) {
                        if(data[type][id]) {
                            credsMemory.keys[`${type}-${id}`] = data[type][id];
                        } else {
                            delete credsMemory.keys[`${type}-${id}`];
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
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: undefined
    });

    sock.ev.on('creds.update', (newCreds) => {
        Object.assign(credsMemory.creds, newCreds);
    });

    sock.ev.on('connection.update', async (update) => {
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
            const codigoErro = lastDisconnect?.error?.output?.statusCode;
            
            if (codigoErro === DisconnectReason.loggedOut) {
                statusRobo = "Desconectado permanentemente do celular.";
            } else {
                statusRobo = "Reiniciando sessão limpa...";
                await delay(3000);
                conectarWhatsApp();
            }
        } else if (connection === 'open') {
            qrCodeBase64 = "";
            statusRobo = "Online e conectado!";
            console.log("Robô autenticado!");
        }
    });
}

app.get('/', (req, res) => {
    if (qrCodeBase64) {
        res.send(`
            <meta http-equiv="refresh" content="10">
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h2 style="color: #25D366;">Pronto para conectar!</h2>
                <p>Abra o WhatsApp no celular > Aparelhos conectados > Conectar um aparelho</p>
                <br>
                <img src="${qrCodeBase64}" style="width:280px; height:280px; border:4px solid #25D366; padding:10px; border-radius:10px;"/>
                <p style="color:#666;"><i>O QR Code muda automaticamente se expirar. Não precisa atualizar a página.</i></p>
            </div>
        `);
    } else {
        res.send(`
            <meta http-equiv="refresh" content="4">
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h2>Status: ${statusRobo}</h2>
                <div style="margin: 20px auto; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #25D366; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p>Configurando instâncias... Aguarde o QR Code aparecer em instantes.</p>
                <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            </div>
        `);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    conectarWhatsApp();
});
