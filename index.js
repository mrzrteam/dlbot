const { makeWASocket, DisconnectReason, useMultiFileAuthState, makeInMemoryStore  } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const P = require("pino")

async function connectToWhatsApp() {
     const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    const logger = P({
        level: 'silent', // Bisa diganti jadi 'error' atau 'warn' jika ingin beberapa log tetap muncul
    });
    global.store = makeInMemoryStore({ logger })
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger,
        defaultQueryTimeoutMs: undefined
    });
    store.bind(sock.ev);
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        }
    });
        
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        /*console.log(msg)
        console.log(msg.reaction)*/
        if (!msg.message) return;
        
        const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const sender = msg.key.remoteJid;
        const emoji = msg.message?.reactionMessage?.text;
        const targetEmoji = '📥'
        if (emoji !== targetEmoji) return;

const reactedMessageId = msg.message.reactionMessage.key.id;
let reactedMessage = await store.loadMessage(sender, reactedMessageId);

if (!reactedMessage || !reactedMessage.message) return;

let url;
if (reactedMessage.message.conversation) {
    url = reactedMessage.message.conversation.match(/https?:\/\/\S+/)?.[0];
} else if (reactedMessage.message.extendedTextMessage?.text) {
    url = reactedMessage.message.extendedTextMessage.text.match(/https?:\/\/\S+/)?.[0];
}

if (!url) return console.log("Tidak ada URL dalam pesan yang direaksi.");

console.log("URL ditemukan:", url);

// Tentukan platform berdasarkan URL
let apiUrl;
if (url.includes("instagram.com")) {
    apiUrl = `https://aihub.xtermai.xyz/api/downloader/instagram?url=${url}&key=Bella409`;
} else if (url.includes("tiktok.com")) {
    apiUrl = `https://aihub.xtermai.xyz/api/downloader/tiktok?url=${url}&key=Bella409`;
} else if (url.includes("youtube.com") || url.includes("youtu.be")) {
    apiUrl = `https://aihub.xtermai.xyz/api/downloader/youtube?url=${url}&key=Bella409`;
} else {
    return console.log("URL tidak dikenali.");
}

try {
    const response = await axios.get(apiUrl);
    const result = response.data;

    if (!result.status || !result.data) {
        return console.log("Gagal mendapatkan data dari API.");
    }
    let mediaUrl;
    if (result.data.content) {
        mediaUrl = result.data.content[0].url; // Instagram
    } else if (result.data.media) {
        mediaUrl = result.data.media.find(m => m.description.includes("MP4"))?.url; // TikTok
    } else if (result.data.videoUrl) {
        mediaUrl = result.data.videoUrl; // YouTube
    } else {
        return console.log("Format media tidak didukung.");
    }

    console.log("Download URL:", mediaUrl);
    await sock.sendMessage(sender, { video: { url: mediaUrl } });

} catch (error) {
    console.error("Error saat mengambil data:", error);
}
    });
}

connectToWhatsApp();
let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log((`New ${__filename}`));
    delete require.cache[file];
    require(file);
});
