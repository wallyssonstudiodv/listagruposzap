const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false // desativamos o QR automático
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true }); // força o QR no terminal
    }

    if (connection === 'open') {
      console.log('✅ Bot conectado com sucesso!');

      sock.groupFetchAllParticipating().then(grupos => {
        const ids = Object.keys(grupos);
        console.log('\n📋 Lista de Grupos:\n');
        let conteudo = '📋 Lista de Grupos do WhatsApp:\n\n';

        ids.forEach((id, index) => {
          const nome = grupos[id].subject || 'Sem nome';
          const linha = `${index + 1}. ${nome} — ${id}`;
          console.log(linha);
          conteudo += linha + '\n';
        });

        fs.writeFileSync('grupos.txt', conteudo, 'utf8');
        console.log('\n✅ Arquivo "grupos.txt" salvo com sucesso!\n');

        process.exit();
      });
    }
  });
}

iniciarBot();