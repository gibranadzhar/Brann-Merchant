# ⚡ Alight Motion Pro Generator — Pop-Art Comic Edition 💥

Website khusus yang didedikasikan untuk membuat dan mengaktifkan akun **Alight Motion Premium** menggunakan API Railway Bot Premium, dikemas dalam tema **Pop-Art Komik Super Keren**!

---

## 🎨 Fitur Utama
- **Step 1: Kirim Magic Link ⚡** (`/api/send-link`) — Mengirim tautan verifikasi Alight Motion ke email target secara otomatis.
- **Step 2: Aktivasi Premium 💥** (`/api/activate`) — Mengaktifkan lisensi Premium tanpa watermark menggunakan Magic Link.
- **Web Audio SFX Synthesizer** — Efek suara komik (laser click, ledakan boom, dan victory arpeggio).
- **Railway API Live Status Bar** — Indikator koneksi real-time ke Railway Engine API.
- **Node.js / Axios Code Explorer** — Reader kode integrasi API lengkap dengan tombol 1-Click Copy Code.

---

## ⚙️ Cara Menjalankan

1. **Install Dependencies:**
```bash
npm install
```

2. **Jalankan Server:**
```bash
npm start
```

3. **Akses Website:**
Buka [http://localhost:3000](http://localhost:3000) di browser kamu.

---

## 📡 Integrasi API (Axios / Node.js)

```javascript
const axios = require('axios');

const API_KEY = 'Codex-D1FAF918-419CB645-93B44EEA-58A4EFB5';
const BASE_URL = 'https://brann-alight-motion-2-production.up.railway.app/api/v1/bot-premium';
const headers = { 'x-api-key': API_KEY };

async function callApi() {
  try {
    const sendLink = await axios.post(
      `${BASE_URL}/send-link`,
      { email: 'target@email.com' },
      { headers }
    );
    console.log('Send Link:', sendLink.data);

    const activate = await axios.post(
      `${BASE_URL}/activate`,
      {
        email: 'target@email.com',
        magicLink: 'https://alightcreative.com/...'
      },
      { headers }
    );
    console.log('Activate:', activate.data);
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
  }
}

callApi();
```
