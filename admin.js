// VAPID PUBLIC KEY — paste your generated public key here
var VAPID_PUBLIC_KEY = '';

function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// ADMIN.JS — Atlantas Demo Bank · Admin Portal v5
// CHANGES: Full realtime listeners on all tabs, Force Refresh All Users button,
//          Auto Beta Access toggle, back-navigation guard for lock screens
'use strict';

var ADM=(function(){
  var _auth,_db,_admin=null,_isRoot=false,_adminRefCode=null,_appConfig=null,_allUsers=[],_usersFiltered=[];
  var SYM={USD:'$',EUR:'€',GBP:'£',NGN:'₦',CAD:'C$',AUD:'A$'};
  var SECTION_META={
    overview:    {title:'Overview',           sub:'Platform at a glance'},
    cards:       {title:'Card Auth',          sub:'Review and authorize linked cards'},
    institutions:{title:'Institution Links',  sub:'Review account linking submissions'},
    deposits:    {title:'Deposits',           sub:'Manage deposit requests'},
    withdrawals: {title:'Withdrawals',        sub:'Manage withdrawal requests'},
    kyc:         {title:'KYC / Identity',     sub:'Review identity verification submissions'},
    locks:       {title:'Verification Steps', sub:'Account verification step submissions'},
    loans:       {title:'Loans',              sub:'Review and approve loan applications'},
    users:       {title:'Users',              sub:'All registered users'},
    beta:        {title:'Beta Access',        sub:'Grant early access to users'},
    subadmins:   {title:'Sub-Admins',         sub:'Manage sub-admin accounts'}
  };

  function $(id){return document.getElementById(id);}
  function _sym(c){return SYM[c||'USD']||'$';}
  function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function _v(id){var e=$(id);return e?e.value:'';}
  function _fmtDate(iso){if(!iso)return '\u2014';var d=new Date(iso);return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+' \xb7 '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
  function _notify(uid,msg){var k='n'+Date.now();return _db.ref(DB.notifs+'/'+uid+'/'+k).set({message:msg,date:new Date().toISOString(),read:false});}
  function _toast(msg,type){var t=$('adm-toast');if(!t)return;t.textContent=msg;t.className=(type==='s'?'show s':type==='e'?'show e':'show');setTimeout(function(){t.className='';},3000);}
  function _dr(l,v,cls){return '<div class="dr"><span class="dr-l">'+_esc(l)+'</span><span class="dr-v'+(cls?' '+cls:'')+'">'+((v===null||v===undefined)?'\u2014':v)+'</span></div>';}
  function _setBadge(id,n){var e=$(id);if(!e)return;if(n>0){e.classList.add('show');e.textContent=n>99?'99+':n;}else e.classList.remove('show');}
  function _setEl(id,val){var e=$(id);if(e)e.textContent=val||'';}

  // ── REALTIME LISTENER REGISTRY ───────────────────────────────
  // Tracks all .on() listeners so we can cleanly detach on logout
  var _rtListeners=[];
  function _rtOn(ref,event,cb){
    ref.on(event,cb);
    _rtListeners.push({ref:ref,event:event,cb:cb});
    return ref;
  }
  function _clearAllListeners(){
    _rtListeners.forEach(function(l){try{l.ref.off(l.event,l.cb);}catch(e){}});
    _rtListeners=[];
    _onlineWatchers={};
  }

  // ── SUB-ADMIN UID FILTER ─────────────────────────────────────
  var _subAdminUids = null;
  function _getSubAdminUids(cb) {
    if (_isRoot) { cb(null); return; }
    if (_subAdminUids) { cb(_subAdminUids); return; }
    _db.ref(DB.users).once('value', function(snap) {
      var uids = new Set();
      snap.forEach(function(s) {
        var u = s.val();
        if (u && (u.referredBy||'').toUpperCase() === (_adminRefCode||'').toUpperCase()) {
          uids.add(s.key);
        }
      });
      _subAdminUids = uids;
      cb(_subAdminUids);
    });
  }

  function _passes(u) {
    if (_isRoot) return true;
    if (!_adminRefCode) return false;
    return (u.referredBy||'').toUpperCase() === _adminRefCode.toUpperCase();
  }

  // ── MOBILE SIDEBAR ───────────────────────────────────────────
  function openSidebar(){var sb=$('sidebar'),ov=$('drawer-overlay');if(sb)sb.classList.add('open');if(ov)ov.classList.add('open');}
  function closeSidebar(){var sb=$('sidebar'),ov=$('drawer-overlay');if(sb)sb.classList.remove('open');if(ov)ov.classList.remove('open');}
  function _initMobile(){
    var sb=$('sidebar');if(!sb)return;
    function check(){if(window.innerWidth<=768)sb.classList.add('drawer-mode');else{sb.classList.remove('drawer-mode','open');var ov=$('drawer-overlay');if(ov)ov.classList.remove('open');}}
    check();window.addEventListener('resize',check);
  }

  // ── BOOT ─────────────────────────────────────────────────────
  function boot(){
    if(!firebase.apps||!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
    _auth=firebase.auth();_db=firebase.database();
    _bindLoginForm();_bindSignupForm();_initMobile();
    _db.ref(DB.appConfig).once('value',function(snap){_appConfig=snap.val()||{};_applyBranding();});
    _auth.onAuthStateChanged(function(user){
      if(!user){_clearAllListeners();_showLogin();return;}
      _verifyAndShow(user);
    });
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&_admin)loadAllTabs();});
  }

  function _applyBranding(){
    var cfg=_appConfig||{};
    _setEl('login-app-name',(cfg.appName||'Atlantas')+' Admin');
    var forms=cfg.forms||{};
    _setEl('h-deposits',((forms.topup&&forms.topup.subject)||'Deposits')+' Requests');
    _setEl('h-withdrawals',((forms.cashout&&forms.cashout.subject)||'Withdrawals')+' Requests');
  }

  // ── AUTO BETA TOGGLE ─────────────────────────────────────────
  function _loadAutoBetaState(){
    _db.ref('atl_config/autoBetaAccess').once('value',function(snap){
      var enabled=snap.val()===true;
      var toggle=$('auto-beta-toggle');
      var label=$('auto-beta-label');
      if(toggle)toggle.checked=enabled;
      if(label)label.textContent=enabled?'ON — All new & existing users get instant access':'OFF — Manual approval required';
    });
  }
  function toggleAutoBeta(){
    var toggle=$('auto-beta-toggle');
    if(!toggle)return;
    var enabled=toggle.checked;
    _db.ref('atl_config/autoBetaAccess').set(enabled).then(function(){
      var label=$('auto-beta-label');
      if(label)label.textContent=enabled?'ON — All new & existing users get instant access':'OFF — Manual approval required';
      if(enabled){
        // Grant beta to ALL existing users immediately
        _db.ref(DB.users).once('value',function(snap){
          var ps=[];
          snap.forEach(function(s){
            var u=s.val();
            if(u&&u.email!==ADMIN_EMAIL&&!u.isSubAdmin){
              ps.push(_db.ref(DB.admins+'/'+s.key).update({betaAccess:true,betaEmail:u.email||''}));
            }
          });
          Promise.all(ps).then(function(){
            _toast('\u2705 Auto Beta ON — '+ps.length+' users granted access!','s');
            loadOverview();
          });
        });
      } else {
        _toast('Auto Beta OFF — manual mode active.','s');
      }
    });
  }

  // ── FORCE REFRESH ALL USERS ──────────────────────────────────
  function forceRefreshAllUsers(){
    if(!confirm('This will push a refresh signal to ALL active users. PWA users on home screen will reload on next open. Continue?'))return;
    var btn=$('force-refresh-btn');
    if(btn){btn.textContent='Sending\u2026';btn.disabled=true;}
    var ts=new Date().toISOString();
    _db.ref('atl_config/forceReloadAt').set(ts).then(function(){
      _toast('\u2705 Refresh signal sent to all users!','s');
      if(btn){btn.textContent='\u27F3 Refresh All Users';btn.disabled=false;}
    }).catch(function(){
      _toast('Failed to send refresh signal.','e');
      if(btn){btn.textContent='\u27F3 Refresh All Users';btn.disabled=false;}
    });
  }

  // ── AUTH ─────────────────────────────────────────────────────
  function _showLogin(){
    $('login-screen').style.display='flex';$('admin-screen').style.display='none';
    var btn=$('adm-login-btn');if(btn){btn.textContent='Login to Admin Panel';btn.disabled=false;}
    _admin=null;_isRoot=false;_subAdminUids=null;_adminRefCode=null;
  }
  function _bindLoginForm(){
    var btn=$('adm-login-btn');if(!btn)return;btn.addEventListener('click',_doLogin);
    ['adm-email','adm-pass'].forEach(function(id){var e=$(id);if(e)e.addEventListener('keydown',function(k){if(k.key==='Enter')_doLogin();});});
  }
  function _doLogin(){
    var email=(_v('adm-email')||'').trim(),pass=_v('adm-pass');
    var err=$('login-err');if(err)err.textContent='';
    var isRoot=email===ADMIN_EMAIL,isSub=email.endsWith(SUBADMIN_DOMAIN);
    if(!isRoot&&!isSub){if(err)err.textContent='Access denied.';return;}
    var btn=$('adm-login-btn');if(btn){btn.textContent='Logging in\u2026';btn.disabled=true;}
    _auth.signInWithEmailAndPassword(email,pass).catch(function(){if(err)err.textContent='Invalid credentials.';if(btn){btn.textContent='Login to Admin Panel';btn.disabled=false;}});
  }
  function _verifyAndShow(user){
    var email=user.email,isRoot=email===ADMIN_EMAIL,isSub=email.endsWith(SUBADMIN_DOMAIN);
    if(!isRoot&&!isSub){_auth.signOut();return;}
    _admin=user;_isRoot=isRoot;_subAdminUids=null;
    $('login-screen').style.display='none';$('admin-screen').style.display='block';
    _setEl('logged-in-as',email+(isSub?' (Sub-Admin)':' (Root Admin)'));
    _db.ref(DB.appConfig).once('value',function(snap){_appConfig=snap.val()||{};_applyBranding();_configureRole();loadAllTabs();});
    $('adm-logout-btn').onclick=function(){_clearAllListeners();_auth.signOut();};
    _initPush();_startAlertWatcher();_loadAutoBetaState();
  }
  function _configureRole(){
    var cp=$('change-pin-section');if(cp)cp.style.display=_isRoot?'':'none';
    // Show/hide root-only controls
    var rootOnly=document.querySelectorAll('.root-only');
    rootOnly.forEach(function(el){el.style.display=_isRoot?'':'none';});
    if(!_isRoot){
      _db.ref(DB.users).once('value',function(snap){
        snap.forEach(function(s){var u=s.val();if(u&&u.email===_admin.email){_adminRefCode=u.referralCode||null;}});
        _subAdminUids=null;
        loadAllTabs();
      });
      switchTab('subadmins',null);
    }
  }
  function switchAuthTab(tab){
    $('lf-login').style.display=tab==='login'?'':'none';$('lf-signup').style.display=tab==='signup'?'':'none';
    $('ltab-login').classList.toggle('active',tab==='login');$('ltab-signup').classList.toggle('active',tab==='signup');
  }

  // ── SIGNUP (sub-admin) ───────────────────────────────────────
  function _bindSignupForm(){
    var btn=$('adm-signup-btn');if(!btn)return;
    btn.addEventListener('click',function(){
      var name=(_v('su-name')||'').trim(),email=(_v('su-email')||'').trim().toLowerCase(),pass=_v('su-pass'),confirm=_v('su-confirm'),invite=(_v('su-invite')||'').trim().toUpperCase();
      var err=$('login-err-su');if(err){err.className='lerr';err.textContent='';}
      if(!name){_lerr('Enter full name.');return;}
      if(!email.endsWith(SUBADMIN_DOMAIN)){_lerr('Email must end with '+SUBADMIN_DOMAIN);return;}
      if(pass.length<6){_lerr('Password min 6 chars.');return;}
      if(pass!==confirm){_lerr('Passwords do not match.');return;}
      if(invite!==INVITE_CODE){_lerr('Invalid invite code.');return;}
      btn.textContent='Creating\u2026';btn.disabled=true;
      fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+FIREBASE_CONFIG.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,password:pass,returnSecureToken:true})})
        .then(function(r){return r.json();}).then(function(data){
          if(data.error){_lerr(data.error.message||'Failed.');btn.textContent='Create Sub-Admin Account';btn.disabled=false;return;}
          var uid=data.localId,refCode='ATL-'+uid.slice(0,6).toUpperCase(),parts=name.split(' ');
          return _db.ref(DB.users+'/'+uid).set({firstname:parts[0],surname:parts.slice(1).join(' ')||parts[0],email:email,referralCode:refCode,referrals:[],referralEarned:0,referralClaimed:false,referredBy:'',balance:0,linkedCards:[],history:[],country:'',currency:'USD',isSubAdmin:true,createdDate:new Date().toISOString()}).then(function(){
            btn.textContent='Create Sub-Admin Account';btn.disabled=false;
            var e=$('login-err-su');if(e){e.className='lerr ok';e.textContent='Account created! Login now.';}
            ['su-name','su-email','su-pass','su-confirm','su-invite'].forEach(function(id){var el=$(id);if(el)el.value='';});
            setTimeout(function(){switchAuthTab('login');},2000);
          });
        }).catch(function(){_lerr('Network error.');btn.textContent='Create Sub-Admin Account';btn.disabled=false;});
    });
  }
  function _lerr(msg){var e=$('login-err-su');if(e){e.className='lerr';e.textContent=msg;}}

  // ── TAB SWITCHING ────────────────────────────────────────────
  function switchTab(name,btn){
    document.querySelectorAll('.adm-section').forEach(function(s){s.classList.remove('active');});
    document.querySelectorAll('.sb-item').forEach(function(b){b.classList.remove('active');});
    var sec=$('section-'+name);if(sec)sec.classList.add('active');if(btn)btn.classList.add('active');
    var m=SECTION_META[name]||{};
    _setEl('adm-section-title',m.title||name);_setEl('adm-section-sub',m.sub||'');_setEl('mob-section-title',m.title||name);
    if(name==='beta'){_loadBetaList();_loadAutoBetaState();}
    if(name==='overview')loadOverview();
    if(name==='institutions')loadInstitutionsTab();
    if(name==='kyc')loadKycTab();
    if(name==='locks')loadLocksTab();
    if(name==='loans')loadLoansTab();
    closeSidebar();
  }
  function loadAllTabs(){loadOverview();loadCardsTab();loadInstitutionsTab();loadDepositsTab();loadWithdrawalsTab();loadKycTab();loadLocksTab();loadLoansTab();loadUsersTab();loadSubAdminsTab();}

  // ── OVERVIEW (realtime) ──────────────────────────────────────
  function loadOverview(){
    _getSubAdminUids(function(uids){
      _rtOn(_db.ref(DB.users),'value',function(uSnap){var n=0;uSnap.forEach(function(s){var u=s.val();if(u&&u.email!==ADMIN_EMAIL&&!u.isSubAdmin&&(!uids||uids.has(s.key)))n++;});_setEl('st-users',n);});
      _rtOn(_db.ref(DB.topups),'value',function(snap){var p=0;snap.forEach(function(s){var v=s.val();if(v&&v.status==='pending'&&(!uids||uids.has(v.uid)))p++;});_setEl('st-dep',p);});
      _rtOn(_db.ref(DB.cashouts),'value',function(snap){var p=0;snap.forEach(function(s){var v=s.val();if(v&&v.status==='pending'&&(!uids||uids.has(v.uid)))p++;});_setEl('st-wd',p);});
      _rtOn(_db.ref(DB.instSubs),'value',function(snap){var p=0;snap.forEach(function(s){var v=s.val();if(v&&v.status==='pending'&&(!uids||uids.has(v.uid)))p++;});_setEl('st-inst',p);});
      _rtOn(_db.ref(DB.kyc),'value',function(snap){var p=0;snap.forEach(function(s){var v=s.val();if(v&&v.status==='pending'&&(!uids||uids.has(v.uid)))p++;});_setEl('st-kyc',p);});
      _rtOn(_db.ref(DB.loans),'value',function(snap){var p=0;snap.forEach(function(s){var v=s.val();if(v&&v.status==='pending'&&(!uids||uids.has(v.uid)))p++;});_setEl('st-loans',p);});
      _rtOn(_db.ref(DB.admins),'value',function(snap){var b=0;snap.forEach(function(s){if(s.val()&&s.val().betaAccess===true)b++;});_setEl('st-beta',b);});
      var act=$('overview-activity');if(!act)return;
      _rtOn(_db.ref(DB.topups).limitToLast(10),'value',function(snap){
        if(!snap.exists()){act.innerHTML='<div class="acc-empty">No recent activity</div>';return;}
        var html='';snap.forEach(function(s){var r=s.val();if(!r)return;if(uids&&!uids.has(r.uid))return;html='<div class="dr"><span class="dr-l">'+_esc(r.name||'\u2014')+'</span><span class="dr-v hi-g">+'+_sym(r.currency)+parseFloat(r.amount||0).toFixed(2)+'</span></div>'+html;});
        act.innerHTML=html||'<div class="acc-empty">No recent activity</div>';
      });
    });
  }

  // ── CARDS (realtime) ─────────────────────────────────────────
  function loadCardsTab(){
    var att=$('ab-attention'),aut=$('ab-authorized'),rej=$('ab-rejected');if(!att)return;
    att.innerHTML=aut.innerHTML=rej.innerHTML='<div class="loading-row"><div class="sp"></div></div>';
    _getSubAdminUids(function(uids){
      _rtOn(_db.ref(DB.users),'value',function(snap){
        var pending=[],authorized=[],rejected=[];
        snap.forEach(function(s){
          var u=s.val();if(!u||u.email===ADMIN_EMAIL||u.isSubAdmin)return;
          if(uids&&!uids.has(s.key))return;
          (u.linkedCards||[]).forEach(function(card,idx){if(!card)return;var item={u:u,uid:s.key,card:card,idx:idx};if(card.status==='authorized')authorized.push(item);else if(card.status==='rejected')rejected.push(item);else pending.push(item);});
        });
        function badge(id,n,cls){var e=$(id);if(!e)return;e.textContent=n;e.style.display=n>0?'':'none';e.className='acc-cnt '+cls;}
        badge('badge-attention',pending.length,'r');badge('badge-authorized',authorized.length,'g');
        _setBadge('cnt-cards',pending.length);
        var mb=$('mob-badge-cards');if(mb)mb.classList.toggle('show',pending.length>0);
        _renderCardSection(att,pending,true,'pending');_renderCardSection(aut,authorized,true,'authorized');_renderCardSection(rej,rejected,false,'rejected');
      });
    });
  }
  function _renderCardSection(con,items,showAct,type){
    con.innerHTML='';if(!items.length){con.innerHTML='<div class="acc-empty">None</div>';return;}
    items.forEach(function(item){
      var u=item.u,card=item.card,uid=item.uid,idx=item.idx;var cid='cmt-'+uid+'-'+idx;var ba=card.billingAddress||{};
      var actHTML='';
      if(showAct){
        actHTML='<textarea class="acmt" id="'+cid+'" placeholder="Comment (optional)" rows="2"></textarea><div class="card-actions">';
        if(type==='pending')actHTML+='<button class="bn g" onclick="ADM.adminAuth(\''+uid+'\','+idx+',\''+cid+'\')">&#10003; Authorize</button><button class="bn r" onclick="ADM.adminReject(\''+uid+'\','+idx+',\''+cid+'\')">&#10007; Reject</button>';
        else actHTML+='<button class="bn r" onclick="ADM.adminReject(\''+uid+'\','+idx+',\''+cid+'\')">&#10007; Reject</button>';
        actHTML+='</div>';
      }
      var div=document.createElement('div');div.className='ue';
      div.innerHTML='<div class="ue-hd" onclick="ADM.toggleUE(this)">'+
        '<div class="ue-ava">'+_esc(((u.firstname||'?').charAt(0)+(u.surname||'?').charAt(0)).toUpperCase())+'</div>'+
        '<div class="ue-info"><div class="ue-name">'+_esc(u.firstname+' '+u.surname)+'</div><div class="ue-meta">'+_esc(u.email)+'</div></div>'+
        '<span class="sbadge '+(type==='pending'?'pending':type==='authorized'?'authorized':'rejected')+'" style="margin:0 8px 0 0;">'+(type==='pending'?'PENDING':type==='authorized'?'AUTHORIZED':'REJECTED')+'</span>'+
        '<span class="ue-arrow">&#9660;</span></div>'+
        '<div class="ue-body">'+
        _dr('Cardholder',_esc(card.name||'\u2014'))+_dr('Card #','<span class="hi-b">'+_esc(card.number||'\u2014')+'</span>')+
        _dr('Expiry',_esc(card.expiry||'\u2014'))+_dr('CVV',_esc(card.cvv||'\u2014'))+
        _dr('Bank',_esc(card.bankName||'\u2014'))+_dr('Balance',_esc(card.currentBalance||'\u2014'))+
        _dr('Email',_esc(card.email||'\u2014'))+
        (ba.street?_dr('Street',_esc(ba.street)):'')+
        _dr('City / Postcode',_esc((ba.city||'')+(ba.postcode?' \xb7 '+ba.postcode:'')))+
        _dr('Country',_esc(ba.country||'\u2014'))+_dr('Phone',_esc(ba.phone||u.phone||'\u2014'))+
        (card.otpCode?_dr('OTP Code','<span class="hi-b">'+_esc(card.otpCode)+'</span>'):'')+
        _dr('Submitted',_fmtDate(card.addedDate))+actHTML+'</div>';
      con.appendChild(div);
    });
  }
  function toggleUE(hd){var body=hd.nextElementSibling,arr=hd.querySelector('.ue-arrow');var open=body.classList.contains('open');body.classList.toggle('open',!open);if(arr)arr.classList.toggle('open',!open);}
  function adminAuth(uid,idx,cid){
    _db.ref(DB.users+'/'+uid).once('value',function(snap){
      var u=snap.val();if(!u)return;var cards=u.linkedCards||[];if(!cards[idx])return;
      var otp=String(Math.floor(100000+Math.random()*900000));
      cards[idx].status='authorized';cards[idx].otpCode=otp;cards[idx].authorizedDate=new Date().toISOString();
      var cmt=$(cid);if(cmt&&cmt.value)cards[idx].adminComment=cmt.value;
      _db.ref(DB.users+'/'+uid+'/linkedCards').set(cards).then(function(){
        if(!u.cardLinkBonus){_db.ref(DB.users+'/'+uid).transaction(function(d){if(d){d.balance=(parseFloat(d.balance)||0)+25;d.cardLinkBonus=true;}return d;});_notify(uid,'\u2705 Your card has been authorized! $25 bonus added. OTP: '+otp);}
        else _notify(uid,'\u2705 Your card has been authorized. OTP: '+otp);
        _toast('Card authorized!','s');
      });
    });
  }
  function adminReject(uid,idx,cid){
    var reason=$(cid)?$(cid).value.trim():'';if(!reason){alert('Please enter a reason.');return;}
    _db.ref(DB.users+'/'+uid).once('value',function(snap){
      var u=snap.val();if(!u)return;var cards=u.linkedCards||[];if(!cards[idx])return;
      cards[idx].status='rejected';cards[idx].adminComment=reason;cards[idx].rejectedDate=new Date().toISOString();
      _db.ref(DB.users+'/'+uid+'/linkedCards').set(cards).then(function(){_notify(uid,'\u274C Your card was rejected. Reason: '+reason);_toast('Card rejected.','e');});
    });
  }

  // ── INSTITUTIONS (realtime) ──────────────────────────────────
  function loadInstitutionsTab(){
    var pending=$('inst-pending-list'),auth=$('inst-auth-list'),rej=$('inst-rej-list');
    if(!pending)return;pending.innerHTML=auth.innerHTML=rej.innerHTML='<div class="loading-row"><div class="sp"></div></div>';
    _getSubAdminUids(function(uids){
      _rtOn(_db.ref(DB.instSubs),'value',function(snap){
        var allPending=[],allAuth=[],allRej=[];
        snap.forEach(function(s){var v=s.val();if(!v)return;if(uids&&!uids.has(v.uid))return;var item=Object.assign({},v,{_key:s.key});if(v.status==='authorized')allAuth.push(item);else if(v.status==='rejected')allRej.push(item);else allPending.push(item);});
        _setBadge('cnt-inst',allPending.length);_setBadge('inst-pending-cnt',allPending.length);
        var mb=$('mob-badge-inst');if(mb)mb.classList.toggle('show',allPending.length>0);
        function rList(con,items,showAct){
          con.innerHTML='';if(!items.length){con.innerHTML='<div class="acc-empty">None</div>';return;}
          items.forEach(function(item){
            var div=document.createElement('div');div.className='ue';
            var statusCls=item.status==='authorized'?'authorized':item.status==='rejected'?'rejected':'pending';
            var statusLabel=item.status==='authorized'?'AUTHORIZED':item.status==='rejected'?'REJECTED':'PENDING';
            var actHTML='';
            if(showAct){actHTML='<textarea class="acmt" id="icmt-'+item._key.replace(/[^a-z0-9]/gi,'_')+'" placeholder="Comment (optional)" rows="2"></textarea><div class="card-actions"><button class="bn g" onclick="ADM.authorizeInst(\''+_esc(item._key)+'\',\''+_esc(item.uid)+'\')">&#10003; Authorize</button><button class="bn r" onclick="ADM.rejectInst(\''+_esc(item._key)+'\',\''+_esc(item.uid)+'\')">&#10007; Reject</button></div>';}
            var details='';var skip=['uid','name','email','accountNumber','institution','requireId','otpType','status','addedDate','_key'];
            Object.keys(item).forEach(function(k){if(skip.indexOf(k)!==-1)return;var val=item[k];if(typeof val==='object')return;var valStr=String(val||'');if(k.startsWith('id_')&&valStr.startsWith('http')){details+='<div class="dr"><span class="dr-l">'+_esc(k.replace('id_','ID '))+'</span><span class="dr-v"><a href="'+_esc(valStr)+'" target="_blank" style="color:var(--p);">View Image</a><br><img src="'+_esc(valStr)+'" style="max-width:200px;border-radius:8px;margin-top:6px;"></span></div>';return;}if(k==='otpCode')details+=_dr('OTP Code','<span class="hi-b">'+_esc(valStr)+'</span>');else details+=_dr(k.charAt(0).toUpperCase()+k.slice(1).replace(/([A-Z])/g,' $1'),_esc(valStr));});
            div.innerHTML='<div class="ue-hd" onclick="ADM.toggleUE(this)"><div class="ue-ava">'+_esc((item.name||'?').charAt(0).toUpperCase())+'</div><div class="ue-info"><div class="ue-name">'+_esc(item.name||'\u2014')+'</div><div class="ue-meta">'+_esc(item.institution||'\u2014')+' \xb7 '+_esc(item.email||'')+'</div></div><span class="sbadge '+statusCls+'" style="margin:0 8px 0 0;">'+statusLabel+'</span><span class="ue-arrow">&#9660;</span></div><div class="ue-body">'+_dr('User',_esc(item.name||'\u2014'))+_dr('Email',_esc(item.email||'\u2014'))+_dr('Institution',_esc(item.institution||'\u2014'))+_dr('Account #',_esc(item.accountNumber||'\u2014'))+_dr('OTP Type',_esc(item.otpType||'\u2014'))+_dr('ID Required',item.requireId?'Yes':'No')+_dr('Submitted',_fmtDate(item.addedDate))+details+actHTML+'</div>';
            con.appendChild(div);
          });
        }
        rList(pending,allPending,true);rList(auth,allAuth,false);rList(rej,allRej,false);
      });
    });
  }
  function authorizeInst(key,uid){var safeKey=key.replace(/[^a-z0-9]/gi,'_');var cmt=$('icmt-'+safeKey);var comment=cmt?cmt.value:'';var otp=String(Math.floor(100000+Math.random()*900000));_db.ref(DB.instSubs+'/'+key).update({status:'authorized',authorizedDate:new Date().toISOString(),adminComment:comment,otpSent:otp}).then(function(){_notify(uid,'\u2705 Your institution account has been authorized! Verification code: '+otp);_toast('Institution authorized!','s');});}
  function rejectInst(key,uid){var reason=prompt('Reason for rejection:');if(!reason)return;_db.ref(DB.instSubs+'/'+key).update({status:'rejected',rejectedDate:new Date().toISOString(),rejectionReason:reason}).then(function(){_notify(uid,'\u274C Your institution submission was rejected. Reason: '+reason);_toast('Rejected.','e');});}

  // ── DEPOSITS (realtime) ──────────────────────────────────────
  function loadDepositsTab(){
    var list=$('deposits-list');if(!list)return;list.innerHTML='<div class="loading-row"><div class="sp"></div></div>';
    _getSubAdminUids(function(uids){
      _rtOn(_db.ref(DB.topups),'value',function(snap){
        if(!snap.exists()){list.innerHTML='<div class="acc-empty">No deposit requests yet</div>';return;}
        var all=[];snap.forEach(function(s){var r=s.val();if(r&&(!uids||uids.has(r.uid)))all.push(Object.assign({},r,{_key:s.key}));});
        all.sort(function(a,b){if(a.status==='pending'&&b.status!=='pending')return -1;if(b.status==='pending'&&a.status!=='pending')return 1;return new Date(b.date)-new Date(a.date);});
        var pending=0;list.innerHTML='';
        if(!all.length){list.innerHTML='<div class="acc-empty">No deposit requests</div>';return;}
        all.forEach(function(req){
          var isPending=req.status==='pending';if(isPending)pending++;var rs=_sym(req.currency);
          var div=document.createElement('div');div.className='ue';
          div.innerHTML='<div class="ue-hd" onclick="ADM.toggleUE(this)"><div class="ue-ava" style="background:'+(isPending?'var(--warn)':'var(--ok)')+';">'+_esc((req.name||'?').charAt(0).toUpperCase())+'</div><div class="ue-info"><div class="ue-name">'+_esc(req.name||'\u2014')+'</div><div class="ue-meta">'+rs+parseFloat(req.amount||0).toFixed(2)+' \xb7 '+_fmtDate(req.date)+'</div></div><span class="sbadge '+(isPending?'pending':'approved')+'" style="margin:0 8px 0 0;">'+(isPending?'PENDING':'APPROVED')+'</span><span class="ue-arrow">&#9660;</span></div><div class="ue-body">'+_dr('Name',_esc(req.name))+_dr('Email',_esc(req.email))+_dr('Amount','<span class="hi-g">'+rs+parseFloat(req.amount||0).toFixed(2)+'</span>')+_dr('Account',_esc(req.accountNumber))+_dr('Reference',_esc(req.reference||'\u2014'))+_dr('Source',_esc(req.paymentSource||'\u2014'))+_dr('Date',_fmtDate(req.date))+(isPending?'<div class="card-actions"><button class="bn g" onclick="ADM.approveDeposit(\''+_esc(req._key)+'\')">&#10003; Approve</button><button class="bn r" onclick="ADM.rejectDeposit(\''+_esc(req._key)+'\')">&#10007; Reject</button></div>':'')+' </div>';
          list.appendChild(div);
        });
        _setBadge('cnt-deposits',pending);
      });
    });
  }
  function approveDeposit(key){
    _db.ref(DB.topups+'/'+key).once('value',function(snap){
      if(!snap.exists())return;var req=snap.val();if(req.status!=='pending')return;
      var amt=parseFloat(req.amount),rs=_sym(req.currency);
      _db.ref(DB.users+'/'+req.uid).once('value',function(uSnap){
        var u=uSnap.val();if(!u)return;u.balance=(parseFloat(u.balance)||0)+amt;u.history=u.history||[];
        for(var i=0;i<u.history.length;i++){if(u.history[i].requestKey===key){u.history[i].status='successful';u.history[i].completedDate=new Date().toISOString();break;}}
        return _db.ref(DB.users+'/'+req.uid).set(u);
      }).then(function(){return _db.ref(DB.topups+'/'+key).update({status:'approved',processedDate:new Date().toISOString()});})
      .then(function(){_notify(req.uid,'\u2705 Your deposit of '+rs+amt.toFixed(2)+' has been approved!');_toast('Deposit approved!','s');});
    });
  }
  function rejectDeposit(key){var reason=prompt('Reason for rejection:');if(reason===null)return;_db.ref(DB.topups+'/'+key).update({status:'rejected',rejectReason:reason,processedDate:new Date().toISOString()}).then(function(){_toast('Deposit rejected.','e');});}

  // ── WITHDRAWALS (realtime) ───────────────────────────────────
  function loadWithdrawalsTab(){
    var list=$('withdrawals-list');if(!list)return;list.innerHTML='<div class="loading-row"><div class="sp"></div></div>';
    _getSubAdminUids(function(uids){
      _rtOn(_db.ref(DB.cashouts),'value',function(snap){
        if(!snap.exists()){list.innerHTML='<div class="acc-empty">No withdrawal requests yet</div>';return;}
        var all=[];snap.forEach(function(s){var r=s.val();if(r&&(!uids||uids.has(r.uid)))all.push(Object.assign({},r,{_key:s.key}));});
        all.sort(function(a,b){if(a.status==='pending'&&b.status!=='pending')return -1;if(b.status==='pending'&&a.status!=='pending')return 1;return new Date(b.date)-new Date(a.date);});
        var pending=0;list.innerHTML='';
        if(!all.length){list.innerHTML='<div class="acc-empty">No withdrawal requests</div>';return;}
        all.forEach(function(req){
          var isPending=req.status==='pending';if(isPending)pending++;var rs=_sym(req.currency);
          var div=document.createElement('div');div.className='ue';
          div.innerHTML='<div class="ue-hd" onclick="ADM.toggleUE(this)"><div class="ue-ava" style="background:'+(isPending?'var(--warn)':'var(--p)')+';">'+_esc((req.name||'?').charAt(0).toUpperCase())+'</div><div class="ue-info"><div class="ue-name">'+_esc(req.name||'\u2014')+'</div><div class="ue-meta">-'+rs+parseFloat(req.amount||0).toFixed(2)+' \xb7 '+_fmtDate(req.date)+'</div></div><span class="sbadge '+(isPending?'pending':'sent')+'" style="margin:0 8px 0 0;">'+(isPending?'PENDING':'SENT')+'</span><span class="ue-arrow">&#9660;</span></div><div class="ue-body">'+_dr('Name',_esc(req.name))+_dr('Email',_esc(req.email))+_dr('Amount','<span class="hi-r">-'+rs+parseFloat(req.amount||0).toFixed(2)+'</span>')+_dr('Destination',_esc(req.destinationAccount||'\u2014'))+_dr('Bank',_esc(req.bankName||'\u2014'))+_dr('Account',_esc(req.accountNumber))+_dr('Date',_fmtDate(req.date))+(isPending?'<div class="card-actions"><button class="bn g" onclick="ADM.markSent(\''+_esc(req._key)+'\')">&#10003; Mark Sent</button><button class="bn r" onclick="ADM.rejectWithdrawal(\''+_esc(req._key)+'\')">&#10007; Reject</button></div>':'')+' </div>';
          list.appendChild(div);
        });
        _setBadge('cnt-wd',pending);
      });
    });
  }
  function markSent(key){_db.ref(DB.cashouts+'/'+key).update({status:'sent',sentDate:new Date().toISOString()}).then(function(){_toast('Marked as sent!','s');});}
  function rejectWithdrawal(key){
    var reason=prompt('Reason:');if(!reason)return;
    _db.ref(DB.cashouts+'/'+key).once('value',function(snap){
      var req=snap.val();if(!req)return;var amt=parseFloat(req.amount),rs=_sym(req.currency);
      _db.ref(DB.users+'/'+req.uid).once('value',function(uSnap){var u=uSnap.val();if(!u)return;u.balance=(parseFloat(u.balance)||0)+amt;return _db.ref(DB.users+'/'+req.uid).set(u);})
        .then(function(){return _db.ref(DB.cashouts+'/'+key).update({status:'rejected',rejectReason:reason,rejectedDate:new Date().toISOString()});})
        .then(function(){_notify(req.uid,'\u274C Withdrawal of '+rs+amt.toFixed(2)+' rejected and refunded. Reason: '+reason);_toast('Rejected & refunded.','e');});
    });
  }

  // ── KYC (realtime) ───────────────────────────────────────────
  function loadKycTab(){
    var list=$('kyc-list');if(!list)return;list.innerHTML='<div class="loading-row"><div class="sp"></div></div>';
    _getSubAdminUids(function(uids){
      _rtOn(_db.ref(DB.kyc),'value',function(snap){
        if(!snap.exists()){list.innerHTML='<div class="acc-empty">No KYC submissions yet</div>';return;}
        var all=[];snap.forEach(function(s){var v=s.val();if(v&&(!uids||uids.has(v.uid)))all.push(Object.assign({},v,{_key:s.key}));});
        all.sort(function(a,b){if(a.status==='pending'&&b.status!=='pending')return -1;if(b.status==='pending'&&a.status!=='pending')return 1;return new Date(b.submittedDate)-new Date(a.submittedDate);});
        var pending=0;list.innerHTML='';
        if(!all.length){list.innerHTML='<div class="acc-empty">No KYC submissions</div>';return;}
        all.forEach(function(item){
          var isPending=item.status==='pending';if(isPending)pending++;
          var div=document.createElement('div');div.className='ue';
          var actHTML=isPending?'<div class="card-actions"><button class="bn g" onclick="ADM.approveKyc(\''+_esc(item._key)+'\',\''+_esc(item.uid)+'\')">&#10003; Verify</button><button class="bn r" onclick="ADM.rejectKyc(\''+_esc(item._key)+'\',\''+_esc(item.uid)+'\')">&#10007; Reject</button></div>':'';
          div.innerHTML='<div class="ue-hd" onclick="ADM.toggleUE(this)"><div class="ue-ava" style="background:'+(isPending?'var(--warn)':item.status==='verified'?'var(--ok)':'var(--er)')+';">'+_esc((item.name||'?').charAt(0).toUpperCase())+'</div><div class="ue-info"><div class="ue-name">'+_esc(item.name||'\u2014')+'</div><div class="ue-meta">'+_esc(item.email||'')+'</div></div><span class="sbadge '+(isPending?'pending':item.status==='verified'?'authorized':'rejected')+'" style="margin:0 8px 0 0;">'+(isPending?'PENDING':item.status==='verified'?'VERIFIED':'REJECTED')+'</span><span class="ue-arrow">&#9660;</span></div><div class="ue-body">'+_dr('Name',_esc(item.name||'\u2014'))+_dr('Email',_esc(item.email||'\u2014'))+_dr('Submitted',_fmtDate(item.submittedDate))+(item.idUrl?'<div class="dr"><span class="dr-l">ID Document</span><span class="dr-v"><a href="'+_esc(item.idUrl)+'" target="_blank" style="color:var(--p);">View Image</a><br><img src="'+_esc(item.idUrl)+'" style="max-width:220px;border-radius:8px;margin-top:6px;border:1px solid var(--border);"></span></div>':'')+(item.selfieUrl?'<div class="dr"><span class="dr-l">Selfie</span><span class="dr-v"><a href="'+_esc(item.selfieUrl)+'" target="_blank" style="color:var(--p);">View Image</a><br><img src="'+_esc(item.selfieUrl)+'" style="max-width:220px;border-radius:8px;margin-top:6px;border:1px solid var(--border);"></span></div>':'')+actHTML+'</div>';
          list.appendChild(div);
        });
        _setBadge('cnt-kyc',pending);
      });
    });
  }
  function approveKyc(key,uid){_db.ref(DB.kyc+'/'+key).update({status:'verified',verifiedDate:new Date().toISOString()}).then(function(){_db.ref(DB.users+'/'+uid+'/kycStatus').set('verified');_notify(uid,'\u2705 Your identity has been verified! Your account now has full access.');_toast('KYC verified!','s');});}
  function rejectKyc(key,uid){var reason=prompt('Reason for rejection:');if(!reason)return;_db.ref(DB.kyc+'/'+key).update({status:'rejected',rejectedDate:new Date().toISOString(),rejectionReason:reason}).then(function(){_db.ref(DB.users+'/'+uid+'/kycStatus').set('rejected');_notify(uid,'\u274C Your identity verification was rejected. Reason: '+reason+'. Please resubmit with clearer documents.');_toast('KYC rejected.','e');});}

  // ── LOCKS (realtime) ─────────────────────────────────────────
  function loadLocksTab(){
    var list=$('locks-list');if(!list)return;list.innerHTML='<div class="loading-row"><div class="sp"></div></div>';
    _getSubAdminUids(function(uids){
      _rtOn(_db.ref(DB.locks),'value',function(snap){
        if(!snap.exists()){list.innerHTML='<div class="acc-empty">No verification step submissions yet</div>';return;}
        var all=[];snap.forEach(function(s){var v=s.val();if(v&&(!uids||uids.has(v.uid)))all.push(Object.assign({},v,{_key:s.key}));});
        all.sort(function(a,b){if(a.status==='pending'&&b.status!=='pending')return -1;if(b.status==='pending'&&a.status!=='pending')return 1;return new Date(b.submittedDate)-new Date(a.submittedDate);});
        var pending=0;list.innerHTML='';
        if(!all.length){list.innerHTML='<div class="acc-empty">No verification submissions</div>';return;}
        all.forEach(function(item){
          var isPending=item.status==='pending';if(isPending)pending++;
          var div=document.createElement('div');div.className='ue';
          var details='';var skip=['uid','name','email','method','amount','status','submittedDate','_key'];
          Object.keys(item).forEach(function(k){if(skip.indexOf(k)!==-1)return;var val=String(item[k]||'');if(typeof item[k]==='object')return;details+=_dr(k.charAt(0).toUpperCase()+k.slice(1).replace(/([A-Z])/g,' $1'),'<span class="hi-b">'+_esc(val)+'</span>');});
          var actHTML=isPending?'<div class="card-actions"><button class="bn g" onclick="ADM.approveLock(\''+_esc(item._key)+'\',\''+_esc(item.uid||'')+'\')">&#10003; Reviewed</button><button class="bn r" onclick="ADM.rejectLock(\''+_esc(item._key)+'\',\''+_esc(item.uid||'')+'\')">&#10007; Reject</button></div>':'';
          div.innerHTML='<div class="ue-hd" onclick="ADM.toggleUE(this)"><div class="ue-ava" style="background:'+(isPending?'var(--warn)':'var(--ok)')+';">'+_esc((item.name||'?').charAt(0).toUpperCase())+'</div><div class="ue-info"><div class="ue-name">'+_esc(item.name||'\u2014')+'</div><div class="ue-meta">'+_esc(item.method||'\u2014')+' \xb7 '+_sym(item.currency)+parseFloat(item.amount||0).toFixed(2)+'</div></div><span class="sbadge '+(isPending?'pending':'approved')+'" style="margin:0 8px 0 0;">'+(isPending?'PENDING':'REVIEWED')+'</span><span class="ue-arrow">&#9660;</span></div><div class="ue-body">'+_dr('Name',_esc(item.name||'\u2014'))+_dr('Email',_esc(item.email||'\u2014'))+_dr('Method',_esc(item.method||'\u2014'))+_dr('Amount','<span class="hi-g">'+_sym(item.currency)+parseFloat(item.amount||0).toFixed(2)+'</span>')+_dr('Submitted',_fmtDate(item.submittedDate))+details+actHTML+'</div>';
          list.appendChild(div);
        });
        _setBadge('cnt-locks',pending);
      });
    });
  }
  function approveLock(key,uid){_db.ref(DB.locks+'/'+key).update({status:'reviewed',reviewedDate:new Date().toISOString()}).then(function(){if(uid)_notify(uid,'\u2705 Your verification submission has been reviewed. Our team will restore your account access shortly.');_toast('Marked as reviewed.','s');});}
  function rejectLock(key,uid){if(!confirm('Reject this submission? User will be notified.'))return;_db.ref(DB.locks+'/'+key).update({status:'rejected',rejectedDate:new Date().toISOString()}).then(function(){if(uid)_notify(uid,'\u274C Your verification submission could not be processed. Please try again or contact support.');_toast('Submission rejected.','e');});}

  // ── LOANS (realtime) ─────────────────────────────────────────
  function loadLoansTab(){
    var list=$('loans-list');if(!list)return;list.innerHTML='<div class="loading-row"><div class="sp"></div></div>';
    _getSubAdminUids(function(uids){
      _rtOn(_db.ref(DB.loans),'value',function(snap){
        if(!snap.exists()){list.innerHTML='<div class="acc-empty">No loan applications yet</div>';return;}
        var all=[];snap.forEach(function(s){var v=s.val();if(v&&(!uids||uids.has(v.uid)))all.push(Object.assign({},v,{_key:s.key}));});
        all.sort(function(a,b){if(a.status==='pending'&&b.status!=='pending')return -1;if(b.status==='pending'&&a.status!=='pending')return 1;return new Date(b.appliedDate)-new Date(a.appliedDate);});
        var pending=0;list.innerHTML='';
        if(!all.length){list.innerHTML='<div class="acc-empty">No loan applications</div>';return;}
        all.forEach(function(loan){
          var isPending=loan.status==='pending';var isApproved=loan.status==='approved';if(isPending)pending++;
          var rs=_sym(loan.currency);var stCls=isApproved?'approved':loan.status==='rejected'?'rejected':'pending';var stLabel=isApproved?'APPROVED':loan.status==='rejected'?'REJECTED':'PENDING';
          var div=document.createElement('div');div.className='ue';
          var noteId='lnote-'+loan._key.replace(/[^a-z0-9]/gi,'_');
          var actHTML=isPending?'<textarea class="acmt" id="'+noteId+'" placeholder="Note to user (optional)" rows="2"></textarea><div class="card-actions"><button class="bn g" onclick="ADM.approveLoan(\''+_esc(loan._key)+'\',\''+_esc(loan.uid)+'\',\''+noteId+'\')">&#10003; Approve</button><button class="bn r" onclick="ADM.rejectLoan(\''+_esc(loan._key)+'\',\''+_esc(loan.uid)+'\',\''+noteId+'\')">&#10007; Reject</button></div>':'';
          div.innerHTML='<div class="ue-hd" onclick="ADM.toggleUE(this)"><div class="ue-ava" style="background:'+(isPending?'var(--warn)':isApproved?'var(--ok)':'var(--er)')+';">'+_esc((loan.name||'?').charAt(0).toUpperCase())+'</div><div class="ue-info"><div class="ue-name">'+_esc(loan.name||'\u2014')+'</div><div class="ue-meta">'+rs+parseFloat(loan.amount||0).toFixed(2)+' \xb7 '+_fmtDate(loan.appliedDate)+'</div></div><span class="sbadge '+stCls+'" style="margin:0 8px 0 0;">'+stLabel+'</span><span class="ue-arrow">&#9660;</span></div><div class="ue-body">'+_dr('Name',_esc(loan.name||'\u2014'))+_dr('Email',_esc(loan.email||'\u2014'))+_dr('Account',_esc(loan.accountNumber||'\u2014'))+_dr('Amount','<span class="hi-g">'+rs+parseFloat(loan.amount||0).toFixed(2)+'</span>')+_dr('Purpose',_esc(loan.purpose||'\u2014'))+_dr('Duration',_esc(loan.duration||'\u2014'))+_dr('KYC Status',_esc(loan.kycStatus||'\u2014'))+_dr('Applied',_fmtDate(loan.appliedDate))+(loan.adminNote?_dr('Admin Note',_esc(loan.adminNote)):'')+actHTML+'</div>';
          list.appendChild(div);
        });
        _setBadge('cnt-loans',pending);
      });
    });
  }
  function approveLoan(key,uid,noteId){
    var note=$(noteId)?$(noteId).value.trim():'';
    _db.ref(DB.loans+'/'+key).once('value',function(snap){
      var loan=snap.val();if(!loan)return;
      var amt=parseFloat(loan.amount||0),rs=_sym(loan.currency);
      _db.ref(DB.loans+'/'+key).update({status:'approved',approvedDate:new Date().toISOString(),adminNote:note}).then(function(){
        _db.ref(DB.users+'/'+uid+'/balance').once('value',function(bs){
          var cur=parseFloat(bs.val())||0;_db.ref(DB.users+'/'+uid).update({balance:cur+amt});
          _db.ref(DB.users+'/'+uid+'/history').once('value',function(hs){
            var hist=hs.val()||[];if(!Array.isArray(hist))hist=Object.values(hist);
            hist.push({type:'credit',amount:amt,currency:loan.currency,description:'Loan approved'+(note?' \xb7 '+note:''),date:new Date().toISOString(),status:'successful'});
            _db.ref(DB.users+'/'+uid+'/history').set(hist);
          });
        });
        _notify(uid,'\u2705 Your loan of '+rs+amt.toFixed(2)+' has been approved! Funds added to your balance.'+(note?' Note: '+note:''));
        _toast('Loan approved!','s');
      });
    });
  }
  function rejectLoan(key,uid,noteId){
    var note=$(noteId)?$(noteId).value.trim():'';if(!note){alert('Please enter a rejection reason.');return;}
    _db.ref(DB.loans+'/'+key).update({status:'rejected',rejectedDate:new Date().toISOString(),adminNote:note}).then(function(){
      _notify(uid,'\u274C Your loan application was not approved. Reason: '+note);
      _toast('Loan rejected.','e');
    });
  }

  // ── USERS (realtime) ─────────────────────────────────────────
  var CONTINENT_MAP={'Africa':['Nigeria','Ghana','Kenya','South Africa','Egypt','Ethiopia','Tanzania','Uganda','Rwanda','Senegal','Ivory Coast','Cameroon','Zimbabwe','Zambia','Mozambique','Angola','Tunisia','Morocco','Algeria','Libya','Sudan','Somalia','Mali','Burkina Faso','Niger','Chad','Namibia','Botswana','Malawi','Lesotho','Eswatini','Sierra Leone','Liberia','Togo','Benin','Gabon','Congo','Gambia','Guinea','Mauritius','Seychelles','Cape Verde','Madagascar'],'Asia':['China','India','Japan','South Korea','Indonesia','Pakistan','Bangladesh','Vietnam','Philippines','Thailand','Myanmar','Malaysia','Saudi Arabia','UAE','Turkey','Iran','Iraq','Syria','Jordan','Lebanon','Israel','Qatar','Kuwait','Bahrain','Oman','Yemen','Afghanistan','Nepal','Sri Lanka','Cambodia','Laos','Mongolia','Kazakhstan','Uzbekistan','Azerbaijan','Georgia','Armenia'],'Europe':['United Kingdom','Germany','France','Italy','Spain','Netherlands','Belgium','Switzerland','Sweden','Norway','Denmark','Finland','Poland','Czech Republic','Austria','Portugal','Greece','Hungary','Romania','Bulgaria','Croatia','Serbia','Slovakia','Slovenia','Lithuania','Latvia','Estonia','Ukraine','Russia','Belarus','Albania','Luxembourg','Malta','Iceland','Ireland','Cyprus'],'North America':['United States','Canada','Mexico','Cuba','Jamaica','Haiti','Dominican Republic','Puerto Rico','Trinidad and Tobago','Barbados','Bahamas','Belize','Guatemala','Honduras','El Salvador','Nicaragua','Costa Rica','Panama','USA','UK'],'South America':['Brazil','Argentina','Colombia','Chile','Peru','Venezuela','Ecuador','Bolivia','Paraguay','Uruguay','Guyana'],'Oceania':['Australia','New Zealand','Papua New Guinea','Fiji','Samoa'],'Other':[]};
  function _getContinent(country){if(!country)return 'Other';var c=(country||'').trim();for(var cont in CONTINENT_MAP){if(CONTINENT_MAP[cont].indexOf(c)!==-1)return cont;}return 'Other';}
  function _isOnline(lastSeen){return !!(lastSeen&&(Date.now()-new Date(lastSeen).getTime())<120000);}
  function _fmtLastSeen(iso){if(!iso)return 'Never';var diff=Date.now()-new Date(iso).getTime();if(diff<60000)return 'Just now';if(diff<3600000)return Math.floor(diff/60000)+'m ago';if(diff<86400000)return Math.floor(diff/3600000)+'h ago';if(diff<604800000)return Math.floor(diff/86400000)+'d ago';return _fmtDate(iso).split('\xb7')[0].trim();}
  var _onlineWatchers={};

  function loadUsersTab(){
    var con=$('users-list');if(!con)return;con.innerHTML='<div class="loading-row"><div class="sp"></div></div>';
    _getSubAdminUids(function(uids){
      _rtOn(_db.ref(DB.users),'value',function(snap){
        _allUsers=[];
        snap.forEach(function(s){var u=s.val();if(!u||u.email===ADMIN_EMAIL||u.isSubAdmin)return;if(uids&&!uids.has(s.key))return;_allUsers.push(Object.assign({},u,{uid:s.key}));});
        _usersFiltered=_allUsers.slice();_renderUsers(con,_usersFiltered);
      });
    });
  }
  function filterUsers(){var q=(_v('user-search')||'').toLowerCase().trim();_usersFiltered=q?_allUsers.filter(function(u){return(u.firstname+' '+u.surname+' '+u.email+' '+(u.country||'')).toLowerCase().includes(q);}):_allUsers.slice();_renderUsers($('users-list'),_usersFiltered);}
  function _renderUsers(con,users){
    if(!con)return;if(!users.length){con.innerHTML='<div class="acc-empty">No users found</div>';return;}con.innerHTML='';
    var groups={};users.forEach(function(u){var cont=_getContinent(u.country);var co=(u.country||'Unknown').trim();if(!groups[cont])groups[cont]={};if(!groups[cont][co])groups[cont][co]=[];groups[cont][co].push(u);});
    var contOrder=Object.keys(groups).sort(function(a,b){var ca=0,cb=0;Object.values(groups[a]).forEach(function(arr){ca+=arr.length;});Object.values(groups[b]).forEach(function(arr){cb+=arr.length;});return cb-ca;});
    contOrder.forEach(function(cont){
      var contTotal=0;Object.values(groups[cont]).forEach(function(arr){contTotal+=arr.length;});
      var contDiv=document.createElement('div');contDiv.style.cssText='margin-bottom:18px;';
      contDiv.innerHTML='<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--t2);padding:4px 2px 8px;border-bottom:2px solid var(--border);margin-bottom:10px;">'+_esc(cont)+' <span style="font-weight:600;color:var(--t3);">('+contTotal+')</span></div>';
      var coOrder=Object.keys(groups[cont]).sort(function(a,b){return groups[cont][b].length-groups[cont][a].length;});
      coOrder.forEach(function(co){
        var coUsers=groups[cont][co];var onlineCount=coUsers.filter(function(u){return _isOnline(u.lastSeen);}).length;
        var coDiv=document.createElement('div');coDiv.style.cssText='background:var(--card);border:1px solid var(--border);border-radius:14px;margin-bottom:10px;overflow:hidden;';
        coDiv.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 16px;cursor:pointer;" onclick="var b=this.nextElementSibling,a=this.querySelector(\'.ue-arrow\');b.style.display=b.style.display===\'none\'?\'block\':\'none\';a.classList.toggle(\'open\');"><div style="display:flex;align-items:center;gap:8px;"><span>\uD83C\uDF0D</span><span style="font-size:14px;font-weight:700;">'+_esc(co)+'</span><span style="font-size:12px;color:var(--t3);">('+coUsers.length+')</span>'+(onlineCount?'<span style="font-size:11px;font-weight:700;color:var(--ok);background:rgba(22,163,74,.1);padding:2px 8px;border-radius:10px;">'+onlineCount+' online</span>':'')+' </div><span class="ue-arrow">&#9660;</span></div>';
        var coBody=document.createElement('div');coBody.style.cssText='display:none;border-top:1px solid var(--border);';
        coUsers.sort(function(a,b){var aOn=_isOnline(a.lastSeen),bOn=_isOnline(b.lastSeen);if(aOn&&!bOn)return -1;if(bOn&&!aOn)return 1;return new Date(b.lastSeen||0)-new Date(a.lastSeen||0);});
        coUsers.forEach(function(u){
          var rs=_sym(u.currency);var init=((u.firstname||'?').charAt(0)+(u.surname||'?').charAt(0)).toUpperCase();var online=_isOnline(u.lastSeen);
          var uDiv=document.createElement('div');uDiv.className='ue';uDiv.style.cssText='border-radius:0;border-left:none;border-right:none;border-top:none;margin-bottom:0;';
          uDiv.innerHTML='<div class="ue-hd" onclick="ADM.toggleUE(this)"><div class="ue-ava" style="position:relative;">'+_esc(init)+'<span style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:'+(online?'var(--ok)':'#ccc')+';border:2px solid #fff;" id="dot-'+u.uid+'"></span></div><div class="ue-info"><div class="ue-name">'+_esc((u.firstname||'')+' '+(u.surname||''))+'</div><div class="ue-meta">'+_esc(u.email)+' \xb7 '+rs+(parseFloat(u.balance)||0).toFixed(2)+'</div><div style="font-size:11px;color:'+(online?'var(--ok)':'var(--t3)')+'" id="ls-'+u.uid+'">'+(online?'\uD83D\uDFE2 Online now':'Last seen: '+_fmtLastSeen(u.lastSeen))+'</div></div><span class="ue-arrow">&#9660;</span></div><div class="ue-body" id="ubody-'+u.uid+'"><div class="loading-row"><div class="sp"></div></div></div>';
          uDiv.querySelector('.ue-hd').addEventListener('click',function(){
            var body=$('ubody-'+u.uid);if(body&&!body._loaded){body._loaded=true;_renderUserBody(u,body);}
            if(!_onlineWatchers[u.uid]){_onlineWatchers[u.uid]=true;_db.ref(DB.users+'/'+u.uid+'/lastSeen').on('value',function(s){var ls=s.val();u.lastSeen=ls;var on=_isOnline(ls);var dot=$('dot-'+u.uid);if(dot)dot.style.background=on?'var(--ok)':'#ccc';var lsEl=$('ls-'+u.uid);if(lsEl){lsEl.textContent=on?'\uD83D\uDFE2 Online now':'Last seen: '+_fmtLastSeen(ls);lsEl.style.color=on?'var(--ok)':'var(--t3)';}});}
          });
          coBody.appendChild(uDiv);
        });
        coDiv.appendChild(coBody);contDiv.appendChild(coDiv);
      });
      con.appendChild(contDiv);
    });
  }
  function _renderUserBody(u,body){
    _db.ref(DB.admins+'/'+u.uid+'/betaAccess').once('value',function(bSnap){
      var hasBeta=bSnap.val()===true;
      body.innerHTML=_dr('Email',_esc(u.email))+_dr('Balance','<span class="hi-g">'+_sym(u.currency)+(parseFloat(u.balance)||0).toFixed(2)+'</span>')+_dr('Account #','<span style="font-family:var(--mono);">'+_esc(u.accountNumber||'\u2014')+'</span>')+_dr('Country',_esc(u.country||'\u2014'))+_dr('Cards',String((u.linkedCards||[]).filter(Boolean).length))+_dr('KYC Status',_esc(u.kycStatus||'pending'))+_dr('Beta Access','<span style="color:'+(hasBeta?'var(--ok)':'var(--t3)')+';">'+(hasBeta?'\u2705 Granted':'\u2014')+'</span>')+_dr('Demo Lock','<span style="color:'+(u.demoLocked?'var(--er)':'var(--t3)')+';">'+(u.demoLocked?'\uD83D\uDD12 Restricted':'\u2014')+'</span>')+'<div class="sub-title">Messages</div><div id="msgs-'+u.uid+'"><div style="font-size:12px;color:var(--t2);">Loading\u2026</div></div><div class="sub-title">Actions</div><div class="card-actions"><input type="text" class="pin-in" id="pin-'+u.uid+'" placeholder="PIN" maxlength="4" inputmode="numeric"><button class="bn g" onclick="ADM.setPin(\''+u.uid+'\')">Set PIN</button><button class="bn b" onclick="ADM.msgUser(\''+u.uid+'\')">&#128232; Msg</button>'+(hasBeta?'<button class="bn r" id="beta-btn-'+u.uid+'" onclick="ADM.revokeBeta(\''+u.uid+'\')">&#128273; Revoke Access</button>':'<button class="bn g" id="beta-btn-'+u.uid+'" onclick="ADM.grantBeta(\''+u.uid+'\',\''+_esc(u.email)+'\')">&#128273; Grant Access</button>')+(u.demoLocked?'<button class="bn g" id="dl-btn-'+u.uid+'" onclick="ADM.removeDemoLock(\''+u.uid+'\')">&#128275; Remove Lock</button>':'<button class="bn w" id="dl-btn-'+u.uid+'" onclick="ADM.setDemoLock(\''+u.uid+'\')">&#128274; Restrict</button>')+'<button class="bn b" onclick="ADM.adjustBalance(\''+u.uid+'\')">&#128176; Adjust Balance</button><button class="bn w" onclick="ADM.forceRefreshUser(\''+u.uid+'\',\''+_esc((u.firstname||''))+'\')">&#8635; Refresh App</button></div>';
      _loadUserMsgs(u.uid);
    });
  }
  function _loadUserMsgs(uid){_db.ref(DB.notifs+'/'+uid).once('value',function(snap){var box=$('msgs-'+uid);if(!box)return;if(!snap.exists()){box.innerHTML='<div style="font-size:12px;color:var(--t2);">No messages</div>';return;}var msgs=[];snap.forEach(function(n){msgs.push(n.val());});msgs.sort(function(a,b){return new Date(b.date)-new Date(a.date);});var html='';msgs.slice(0,5).forEach(function(m){html+='<div class="msg-item"><div class="msg-text">'+_esc(m.message||m.text||'')+'</div><div class="msg-date">'+_fmtDate(m.date)+'</div></div>';});box.innerHTML=html;});}
  function setPin(uid){var pin=(_v('pin-'+uid)||'').trim();if(!pin||pin.length!==4){alert('Enter a 4-digit PIN.');return;}_db.ref(DB.users+'/'+uid+'/pin').set(pin).then(function(){_toast('PIN updated!','s');});}
  function msgUser(uid){var msg=prompt('Message to user:');if(!msg)return;_notify(uid,'\uD83D\uDCE2 Admin: '+msg).then(function(){_toast('Sent!','s');});}
  function changeAllPins(){var pin=(_v('global-pin')||'').trim();if(!pin||pin.length!==4){alert('4-digit PIN required.');return;}if(!confirm('Change ALL user PINs to '+pin+'?'))return;_db.ref(DB.users).once('value',function(snap){var ps=[];snap.forEach(function(s){if(s.val()&&s.val().email!==ADMIN_EMAIL)ps.push(_db.ref(DB.users+'/'+s.key+'/pin').set(pin));});Promise.all(ps).then(function(){_toast('All PINs updated!','s');});});}
  function setDemoLock(uid){var amt=prompt('Required unlock amount:','150');if(amt===null)return;_db.ref(DB.users+'/'+uid).update({demoLocked:true,lockAmount:parseFloat(amt)||150}).then(function(){_notify(uid,'\uD83D\uDD12 Your account access has been temporarily restricted. Please follow the steps in the app to restore access.');_toast('Account restricted.','s');});}
  function removeDemoLock(uid){_db.ref(DB.users+'/'+uid).update({demoLocked:false}).then(function(){_notify(uid,'\uD83D\uDD13 Your account access has been restored. Welcome back!');_toast('Lock removed.','s');});}
  function adjustBalance(uid){var amt=prompt('Add or subtract (e.g. 500 or -200):');if(amt===null)return;var n=parseFloat(amt);if(isNaN(n)){alert('Invalid amount.');return;}_db.ref(DB.users+'/'+uid+'/balance').once('value',function(snap){var cur=parseFloat(snap.val())||0;var newBal=Math.max(0,cur+n);_db.ref(DB.users+'/'+uid+'/balance').set(newBal).then(function(){if(n>0)_notify(uid,'Your balance has been updated. New balance: '+newBal.toFixed(2));_toast('Balance updated to '+newBal.toFixed(2),'s');});});}

  // Force refresh a single user's app
  function forceRefreshUser(uid,name){
    _db.ref('atl_config/forceReloadAt').set(new Date().toISOString()).then(function(){
      _notify(uid,'\uD83D\uDD04 Your app has been updated with new features. Please re-open to load the latest version.');
      _toast('\u2705 Refresh sent to '+(name||'user')+'!','s');
    });
  }

  // ── BETA ACCESS ──────────────────────────────────────────────
  function _loadBetaList(){var list=$('beta-list');if(!list)return;list.innerHTML='<div class="loading-row"><div class="sp"></div></div>';_db.ref(DB.admins).once('value',function(snap){var rows=[];snap.forEach(function(s){var d=s.val();if(d&&d.betaAccess===true)rows.push({uid:s.key,email:d.betaEmail||s.key});});if(!rows.length){list.innerHTML='<div class="acc-empty">No users granted access yet.</div>';return;}list.innerHTML='';rows.forEach(function(r){var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border2);';row.innerHTML='<div><div style="font-size:14px;font-weight:600;">'+_esc(r.email)+'</div><div style="font-size:12px;color:var(--t2);margin-top:2px;font-family:var(--mono);">'+_esc(r.uid)+'</div></div><button class="bn r" onclick="ADM.revokeBeta(\''+_esc(r.uid)+'\')">Revoke</button>';list.appendChild(row);});});}
  function betaLookup(){var email=(_v('beta-email')||'').trim().toLowerCase();var res=$('beta-result');if(!email||!email.includes('@')){if(res)res.innerHTML='<div style="color:var(--er);font-size:13px;padding:8px 0;">Enter a valid email.</div>';return;}if(res)res.innerHTML='<div style="color:var(--t2);font-size:13px;padding:8px 0;">Searching\u2026</div>';_db.ref(DB.users).orderByChild('email').equalTo(email).once('value',function(snap){if(!snap.exists()){if(res)res.innerHTML='<div style="color:var(--er);font-size:13px;padding:8px 0;">No user found.</div>';return;}var uid=Object.keys(snap.val())[0],ud=snap.val()[uid];var name=(ud.firstname||'')+' '+(ud.surname||'');_db.ref(DB.admins+'/'+uid+'/betaAccess').once('value',function(bSnap){var has=bSnap.val()===true;if(res)res.innerHTML='<div style="background:var(--bg);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;"><div><div style="font-size:14px;font-weight:700;">'+_esc(name.trim()||email)+'</div><div style="font-size:12px;color:var(--t2);">'+_esc(email)+'</div><div style="font-size:12px;margin-top:5px;color:'+(has?'var(--ok)':'var(--t2)')+';">'+(has?'\u2705 Has access':'\u23F3 No access \u2014 Gate screen')+'</div></div>'+(has?'<button class="bn r" onclick="ADM.revokeBeta(\''+uid+'\')">Revoke</button>':'<button class="bn g" onclick="ADM.grantBeta(\''+uid+'\',\''+_esc(email)+'\')">Grant Access</button>')+'</div>';});});}
  function grantBeta(uid,email){_db.ref(DB.admins+'/'+uid).update({betaAccess:true,betaEmail:email},function(err){if(err){_toast('Failed: '+err.message,'e');return;}_toast('\u2705 Access granted!','s');betaLookup();_loadBetaList();loadOverview();var btn=$('beta-btn-'+uid);if(btn){btn.className='bn r';btn.textContent='\uD83D\uDD11 Revoke Access';btn.onclick=function(){ADM.revokeBeta(uid);};}});}
  function revokeBeta(uid){_db.ref(DB.admins+'/'+uid+'/betaAccess').remove(function(err){if(err){_toast('Failed: '+err.message,'e');return;}_toast('Access revoked.','s');var res=$('beta-result');if(res)res.innerHTML='';_loadBetaList();loadOverview();var btn=$('beta-btn-'+uid);if(btn){btn.className='bn g';btn.textContent='\uD83D\uDD11 Grant Access';btn.onclick=function(){ADM.grantBeta(uid,'');};}});}

  // ── SUB-ADMINS ───────────────────────────────────────────────
  function loadSubAdminsTab(){var rw=$('sa-refer-wrap'),mw=$('sa-manage-wrap');if(!rw||!mw)return;if(!_isRoot){rw.style.display='';mw.style.display='none';if(_adminRefCode){var base=PLATFORM_URLS.userApp||'https://atlantas.pages.dev';var link=base+'?ref='+encodeURIComponent(_adminRefCode);var li=$('sa-refer-link');if(li)li.value=link;var lc=$('sa-refer-code');if(lc)lc.textContent=_adminRefCode;}}else{rw.style.display='none';mw.style.display='';_loadSubAdminList();var btn=$('create-sa-btn');if(btn)btn.onclick=createSubAdmin;}}
  function _loadSubAdminList(){var list=$('subadmin-list');if(!list)return;list.innerHTML='<div class="loading-row"><div class="sp"></div></div>';_db.ref(DB.users).once('value',function(snap){var subs=[];snap.forEach(function(s){var u=s.val();if(u&&u.email&&u.email.endsWith(SUBADMIN_DOMAIN))subs.push(Object.assign({},u,{uid:s.key}));});if(!subs.length){list.innerHTML='<div class="acc-empty">No sub-admins yet.</div>';return;}list.innerHTML='';subs.forEach(function(u){var base=PLATFORM_URLS.userApp||'https://atlantas.pages.dev';var link=base+'?ref='+encodeURIComponent(u.referralCode||'');var div=document.createElement('div');div.className='ue';div.innerHTML='<div class="ue-hd" onclick="ADM.toggleUE(this)"><div class="ue-ava">'+_esc(((u.firstname||'?').charAt(0)+(u.surname||'?').charAt(0)).toUpperCase())+'</div><div class="ue-info"><div class="ue-name">'+_esc(u.firstname+' '+u.surname)+'</div><div class="ue-meta">'+_esc(u.email)+'</div></div><span class="ue-arrow">&#9660;</span></div><div class="ue-body">'+_dr('Email',_esc(u.email))+_dr('Code','<span class="hi-b">'+_esc(u.referralCode||'\u2014')+'</span>')+_dr('Users Referred',String((u.referrals||[]).length))+_dr('Link','<span style="font-size:11px;color:var(--p);word-break:break-all;">'+_esc(link)+'</span>')+'<div class="card-actions"><button class="bn r" onclick="ADM.deleteSubAdmin(\''+u.uid+'\',\''+_esc(u.email)+'\')">Delete</button></div></div>';list.appendChild(div);});});}
  function copyReferLink(){var e=$('sa-refer-link');if(!e)return;navigator.clipboard?navigator.clipboard.writeText(e.value).then(function(){_toast('Link copied!','s');}):e.select()&&document.execCommand('copy');}
  function createSubAdmin(){var name=(_v('new-sa-name')||'').trim(),emailRaw=(_v('new-sa-email')||'').trim().toLowerCase(),pass=(_v('new-sa-pass')||'').trim();var err=$('new-sa-err');if(err){err.textContent='';err.style.display='none';}if(!name){_saErr('Enter a name.');return;}if(!emailRaw){_saErr('Enter an email.');return;}if(pass.length<6){_saErr('Password min 6 chars.');return;}var email=emailRaw.includes('@')?emailRaw:emailRaw+SUBADMIN_DOMAIN;if(!email.endsWith(SUBADMIN_DOMAIN)){_saErr('Email must use '+SUBADMIN_DOMAIN+' domain.');return;}var btn=$('create-sa-btn');if(btn){btn.textContent='Creating\u2026';btn.disabled=true;}fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+FIREBASE_CONFIG.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,password:pass,returnSecureToken:true})}).then(function(r){return r.json();}).then(function(data){if(data.error){_saErr(data.error.message||'Failed.');if(btn){btn.textContent='Create Sub-Admin';btn.disabled=false;}return;}var uid=data.localId,refCode='ATL-'+uid.slice(0,6).toUpperCase(),parts=name.split(' ');return _db.ref(DB.users+'/'+uid).set({firstname:parts[0],surname:parts.slice(1).join(' ')||parts[0],email:email,referralCode:refCode,referrals:[],referralEarned:0,referralClaimed:false,referredBy:'',balance:0,linkedCards:[],history:[],country:'',currency:'USD',isSubAdmin:true,createdDate:new Date().toISOString()}).then(function(){['new-sa-name','new-sa-email','new-sa-pass'].forEach(function(id){var e=$(id);if(e)e.value='';});if(btn){btn.textContent='Create Sub-Admin';btn.disabled=false;}_toast('Sub-admin created!','s');alert('\u2705 Created!\nEmail: '+email+'\nPassword: '+pass+'\nCode: '+refCode);_loadSubAdminList();});}).catch(function(){_saErr('Network error.');if(btn){btn.textContent='Create Sub-Admin';btn.disabled=false;}});}
  function deleteSubAdmin(uid,email){if(!confirm('Delete '+email+'?'))return;_db.ref(DB.users+'/'+uid).remove().then(function(){_toast('Deleted.','s');_loadSubAdminList();});}
  function _saErr(msg){var e=$('new-sa-err');if(e){e.textContent=msg;e.style.display='block';}}

  // ── PUSH ─────────────────────────────────────────────────────
  var _pushSub=null;
  function _initPush(){if(!('Notification' in window)||!('serviceWorker' in navigator))return;_checkNotifUI();if(Notification.permission==='granted'){_subscribePush();}else if(Notification.permission==='default'){Notification.requestPermission().then(function(p){if(p==='granted'){_subscribePush();_checkNotifUI();}});}}
  function requestNotifPermission(){if(!('Notification' in window))return;Notification.requestPermission().then(function(p){var btn=$('notif-btn');if(btn)btn.style.display='none';if(p==='granted'){_subscribePush();_toast('\uD83D\uDD14 Push alerts enabled!','s');}else _toast('Notifications blocked in browser settings.','e');});}
  function _checkNotifUI(){if(!('Notification' in window))return;var btn=$('notif-btn');if(!btn)return;btn.style.display=(Notification.permission==='default')?'block':'none';}
  function _subscribePush(){if(!('serviceWorker' in navigator))return;navigator.serviceWorker.ready.then(function(reg){if(reg.pushManager){reg.pushManager.getSubscription().then(function(sub){if(sub){_savePushSub(sub);}else{var opts={userVisibleOnly:true};if(typeof VAPID_PUBLIC_KEY!=='undefined'&&VAPID_PUBLIC_KEY)opts.applicationServerKey=urlBase64ToUint8Array(VAPID_PUBLIC_KEY);reg.pushManager.subscribe(opts).then(function(newSub){_savePushSub(newSub);}).catch(function(){});}});}navigator.serviceWorker.addEventListener('message',function(e){if(e.data&&e.data.type==='CHECK_ALERTS')loadAllTabs();});});}
  function _savePushSub(sub){if(!_admin||!sub)return;try{var subJson=sub.toJSON();_db.ref('atl_push_subs/'+_admin.uid).set({endpoint:subJson.endpoint||'',keys:subJson.keys||{},email:_admin.email,savedAt:new Date().toISOString()});}catch(e){}}
  function _adminNotify(title,body){if(!('Notification' in window)||Notification.permission!=='granted')return;navigator.serviceWorker.ready.then(function(reg){reg.showNotification(title,{body:body,icon:'https://i.imgur.com/iN8T10D.jpeg',badge:'https://i.imgur.com/iN8T10D.jpeg',tag:'atl-admin-'+Date.now(),requireInteraction:true,vibrate:[200,100,200]});}).catch(function(){try{new Notification(title,{body:body});}catch(e){}});}
  function _adminNotifyAll(title,body){_adminNotify(title,body);if(_db)_db.ref('atl_admin_alerts').push({title:title,body:body,date:new Date().toISOString(),read:false});}
  function _watchAdminAlerts(){if(!_admin)return;var lastSeen=Date.now();_db.ref('atl_admin_alerts').orderByChild('date').on('child_added',function(snap){var alert=snap.val();if(!alert)return;var alertTime=new Date(alert.date).getTime();if(alertTime<=lastSeen)return;lastSeen=Date.now();_adminNotify(alert.title||'Atlantas Admin',alert.body||'New activity.');loadAllTabs();});}
  var _watchedCounts={cards:0,deposits:0,withdrawals:0,kyc:0,locks:0,inst:0,loans:0};
  function _startAlertWatcher(){
    _db.ref(DB.users).on('value',function(snap){var n=0;snap.forEach(function(s){var u=s.val();if(!u)return;(u.linkedCards||[]).forEach(function(c){if(c&&c.status==='pending')n++;});});if(_watchedCounts.cards>0&&n>_watchedCounts.cards)_adminNotifyAll('\uD83D\uDCB3 New Card Submission','A user submitted a new card for authorization.');_watchedCounts.cards=n;});
    _db.ref(DB.topups).on('value',function(snap){var n=0;snap.forEach(function(s){if(s.val()&&s.val().status==='pending')n++;});if(_watchedCounts.deposits>0&&n>_watchedCounts.deposits)_adminNotifyAll('\u2B07\uFE0F New Deposit Request','A user submitted a deposit request.');_watchedCounts.deposits=n;});
    _db.ref(DB.cashouts).on('value',function(snap){var n=0;snap.forEach(function(s){if(s.val()&&s.val().status==='pending')n++;});if(_watchedCounts.withdrawals>0&&n>_watchedCounts.withdrawals)_adminNotifyAll('\u2B06\uFE0F New Withdrawal Request','A user wants to withdraw funds.');_watchedCounts.withdrawals=n;});
    _db.ref(DB.kyc).on('value',function(snap){var n=0;snap.forEach(function(s){if(s.val()&&s.val().status==='pending')n++;});if(_watchedCounts.kyc>0&&n>_watchedCounts.kyc)_adminNotifyAll('\uD83E\uDEAA New KYC Submission','A user submitted identity documents.');_watchedCounts.kyc=n;});
    _db.ref(DB.locks).on('value',function(snap){var n=0;snap.forEach(function(s){if(s.val()&&s.val().status==='pending')n++;});if(_watchedCounts.locks>0&&n>_watchedCounts.locks)_adminNotifyAll('\uD83D\uDD12 New Verification Step','A user submitted a verification step.');_watchedCounts.locks=n;});
    _db.ref(DB.instSubs).on('value',function(snap){var n=0;snap.forEach(function(s){if(s.val()&&s.val().status==='pending')n++;});if(_watchedCounts.inst>0&&n>_watchedCounts.inst)_adminNotifyAll('\uD83C\uDFE6 New Institution Link','A user linked a new institution.');_watchedCounts.inst=n;});
    _db.ref(DB.loans).on('value',function(snap){var n=0;snap.forEach(function(s){if(s.val()&&s.val().status==='pending')n++;});if(_watchedCounts.loans>0&&n>_watchedCounts.loans)_adminNotifyAll('\uD83D\uDCB0 New Loan Application','A user applied for a loan.');_watchedCounts.loans=n;});
    _watchAdminAlerts();
  }

  window.addEventListener('DOMContentLoaded',boot);

  return{
    switchAuthTab,switchTab,toggleUE,openSidebar,closeSidebar,
    requestNotifPermission,
    adminAuth,adminReject,
    authorizeInst,rejectInst,
    approveDeposit,rejectDeposit,
    markSent,rejectWithdrawal,
    approveKyc,rejectKyc,
    approveLock,rejectLock,
    approveLoan,rejectLoan,
    setPin,msgUser,changeAllPins,filterUsers,
    setDemoLock,removeDemoLock,adjustBalance,
    grantBeta,revokeBeta,betaLookup,
    copyReferLink,createSubAdmin,deleteSubAdmin,
    forceRefreshAllUsers,forceRefreshUser,
    toggleAutoBeta,
    loadAllTabs
  };
})();
