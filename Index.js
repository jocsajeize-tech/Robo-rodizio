const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cron = require('node-cron');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

const BANCO_DADOS_PATH = path.join(__dirname, 'banco_dados.json');

if (!fs.existsSync(BANCO_DADOS_PATH)) {
    const dadosIniciais = {
        ponteiroCulto: 0,
        opsCulto: ["CESA", "ROMULO", "DANIEL", "FABIO"]
    };
    fs.writeFileSync(BANCO_DADOS_PATH, JSON.stringify(dadosIniciais, null, 2));
}

let sock;
let qrCodeBase64 = "";
let statusRobo = "Iniciando...";

async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('sessao_whatsapp');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
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
            console.log('Conexão fechada. Reiniciando de forma automática?', deviaReiniciar);
            statusRobo = "Desconectado. Tentando reconectar...";
            if (deviaReiniciar) conectarWhatsApp();
        } else if (connection === 'open') {
            console.log('Robô ativo no WhatsApp com Baileys!');
            qrCodeBase64 = "";
            statusRobo = "Online e conectado!";
            
            // Auto-ping para a Render nunca dormir
            setInterval(() => {
                if (process.env.RENDER_EXTERNAL_HOSTNAME) {
                    const urlMinha = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}.onrender.com/`;
                    https.get(urlMinha, () => console.log('Robô acordado!')).on('error', () => {});
                }
            }, 600000); 
        }
    });
}

// Escala automática todo dia 28 às 08:00
cron.schedule('0 8 28 * *', () => {
    processarEEnviarRodizio();
});

function processarEEnviarRodizio() {
    if (statusRobo !== "Online e conectado!") return console.log("Robô desconectado, impossível enviar.");
    
    const db = JSON.parse(fs.readFileSync(BANCO_DADOS_PATH, 'utf8'));
    const hoje = new Date();
    const proximoMesIdx = (hoje.getMonth() + 1) % 12;
    const anoAlvo = hoje.getMonth() === 11 ? hoje.getFullYear() + 1 : hoje.getFullYear();
    const mesesNomes = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    
    let textoMensagem = `🚨 *RODÍZIO DE OPERADORES - ${mesesNomes[proximoMesIdx]} / ${anoAlvo}* 🚨\n\n`;

    const totalDias = new Date(anoAlvo, proximoMesIdx + 1, 0).getDate();
    let pC = db.ponteiroCulto;

    for (let d = 1; d <= totalDias; d++) {
        let dt = new Date(anoAlvo, proximoMesIdx, d);
        let diaSemana = dt.getDay();
        if (diaSemana === 0 || diaSemana === 2 || diaSemana === 4) {
            let irmao = db.opsCulto[pC % db.opsCulto.length];
            let dataFmt = String(d).padStart(2, '0') + '/' + String(proximoMesIdx + 1).padStart(2, '0');
            let diaNomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            textoMensagem += `📅 ${diaNomes[diaSemana]} (${dataFmt}) - *${irmao}*\n`;
            pC++;
        }
    }

    db.ponteiroCulto = pC;
    fs.writeFileSync(BANCO_DADOS_PATH, JSON.stringify(db, null, 2));

    const ID_DO_GRUPO = "1234567890@g.us"; // 👈 Troque pelo ID do seu grupo
    sock.sendMessage(ID_DO_GRUPO, { text: textoMensagem })
        .then(() => console.log("Enviado com sucesso!"))
        .catch(err => console.error(err));
}

app.get('/', (req, res) => {
    if (qrCodeBase64) {
        res.send(`<h2>Escaneie para conectar o WhatsApp do Rodízio:</h2><img src="${qrCodeBase64}"/>`);
    } else {
        res.send(`<h2>Status do Robô: ${statusRobo}</h2>`);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor Web Ativo na porta ${PORT}`);
    conectarWhatsApp();
});
