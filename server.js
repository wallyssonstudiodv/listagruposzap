// server.js
const express = require('express');
const path = require('path');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const axios = require('axios');
const cron = require('node-cron');
const P = require('pino');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const WEBHOOK = 'https://meudrivenet.x10.bz/canal/webhook.php';
const GRUPO_AUTORIZADO = '120363227240067234@g.us';

let sock = null;
let qrCodeString = null;
let connectionStatus = 'disconnected'; // disconnected, connecting, connected

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state
  });

  connectionStatus = 'connecting';
  qrCodeString = null;

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeString = qr;
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      connectionStatus = 'disconnected';

      if (reason === DisconnectReason.loggedOut) {
        console.log('❌ Sessão encerrada. Exclua a pasta auth e escaneie novamente.');
        qrCodeString = null;
      } else {
        console.log('⚠️ Conexão encerrada. Tentando reconectar...');
        iniciarBot();
      }
    }

    if (connection === 'open') {
      connectionStatus = 'connected';
      qrCodeString = null;
      console.log('✅ Conectado com sucesso ao WhatsApp!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Agendamento fixo
  cron.schedule('30 7 * * *', enviarVideo);
  cron.schedule('40 23 * * *', enviarVideo);
  cron.schedule('0 18 * * *', enviarVideo);
}

async function enviarVideo() {
  if (!sock || connectionStatus !== 'connected') {
    console.log('Bot não conectado, não pode enviar vídeo');
    return;
  }

  try {
    const res = await axios.post(WEBHOOK, {});
    const dados = res.data;

    if (dados?.file_base64 && dados?.filename) {
      await sock.sendMessage(GRUPO_AUTORIZADO, {
        image: Buffer.from(dados.file_base64, 'base64'),
        caption: dados.caption || ''
      });
      console.log('✅ Vídeo enviado automaticamente');
    } else if (dados?.reply) {
      await sock.sendMessage(GRUPO_AUTORIZADO, { text: dados.reply });
      console.log('✅ Mensagem de texto enviada automaticamente');
    }
  } catch (err) {
    console.error('❌ Erro ao buscar vídeo no webhook:', err.message);
  }
}

// API para frontend pegar status do bot
app.get('/api/status', (req, res) => {
  res.json({ status: connectionStatus });
});

// API para pegar QR code em base64 para exibir no frontend
app.get('/api/qrcode', async (req, res) => {
  if (!qrCodeString) return res.status(404).json({ error: 'QR Code não disponível' });
  try {
    const qrDataUrl = await qrcode.toDataURL(qrCodeString);
    res.json({ qr: qrDataUrl });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao gerar QR Code' });
  }
});

// API para disparar envio manual do vídeo
app.post('/api/enviar-video', async (req, res) => {
  if (connectionStatus !== 'connected') return res.status(400).json({ error: 'Bot não conectado' });
  try {
    await enviarVideo();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  iniciarBot();
});