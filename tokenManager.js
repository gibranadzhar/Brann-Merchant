const bcrypt = require('bcryptjs');

class TokenManager {
  constructor() {
    // In-memory storage (bisa dipindah ke database nantinya)
    this.tokens = {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      lastRefresh: null
    };
    
    this.password = null;
    this.refreshInterval = null;
    this.isInitialized = false;
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
    this.tokens.lastRefresh = new Date();
    
    console.log(`✅ Tokens stored at ${this.tokens.lastRefresh}`);
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
    this.tokens.accessToken = newAccessToken;
    if (newRefreshToken && typeof newRefreshToken === 'string' && newRefreshToken.length > 10) {
      this.tokens.refreshToken = newRefreshToken;
    }
    this.tokens.lastRefresh = new Date();
    console.log(`✅ Tokens updated & rotated at ${this.tokens.lastRefresh}`);
  }

  // Setup auto-refresh interval
  setupAutoRefresh(sdk, refreshInterval = 8 * 60 * 1000) {
    // Jika sudah ada interval, clear dulu
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      if (!this.hasTokens()) {
        console.log('❌ Tokens belum tersimpan, skip refresh');
        return;
      }

      try {
        console.log('🔄 Auto-refreshing owner token...');
        const result = await sdk.refreshToken(this.tokens.refreshToken);
        const resData = result.data || result;
        
        if (resData?.access_token) {
          this.updateTokens(resData.access_token, resData.refresh_token);
          console.log('✅ Owner token refresh & rotation sukses!');
        }
      } catch (e) {
        console.error('❌ Token refresh failed:', e.message);
      }
    }, refreshInterval);

    console.log(`⏱️ Auto-refresh setup: setiap ${refreshInterval / 60000} menit`);
  }

  // Stop auto-refresh
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('⏸️ Auto-refresh stopped');
    }
  }

  // Reset all
  reset() {
    this.tokens = {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      lastRefresh: null
    };
    this.stopAutoRefresh();
    console.log('🔄 Tokens reset');
  }
}

module.exports = new TokenManager();
