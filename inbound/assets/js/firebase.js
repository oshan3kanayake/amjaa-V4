// ─────────────────────────────────────────────────────────────
// firebase.js — one Firebase project powers BOTH websites
// (Amja Tours inbound + Amja Travels outbound) and the admin panel.
// These web config values are public by design; Firestore Security
// Rules decide who can read / write.
// ─────────────────────────────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const firebaseConfig = {
  apiKey:            "AIzaSyAd3tsZjjBcLVsTwXcS_xf-PdIx0f5thKg",
  authDomain:        "amjaa-travels.firebaseapp.com",
  projectId:         "amjaa-travels",
  storageBucket:     "amjaa-travels.firebasestorage.app",
  messagingSenderId: "631210231227",
  appId:             "1:631210231227:web:fd9d830291ec73e27e309e",
};

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
