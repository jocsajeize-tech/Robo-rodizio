const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cron = require('node-cron');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Usamos /tmp/ pois é a única pasta onde a Render permite gravação no plano gratuito
const SESSAO_PATH = '/tmp/sessao_whatsapp';

let sock;
let qrCodeBase64 = "";
let statusRobo = "Iniciando...";

async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSAO_PATH);
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: { level: 'silent' }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            QRCode.toDataURL(qr, (err, url) => {
                if (!err) qrCodeBase64 = url;
            });
            statusRobo = "Aguardando leitura do QR Code";
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            statusRobo = "Desconectado. Tentando reconectar...";
            if (shouldReconnect) conectarWhatsApp();
        } else if (connection === 'open') {
            qrCodeBase64 = "";
            statusRobo = "Online e conectado!";
            console.log('Conectado com sucesso!');
        }
    });
}

// Rota principal para mostrar QR Code
app.get('/', (req, res) => {
    if (qrCodeBase64) {
        res.send(`<h1>Escaneie o QR Code:</h1><img src="${qrCodeBase64}"/>`);
    } else {
        res.send(`<h1>Status: ${statusRobo}</h1>`);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    conectarWhatsApp();
});
