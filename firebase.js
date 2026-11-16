const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getDatabase } = require('firebase-admin/database');

// Default embedded credential for zero-config deployment on Railway
const DEFAULT_CREDS_B64 = 'ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiZGF0YWJhc2UtbWVyY2hhbnQiLAogICJwcml2YXRlX2tleV9pZCI6ICJjMTkwZmZiODA5NDJiZmU5ZTE0YjM2Yzc0ZDhlMGM3MjY1NTY5ODQyIiwKICAicHJpdmF0ZV9rZXkiOiAiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdlFJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLY3dnZ1NqQWdFQUFvSUJBUURWT0pXM253SnB2ODh1XG5jZWNUcGo0N2xQaGU1ZUhqdkcyOVAyN0FQOWJMNStyUUVBRXBTTitEbllqUzRXWG9nSDMyYUpncTIvVyt1ZFdZXG5jRTVaZEZNeENiL09sdmNaNGNxZFk5cUViaWNyWE80TjgzS1o3Mkp2bi9EbG5CZ3hkZkFkVVppUlZKOTE0L3BrXG5uVk9PdVd6WlVQS3o1TVFVd0d1S3lSQmViTFBKQVZiOGVDZUY2YVRvMUc3WVpwZzZ6RTBleElJR2RzUzJSRWJ1XG4wWGovdGJna0NqbGNmdEFGRVdyVHBwU1kvZFVnNkpvQTlHZHkwemtHWkM4OGtsTFY0dHRvcjRPN3pFdE1TNC9PXG5aS3lHMk1GeXFyTVpHUkgxYVpvSExYaXIzM2I1Nk9pZHNaRzRPVnYvcHc3RFFPTVZ1TXVvVlRBVWpFSVJDbkVSXG5OUEh4b2xvYkFnTUJBQUVDZ2dFQUNNYjZDWGpmRVdSY2VTc21Mek1PUFJ5bzlzWEcwcEw4cWlnMDBtN1kvdTdaXG5SZDhLeW9kelJWM3BvU2kzTGJ3d1hldzRxMkdxVUVOM3pWSitOSVRWM0luQlhzQ1hMblpvTC85MElqUjRvZnFDXG4ydDhxZzJJTkxzN1U0Z0dCZTNQQlFvRUw0MFpWQkNEYzVneHJRVStxY1VNTzkvblRCVG1yUGxJcTZDcllZYzM4XG5NNUdsdHBKOUpZSEsrbFVUZUJ0MVlvbDVzQ1Z6bElJUlUwRmtvaFY2RzBqR0lJV1ZqZUw0eFVGNUczUHFqcEloXG5hZzd2VzA0am1iN1h1NUc0c2lZOExzTXZGcnJyQXU2QzgyYlBYelk3eVdPczJkOXBOU2YycUp1WkVTbFBPSHhTXG5lRkNzU2NOTlJUZ3RkMmRQNTlqZDZ2azErek5mMVNFVVYwNTA2OWtVd1FLQmdRRDZFeS9UblNCK2E0VTNoT2t3XG5mVzdIS2ZqN2x0WjNKY1JpU1JDdE91QXFObVhVeUM0QVFyR2Q2NmpSMElUM0VNZWlEUnVKZmMzSGZ0TkxsdXR2XG5FblNpMHdNZXE5WW5pNytIaXpTLzYxWkhvbWxITFJiN0E5NW5Xa21QeVZhWGsvd0tZTG01RnpUSFZ1WWYxaTEwXG5aR3hya3pNcTQrM3ptM0NJYjU4TUQwQnkyd0tCZ1FEYVJkenVqNDJpQ2JUVWVERVZsQkFmNXNPdzYzb3V5citrXG40YmdqekZvTk15RW11dFpRNElQMGJDckVtOThFUWdJQS95ZEpZZXpEMDZoNHdzR1RpNXdOc2JYbDRvNDJESGt4XG5GdkY1MGFhWkNXcEg3QXZyUllHSlloTjNFZm5lQ3Fyd1hYaDJDeGp5alVHS1ZYNG54ekU2S0RtektrSXlJbE94XG5OYnJCNERzNXdRS0JnUUMyakFyOWpsV0o4ekxydERvRkM0c3lGNUdKRmpLNEJ2bTBSV0hIRXBOUVBTVllqa2dHXG5LS2svZmlkZUFia09JVkdaR2JoZ1JWVlJxMkxTYXZpeHUrY29kS0J5WXoyUTRKS1BmeTZpYWtneFFuMVhWN0xPXG55YVF3RGRoay9iUVlNZzVxQlBHT0MwS2J3UE43aWZ6a1dlcExITWpkSmtVczd1cldyYVNNU1JYaXdRS0JnQWNCXG5ET2plMUdXcHVCTEZWSlhqcld6SW8ranVkWHBBNlV0cUx0Vi9QamlFTm9FZXA3ZnFySEZRYzBMaDJaTXlad3dQXG5JL3lYMXRnbDE1Y2djTVBDVEJ5b1lqVGhReno2dzN6T3hxcnBEbGFFMWRNL0FOYm80UkkrZ205a3RVYnB3cmg1XG4xMTY2Vm0rYUZzdFFtUDYveHBXZUt0UFQvRkhOaGkvK2tHS2VSbWhCQW9HQUtEREZ2Qkw1YWhVeU9mV2VUN09ZXG43S1NQZkVWMy9RY3RaTjZlZWRQZXRoQUxQWjNyTHNYTm1ZNCthalR6VDM4NTV6MWUzbFB3TTVVTklKRlZ6dHAxXG4vaVBMbUhGMXYzR05CMEdOcjk3ZUdiTEZRSmJmV09TUWlBdHRWTUlmMnBtMWNlWVNiN3R5ODIxT3YwNkZFWHRWXG5tbGQ2RG93cnprVGZabDY0VDU1K3VKbz1cbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS1cbiIsCiAgImNsaWVudF9lbWFpbCI6ICJmaXJlYmFzZS1hZG1pbnNkay1mYnN2Y0BkYXRhYmFzZS1tZXJjaGFudC5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgImNsaWVudF9pZCI6ICIxMTE0MzkwNjg3MjA0MjQ0NjcxNDAiLAogICJhdXRoX3VyaSI6ICJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsCiAgInRva2VuX3VyaSI6ICJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLAogICJjbGllbnRfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L2ZpcmViYXNlLWFkbWluc2RrLWZic3ZjJTQwZGF0YWJhc2UtbWVyY2hhbnQuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0=';

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
    let databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://database-alight-motion-default-rtdb.firebaseio.com/';

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

    // 3. Fallback: Embedded default credential (Zero config required for Railway)
    if (!serviceAccount && DEFAULT_CREDS_B64) {
      try {
        const decoded = Buffer.from(DEFAULT_CREDS_B64, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
        console.log('🔥 [Firebase] Loaded built-in Service Account for zero-config deployment');
      } catch (e) {
        console.warn('⚠️ [Firebase] Failed to parse built-in credentials:', e.message);
      }
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
