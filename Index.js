const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web-js');
const qrcode = require('qrcode-terminal');
const PDFDocument = require('pdfkit');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const https = require('https'); // Adicionado para fazer o robô se manter acordado

const app = express();
const PORT = process.env.PORT || 3000;

const BANCO_DADOS_PATH = path.join(__dirname, 'banco_dados.json');

if (!fs.existsSync(BANCO_DADOS_PATH)) {
    const dadosIniciais = {
        ponteiroCulto: 0,
        ponteiroReuniao: 0,
        opsCulto: ["CESA", "ROMULO", "DANIEL", "FABIO"],
        opsReuniao: ["DANIEL F.N", "JONATAS"],
        opsEnsaio: ["JONATAS"],
        opsCultoJovem: ["FABIO"]
    };
    fs.writeFileSync(BANCO_DADOS_PATH, JSON.stringify(dadosIniciais, null, 2));
}

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './sessao_whatsapp' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

let qrCodeLink = "";

client.on('qr', (qr) => {
    qrCodeLink = qr;
    console.log('NOVO QR CODE GENERADO.');
});

client.on('ready', () => {
    console.log('Robô ativo na Render!');
    qrCodeLink = "";
    
    // 🧠 O PULO DO GATO: De 10 em 10 minutos o robô acessa ele mesmo na internet para NUNCA DORMIR
    setInterval(() => {
        const urlMinha = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}.onrender.com/`;
        if (process.env.RENDER_EXTERNAL_HOSTNAME) {
            https.get(urlMinha, (res) => {
                console.log('Mantendo o robô acordado de graça...');
            }).on('error', (e) => console.log('Erro no auto-acesso'));
        }
    }, 600000); // 10 minutos
});

cron.schedule('0 8 28 * *', () => {
    processarEEnviarRodizio();
});

function processarEEnviarRodizio() {
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

    const ID_DO_GRUPO = "1234567890@g.us"; 
    client.sendMessage(ID_DO_GRUPO, textoMensagem)
        .then(() => console.log("Enviado!"))
        .catch(err => console.error(err));
}

app.get('/', (req, res) => {
    if (qrCodeLink) {
        res.send(`<img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCodeLink)}"/>`);
    } else if (client.info) {
        res.send(`<h2>Robô Online na Render como: ${client.info.pushname}</h2>`);
    } else {
        res.send(`<h2>Iniciando... Recarregue a página.</h2>`);
    }
});

app.listen(PORT, () => console.log(`Rodando`));
