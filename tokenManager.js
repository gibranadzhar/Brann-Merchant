const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const firebaseManager = require('./firebase');

class TokenManager {
  constructor() {
    this.candidatePaths = this.resolvePaths();
    this.tokens = {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      lastRefresh: null,
      historyRefreshTokens: []
    };
    
    this.password = null;
    this.refreshInterval = null;
    this.isInitialized = false;
    this.load();
  }

  resolvePaths() {
    const paths = [];

    // 1. Env STORAGE_PATH or DATA_PATH if set
    if (process.env.STORAGE_PATH) {
      paths.push(process.env.STORAGE_PATH.endsWith('.json') 
        ? process.env.STORAGE_PATH 
        : path.join(process.env.STORAGE_PATH, 'tokens.json'));
    }
    if (process.env.DATA_PATH) {
      paths.push(process.env.DATA_PATH.endsWith('.json') 
        ? process.env.DATA_PATH 
        : path.join(process.env.DATA_PATH, 'tokens.json'));
    }

    // 2. Volume & Container paths
    paths.push('/data/tokens.json');
    paths.push('/app/data/tokens.json');
    paths.push('/tmp/tokens.json');

    // 3. Local directory candidate paths
    paths.push(path.join(__dirname, 'tokens.json'));

    return [...new Set(paths)];
  }

  load() {
    for (const filePath of this.candidatePaths) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed && parsed.accessToken && parsed.refreshToken) {
            this.tokens = {
              accessToken: parsed.accessToken,
              refreshToken: parsed.refreshToken,
              expiresAt: parsed.expiresAt || null,
              lastRefresh: parsed.lastRefresh || new Date().toISOString(),
              historyRefreshTokens: Array.isArray(parsed.historyRefreshTokens) ? parsed.historyRefreshTokens : []
            };
            console.log(`✅ [TokenManager] Restored tokens from persistent storage: ${filePath}`);
            return true;
          }
        }
      } catch (e) {
        // Skip unreadable paths
      }
    }
    return false;
  }

  async syncFromCloud() {
    if (!firebaseManager || !firebaseManager.isReady()) return false;
    try {
      const cloud = await firebaseManager.loadTokens();
      if (cloud && cloud.accessToken && cloud.refreshToken) {
        this.tokens = {
          accessToken: cloud.accessToken,
          refreshToken: cloud.refreshToken,
          expiresAt: cloud.expiresAt || null,
          lastRefresh: cloud.lastRefresh || new Date().toISOString(),
          historyRefreshTokens: Array.isArray(cloud.historyRefreshTokens) ? cloud.historyRefreshTokens : []
        };
        this.save();
        console.log('☁️ [TokenManager] Sesi token GoPay dipulihkan dari Cloud Firestore!');
        return true;
      }
    } catch (e) {
      console.warn('⚠️ [TokenManager] Gagal sinkronisasi token dari Firestore:', e.message);
    }
    return false;
  }

  save() {
    if (!this.tokens || !this.tokens.accessToken) return;
    const jsonStr = JSON.stringify(this.tokens, null, 2);

    for (const filePath of this.candidatePaths) {
      try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, jsonStr, 'utf8');
      } catch (e) {
        // Silently skip read-only paths
      }
    }

    // Sync to Cloud Firestore if connected
    if (firebaseManager && firebaseManager.isReady()) {
      firebaseManager.saveTokens(this.tokens).catch(e => {
        console.warn('⚠️ [TokenManager] Firebase Firestore token save error:', e.message);
      });
    }
  }

  // Set password admin untuk protect fitur
  async setPassword(plainPassword) {
    try {
      this.password = await bcrypt.hash(plainPassword, 10);
      this.isInitialized = true;
      return true;
    } catch (e) {
      console.error('Error setting password:', e.message);
      return false;
    }
  }

  // Verify password
  async verifyPassword(plainPassword) {
    if (!this.password) return false;
    try {
      return await bcrypt.compare(plainPassword, this.password);
    } catch (e) {
      console.error('Error verifying password:', e.message);
      return false;
    }
  }

  // Simpan tokens
  setTokens(accessToken, refreshToken) {
    this.tokens.accessToken = accessToken;
    this.tokens.refreshToken = refreshToken;
    this.tokens.lastRefresh = new Date().toISOString();
    this.save();
    console.log(`✅ [TokenManager] Tokens stored & saved to disk at ${this.tokens.lastRefresh}`);
    return true;
  }

  // Ambil tokens yang tersimpan
  getTokens() {
    return {
      accessToken: this.tokens.accessToken,
      refreshToken: this.tokens.refreshToken
    };
  }

  // Cek apakah tokens udah tersedia
  hasTokens() {
    return !!(this.tokens.accessToken && this.tokens.refreshToken);
  }

  // Update access & refresh token setelah refresh
  updateAccessToken(newAccessToken, newRefreshToken = null) {
    return this.updateTokens(newAccessToken, newRefreshToken);
  }

  updateTokens(newAccessToken, newRefreshToken = null) {
    if (!Array.isArray(this.tokens.historyRefreshTokens)) {
      this.tokens.historyRefreshTokens = [];
    }
    if (this.tokens.refreshToken && !this.tokens.historyRefreshTokens.includes(this.tokens.refreshToken)) {
      this.tokens.historyRefreshTokens.unshift(this.tokens.refreshToken);
      if (this.tokens.historyRefreshTokens.length > 5) {
        this.tokens.historyRefreshTokens.pop();
      }
    }

    this.tokens.accessToken = newAccessToken;
    if (newRefreshToken && typeof newRefreshToken === 'string' && newRefreshToken.length > 10) {
      this.tokens.refreshToken = newRefreshToken;
    }
    this.tokens.lastRefresh = new Date().toISOString();
    this.save();
    console.log(`✅ [TokenManager] Tokens updated, rotated & saved at ${this.tokens.lastRefresh}`);
  }

  // Setup auto-refresh interval
  setupAutoRefresh(sdk, refreshInterval = 8 * 60 * 1000) {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      if (!this.hasTokens()) {
        console.log('❌ [TokenManager] Tokens belum tersimpan, skip refresh');
        return;
      }

      // Candidate tokens: current, then previous history
      const candidates = [
        this.tokens.refreshToken,
        ...(this.tokens.historyRefreshTokens || [])
      ].filter(Boolean);

      let refreshed = false;
      for (const tokenCandidate of candidates) {
        try {
          console.log('🔄 [TokenManager] Auto-refreshing owner token...');
          const result = await sdk.refreshToken(tokenCandidate);
          const resData = result.data || result;
          
          if (resData?.access_token) {
            this.updateTokens(resData.access_token, resData.refresh_token);
            console.log('✅ [TokenManager] Owner token refresh & rotation sukses!');
            refreshed = true;
            break;
          }
        } catch (e) {
          console.warn('⚠️ [TokenManager] Refresh candidate failed:', e.message);
        }
      }

      if (!refreshed) {
        console.error('❌ [TokenManager] All refresh candidates failed for owner tokens');
      }
    }, refreshInterval);

    console.log(`⏱️ [TokenManager] Auto-refresh setup: setiap ${refreshInterval / 60000} menit`);
  }

  // Stop auto-refresh
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('⏸️ [TokenManager] Auto-refresh stopped');
    }
  }

  // Reset all
  reset() {
    this.tokens = {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      lastRefresh: null,
      historyRefreshTokens: []
    };
    this.save();
    this.stopAutoRefresh();
    console.log('🔄 [TokenManager] Tokens reset');
  }
}

module.exports = new TokenManager();
