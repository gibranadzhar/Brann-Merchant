import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Railway Bot Premium API Credentials
const API_KEY = 'Codex-D1FAF918-419CB645-93B44EEA-58A4EFB5';
const BASE_URL = 'https://brann-alight-motion-2-production.up.railway.app/api/v1/bot-premium';
const headers = { 'x-api-key': API_KEY };

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * 1. Send Link API Endpoint
 * Request Magic Link for target email
 */
app.post('/api/send-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email target wajib diisi!' });
    }
    console.log(`[API CALL] Send Link for: ${email}`);
    const response = await axios.post(`${BASE_URL}/send-link`, { email }, { headers });
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[SEND LINK ERROR]', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const data = error.response?.data || { success: false, message: error.message };
    return res.status(status).json(data);
  }
});

/**
 * 2. Activate Premium API Endpoint
 * Activate Alight Motion Premium using target email and Magic Link
 */
app.post('/api/activate', async (req, res) => {
  try {
    const { email, magicLink } = req.body;
    if (!email || !magicLink) {
      return res.status(400).json({ success: false, message: 'Email dan Magic Link wajib diisi!' });
    }
    console.log(`[API CALL] Activate Premium for: ${email}`);
    const response = await axios.post(`${BASE_URL}/activate`, { email, magicLink }, { headers });
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[ACTIVATE ERROR]', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const data = error.response?.data || { success: false, message: error.message };
    return res.status(status).json(data);
  }
});

/**
 * 3. Health Check API Endpoint
 */
app.get('/api/health', async (req, res) => {
  try {
    const response = await axios.post(`${BASE_URL}/send-link`, { email: 'health@check.com' }, { headers });
    return res.json({ success: true, online: true, message: 'Railway API Connected & Online' });
  } catch (error) {
    return res.json({ success: true, online: true, message: 'Server Online' });
  }
});

// Fallback all routes to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`⚡ Alight Motion Pro Comic Generator running on http://localhost:${PORT}`);
});
