// ============================================================
// APP.JS — Atlantas Platform · Shared Core Logic
// ============================================================
'use strict';

// ── FIREBASE INIT ─────────────────────────────────────────────
var _fbApp, _auth, _db;
function initFirebase() {
  if (_fbApp) return;
  _fbApp = firebase.initializeApp(FIREBASE_CONFIG);
  _auth  = firebase.auth();
  _db    = firebase.database();
}

function getAuth() { return _auth; }
function getDB()   { return _db;   }

// ── APP CONFIG (loaded from Firebase, falls back to DEFAULT) ──
var _appConfig = null;
var _configListeners = [];

function getConfig(key) {
  var cfg = _appConfig || DEFAULT_APP_CONFIG;
  return key ? cfg[key] : cfg;
}

function onConfigReady(fn) {
  if (_appConfig) { fn(_appConfig); return; }
  _configListeners.push(fn);
}

function loadAppConfig(cb) {
  _db.ref(DB.appConfig).once('value', function(snap) {
    var remote = snap.val();
    _appConfig = remote
      ? deepMerge(JSON.parse(JSON.stringify(DEFAULT_APP_CONFIG)), remote)
      : JSON.parse(JSON.stringify(DEFAULT_APP_CONFIG));
    _configListeners.forEach(function(fn) { fn(_appConfig); });
    _configListeners = [];
    if (cb) cb(_appConfig);
  });
}

function deepMerge(target, source) {
  Object.keys(source).forEach(function(k) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      target[k] = target[k] || {};
      deepMerge(target[k], source[k]);
    } else {
      target[k] = source[k];
    }
  });
  return target;
}

// ── LANGUAGE ──────────────────────────────────────────────────
var _lang = localStorage.getItem('atl_lang') || 'en';

function getLang() { return _lang; }

function setLang(lang) {
  if (SUPPORTED_LANGS.indexOf(lang) === -1) lang = 'en';
  _lang = lang;
  localStorage.setItem('atl_lang', lang);
  applyLabels();
}

function t(key) {
  var cfg    = _appConfig || DEFAULT_APP_CONFIG;
  var labels = (cfg.labels && cfg.labels[_lang]) || cfg.labels.en || {};
  return labels[key] || DEFAULT_APP_CONFIG.labels.en[key] || key;
}

function applyLabels() {
  document.querySelectorAll('[data-label]').forEach(function(el) {
    el.textContent = t(el.getAttribute('data-label'));
  });
  document.querySelectorAll('[data-placeholder]').forEach(function(el) {
    el.setAttribute('placeholder', t(el.getAttribute('data-placeholder')));
  });
}

// ── THEME ─────────────────────────────────────────────────────
function applyTheme(cfg) {
  cfg = cfg || getConfig();
  var r = document.documentElement.style;
  r.setProperty('--color-primary',  cfg.primaryColor  || '#7c3aed');
  r.setProperty('--color-accent',   cfg.accentColor   || '#a855f7');
  r.setProperty('--color-bg',       cfg.bgColor       || '#ffffff');
  r.setProperty('--color-text',     cfg.textColor     || '#0a0a0a');
  r.setProperty('--color-glow',     cfg.glowColor     || 'rgba(124,58,237,0.35)');
  if (cfg.darkMode) document.body.classList.add('dark');
  else              document.body.classList.remove('dark');
}

// ── BRANDING ──────────────────────────────────────────────────
function applyBranding(cfg) {
  cfg = cfg || getConfig();
  // App name
  document.querySelectorAll('[data-app-name]').forEach(function(el) {
    el.textContent = cfg.appName || 'Atlantas';
  });
  // Subtitle
  document.querySelectorAll('[data-app-subtitle]').forEach(function(el) {
    el.textContent = cfg.appSubtitle || '';
  });
  // Logo
  if (cfg.appLogoUrl) {
    document.querySelectorAll('[data-app-logo]').forEach(function(el) {
      el.src = cfg.appLogoUrl;
      el.style.display = '';
    });
  }
  // Page title
  document.title = cfg.appName || 'Atlantas';
}

// ── CLOUDINARY UPLOAD ─────────────────────────────────────────
function compressImage(file, opts, cb) {
  var o = opts || CLOUDINARY.compression;
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var w = img.width, h = img.height;
      var maxW = o.maxWidthPx  || 1200;
      var maxH = o.maxHeightPx || 1200;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(function(blob) { cb(null, blob); },
        o.mimeType || 'image/jpeg',
        o.quality  || 0.82);
    };
    img.onerror = function() { cb(new Error('Image load failed')); };
    img.src = e.target.result;
  };
  reader.onerror = function() { cb(new Error('File read failed')); };
  reader.readAsDataURL(file);
}

function uploadToCloudinary(file, presetKey, onProgress, cb) {
  var preset = CLOUDINARY.presets[presetKey] || CLOUDINARY.presets.media;
  compressImage(file, CLOUDINARY.compression, function(err, blob) {
    if (err) { cb(err); return; }
    var fd  = new FormData();
    fd.append('file',            blob, 'upload.jpg');
    fd.append('upload_preset',   preset);
    fd.append('folder',          'atlantas/' + presetKey);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', CLOUDINARY.baseUrl, true);
    xhr.upload.onprogress = function(e) {
      if (onProgress && e.lengthComputable)
        onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = function() {
      if (xhr.status === 200) {
        var res = JSON.parse(xhr.responseText);
        cb(null, res.secure_url);
      } else {
        cb(new Error('Upload failed: ' + xhr.status));
      }
    };
    xhr.onerror = function() { cb(new Error('Network error during upload')); };
    xhr.send(fd);
  });
}

// ── EMAILJS ───────────────────────────────────────────────────
var _ejIdx = 0;
function sendEmail(params, cb) {
  var acc = EMAILJS_ACCOUNTS[_ejIdx % EMAILJS_ACCOUNTS.length];
  _ejIdx++;
  emailjs.init({ publicKey: acc.publicKey });
  emailjs.send(acc.serviceId, acc.templateId, params)
    .then(function()    { if (cb) cb(null); })
    .catch(function(e)  { if (cb) cb(e);    });
}

// ── TOAST NOTIFICATIONS ───────────────────────────────────────
function showToast(msg, type, duration) {
  type = type || 'info'; // info | success | error | warning
  duration = duration || 3200;
  var t = document.createElement('div');
  t.className = 'atl-toast atl-toast--' + type;
  t.textContent = msg;
  var container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  container.appendChild(t);
  requestAnimationFrame(function() {
    requestAnimationFrame(function() { t.classList.add('atl-toast--show'); });
  });
  setTimeout(function() {
    t.classList.remove('atl-toast--show');
    setTimeout(function() { t.remove(); }, 400);
  }, duration);
}

// ── MODAL HELPERS ─────────────────────────────────────────────
function openModal(id) {
  var m = document.getElementById(id);
  if (!m) return;
  m.classList.add('show');
  document.body.style.overflow = 'hidden';
  // Animate in
  var box = m.querySelector('.modal-box');
  if (box) { box.style.transform = 'translateY(40px)'; box.style.opacity = '0';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        box.style.transition = 'transform 0.32s cubic-bezier(.22,.68,0,1.2), opacity 0.28s';
        box.style.transform  = 'translateY(0)';
        box.style.opacity    = '1';
      });
    });
  }
}

function closeModal(id) {
  var m = document.getElementById(id);
  if (!m) return;
  var box = m.querySelector('.modal-box');
  if (box) {
    box.style.transform = 'translateY(40px)';
    box.style.opacity   = '0';
    setTimeout(function() {
      m.classList.remove('show');
      document.body.style.overflow = '';
      box.style.transform = ''; box.style.opacity = ''; box.style.transition = '';
    }, 300);
  } else {
    m.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// ── SCREEN TRANSITIONS ────────────────────────────────────────
function showScreen(id) {
  var screens = document.querySelectorAll('.atl-screen');
  screens.forEach(function(s) {
    if (s.id === id) {
      s.style.display = '';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { s.classList.add('atl-screen--visible'); });
      });
    } else {
      s.classList.remove('atl-screen--visible');
      setTimeout(function() {
        if (!s.classList.contains('atl-screen--visible')) s.style.display = 'none';
      }, 320);
    }
  });
}

// ── PAGE TRANSITION (tab switch) ──────────────────────────────
function switchTab(tabId, navBtns, pages) {
  pages.forEach(function(p) {
    var el = document.getElementById(p);
    if (!el) return;
    if (p === tabId) {
      el.style.display = '';
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          el.style.transition = 'opacity 0.28s, transform 0.28s cubic-bezier(.22,.68,0,1.2)';
          el.style.opacity    = '1';
          el.style.transform  = 'translateY(0)';
        });
      });
    } else {
      el.style.opacity   = '0';
      el.style.transform = 'translateY(18px)';
      setTimeout(function() {
        if (el.style.opacity === '0') el.style.display = 'none';
      }, 280);
    }
  });
  if (navBtns) {
    navBtns.forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
  }
}

// ── PWA INSTALL PROMPT ────────────────────────────────────────
var _deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  _deferredInstallPrompt = e;
  var cfg = getConfig();
  if (cfg.pwaPrompt) {
    setTimeout(showInstallBanner, cfg.pwaPromptDelay || 30000);
  }
});

function showInstallBanner() {
  if (!_deferredInstallPrompt) return;
  if (localStorage.getItem('atl_pwa_dismissed')) return;
  var banner = document.getElementById('pwa-banner');
  if (banner) {
    banner.classList.add('show');
  } else {
    // Create banner dynamically
    var b = document.createElement('div');
    b.id = 'pwa-banner';
    b.className = 'pwa-banner show';
    b.innerHTML =
      '<div class="pwa-banner__icon" data-app-logo-small></div>' +
      '<div class="pwa-banner__text">' +
        '<strong data-app-name>Atlantas</strong>' +
        '<span>Add to your home screen for the best experience</span>' +
      '</div>' +
      '<button class="pwa-banner__btn" id="pwa-install-btn">Install</button>' +
      '<button class="pwa-banner__close" id="pwa-dismiss-btn">✕</button>';
    document.body.appendChild(b);
    document.getElementById('pwa-install-btn').addEventListener('click', installPWA);
    document.getElementById('pwa-dismiss-btn').addEventListener('click', dismissPWA);
  }
}

function installPWA() {
  if (!_deferredInstallPrompt) return;
  _deferredInstallPrompt.prompt();
  _deferredInstallPrompt.userChoice.then(function(r) {
    if (r.outcome === 'accepted') dismissPWA();
    _deferredInstallPrompt = null;
  });
}

function dismissPWA() {
  localStorage.setItem('atl_pwa_dismissed', '1');
  var b = document.getElementById('pwa-banner');
  if (b) { b.classList.remove('show'); }
}

// ── FORMAT HELPERS ────────────────────────────────────────────
function fmtCurrency(amount, currency) {
  var sym = CURRENCY_SYMBOLS[currency] || '$';
  return sym + parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  return d.toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' });
}

function fmtTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
}

function fmtDateTime(ts) {
  return fmtDate(ts) + ' · ' + fmtTime(ts);
}

function generateId(prefix) {
  return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
}

function maskNumber(num, show) {
  if (!num) return '•••• •••• •••• ••••';
  var s = num.replace(/\s/g, '');
  show = show || 4;
  var masked = s.slice(0, -show).replace(/\d/g, '•') + s.slice(-show);
  return masked.replace(/(.{4})/g, '$1 ').trim();
}

// ── PARTICLE GLOW EFFECT ──────────────────────────────────────
function initParticles(canvasId, color) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx    = canvas.getContext('2d');
  var W = canvas.width  = canvas.offsetWidth;
  var H = canvas.height = canvas.offsetHeight;
  color = color || getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary').trim() || '#7c3aed';

  var particles = Array.from({ length: 38 }, function() {
    return {
      x:  Math.random() * W, y:  Math.random() * H,
      r:  Math.random() * 2.5 + 0.8,
      dx: (Math.random() - 0.5) * 0.45,
      dy: (Math.random() - 0.5) * 0.45,
      o:  Math.random() * 0.5 + 0.15
    };
  });

  function hex2rgb(hex) {
    var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? parseInt(r[1],16)+','+parseInt(r[2],16)+','+parseInt(r[3],16) : '124,58,237';
  }
  var rgb = hex2rgb(color);

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(function(p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + rgb + ',' + p.o + ')';
      ctx.shadowColor = 'rgba(' + rgb + ',0.8)';
      ctx.shadowBlur  = 8;
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0 || p.x > W) p.dx *= -1;
      if (p.y < 0 || p.y > H) p.dy *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();
  window.addEventListener('resize', function() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  });
}

// ── SHARED CSS INJECTION ──────────────────────────────────────
// Injects shared CSS variables and component styles used by all pages
function injectSharedStyles() {
  if (document.getElementById('atl-shared-styles')) return;
  var style = document.createElement('style');
  style.id = 'atl-shared-styles';
  style.textContent = [
    ':root{',
    '  --color-primary:#7c3aed;',
    '  --color-accent:#a855f7;',
    '  --color-bg:#ffffff;',
    '  --color-text:#0a0a0a;',
    '  --color-glow:rgba(124,58,237,0.35);',
    '  --font-main:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    '  --radius-sm:8px;',
    '  --radius-md:14px;',
    '  --radius-lg:20px;',
    '  --shadow-sm:0 1px 4px rgba(0,0,0,0.08);',
    '  --shadow-md:0 4px 20px rgba(0,0,0,0.12);',
    '  --shadow-glow:0 0 24px var(--color-glow);',
    '  --transition:all 0.28s cubic-bezier(.22,.68,0,1.2);',
    '}',

    // Toast
    '#toast-container{position:fixed;top:20px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;}',
    '.atl-toast{background:#1a1a2e;color:#fff;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:500;',
    '  box-shadow:0 4px 20px rgba(0,0,0,0.22);opacity:0;transform:translateX(20px);transition:opacity 0.3s,transform 0.3s;pointer-events:auto;max-width:300px;}',
    '.atl-toast--show{opacity:1;transform:translateX(0);}',
    '.atl-toast--success{border-left:3px solid #4ade80;}',
    '.atl-toast--error{border-left:3px solid #f87171;}',
    '.atl-toast--warning{border-left:3px solid #fbbf24;}',
    '.atl-toast--info{border-left:3px solid var(--color-primary);}',

    // Screen transitions
    '.atl-screen{display:none;opacity:0;transform:translateY(16px);transition:opacity 0.3s,transform 0.32s cubic-bezier(.22,.68,0,1.2);}',
    '.atl-screen--visible{opacity:1;transform:translateY(0);}',

    // PWA Banner
    '.pwa-banner{position:fixed;bottom:-100px;left:50%;transform:translateX(-50%);',
    '  background:#1a1a2e;border:1px solid rgba(124,58,237,0.3);border-radius:18px;',
    '  padding:14px 16px;display:flex;align-items:center;gap:12px;',
    '  width:calc(100% - 32px);max-width:420px;z-index:9990;',
    '  box-shadow:0 8px 32px rgba(124,58,237,0.25);transition:bottom 0.4s cubic-bezier(.22,.68,0,1.2);}',
    '.pwa-banner.show{bottom:24px;}',
    '.pwa-banner__text{flex:1;display:flex;flex-direction:column;gap:2px;}',
    '.pwa-banner__text strong{font-size:14px;color:#fff;font-weight:700;}',
    '.pwa-banner__text span{font-size:12px;color:rgba(255,255,255,0.55);}',
    '.pwa-banner__btn{background:var(--color-primary);color:#fff;border:none;border-radius:10px;',
    '  padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;}',
    '.pwa-banner__close{background:none;border:none;color:rgba(255,255,255,0.4);font-size:18px;cursor:pointer;padding:4px;}',

    // Glow pulse animation
    '@keyframes glow-pulse{0%,100%{box-shadow:0 0 18px var(--color-glow);}50%{box-shadow:0 0 38px var(--color-glow),0 0 60px var(--color-glow);}}',
    '.glow-pulse{animation:glow-pulse 2.4s ease-in-out infinite;}',
    '@keyframes fade-up{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}',
    '.fade-up{animation:fade-up 0.5s cubic-bezier(.22,.68,0,1.2) both;}',
    '.fade-up--d1{animation-delay:0.08s}.fade-up--d2{animation-delay:0.16s}.fade-up--d3{animation-delay:0.24s}.fade-up--d4{animation-delay:0.32s}.fade-up--d5{animation-delay:0.40s}',

    // Modal base
    '.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;',
    '  align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);}',
    '.modal.show{display:flex;}',
    '.modal-box{background:var(--color-bg);border-radius:24px 24px 0 0;width:100%;max-width:480px;',
    '  padding:24px 20px 40px;max-height:90vh;overflow-y:auto;}',
    '.modal-box.center{border-radius:20px;margin:auto;max-height:85vh;}',
    '.modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;}',
    '.modal-header h3{font-size:18px;font-weight:700;color:var(--color-text);}',
    '.modal-close{background:none;border:none;font-size:24px;color:#999;cursor:pointer;',
    '  width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;}',
    '.modal-input{display:block;width:100%;background:#f4f6f9;border:1.5px solid #e2e8f0;border-radius:10px;',
    '  padding:13px 14px;font-size:15px;color:#111;margin-bottom:10px;font-family:inherit;outline:none;}',
    '.modal-input:focus{border-color:var(--color-primary);}',
    '.modal-btn{display:block;width:100%;background:var(--color-primary);color:#fff;border:none;',
    '  border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;',
    '  font-family:inherit;transition:opacity 0.2s;}',
    '.modal-btn:active{opacity:0.88;}',
    '.modal-error{color:#e53935;font-size:13px;margin:4px 0 8px;min-height:16px;}'
  ].join('');
  document.head.appendChild(style);
}

// ── BOOT ──────────────────────────────────────────────────────
function atlBoot(onReady) {
  injectSharedStyles();
  initFirebase();
  loadAppConfig(function(cfg) {
    applyTheme(cfg);
    applyBranding(cfg);
    applyLabels();
    if (onReady) onReady(cfg);
  });
}
