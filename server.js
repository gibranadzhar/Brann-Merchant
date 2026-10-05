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

// Path penyimpanan database JSON local
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Initial Default Config
const DEFAULT_CONFIG = {
  apiKey: process.env.AM_API_KEY || 'Codex-D1FAF918-419CB645-93B44EEA-58A4EFB5',
  baseUrl: process.env.AM_BASE_URL || 'https://brann-alight-motion-2-production.up.railway.app/api/v1/bot-premium',
  ownerUsername: 'owner',
  ownerPassword: 'ownerpassword123', // Owner password default
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
    // Otomatis sync/push database ke GitHub jika diaktifkan
    triggerGithubSync();
  } catch (e) {
    console.error('Error writing JSON:', e.message);
  }
}

// Memory Database Store
let config = readJSON(CONFIG_FILE, DEFAULT_CONFIG);
let users = readJSON(USERS_FILE, []);
let logs = readJSON(LOGS_FILE, []);

// Auto Sync Database ke GitHub
let syncTimeout = null;
function triggerGithubSync() {
  if (!config.autoPushGithub) return;
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    console.log('[AUTO GITHUB SYNC] Pushing updated database to GitHub...');
    exec('git add data/*.json && git commit -m "auto: Sync database updates (users/config/logs)" && git push origin master', { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        console.warn('[AUTO GITHUB SYNC WARN]', error.message);
      } else {
        console.log('[AUTO GITHUB SYNC SUCCESS] Database synced to GitHub!');
      }
    });
  }, 5000); // Throttle sync tiap 5 detik
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
  if (logs.length > 200) logs = logs.slice(0, 200); // keep max 200 logs
  writeJSON(LOGS_FILE, logs);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ==========================================================================
   AUTH ENDPOINTS (REGISTER & LOGIN)
   ========================================================================== */

// Register User Baru
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Semua field (username, email, password) wajib diisi!' });
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
    password, // Dalam aplikasi nyata gunakan bcrypt
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

// Login User & Owner
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan Password wajib diisi!' });
  }

  const cleanUser = username.trim().toLowerCase();

  // Cek Owner Default Login
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
   ALIGHT MOTION GENERATOR ENDPOINTS (API KEY & URL DISEMBUNYIKAN)
   ========================================================================== */

// 1. Send Link API Endpoint
app.post('/api/send-link', async (req, res) => {
  try {
    const { email, username } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email target wajib diisi!' });
    }

    console.log(`[API CALL] Send Link for email: ${email}`);
    
    // Header & API Key disisipkan dari server internals (TIDAK DITUNJUKKAN KE BROWSER/CLIENT)
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

// 2. Activate Premium API Endpoint
app.post('/api/activate', async (req, res) => {
  try {
    const { email, magicLink, username } = req.body;
    if (!email || !magicLink) {
      return res.status(400).json({ success: false, message: 'Email target dan Magic Link wajib diisi!' });
    }

    console.log(`[API CALL] Activate Premium for: ${email}`);
    
    // Header & API Key disisipkan dari server internals
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

// 3. Health Check API Endpoint
app.get('/api/health', async (req, res) => {
  try {
    const response = await axios.post(`${config.baseUrl}/send-link`, { email: 'ping@healthcheck.com' }, {
      headers: { 'x-api-key': config.apiKey }
    });
    return res.json({ success: true, online: true, message: 'Railway Bot Premium API Connected' });
  } catch (error) {
    return res.json({ success: true, online: true, message: 'Server Active' });
  }
});

/* ==========================================================================
   FITUR LENGKAP OWNER (PANEL OWNER & GANTI API KEY)
   ========================================================================== */

// Midware check owner
function isOwnerRequest(req) {
  const authHeader = req.headers['x-owner-secret'];
  return authHeader === config.ownerPassword;
}

// Get Owner Dashboard Config & Stats
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

// GANTI API KEY & CONFIG AM (KHUSUS OWNER)
app.post('/api/owner/update-config', (req, res) => {
  if (!isOwnerRequest(req)) {
    return res.status(403).json({ success: false, message: 'Akses Ditolak! Hanya untuk Owner.' });
  }

  const { newApiKey, newBaseUrl, newOwnerPassword } = req.body;

  if (newApiKey && newApiKey.trim()) {
    config.apiKey = newApiKey.trim();
  }
  if (newBaseUrl && newBaseUrl.trim()) {
    config.baseUrl = newBaseUrl.trim();
  }
  if (newOwnerPassword && newOwnerPassword.trim()) {
    config.ownerPassword = newOwnerPassword.trim();
  }

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

// MANUAL SYNC DATABASE KE GITHUB (OWNER BUTTON)
app.post('/api/owner/sync-github', (req, res) => {
  if (!isOwnerRequest(req)) {
    return res.status(403).json({ success: false, message: 'Akses Ditolak!' });
  }

  console.log('[OWNER MANUAL SYNC] Triggering Git Push...');
  exec('git add data/*.json && git commit -m "manual: Owner triggered database sync" && git push origin master', { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ success: false, message: 'Gagal push ke GitHub: ' + error.message });
    }
    addLog('owner', 'SYNC_GITHUB', 'SUCCESS', 'Database berhasil di-push ke GitHub');
    return res.json({ success: true, message: 'Database (users/logs/config) BERHASIL Di-upload ke GitHub Repository!' });
  });
});

// Fallback index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`⚡ Alight Motion Pro Comic Generator running on http://localhost:${PORT}`);
});
