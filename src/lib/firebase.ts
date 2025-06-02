// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './firebaseConfig';

// Explicitly type the imported config to allow for potentially undefined values from process.env
const appConfig: FirebaseOptions = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
};

const keyToEnvVarMapping: Partial<Record<keyof FirebaseOptions, string>> = {
  apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
};

// Define which keys are absolutely essential for the app to start
const requiredConfigKeys: Array<keyof FirebaseOptions> = ['apiKey', 'authDomain', 'projectId'];

const missingEnvVars = requiredConfigKeys
  .filter(key => !appConfig[key]) // Check if the value is falsy (undefined, null, or empty string)
  .map(key => keyToEnvVarMapping[key] || `CONFIG_KEY_${String(key).toUpperCase()}`);

if (missingEnvVars.length > 0) {
  const errorMessage = `CRITICAL: Firebase configuration is incomplete. The following required environment variables are missing or empty: ${missingEnvVars.join(', ')}. Please ensure your .env.local file is in the project root and correctly set up with all necessary NEXT_PUBLIC_FIREBASE_... values, then RESTART your development server.`;
  console.error(errorMessage);
  // You might want to throw an error here in a real app to prevent it from running with bad config:
  // throw new Error(errorMessage);
}

const app = !getApps().length ? initializeApp(appConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
