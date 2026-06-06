const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web-js');
const qrcode = require('qrcode-terminal');
const PDFDocument = require('pdfkit');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Arquivo local no servidor para guardar os ponteiros e listas (Não apaga quando o mês vira)
const BANCO_DADOS_PATH = path.join(__dirname, 'banco_dados.json');

// Inicializa o banco de dados se não existir
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

// Inicializa o WhatsApp preparado para Servidores Nuvem de alta performance
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './sessao_whatsapp' }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process'
        ]
    }
});

let qrCodeLink = "";

client.on('qr', (qr) => {
    qrCodeLink = qr;
    console.log('--- NOVO QR CODE GERADO ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('🤖 Robô do Rodízio Conectado e Ativo 24h na Nuvem!');
    qrCodeLink = "";
});

// ⏰ DESPERTADOR INTERNO (Roda direto no servidor sem depender de sites de fora)
// Configurado para rodar automaticamente todo dia 28 às 08:00 da manhã
cron.schedule('0 8 28 * *', () => {
    console.log('⏰ Dia 28 chegou! Iniciando disparo automático do rodízio...');
    processarEEnviarRodizio();
});

// Lógica de cálculo e montagem da escala contínua
function processarEEnviarRodizio() {
    const db = JSON.parse(fs.readFileSync(BANCO_DADOS_PATH, 'utf8'));
    
    const hoje = new Date();
    const proximoMesIdx = (hoje.getMonth() + 1) % 12;
    const anoAlvo = hoje.getMonth() === 11 ? hoje.getFullYear() + 1 : hoje.getFullYear();
    const mesesNomes = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    const nomeMes = mesesNomes[proximoMesIdx];

    let textoMensagem = `🚨 *RODÍZIO DE OPERADORES - ${nomeMes} / ${anoAlvo}* 🚨\n`;
    textoMensagem += `_Congregação Cristã no Brasil_\n\n*--- CULTOS OFICIAIS ---*\n`;

    const totalDias = new Date(anoAlvo, proximoMesIdx + 1, 0).getDate();
    let pC = db.ponteiroCulto;

    for (let d = 1; d <= totalDias; d++) {
        let dt = new Date(anoAlvo, proximoMesIdx, d);
        let diaSemana = dt.getDay(); // 0=Dom, 2=Ter, 4=Qui

        if (diaSemana === 0 || diaSemana === 2 || diaSemana === 4) {
            let irmao = db.opsCulto[pC % db.opsCulto.length];
            let dataFmt = String(d).padStart(2, '0') + '/' + String(proximoMesIdx + 1).padStart(2, '0');
            let diaNomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            
            textoMensagem += `📅 ${diaNomes[diaSemana]} (${dataFmt}) - *${irmao}*\n`;
            pC++; // Avança para o próximo irmão da fila
        }
    }

    // Atualiza o ponteiro no arquivo do servidor para o próximo mês continuar perfeitamente
    db.ponteiroCulto = pC;
    fs.writeFileSync(BANCO_DADOS_PATH, JSON.stringify(db, null, 2));

    textoMensagem += `\n⚠️ _Escala gerada de forma 100% automática na Nuvem._`;

    // ID do Grupo de Destino do WhatsApp (Substitua pelo ID real do seu grupo)
    const ID_DO_GRUPO = "1234567890@g.us"; 

    client.sendMessage(ID_DO_GRUPO, textoMensagem)
        .then(() => console.log("✅ Rodízio enviado com sucesso para o grupo!"))
        .catch(err => console.error("❌ Erro ao mandar mensagem no grupo:", err));
}

// Página visual para você monitorar e ler o QR Code pelo navegador
app.get('/', (req, res) => {
    if (qrCodeLink) {
        res.send(`<h2>Escaneie o código para ativar o robô:</h2>
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCodeLink)}"/>
                  <p>Abra o WhatsApp -> Aparelhos Conectados -> Conectar Aparelho</p>`);
    } else if (client.info) {
        res.send(`<h2>🤖 O Servidor está 100% Ativo e conectado no WhatsApp!</h2>
                  <p>Conectado como: <b>${client.info.pushname}</b></p>
                  <p>O rodízio será enviado sozinho para o grupo todo dia 28.</p>`);
    } else {
        res.send(`<h2>Iniciando o sistema... Recarregue a página em 15 segundos.</h2>`);
    }
}

// Rota de teste caso você queira forçar o envio na hora sem esperar o dia 28
app.get('/forcar-envio', (req, res) => {
    processarEEnviarRodizio();
    res.send("<h3>Comando enviado! Verifique o grupo do WhatsApp.</h3>");
});

app.listen(PORT, () => console.log(`Servidor ativo 24h na porta ${PORT}`));
