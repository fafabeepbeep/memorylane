// js/config.js — Frontend Configuration
// Automatically detects API URL based on where the frontend is loaded from.
//
// HOW IT WORKS:
//   • Loaded on localhost      → API at http://localhost:3001
//   • Loaded on 192.168.x.x    → API at http://192.168.x.x:3001 (same LAN)
//   • Loaded on *.vercel.app   → API at PRODUCTION_API_URL (set below)
//   • Override at runtime      → window.MEMORYLANE_API_URL = "https://..."
//
// When you deploy: edit PRODUCTION_API_URL and PRODUCTION_WS_URL below.

(function () {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  ⬇️  EDIT THESE TWO LINES AFTER DEPLOYING YOUR BACKEND  ⬇️
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const PRODUCTION_API_URL = 'https://memorylane-api.onrender.com';
  const PRODUCTION_WS_URL  = 'wss://memorylane-api.onrender.com';
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const BACKEND_PORT = 3001; // local dev backend port

  function detectApiBase() {
    // 1. Runtime override (set via inline <script> before this loads)
    if (typeof window !== 'undefined' && window.MEMORYLANE_API_URL) {
      return window.MEMORYLANE_API_URL;
    }

    // 2. Manual override stored by user (debug helper)
    try {
      const stored = localStorage.getItem('ml_api_override');
      if (stored) return stored;
    } catch {}

    // 3. Auto-detect from window.location
    if (typeof window === 'undefined') return PRODUCTION_API_URL;
    const { protocol, hostname, port } = window.location;

    // Private/local hosts → assume backend on same host, port 3001
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

    if (isLocal) {
      return `${protocol}//${hostname}:${BACKEND_PORT}`;
    }

    // Tunnel domains used during testing (ngrok/cloudflare/etc.)
    const isTunnel = /\.(ngrok-free\.app|ngrok\.io|trycloudflare\.com|loca\.lt)$/.test(hostname);
    if (isTunnel) {
      // Both frontend and backend will normally use the SAME tunnel URL.
      // If you tunnel them separately, override via window.MEMORYLANE_API_URL.
      return `${protocol}//${hostname}`;
    }

    // 4. Production fallback
    return PRODUCTION_API_URL;
  }

  function detectWsBase() {
    if (typeof window !== 'undefined' && window.MEMORYLANE_WS_URL) return window.MEMORYLANE_WS_URL;
    try {
      const stored = localStorage.getItem('ml_ws_override');
      if (stored) return stored;
    } catch {}

    const apiBase = detectApiBase();
    if (apiBase === PRODUCTION_API_URL) return PRODUCTION_WS_URL;
    // Convert http(s):// → ws(s)://
    return apiBase.replace(/^http/, 'ws');
  }

  const API_BASE = detectApiBase();
  const WS_BASE = detectWsBase();

  window.CONFIG = Object.freeze({
    API_BASE,
    API_URL: API_BASE + '/api',
    WS_URL: WS_BASE + '/ws',

    POLL_INTERVAL_MS: 5000,
    MAX_FILE_SIZE_MB: 3,
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    PHOTO_TTL_HOURS: 24,

    KEY_USER_ID:    'ml_user_id',
    KEY_USER_NAME:  'ml_user_name',
    KEY_EVENT_CODE: 'ml_event_code',
    KEY_EVENT_NAME: 'ml_event_name',
    KEY_EVENT_ID:   'ml_event_id',

    // Retry config for resilient uploads on flaky networks
    UPLOAD_RETRIES: 2,
    REQUEST_TIMEOUT_MS: 30000,
  });

  console.log(`[MemoryLane] API base: ${API_BASE}`);
})();