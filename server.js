import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Path penyimpanan database JSON local
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}
}

// Initial Default Config
const DEFAULT_CONFIG = {
  apiKey: process.env.AM_API_KEY || 'Codex-D1FAF918-419CB645-93B44EEA-58A4EFB5',
  baseUrl: process.env.AM_BASE_URL || 'https://brann-alight-motion-2-production.up.railway.app/api/v1/bot-premium',
  ownerUsername: 'owner',
  ownerPassword: 'ownerpassword123',
  autoPushGithub: true
};

function readJSON(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
      return fallback;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    triggerGithubSync();
  } catch (e) {
    console.error('[STORAGE] Error writing JSON:', e.message);
  }
}

// Memory Database Store
let config = readJSON(CONFIG_FILE, DEFAULT_CONFIG);
let users = readJSON(USERS_FILE, []);
let logs = readJSON(LOGS_FILE, []);

// Safe Auto Sync Database ke GitHub
let syncTimeout = null;
function triggerGithubSync() {
  if (!config.autoPushGithub) return;
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    try {
      exec('git add data/*.json && git commit -m "auto: Sync database updates" && git push origin master', { cwd: __dirname }, (error) => {
        if (error) {
          console.log('[AUTO GITHUB SYNC] Info: Local file saved.');
        } else {
          console.log('[AUTO GITHUB SYNC SUCCESS] Database synced to GitHub!');
        }
      });
    } catch (err) {}
  }, 5000);
}

function addLog(username, action, status, detail = '') {
  const logEntry = {
    id: 'LOG-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    username,
    action,
    status,
    detail
  };
  logs.unshift(logEntry);
  if (logs.length > 200) logs = logs.slice(0, 200);
  writeJSON(LOGS_FILE, logs);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ==========================================================================
   HEALTHCHECK ENDPOINT UNTUK RAILWAY DEPLOYMENT
   ========================================================================== */
app.get('/api/health', (req, res) => {
  return res.status(200).json({ status: 'ok', online: true, service: 'Alight Motion Pro Generator' });
});

/* ==========================================================================
   AUTH ENDPOINTS (REGISTER & LOGIN)
   ========================================================================== */

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi!' });
  }

  const cleanUser = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  const existing = users.find(u => u.username === cleanUser || u.email === cleanEmail);
  if (existing) {
    return res.status(400).json({ success: false, message: 'Username atau Email sudah terdaftar!' });
  }

  const newUser = {
    id: 'USR-' + Date.now(),
    username: cleanUser,
    email: cleanEmail,
    password,
    role: cleanUser === config.ownerUsername.toLowerCase() ? 'owner' : 'user',
    credits: 10,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeJSON(USERS_FILE, users);
  addLog(cleanUser, 'USER_REGISTER', 'SUCCESS', 'Pendaftaran akun baru');

  return res.json({
    success: true,
    message: 'Pendaftaran berhasil! Silakan login.',
    user: { username: newUser.username, email: newUser.email, role: newUser.role, credits: newUser.credits }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan Password wajib diisi!' });
  }

  const cleanUser = username.trim().toLowerCase();

  if (cleanUser === config.ownerUsername.toLowerCase() && password === config.ownerPassword) {
    addLog('owner', 'OWNER_LOGIN', 'SUCCESS', 'Login sebagai Owner');
    return res.json({
      success: true,
      message: 'Welcome Back, Owner! Mode Akses Penuh Aktif.',
      user: { username: config.ownerUsername, role: 'owner', credits: 999999 }
    });
  }

  const user = users.find(u => u.username === cleanUser && u.password === password);
  if (!user) {
    addLog(cleanUser, 'USER_LOGIN', 'FAILED', 'Password atau Username salah');
    return res.status(401).json({ success: false, message: 'Username atau Password salah!' });
  }

  addLog(cleanUser, 'USER_LOGIN', 'SUCCESS', 'Login sukses');
  return res.json({
    success: true,
    message: 'Login berhasil!',
    user: { username: user.username, email: user.email, role: user.role, credits: user.credits }
  });
});

/* ==========================================================================
   ALIGHT MOTION GENERATOR ENDPOINTS
   ========================================================================== */

app.post('/api/send-link', async (req, res) => {
  try {
    const { email, username } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email target wajib diisi!' });
    }

    const response = await axios.post(`${config.baseUrl}/send-link`, { email }, {
      headers: { 'x-api-key': config.apiKey }
    });

    addLog(username || 'guest', 'SEND_MAGIC_LINK', 'SUCCESS', `Magic link dikirim ke ${email}`);
    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data || { success: false, message: error.message };
    addLog(req.body.username || 'guest', 'SEND_MAGIC_LINK', 'FAILED', error.message);
    return res.status(status).json(data);
  }
});

app.post('/api/activate', async (req, res) => {
  try {
    const { email, magicLink, username } = req.body;
    if (!email || !magicLink) {
      return res.status(400).json({ success: false, message: 'Email target dan Magic Link wajib diisi!' });
    }

    const response = await axios.post(`${config.baseUrl}/activate`, { email, magicLink }, {
      headers: { 'x-api-key': config.apiKey }
    });

    addLog(username || 'guest', 'ACTIVATE_PREMIUM', 'SUCCESS', `Premium diaktifkan untuk ${email}`);
    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data || { success: false, message: error.message };
    addLog(req.body.username || 'guest', 'ACTIVATE_PREMIUM', 'FAILED', error.message);
    return res.status(status).json(data);
  }
});

/* ==========================================================================
   INBOXKITTEN AUTOMATIC MAGICK LINK FETCH & AUTO ACTIVATION
   ========================================================================== */

app.post('/api/inboxkitten/auto-activate', async (req, res) => {
  const { username } = req.body;
  const recipient = 'hero' + Math.floor(Math.random() * 899999 + 100000);
  const email = `${recipient}@inboxkitten.com`;

  try {
    // Step 1: Kirim magic link
    const sendRes = await axios.post(`${config.baseUrl}/send-link`, { email }, {
      headers: { 'x-api-key': config.apiKey }
    });

    if (!sendRes.data || !sendRes.data.success) {
      return res.status(400).json({ success: false, message: 'Gagal mengirim magic link: ' + (sendRes.data?.message || 'Unknown error') });
    }

    // Step 2: Poll InboxKitten API hingga pesan masuk (maksimal 30 detik)
    let storageKey = null;
    const startTime = Date.now();

    while (Date.now() - startTime < 35000) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const listRes = await axios.get(`https://inboxkitten.com/api/v1/mail/list?recipient=${recipient}`);
        const mailList = listRes.data;
        if (Array.isArray(mailList) && mailList.length > 0) {
          const firstMail = mailList[0];
          if (firstMail && firstMail.storage && firstMail.storage.key) {
            storageKey = firstMail.storage.key;
            break;
          }
        }
      } catch (e) {}
    }

    if (!storageKey) {
      return res.status(408).json({
        success: false,
        email,
        message: 'Timeout: Email belum masuk di InboxKitten setelah 35 detik. Anda bisa mengecek inbox manual di inboxkitten.com.'
      });
    }

    // Step 3: Ambil HTML pesan dari InboxKitten & ekstrak magic link
    const getRes = await axios.get(`https://inboxkitten.com/api/v1/mail/get?mailKey=${storageKey}`);
    const htmlContent = String(getRes.data || '');

    // Match Firebase / Alight Creative magic link pattern
    const linkMatch = htmlContent.match(/https:\/\/[^\s"'<>]*alight[^\s"'<>]*/i) || htmlContent.match(/https:\/\/alightcreative\.com[^\s"'<>]*/i);

    if (!linkMatch || !linkMatch[0]) {
      return res.status(400).json({
        success: false,
        email,
        message: 'Pesan diterima di InboxKitten tetapi Magic Link tidak dapat diekstrak secara otomatis.'
      });
    }

    const magicLink = linkMatch[0];

    // Step 4: Otomatis panggil API Activate
    const activateRes = await axios.post(`${config.baseUrl}/activate`, { email, magicLink }, {
      headers: { 'x-api-key': config.apiKey }
    });

    addLog(username || 'guest', 'AUTO_ACTIVATE_INBOXKITTEN', 'SUCCESS', `Auto aktivasi sukses untuk ${email}`);

    return res.json({
      success: true,
      email,
      magicLink,
      activation: activateRes.data,
      message: `🎉 KABOOM! Akun ${email} BERHASIL Diaktifkan Secara Otomatis via InboxKitten!`
    });

  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message;
    addLog(username || 'guest', 'AUTO_ACTIVATE_INBOXKITTEN', 'FAILED', errorMsg);
    return res.status(500).json({ success: false, email, message: 'Gagal auto aktivasi: ' + errorMsg });
  }
});

/* ==========================================================================
   FITUR OWNER
   ========================================================================== */

function isOwnerRequest(req) {
  const authHeader = req.headers['x-owner-secret'];
  return authHeader === config.ownerPassword;
}

app.get('/api/owner/dashboard', (req, res) => {
  if (!isOwnerRequest(req)) {
    return res.status(403).json({ success: false, message: 'Akses Ditolak! Hanya untuk Owner.' });
  }

  return res.json({
    success: true,
    stats: {
      totalUsers: users.length,
      totalLogs: logs.length,
      currentApiKey: config.apiKey ? (config.apiKey.substring(0, 10) + '****************') : 'NOT SET',
      baseUrl: config.baseUrl,
      autoPushGithub: config.autoPushGithub
    },
    users: users.map(u => ({ id: u.id, username: u.username, email: u.email, role: u.role, credits: u.credits, createdAt: u.createdAt })),
    logs: logs.slice(0, 50)
  });
});

app.post('/api/owner/update-config', (req, res) => {
  if (!isOwnerRequest(req)) {
    return res.status(403).json({ success: false, message: 'Akses Ditolak!' });
  }

  const { newApiKey, newBaseUrl, newOwnerPassword } = req.body;

  if (newApiKey && newApiKey.trim()) config.apiKey = newApiKey.trim();
  if (newBaseUrl && newBaseUrl.trim()) config.baseUrl = newBaseUrl.trim();
  if (newOwnerPassword && newOwnerPassword.trim()) config.ownerPassword = newOwnerPassword.trim();

  writeJSON(CONFIG_FILE, config);
  addLog('owner', 'UPDATE_CONFIG', 'SUCCESS', 'Owner memperbarui API Key / Konfigurasi');

  return res.json({
    success: true,
    message: 'Konfigurasi API Key & Settings berhasil diperbarui!',
    config: {
      apiKey: config.apiKey.substring(0, 10) + '****************',
      baseUrl: config.baseUrl
    }
  });
});

app.post('/api/owner/sync-github', (req, res) => {
  if (!isOwnerRequest(req)) {
    return res.status(403).json({ success: false, message: 'Akses Ditolak!' });
  }

  exec('git add data/*.json && git commit -m "manual: Owner triggered database sync" && git push origin master', { cwd: __dirname }, (error) => {
    if (error) {
      return res.status(500).json({ success: false, message: 'Status Sync: Local data saved. Git info: ' + error.message });
    }
    addLog('owner', 'SYNC_GITHUB', 'SUCCESS', 'Database di-push ke GitHub');
    return res.json({ success: true, message: 'Database BERHASIL Di-upload ke GitHub Repository!' });
  });
});

// Fallback index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server on 0.0.0.0 for Railway
app.listen(PORT, HOST, () => {
  console.log(`⚡ Alight Motion Pro Comic Generator running on http://${HOST}:${PORT}`);
});
