const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class FirebaseManager {
  constructor() {
    this.isInitialized = false;
    this.db = null;
    this.projectId = null;
    this.init();
  }

  init() {
    if (admin.apps.length > 0) {
      this.db = admin.firestore();
      this.isInitialized = true;
      return;
    }

    let serviceAccount = null;

    // 1. Check local file candidates
    const candidateFiles = [
      path.join(__dirname, 'serviceAccountKey.json'),
      path.join(__dirname, 'data', 'serviceAccountKey.json'),
      path.join(process.cwd(), 'serviceAccountKey.json'),
      path.join('/data', 'serviceAccountKey.json')
    ];

    for (const filePath of candidateFiles) {
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          serviceAccount = JSON.parse(raw);
          console.log(`🔥 [Firebase] Loading Service Account from file: ${filePath}`);
          break;
        } catch (e) {
          console.warn(`⚠️ [Firebase] Failed to parse key file ${filePath}:`, e.message);
        }
      }
    }

    // 2. Check environment variable FIREBASE_SERVICE_ACCOUNT (JSON string or base64)
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const val = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
        if (val.startsWith('{')) {
          serviceAccount = JSON.parse(val);
        } else {
          // Attempt base64 decode
          const decoded = Buffer.from(val, 'base64').toString('utf8');
          serviceAccount = JSON.parse(decoded);
        }
        console.log('🔥 [Firebase] Loading Service Account from FIREBASE_SERVICE_ACCOUNT environment variable');
      } catch (e) {
        console.warn('⚠️ [Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e.message);
      }
    }

    // 3. Check individual environment variables
    if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      serviceAccount = {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      };
      console.log('🔥 [Firebase] Loading Service Account from individual FIREBASE_* env variables');
    }

    if (!serviceAccount) {
      console.log('ℹ️ [Firebase] No credentials found. Running in local fallback mode.');
      this.isInitialized = false;
      return;
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      this.db = admin.firestore();
      this.projectId = serviceAccount.project_id || 'unknown';
      this.isInitialized = true;
      console.log(`✅ [Firebase] Cloud Firestore connected successfully! Project ID: ${this.projectId}`);
    } catch (err) {
      console.error('❌ [Firebase] Initialization failed:', err.message);
      this.isInitialized = false;
    }
  }

  isReady() {
    return this.isInitialized && this.db !== null;
  }

  // Save tokens to Firestore
  async saveTokens(tokens) {
    if (!this.isReady()) return false;
    try {
      const docRef = this.db.collection('gopay_config').doc('tokens');
      await docRef.set({
        ...tokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('☁️ [Firebase] Tokens successfully synced to Cloud Firestore!');
      return true;
    } catch (e) {
      console.error('❌ [Firebase] Failed to save tokens to Firestore:', e.message);
      return false;
    }
  }

  // Load tokens from Firestore
  async loadTokens() {
    if (!this.isReady()) return null;
    try {
      const docRef = this.db.collection('gopay_config').doc('tokens');
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data();
        console.log('☁️ [Firebase] Tokens successfully loaded from Cloud Firestore!');
        return data;
      }
      return null;
    } catch (e) {
      console.error('❌ [Firebase] Failed to load tokens from Firestore:', e.message);
      return null;
    }
  }

  // Save API keys to Firestore
  async saveApiKeys(apiKeys) {
    if (!this.isReady()) return false;
    try {
      const docRef = this.db.collection('gopay_config').doc('apikeys');
      await docRef.set({
        keys: apiKeys,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('☁️ [Firebase] API Keys successfully synced to Cloud Firestore!');
      return true;
    } catch (e) {
      console.error('❌ [Firebase] Failed to save API keys to Firestore:', e.message);
      return false;
    }
  }

  // Load API keys from Firestore
  async loadApiKeys() {
    if (!this.isReady()) return null;
    try {
      const docRef = this.db.collection('gopay_config').doc('apikeys');
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data();
        if (Array.isArray(data.keys)) {
          console.log(`☁️ [Firebase] ${data.keys.length} API Keys successfully loaded from Cloud Firestore!`);
          return data.keys;
        }
      }
      return null;
    } catch (e) {
      console.error('❌ [Firebase] Failed to load API keys from Firestore:', e.message);
      return null;
    }
  }
}

const firebaseManager = new FirebaseManager();
module.exports = firebaseManager;
