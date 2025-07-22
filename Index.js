const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection }) => {
    if (connection === 'open') {
      console.log('✅ Bot conectado com sucesso!');

      const grupos = await sock.groupFetchAllParticipating();
      const ids = Object.keys(grupos);

      console.log('\n📋 Lista de Grupos:\n');
      let conteudo = '📋 Lista de Grupos do WhatsApp:\n\n';

      ids.forEach((id, index) => {
        const nome = grupos[id].subject || 'Sem nome';
        const linha = `${index + 1}. ${nome} — ${id}`;
        console.log(linha);
        conteudo += linha + '\n';
      });

      // Salva em grupos.txt
      fs.writeFileSync('grupos.txt', conteudo, 'utf8');
      console.log('\n✅ Arquivo "grupos.txt" salvo com sucesso!\n');

      process.exit(); // Finaliza após listar
    }
  });
}

iniciarBot();