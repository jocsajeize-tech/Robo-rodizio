const { default: makeWASocket, initAuthCreds, DisconnectReason, BufferJSON } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

// Estado Global do Servidor
let sock = null;
let qrCodeBase64 = "";
let statusRobo = "Inicializando sistema...";

// Gerenciador de Sessão em Memória de Alta Performance
let sessaoSegura = {
    creds: initAuthCreds(),
    keys: {}
};

// Função Principal de Conexão
async function iniciarConexaoWhatsApp() {
    statusRobo = "Gerando chaves de segurança...";
    
    const estadoAutenticacao = {
        creds: sessaoSegura.creds,
        keys: {
            get: (type, ids) => {
                const dados = {};
                for (const id of ids) {
                    let valor = sessaoSegura.keys[`${type}-${id}`];
                    if (valor) {
                        if (type === 'app-state-sync-key') {
                            valor = BufferJSON.fromJSON(valor);
                        }
                        dados[id] = valor;
                    }
                }
                return dados;
            },
            set: (dados) => {
                for (const type in dados) {
                    for (const id in dados[type]) {
                        if (dados[type][id]) {
                            sessaoSegura.keys[`${type}-${id}`] = JSON.parse(
                                JSON.stringify(dados[type][id], BufferJSON.replacer)
                            );
                        } else {
                            delete sessaoSegura.keys[`${type}-${id}`];
                        }
                    }
                }
            }
        }
    };

    try {
        sock = makeWASocket({
            auth: estadoAutenticacao,
            printQRInTerminal: false,
            logger: pino({ level: 'fatal' }), // Desativa logs pesados que travam a Render
            browser: ["Servidor Rodizio", "Chrome", "1.0.0"],
            syncFullHistory: false,          // Ignora mensagens antigas para não estourar a memória RAM
            markOnlineOnConnect: true
        });

        // Atualização de credenciais de segurança
        sock.ev.on('creds.update', (update) => {
            Object.assign(sessaoSegura.creds, update);
        });

        // Monitoramento da Conexão em Tempo Real
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                QRCode.toDataURL(qr, (err, url) => {
                    if (!err) {
                        qrCodeBase64 = url;
                        statusRobo = "Pronto para Escanear";
                    }
                });
            }

            if (connection === 'close') {
                qrCodeBase64 = "";
                const erroStatusCode = lastDisconnect?.error?.output?.statusCode;
                
                if (erroStatusCode === DisconnectReason.loggedOut) {
                    statusRobo = "Sessão finalizada pelo celular. Reinicie o servidor.";
                } else {
                    statusRobo = "Reestabelecendo conexão...";
                    setTimeout(iniciarConexaoWhatsApp, 5000); // Tenta reconectar após 5 segundos de forma estável
                }
            } else if (connection === 'open') {
                qrCodeBase64 = "";
                statusRobo = "Online";
                console.log("Servidor conectado ao WhatsApp com sucesso!");
            }
        });

    } catch (erro) {
        console.error("Erro crítico na inicialização:", erro);
        statusRobo = "Erro interno. Reiniciando...";
        setTimeout(iniciarConexaoWhatsApp, 10000);
    }
}

// Interface Web Profissional (HTML/CSS Embutido)
app.get('/', (req, res) => {
    // Tela Dinâmica baseada no estado real do robô
    if (qrCodeBase64) {
        res.send(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="refresh" content="15">
                <title>Painel do Robô - Conexão</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f0f2f5; margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                    .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 360px; width: 100%; }
                    h2 { color: #128C7E; margin-bottom: 10px; font-size: 24px; }
                    p { color: #667781; font-size: 14px; line-height: 1.4; margin-bottom: 20px; }
                    .qr-container { background: #fff; padding: 10px; display: inline-block; border: 2px solid #00a884; border-radius: 10px; box-shadow: inset 0 0 8px rgba(0,0,0,0.05); }
                    .qr-container img { display: block; width: 260px; height: 260px; }
                    .status-badge { display: inline-block; padding: 6px 14px; background-color: #e3f7f2; color: #00a884; font-weight: bold; border-radius: 20px; font-size: 12px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px; }
                    .footer { font-size: 11px; color: #8696a0; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <span class="status-badge">${statusRobo}</span>
                    <h2>Conectar WhatsApp</h2>
                    <p>Abra o WhatsApp no seu celular, toque em <b>Aparelhos Conectados</b> e escaneie o código abaixo.</p>
                    <div class="qr-container">
                        <img src="${qrCodeBase64}" alt="WhatsApp QR Code">
                    </div>
                    <div class="footer">A página atualiza o código automaticamente a cada 15 segundos.</div>
                </div>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="refresh" content="5">
                <title>Painel do Robô - Carregando</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f0f2f5; margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 360px; width: 100%; }
                    h3 { color: #3b4a54; margin: 0 0 10px 0; font-size: 18px; }
                    p { color: #667781; font-size: 14px; margin: 0; }
                    .spinner { margin: 25px auto; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #128C7E; border-radius: 50%; animation: spin 1s linear infinite; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="spinner"></div>
                    <h3>${statusRobo}</h3>
                    <p>Processando credenciais no servidor profissional da Render...</p>
                </div>
            </body>
            </html>
        `);
    }
});

app.listen(PORT, () => {
    console.log(`[SERVER] Inicializado na porta ${PORT}`);
    iniciarConexaoWhatsApp();
});
