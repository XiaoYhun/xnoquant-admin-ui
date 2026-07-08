import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase Auth is browser-only. Initializing it during SSR/prerender — where the
// NEXT_PUBLIC_* config isn't present — throws `auth/invalid-api-key` and fails the
// build (e.g. prerendering /_not-found). Only initialize in the browser; every
// consumer (AuthProvider, useAuth) touches `auth` in client effects/handlers, never
// during server render.
function initAuth(): Auth {
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

export const auth: Auth = typeof window === "undefined" ? (undefined as unknown as Auth) : initAuth();
