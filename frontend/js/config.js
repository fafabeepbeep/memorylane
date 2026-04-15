// js/config.js – Frontend configuration
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

const CONFIG = 
{
    // ─── Backend API ─────────────────────────────────────────────
    API_URL: 'http://localhost:3001/api',
    WS_URL:  'ws://localhost:3001/ws',
  
    // ─── Firebase Web SDK (from Firebase Console → Project Settings → Your Apps) ──
    // After creating a Web app in Firebase Console, paste the firebaseConfig object here:
    FIREBASE: {
      apiKey:            "AIzaSyBFITUpbiv7w2eJdEVMU9YNcEfW-rGBrK4",
      authDomain:        "memorylane-gallery.firebaseapp.com",
      projectId:         "memorylane-gallery",
      storageBucket:     "memorylane-gallery.firebasestorage.app",
      messagingSenderId: "756001504180",
      appId:             "1:756001504180:web:3eca5e1c5169140b73d0e1",
    },
  
    // ─── App Settings ────────────────────────────────────────────
    POLL_INTERVAL_MS: 5000,  // fallback polling interval
    MAX_FILE_SIZE_MB: 3,
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  
    // ─── Session keys (localStorage) ────────────────────────────
    KEY_USER_ID:    'ml_user_id',
    KEY_USER_NAME:  'ml_user_name',
    KEY_EVENT_CODE: 'ml_event_code',
    KEY_EVENT_NAME: 'ml_event_name',
    KEY_EVENT_ID:   'ml_event_id',
  
    // ─── Admin secret (DO NOT use in production frontend!) ───────
    // For the prototype only – in production move this to backend auth
    ADMIN_SECRET: 'ayam_g3p0k',
  };

  // Initialize Firebase
const app = initializeApp(firebaseConfig);

  // Freeze config to prevent accidental mutation
  Object.freeze(CONFIG);
  Object.freeze(CONFIG.FIREBASE);