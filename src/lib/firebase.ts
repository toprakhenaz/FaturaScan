
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseConfig as importedConfig } from './firebaseConfig';

// Explicitly type the imported config
const appConfig: FirebaseOptions = {
  apiKey: importedConfig.apiKey,
  authDomain: importedConfig.authDomain,
  projectId: importedConfig.projectId,
  storageBucket: importedConfig.storageBucket,
  messagingSenderId: importedConfig.messagingSenderId,
  appId: importedConfig.appId,
};

const keyToEnvVarMapping: Record<keyof FirebaseOptions, string> = {
  apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
};

const requiredConfigKeys: Array<keyof FirebaseOptions> = ['apiKey', 'authDomain', 'projectId'];

let app: FirebaseApp;
let auth: Auth | undefined = undefined;
let db: Firestore | undefined = undefined;
let storage: FirebaseStorage | undefined = undefined;
let appInitializationError: string | null = null;

console.log('[Firebase] Initializing with raw imported config:', importedConfig);
console.log('[Firebase] Effective appConfig for initialization:', appConfig);

const missingEnvVars: string[] = [];
for (const key of requiredConfigKeys) {
  if (!appConfig[key]) {
    missingEnvVars.push(keyToEnvVarMapping[key] || `CONFIG_KEY_${String(key).toUpperCase()}`);
  }
}

if (missingEnvVars.length > 0) {
  appInitializationError = `CRITICAL: Firebase configuration is incomplete. The following required environment variables are missing or empty: ${missingEnvVars.join(', ')}. Please ensure your .env.local file is in the project root, correctly set up with all necessary NEXT_PUBLIC_FIREBASE_... values, and that you have RESTARTED your development server.`;
  console.error(`[Firebase Init Error] ${appInitializationError}`);
  console.error('[Firebase Init Error] Current appConfig values that were checked:', {
    apiKey: appConfig.apiKey,
    authDomain: appConfig.authDomain,
    projectId: appConfig.projectId,
  });
} else {
  try {
    console.log('[Firebase] All required config keys seem present. Attempting initialization...');
    const initializedApp = !getApps().length ? initializeApp(appConfig) : getApp();
    app = initializedApp;
    auth = getAuth(initializedApp);
    db = getFirestore(initializedApp);
    storage = getStorage(initializedApp);
    console.log('[Firebase] Initialization successful.');
  } catch (e: any) {
    appInitializationError = `Firebase SDK initialization failed: ${e.message}. This can happen if your Firebase config values (e.g., apiKey, authDomain, projectId) in .env.local are present but incorrect or malformed (e.g., typos, extra spaces, wrong project values). Please double-check them against your Firebase project settings and RESTART your development server. Original error: ${e.toString()}`;
    console.error(`[Firebase Init Error] ${appInitializationError}`, e);
    // Reset to undefined if initialization failed partway
    auth = undefined;
    db = undefined;
    storage = undefined;
  }
}
console.log('[Firebase] Module loaded.');
export { app, auth, db, storage, appInitializationError };

