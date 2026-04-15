// js/utils.js – Shared utilities for all pages

// ─── Toast Notifications ─────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
  
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
  
    const icon = { success: '✓', error: '✕', info: '◆' }[type] || '●';
    toast.innerHTML = `<span style="color:var(--gold);font-size:1rem">${icon}</span><span>${message}</span>`;
  
    container.appendChild(toast);
  
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s var(--ease) forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  
  // ─── API Helper ───────────────────────────────────────────────────────────────
  async function apiFetch(path, options = {}) {
    try {
      // Destructure headers out separately so ...rest doesn't overwrite merged headers
      const { headers: extraHeaders, ...rest } = options;
  
      const res = await fetch(`${CONFIG.API_URL}${path}`, {
        ...rest,
        headers: {
          'Content-Type': 'application/json',
          ...extraHeaders,
        },
      });
  
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.error('API error:', err.message);
      return {
        ok: false,
        status: 0,
        data: { message: `Cannot reach server at ${CONFIG.API_URL}. Is the backend running?` },
      };
    }
  }
  
  // ─── Session Management ───────────────────────────────────────────────────────
  const Session = {
    set(key, val) {
      try { localStorage.setItem(key, typeof val === 'object' ? JSON.stringify(val) : val); }
      catch {}
    },
    get(key) {
      try {
        const v = localStorage.getItem(key);
        try { return JSON.parse(v); } catch { return v; }
      } catch { return null; }
    },
    clear() {
      [CONFIG.KEY_USER_ID, CONFIG.KEY_USER_NAME, CONFIG.KEY_EVENT_CODE,
       CONFIG.KEY_EVENT_NAME, CONFIG.KEY_EVENT_ID].forEach(k => localStorage.removeItem(k));
    },
    hasSession() {
      return !!(this.get(CONFIG.KEY_USER_ID) && this.get(CONFIG.KEY_EVENT_CODE));
    },
  };
  
  // ─── Client-side Image Compression ────────────────────────────────────────────
  /**
   * Compress an image file client-side using canvas
   * @param {File} file - Original file
   * @param {number} maxSizeMB - Target max size in MB
   * @param {number} maxWidthPx - Max width in pixels
   * @returns {Promise<Blob>} Compressed blob
   */
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
  
          // Try quality levels until size is acceptable
          const tryQuality = (quality) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) return reject(new Error('Compression failed'));
                const sizeMB = blob.size / (1024 * 1024);
                if (sizeMB > maxSizeMB && quality > 0.4) {
                  tryQuality(quality - 0.1);
                } else {
                  resolve(blob);
                }
              },
              'image/jpeg',
              quality
            );
          };
  
          tryQuality(0.85);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  // ─── Format Helpers ───────────────────────────────────────────────────────────
  function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
  }
  
  function formatDate(date) {
    return new Date(date).toLocaleDateString('en-MY', { day: 'short', month: 'short', year: 'numeric' });
  }
  
  function timeAgo(date) {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return formatDate(date);
  }
  
  // ─── URL Params ───────────────────────────────────────────────────────────────
  function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }
  
  // ─── Lightbox ─────────────────────────────────────────────────────────────────
  function openLightbox(imgUrl, userName, timestamp) {
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
        </div>
        <a id="lb-dl" class="btn btn-outline btn-sm" download>⬇ Download</a>
      `;
      document.body.appendChild(lb);
      lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
      lb.querySelector('#lb-close').addEventListener('click', closeLightbox);
    }
  
    lb.querySelector('#lb-img').src = imgUrl;
    lb.querySelector('#lb-user').textContent = userName || '';
    lb.querySelector('#lb-time').textContent = timestamp ? formatDate(timestamp) + ' · ' + formatTime(timestamp) : '';
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
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });