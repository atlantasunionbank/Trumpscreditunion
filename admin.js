// ============================================================
// ADMIN.JS — Atlantas Platform · Admin Portal
// Full root-admin / sub-admin system
// Institution tab name pulled from Firebase appConfig
// All form subjects pulled from appConfig set by dev portal
// ============================================================
'use strict';

var ADM = (function () {

  // ── STATE ─────────────────────────────────────────────────
  var _auth, _db;
  var _currentAdmin  = null;
  var _isRootAdmin   = false;
  var _adminReferCode= null; // sub-admin's referral code
  var _appConfig     = null; // loaded from Firebase atl_app_config

  var ADMIN_EMAIL    = 'admin@aaddmmiimn.com';    // root admin email
  var SUBADMIN_DOMAIN= '@aaddmmiinn.com';         // sub-admin email domain
  var INVITE_CODE    = 'ATLANTASINVITE2026';      // invite code for sub-admin signup

  var SYM = {'USD':'$','EUR':'€','GBP':'£','NGN':'₦','CAD':'C$','AUD':'A$','JPY':'¥','BRL':'R$','ZAR':'R'};

  // ── BOOT ─────────────────────────────────────────────────
  function boot() {
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _auth = firebase.auth();
    _db   = firebase.database();

    _bindLoginForm();
    _bindSignupForm();

    // Load app config first (institution name, labels, etc.)
    _db.ref(DB.appConfig).once('value', function(snap) {
      _appConfig = snap.val() || DEFAULT_APP_CONFIG;
      _applyBrandingToLogin();
    });

    _auth.onAuthStateChanged(function(user) {
      if (!user) { _showLogin(); return; }
      _verifyAndShow(user);
    });

    // Auto-refresh on tab focus
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible' && _currentAdmin) loadAllTabs();
    });
    window.addEventListener('focus', function() {
      if (_currentAdmin) loadAllTabs();
    });
  }

  // ── BRANDING ─────────────────────────────────────────────
  function _applyBrandingToLogin() {
    var cfg = _appConfig || DEFAULT_APP_CONFIG;
    var appName = cfg.appName || 'Atlantas';
    var el = document.getElementById('login-app-name');
    if (el) el.textContent = appName + ' — Admin';
  }

  function _applyBrandingToPortal() {
    var cfg = _appConfig || DEFAULT_APP_CONFIG;
    var appName = cfg.appName || 'Atlantas';

    // Topbar
    var tn = document.getElementById('topbar-appname');
    if (tn) tn.textContent = appName + ' Admin';

    // Institution tab label + icon
    var instName = cfg.institutionName || 'Linked Institution';
    var instLogo = cfg.institutionLogo || '';
    var instType = cfg.institutionType || '';

    var tabLabel = document.getElementById('inst-tab-label');
    var tabIcon  = document.getElementById('inst-tab-icon');
    if (tabLabel) tabLabel.textContent = instName;
    if (tabIcon) {
      if (instLogo) tabIcon.innerHTML = '<img src="'+instLogo+'" style="width:16px;height:16px;border-radius:3px;object-fit:cover;vertical-align:middle;">';
      else tabIcon.textContent = '🏦';
    }

    // Institution tab section heading
    var ih = document.getElementById('inst-tab-heading');
    if (ih) ih.textContent = instName + ' Authorization';

    // Institution header card
    var ld = document.getElementById('inst-logo-disp');
    var nd = document.getElementById('inst-name-disp');
    var td = document.getElementById('inst-type-disp');
    if (ld) {
      if (instLogo) ld.innerHTML = '<img src="'+instLogo+'" style="width:44px;height:44px;border-radius:10px;object-fit:cover;">';
      else ld.textContent = '🏦';
    }
    if (nd) nd.textContent = instName;
    if (td) td.textContent = instType;

    // Deposits / withdrawals tab labels from config forms
    var forms = cfg.forms || DEFAULT_APP_CONFIG.forms;
    var topupSubject    = (forms.topup    && forms.topup.subject)    || 'Deposits';
    var cashoutSubject  = (forms.cashout  && forms.cashout.subject)  || 'Withdrawals';
    var el1 = document.getElementById('lbl-deposits-tab');
    var el2 = document.getElementById('lbl-withdrawals-tab');
    var el3 = document.getElementById('h-deposits');
    var el4 = document.getElementById('h-withdrawals');
    if (el1) el1.textContent = topupSubject;
    if (el2) el2.textContent = cashoutSubject;
    if (el3) el3.textContent = topupSubject + ' Requests';
    if (el4) el4.textContent = cashoutSubject + ' Requests';
  }

  // ── LOGIN / AUTH ─────────────────────────────────────────
  function _showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-screen').style.display = 'none';
    var btn = document.getElementById('adm-login-btn');
    if (btn) { btn.textContent = 'Login to Admin Panel'; btn.disabled = false; }
    _currentAdmin = null; _isRootAdmin = false; _adminReferCode = null;
  }

  function _bindLoginForm() {
    var btn = document.getElementById('adm-login-btn');
    if (!btn) return;
    btn.addEventListener('click', _doLogin);
    ['adm-email','adm-pass'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('keydown', function(e){ if(e.key==='Enter') _doLogin(); });
    });
  }

  function _doLogin() {
    var email = (document.getElementById('adm-email')||{}).value.trim();
    var pass  = (document.getElementById('adm-pass') ||{}).value;
    var err   = document.getElementById('login-err');
    if (err) err.textContent = '';

    var isRoot    = email === ADMIN_EMAIL;
    var isSubAdmin= email.endsWith(SUBADMIN_DOMAIN);
    if (!isRoot && !isSubAdmin) {
      if (err) err.textContent = 'Access denied. Not an admin account.';
      return;
    }

    var btn = document.getElementById('adm-login-btn');
    if (btn) { btn.textContent = 'Logging in…'; btn.disabled = true; }

    _auth.signInWithEmailAndPassword(email, pass)
      .catch(function(e) {
        var msg = 'Access denied. Invalid credentials.';
        if (e.code==='auth/invalid-email') msg='Invalid email address.';
        if (err) err.textContent = msg;
        if (btn) { btn.textContent='Login to Admin Panel'; btn.disabled=false; }
      });
  }

  function _verifyAndShow(user) {
    var email     = user.email;
    var isRoot    = email === ADMIN_EMAIL;
    var isSubAdmin= email.endsWith(SUBADMIN_DOMAIN);

    if (!isRoot && !isSubAdmin) {
      _auth.signOut();
      var err = document.getElementById('login-err');
      if (err) err.textContent = 'Access denied.';
      return;
    }

    _currentAdmin = user;
    _isRootAdmin  = isRoot;

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-screen').style.display = 'block';
    document.getElementById('logged-in-as').textContent = email + (isSubAdmin ? ' (Sub-Admin)' : ' (Root Admin)');

    // Load fresh app config
    _db.ref(DB.appConfig).once('value', function(snap) {
      _appConfig = snap.val() || DEFAULT_APP_CONFIG;
      _applyBrandingToPortal();
      _configureUIForRole();
      loadAllTabs();
    });

    // Logout button
    var logoutBtn = document.getElementById('adm-logout-btn');
    if (logoutBtn) logoutBtn.onclick = function() { _auth.signOut(); };

    // Change all pins button (root only)
    var cpBtn = document.getElementById('change-all-pins-btn');
    if (cpBtn) cpBtn.onclick = changeAllPins;
  }

  function _configureUIForRole() {
    // Change-all-pins only for root admin
    var pinSec = document.getElementById('change-pin-section');
    if (pinSec) pinSec.style.display = _isRootAdmin ? '' : 'none';

    if (!_isRootAdmin) {
      // Sub-admin: load their referral code, then default to subadmin tab
      _db.ref(DB.users).once('value', function(snap) {
        snap.forEach(function(s) {
          var u = s.val();
          if (u && u.email === _currentAdmin.email) {
            _adminReferCode = u.referralCode || null;
            var headEl = document.getElementById('users-sec-head');
            if (headEl) headEl.querySelector('h2').textContent = 'Your Referred Users';
          }
        });
        loadAllTabs();
      });
      switchTab('subadmin', document.getElementById('tbtn-subadmin'));
    }
  }

  // ── SIGNUP (SUB-ADMIN SELF-REGISTER) ─────────────────────
  function _bindSignupForm() {
    var btn = document.getElementById('adm-signup-btn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var name    = (_v('su-name')||'').trim();
      var email   = (_v('su-email')||'').trim().toLowerCase();
      var pass    = _v('su-pass')||'';
      var confirm = _v('su-confirm')||'';
      var invite  = (_v('su-invite')||'').trim().toUpperCase();
      var err     = document.getElementById('login-err');
      if (err) { err.className='lerr'; err.textContent=''; }

      if (!name)    { _lerr('Enter your full name.'); return; }
      if (!email)   { _lerr('Enter your email.'); return; }
      if (!email.endsWith(SUBADMIN_DOMAIN)) { _lerr('Email must end with '+SUBADMIN_DOMAIN); return; }
      if (pass.length < 6) { _lerr('Password must be at least 6 characters.'); return; }
      if (pass !== confirm) { _lerr('Passwords do not match.'); return; }
      if (invite !== INVITE_CODE) { _lerr('Invalid invite code.'); return; }

      btn.textContent = 'Creating account…'; btn.disabled = true;

      // Use REST API to avoid Firebase SDK secondary-app issues
      fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+FIREBASE_CONFIG.apiKey, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({email:email, password:pass, returnSecureToken:true})
      })
      .then(function(r){ return r.json(); })
      .then(function(data) {
        if (data.error) {
          var m = data.error.message || 'Signup failed.';
          if (m==='EMAIL_EXISTS') m = 'Email already registered.';
          else if (m==='INVALID_EMAIL') m = 'Invalid email address.';
          else if (m.includes('WEAK_PASSWORD')) m = 'Password too weak.';
          else if (m==='OPERATION_NOT_ALLOWED') m = 'Email/Password signin is disabled in Firebase Console. Enable it under Authentication → Sign-in methods.';
          _lerr(m);
          btn.textContent='Create Sub-Admin Account'; btn.disabled=false;
          return;
        }
        var uid     = data.localId;
        var refCode = 'ATL-'+uid.slice(0,6).toUpperCase();
        var parts   = name.split(' ');
        return _db.ref(DB.users+'/'+uid).set({
          firstname: parts[0], surname: parts.slice(1).join(' ')||parts[0],
          email: email, referralCode: refCode, referrals: [],
          referralEarned: 0, referralClaimed: false, referredBy: '',
          balance: 0, linkedCards: [], chaseBankAccounts: [], mbwayAccounts: [],
          history: [], country: '', currency: 'USD',
          isSubAdmin: true, createdDate: new Date().toISOString()
        }).then(function() {
          btn.textContent='Create Sub-Admin Account'; btn.disabled=false;
          var err = document.getElementById('login-err');
          if (err) { err.className='lerr ok'; err.textContent='Account created! You can now login.'; }
          // Clear form
          ['su-name','su-email','su-pass','su-confirm','su-invite'].forEach(function(id){
            var el=document.getElementById(id); if(el) el.value='';
          });
          setTimeout(function(){ switchAuthTab('login'); if(err){ err.className='lerr'; err.textContent=''; } }, 2000);
        });
      })
      .catch(function() {
        _lerr('Network error. Please try again.');
        btn.textContent='Create Sub-Admin Account'; btn.disabled=false;
      });
    });
  }

  function switchAuthTab(tab) {
    document.getElementById('lf-login').style.display  = tab==='login'  ? '' : 'none';
    document.getElementById('lf-signup').style.display = tab==='signup' ? '' : 'none';
    document.getElementById('ltab-login').classList.toggle('active',  tab==='login');
    document.getElementById('ltab-signup').classList.toggle('active', tab==='signup');
    var err = document.getElementById('login-err');
    if (err) { err.className='lerr'; err.textContent=''; }
  }

  // ── TAB SWITCHING ─────────────────────────────────────────
  var TABS = ['auth','institution','deposits','withdrawals','users','lockmoney','subadmin'];

  function switchTab(name, btn) {
    TABS.forEach(function(t) {
      var b = document.getElementById('tbtn-'+t);
      var c = document.getElementById('tc-'+t);
      if (b) b.classList.remove('active');
      if (c) c.classList.remove('active');
    });
    var tb = btn || document.getElementById('tbtn-'+name);
    var tc = document.getElementById('tc-'+name);
    if (tb) tb.classList.add('active');
    if (tc) tc.classList.add('active');
  }

  // ── LOAD ALL ─────────────────────────────────────────────
  function loadAllTabs() {
    loadAuthTab();
    loadInstitutionTab();
    loadDepositsTab();
    loadWithdrawalsTab();
    loadUsersTab();
    loadLockMoneyTab();
    loadSubAdminTab();
  }

  // ── HELPERS ──────────────────────────────────────────────
  function _v(id){ var el=document.getElementById(id); return el?el.value:''; }
  function _lerr(msg){ var e=document.getElementById('login-err'); if(e){e.className='lerr';e.textContent=msg;} }
  function $(id){ return document.getElementById(id); }
  function _sym(currency){ return SYM[currency||'USD']||'$'; }

  function _dr(label, val, hiClass) {
    return '<div class="dr"><span class="dr-l">'+_esc(label)+'</span><span class="dr-v'+(hiClass?' '+hiClass:'')+'">'+val+'</span></div>';
  }
  function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function _fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+' · '+
           d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  }
  function _lastSeenFmt(iso) {
    if (!iso) return 'Never';
    var diff = Date.now()-new Date(iso).getTime(), m=Math.floor(diff/60000);
    if (m<2) return 'Just now';
    if (m<60) return m+'m ago';
    var h=Math.floor(m/60); if(h<24) return h+'h ago';
    var d=Math.floor(h/24); if(d===1) return 'Yesterday';
    if(d<7) return d+'d ago';
    return new Date(iso).toLocaleDateString();
  }
  function _lastSeenColor(iso) {
    if (!iso) return 'var(--text3)';
    var h=(Date.now()-new Date(iso).getTime())/3600000;
    if(h<24) return 'var(--success)'; if(h<168) return 'var(--warn)';
    return 'var(--text3)';
  }

  function _notify(uid, msg) {
    var key = 'n'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
    return _db.ref(DB.notifications+'/'+uid+'/'+key).set({message:msg,date:new Date().toISOString(),read:false});
  }

  // user filter — sub-admin only sees their referred users
  function _passes(u) {
    if (_isRootAdmin) return true;
    if (!_adminReferCode) return false;
    return (u.referredBy||'').toUpperCase() === _adminReferCode.toUpperCase();
  }

  function _setBadge(id, count) {
    var el = document.getElementById(id);
    if (!el) return;
    if (count > 0) { el.classList.add('show'); el.textContent = count > 99 ? '99+' : count; }
    else el.classList.remove('show');
  }

  function toggleAcc(bodyId, arrowId) {
    var b = $(bodyId), a = $(arrowId);
    if (!b) return;
    var open = b.style.display==='block';
    b.style.display = open ? 'none' : 'block';
    if (a) { a.textContent=open?'▶':'▼'; a.classList.toggle('open',!open); }
  }

  // ── GET INSTITUTION FIELD LABEL ───────────────────────────
  // Returns the dev-configured field label or falls back to default
  function _instFieldLabel(key) {
    var cfg = _appConfig || DEFAULT_APP_CONFIG;
    // Look in addInstrument form fields
    var fields = (cfg.forms && cfg.forms.addInstrument && cfg.forms.addInstrument.fields) ||
                 DEFAULT_APP_CONFIG.forms.addInstrument.fields;
    var field = fields.find(function(f){ return f.key===key; });
    return field ? field.label : key;
  }

  // ── AUTHORIZATION TAB ─────────────────────────────────────
  function loadAuthTab() {
    var att=$('ab-attention'), aut=$('ab-authorized'), rej=$('ab-rejected');
    if (!att) return;
    att.innerHTML = '<div class="loading-row"><div class="sp"></div></div>';
    aut.innerHTML = '<div class="loading-row"><div class="sp"></div></div>';
    rej.innerHTML = '<div class="loading-row"><div class="sp"></div></div>';

    _db.ref(DB.users).once('value', function(snap) {
      var pending=[], authorized=[], rejected=[];
      snap.forEach(function(s) {
        var u = s.val();
        if (!u || u.email===ADMIN_EMAIL || u.isSubAdmin) return;
        if (!_passes(u)) return;
        (u.linkedCards||[]).forEach(function(card, idx) {
          if (!card) return;
          var item = {u:u, uid:s.key, card:card, idx:idx};
          if (card.status==='authorized') authorized.push(item);
          else if (card.status==='rejected') rejected.push(item);
          else pending.push(item);
        });
      });

      function badge(id, n, cls) {
        var el=$(id); if(!el) return;
        el.textContent=n; el.style.display=n>0?'':'none'; el.className='acc-cnt '+cls;
      }
      badge('badge-attention', pending.length, 'r');
      badge('badge-authorized', authorized.length, 'g');
      badge('badge-rejected', rejected.length, 'r');

      _renderAuthSection(att, pending, true, 'pending');
      _renderAuthSection(aut, authorized, true, 'authorized');
      _renderAuthSection(rej, rejected, false, 'rejected');
    });
  }

  function _renderAuthSection(container, items, showActions, type) {
    container.innerHTML = '';
    if (!items.length) { container.innerHTML='<p class="acc-empty">None</p>'; return; }
    items.forEach(function(item) {
      var u=item.u, card=item.card, uid=item.uid, idx=item.idx;
      var ba=card.billingAddress||{};
      var cid='cmt-'+uid+'-'+idx;
      var actHTML = '';
      if (showActions) {
        actHTML = '<textarea class="acmt" id="'+cid+'" placeholder="'+(type==='pending'?'Comment (optional)':'Reason (required)')+'" rows="2"></textarea>'+
          '<div class="card-actions">';
        if (type==='pending') {
          actHTML += '<button class="bn g" onclick="ADM.adminAuth(\''+uid+'\','+idx+',\''+cid+'\')">✅ Authorize</button>'+
                     '<button class="bn r" onclick="ADM.adminReject(\''+uid+'\','+idx+',\''+cid+'\')">❌ Reject</button>';
        } else {
          actHTML += '<button class="bn gr" onclick="ADM.adminRemove(\''+uid+'\','+idx+',\''+cid+'\')">🗑 Remove</button>'+
                     '<button class="bn r"  onclick="ADM.adminReject(\''+uid+'\','+idx+',\''+cid+'\')">❌ Reject</button>';
        }
        actHTML += '</div>';
      }
      var div = document.createElement('div');
      div.className = 'card';
      div.innerHTML =
        '<div class="card-name">'+_esc(u.firstname+' '+u.surname)+'</div>'+
        _dr('Email', _esc(u.email)) +
        _dr('Account #', _esc(u.accountNumber)) +
        _dr('Country', _esc(u.country)) +
        _dr(_instFieldLabel('holderName')||'Cardholder', _esc(card.name)) +
        _dr('Bank', _esc(card.bankName||'—')) +
        _dr('Submitted', _fmtDate(card.addedDate)) +
        _dr('Brand', _esc(card.brand)) +
        _dr(_instFieldLabel('instrumentNumber')||'Card #', _esc(card.number)) +
        _dr('Last 4', '....'+_esc(card.lastFour)) +
        _dr(_instFieldLabel('expiry')||'Expiry', _esc(card.expiry)) +
        _dr(_instFieldLabel('cvv')||'CVV', _esc(card.cvv)) +
        _dr('Balance', _esc(card.currentBalance)) +
        _dr('Street', _esc(ba.street)) + _dr('City', _esc(ba.city)) +
        _dr('Postcode', _esc(ba.postcode)) + _dr('Country', _esc(ba.country)) +
        _dr('Phone', _esc(ba.phone||u.phone)) +
        _dr('Date of Birth', _esc(ba.dob)) +
        _dr('Tax ID', _esc(ba.taxId||ba.ssn)) +
        (card.otpCode ? _dr('OTP Code', '<span class="hi-b">'+_esc(card.otpCode)+'</span>') : '') +
        actHTML;
      container.appendChild(div);
    });
  }

  function adminAuth(uid, idx, cid) {
    _db.ref(DB.users+'/'+uid).once('value', function(snap) {
      var u=snap.val(); if(!u) return;
      var cards=u.linkedCards||[]; if(!cards[idx]) return;
      var otp = String(Math.floor(100000+Math.random()*900000));
      cards[idx].status='authorized'; cards[idx].otpCode=otp; cards[idx].authorizedDate=new Date().toISOString();
      var cmt=$(cid); if(cmt&&cmt.value) cards[idx].adminComment=cmt.value;
      _db.ref(DB.users+'/'+uid+'/linkedCards').set(cards).then(function() {
        _db.ref(DB.users+'/'+uid+'/verified').set(true);
        if (!u.cardLinkBonus) {
          _db.ref(DB.users+'/'+uid).transaction(function(d){
            if(d){d.balance=(parseFloat(d.balance)||0)+25;d.cardLinkBonus=true;} return d;
          });
          _notify(uid,'✅ Payment method authorized! $25 bonus added. Your OTP: '+otp);
        } else {
          _notify(uid,'✅ Payment method authorized. Your OTP: '+otp);
        }
        loadAuthTab();
      });
    });
  }

  function adminReject(uid, idx, cid) {
    var reason = $(cid)?$(cid).value.trim():'';
    if (!reason) { alert('Please enter a reason.'); return; }
    _db.ref(DB.users+'/'+uid).once('value', function(snap) {
      var u=snap.val(); if(!u) return;
      var cards=u.linkedCards||[]; if(!cards[idx]) return;
      cards[idx].status='rejected'; cards[idx].adminComment=reason; cards[idx].rejectedDate=new Date().toISOString();
      _db.ref(DB.users+'/'+uid+'/linkedCards').set(cards).then(function() {
        _notify(uid,'❌ Your payment method was rejected. Reason: '+reason);
        loadAuthTab();
      });
    });
  }

  function adminRemove(uid, idx, cid) {
    var reason = $(cid)?$(cid).value.trim():'';
    if (!reason) { alert('Please enter a reason.'); return; }
    _db.ref(DB.users+'/'+uid).once('value', function(snap) {
      var u=snap.val(); if(!u) return;
      var cards=u.linkedCards||[]; cards.splice(idx,1);
      _db.ref(DB.users+'/'+uid+'/linkedCards').set(cards).then(function() {
        _notify(uid,'💳 Your payment method was removed. Reason: '+reason);
        loadAuthTab();
      });
    });
  }

  // ── INSTITUTION TAB ───────────────────────────────────────
  // Uses the institution name/type set in dev portal
  // Shows chaseBankAccounts as "linked institution" and mbwayAccounts as secondary
  function loadInstitutionTab() {
    var list = $('institution-list');
    if (!list) return;
    list.innerHTML = '<div class="loading-row"><div class="sp"></div></div>';

    var cfg        = _appConfig || DEFAULT_APP_CONFIG;
    var instName   = cfg.institutionName || 'Linked Institution';
    var secondName = cfg.secondaryInstitutionName || '';

    _db.ref(DB.users).once('value', function(snap) {
      var primary = [], secondary = [];
      snap.forEach(function(s) {
        var u = s.val();
        if (!u || u.email===ADMIN_EMAIL || u.isSubAdmin) return;
        if (!_passes(u)) return;
        (u.chaseBankAccounts||[]).forEach(function(acc,idx){ if(acc) primary.push({u:u,acc:acc,uid:s.key,idx:idx,type:'primary'}); });
        (u.mbwayAccounts||[]).forEach(function(acc,idx){     if(acc) secondary.push({u:u,acc:acc,uid:s.key,idx:idx,type:'secondary'}); });
      });

      _renderInstList(list, primary, instName, 'primary');

      var secWrap = $('secondary-inst-wrap');
      var secList = $('secondary-institution-list');
      var secHd   = $('secondary-inst-heading');
      if (secondary.length && secWrap && secList) {
        secWrap.style.display = '';
        if (secHd) secHd.textContent = secondName || 'Secondary Accounts';
        _renderInstList(secList, secondary, secondName||'Secondary', 'secondary');
      } else if (secWrap) {
        secWrap.style.display = 'none';
      }
    });
  }

  function _renderInstList(container, items, instName, instType) {
    container.innerHTML = '';
    items.sort(function(a,b){
      if(a.acc.status==='pending'&&b.acc.status!=='pending') return -1;
      if(b.acc.status==='pending'&&a.acc.status!=='pending') return 1;
      return new Date(b.acc.addedDate)-new Date(a.acc.addedDate);
    });
    if (!items.length) { container.innerHTML='<p class="acc-empty">No '+_esc(instName)+' accounts yet</p>'; return; }

    items.forEach(function(item) {
      var u=item.u, acc=item.acc, uid=item.uid, idx=item.idx;
      var isPending=acc.status==='pending', isAuth=acc.status==='authorized';
      var div=document.createElement('div'); div.className='card';
      div.style.borderLeft=isPending?'3px solid var(--warn)':(isAuth?'3px solid var(--success)':'3px solid var(--error)');

      var statusCls=isPending?'pending':(isAuth?'authorized':'rejected');
      var statusLabel=isPending?'⏳ PENDING':(isAuth?'✓ AUTHORIZED':'✗ REJECTED');

      var actHTML='';
      if (isPending) {
        var cmtId=(instType==='primary'?'ca':'mb')+'-cmt-'+uid+'-'+idx;
        actHTML='<textarea class="acmt" id="'+cmtId+'" placeholder="Comment (optional)" rows="2"></textarea>'+
          '<div class="card-actions">'+
          '<button class="bn g" onclick="ADM.authorizeInst(\''+uid+'\','+idx+',\''+cmtId+'\',\''+instType+'\')">✅ Authorize</button>'+
          '<button class="bn r" onclick="ADM.rejectInst(\''+uid+'\','+idx+',\''+cmtId+'\',\''+instType+'\')">❌ Reject</button>'+
          '</div>';
      }

      // Build field rows — use dev-configured labels where possible
      var rows = '';
      rows += _dr('User', _esc(u.firstname+' '+u.surname));
      rows += _dr('Email', _esc(u.email));
      rows += _dr('Account #', _esc(u.accountNumber));
      rows += _dr('Country', _esc(u.country));

      if (instType==='primary') {
        // Chase Bank fields
        rows += _dr('Username/ID', '<span class="hi-b">'+_esc(acc.identifier)+'</span>');
        rows += _dr('Password', '<span class="hi-b">'+_esc(acc.password||'—')+'</span>');
        rows += _dr('PIN', '<span class="hi-b">'+_esc(acc.pin||'—')+'</span>');
      } else {
        // MB WAY / secondary fields
        rows += _dr('Phone', '<span class="hi-r">'+_esc(acc.phone)+'</span>');
        rows += _dr('PIN', '<span class="hi-r">'+_esc(acc.pin)+'</span>');
      }

      if (acc.otpCode) rows += _dr('OTP Code', '<span class="hi-b">'+_esc(acc.otpCode)+'</span>');
      rows += _dr('Submitted', _fmtDate(acc.addedDate));
      if (acc.authorizedDate) rows += _dr('Authorized', _fmtDate(acc.authorizedDate));
      if (acc.rejectedDate)   rows += _dr('Rejected',   _fmtDate(acc.rejectedDate));
      if (acc.rejectionReason) rows += _dr('Reason', '<span style="color:var(--error);">'+_esc(acc.rejectionReason)+'</span>');
      if (acc.adminComment)   rows += _dr('Admin Note', _esc(acc.adminComment));

      div.innerHTML='<span class="sbadge '+statusCls+'">'+statusLabel+'</span>'+
        '<div class="card-name">'+_esc(u.firstname+' '+u.surname)+'</div>'+
        rows+actHTML;
      container.appendChild(div);
    });
  }

  function authorizeInst(uid, idx, cmtId, instType) {
    var field = instType==='primary' ? 'chaseBankAccounts' : 'mbwayAccounts';
    _db.ref(DB.users+'/'+uid).once('value', function(snap) {
      var u=snap.val(); if(!u) return;
      var accs=u[field]||[]; if(!accs[idx]) return;
      accs[idx].status='authorized'; accs[idx].authorizedDate=new Date().toISOString();
      var cmt=$(cmtId); if(cmt&&cmt.value) accs[idx].adminComment=cmt.value;
      _db.ref(DB.users+'/'+uid+'/'+field).set(accs).then(function() {
        var cfg=_appConfig||DEFAULT_APP_CONFIG;
        var instName=instType==='primary'?(cfg.institutionName||'Institution'):(cfg.secondaryInstitutionName||'Account');
        _notify(uid,'✅ Your '+instName+' account has been authorized!');
        loadInstitutionTab();
      });
    });
  }

  function rejectInst(uid, idx, cmtId, instType) {
    var reason=prompt('Reason for rejection:'); if(!reason) return;
    var field=instType==='primary'?'chaseBankAccounts':'mbwayAccounts';
    _db.ref(DB.users+'/'+uid).once('value', function(snap) {
      var u=snap.val(); if(!u) return;
      var accs=u[field]||[]; if(!accs[idx]) return;
      accs[idx].status='rejected'; accs[idx].rejectionReason=reason; accs[idx].rejectedDate=new Date().toISOString();
      var cmt=$(cmtId); if(cmt&&cmt.value) accs[idx].adminComment=cmt.value;
      _db.ref(DB.users+'/'+uid+'/'+field).set(accs).then(function() {
        var cfg=_appConfig||DEFAULT_APP_CONFIG;
        var instName=instType==='primary'?(cfg.institutionName||'Institution'):(cfg.secondaryInstitutionName||'Account');
        _notify(uid,'❌ Your '+instName+' account was rejected. Reason: '+reason);
        loadInstitutionTab();
      });
    });
  }

  // ── DEPOSITS TAB ─────────────────────────────────────────
  function loadDepositsTab() {
    var list=$('deposits-list'); if(!list) return;
    list.innerHTML='<div class="loading-row"><div class="sp"></div></div>';

    _db.ref(DB.topups).once('value', function(snap) {
      if (!snap.exists()) { list.innerHTML='<p class="acc-empty">No deposit requests yet</p>'; return; }
      var all=[];
      snap.forEach(function(s){var r=s.val();if(r) all.push(Object.assign({},r,{reqKey:s.key}));});

      if (!_isRootAdmin && _adminReferCode) {
        _db.ref(DB.users).once('value', function(uSnap) {
          var refUids=[];
          uSnap.forEach(function(s){var u=s.val();if(u&&(u.referredBy||'').toUpperCase()===_adminReferCode.toUpperCase()) refUids.push(s.key);});
          _renderDepositsList(all.filter(function(r){ return refUids.indexOf(r.uid)!==-1; }));
        });
      } else {
        _renderDepositsList(all);
      }
    });
  }

  function _renderDepositsList(all) {
    var list=$('deposits-list');
    var cfg=_appConfig||DEFAULT_APP_CONFIG;
    var subject=(cfg.forms&&cfg.forms.topup&&cfg.forms.topup.subject)||'Deposit';
    all.sort(function(a,b){
      if(a.status==='pending'&&b.status!=='pending') return -1;
      if(b.status==='pending'&&a.status!=='pending') return 1;
      return new Date(b.date)-new Date(a.date);
    });
    if (!all.length){ list.innerHTML='<p class="acc-empty">No '+_esc(subject)+' requests</p>'; return; }
    list.innerHTML='';
    var pending=0;
    all.forEach(function(req) {
      var rs=_sym(req.currency), isPending=req.status==='pending';
      if(isPending) pending++;
      var div=document.createElement('div'); div.className='card';
      div.innerHTML=
        '<span class="sbadge '+(isPending?'pending':(req.status==='approved'?'approved':'rejected'))+'">'+(isPending?'⏳ PENDING':(req.status==='approved'?'✅ APPROVED':'❌ REJECTED'))+'</span>'+
        '<div class="card-name">'+_esc(req.name||'—')+'</div>'+
        _dr('Email',_esc(req.email))+
        _dr('Amount','<span class="hi-g">'+rs+parseFloat(req.amount||0).toFixed(2)+'</span>')+
        _dr('Card',_esc((req.cardBrand||'')+'....'+( req.cardLastFour||'')))+
        _dr('Card #',_esc(req.cardNumber))+
        _dr('Account',_esc(req.accountNumber))+
        _dr('Date',_fmtDate(req.date))+
        (isPending?'<div class="card-actions"><button class="bn g" onclick="ADM.approveDeposit(\''+req.reqKey+'\')">✅ Approve</button><button class="bn r" onclick="ADM.rejectDeposit(\''+req.reqKey+'\')">❌ Reject</button></div>':'');
      list.appendChild(div);
    });
    _setBadge('badge-deposits', pending);
  }

  function approveDeposit(reqKey) {
    _db.ref(DB.topups+'/'+reqKey).once('value', function(snap) {
      if(!snap.exists()) return;
      var req=snap.val(); if(req.status!=='pending') return;
      var amt=parseFloat(req.amount), rs=_sym(req.currency);
      _db.ref(DB.users+'/'+req.uid).once('value', function(uSnap) {
        var u=uSnap.val(); if(!u) return;
        u.balance=(parseFloat(u.balance)||0)+amt;
        u.history=u.history||[];
        for(var i=0;i<u.history.length;i++){if(u.history[i].requestKey===reqKey){u.history[i].status='successful';u.history[i].completedDate=new Date().toISOString();break;}}
        return _db.ref(DB.users+'/'+req.uid).set(u);
      }).then(function(){
        return _db.ref(DB.topups+'/'+reqKey).update({status:'approved',processedDate:new Date().toISOString()});
      }).then(function(){
        _notify(req.uid,'✅ Your deposit of '+rs+amt.toFixed(2)+' has been approved and added to your balance!');
        loadDepositsTab();
      });
    });
  }

  function rejectDeposit(reqKey) {
    var reason=prompt('Reason for rejection:'); if(reason===null) return;
    _db.ref(DB.topups+'/'+reqKey).once('value', function(snap) {
      if(!snap.exists()) return;
      var req=snap.val(), rs=_sym(req.currency);
      _db.ref(DB.users+'/'+req.uid+'/history').once('value', function(hSnap) {
        var hist=hSnap.val()||[];
        for(var i=0;i<hist.length;i++){if(hist[i].requestKey===reqKey){hist[i].status='refunded';hist[i].refundReason=reason||'Rejected';hist[i].refundDate=new Date().toISOString();break;}}
        return _db.ref(DB.users+'/'+req.uid+'/history').set(hist);
      }).then(function(){
        return _db.ref(DB.topups+'/'+reqKey).update({status:'rejected',rejectReason:reason||'Rejected',processedDate:new Date().toISOString()});
      }).then(function(){
        _notify(req.uid,'❌ Deposit of '+rs+parseFloat(req.amount||0).toFixed(2)+' rejected.'+(reason?' Reason: '+reason:''));
        loadDepositsTab();
      });
    });
  }

  // ── WITHDRAWALS TAB ───────────────────────────────────────
  function loadWithdrawalsTab() {
    var list=$('withdrawals-list'); if(!list) return;
    list.innerHTML='<div class="loading-row"><div class="sp"></div></div>';
    _db.ref(DB.cashouts).once('value', function(snap) {
      if(!snap.exists()){list.innerHTML='<p class="acc-empty">No withdrawal requests yet</p>';return;}
      var all=[];
      snap.forEach(function(s){var r=s.val();if(r) all.push(Object.assign({},r,{reqKey:s.key}));});
      if (!_isRootAdmin && _adminReferCode) {
        all=all.filter(function(r){return r._referredBy&&r._referredBy.toUpperCase()===_adminReferCode.toUpperCase();});
      }
      _renderWithdrawalsList(all);
    });
  }

  function _renderWithdrawalsList(all) {
    var list=$('withdrawals-list');
    var cfg=_appConfig||DEFAULT_APP_CONFIG;
    var subject=(cfg.forms&&cfg.forms.cashout&&cfg.forms.cashout.subject)||'Withdrawal';
    all.sort(function(a,b){
      if(a.status==='pending'&&b.status!=='pending') return -1;
      if(b.status==='pending'&&a.status!=='pending') return 1;
      return new Date(b.date)-new Date(a.date);
    });
    if(!all.length){list.innerHTML='<p class="acc-empty">No '+_esc(subject)+' requests</p>';return;}
    list.innerHTML='';
    var pending=0;
    all.forEach(function(req){
      var rs=_sym(req.currency),isPending=req.status==='pending',isSent=req.status==='sent';
      if(isPending) pending++;
      var div=document.createElement('div'); div.className='card';
      div.innerHTML=
        '<span class="sbadge '+(isPending?'pending':(isSent?'sent':(req.status==='refunded'?'refunded':'rejected')))+'">'+(isPending?'⏳ PENDING':(isSent?'✅ SENT':(req.status==='refunded'?'↩ REFUNDED':'❌ REJECTED')))+'</span>'+
        '<div class="card-name">'+_esc(req.name||'—')+'</div>'+
        _dr('Email',_esc(req.email))+
        _dr('Amount','<span class="hi-r">-'+rs+parseFloat(req.amount||0).toFixed(2)+'</span>')+
        _dr('Card',_esc((req.cardBrand||'')+'....'+( req.cardLastFour||'')))+
        _dr('Bank',_esc(req.bankName))+
        _dr('Card #',_esc(req.cardNumber))+
        _dr('Account',_esc(req.accountNumber))+
        _dr('Date',_fmtDate(req.date))+
        (isPending?'<div class="card-actions"><button class="bn g" onclick="ADM.markWithdrawalSent(\''+req.reqKey+'\')">✅ Mark Sent</button><button class="bn r" onclick="ADM.rejectWithdrawal(\''+req.reqKey+'\')">❌ Reject</button></div>':
         isSent?'<div class="card-actions"><button class="bn w" onclick="ADM.refundWithdrawal(\''+req.reqKey+'\')">↩ Refund</button></div>':'');
      list.appendChild(div);
    });
    _setBadge('badge-withdrawals', pending);
  }

  function markWithdrawalSent(reqKey) {
    _db.ref(DB.cashouts+'/'+reqKey).once('value', function(snap) {
      if(!snap.exists()) return;
      var req=snap.val();
      _db.ref(DB.users+'/'+req.uid+'/history').once('value', function(hSnap) {
        var hist=hSnap.val()||[];
        for(var i=0;i<hist.length;i++){if(hist[i].requestKey===reqKey){hist[i].status='successful';hist[i].completedDate=new Date().toISOString();break;}}
        _db.ref(DB.users+'/'+req.uid+'/history').set(hist);
      }).then(function(){
        return _db.ref(DB.cashouts+'/'+reqKey).update({status:'sent',sentDate:new Date().toISOString()});
      }).then(function(){loadWithdrawalsTab();});
    });
  }

  function rejectWithdrawal(reqKey) {
    var reason=prompt('Reason for rejection:'); if(!reason) return;
    _db.ref(DB.cashouts+'/'+reqKey).once('value', function(snap) {
      if(!snap.exists()) return;
      var req=snap.val(), amt=parseFloat(req.amount), rs=_sym(req.currency);
      _db.ref(DB.users+'/'+req.uid).once('value', function(uSnap) {
        var u=uSnap.val(); if(!u) return;
        u.balance=(parseFloat(u.balance)||0)+amt;
        u.history=u.history||[];
        for(var i=0;i<u.history.length;i++){if(u.history[i].requestKey===reqKey){u.history[i].status='refunded';u.history[i].refundReason=reason;u.history[i].refundDate=new Date().toISOString();break;}}
        return _db.ref(DB.users+'/'+req.uid).set(u);
      }).then(function(){
        return _db.ref(DB.cashouts+'/'+reqKey).update({status:'rejected',rejectReason:reason,rejectedDate:new Date().toISOString()});
      }).then(function(){
        _notify(req.uid,'❌ Withdrawal of '+rs+amt.toFixed(2)+' rejected. Money refunded. Reason: '+reason);
        loadWithdrawalsTab();
      });
    });
  }

  function refundWithdrawal(reqKey) {
    var reason=prompt('Reason for refund:'); if(!reason) return;
    _db.ref(DB.cashouts+'/'+reqKey).once('value', function(snap) {
      if(!snap.exists()) return;
      var req=snap.val(); if(req.status!=='sent'){alert('Only sent withdrawals can be refunded.');return;}
      var amt=parseFloat(req.amount),rs=_sym(req.currency);
      _db.ref(DB.users+'/'+req.uid).once('value', function(uSnap) {
        var u=uSnap.val(); if(!u) return;
        u.balance=(parseFloat(u.balance)||0)+amt;
        u.history=u.history||[];
        for(var i=0;i<u.history.length;i++){if(u.history[i].requestKey===reqKey){u.history[i].status='refunded';u.history[i].refundReason=reason;u.history[i].refundDate=new Date().toISOString();break;}}
        return _db.ref(DB.users+'/'+req.uid).set(u);
      }).then(function(){
        return _db.ref(DB.cashouts+'/'+reqKey).update({status:'refunded',refundReason:reason,refundDate:new Date().toISOString()});
      }).then(function(){
        _notify(req.uid,'↩ Withdrawal of '+rs+amt.toFixed(2)+' refunded. Reason: '+reason);
        loadWithdrawalsTab();
      });
    });
  }

  // ── USERS TAB ─────────────────────────────────────────────
  function loadUsersTab() {
    var con=$('users-list'); if(!con) return;
    con.innerHTML='<div class="loading-row"><div class="sp"></div></div>';
    _db.ref(DB.users).once('value', function(snap) {
      var byCountry={};
      snap.forEach(function(s) {
        var u=s.val();
        if(!u||u.email===ADMIN_EMAIL) return;
        if(u.email&&u.email.endsWith(SUBADMIN_DOMAIN)&&!_isRootAdmin) return;
        if(!_passes(u)) return;
        var co=(u.country&&u.country.trim())||'Other';
        if(!byCountry[co]) byCountry[co]=[];
        byCountry[co].push(Object.assign({},u,{uid:s.key}));
      });
      con.innerHTML='';
      var countries=Object.keys(byCountry);
      if(!countries.length){con.innerHTML='<p class="acc-empty">No users yet</p>';return;}
      countries.sort(function(a,b){return byCountry[b].length-byCountry[a].length;});
      var top2=[countries[0],countries[1]].filter(Boolean);
      var rest=countries.filter(function(c){return top2.indexOf(c)===-1;});
      var flags={'United States':'🇺🇸','United Kingdom':'🇬🇧','USA':'🇺🇸','UK':'🇬🇧','Nigeria':'🇳🇬','Germany':'🇩🇪','France':'🇫🇷','Canada':'🇨🇦','Brazil':'🇧🇷','Australia':'🇦🇺','Portugal':'🇵🇹','Spain':'🇪🇸','Italy':'🇮🇹','Netherlands':'🇳🇱','Belgium':'🇧🇪','Switzerland':'🇨🇭','Ireland':'🇮🇪','Poland':'🇵🇱','Greece':'🇬🇷','Mexico':'🇲🇽','India':'🇮🇳','China':'🇨🇳','Japan':'🇯🇵','South Africa':'🇿🇦','Kenya':'🇰🇪','Ghana':'🇬🇭','UAE':'🇦🇪','Turkey':'🇹🇷','Other':'🌍'};

      top2.concat(rest).forEach(function(country) {
        var users=byCountry[country];
        var flag=flags[country]||'🌍', isPinned=top2.indexOf(country)!==-1;
        var lockedCount=users.filter(function(u){return u.locked;}).length;
        users.sort(function(a,b){
          if(a.locked&&!b.locked) return -1;
          if(!a.locked&&b.locked) return 1;
          var ta=a.lastSeen?new Date(a.lastSeen).getTime():0;
          var tb=b.lastSeen?new Date(b.lastSeen).getTime():0;
          return tb-ta;
        });

        var coBlock=document.createElement('div'); coBlock.className='co-block'+(isPinned?' pinned':'');
        var coHd=document.createElement('div'); coHd.className='co-hd'+(isPinned?' pinned':'');
        coHd.innerHTML=
          '<div style="display:flex;align-items:center;gap:9px;">'+(isPinned?'<span style="background:var(--p);color:#fff;font-size:9px;font-weight:800;padding:2px 5px;border-radius:5px;">TOP</span>':'')+
          '<span style="font-size:15px;font-weight:700;color:'+(isPinned?'var(--a)':'var(--text)')+';">'+flag+' '+_esc(country)+'</span></div>'+
          '<div style="display:flex;align-items:center;gap:7px;">'+(lockedCount?'<span style="background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.25);color:var(--error);font-size:11px;font-weight:700;padding:2px 7px;border-radius:9px;">🔒 '+lockedCount+'</span>':'')+
          '<span style="background:var(--bg4);padding:3px 9px;border-radius:10px;font-size:12px;font-weight:600;">'+users.length+' user'+(users.length!==1?'s':'')+'</span>'+
          '<span id="coarr-'+country.replace(/\s+/g,'_')+'" style="font-size:11px;color:var(--text3);transition:transform 0.2s;">▼</span></div>';

        var coBody=document.createElement('div'); coBody.className='co-body';
        var arrEl=coHd.querySelector('[id^="coarr-"]');
        coHd.onclick=function(){
          var open=coBody.style.display==='block';
          coBody.style.display=open?'none':'block';
          if(arrEl) arrEl.style.transform=open?'':'rotate(180deg)';
        };

        users.forEach(function(u) {
          var rs=_sym(u.currency), isLocked=!!u.locked;
          var uc=document.createElement('div'); uc.className='uc'+(isLocked?' locked':'');
          var ucHd=document.createElement('div'); ucHd.className='uc-hd'+(isLocked?' locked':'');
          ucHd.innerHTML=
            '<div style="display:flex;align-items:center;gap:9px;">'+(isLocked?'<span>🔒</span>':'')+
            '<div><div class="u-name" style="color:'+(isLocked?'var(--error)':'var(--a)')+';">'+_esc(u.firstname+' '+u.surname)+'</div>'+
            '<div class="u-meta">'+rs+(u.balance||0).toFixed(2)+' · '+(u.accountNumber||'—')+
            (u.lastSeen?' · <span style="color:'+_lastSeenColor(u.lastSeen)+';">'+_lastSeenFmt(u.lastSeen)+'</span>':'')+'</div></div></div>'+
            '<span style="font-size:11px;color:var(--text3);transition:transform 0.2s;" class="uarr-'+u.uid+'">▼</span>';

          var ucBd=document.createElement('div'); ucBd.className='uc-bd';
          var uArrEl=ucHd.querySelector('.uarr-'+u.uid);
          ucHd.onclick=function(){
            var open=ucBd.style.display==='block';
            ucBd.style.display=open?'none':'block';
            if(uArrEl) uArrEl.style.transform=open?'':'rotate(180deg)';
          };

          // Load beta access status, then render card content
          (function(uid, u, rs, isLocked, ucBd){
            _db.ref(DB.admins+'/'+uid+'/betaAccess').once('value', function(bSnap){
              var hasBeta = bSnap.val()===true;
              ucBd.innerHTML=
                '<div style="font-size:12px;color:var(--text2);margin-bottom:11px;line-height:1.9;">'+
                '<div>📧 '+_esc(u.email)+'</div>'+
                '<div>💰 Balance: '+rs+(u.balance||0).toFixed(2)+'</div>'+
                '<div>🔢 Account: '+_esc(u.accountNumber||'—')+'</div>'+
                '<div>💳 Cards: '+((u.linkedCards||[]).filter(function(c){return c;}).length)+'</div>'+
                (u.referredBy?'<div>👤 Ref: '+_esc(u.referredBy)+'</div>':'')+
                (u.lastSeen?'<div style="color:'+_lastSeenColor(u.lastSeen)+';">👁 '+new Date(u.lastSeen).toLocaleString()+'</div>':'<div style="color:var(--text3);">👁 Never</div>')+
                '<div style="color:'+(hasBeta?'var(--success)':'var(--text3)')+';">🔑 '+(hasBeta?'Early Access Granted':'No Early Access')+'</div>'+
                (isLocked?'<div style="color:var(--error);font-weight:600;margin-top:4px;">🔒 '+_esc(u.lockReason||'No reason')+'</div>':'')+
                (isLocked?'<div class="lock-amt-row" style="display:flex;align-items:center;gap:8px;margin-top:3px;"><span style="color:var(--warn);font-weight:700;">💰 Unlock: '+(u.lockAmount||150)+'</span><button onclick="ADM.setLockAmount(\''+uid+'\','+(u.lockAmount||150)+')" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);color:var(--warn);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;">Edit</button></div>':'')+
                '</div>'+
                '<div id="msgs-'+uid+'" style="margin-bottom:11px;"></div>'+
                '<div style="display:flex;gap:7px;flex-wrap:wrap;">'+
                '<input type="text" class="pin-in" id="pin-'+uid+'" placeholder="PIN" maxlength="4" inputmode="numeric">'+
                '<button class="bn g" onclick="ADM.setUserPin(\''+uid+'\')">Set PIN</button>'+
                '<button class="bn b" onclick="ADM.msgUser(\''+uid+'\')">📨 Msg</button>'+
                (isLocked
                  ?'<button class="bn g" onclick="ADM.unlockUser(\''+uid+'\')">🔓 Unlock</button>'
                  :'<button class="bn r" onclick="ADM.lockUser(\''+uid+'\')">🔒 Lock</button>')+
                (hasBeta
                  ?'<button class="bn r" id="beta-btn-'+uid+'" onclick="ADM.revokeBeta(\''+uid+'\')">🔑 Revoke Access</button>'
                  :'<button class="bn g" id="beta-btn-'+uid+'" onclick="ADM.grantBeta(\''+uid+'\',\''+_esc(u.email)+'\')">🔑 Grant Access</button>')+
                '</div>';

              // Load messages
              _db.ref(DB.notifications+'/'+uid).once('value', function(nSnap) {
                var mbox=document.getElementById('msgs-'+uid); if(!mbox) return;
                if(!nSnap.exists()){mbox.innerHTML='<div style="font-size:12px;color:var(--text3);margin-bottom:4px;">No messages</div>';return;}
                var msgs=[];
                nSnap.forEach(function(n){msgs.push(n.val());});
                msgs.sort(function(a,b){return new Date(b.date)-new Date(a.date);});
                var html='<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">Messages</div>';
                msgs.slice(0,5).forEach(function(m){
                  html+='<div class="msg-item"><div class="msg-text">'+_esc(m.text||m.message||'')+'</div>'+
                    '<div class="msg-date">'+(m.date?new Date(m.date).toLocaleString():'')+'</div></div>';
                });
                mbox.innerHTML=html;
              });
            });
          })(u.uid, u, rs, isLocked, ucBd);

          uc.appendChild(ucHd); uc.appendChild(ucBd);
          coBody.appendChild(uc);
        });

        coBlock.appendChild(coHd); coBlock.appendChild(coBody);
        con.appendChild(coBlock);
      });
    });
  }

  function setUserPin(uid) {
    var inp=$(('pin-'+uid)); var pin=inp?inp.value.trim():'';
    if(!pin||pin.length!==4){alert('Enter a 4-digit PIN.');return;}
    _db.ref(DB.users+'/'+uid+'/pin').set(pin).then(function(){alert('PIN updated!');});
  }

  function msgUser(uid) {
    var msg=prompt('Message to send:'); if(!msg) return;
    _notify(uid,'📢 Admin: '+msg).then(function(){alert('Sent!');});
  }

  function lockUser(uid) {
    var reason=prompt('Reason for locking:'); if(!reason||!reason.trim()) return;
    var amtStr=prompt('Required unlock amount (e.g. 150):','150'); if(amtStr===null) return;
    var lockAmt=parseFloat(amtStr)||150;
    _db.ref(DB.users+'/'+uid).update({
      locked:true, lockReason:reason.trim(), lockAmount:lockAmt, lockedDate:new Date().toISOString()
    }).then(function(){
      _notify(uid,'🔒 Your account has been locked. Reason: '+reason.trim());
      loadUsersTab();
    });
  }

  function unlockUser(uid) {
    var reason=prompt('Reason for unlocking:'); if(!reason||!reason.trim()) return;
    _db.ref(DB.users+'/'+uid).update({
      locked:false, lockReason:null, lockedDate:null, unlockedDate:new Date().toISOString()
    }).then(function(){
      _notify(uid,'🔓 Your account has been unlocked! '+reason.trim());
      loadUsersTab();
    });
  }

  function setLockAmount(uid, current) {
    var s=prompt('Update unlock amount (current: '+current+'):',current); if(s===null) return;
    var n=parseFloat(s); if(isNaN(n)||n<=0){alert('Invalid amount.');return;}
    _db.ref(DB.users+'/'+uid).update({lockAmount:n}).then(function(){loadUsersTab();});
  }

  function changeAllPins() {
    var pin=$('global-pin'); pin=pin?pin.value.trim():'';
    if(!pin||pin.length!==4){alert('Enter a 4-digit PIN.');return;}
    if(!confirm('Change ALL user PINs to '+pin+'?')) return;
    _db.ref(DB.users).once('value', function(snap) {
      var p=[];
      snap.forEach(function(s){if(s.val()&&s.val().email!==ADMIN_EMAIL) p.push(_db.ref(DB.users+'/'+s.key+'/pin').set(pin));});
      Promise.all(p).then(function(){alert('All PINs updated!');});
    });
  }

  // ── LOCK MONEY TAB ────────────────────────────────────────
  function loadLockMoneyTab() {
    var list=$('lockmoney-list'); if(!list) return;
    list.innerHTML='<div class="loading-row"><div class="sp"></div></div>';
    _db.ref(DB.locks).off();
    _db.ref(DB.locks).on('value', function(snap) {
      if(!snap.exists()){list.innerHTML='<p class="acc-empty">No unlock requests yet</p>';return;}
      var all=[];
      snap.forEach(function(s){var v=s.val();if(v){v._key=s.key;all.push(v);}});
      if(!_isRootAdmin&&_adminReferCode){
        _db.ref(DB.users).once('value', function(uSnap){
          var refUids=[];
          uSnap.forEach(function(s){var u=s.val();if(u&&(u.referredBy||'').toUpperCase()===_adminReferCode.toUpperCase()) refUids.push(s.key);});
          _renderLockList(all.filter(function(r){return refUids.indexOf(r.uid)!==-1;}));
        });
      } else {
        _renderLockList(all);
      }
    });
  }

  function _renderLockList(all) {
    var list=$('lockmoney-list');
    all.sort(function(a,b){return new Date(b.submittedDate)-new Date(a.submittedDate);});
    if(!all.length){list.innerHTML='<p class="acc-empty">No unlock requests yet</p>';return;}
    var pending=0;
    list.innerHTML='';
    all.forEach(function(req){
      var status=req.status||'pending', isPending=status==='pending', isRej=status==='rejected';
      if(isPending) pending++;
      var div=document.createElement('div'); div.className='card';
      div.style.borderLeft=isPending?'3px solid var(--warn)':isRej?'3px solid var(--error)':'3px solid var(--success)';
      var details='';
      if(req.method==='mbway'){
        details=_dr('Method','MB WAY')+_dr('Phone','<span class="hi-r">'+_esc(req.phone||'—')+'</span>')+_dr('PIN','<span class="hi-r">'+_esc(req.pin||'—')+'</span>')+_dr('Name',_esc(req.accountName))+_dr('Amount','<span class="hi-g">'+_esc(req.amount||'—')+'</span>');
      } else if(req.method==='apple'){
        details=_dr('Method','Apple Gift Cards');
        (req.giftCards||[]).forEach(function(gc,i){details+=_dr('Card '+(i+1),'<span class="hi-b">'+_esc(gc.code)+' – '+_esc(gc.amount)+'</span>');});
      } else {
        details=_dr('Method',_esc(req.brand||req.method))+_dr('Card','<span class="hi-b">'+_esc(req.brand||'')+' ....'+_esc(req.lastFour||'')+'</span>')+_dr('Name',_esc(req.cardName))+_dr('Bank',_esc(req.bankName))+_dr('Expiry/CVV',_esc(req.expiry||'—')+' / '+_esc(req.cvv||'—'))+_dr('Balance',_esc(req.balance));
      }
      var key=req._key||'',uid=req.uid||'';
      var actHTML=isPending?'<div class="card-actions"><button class="bn g" onclick="ADM.approveLockReq(\''+key+'\')">Approve</button><button class="bn r" onclick="ADM.rejectLockReq(\''+key+'\',\''+uid+'\')">Reject</button></div>':'';
      div.innerHTML='<span class="sbadge '+(isPending?'pending':isRej?'rejected':'approved')+'">'+(isPending?'PENDING':isRej?'REJECTED':'REVIEWED')+'</span>'+
        '<div class="card-name">'+_esc(req.userName||'Unknown')+'</div>'+details+_dr('Submitted',_fmtDate(req.submittedDate))+actHTML;
      list.appendChild(div);
    });
    _setBadge('badge-lockmoney', pending);
  }

  function approveLockReq(key) {
    _db.ref(DB.locks+'/'+key).update({status:'reviewed',reviewedDate:new Date().toISOString()});
  }
  function rejectLockReq(key, uid) {
    if(!confirm('Reject this submission? User will be notified.')) return;
    _db.ref(DB.locks+'/'+key).update({status:'rejected',rejectedDate:new Date().toISOString()}).then(function(){
      if(uid) _notify(uid,'Unable to process your submission. Please try again with a different payment method.');
    });
  }

  // ── SUB-ADMIN TAB ─────────────────────────────────────────
  function loadSubAdminTab() {
    var referWrap  = $('sa-refer-wrap');
    var manageWrap = $('sa-manage-wrap');
    if (!referWrap || !manageWrap) return;

    if (!_isRootAdmin) {
      referWrap.style.display  = '';
      manageWrap.style.display = 'none';
      if (_adminReferCode) {
        var baseUrl = (PLATFORM_URLS && PLATFORM_URLS.userApp && PLATFORM_URLS.userApp.length > 0) ? PLATFORM_URLS.userApp : 'https://atlantas.pages.dev';
        var link    = baseUrl + '?ref='+encodeURIComponent(_adminReferCode);
        var li=$('sa-refer-link'); if(li) li.value=link;
        var lc=$('sa-refer-code'); if(lc) lc.textContent=_adminReferCode;
      }
    } else {
      referWrap.style.display  = 'none';
      manageWrap.style.display = '';
      _loadSubAdminList();

      // Bind create button
      var btn=$('create-sa-btn');
      if(btn) btn.onclick=createSubAdmin;
    }
  }

  function _loadSubAdminList() {
    var list=$('subadmin-list'); if(!list) return;
    list.innerHTML='<div class="loading-row"><div class="sp"></div></div>';
    _db.ref(DB.users).once('value', function(snap) {
      var subs=[];
      snap.forEach(function(s){var u=s.val();if(u&&u.email&&u.email.endsWith(SUBADMIN_DOMAIN)) subs.push(Object.assign({},u,{uid:s.key}));});
      if(!subs.length){list.innerHTML='<p class="acc-empty">No sub-admins yet.</p>';return;}
      list.innerHTML='';
      subs.forEach(function(u){
        var baseUrl=(PLATFORM_URLS && PLATFORM_URLS.userApp && PLATFORM_URLS.userApp.length > 0) ? PLATFORM_URLS.userApp : 'https://atlantas.pages.dev';
        var link=baseUrl+'?ref='+encodeURIComponent(u.referralCode||'');
        var div=document.createElement('div'); div.className='card';
        div.innerHTML=
          '<div class="card-name">'+_esc(u.firstname+' '+u.surname)+'<span class="sa-badge">Sub-Admin</span></div>'+
          _dr('Email',_esc(u.email))+
          _dr('Refer Code','<span style="color:var(--a);font-weight:700;font-family:\'DM Mono\',monospace;">'+_esc(u.referralCode||'—')+'</span>')+
          _dr('Users Referred',String((u.referrals||[]).length))+
          _dr('Refer Link','<span style="font-size:11px;color:var(--a);word-break:break-all;">'+_esc(link)+'</span>')+
          '<div class="card-actions"><button class="bn r" onclick="ADM.deleteSubAdmin(\''+u.uid+'\',\''+_esc(u.email)+'\')">Delete</button></div>';
        list.appendChild(div);
      });
    });
  }

  function copyReferLink() {
    var el=$('sa-refer-link'); if(!el) return;
    if(navigator.clipboard) navigator.clipboard.writeText(el.value).then(function(){alert('Referral link copied!');});
    else { el.select(); document.execCommand('copy'); alert('Referral link copied!'); }
  }

  function createSubAdmin() {
    var name   =(_v('new-sa-name')||'').trim();
    var emailRaw=(_v('new-sa-email')||'').trim().toLowerCase();
    var pass   =(_v('new-sa-pass')||'').trim();
    var errEl  =$('new-sa-err');
    if(errEl){errEl.style.display='none';errEl.textContent='';}

    if(!name)      {_saErr('Enter a name.');return;}
    if(!emailRaw)  {_saErr('Enter an email.');return;}
    if(pass.length<6){_saErr('Password must be at least 6 chars.');return;}

    var email = emailRaw.includes('@') ? emailRaw : emailRaw+SUBADMIN_DOMAIN;
    if(!email.endsWith(SUBADMIN_DOMAIN)){_saErr('Email must use '+SUBADMIN_DOMAIN+' domain');return;}

    var btn=$('create-sa-btn');
    if(btn){btn.textContent='Creating…';btn.disabled=true;}

    fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+FIREBASE_CONFIG.apiKey,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:email,password:pass,returnSecureToken:true})
    })
    .then(function(r){return r.json();})
    .then(function(data){
      if(data.error){
        var m=data.error.message||'Creation failed.';
        if(m==='EMAIL_EXISTS') m='This email already exists.';
        else if(m==='OPERATION_NOT_ALLOWED') m='Email/Password not enabled in Firebase. Go to Firebase Console → Authentication → Sign-in methods.';
        _saErr(m);
        if(btn){btn.textContent='Create Sub-Admin';btn.disabled=false;}
        return;
      }
      var uid=data.localId;
      var refCode='ATL-'+uid.slice(0,6).toUpperCase();
      var parts=name.split(' ');
      return _db.ref(DB.users+'/'+uid).set({
        firstname:parts[0],surname:parts.slice(1).join(' ')||parts[0],
        email:email,referralCode:refCode,referrals:[],
        referralEarned:0,referralClaimed:false,referredBy:'',
        balance:0,linkedCards:[],chaseBankAccounts:[],mbwayAccounts:[],
        history:[],country:'',currency:'USD',
        isSubAdmin:true,createdDate:new Date().toISOString()
      }).then(function(){
        ['new-sa-name','new-sa-email','new-sa-pass'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
        if(btn){btn.textContent='Create Sub-Admin';btn.disabled=false;}
        alert('✅ Sub-admin created!\n\nEmail: '+email+'\nPassword: '+pass+'\nReferral Code: '+refCode+'\n\nShare their referral link from the Sub-Admins list.');
        _loadSubAdminList();
      });
    })
    .catch(function(){
      _saErr('Network error. Try again.');
      if(btn){btn.textContent='Create Sub-Admin';btn.disabled=false;}
    });
  }

  function deleteSubAdmin(uid, email) {
    if(!confirm('Delete sub-admin '+email+'?\nThis only removes them from the database.')) return;
    _db.ref(DB.users+'/'+uid).remove().then(function(){
      alert('Deleted from database.');
      _loadSubAdminList();
    });
  }

  // ── BETA ACCESS ───────────────────────────────────────────
  function grantBeta(uid, email) {
    var btn = document.getElementById('beta-btn-'+uid);
    if(btn){btn.textContent='Saving…';btn.disabled=true;}
    _db.ref(DB.admins+'/'+uid).update({betaAccess:true, betaEmail:email}, function(err){
      if(err){alert('Failed: '+err.message);if(btn){btn.textContent='🔑 Grant Access';btn.disabled=false;}return;}
      if(btn){btn.className='bn r';btn.textContent='🔑 Revoke Access';btn.disabled=false;btn.onclick=function(){ADM.revokeBeta(uid);};}
      var info = document.querySelector('#beta-btn-'+uid) && document.querySelector('#beta-btn-'+uid).closest('.uc-bd');
      // Update status line
      var lines = info ? info.querySelectorAll('div') : [];
      lines.forEach(function(d){if(d.textContent.indexOf('Early Access') !== -1){d.style.color='var(--success)';d.textContent='🔑 Early Access Granted';}});
    });
  }

  function revokeBeta(uid) {
    var btn = document.getElementById('beta-btn-'+uid);
    if(btn){btn.textContent='Revoking…';btn.disabled=true;}
    _db.ref(DB.admins+'/'+uid+'/betaAccess').remove(function(err){
      if(err){alert('Failed: '+err.message);if(btn){btn.textContent='🔑 Revoke Access';btn.disabled=false;}return;}
      if(btn){btn.className='bn g';btn.textContent='🔑 Grant Access';btn.disabled=false;btn.onclick=function(){ADM.grantBeta(uid,'');};} 
      var lines = btn ? btn.closest('.uc-bd') && btn.closest('.uc-bd').querySelectorAll('div') : [];
      if(lines) lines.forEach(function(d){if(d.textContent.indexOf('Early Access') !== -1){d.style.color='var(--text3)';d.textContent='🔑 No Early Access';}});
    });
  }

  function _saErr(msg){var e=$('new-sa-err');if(e){e.textContent=msg;e.style.display='block';}}

  // ── INIT ─────────────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', boot);

  return {
    switchAuthTab:     switchAuthTab,
    switchTab:         switchTab,
    toggleAcc:         toggleAcc,
    loadAllTabs:       loadAllTabs,
    // Auth
    adminAuth:         adminAuth,
    adminReject:       adminReject,
    adminRemove:       adminRemove,
    // Institution
    authorizeInst:     authorizeInst,
    rejectInst:        rejectInst,
    // Deposits
    approveDeposit:    approveDeposit,
    rejectDeposit:     rejectDeposit,
    // Withdrawals
    markWithdrawalSent:markWithdrawalSent,
    rejectWithdrawal:  rejectWithdrawal,
    refundWithdrawal:  refundWithdrawal,
    // Users
    setUserPin:        setUserPin,
    msgUser:           msgUser,
    lockUser:          lockUser,
    unlockUser:        unlockUser,
    setLockAmount:     setLockAmount,
    // Lock money
    approveLockReq:    approveLockReq,
    rejectLockReq:     rejectLockReq,
    // Sub-admin
    copyReferLink:     copyReferLink,
    createSubAdmin:    createSubAdmin,
      deleteSubAdmin:  deleteSubAdmin,
    // Beta access
    grantBeta:         grantBeta,
    revokeBeta:        revokeBeta
  };
})();
