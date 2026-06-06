const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cron = require('node-cron');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Pasta temporária correta aceita pela Render
const SESSAO_PATH = '/tmp/sessao_whatsapp';

let sock;
let qrCodeBase64 = "";
let statusRobo = "Iniciando...";

// Cria um logger básico manual para evitar que o Baileys quebre com status 1
const loggerManual = {
    level: 'silent',
    log: () => {},
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    child: function() { return this; }
};

async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSAO_PATH);
    
    // Inicialização segura injetando o logger manual para não travar
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: loggerManual
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
            const deviaReiniciar = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            statusRobo = "Desconectado. Tentando reconectar...";
            if (deviaReiniciar) conectarWhatsApp();
        } else if (connection === 'open') {
            qrCodeBase64 = "";
            statusRobo = "Online e conectado!";
            console.log("Robô conectado com sucesso!");
        }
    });
}

app.get('/', (req, res) => {
    if (qrCodeBase64) {
        res.send(`<h2>Escaneie o QR Code abaixo para conectar o Rodízio:</h2><br><img src="${qrCodeBase64}" style="width:300px;height:300px;"/>`);
    } else {
        res.send(`<h2>Status do Robô: ${statusRobo}</h2>`);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor ativo na porta ${PORT}`);
    conectarWhatsApp();
});
