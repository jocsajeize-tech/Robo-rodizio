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
        ponteiroCulto: 1, 
        ponteiroReuniao: 0,
        ponteiroEnsaio: 0,
        ponteiroCultoJovem: 0,
        opsCulto: ["CESA", "ROMULO", "DANIEL", "FABIO"],
        opsReuniao: ["DANIEL F.N", "JONATAS"],
        opsEnsaio: ["JONATAS"],
        opsCultoJovem: ["FABIO"]
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
        printQRInTerminal: false
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
            statusRobo = "Tentando reconectar...";
            if (deviaReiniciar) conectarWhatsApp();
        } else if (connection === 'open') {
            qrCodeBase64 = "";
            statusRobo = "Online e conectado!";
            
            setInterval(() => {
                if (process.env.RENDER_EXTERNAL_HOSTNAME) {
                    const urlMinha = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}.onrender.com/`;
                    https.get(urlMinha, () => {}).on('error', () => {});
                }
            }, 600000); 
        }
    });
}

cron.schedule('0 8 28 * *', () => {
    processarEEnviarRodizio();
});

function processarEEnviarRodizio() {
    if (statusRobo !== "Online e conectado!") return console.log("Robô offline.");
    
    const db = JSON.parse(fs.readFileSync(BANCO_DADOS_PATH, 'utf8'));
    const hoje = new Date();
    const proximoMesIdx = (hoje.getMonth() + 1) % 12;
    const anoAlvo = hoje.getMonth() === 11 ? hoje.getFullYear() + 1 : hoje.getFullYear();
    const mesesNomes = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    
    let textoMensagem = `🚨 *RODÍZIO DE OPERADORES - ${mesesNomes[proximoMesIdx]} / ${anoAlvo}* 🚨\n`;
    textoMensagem += `_Congregação Cristã no Brasil_\n\n`;

    const totalDias = new Date(anoAlvo, proximoMesIdx + 1, 0).getDate();
    
    textoMensagem += `*--- CULTOS: ---*\n`;
    let pC = db.ponteiroCulto;
    for (let d = 1; d <= totalDias; d++) {
        let dt = new Date(anoAlvo, proximoMesIdx, d);
        let diaSemana = dt.getDay();
        if (diaSemana === 0 || diaSemana === 2 || diaSemana === 4) {
            let irmao = db.opsCulto[pC % db.opsCulto.length];
            let dataFmt = String(d).padStart(2, '0') + '-' + mesesNomes[proximoMesIdx].substring(0,3).toLowerCase() + '.';
            let diaNomes = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
            textoMensagem += `${diaNomes[diaSemana]} | ${dataFmt} | *${irmao}*\n`;
            pC++;
        }
    }
    db.ponteiroCulto = pC;

    textoMensagem += `\n*--- REUNIÃO DE JOVENS: ---*\n`;
    let pR = db.ponteiroReuniao;
    for (let d = 1; d <= totalDias; d++) {
        let dt = new Date(anoAlvo, proximoMesIdx, d);
        if (dt.getDay() === 0) {
            let irmao = db.opsReuniao[pR % db.opsReuniao.length];
            let dataFmt = String(d).padStart(2, '0') + '-' + mesesNomes[proximoMesIdx].substring(0,3).toLowerCase() + '.';
            textoMensagem += `domingo | ${dataFmt} | *${irmao}*\n`;
            pR++;
        }
    }
    db.ponteiroReuniao = pR;

    textoMensagem += `\n*--- ENSAIO: ---*\n`;
    let pE = db.ponteiroEnsaio;
    let contaSexta = 0;
    for (let d = 1; d <= totalDias; d++) {
        let dt = new Date(anoAlvo, proximoMesIdx, d);
        if (dt.getDay() === 5) {
            contaSexta++;
            if (contaSexta === 2) { 
                let irmao = db.opsEnsaio[pE % db.opsEnsaio.length];
                let dataFmt = String(d).padStart(2, '0') + '-' + mesesNomes[proximoMesIdx].substring(0,3).toLowerCase() + '.';
                textoMensagem += `sexta-feira | ${dataFmt} | *${irmao}*\n`;
                pE++;
            }
        }
    }
    db.ponteiroEnsaio = pE;

    textoMensagem += `\n*--- CULTO DE JOVENS: ---*\n`;
    let pJ = db.ponteiroCultoJovem;
    let contaSabado = 0;
    for (let d = 1; d <= totalDias; d++) {
        let dt = new Date(anoAlvo, proximoMesIdx, d);
        if (dt.getDay() === 6) {
            contaSabado++;
            if (contaSabado === 2) { 
                let irmao = db.opsCultoJovem[pJ % db.opsCultoJovem.length];
                let dataFmt = String(d).padStart(2, '0') + '-' + mesesNomes[proximoMesIdx].substring(0,3).toLowerCase() + '.';
                textoMensagem += `sábado | ${dataFmt} | *${irmao}*\n`;
                pJ++;
            }
        }
    }
    db.ponteiroCultoJovem = pJ;

    fs.writeFileSync(BANCO_DADOS_PATH, JSON.stringify(db, null, 2));

    const ID_DO_GRUPO = "1234567890@g.us"; // 👈 LEMBRE DE ALTERAR DEPOIS PELO ID DO SEU GRUPO
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

app.get('/teste-enviar', (req, res) => {
    processarEEnviarRodizio();
    res.send("<h3>Comando de envio processado!</h3>");
});

app.listen(PORT, () => {
    conectarWhatsApp();
});
