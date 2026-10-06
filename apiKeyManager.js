const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ApiKeyManager {
  constructor() {
    this.candidatePaths = this.resolvePaths();
    this.keys = [];
    this.init();
  }

  resolvePaths() {
    const paths = [];

    // 1. Env STORAGE_PATH or DATA_PATH if set
    if (process.env.STORAGE_PATH) {
      paths.push(process.env.STORAGE_PATH.endsWith('.json') 
        ? process.env.STORAGE_PATH 
        : path.join(process.env.STORAGE_PATH, 'apikeys.json'));
    }
    if (process.env.DATA_PATH) {
      paths.push(process.env.DATA_PATH.endsWith('.json') 
        ? process.env.DATA_PATH 
        : path.join(process.env.DATA_PATH, 'apikeys.json'));
    }

    // 2. Railway volume default paths (/data)
    paths.push('/data/apikeys.json');
    paths.push('/app/data/apikeys.json');

    // 3. Local directory candidate paths
    paths.push(path.join(__dirname, 'data', 'apikeys.json'));
    paths.push(path.join(__dirname, 'apikeys.json'));

    return [...new Set(paths)];
  }

  mergeKeys(newKeys) {
    if (!Array.isArray(newKeys)) return;
    for (const nk of newKeys) {
      if (!nk || !nk.key) continue;
      const existingIndex = this.keys.findIndex(k => k.key === nk.key);
      if (existingIndex >= 0) {
        const existing = this.keys[existingIndex];
        // Preserve tokens if new key has valid tokens
        if (nk.tokens && nk.tokens.accessToken) {
          if (!existing.tokens || !existing.tokens.accessToken || (nk.tokens.lastRefresh && nk.tokens.lastRefresh >= (existing.tokens.lastRefresh || ''))) {
            existing.tokens = nk.tokens;
          }
        }
        if (nk.label && nk.label !== 'API Key') {
          existing.label = nk.label;
        }
      } else {
        // Missing key found -> add to memory
        this.keys.push(nk);
      }
    }
  }

  init() {
    // Read and merge keys from ALL available candidate file paths on disk
    let loadedAny = false;
    for (const filePath of this.candidatePaths) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.mergeKeys(parsed);
            loadedAny = true;
            console.log(`✅ [ApiKeyManager] Merged ${parsed.length} keys from ${filePath}`);
          }
        }
      } catch (e) {
        // Skip unreadable paths
      }
    }

    if (!loadedAny && this.keys.length === 0) {
      const defaultKey = {
        key: 'BRANN-DEMO-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
        label: 'Demo User',
        createdAt: new Date().toISOString(),
        tokens: null
      };
      this.keys = [defaultKey];
    }

    // Save consolidated keys to all candidate paths
    this.save(false);

    // Fetch and merge keys from GitHub
    this.fetchFromGitHub();
  }

  save(shouldSyncToGitHub = true) {
    if (!Array.isArray(this.keys)) return;
    const jsonStr = JSON.stringify(this.keys, null, 2);

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

    if (shouldSyncToGitHub) {
      this.syncToGitHub();
    }
  }

  async fetchFromGitHub() {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const repo = process.env.GITHUB_REPO || 'gibranadzhar/Brann-Merchant';
    if (!token) return;

    try {
      const url = `https://api.github.com/repos/${repo}/contents/apikeys.json`;
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Brann-Merchant-Server'
      };
      const res = typeof fetch !== 'undefined' ? await fetch(url, { headers }) : null;
      if (res && res.ok) {
        const data = await res.json();
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const countBefore = this.keys.length;
          this.mergeKeys(parsed);
          console.log(`✅ [ApiKeyManager] Merged keys from GitHub (${repo}). Total keys in memory: ${this.keys.length}`);
          this.save(false);
        }
      }
    } catch (e) {
      console.warn(`⚠️ [ApiKeyManager] Could not fetch remote keys from GitHub:`, e.message);
    }
  }

  async syncToGitHub() {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const repo = process.env.GITHUB_REPO || 'gibranadzhar/Brann-Merchant';
    if (!token) return;

    try {
      const url = `https://api.github.com/repos/${repo}/contents/apikeys.json`;
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Brann-Merchant-Server'
      };

      let sha = null;
      if (typeof fetch !== 'undefined') {
        try {
          const getRes = await fetch(url, { headers });
          if (getRes.ok) {
            const getData = await getRes.json();
            sha = getData.sha;
          }
        } catch (e) {}

        const contentBase64 = Buffer.from(JSON.stringify(this.keys, null, 2)).toString('base64');
        const putBody = {
          message: 'auto(db): sync apikeys.json database update from server',
          content: contentBase64,
          branch: 'main'
        };
        if (sha) putBody.sha = sha;

        const putRes = await fetch(url, {
          method: 'PUT',
          headers,
          body: JSON.stringify(putBody)
        });

        if (putRes.ok) {
          console.log(`✅ [ApiKeyManager] Auto-committed & pushed updated database to GitHub (${repo})!`);
        } else {
          const errText = await putRes.text();
          console.error(`⚠️ [ApiKeyManager] GitHub API push failed (${putRes.status}):`, errText);
        }
      }
    } catch (e) {
      console.error(`⚠️ [ApiKeyManager] GitHub auto-sync failed:`, e.message);
    }
  }

  getAll() {
    return this.keys;
  }

  getKey(key) {
    if (!key || typeof key !== 'string') return null;
    const cleanKey = key.trim();
    return this.keys.find(k => k.key === cleanKey) || null;
  }

  addKey(label = 'API Key', customKey = null) {
    const key = customKey && customKey.trim() 
      ? customKey.trim() 
      : 'BRANN-' + crypto.randomBytes(8).toString('hex').toUpperCase();

    const existing = this.keys.find(k => k.key === key);
    if (existing) {
      throw new Error('API Key sudah ada!');
    }

    const newEntry = {
      key,
      label: label.trim() || 'API Key',
      createdAt: new Date().toISOString(),
      tokens: null
    };

    this.keys.push(newEntry);
    this.save(true);
    return newEntry;
  }

  deleteKey(key) {
    const initialLength = this.keys.length;
    this.keys = this.keys.filter(k => k.key !== key);
    if (this.keys.length === initialLength) {
      throw new Error('API Key tidak ditemukan!');
    }
    this.save(true);
    return true;
  }

  isValid(key) {
    return !!this.getKey(key);
  }

  setTokens(key, accessToken, refreshToken) {
    const entry = this.getKey(key);
    if (!entry) {
      throw new Error('API Key tidak ditemukan!');
    }
    entry.tokens = {
      accessToken,
      refreshToken,
      lastRefresh: new Date().toISOString()
    };
    this.save(true);
    return true;
  }

  updateAccessToken(key, newAccessToken, newRefreshToken = null) {
    return this.updateTokens(key, newAccessToken, newRefreshToken);
  }

  updateTokens(key, newAccessToken, newRefreshToken = null) {
    const entry = this.getKey(key);
    if (entry && entry.tokens) {
      if (newRefreshToken && newRefreshToken !== entry.tokens.refreshToken) {
        entry.tokens.previousRefreshToken = entry.tokens.refreshToken;
        entry.tokens.refreshToken = newRefreshToken;
      }
      entry.tokens.accessToken = newAccessToken;
      entry.tokens.lastRefresh = new Date().toISOString();
      this.save(true);
      console.log(`🛡️ [ApiKeyManager] Tokens rotated & backed up for key ${key}`);
    }
  }

  getTokens(key) {
    const entry = this.getKey(key);
    return entry ? entry.tokens : null;
  }

  startAutoRefreshLoop(sdk, intervalMs = 5 * 60 * 1000) {
    if (this.refreshInterval) clearInterval(this.refreshInterval);

    // Initial check after 10 seconds
    setTimeout(() => this.refreshAllTokens(sdk), 10000);

    this.refreshInterval = setInterval(() => this.refreshAllTokens(sdk), intervalMs);
    console.log(`🛡️ [ApiKeyManager] Bulletproof token refresh loop active (every ${intervalMs / 60000} mins)`);
  }

  async ensureValidToken(sdk, key) {
    const entry = this.getKey(key);
    if (!entry || !entry.tokens || !entry.tokens.accessToken) return null;

    const lastRefreshTime = entry.tokens.lastRefresh ? new Date(entry.tokens.lastRefresh).getTime() : 0;
    const now = Date.now();
    const ageMinutes = (now - lastRefreshTime) / (60 * 1000);

    // Proactive refresh if token is older than 5 minutes
    if (ageMinutes >= 5) {
      console.log(`🛡️ [ProactiveRefresh] Token for ${key} is ${Math.round(ageMinutes)} mins old. Refreshing proactively...`);
      await this.refreshSingleTokenWithRetry(sdk, entry, 3);
    }
    return entry.tokens.accessToken;
  }

  async refreshSingleTokenWithRetry(sdk, keyEntry, maxRetries = 5) {
    if (!keyEntry || !keyEntry.tokens) return false;
    
    // Candidates: primary refreshToken first, then previousRefreshToken fallback
    const refreshCandidates = [
      keyEntry.tokens.refreshToken,
      keyEntry.tokens.previousRefreshToken
    ].filter(Boolean);

    for (const tokenCandidate of refreshCandidates) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 [AutoRefresh] Attempt ${attempt}/${maxRetries} refreshing key ${keyEntry.key} (${keyEntry.label})...`);
          const res = await sdk.refreshToken(tokenCandidate);
          const resData = res?.data || res;
          const newAccess = resData?.access_token;
          const newRefresh = resData?.refresh_token;

          if (newAccess) {
            this.updateTokens(keyEntry.key, newAccess, newRefresh);
            console.log(`✅ [AutoRefresh] Success! Token rotated for key ${keyEntry.key}`);
            return true;
          }
        } catch (e) {
          const errMsg = e.response?.data?.message || e.message;
          console.warn(`⚠️ [AutoRefresh] Attempt ${attempt}/${maxRetries} failed:`, errMsg);
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 1500 * attempt));
          }
        }
      }
    }
    return false;
  }

  async refreshAllTokens(sdk) {
    if (!Array.isArray(this.keys) || this.keys.length === 0 || !sdk) return;

    for (const k of this.keys) {
      if (k && k.tokens && k.tokens.refreshToken) {
        await this.refreshSingleTokenWithRetry(sdk, k);
      }
    }
  }
}

module.exports = new ApiKeyManager();
