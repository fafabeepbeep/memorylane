// js/utils.js — Shared utilities (production-ready)
// Includes: toasts, API client (with retries + timeout), session helpers,
// client-side image compression, IG-style time-ago, lightbox, expiration helpers.

// ═══════════════════════════════════════════════════════════════
//  Toast Notifications
// ═══════════════════════════════════════════════════════════════
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = { success: '✓', error: '✕', info: '◆', warn: '!' }[type] || '●';
  toast.innerHTML = `<span style="color:var(--gold);font-size:1rem;font-weight:bold">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s var(--ease) forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ═══════════════════════════════════════════════════════════════
//  API Helper — with timeout + retries on transient failures
// ═══════════════════════════════════════════════════════════════
async function apiFetch(path, options = {}) {
  const { headers: extraHeaders, retries = 1, timeout = CONFIG.REQUEST_TIMEOUT_MS, ...rest } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${CONFIG.API_URL}${path}`, {
        ...rest,
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      let data = null;
      try { data = await res.json(); } catch { data = { message: 'Invalid response from server' }; }

      // Retry on 5xx (transient server errors)
      if (res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      clearTimeout(timeoutId);
      const isLast = attempt === retries;
      const isAbort = err.name === 'AbortError';

      console.error(`[apiFetch] ${path} attempt ${attempt + 1} failed:`, err.message);

      if (isLast) {
        return {
          ok: false,
          status: 0,
          data: {
            message: isAbort
              ? `Request timed out after ${timeout / 1000}s. Check your connection.`
              : `Cannot reach server at ${CONFIG.API_BASE}. Is the backend running?`,
          },
        };
      }
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  Multipart upload with retry (XHR-based to track progress)
// ═══════════════════════════════════════════════════════════════
function uploadFileXHR(path, formData, { onProgress, headers = {}, retries = CONFIG.UPLOAD_RETRIES } = {}) {
  return new Promise(async (resolve) => {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await new Promise((res, rej) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${CONFIG.API_URL}${path}`);
          Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
          xhr.timeout = 60000;

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
          };

          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText);
              res({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
            } catch {
              res({ ok: false, status: xhr.status, data: { message: 'Invalid response' } });
            }
          };
          xhr.onerror = () => rej(new Error('Network error'));
          xhr.ontimeout = () => rej(new Error('Upload timeout'));
          xhr.send(formData);
        });

        // 5xx = retry; everything else = return
        if (!result.ok && result.status >= 500 && attempt < retries) {
          lastError = new Error(`Server ${result.status}`);
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return resolve(result);
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return resolve({
          ok: false, status: 0,
          data: { message: lastError?.message || 'Upload failed after retries' },
        });
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  Session Management
// ═══════════════════════════════════════════════════════════════
const Session = {
  set(k, v) { try { localStorage.setItem(k, typeof v === 'object' ? JSON.stringify(v) : v); } catch {} },
  get(k) {
    try { const v = localStorage.getItem(k); try { return JSON.parse(v); } catch { return v; } }
    catch { return null; }
  },
  clear() {
    [CONFIG.KEY_USER_ID, CONFIG.KEY_USER_NAME, CONFIG.KEY_EVENT_CODE,
     CONFIG.KEY_EVENT_NAME, CONFIG.KEY_EVENT_ID].forEach((k) => localStorage.removeItem(k));
  },
  hasSession() {
    return !!(this.get(CONFIG.KEY_USER_ID) && this.get(CONFIG.KEY_EVENT_CODE));
  },
};

// ═══════════════════════════════════════════════════════════════
//  Client-side Image Compression
// ═══════════════════════════════════════════════════════════════
async function compressImage(file, maxSizeMB = 2, maxWidthPx = 1920) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidthPx) {
          height = Math.round((height * maxWidthPx) / width);
          width = maxWidthPx;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const tryQ = (q) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error('Compression failed'));
              const sizeMB = blob.size / (1024 * 1024);
              if (sizeMB > maxSizeMB && q > 0.4) tryQ(q - 0.1);
              else resolve(blob);
            },
            'image/jpeg',
            q
          );
        };
        tryQ(0.85);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════════════════
//  Time formatting (Instagram Stories style)
// ═══════════════════════════════════════════════════════════════
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 0) return 'just now'; // clock skew safety
  if (seconds < 30) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

function timeUntilExpiry(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(date) {
  return new Date(date).toLocaleDateString(undefined, { day: 'short', month: 'short', year: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════
//  URL Params
// ═══════════════════════════════════════════════════════════════
function getParam(key) { return new URLSearchParams(window.location.search).get(key); }

// ═══════════════════════════════════════════════════════════════
//  Lightbox
// ═══════════════════════════════════════════════════════════════
function openLightbox(imgUrl, userName, timestamp, expiresAt) {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.innerHTML = `
      <button id="lb-close" class="btn btn-ghost btn-icon" style="position:absolute;top:1.5rem;right:1.5rem">✕</button>
      <img id="lb-img" src="" alt="" />
      <div style="text-align:center">
        <div id="lb-user" style="font-family:var(--font-head);font-size:1.1rem;color:var(--gold)"></div>
        <div id="lb-time" class="text-muted text-xs mono"></div>
        <div id="lb-expires" class="text-xs mono" style="color:var(--gold-dim);margin-top:0.25rem"></div>
      </div>
      <a id="lb-dl" class="btn btn-outline btn-sm" download>⬇ Download</a>
    `;
    document.body.appendChild(lb);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
    lb.querySelector('#lb-close').addEventListener('click', closeLightbox);
  }
  lb.querySelector('#lb-img').src = imgUrl;
  lb.querySelector('#lb-user').textContent = userName || '';
  lb.querySelector('#lb-time').textContent = timestamp ? `${timeAgo(timestamp)} · ${formatDate(timestamp)}` : '';
  lb.querySelector('#lb-expires').textContent = expiresAt ? `⏳ ${timeUntilExpiry(expiresAt)}` : '';
  lb.querySelector('#lb-dl').href = imgUrl;
  lb.querySelector('#lb-dl').setAttribute('download', `memorylane-${Date.now()}.jpg`);
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });