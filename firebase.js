const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class FirebaseManager {
  constructor() {
    this.isInitialized = false;
    this.firestore = null;
    this.rtdb = null;
    this.projectId = null;
    this.databaseURL = null;
    this.init();
  }

  init(customConfig = null) {
    if (admin.apps.length > 0) {
      try {
        this.firestore = admin.firestore();
      } catch (e) {}
      try {
        this.rtdb = admin.database();
      } catch (e) {}
      this.isInitialized = true;
      return;
    }

    let serviceAccount = null;
    let databaseURL = process.env.FIREBASE_DATABASE_URL || null;

    if (customConfig && customConfig.serviceAccount) {
      serviceAccount = customConfig.serviceAccount;
      if (customConfig.databaseURL) databaseURL = customConfig.databaseURL;
    }

    // 1. Check local file candidates
    if (!serviceAccount) {
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
    }

    // 2. Check environment variable FIREBASE_SERVICE_ACCOUNT (JSON string or base64)
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const val = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
        if (val.startsWith('{')) {
          serviceAccount = JSON.parse(val);
        } else {
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
      this.projectId = serviceAccount.project_id || 'unknown';
      this.databaseURL = databaseURL || process.env.FIREBASE_DATABASE_URL || (this.projectId ? `https://${this.projectId}-default-rtdb.firebaseio.com` : null);

      const appConfig = {
        credential: admin.credential.cert(serviceAccount)
      };
      if (this.databaseURL) {
        appConfig.databaseURL = this.databaseURL;
      }

      admin.initializeApp(appConfig);

      try {
        this.firestore = admin.firestore();
      } catch (e) {
        console.warn('⚠️ [Firebase] Firestore init warning:', e.message);
      }

      try {
        this.rtdb = admin.database();
      } catch (e) {
        // Realtime DB optional if databaseURL not active
      }

      this.isInitialized = true;
      console.log(`✅ [Firebase] Firebase connected successfully! Project ID: ${this.projectId}`);
      if (this.databaseURL) {
        console.log(`📡 [Firebase] Realtime Database URL: ${this.databaseURL}`);
      }
    } catch (err) {
      console.error('❌ [Firebase] Initialization failed:', err.message);
      this.isInitialized = false;
    }
  }

  isReady() {
    return this.isInitialized && (this.firestore !== null || this.rtdb !== null);
  }

  // Save tokens to Firestore & Realtime DB
  async saveTokens(tokens) {
    if (!this.isReady()) return false;
    let saved = false;

    // 1. Try Cloud Firestore
    if (this.firestore) {
      try {
        const docRef = this.firestore.collection('gopay_config').doc('tokens');
        await docRef.set({
          ...tokens,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        saved = true;
        console.log('☁️ [Firebase] Tokens synced to Cloud Firestore!');
      } catch (e) {
        console.warn('⚠️ [Firebase] Firestore token save warning:', e.message);
      }
    }

    // 2. Try Realtime Database backup
    if (this.rtdb) {
      try {
        await this.rtdb.ref('gopay_config/tokens').set({
          ...tokens,
          updatedAt: Date.now()
        });
        saved = true;
        console.log('☁️ [Firebase] Tokens synced to Realtime Database!');
      } catch (e) {
        // Realtime DB backup warning
      }
    }

    return saved;
  }

  // Load tokens from Firestore or Realtime DB
  async loadTokens() {
    if (!this.isReady()) return null;

    // 1. Try Firestore first
    if (this.firestore) {
      try {
        const docRef = this.firestore.collection('gopay_config').doc('tokens');
        const snap = await docRef.get();
        if (snap.exists) {
          console.log('☁️ [Firebase] Tokens loaded from Cloud Firestore!');
          return snap.data();
        }
      } catch (e) {
        console.warn('⚠️ [Firebase] Firestore token load warning:', e.message);
      }
    }

    // 2. Try Realtime Database fallback
    if (this.rtdb) {
      try {
        const snap = await this.rtdb.ref('gopay_config/tokens').once('value');
        if (snap.exists()) {
          console.log('☁️ [Firebase] Tokens loaded from Realtime Database!');
          return snap.val();
        }
      } catch (e) {
        console.warn('⚠️ [Firebase] Realtime Database token load warning:', e.message);
      }
    }

    return null;
  }

  // Save API keys to Firestore & Realtime DB
  async saveApiKeys(apiKeys) {
    if (!this.isReady()) return false;
    let saved = false;

    if (this.firestore) {
      try {
        const docRef = this.firestore.collection('gopay_config').doc('apikeys');
        await docRef.set({
          keys: apiKeys,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        saved = true;
        console.log('☁️ [Firebase] API Keys synced to Cloud Firestore!');
      } catch (e) {
        console.warn('⚠️ [Firebase] Firestore API keys save warning:', e.message);
      }
    }

    if (this.rtdb) {
      try {
        await this.rtdb.ref('gopay_config/apikeys').set({
          keys: apiKeys,
          updatedAt: Date.now()
        });
        saved = true;
        console.log('☁️ [Firebase] API Keys synced to Realtime Database!');
      } catch (e) {
        // Realtime DB backup warning
      }
    }

    return saved;
  }

  // Load API keys from Firestore or Realtime DB
  async loadApiKeys() {
    if (!this.isReady()) return null;

    if (this.firestore) {
      try {
        const docRef = this.firestore.collection('gopay_config').doc('apikeys');
        const snap = await docRef.get();
        if (snap.exists) {
          const data = snap.data();
          if (Array.isArray(data.keys)) {
            console.log(`☁️ [Firebase] ${data.keys.length} API Keys loaded from Cloud Firestore!`);
            return data.keys;
          }
        }
      } catch (e) {
        console.warn('⚠️ [Firebase] Firestore API keys load warning:', e.message);
      }
    }

    if (this.rtdb) {
      try {
        const snap = await this.rtdb.ref('gopay_config/apikeys').once('value');
        if (snap.exists()) {
          const data = snap.val();
          if (Array.isArray(data.keys)) {
            console.log(`☁️ [Firebase] ${data.keys.length} API Keys loaded from Realtime Database!`);
            return data.keys;
          }
        }
      } catch (e) {
        console.warn('⚠️ [Firebase] Realtime Database API keys load warning:', e.message);
      }
    }

    return null;
  }
}

const firebaseManager = new FirebaseManager();
module.exports = firebaseManager;
