const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getDatabase } = require('firebase-admin/database');

class FirebaseManager {
  constructor() {
    this.isInitialized = false;
    this.firestore = null;
    this.rtdb = null;
    this.projectId = null;
    this.databaseURL = null;
    this.app = null;
    this.init();
  }

  init(customConfig = null) {
    const existingApps = admin.getApps ? admin.getApps() : [];
    if (existingApps.length > 0) {
      this.app = existingApps[0];
      try { this.firestore = getFirestore(this.app); } catch (e) {}
      try { this.rtdb = getDatabase(this.app); } catch (e) {}
      this.isInitialized = true;
      return;
    }

    let serviceAccount = null;
    let databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://database-merchant-default-rtdb.firebaseio.com/';

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
            console.log(`🔥 [Firebase] Loading Service Account from: ${filePath}`);
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
      this.databaseURL = databaseURL;

      const appConfig = {
        credential: admin.cert(serviceAccount)
      };
      if (this.databaseURL) {
        appConfig.databaseURL = this.databaseURL;
      }

      this.app = admin.initializeApp(appConfig);

      try {
        this.firestore = getFirestore(this.app);
      } catch (e) {
        console.warn('⚠️ [Firebase] Firestore initialization warning:', e.message);
      }

      try {
        this.rtdb = getDatabase(this.app);
      } catch (e) {
        console.warn('⚠️ [Firebase] Realtime Database initialization warning:', e.message);
      }

      this.isInitialized = true;
      console.log(`✅ [Firebase] Firebase connected successfully! Project ID: ${this.projectId}`);
      if (this.databaseURL) {
        console.log(`📡 [Firebase] Database URL: ${this.databaseURL}`);
      }
    } catch (err) {
      console.error('❌ [Firebase] Initialization failed:', err.message);
      this.isInitialized = false;
    }
  }

  isReady() {
    return this.isInitialized && (this.firestore !== null || this.rtdb !== null);
  }

  // Save tokens to Realtime DB & Cloud Firestore
  async saveTokens(tokens) {
    if (!this.isReady()) return false;
    let saved = false;

    // 1. Save to Realtime Database (Primary for RTDB)
    if (this.rtdb) {
      try {
        await this.rtdb.ref('gopay_config/tokens').set({
          ...tokens,
          updatedAt: Date.now()
        });
        saved = true;
        console.log('☁️ [Firebase] Tokens successfully synced to Realtime Database!');
      } catch (e) {
        console.warn('⚠️ [Firebase] Realtime Database token save error:', e.message);
      }
    }

    // 2. Save to Cloud Firestore (Backup / Multi-cloud sync)
    if (this.firestore) {
      try {
        const docRef = this.firestore.collection('gopay_config').doc('tokens');
        await docRef.set({
          ...tokens,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        saved = true;
        console.log('☁️ [Firebase] Tokens successfully synced to Cloud Firestore!');
      } catch (e) {
        // Firestore may require database provisioning in Google Cloud Console
      }
    }

    return saved;
  }

  // Load tokens from Realtime DB or Cloud Firestore
  async loadTokens() {
    if (!this.isReady()) return null;

    // 1. Try Realtime Database first
    if (this.rtdb) {
      try {
        const snap = await this.rtdb.ref('gopay_config/tokens').once('value');
        if (snap.exists()) {
          const val = snap.val();
          console.log('☁️ [Firebase] Tokens successfully loaded from Realtime Database!');
          return val;
        }
      } catch (e) {
        console.warn('⚠️ [Firebase] Realtime Database load error:', e.message);
      }
    }

    // 2. Try Firestore fallback
    if (this.firestore) {
      try {
        const docRef = this.firestore.collection('gopay_config').doc('tokens');
        const snap = await docRef.get();
        if (snap.exists) {
          console.log('☁️ [Firebase] Tokens successfully loaded from Cloud Firestore!');
          return snap.data();
        }
      } catch (e) {
        // Firestore read error
      }
    }

    return null;
  }

  // Save API keys to Realtime DB & Cloud Firestore
  async saveApiKeys(apiKeys) {
    if (!this.isReady()) return false;
    let saved = false;

    if (this.rtdb) {
      try {
        await this.rtdb.ref('gopay_config/apikeys').set({
          keys: apiKeys,
          updatedAt: Date.now()
        });
        saved = true;
        console.log('☁️ [Firebase] API Keys successfully synced to Realtime Database!');
      } catch (e) {
        console.warn('⚠️ [Firebase] Realtime Database API keys save error:', e.message);
      }
    }

    if (this.firestore) {
      try {
        const docRef = this.firestore.collection('gopay_config').doc('apikeys');
        await docRef.set({
          keys: apiKeys,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        saved = true;
        console.log('☁️ [Firebase] API Keys successfully synced to Cloud Firestore!');
      } catch (e) {
        // Firestore save error
      }
    }

    return saved;
  }

  // Load API keys from Realtime DB or Cloud Firestore
  async loadApiKeys() {
    if (!this.isReady()) return null;

    if (this.rtdb) {
      try {
        const snap = await this.rtdb.ref('gopay_config/apikeys').once('value');
        if (snap.exists()) {
          const val = snap.val();
          if (Array.isArray(val.keys)) {
            console.log(`☁️ [Firebase] ${val.keys.length} API Keys successfully loaded from Realtime Database!`);
            return val.keys;
          }
        }
      } catch (e) {
        console.warn('⚠️ [Firebase] Realtime Database API keys load error:', e.message);
      }
    }

    if (this.firestore) {
      try {
        const docRef = this.firestore.collection('gopay_config').doc('apikeys');
        const snap = await docRef.get();
        if (snap.exists) {
          const data = snap.data();
          if (Array.isArray(data.keys)) {
            console.log(`☁️ [Firebase] ${data.keys.length} API Keys successfully loaded from Cloud Firestore!`);
            return data.keys;
          }
        }
      } catch (e) {
        // Firestore read error
      }
    }

    return null;
  }
}

const firebaseManager = new FirebaseManager();
module.exports = firebaseManager;
