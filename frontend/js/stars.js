// js/stars.js — Animated star background
// Lightweight canvas particle system, optimized for mobile.
// Auto-pauses when tab is hidden to save battery.

(function () {
    function initStars(opts = {}) {
      if (document.getElementById('star-canvas')) return; // already initialized
  
      const canvas = document.createElement('canvas');
      canvas.id = 'star-canvas';
      canvas.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;background:#0A0A0A;';
      document.body.prepend(canvas);
  
      const ctx = canvas.getContext('2d', { alpha: false });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
  
      let stars = [];
      let shootingStars = [];
      let w = 0, h = 0, isMobile = false;
      let rafId = null;
      let visible = true;
  
      // ── Reduced-motion accessibility ──
      const prefersReduced =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
      function resize() {
        w = window.innerWidth;
        h = window.innerHeight;
        isMobile = w < 768;
  
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  
        // Density scales with screen area, capped on mobile for perf
        const density = isMobile ? 1 / 11000 : 1 / 5500;
        const count = Math.max(40, Math.min(280, Math.floor(w * h * density)));
  
        stars = Array.from({ length: count }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.5 + 0.25,
          vx: (Math.random() - 0.5) * (prefersReduced ? 0 : 0.12),
          vy: (Math.random() - 0.5) * (prefersReduced ? 0 : 0.12),
          twinkle: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.008 + Math.random() * 0.018,
          // 8% are gold, rest white-ish
          color: Math.random() < 0.08 ? [212, 175, 55] : [240, 237, 230],
          baseAlpha: 0.3 + Math.random() * 0.5,
        }));
      }
  
      function spawnShootingStar() {
        if (prefersReduced || isMobile) return; // skip on mobile / reduced motion
        shootingStars.push({
          x: Math.random() * w,
          y: Math.random() * (h * 0.5),
          len: 80 + Math.random() * 60,
          speed: 6 + Math.random() * 6,
          angle: Math.PI / 4 + (Math.random() - 0.5) * 0.4,
          life: 1,
        });
      }
  
      function draw() {
        if (!visible) return;
  
        // Background fill (instead of clearRect, which would show through)
        ctx.fillStyle = '#0A0A0A';
        ctx.fillRect(0, 0, w, h);
  
        // Stars
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          s.x += s.vx;
          s.y += s.vy;
          s.twinkle += s.twinkleSpeed;
  
          // Wrap around edges
          if (s.x < -2) s.x = w + 2;
          if (s.x > w + 2) s.x = -2;
          if (s.y < -2) s.y = h + 2;
          if (s.y > h + 2) s.y = -2;
  
          const alpha = s.baseAlpha + Math.sin(s.twinkle) * 0.25;
          const [r, g, b] = s.color;
  
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${Math.max(0, alpha)})`;
          ctx.fill();
  
          // Brighter stars get a soft glow
          if (s.r > 1.1) {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.08})`;
            ctx.fill();
          }
        }
  
        // Shooting stars
        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const sh = shootingStars[i];
          const dx = Math.cos(sh.angle) * sh.speed;
          const dy = Math.sin(sh.angle) * sh.speed;
          sh.x += dx;
          sh.y += dy;
          sh.life -= 0.018;
  
          const tailX = sh.x - Math.cos(sh.angle) * sh.len;
          const tailY = sh.y - Math.sin(sh.angle) * sh.len;
  
          const grad = ctx.createLinearGradient(sh.x, sh.y, tailX, tailY);
          grad.addColorStop(0, `rgba(212,175,55,${sh.life})`);
          grad.addColorStop(1, 'rgba(212,175,55,0)');
  
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(sh.x, sh.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();
  
          if (sh.life <= 0 || sh.x > w + sh.len || sh.y > h + sh.len) {
            shootingStars.splice(i, 1);
          }
        }
  
        rafId = requestAnimationFrame(draw);
      }
  
      // Trigger an occasional shooting star
      let shootingTimer = setInterval(() => {
        if (Math.random() < 0.6) spawnShootingStar();
      }, 4500);
  
      // Pause when tab hidden
      document.addEventListener('visibilitychange', () => {
        visible = !document.hidden;
        if (visible) {
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(draw);
        }
      });
  
      // Resize handling (debounced)
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
      });
  
      resize();
      draw();
  
      // Expose for cleanup if needed
      window.__memorylaneStars = {
        destroy: () => {
          cancelAnimationFrame(rafId);
          clearInterval(shootingTimer);
          canvas.remove();
          delete window.__memorylaneStars;
        },
      };
    }
  
    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => initStars());
    } else {
      initStars();
    }
  
    window.initStars = initStars;
  })();