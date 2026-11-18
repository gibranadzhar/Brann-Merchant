const express = require('express');
const path = require('path');
const GoMerchant = require('./GoMerchant');
const { ImageUploadService } = require("node-upload-images");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const FormData = require("form-data");
const session = require('express-session');
const tokenManager = require('./tokenManager');
const firebaseManager = require('./firebase');
const apiKeyManager = require('./apiKeyManager');

const app = express();
const sdk = new GoMerchant();

app.set('json spaces', 2);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware untuk track password verification
app.use(session({
  secret: process.env.SESSION_SECRET || 'CHANGE_ME_SESSION_SECRET',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Setup default password jika belum ada
(async () => {
  if (!tokenManager.password) {
    // 🔐 UBAH PASSWORD DI SINI (atau set env ADMIN_PASSWORD — env lebih diutamakan)
    const PASSWORD = process.env.ADMIN_PASSWORD || 'Akunff+62';
    await tokenManager.setPassword(PASSWORD);
    console.log('✅ Admin password initialized (default|env).');
  }

  // 0. Sinkronisasi data dari Cloud Firestore jika terhubung
  if (firebaseManager.isReady()) {
    await tokenManager.syncFromCloud();
    await apiKeyManager.syncFromFirebase();
  }

  // 1. Cek & aktifkan token Owner bila tersimpan di disk
  if (tokenManager.hasTokens()) {
    tokenManager.setupAutoRefresh(sdk, 8 * 60 * 1000);
    console.log('🛡️ [TokenManager] Sesi token Owner otomatis dipulihkan dari penyimpanan disk!');
  } else {
    // 2. Fallback: jika apiKeyManager memiliki token, sinkronkan ke tokenManager
    const keyWithTokens = apiKeyManager.getAll().find(k => k.tokens?.accessToken && k.tokens?.refreshToken);
    if (keyWithTokens) {
      tokenManager.setTokens(keyWithTokens.tokens.accessToken, keyWithTokens.tokens.refreshToken);
      tokenManager.setupAutoRefresh(sdk, 8 * 60 * 1000);
      console.log(`🛡️ [TokenManager] Sesi dipulihkan dari API Key '${keyWithTokens.key}'!`);
    }
  }

  // 3. ⚡ Mulai 20x Armor background auto-refresh loop untuk seluruh user API Keys (setiap 2 menit)
  apiKeyManager.startAutoRefreshLoop(sdk, 2 * 60 * 1000);
})();

// ================= FUNGSI UPLOAD =================
async function toUrl(buffer, provider = "catbox") {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Input harus buffer");
  }

  // === CATBOX ===
  if (provider === "catbox") {
    const form = new FormData();
    form.append("fileToUpload", buffer, "file.png");
    form.append("reqtype", "fileupload");

    const res = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: form,
      headers: form.getHeaders()
    });

    const text = await res.text();
    if (!text.startsWith("http")) throw new Error("Catbox upload gagal");
    return text;
  }

  // === FALLBACK PROVIDER (untuk provider lain jika butuh) ===
  const service = new ImageUploadService(provider);
  let { directLink } = await service.uploadFromBinary(buffer, "skyzo.png");
  return directLink;
}

// ================= ROUTE HALAMAN =================
app.get('/', (req, res) => {
    res.render('index', { isPasswordProtectedReady: tokenManager.isInitialized });
});

// Token setup page (protected by password)
app.get('/auth/token-setup', (req, res) => {
    if (!req.session.passwordVerified) {
        return res.status(403).render('index', { 
            error: 'Kamu perlu verify password dulu untuk akses token setup!',
            isPasswordProtectedReady: tokenManager.isInitialized,
            showPasswordPrompt: true
        });
    }
    res.render('token-setup', { hasTokens: tokenManager.hasTokens() });
});

// ================= AUTH =================
// Verify password untuk akses token setup
app.post('/api/auth/verify-password', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ success: false, error: 'Password wajib diisi' });
        }

        const isValid = await tokenManager.verifyPassword(password);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Password salah!' });
        }

        // Mark session as password verified
        req.session.passwordVerified = true;
        res.json({ success: true, message: 'Password verified! Redirect ke token setup...' });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// Setup/Save tokens
app.post('/api/auth/tokens', async (req, res) => {
    try {
        if (!req.session.passwordVerified) {
            return res.status(403).json({ success: false, error: 'Verify password dulu!' });
        }

        const { accessToken, refreshToken } = req.body;
        
        if (!accessToken || !refreshToken) {
            return res.status(400).json({ 
                success: false, 
                error: 'Access token dan refresh token wajib diisi' 
            });
        }

        // Validate tokens dengan test API call
        try {
            await sdk.getMe(accessToken);
        } catch (e) {
            return res.status(400).json({ 
                success: false, 
                error: 'Access token tidak valid! ' + (e.response?.data?.message || e.message)
            });
        }

        // Save tokens
        tokenManager.setTokens(accessToken, refreshToken);

        // Setup auto-refresh setiap 15 menit
        tokenManager.setupAutoRefresh(sdk, 15 * 60 * 1000);

        res.json({ 
            success: true, 
            message: 'Tokens saved! Auto-refresh aktif setiap 15 menit.',
            hasTokens: true
        });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// Get current token status
app.get('/api/auth/token-status', (req, res) => {
    res.json({
        hasTokens: tokenManager.hasTokens(),
        lastRefresh: tokenManager.tokens.lastRefresh,
        passwordProtected: tokenManager.isInitialized
    });
});

// ================= API KEY MANAGEMENT =================
// Public API key verification / login
app.post('/api/auth/login-apikey', (req, res) => {
    try {
        const { apikey } = req.body;
        if (!apikey) {
            return res.status(400).json({ success: false, error: 'API Key wajib diisi!' });
        }
        const keyData = apiKeyManager.getKey(apikey);
        if (!keyData) {
            return res.status(401).json({ success: false, error: 'API Key tidak valid atau telah dihapus!' });
        }
        res.json({ 
            success: true, 
            message: 'API Key valid!', 
            apikey: keyData.key,
            label: keyData.label,
            hasTokens: !!(keyData.tokens && keyData.tokens.accessToken && keyData.tokens.refreshToken),
            lastRefresh: keyData.tokens?.lastRefresh || null
        });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// User token setup for their API Key
app.post('/api/auth/user-tokens', async (req, res) => {
    try {
        const { apikey, accessToken, refreshToken } = req.body;
        if (!apikey || !apiKeyManager.isValid(apikey)) {
            return res.status(401).json({ success: false, error: 'API Key tidak valid!' });
        }
        if (!accessToken || !refreshToken) {
            return res.status(400).json({ success: false, error: 'Access token dan refresh token wajib diisi!' });
        }
        // Test access token validity
        try {
            await sdk.getMe(accessToken);
        } catch (e) {
            return res.status(400).json({ 
                success: false, 
                error: 'Access token GoPay tidak valid! ' + (e.response?.data?.message || e.message)
            });
        }
        apiKeyManager.setTokens(apikey, accessToken, refreshToken);
        res.json({
            success: true,
            message: 'Token GoPay berhasil disimpan untuk API Key Anda!'
        });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// User key status and token info
app.post('/api/auth/user-key-info', (req, res) => {
    try {
        const { apikey } = req.body;
        if (!apikey || !apiKeyManager.isValid(apikey)) {
            return res.status(401).json({ success: false, error: 'API Key tidak valid!' });
        }
        const keyData = apiKeyManager.getKey(apikey);
        res.json({
            success: true,
            key: keyData.key,
            label: keyData.label,
            hasTokens: !!(keyData.tokens && keyData.tokens.accessToken && keyData.tokens.refreshToken),
            lastRefresh: keyData.tokens ? keyData.tokens.lastRefresh : null
        });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// List all API keys (Owner only)
app.get('/api/auth/apikeys', (req, res) => {
    if (!req.session.passwordVerified) {
        return res.status(403).json({ success: false, error: 'Verify password dulu untuk akses Owner Portal!' });
    }
    res.json({ success: true, keys: apiKeyManager.getAll() });
});

// Add new API key (Owner only)
app.post('/api/auth/apikeys/add', (req, res) => {
    if (!req.session.passwordVerified) {
        return res.status(403).json({ success: false, error: 'Verify password dulu!' });
    }
    try {
        const { label, customKey } = req.body;
        const newKey = apiKeyManager.addKey(label, customKey);
        res.json({ success: true, message: 'API Key berhasil ditambahkan!', key: newKey });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// Delete API key (Owner only)
app.post('/api/auth/apikeys/delete', (req, res) => {
    if (!req.session.passwordVerified) {
        return res.status(403).json({ success: false, error: 'Verify password dulu!' });
    }
    try {
        const { key } = req.body;
        if (!key) return res.status(400).json({ success: false, error: 'Key wajib diisi!' });
        apiKeyManager.deleteKey(key);
        res.json({ success: true, message: 'API Key berhasil dihapus!' });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// Kirim OTP
app.get('/auth/otp', async (req, res) => {
    try {
        const reqApiKey = req.query.apikey || req.headers['x-api-key'];
        if (!reqApiKey || !apiKeyManager.isValid(reqApiKey)) {
            return res.status(401).json({ 
                success: false, 
                error: 'API Key wajib diisi dan harus valid untuk meminta OTP! Silakan login dengan API Key Anda terlebih dahulu.' 
            });
        }

        let phone = req.query.phone;
        if (!phone) {
            return res.status(400).json({ 
                success: false, 
                error: 'Parameter phone wajib diisi (contoh: 08123456789 atau 628123456789)' 
            });
        }
        
        const cleanPhone = sdk.cleanPhoneNumber(phone);
        if (!cleanPhone || cleanPhone.length < 8) {
            return res.status(400).json({ 
                success: false, 
                error: 'Format nomor HP tidak valid! Masukkan nomor yang benar (contoh: 08123456789)' 
            });
        }

        const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
        const data = await sdk.requestOtp(cleanPhone, clientIp);
        const otpData = data?.data || {};

        res.json({ 
            success: true, 
            data: { 
                otp_token: otpData.otp_token,
                formatted_phone: '+62' + cleanPhone,
                channel: otpData.next_state?.state || 'sms',
                expires_in_seconds: otpData.otp_expires_in || 720,
                cooldown_seconds: otpData.next_state?.timer_in_seconds || 120,
                apikey: reqApiKey,
                message: 'Kode OTP Berhasil Dikirim! Periksa SMS dan WhatsApp resmi Gojek Anda.' 
            } 
        });
    } catch (e) {
        const errorData = e.response?.data;
        let userMessage = e.message;

        if (errorData?.errors && errorData.errors.length > 0) {
            const errObj = errorData.errors[0];
            if (errObj.code?.includes('rate_limit') || errObj.code?.includes('too_many')) {
                userMessage = 'Terlalu sering meminta OTP! Harap tunggu 2-5 menit sebelum meminta OTP kembali (limitasi Gojek).';
            } else if (errObj.code?.includes('missing_field') || errObj.code?.includes('validation')) {
                userMessage = 'Nomor HP tidak valid menurut Gojek. Pastikan nomor sudah benar dan terdaftar di akun Gojek/GoBiz.';
            } else if (errObj.code?.includes('blocked') || errObj.code?.includes('suspended')) {
                userMessage = 'Nomor HP ini diblokir sementara oleh Gojek karena aktivitas mencurigakan.';
            } else {
                userMessage = errObj.message || userMessage;
            }
        }

        res.status(400).json({ 
            success: false, 
            error: userMessage,
            details: errorData || null
        });
    }
});

// Verifikasi OTP (Otomatis simpan token & hubungkan sesi secara permanen)
app.get('/auth/verify', async (req, res) => {
    try {
        const reqApiKey = req.query.apikey || req.headers['x-api-key'] || req.body?.apikey;
        if (!reqApiKey || !apiKeyManager.isValid(reqApiKey)) {
            return res.status(401).json({ 
                success: false, 
                error: 'API Key wajib diisi dan harus valid untuk memverifikasi OTP! Silakan login dengan API Key Anda terlebih dahulu.' 
            });
        }

        const { otp, otp_token } = req.query;
        if (!otp || !otp_token) return res.status(400).json({ success: false, error: 'otp dan otp_token wajib diisi' });
        const cleanOtp = String(otp).trim();
        const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
        const data = await sdk.verifyOtp(cleanOtp, String(otp_token).trim(), clientIp);

        // AUTO-SAVE TOKENS!
        const accessToken = data?.data?.access_token || data?.access_token;
        const refreshToken = data?.data?.refresh_token || data?.refresh_token;

        let savedTo = [];
        if (accessToken && refreshToken) {
            // 1. Simpan LANGSUNG dan UTAMAKAN ke API Key user tersebut!
            apiKeyManager.setTokens(reqApiKey, accessToken, refreshToken);
            savedTo.push(`API Key (${reqApiKey})`);

            // 2. Simpan juga ke tokenManager owner jika belum ada token
            if (!tokenManager.hasTokens()) {
                tokenManager.setTokens(accessToken, refreshToken);
                tokenManager.setupAutoRefresh(sdk, 8 * 60 * 1000);
                savedTo.push('Owner Global');
            }
        }

        res.json({ 
            success: true, 
            data,
            autoSaved: savedTo.length > 0,
            savedTo,
            apikey: reqApiKey,
            message: `🎉 OTP Berhasil Diverifikasi! Akun GoPay telah terhubung otomatis ke API Key ${reqApiKey} dan aktif permanen.`
        });
    } catch (e) {
        const errorData = e.response?.data;
        let userMessage = e.message;
        if (errorData?.errors && errorData.errors.length > 0) {
            const errObj = errorData.errors[0];
            if (errObj.code?.includes('invalid_otp') || errObj.message?.toLowerCase().includes('otp')) {
                userMessage = 'Kode OTP salah atau sudah kedaluwarsa! Silakan minta kode OTP baru.';
            } else {
                userMessage = errObj.message || userMessage;
            }
        }
        res.status(400).json({ success: false, error: userMessage, details: errorData || null });
    }
});


// Cek Status Koneksi Firebase Cloud
app.get('/api/firebase/status', (req, res) => {
  res.json({
    success: true,
    connected: firebaseManager.isReady(),
    projectId: firebaseManager.projectId || null,
    databaseURL: firebaseManager.databaseURL || null,
    mode: firebaseManager.isReady() ? 'Firebase Cloud (Persistent)' : 'Local File Fallback'
  });
});

// Setup / Update Firebase Service Account via Web / API
app.post('/api/firebase/setup', async (req, res) => {
  if (!req.session || !req.session.passwordVerified) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Masukkan password admin terlebih dahulu.' });
  }
  try {
    const { serviceAccount, databaseURL } = req.body;
    if (!serviceAccount) {
      return res.status(400).json({ success: false, error: 'serviceAccount (JSON object atau string) wajib diisi!' });
    }

    let parsed = serviceAccount;
    if (typeof serviceAccount === 'string') {
      parsed = JSON.parse(serviceAccount.trim());
    }

    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      return res.status(400).json({ success: false, error: 'Format Service Account tidak valid. Harus memiliki project_id, client_email, dan private_key.' });
    }

    // Tulis ke serviceAccountKey.json
    const keyPath = path.join(__dirname, 'serviceAccountKey.json');
    fs.writeFileSync(keyPath, JSON.stringify(parsed, null, 2), 'utf8');

    // Re-inisialisasi Firebase
    firebaseManager.init({ serviceAccount: parsed, databaseURL: databaseURL || null });

    if (firebaseManager.isReady()) {
      // Langsung sinkronkan token & apikey yang ada ke cloud
      if (tokenManager.hasTokens()) {
        await firebaseManager.saveTokens(tokenManager.getTokens());
      }
      await firebaseManager.saveApiKeys(apiKeyManager.getAll());

      return res.json({
        success: true,
        message: `🎉 Firebase Cloud Firestore berhasil terhubung ke project '${firebaseManager.projectId}'! Data sesi & API Key otomatis tersinkronisasi ke cloud.`,
        projectId: firebaseManager.projectId
      });
    } else {
      return res.status(500).json({ success: false, error: 'Gagal menginisialisasi Firebase dengan kredensial yang diberikan.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Auto-Restore Tokens dari Browser Cache (Saat Server Baru Selesai Reboot/Redeploy)
app.post('/api/auth/restore-tokens', async (req, res) => {
    try {
        const { accessToken, refreshToken, apikey } = req.body;
        if (!accessToken || !refreshToken) {
            return res.status(400).json({ success: false, error: 'Access token dan refresh token wajib diisi!' });
        }

        let activeAccess = accessToken;
        let activeRefresh = refreshToken;
        try {
            await sdk.getMe(activeAccess);
        } catch (tokenErr) {
            console.log('🔄 [AutoRestore] Token perlu refresh, mencoba me-refresh...');
            const refreshRes = await sdk.refreshToken(activeRefresh);
            const rData = refreshRes.data || refreshRes;
            if (rData?.access_token) {
                activeAccess = rData.access_token;
                if (rData.refresh_token) activeRefresh = rData.refresh_token;
            } else {
                throw new Error('Refresh token sudah kedaluwarsa! Silahkan verifikasi OTP baru.');
            }
        }

        tokenManager.setTokens(activeAccess, activeRefresh);
        tokenManager.setupAutoRefresh(sdk, 8 * 60 * 1000);

        if (apikey && apiKeyManager.isValid(apikey)) {
            apiKeyManager.setTokens(apikey, activeAccess, activeRefresh);
        } else {
            const keys = apiKeyManager.getAll();
            if (keys && keys.length > 0) {
                apiKeyManager.setTokens(keys[0].key, activeAccess, activeRefresh);
            }
        }

        console.log('⚡ [AutoRestore] Sesi token berhasil dipulihkan secara otomatis dari browser cache!');
        res.json({
            success: true,
            message: 'Sesi & token GoPay berhasil dipulihkan secara otomatis!',
            access_token: activeAccess
        });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// Refresh token
app.get('/auth/refresh/token', async (req, res) => {
    try {
        const refreshToken = req.query.refresh_token;
        if (!refreshToken) return res.status(400).json({ success: false, error: 'refresh_token wajib diisi' });
        const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
        const data = await sdk.refreshToken(refreshToken, clientIp);
        res.json({ success: true, data });
    } catch (e) {
        const errData = e.response?.data;
        let errMsg = e.message;
        if (errData?.errors?.[0]?.code === 'goid:error:unauthorized' || errData?.errors?.[0]?.message?.includes('versi aplikasi')) {
            errMsg = 'Refresh token sudah kedaluwarsa atau tidak valid! Silakan login ulang via OTP (/auth/otp) untuk mendapatkan token baru.';
        } else if (errData?.errors?.[0]?.message) {
            errMsg = errData.errors[0].message;
        }
        res.status(401).json({ 
            success: false, 
            error: errMsg,
            hint: 'Sesi GoPay Anda telah berakhir. Silakan gunakan menu /auth/otp di atas untuk meminta OTP baru.',
            details: errData || null 
        });
    }
});

// ================= API =================
// Validasi token & profil
app.get('/api/validate', async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(400).json({ success: false, error: 'token wajib diisi' });
        const data = await sdk.getMe(token);
        res.json({ success: true, user: data.user, access_token: token });
    } catch (e) {
        res.status(401).json({ success: false, error: e.response?.data || e.message });
    }
});

// Profil (me)
app.get('/api/me', async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(400).json({ success: false, error: 'token wajib diisi' });
        const data = await sdk.getMe(token);
        res.json({ success: true, data });
    } catch (e) {
        res.status(400).json({ success: false, error: e.response?.data || e.message });
    }
});

// History dengan token manual (old endpoint, tetap support)
app.get('/api/history', async (req, res) => {
    try {
        const token = req.query.token;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'token wajib diisi'
            });
        }

        const user = await sdk.getMe(token);

        const defaultStartTime = new Date(
            Date.now() - (7 * 24 * 60 * 60 * 1000)
        ).toISOString();

        const startTime = req.query.start_time || defaultStartTime;

        const result = await sdk.getJournals(
            token,
            user.user.merchant_id,
            startTime
        );

        const data = (result.hits || [])
            .filter(item =>
                item?.metadata?.transaction?.payment_type === 'qris'
            )
            .map(item => {
                const aspi = item.metadata?.provider_metadata?.aspi;

                return {
                    id: item.id,
                    reference_id: item.reference_id,
                    status: item.status,
                    time: item.time,

                    amount: aspi?.data?.amount || 0,

                    issuer: aspi?.issuer || null,
                    acquirer: aspi?.acquirer || null,

                    merchant_name: aspi?.data?.merchant_name || null,
                    merchant_id: aspi?.data?.merchant_id || null,
                    merchant_city: aspi?.data?.merchant_city || null,

                    terminal_label:
                        aspi?.data?.additional_data?.terminal_label || null
                };
            });

        res.json({
            success: true,
            total: data.length,
            data
        });

    } catch (e) {
        res.status(400).json({
            success: false,
            error: e.response?.data || e.message
        });
    }
});

// Helper untuk memperketat & memvalidasi transaksi QRIS yang valid & sukses
function parseAndFilterQrisTransactions(hits = [], query = {}) {
    return (hits || [])
        .filter(item => {
            if (!item || !item.id) return false;

            // 1. Strict Payment Type (Hanya QRIS)
            const paymentType = (item?.metadata?.transaction?.payment_type || '').toLowerCase();
            if (paymentType !== 'qris') return false;

            // 2. Strict Status (Wajib SUCCESS / SETTLED / COMPLETED)
            const status = (item?.status || '').toUpperCase();
            const isValidStatus = status === 'SUCCESS' || status === 'SETTLED' || status === 'COMPLETED';
            if (!isValidStatus) return false;

            const aspi = item.metadata?.provider_metadata?.aspi;
            const amount = parseInt(aspi?.data?.amount || (item.amount ? item.amount / 100 : 0)) || 0;

            // Optional amount query filter (?amount=50000)
            if (query.amount && parseInt(query.amount) !== amount) {
                return false;
            }
            // Optional min_amount / max_amount query filter
            if (query.min_amount && amount < parseInt(query.min_amount)) return false;
            if (query.max_amount && amount > parseInt(query.max_amount)) return false;

            return true;
        })
        .map(item => {
            const aspi = item.metadata?.provider_metadata?.aspi;
            const rawAmount = parseInt(aspi?.data?.amount || (item.amount ? item.amount / 100 : 0)) || 0;

            return {
                id: item.id,
                reference_id: item.reference_id,
                status: item.status,
                time: item.time,
                amount: rawAmount,
                issuer: aspi?.issuer || null,
                acquirer: aspi?.acquirer || null,
                merchant_name: aspi?.data?.merchant_name || null,
                merchant_id: aspi?.data?.merchant_id || null,
                merchant_city: aspi?.data?.merchant_city || null,
                terminal_label: aspi?.data?.additional_data?.terminal_label || null
            };
        });
}

// ⭐ AUTO-MANAGED HISTORY API - Per-API-Key Multi-Tenant Auto History (Strict Security)
const handleAutoHistory = async (req, res) => {
    try {
        const reqApiKey = req.params.apikey || req.query.apikey || req.body?.apikey || req.headers['x-api-key'];
        const isOwnerSession = !!req.session.passwordVerified;

        let userTokens = null;

        if (reqApiKey && apiKeyManager.isValid(reqApiKey)) {
            userTokens = apiKeyManager.getTokens(reqApiKey);
        } else if (isOwnerSession) {
            userTokens = tokenManager.hasTokens() ? tokenManager.getTokens() : null;
        } else {
            return res.status(401).json({
                success: false,
                error: 'API Key tidak valid atau belum diisi! Gunakan URL format /api/history/auto/:apikey'
            });
        }

        if (!userTokens || !userTokens.accessToken || !userTokens.refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Token GoPay untuk API Key ini belum di-setup! Silahkan lakukan Setup Token di portal Login API Key.'
            });
        }

        // Proactively ensure valid token before API call
        if (reqApiKey && apiKeyManager.isValid(reqApiKey)) {
            await apiKeyManager.ensureValidToken(sdk, reqApiKey);
            const freshTokens = apiKeyManager.getTokens(reqApiKey);
            if (freshTokens && freshTokens.accessToken) {
                userTokens.accessToken = freshTokens.accessToken;
                if (freshTokens.refreshToken) userTokens.refreshToken = freshTokens.refreshToken;
            }
        }

        const { accessToken, refreshToken } = userTokens;

        try {
            // Fetch dengan current token
            const user = await sdk.getMe(accessToken);

            const defaultStartTime = new Date(
                Date.now() - (7 * 24 * 60 * 60 * 1000)
            ).toISOString();

            const startTime = req.query.start_time || defaultStartTime;

            const result = await sdk.getJournals(
                accessToken,
                user.user.merchant_id,
                startTime
            );

            const data = parseAndFilterQrisTransactions(result.hits, req.query);

            res.json({
                success: true,
                total: data.length,
                data,
                tokenRefreshStatus: 'using_current_token'
            });

        } catch (e) {
            // Jika current token error, coba refresh otomatis
            if (e.response?.status === 401 || e.message.includes('401')) {
                console.log(`🔄 Token expired for key ${reqApiKey || 'owner'}, trying auto-refresh...`);
                
                try {
                    const refreshResult = await sdk.refreshToken(refreshToken);
                    const resData = refreshResult.data || refreshResult;
                    const newAccessToken = resData.access_token;
                    const newRefreshToken = resData.refresh_token;
                    
                    // Update & rotate token yang tersimpan di apiKeyManager / tokenManager
                    if (reqApiKey && apiKeyManager.isValid(reqApiKey)) {
                        apiKeyManager.updateTokens(reqApiKey, newAccessToken, newRefreshToken);
                    } else if (isOwnerSession) {
                        tokenManager.updateTokens(newAccessToken, newRefreshToken);
                    }
                    console.log('✅ Token & Refresh Token auto-refreshed and rotated successfully!');

                    // Retry fetch dengan token baru
                    const user = await sdk.getMe(newAccessToken);
                    const defaultStartTime = new Date(
                        Date.now() - (7 * 24 * 60 * 60 * 1000)
                    ).toISOString();

                    const startTime = req.query.start_time || defaultStartTime;

                    const result = await sdk.getJournals(
                        newAccessToken,
                        user.user.merchant_id,
                        startTime
                    );

                    const data = parseAndFilterQrisTransactions(result.hits, req.query);

                    return res.json({
                        success: true,
                        total: data.length,
                        data,
                        tokenRefreshStatus: 'auto_refreshed_now'
                    });

                } catch (refreshErr) {
                    return res.status(401).json({
                        success: false,
                        error: 'Token expired dan refresh gagal! Silahkan setup ulang token GoPay di portal Login API Key.',
                        refreshError: refreshErr.response?.data || refreshErr.message
                    });
                }
            }

            throw e;
        }

    } catch (e) {
        res.status(400).json({
            success: false,
            error: e.response?.data || e.message
        });
    }
};

app.get('/api/history/auto', handleAutoHistory);
app.get('/api/history/auto/:apikey', handleAutoHistory);

// Daftar payout
app.get('/api/payouts', async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(400).json({ success: false, error: 'token wajib diisi' });
        const data = await sdk.getPayouts(token);
        res.json({ success: true, data });
    } catch (e) {
        res.status(400).json({ success: false, error: e.response?.data || e.message });
    }
});

// QRIS Dinamis → menghasilkan gambar & upload ke hosting, kembalikan URL
app.get('/api/qris/create', async (req, res) => {
    try {
        const { amount, static_qr } = req.query;
        if (!amount || !static_qr) {
            return res.status(400).json({ success: false, error: 'Parameter amount dan static_qr wajib diisi' });
        }

        // Generate QR
        const data = await sdk.createDynamicQRIS(amount, static_qr);
        const qrBuffer = Buffer.isBuffer(data.qr_buffer)
            ? data.qr_buffer
            : Buffer.from(data.qr_buffer.data);

        // Upload buffer ke image hosting
        const imageUrl = await toUrl(qrBuffer, "catbox"); // catbox lebih stabil dari pixhost.to

        res.json({
            success: true,
            image_url: imageUrl,
            amount: data.amount,
            qr_string: data.qr_string,
            created_at: data.created_at
        });
    } catch (e) {
        res.status(400).json({ success: false, error: e.response?.data || e.message });
    }
});

// Cek status pembayaran QRIS
app.get('/api/qris/status', async (req, res) => {
    try {
        const { token, amount, created_at } = req.query;
        if (!token || !amount || !created_at) {
            return res.status(400).json({ success: false, error: 'token, amount, dan created_at wajib diisi' });
        }

        const user = await sdk.getMe(token);
        const logs = await sdk.getJournals(token, user.user.merchant_id, created_at);
        const amountSearch = parseInt(amount) * 100;
        const found = logs.hits.find(h => {
            const txTime = new Date(h.time).getTime();
            const qrisTime = new Date(created_at).getTime();
            return h.amount === amountSearch && txTime >= qrisTime;
        });
        res.json({ success: true, status: found ? 'PAID' : 'PENDING', data: found || null });
    } catch (e) {
        res.status(400).json({ success: false, error: e.response?.data || e.message });
    }
});

// Port internal GOPAY_PORT (default 13016) — sengaja TIDAK membaca env generik
// PORT karena Railway menyuntik PORT=8080 untuk app utama, yang bisa
// nabrak bila kedua app berjalan di environment/deployment yang sama.
// Bind 127.0.0.1 + port internal (13016): publik dilayani nginx di port 3016
// (listen 0.0.0.0:3016 TIDAK bisa bareng bind 127.0.0.1:3016 → EADDRINUSE).
const PORT = process.env.PORT || process.env.GOPAY_PORT || 13016;
const HOST = process.env.HOST || '0.0.0.0';

// Di Vercel, app di-import sebagai serverless function (jangan listen).
// Di Railway / lokal / Termux, jalan dengan app.listen.
if (process.env.VERCEL !== '1') {
    app.listen(PORT, HOST, () => console.log(`✅ Server running on http://${HOST}:${PORT}`));
}

module.exports = app;
