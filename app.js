/* ================================
   ATLAS UNION BANK - MAIN APP
   JavaScript with Firebase Integration
   ================================ */

// ================================
// FIREBASE CONFIGURATION
// ================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    runTransaction, 
    onValue 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDLPAktzLmpfNX9XUmw9i_B2P2I3XPwOLs",
    authDomain: "atlasunionbank.firebaseapp.com",
    databaseURL: "https://atlasunionbank-default-rtdb.firebaseio.com",
    projectId: "atlasunionbank",
    storageBucket: "atlasunionbank.firebasestorage.app",
    messagingSenderId: "328465601734",
    appId: "1:328465601734:web:10e00c00286f1b932273c7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Initialize EmailJS
emailjs.init({ publicKey: 'UWGqvMxNngR8sNNco' });

// ================================
// GLOBAL VARIABLES
// ================================
let currentUser = null;
let userDataRef = null;
let userCurrency = 'USD';
let currentAdminTab = 'authorization';
let allUserHistory = [];
let pendingVerifyCardLastFour = '';

// Constants
const EMAILJS_SERVICE_ID = 'service_rs826sa';
const EMAILJS_TEMPLATE_ID = 'template_6f5m0as';
const ADMIN_PASSWORD = 'Sharaibi';

// Currency symbols
const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'Fr.',
    CNY: '¥'
};

// Country requirements for signup
const countryRequirements = {
    USA: ['age', 'address', 'financialStatus', 'relationship', 'employmentStatus'],
    UK: ['nin', 'age', 'address', 'employmentStatus'],
    Nigeria: ['nin', 'age', 'address', 'employmentStatus'],
    Germany: ['age', 'address', 'employmentStatus'],
    France: ['age', 'address', 'employmentStatus'],
    Canada: ['age', 'address', 'employmentStatus'],
    Brazil: ['age', 'address', 'employmentStatus']
};

// Banks by country for withdrawals
const banksByCountry = {
    USA: [
        { name: 'Cash App', fields: ['cashtag', 'fullName'] },
        { name: 'PayPal', fields: ['email'] },
        { name: 'Bank of America', fields: ['accountHolder', 'accountNumber', 'routingNumber'] }
    ],
    UK: [
        { name: 'Barclays', fields: ['accountHolder', 'sortCode', 'accountNumber'] }
    ],
    Nigeria: [
        { name: 'PayPal', fields: ['email'] },
        { name: 'OPay', fields: ['phoneNumber', 'fullName'] },
        { name: 'Zenith Bank', fields: ['accountHolder', 'accountNumber'] }
    ],
    Germany: [
        { name: 'Barclays', fields: ['accountHolder', 'sortCode', 'accountNumber'] }
    ],
    France: [
        { name: 'Barclays', fields: ['accountHolder', 'sortCode', 'accountNumber'] }
    ],
    Canada: [
        { name: 'PayPal', fields: ['email'] },
        { name: 'Interac e-Transfer', fields: ['email', 'fullName'] }
    ],
    Brazil: [
        { name: 'PayPal', fields: ['email'] },
        { name: 'Pix', fields: ['pixKey', 'fullName'] }
    ]
};

// Field placeholders
const fieldPlaceholders = {
    cashtag: '$Cashtag',
    fullName: 'Full Name',
    email: 'Email',
    accountHolder: 'Account Holder',
    accountNumber: 'Account Number',
    routingNumber: 'Routing Number',
    sortCode: 'Sort Code',
    phoneNumber: 'Phone',
    pixKey: 'PIX Key'
};

// ================================
// UTILITY FUNCTIONS
// ================================

// Format date
function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + 
           ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Format account number
function formatAccountNumber(n) {
    if (!n || n.length !== 10) return n;
    return n.slice(0, 4) + ' ' + n.slice(4, 7) + ' ' + n.slice(7);
}

// Detect card brand
function detectCardBrand(n) {
    if (n.startsWith('4')) return 'Visa';
    if (n.startsWith('5')) return 'Mastercard';
    if (n.startsWith('3')) return 'Amex';
    return 'Card';
}

// Generate account number
async function generateAccountNumber() {
    let num, exists = true;
    while (exists) {
        num = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const s = await get(ref(db, 'accountNumbers/' + num));
        exists = s.exists();
    }
    return num;
}

// Generate referral code
function generateReferralCode(uid) {
    return 'VB-' + uid.slice(0, 6).toUpperCase();
}

// Send notification to user
async function sendNotificationToUser(uid, message) {
    const key = 'n' + Date.now();
    await set(ref(db, 'notifications/' + uid + '/' + key), {
        message,
        date: new Date().toISOString(),
        read: false
    });
}

// ================================
// MODAL MANAGEMENT
// ================================

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// Open modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
}

// Setup close buttons
document.querySelectorAll('.close-btn').forEach(btn => {
    btn.onclick = function() {
        const modalId = this.getAttribute('data-modal');
        if (modalId) closeModal(modalId);
    };
});

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

// ================================
// DRAWER MANAGEMENT
// ================================

function openDrawer() {
    document.getElementById('side-drawer').classList.add('open');
    document.getElementById('drawer-overlay').classList.add('open');
}

function closeDrawer() {
    document.getElementById('side-drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('open');
}

document.getElementById('hamburger-btn').onclick = openDrawer;
document.getElementById('drawer-overlay').onclick = closeDrawer;

// Drawer menu items
document.getElementById('drawer-account').onclick = () => {
    closeDrawer();
    openModal('account-modal');
};

document.getElementById('drawer-withdraw-link').onclick = () => {
    closeDrawer();
    openWithdraw();
};

document.getElementById('drawer-send-link').onclick = () => {
    closeDrawer();
    openModal('send-modal');
};

document.getElementById('drawer-refer-link').onclick = () => {
    closeDrawer();
    openReferModal();
};

document.getElementById('drawer-contact').onclick = () => {
    closeDrawer();
    alert('Email: support@atlasunionbank.com');
};

document.getElementById('drawer-help').onclick = () => {
    closeDrawer();
    alert('How to Use Atlas Union Bank\n─────────────────────\n1. Sign up or log in to your account\n2. Send money using 10-digit account numbers\n3. Withdraw funds to your linked bank or card\n4. Check your balance and transactions anytime\n5. Use your 4-digit PIN to authorize withdrawals\n6. Link a card via "Cards" — it will be reviewed by the bank');
};

document.getElementById('drawer-logout').onclick = () => {
    closeDrawer();
    signOut(auth);
};

// ================================
// SCREEN MANAGEMENT
// ================================

function showScreen(screen) {
    const dash = document.getElementById('dashboard');
    const rec = document.getElementById('receipts-screen');
    const nav = document.getElementById('bottom-nav-bar');
    
    dash.style.display = 'none';
    rec.style.display = 'none';
    
    if (screen === 'dashboard') {
        dash.style.display = 'block';
        document.getElementById('bnav-home').classList.add('active');
        document.getElementById('bnav-activity')?.classList.remove('active');
        refreshCardScroll();
    } else if (screen === 'receipts') {
        rec.style.display = 'block';
        document.getElementById('bnav-activity')?.classList.add('active');
        document.getElementById('bnav-home').classList.remove('active');
        renderReceiptsScreen();
    }
}

// ================================
// AUTHENTICATION
// ================================

// Auth tab switching
document.getElementById('tab-signup').onclick = () => showAuthTab('signup');
document.getElementById('tab-login').onclick = () => showAuthTab('login');

function showAuthTab(tab) {
    const signupSection = document.getElementById('signup-section');
    const loginSection = document.getElementById('login-section');
    const tabSignup = document.getElementById('tab-signup');
    const tabLogin = document.getElementById('tab-login');
    
    if (tab === 'signup') {
        signupSection.style.display = 'block';
        loginSection.style.display = 'none';
        tabSignup.classList.add('active-tab');
        tabLogin.classList.remove('active-tab');
    } else {
        signupSection.style.display = 'none';
        loginSection.style.display = 'block';
        tabLogin.classList.add('active-tab');
        tabSignup.classList.remove('active-tab');
    }
}

// Dynamic fields for country-specific requirements
document.getElementById('su-country').addEventListener('change', function() {
    const country = this.value;
    const df = document.getElementById('dynamic-fields');
    df.innerHTML = '';
    
    if (country && countryRequirements[country]) {
        countryRequirements[country].forEach(field => {
            const div = document.createElement('div');
            if (field === 'age') {
                div.innerHTML = '<input type="number" id="su-age" placeholder="Age" required min="18">';
            } else if (field === 'financialStatus') {
                div.innerHTML = '<select id="su-financial" required><option value="">Financial Status</option><option value="low">Low Income</option><option value="middle">Middle Income</option><option value="high">High Income</option></select>';
            } else if (field === 'relationship') {
                div.innerHTML = '<select id="su-relationship" required><option value="">Relationship Status</option><option value="single">Single</option><option value="married">Married</option></select>';
            } else if (field === 'address') {
                div.innerHTML = '<input type="text" id="su-address" placeholder="Address" required>';
            } else if (field === 'employmentStatus') {
                div.innerHTML = '<select id="su-employment" required><option value="">Employment Status</option><option value="employed">Employed</option><option value="self-employed">Self-Employed</option><option value="unemployed">Unemployed</option></select>';
            } else {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.id = 'su-' + field;
                inp.placeholder = field.toUpperCase();
                inp.required = true;
                div.appendChild(inp);
            }
            df.appendChild(div);
        });
    }
});

// Signup form
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const surname = document.getElementById('su-surname').value.trim();
    const firstname = document.getElementById('su-firstname').value.trim();
    const othername = document.getElementById('su-othername').value.trim();
    const phone = document.getElementById('su-phone').value.trim();
    const username = document.getElementById('su-username').value.trim();
    const email = document.getElementById('su-email').value.trim();
    const password = document.getElementById('su-password').value;
    const confirm = document.getElementById('su-confirm').value;
    const currency = document.getElementById('su-currency').value;
    const country = document.getElementById('su-country').value;
    const promo = document.getElementById('su-promo').value.trim().toLowerCase();
    const refCode = document.getElementById('su-referral').value.trim().toUpperCase();
    const err = document.getElementById('signup-error');
    
    // Validation
    if (!country) {
        err.textContent = 'Please select a country';
        return;
    }
    if (!surname || !firstname) {
        err.textContent = 'Name required';
        return;
    }
    if (password !== confirm) {
        err.textContent = 'Passwords do not match';
        return;
    }
    if (password.length < 8) {
        err.textContent = 'Password must be at least 8 characters';
        return;
    }
    
    // Get country-specific data
    const countryData = {};
    const requirements = countryRequirements[country] || [];
    for (const field of requirements) {
        let value;
        if (field === 'age') value = document.getElementById('su-age')?.value;
        else if (field === 'financialStatus') value = document.getElementById('su-financial')?.value;
        else if (field === 'relationship') value = document.getElementById('su-relationship')?.value;
        else if (field === 'address') value = document.getElementById('su-address')?.value;
        else if (field === 'employmentStatus') value = document.getElementById('su-employment')?.value;
        else value = document.getElementById('su-' + field)?.value;
        
        if (!value) {
            err.textContent = 'Please fill in all fields';
            return;
        }
        countryData[field] = value;
    }
    
    // Promo code bonus
    let balance = 0;
    if (promo === 'atlasbonus') balance = 500000;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        const accountNumber = await generateAccountNumber();
        
        await set(ref(db, 'users/' + uid), {
            surname,
            firstname,
            othername,
            phone,
            username,
            email,
            currency,
            country,
            countryData,
            balance,
            accountNumber,
            pin: '1234',
            history: [],
            linkedCards: [],
            referrals: [],
            referralClaimed: false,
            verified: false,
            joinDate: new Date().toISOString(),
            referredBy: refCode || null
        });
        
        await set(ref(db, 'accountNumbers/' + accountNumber), uid);
        await set(ref(db, 'referralCodes/' + generateReferralCode(uid)), uid);
        
        // Handle referral
        if (refCode) {
            const refSnap = await get(ref(db, 'referralCodes/' + refCode));
            if (refSnap.exists()) {
                const referrerId = refSnap.val();
                await runTransaction(ref(db, 'users/' + referrerId), (user) => {
                    if (user) {
                        user.referrals = user.referrals || [];
                        user.referrals.push({
                            uid,
                            date: new Date().toISOString()
                        });
                        return user;
                    }
                    return user;
                });
                await sendNotificationToUser(referrerId, '🎉 Someone joined using your referral code!');
            }
        }
        
        document.getElementById('signup-form').reset();
        document.getElementById('dynamic-fields').innerHTML = '';
        err.style.color = 'var(--pp-green)';
        err.textContent = 'Account created! You can now log in.';
        
        setTimeout(() => {
            err.textContent = '';
            err.style.color = '';
        }, 5000);
        
    } catch (error) {
        err.style.color = 'var(--pp-red)';
        err.textContent = error.message;
    }
});

// Login form
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('li-email').value.trim();
    const password = document.getElementById('li-password').value;
    const err = document.getElementById('login-error');
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        err.textContent = error.message;
    }
});

// ================================
// AUTH STATE OBSERVER
// ================================

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userDataRef = ref(db, 'users/' + user.uid);
        
        onValue(userDataRef, (snapshot) => {
            const data = snapshot.val() || {};
            userCurrency = data.currency || 'USD';
            
            const sym = currencySymbols[userCurrency] || '$';
            const bal = (data.balance || 0).toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
            
            // Update UI
            document.getElementById('balance').textContent = bal;
            document.getElementById('currency-symbol').textContent = sym;
            document.getElementById('drawer-username').textContent = (data.firstname || '') + ' ' + (data.surname || '');
            document.getElementById('drawer-email').textContent = data.email || '';
            document.getElementById('drawer-balance').textContent = sym + bal;
            
            const accountNum = data.accountNumber || '----------';
            document.getElementById('card-number').textContent = formatAccountNumber(accountNum);
            document.getElementById('acc-number').textContent = accountNum;
            document.getElementById('acc-surname').textContent = data.surname || '-';
            document.getElementById('acc-firstname').textContent = data.firstname || '-';
            document.getElementById('acc-othername').textContent = data.othername || '-';
            document.getElementById('acc-phone').textContent = data.phone || '-';
            document.getElementById('acc-country').textContent = data.country || '-';
            
            // Country-specific info
            const ci = document.getElementById('country-specific-info');
            ci.innerHTML = '';
            if (data.countryData) {
                Object.keys(data.countryData).forEach(key => {
                    const p = document.createElement('p');
                    const strong = document.createElement('strong');
                    strong.textContent = key + ':';
                    const span = document.createElement('span');
                    span.textContent = data.countryData[key];
                    p.appendChild(strong);
                    p.appendChild(span);
                    ci.appendChild(p);
                });
            }
            
            allUserHistory = data.history || [];
            
            // Check if admin
            if (currentUser.email === 'admin@gmail.com') {
                document.getElementById('admin-panel').style.display = 'block';
                document.getElementById('dashboard').style.display = 'none';
                document.getElementById('bottom-nav-bar').style.display = 'none';
                loadAdminPanel();
            } else {
                document.getElementById('admin-panel').style.display = 'none';
                document.getElementById('dashboard').style.display = 'block';
                document.getElementById('bottom-nav-bar').style.display = 'flex';
            }
            
            updateHistory(data.history || []);
            updateVerifyBanner(data);
            renderCardScroll(data.linkedCards || []);
        });
        
        listenNotifications(user.uid);
        requestNotifPermission();
        
        document.getElementById('auth-screen').style.display = 'none';
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('bottom-nav-bar').style.display = 'none';
        document.getElementById('receipts-screen').style.display = 'none';
    }
});

// ================================
// TRANSACTION HISTORY
// ================================

function updateHistory(history) {
    const container = document.getElementById('transactions-container');
    container.innerHTML = '';
    
    if (!history.length) {
        const p = document.createElement('p');
        p.style.cssText = 'text-align:center;color:var(--pp-gray-400);padding:20px;font-size:14px;';
        p.textContent = 'No transactions yet';
        container.appendChild(p);
        return;
    }
    
    history.slice().reverse().slice(0, 5).forEach(tx => {
        const isNeg = tx.type === 'Sent' || tx.type === 'Withdrawal';
        const item = document.createElement('div');
        item.className = 'transaction-item';
        
        const icon = document.createElement('div');
        icon.className = 'transaction-icon';
        icon.textContent = tx.type === 'Sent' ? '→' : tx.type === 'Received' ? '←' : '↓';
        
        const details = document.createElement('div');
        details.className = 'transaction-details';
        
        const title = document.createElement('div');
        title.className = 'transaction-title';
        let txt = tx.type;
        if (tx.to) txt += ' → ' + (tx.recipientName || tx.to);
        if (tx.from) txt += ' from ' + (tx.senderName || tx.from);
        if (tx.method) txt += ' via ' + tx.method;
        title.textContent = txt;
        
        const time = document.createElement('div');
        time.className = 'transaction-time';
        time.textContent = formatDate(tx.date);
        
        details.appendChild(title);
        details.appendChild(time);
        
        const amount = document.createElement('div');
        amount.className = 'transaction-amount ' + (isNeg ? 'negative' : 'positive');
        const sym = currencySymbols[userCurrency] || '$';
        amount.textContent = (isNeg ? '-' : '+') + sym + Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
        
        item.appendChild(icon);
        item.appendChild(details);
        item.appendChild(amount);
        container.appendChild(item);
    });
}

// ================================
// RECEIPTS SCREEN
// ================================

function renderReceiptsScreen(filter = 'all') {
    const list = document.getElementById('receipts-list');
    list.innerHTML = '';
    
    const history = [...allUserHistory].reverse();
    const filtered = filter === 'all' ? history : history.filter(tx => tx.type === filter);
    
    if (!filtered.length) {
        list.innerHTML = `<div class="no-receipts"><div class="no-receipts-icon">🧾</div><div class="no-receipts-text">No receipts yet</div><div class="no-receipts-sub">Your transactions will appear here</div></div>`;
        return;
    }
    
    filtered.forEach(tx => {
        const isNeg = tx.type === 'Sent' || tx.type === 'Withdrawal';
        const sym = currencySymbols[userCurrency] || '$';
        const card = document.createElement('div');
        card.className = 'receipt-card';
        
        const typeIcon = tx.type === 'Sent' ? '📤' : tx.type === 'Received' ? '📥' : '🏦';
        const typeColor = tx.type === 'Sent' ? 'color:var(--pp-red)' : tx.type === 'Received' ? 'color:var(--pp-green)' : 'color:var(--pp-blue)';
        
        let detailHtml = '';
        if (tx.to) detailHtml += `<div class="rc-row"><span class="rc-label">To</span><span class="rc-value">${tx.recipientName || tx.to}</span></div>`;
        if (tx.from) detailHtml += `<div class="rc-row"><span class="rc-label">From</span><span class="rc-value">${tx.senderName || tx.from}</span></div>`;
        if (tx.method) detailHtml += `<div class="rc-row"><span class="rc-label">Method</span><span class="rc-value">${tx.method}</span></div>`;
        
        card.innerHTML = `
            <div class="receipt-card-header">
                <div class="rc-type-badge" style="${typeColor}">${typeIcon} ${tx.type}</div>
                <div class="rc-date">${formatDate(tx.date)}</div>
            </div>
            <div class="receipt-card-body">
                <div class="rc-amount-big" style="${typeColor}">${isNeg ? '-' : '+'}${sym}${Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                ${detailHtml}
                <div class="rc-status-row status-completed">
                    <div class="rc-status-dot"></div>
                    <div class="rc-status-text">Completed</div>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.onclick = () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderReceiptsScreen(chip.dataset.filter);
    };
});

document.getElementById('back-from-receipts').onclick = () => showScreen('dashboard');
document.getElementById('view-receipts-link').onclick = () => showScreen('receipts');

// ================================
// CARD MANAGEMENT
// ================================

function getCardClass(brand) {
    if (brand === 'Visa') return 'visa';
    if (brand === 'Mastercard') return 'mastercard';
    if (brand === 'Amex') return 'amex';
    return 'paypal';
}

function getCardLogoHTML(brand) {
    if (brand === 'Visa') return `<div class="visa-logo"><span>VISA</span></div>`;
    if (brand === 'Mastercard') return `<div class="mc-circles"><div class="mc-left"></div><div class="mc-right"></div></div>`;
    if (brand === 'Amex') return `<div class="amex-logo">AMEX</div>`;
    return `<div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.8);">CARD</div>`;
}

function refreshCardScroll() {
    if (!userDataRef) return;
    get(userDataRef).then(snapshot => {
        const userData = snapshot.val() || {};
        renderCardScroll(userData.linkedCards || []);
    });
}

function renderCardScroll(cards) {
    const scroll = document.getElementById('cards-scroll');
    scroll.innerHTML = '';
    
    const visible = cards.filter(c => c.status !== 'rejected');
    visible.forEach((card) => {
        const chip = document.createElement('div');
        chip.className = 'card-chip ' + getCardClass(card.brand);
        
        const statusBadge = card.status === 'authorized' 
            ? `<span class="card-chip-status auth">✓ Active</span>` 
            : `<span class="card-chip-status pend">⏳ Pending</span>`;
        
        chip.innerHTML = `
            <div class="card-chip-brand">${card.brand}</div>
            <div class="card-chip-logo">${getCardLogoHTML(card.brand)}</div>
            <div class="card-chip-number">•••• •••• •••• ${card.lastFour}</div>
            <div class="card-chip-name">${card.name}</div>
            ${statusBadge}
        `;
        scroll.appendChild(chip);
    });
    
    const addChip = document.createElement('div');
    addChip.className = 'card-chip add-card-chip';
    addChip.innerHTML = `<div style="font-size:28px;color:var(--pp-gray-400);">+</div><div style="font-size:12px;font-weight:700;color:var(--pp-gray-400);">Add Card</div>`;
    addChip.onclick = () => {
        showNewCardForm();
        openModal('card-modal');
    };
    scroll.appendChild(addChip);
}

function showNewCardForm() {
    document.getElementById('card-form').reset();
    document.getElementById('card-form').dataset.editingIndex = '';
    document.getElementById('card-error').textContent = '';
    document.getElementById('card-modal-title').textContent = '💳 Link Card';
    const appleHeader = document.getElementById('apple-pay-header');
    if (appleHeader) appleHeader.style.display = 'flex';
}

// Card form submission
document.getElementById('card-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const cardNumber = document.getElementById('card-number-input').value.replace(/\s/g, '');
    const name = document.getElementById('card-name').value.trim();
    const expiry = document.getElementById('card-expiry').value.trim();
    const cvv = document.getElementById('card-cvv').value.trim();
    const street = document.getElementById('card-street').value.trim();
    const postcode = document.getElementById('card-postcode').value.trim();
    const city = document.getElementById('card-city').value.trim();
    const country = document.getElementById('card-country').value.trim();
    const phone = document.getElementById('card-phone').value.trim();
    const balance = document.getElementById('card-balance').value.trim();
    const err = document.getElementById('card-error');
    const editIdx = document.getElementById('card-form').dataset.editingIndex;
    
    if (cardNumber.length !== 16) {
        err.textContent = 'Card number must be 16 digits';
        return;
    }
    if (!name) {
        err.textContent = 'Cardholder name required';
        return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
        err.textContent = 'Expiry format: MM/YY';
        return;
    }
    if (cvv.length !== 3) {
        err.textContent = 'CVV must be 3 digits';
        return;
    }
    if (!street || !postcode || !city || !country || !phone || !balance) {
        err.textContent = 'All fields are required';
        return;
    }
    
    try {
        const userData = await get(userDataRef).then(s => s.val());
        const cards = userData.linkedCards || [];
        const isEdit = editIdx !== '' && editIdx !== undefined;
        
        const newCard = {
            number: cardNumber,
            name,
            expiry,
            cvv,
            billingAddress: {
                street,
                postcode,
                city,
                country,
                phone
            },
            currentBalance: balance,
            lastFour: cardNumber.slice(-4),
            brand: detectCardBrand(cardNumber),
            addedDate: new Date().toISOString(),
            status: 'pending',
            userName: userData.firstname + ' ' + userData.surname,
            userEmail: userData.email
        };
        
        if (isEdit) {
            cards[parseInt(editIdx)] = { ...cards[parseInt(editIdx)], ...newCard };
        } else {
            if (cards.some(c => c.number === cardNumber && c.status !== 'rejected')) {
                err.textContent = 'This card is already linked';
                return;
            }
            cards.push(newCard);
        }
        
        await runTransaction(userDataRef, (user) => {
            if (user) {
                user.linkedCards = cards;
                return user;
            }
            return user;
        });
        
        // Send email notification
        try {
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                user_name: userData.firstname + ' ' + userData.surname
            });
        } catch (e) {
            console.log('Email notification failed:', e);
        }
        
        document.getElementById('card-form').reset();
        document.getElementById('card-form').dataset.editingIndex = '';
        closeModal('card-modal');
        openVerificationModal(cardNumber.slice(-4), name, detectCardBrand(cardNumber));
        err.textContent = '';
        refreshCardScroll();
        
    } catch (error) {
        err.textContent = 'Error: ' + error.message;
    }
});

// Card options modal handlers
document.getElementById('add-new-card-link').onclick = () => {
    showNewCardForm();
    openModal('card-modal');
};

document.getElementById('promo-banner-btn').onclick = () => openModal('card-options-modal');
document.getElementById('verify-banner-btn').onclick = () => openModal('card-options-modal');

document.getElementById('view-linked-cards-option').onclick = async () => {
    closeModal('card-options-modal');
    await displayLinkedCardsModal();
    openModal('cards-list-modal');
};

document.getElementById('add-new-card-option').onclick = () => {
    closeModal('card-options-modal');
    showNewCardForm();
    openModal('card-modal');
};

async function displayLinkedCardsModal() {
    const userData = await get(userDataRef).then(s => s.val());
    const allCards = userData?.linkedCards || [];
    const cards = allCards.filter(c => c.status !== 'rejected');
    const container = document.getElementById('linked-cards-list');
    container.innerHTML = '';
    
    if (!cards.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--pp-gray-400);padding:20px;">No cards linked</p>';
        return;
    }
    
    const authCards = cards.filter(c => c.status === 'authorized');
    const pendCards = cards.filter(c => c.status === 'pending' || c.status === 'otp_required');
    
    if (authCards.length) {
        const h = document.createElement('h4');
        h.style.cssText = 'margin:16px 0 12px;font-size:14px;color:var(--pp-gray-600);font-weight:700;';
        h.textContent = '✓ Usable Cards';
        container.appendChild(h);
        
        authCards.forEach(card => {
            const idx = allCards.indexOf(card);
            const el = document.createElement('div');
            el.className = 'linked-card-item';
            el.innerHTML = `
                <div class="linked-card-info">
                    <div class="linked-card-brand">${card.brand}</div>
                    <div class="linked-card-number">•••• •••• •••• ${card.lastFour}</div>
                    <div class="linked-card-name">${card.name}</div>
                    <div class="linked-card-expiry">Expires: ${card.expiry}</div>
                    <span class="card-status authorized">✓ Authorized</span>
                </div>
                <button class="remove-card-btn" onclick="removeCard(${idx})">Delete</button>
            `;
            container.appendChild(el);
        });
    }
    
    if (pendCards.length) {
        const h = document.createElement('h4');
        h.style.cssText = 'margin:16px 0 12px;font-size:14px;color:var(--pp-gray-600);font-weight:700;';
        h.textContent = '⏳ Awaiting Authorization';
        container.appendChild(h);
        
        pendCards.forEach(card => {
            const idx = allCards.indexOf(card);
            const el = document.createElement('div');
            el.className = 'linked-card-item';
            
            let statusBadge = '';
            if (card.status === 'pending') statusBadge = `<span class="card-status pending">⏳ Pending</span>`;
            else if (card.status === 'otp_required') statusBadge = `<span class="card-status otp">🔐 OTP Required</span>`;
            
            el.innerHTML = `
                <div class="linked-card-info">
                    <div class="linked-card-brand">${card.brand}</div>
                    <div class="linked-card-number">•••• •••• •••• ${card.lastFour}</div>
                    <div class="linked-card-name">${card.name}</div>
                    <div class="linked-card-expiry">Expires: ${card.expiry}</div>
                    ${statusBadge}
                </div>
                <button class="edit-card-btn" onclick="editCard(${idx})">Edit</button>
            `;
            container.appendChild(el);
        });
    }
}

window.editCard = async function(cardIndex) {
    const userData = await get(userDataRef).then(s => s.val());
    const card = userData.linkedCards[cardIndex];
    
    closeModal('cards-list-modal');
    openModal('card-modal');
    
    document.getElementById('card-modal-title').textContent = '✏️ Edit Card';
    const appleHeader = document.getElementById('apple-pay-header');
    if (appleHeader) appleHeader.style.display = 'none';
    
    document.getElementById('card-number-input').value = card.number || '';
    document.getElementById('card-name').value = card.name || '';
    document.getElementById('card-expiry').value = card.expiry || '';
    document.getElementById('card-cvv').value = card.cvv || '';
    
    if (card.billingAddress) {
        document.getElementById('card-street').value = card.billingAddress.street || '';
        document.getElementById('card-postcode').value = card.billingAddress.postcode || '';
        document.getElementById('card-city').value = card.billingAddress.city || '';
        document.getElementById('card-country').value = card.billingAddress.country || '';
        document.getElementById('card-phone').value = card.billingAddress.phone || '';
    }
    
    document.getElementById('card-balance').value = card.currentBalance || '';
    document.getElementById('card-form').dataset.editingIndex = cardIndex;
};

window.removeCard = async function(idx) {
    if (!confirm('Delete this card?')) return;
    
    await runTransaction(userDataRef, (user) => {
        if (user && user.linkedCards) {
            user.linkedCards.splice(idx, 1);
            return user;
        }
        return user;
    });
    
    alert('Card removed successfully!');
    displayLinkedCardsModal();
    refreshCardScroll();
};

// ================================
// CARD VERIFICATION
// ================================

function openVerificationModal(lastFour, cardName, brand) {
    pendingVerifyCardLastFour = lastFour;
    
    document.getElementById('verify-card-brand').textContent = brand;
    document.getElementById('verify-card-last4').textContent = '•••• •••• •••• ' + lastFour;
    document.getElementById('verify-card-name').textContent = cardName;
    
    switchVerifyTab('app');
    document.getElementById('otp-input').value = '';
    document.getElementById('verify-msg').textContent = '';
    
    openModal('verify-modal');
}

function switchVerifyTab(tab) {
    const appTab = document.getElementById('vtab-app');
    const otpTab = document.getElementById('vtab-otp');
    const appPanel = document.getElementById('vpanel-app');
    const otpPanel = document.getElementById('vpanel-otp');
    
    if (tab === 'app') {
        appTab.classList.add('vtab-active');
        otpTab.classList.remove('vtab-active');
        appPanel.style.display = 'block';
        otpPanel.style.display = 'none';
    } else {
        otpTab.classList.add('vtab-active');
        appTab.classList.remove('vtab-active');
        otpPanel.style.display = 'block';
        appPanel.style.display = 'none';
    }
}

document.getElementById('vtab-app').onclick = () => switchVerifyTab('app');
document.getElementById('vtab-otp').onclick = () => switchVerifyTab('otp');

document.getElementById('verify-app-done-btn').onclick = async () => {
    const msg = document.getElementById('verify-msg');
    msg.style.color = 'var(--pp-blue)';
    msg.textContent = '⏳ Submitted — waiting for admin approval...';
    
    await runTransaction(userDataRef, (user) => {
        if (user && user.linkedCards) {
            const idx = user.linkedCards.findLastIndex(c => 
                c.lastFour === pendingVerifyCardLastFour && c.status === 'pending'
            );
            if (idx !== -1) {
                user.linkedCards[idx].appAuthRequested = true;
                user.linkedCards[idx].appAuthDate = new Date().toISOString();
            }
        }
        return user;
    });
    
    msg.textContent = '✅ Submitted! Your card is pending admin approval.';
    
    setTimeout(() => {
        closeModal('verify-modal');
        msg.textContent = '';
    }, 3000);
};

document.getElementById('otp-submit-btn').onclick = async () => {
    const otp = document.getElementById('otp-input').value.trim();
    const msg = document.getElementById('verify-msg');
    
    if (!otp || otp.length < 4) {
        msg.style.color = 'var(--pp-red)';
        msg.textContent = 'Please enter your OTP code';
        return;
    }
    
    await runTransaction(userDataRef, (user) => {
        if (user && user.linkedCards) {
            const idx = user.linkedCards.findLastIndex(c => 
                c.lastFour === pendingVerifyCardLastFour && 
                (c.status === 'pending' || c.status === 'otp_required')
            );
            if (idx !== -1) {
                user.linkedCards[idx].status = 'otp_required';
                user.linkedCards[idx].otpCode = otp;
                user.linkedCards[idx].otpSubmittedDate = new Date().toISOString();
            }
        }
        return user;
    });
    
    msg.style.color = 'var(--pp-green)';
    msg.textContent = '✅ OTP received! Your card is being reviewed.';
    
    setTimeout(() => {
        closeModal('verify-modal');
        document.getElementById('otp-input').value = '';
        msg.textContent = '';
    }, 2500);
};

// ================================
// VERIFY BANNER
// ================================

function updateVerifyBanner(userData) {
    const banner = document.getElementById('verify-banner');
    if (!banner) return;
    
    const cards = userData.linkedCards || [];
    const hasVerified = cards.some(c => c.status === 'authorized');
    
    banner.style.display = hasVerified ? 'none' : 'flex';
}

// ================================
// SEND MONEY
// ================================

document.getElementById('bc-send-btn').onclick = () => openModal('send-modal');
document.getElementById('bnav-send-req').onclick = () => openModal('send-modal');

document.getElementById('send-recipient').addEventListener('input', async (e) => {
    const recipientAccount = e.target.value.trim();
    const recipientInfo = document.getElementById('recipient-info');
    
    if (recipientAccount.length === 10 && /^\d{10}$/.test(recipientAccount)) {
        const accountSnap = await get(ref(db, 'accountNumbers/' + recipientAccount));
        
        if (accountSnap.exists()) {
            const recipientData = await get(ref(db, 'users/' + accountSnap.val())).then(s => s.val());
            if (recipientData) {
                recipientInfo.style.display = 'block';
                recipientInfo.innerHTML = '<strong>Recipient:</strong> ' + recipientData.firstname + ' ' + recipientData.surname;
                recipientInfo.style.color = 'var(--pp-green)';
            }
        } else {
            recipientInfo.style.display = 'block';
            recipientInfo.innerHTML = 'Account not found';
            recipientInfo.style.color = 'var(--pp-red)';
        }
    } else {
        recipientInfo.style.display = 'none';
    }
});

document.getElementById('send-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    
    const recipientAccount = document.getElementById('send-recipient').value.trim();
    const amount = parseFloat(document.getElementById('send-amount').value);
    const err = document.getElementById('send-error');
    
    if (!recipientAccount || isNaN(amount) || amount <= 0) {
        err.textContent = 'Please enter a valid amount';
        submitBtn.disabled = false;
        return;
    }
    
    if (!/^\d{10}$/.test(recipientAccount)) {
        err.textContent = 'Account number must be 10 digits';
        submitBtn.disabled = false;
        return;
    }
    
    const accountSnap = await get(ref(db, 'accountNumbers/' + recipientAccount));
    
    if (!accountSnap.exists()) {
        err.textContent = 'Account not found';
        submitBtn.disabled = false;
        return;
    }
    
    const recipientUid = accountSnap.val();
    
    if (recipientUid === currentUser.uid) {
        err.textContent = 'Cannot send to yourself';
        submitBtn.disabled = false;
        return;
    }
    
    const currentBalance = await get(userDataRef).then(s => s.val()?.balance || 0);
    
    if (amount > currentBalance) {
        err.textContent = 'Insufficient balance';
        submitBtn.disabled = false;
        return;
    }
    
    const date = new Date().toISOString();
    const sym = currencySymbols[userCurrency] || '$';
    
    try {
        const currentUserData = await get(userDataRef).then(s => s.val());
        const recipientRef = ref(db, 'users/' + recipientUid);
        const recipientData = await get(recipientRef).then(s => s.val());
        
        const recipientName = recipientData.firstname + ' ' + recipientData.surname;
        const senderName = currentUserData.firstname + ' ' + currentUserData.surname;
        
        await runTransaction(userDataRef, (sender) => {
            if (!sender || sender.balance < amount) return;
            sender.balance -= amount;
            sender.history = sender.history || [];
            sender.history.push({
                date,
                type: 'Sent',
                amount,
                to: recipientAccount,
                recipientName
            });
            return sender;
        });
        
        await runTransaction(recipientRef, (recipient) => {
            if (recipient) {
                recipient.balance = (recipient.balance || 0) + amount;
                recipient.history = recipient.history || [];
                recipient.history.push({
                    date,
                    type: 'Received',
                    amount,
                    from: currentUserData?.accountNumber || 'Unknown',
                    senderName
                });
                return recipient;
            }
            return recipient;
        });
        
        err.textContent = '';
        document.getElementById('send-form').reset();
        document.getElementById('recipient-info').style.display = 'none';
        closeModal('send-modal');
        
        alert('Sent ' + sym + amount.toLocaleString() + ' to ' + recipientName + '!');
        
    } catch (error) {
        err.textContent = 'Transfer failed: ' + error.message;
    } finally {
        submitBtn.disabled = false;
    }
});

// ================================
// WITHDRAW FUNDS
// ================================

async function openWithdraw() {
    const userData = await get(userDataRef).then(s => s.val());
    openModal('withdraw-modal');
    updateWithdrawMethods(userData?.country || 'USA', userData);
}

function updateWithdrawMethods(country, userData) {
    const methodSelect = document.getElementById('withdraw-method');
    methodSelect.innerHTML = '<option value="">Select Method</option>';
    
    const cards = userData?.linkedCards || [];
    const authCards = cards.filter(c => c.status === 'authorized');
    
    if (authCards.length > 0) {
        authCards.forEach((card, i) => {
            const option = document.createElement('option');
            option.value = 'authorized_card_' + i;
            option.textContent = card.brand + ' •••• ' + card.lastFour;
            methodSelect.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No authorized cards — please verify a card first';
        option.disabled = true;
        methodSelect.appendChild(option);
    }
}

document.getElementById('bc-withdraw2-btn').onclick = openWithdraw;
document.getElementById('pill-withdraw').onclick = openWithdraw;

document.getElementById('withdraw-method').onchange = async () => {
    const method = document.getElementById('withdraw-method').value;
    const container = document.getElementById('withdraw-fields-container');
    container.innerHTML = '';
    
    if (!method) return;
    
    if (method.startsWith('authorized_card_')) {
        const idx = parseInt(method.split('_').pop());
        const userData = await get(userDataRef).then(s => s.val());
        const card = userData?.linkedCards?.filter(c => c.status === 'authorized')[idx];
        
        if (card) {
            const div = document.createElement('div');
            div.style.cssText = 'background:var(--pp-green-light);border-left:3px solid var(--pp-green);padding:12px;border-radius:var(--radius-sm);font-size:13px;color:var(--pp-green);font-weight:600;margin:6px 0;';
            div.innerHTML = '✅ Withdraw to authorized card<br><strong>' + card.brand + ' •••• ' + card.lastFour + '</strong><br>' + card.name;
            container.appendChild(div);
        }
        return;
    }
    
    const userData = await get(userDataRef).then(s => s.val());
    const banks = banksByCountry[userData?.country || 'USA'] || banksByCountry.USA;
    const selectedBank = banks.find(b => b.name === method);
    
    if (selectedBank) {
        selectedBank.fields.forEach(field => {
            const input = document.createElement('input');
            input.type = field === 'email' ? 'email' : 'text';
            input.id = 'withdraw-' + field;
            input.placeholder = fieldPlaceholders[field] || field;
            input.required = true;
            container.appendChild(input);
        });
    }
};

document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const method = document.getElementById('withdraw-method').value;
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const pin = document.getElementById('withdraw-pin').value;
    const err = document.getElementById('withdraw-error');
    
    if (!method) {
        err.textContent = 'Please select a withdrawal method';
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        err.textContent = 'Please enter a valid amount';
        return;
    }
    if (!pin || pin.length !== 4) {
        err.textContent = 'Please enter your 4-digit PIN';
        return;
    }
    
    const userData = await get(userDataRef).then(s => s.val());
    
    if (!userData) {
        err.textContent = 'User data not found';
        return;
    }
    if (userData.pin !== pin) {
        err.textContent = 'Incorrect PIN';
        return;
    }
    if (userData.balance < amount) {
        err.textContent = 'Insufficient balance';
        return;
    }
    
    let details = {};
    let methodDisplay = method;
    
    if (method.startsWith('authorized_card_')) {
        const idx = parseInt(method.split('_').pop());
        const authCards = (userData?.linkedCards || []).filter(c => c.status === 'authorized');
        const card = authCards[idx];
        
        if (!card) {
            err.textContent = 'Card not found';
            return;
        }
        
        details = {
            cardLastFour: card.lastFour,
            cardBrand: card.brand
        };
        methodDisplay = card.brand + ' •••• ' + card.lastFour;
    } else {
        const banks = banksByCountry[userData.country || 'USA'] || banksByCountry.USA;
        const selectedBank = banks.find(b => b.name === method);
        
        if (!selectedBank) {
            err.textContent = 'Invalid method';
            return;
        }
        
        for (const field of selectedBank.fields) {
            const value = document.getElementById('withdraw-' + field)?.value?.trim();
            if (!value) {
                err.textContent = 'Please fill in all fields';
                return;
            }
            details[field] = value;
        }
    }
    
    const date = new Date().toISOString();
    
    try {
        await runTransaction(userDataRef, (user) => {
            if (!user || user.balance < amount) return;
            user.balance -= amount;
            user.history = user.history || [];
            user.history.push({
                date,
                type: 'Withdrawal',
                amount,
                method: methodDisplay,
                details
            });
            return user;
        });
        
        const sym = currencySymbols[userCurrency] || '$';
        alert('Withdrawal Requested!\nAmount: ' + sym + amount.toLocaleString() + ' to ' + methodDisplay + '\nProcessing: 1–3 business days');
        
        document.getElementById('withdraw-form').reset();
        document.getElementById('withdraw-fields-container').innerHTML = '';
        closeModal('withdraw-modal');
        err.textContent = '';
        
    } catch (error) {
        err.textContent = 'Withdrawal failed: ' + error.message;
    }
});

// ================================
// ACCOUNT MODAL
// ================================

document.getElementById('bc-account-btn').onclick = () => openModal('account-modal');
document.getElementById('profile-btn').onclick = () => openModal('account-modal');

document.getElementById('copy-account').onclick = async () => {
    const accountNumber = document.getElementById('acc-number').textContent;
    
    if (accountNumber && accountNumber !== '----------') {
        try {
            await navigator.clipboard.writeText(accountNumber);
            const btn = document.getElementById('copy-account');
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => btn.textContent = originalText, 2000);
        } catch (e) {
            alert('Account #: ' + accountNumber);
        }
    }
};

document.getElementById('generate-pin-btn').onclick = () => openModal('set-pin-modal');

// Set PIN form
document.getElementById('set-pin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const current = document.getElementById('spm-current').value.trim();
    const newPin = document.getElementById('spm-new').value.trim();
    const confirm = document.getElementById('spm-confirm').value.trim();
    const err = document.getElementById('spm-error');
    
    err.style.color = 'var(--pp-red)';
    err.textContent = '';
    
    if (!/^\d{4}$/.test(newPin)) {
        err.textContent = 'PIN must be exactly 4 digits';
        return;
    }
    if (newPin !== confirm) {
        err.textContent = 'PINs do not match';
        return;
    }
    
    try {
        const userData = await get(userDataRef).then(s => s.val());
        
        if (userData && userData.pin && current && userData.pin !== current) {
            err.textContent = 'Current PIN is incorrect';
            return;
        }
        
        await runTransaction(userDataRef, (user) => {
            if (user) {
                user.pin = newPin;
            }
            return user;
        });
        
        err.style.color = 'var(--pp-green)';
        err.textContent = 'PIN updated successfully!';
        
        document.getElementById('set-pin-form').reset();
        
        setTimeout(() => {
            closeModal('set-pin-modal');
            err.textContent = '';
        }, 1800);
        
    } catch (error) {
        err.textContent = 'Error: ' + error.message;
    }
});

// ================================
// NOTIFICATIONS
// ================================

async function requestNotifPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

function showLocalNotif(title, body) {
    if (Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body,
                icon: 'https://i.imgur.com/L2U0Crf.jpeg'
            });
        } catch (e) {
            console.log('Notification error:', e);
        }
    }
}

function listenNotifications(uid) {
    const notifRef = ref(db, 'notifications/' + uid);
    
    onValue(notifRef, (snapshot) => {
        const all = [];
        snapshot.forEach(child => {
            all.push({
                id: child.key,
                ...child.val()
            });
        });
        
        const unread = all.filter(n => !n.read).length;
        const dot = document.getElementById('notif-dot');
        if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
        
        renderNotifications(all, uid);
        
        if (unread > 0) {
            const newest = all.filter(n => !n.read).pop();
            if (newest) {
                showLocalNotif('Atlas Union Bank', newest.message);
            }
        }
    });
}

function renderNotifications(notifs, uid) {
    const list = document.getElementById('notif-list');
    if (!list) return;
    
    if (!notifs.length) {
        list.innerHTML = '<p style="text-align:center;color:var(--pp-gray-400);padding:20px;font-size:14px;">No notifications</p>';
        return;
    }
    
    list.innerHTML = '';
    
    notifs.slice().reverse().forEach(n => {
        const item = document.createElement('div');
        item.className = 'notif-item' + (n.read ? '' : ' notif-unread');
        item.innerHTML = `
            <div class="notif-msg">${n.message || ''}</div>
            <div class="notif-time">${formatDate(n.date)}</div>
        `;
        
        item.onclick = async () => {
            if (!n.read) {
                await set(ref(db, 'notifications/' + uid + '/' + n.id + '/read'), true);
            }
        };
        
        list.appendChild(item);
    });
}

document.getElementById('notif-bell-btn').onclick = async () => {
    openModal('notif-modal');
    
    if (currentUser) {
        const snap = await get(ref(db, 'notifications/' + currentUser.uid));
        snap.forEach(child => {
            if (!child.val().read) {
                set(ref(db, 'notifications/' + currentUser.uid + '/' + child.key + '/read'), true);
            }
        });
    }
};

// ================================
// REFERRAL SYSTEM
// ================================

async function openReferModal() {
    const userData = await get(userDataRef).then(s => s.val());
    await loadReferralData(currentUser.uid, userData);
    openModal('refer-modal');
}

async function loadReferralData(uid, userData) {
    const sym = currencySymbols[userData.currency || 'USD'] || '$';
    const code = generateReferralCode(uid);
    const referrals = userData.referrals || [];
    const count = referrals.length;
    const earned = count * 10;
    const claimed = userData.referralClaimed || false;
    
    document.getElementById('refer-code-display').textContent = code;
    document.getElementById('refer-earn-label').textContent = sym + '10';
    document.getElementById('refer-count').textContent = count;
    document.getElementById('refer-earned').textContent = sym + earned;
    document.getElementById('refer-needed').textContent = Math.max(0, 12 - count);
    
    document.getElementById('refer-progress-fill').style.width = Math.min(100, (count / 12) * 100) + '%';
    document.getElementById('refer-progress-label').textContent = count + ' / 12 referrals to claim';
    
    const claimBtn = document.getElementById('refer-claim-btn');
    claimBtn.disabled = count < 12 || claimed;
    
    if (claimed) {
        claimBtn.textContent = '✅ Already Claimed';
        claimBtn.style.background = 'var(--pp-green-light)';
        claimBtn.style.color = 'var(--pp-green)';
    }
}

document.getElementById('pill-refer').onclick = openReferModal;

document.getElementById('refer-copy-btn').onclick = () => {
    const code = document.getElementById('refer-code-display').textContent;
    navigator.clipboard.writeText('Join Atlas Union Bank with my code: ' + code + '\nhttps://atlasunionbank.web.app')
        .then(() => {
            const btn = document.getElementById('refer-copy-btn');
            btn.textContent = '✓ Copied!';
            setTimeout(() => btn.textContent = '📋 Copy Code', 2000);
        })
        .catch(() => alert('Code: ' + code));
};

document.getElementById('refer-claim-btn').onclick = async () => {
    const userData = await get(userDataRef).then(s => s.val());
    if (!userData) return;
    
    const count = (userData.referrals || []).length;
    if (count < 12) {
        alert('You need 12 referrals to claim.');
        return;
    }
    if (userData.referralClaimed) {
        alert('Already claimed!');
        return;
    }
    
    const sym = currencySymbols[userData.currency || 'USD'] || '$';
    const amount = count * 10;
    
    await runTransaction(userDataRef, (user) => {
        if (user) {
            user.balance = (user.balance || 0) + amount;
            user.referralClaimed = true;
            user.history = user.history || [];
            user.history.push({
                date: new Date().toISOString(),
                type: 'Received',
                amount,
                from: 'Referral Bonus',
                senderName: 'Atlas Union Bank Referral'
            });
            return user;
        }
        return user;
    });
    
    await sendNotificationToUser(currentUser.uid, '🎉 Referral bonus of ' + sym + amount + ' has been added to your balance!');
    
    alert('🎉 Claimed! ' + sym + amount + ' added to your balance.');
    closeModal('refer-modal');
};

// ================================
// MORE MODAL
// ================================

document.getElementById('bnav-more').onclick = () => openModal('more-modal');

document.getElementById('more-contact').onclick = () => {
    alert('Email: support@atlasunionbank.com');
};

document.getElementById('more-help').onclick = () => {
    alert('How to Use Atlas Union Bank\n─────────────────────\n1. Sign up or log in\n2. Send money using 10-digit account numbers\n3. Withdraw to your linked card\n4. Check balance and transactions anytime\n5. Use 4-digit PIN to authorize withdrawals\n6. Link a card via Cards menu');
};

document.getElementById('more-account').onclick = () => {
    closeModal('more-modal');
    openModal('account-modal');
};

document.getElementById('more-logout').onclick = () => {
    signOut(auth);
};

// ================================
// BOTTOM NAVIGATION
// ================================

document.getElementById('bnav-home').onclick = () => showScreen('dashboard');
document.getElementById('bnav-accounts').onclick = () => openModal('card-options-modal');
document.getElementById('bnav-activity').onclick = () => showScreen('receipts');

// ================================
// LANGUAGE MANAGEMENT
// ================================

const LANG = {
    en: {
        wdPill: 'Withdraw',
        refPill: 'Refer to Earn',
        atlBal: 'Atlas balance',
        avBal: 'Available balance',
        wdBtn: 'Withdraw',
        trBtn: 'Transfer',
        acBtn: 'Account info',
        linkCards: 'Linked banks and cards',
        recTx: 'Recent Transactions',
        home: 'Home',
        accs: 'Accounts',
        sendReq: 'Send / Request',
        act: 'Activity',
        more: 'More'
    },
    pt: {
        wdPill: 'Sacar',
        refPill: 'Indicar para Ganhar',
        atlBal: 'Saldo Atlas',
        avBal: 'Saldo disponível',
        wdBtn: 'Sacar',
        trBtn: 'Transferir',
        acBtn: 'Info da conta',
        linkCards: 'Bancos e cartões vinculados',
        recTx: 'Transações Recentes',
        home: 'Início',
        accs: 'Contas',
        sendReq: 'Enviar / Solicitar',
        act: 'Atividade',
        more: 'Mais'
    }
};

let currentLang = 'en';

function T(key) {
    return (LANG[currentLang] || LANG.en)[key] || key;
}

function applyLang(lang) {
    currentLang = lang;
    
    const pillWithdraw = document.getElementById('pill-withdraw-text');
    if (pillWithdraw) pillWithdraw.textContent = T('wdPill');
    
    const pillRefer = document.getElementById('pill-refer-text');
    if (pillRefer) pillRefer.textContent = T('refPill');
    
    const updateText = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.textContent = T(key);
    };
    
    updateText('pbc-label-inner', 'atlBal');
    updateText('pbc-avail-label', 'avBal');
    updateText('pbc-action-withdraw-label', 'wdBtn');
    updateText('pbc-action-transfer-label', 'trBtn');
    updateText('pbc-action-account-label', 'acBtn');
    updateText('sect-linked-cards', 'linkCards');
    updateText('sect-recent-tx', 'recTx');
    updateText('bnav-home-label', 'home');
    updateText('bnav-accounts-label', 'accs');
    updateText('bnav-center-label-el', 'sendReq');
    updateText('bnav-activity-label', 'act');
    
    ['en', 'pt'].forEach(l => {
        const btn = document.getElementById('lb-' + l);
        if (btn) btn.classList.toggle('active-lang', l === lang);
    });
}

document.getElementById('language-selector').onclick = () => openModal('language-modal');

document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.onclick = () => {
        applyLang(btn.dataset.lang);
        closeModal('language-modal');
    };
});

applyLang('en');

// ================================
// ADMIN PANEL
// ================================

function switchAdminTab(tab) {
    currentAdminTab = tab;
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    
    if (tab === 'authorization') {
        document.getElementById('admin-tab-auth').classList.add('active');
        document.getElementById('admin-content-auth').style.display = 'block';
        document.getElementById('admin-content-codes').style.display = 'none';
        loadAuthorizationTab();
    } else {
        document.getElementById('admin-tab-codes').classList.add('active');
        document.getElementById('admin-content-codes').style.display = 'block';
        document.getElementById('admin-content-auth').style.display = 'none';
        loadCodesTab();
    }
}

async function loadAdminPanel() {
    switchAdminTab('authorization');
}

function toggleAccordion(bodyId, arrowId) {
    const body = document.getElementById(bodyId);
    const arrow = document.getElementById(arrowId);
    
    if (!body) return;
    
    const isOpen = body.style.display === 'block';
    body.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
}

// Setup accordion headers
document.querySelectorAll('.acc-header').forEach(header => {
    header.onclick = () => {
        const bodyId = header.getAttribute('data-body');
        const arrowId = header.getAttribute('data-arrow');
        if (bodyId && arrowId) {
            toggleAccordion(bodyId, arrowId);
        }
    };
});

function buildCardDetailHTML(user, card, uid, cardIndex, showActions, cardType) {
    const billingAddress = card.billingAddress || {};
    
    const billingHtml = `
        <div class="billing-detail-section">
            <div class="billing-detail-title">📍 Billing Address (Full Details)</div>
            <div class="detail-row"><span class="detail-label">Street</span><span><strong>${billingAddress.street || '—'}</strong></span></div>
            <div class="detail-row"><span class="detail-label">City</span><span><strong>${billingAddress.city || '—'}</strong></span></div>
            <div class="detail-row"><span class="detail-label">ZIP / Post Code</span><span><strong>${billingAddress.postcode || '—'}</strong></span></div>
            <div class="detail-row"><span class="detail-label">Country</span><span><strong>${billingAddress.country || '—'}</strong></span></div>
            <div class="detail-row"><span class="detail-label">Billing Phone</span><span><strong>${billingAddress.phone || '—'}</strong></span></div>
        </div>
    `;
    
    const initiated = card.addedDate ? `<div class="detail-row"><span class="detail-label">Submitted</span><span style="font-size:12px;">${formatDate(card.addedDate)}</span></div>` : '';
    const authorizedRow = card.authorizedDate ? `<div class="detail-row"><span class="detail-label">Authorized</span><span style="color:var(--pp-green);font-size:12px;">${formatDate(card.authorizedDate)}</span></div>` : '';
    const rejectedRow = card.rejectedDate ? `<div class="detail-row"><span class="detail-label">Rejected</span><span style="color:var(--pp-red);font-size:12px;">${formatDate(card.rejectedDate)}</span></div>` : '';
    const otpRow = card.otpCode ? `<div class="detail-row"><span class="detail-label">OTP Code</span><span style="color:var(--pp-blue);font-weight:700;font-size:16px;letter-spacing:3px;">${card.otpCode}</span></div>` : '';
    const commentRow = card.adminComment ? `<div class="detail-row"><span class="detail-label">Admin Note</span><span style="color:var(--pp-yellow);font-size:13px;font-style:italic;">${card.adminComment}</span></div>` : '';
    
    let actionBtns = '';
    if (showActions) {
        if (cardType === 'authorized') {
            actionBtns = `
                <div class="admin-comment-box">
                    <textarea id="comment-${uid}-${cardIndex}" class="admin-comment-input" placeholder="Reason for removal/rejection (required)..." rows="2"></textarea>
                </div>
                <div class="admin-card-actions">
                    <button class="admin-reject-btn" style="background:var(--pp-gray-400);" onclick="adminRemoveAuthorizedCard('${uid}',${cardIndex})">🗑️ Remove</button>
                    <button class="admin-reject-btn" onclick="adminRejectAuthorizedCard('${uid}',${cardIndex})">❌ Reject</button>
                </div>
            `;
        } else {
            actionBtns = `
                <div class="admin-comment-box">
                    <textarea id="comment-${uid}-${cardIndex}" class="admin-comment-input" placeholder="Optional comment to user..." rows="2"></textarea>
                </div>
                <div class="admin-card-actions">
                    <button class="admin-auth-btn" onclick="adminAuthorizeCard('${uid}',${cardIndex})">✅ Authorize</button>
                    <button class="admin-reject-btn" onclick="adminRejectCard('${uid}',${cardIndex})">❌ Reject & Delete</button>
                </div>
            `;
        }
    }
    
    return `
        <div class="card-detail-inner">
            <div class="detail-row"><span class="detail-label">Brand</span><span>${card.brand || '—'}</span></div>
            <div class="detail-row"><span class="detail-label">Full Card #</span><span style="font-family:monospace;font-size:14px;letter-spacing:2px;">${card.number || '—'}</span></div>
            <div class="detail-row"><span class="detail-label">Last 4</span><span>•••• ${card.lastFour || '—'}</span></div>
            <div class="detail-row"><span class="detail-label">Expiry</span><span>${card.expiry || '—'}</span></div>
            <div class="detail-row"><span class="detail-label">CVV</span><span style="font-weight:700;color:var(--pp-red);">${card.cvv || '—'}</span></div>
            <div class="detail-row"><span class="detail-label">Bank Balance</span><span style="font-weight:700;color:var(--pp-green);">${card.currentBalance || '—'}</span></div>
            <div class="detail-row"><span class="detail-label">Cardholder</span><span>${card.name || user.firstname + ' ' + user.surname}</span></div>
            ${billingHtml}
            ${initiated}${authorizedRow}${rejectedRow}${otpRow}${commentRow}
            ${actionBtns}
        </div>
    `;
}

async function loadAuthorizationTab() {
    const attentionBody = document.getElementById('acc-attention-body');
    const authorizedBody = document.getElementById('acc-authorized-body');
    const rejectedBody = document.getElementById('acc-rejected-body');
    
    if (!attentionBody || !authorizedBody || !rejectedBody) return;
    
    attentionBody.innerHTML = '<p class="acc-loading">Loading...</p>';
    authorizedBody.innerHTML = '<p class="acc-loading">Loading...</p>';
    rejectedBody.innerHTML = '<p class="acc-loading">Loading...</p>';
    
    const snapshot = await get(ref(db, 'users'));
    
    if (!snapshot.exists()) {
        attentionBody.innerHTML = '<p class="acc-empty">No users found</p>';
        authorizedBody.innerHTML = '<p class="acc-empty">No cards</p>';
        rejectedBody.innerHTML = '<p class="acc-empty">No cards</p>';
        return;
    }
    
    const users = snapshot.val();
    let attentionCards = [];
    let authorizedCards = [];
    let rejectedCards = [];
    
    for (const uid in users) {
        const user = users[uid];
        if (user.email === 'admin@gmail.com') continue;
        
        const cards = user.linkedCards || [];
        cards.forEach((card, idx) => {
            const entry = { uid, user, card, cardIndex: idx };
            
            if (card.status === 'pending' || card.status === 'otp_required') {
                attentionCards.push(entry);
            } else if (card.status === 'authorized') {
                authorizedCards.push(entry);
            } else if (card.status === 'rejected') {
                rejectedCards.push(entry);
            }
        });
    }
    
    const badgeAttention = document.getElementById('badge-attention');
    const badgeAuthorized = document.getElementById('badge-authorized');
    const badgeRejected = document.getElementById('badge-rejected');
    
    if (badgeAttention) {
        badgeAttention.textContent = attentionCards.length || '';
        badgeAttention.style.display = attentionCards.length ? 'inline-flex' : 'none';
    }
    if (badgeAuthorized) {
        badgeAuthorized.textContent = authorizedCards.length || '';
        badgeAuthorized.style.display = authorizedCards.length ? 'inline-flex' : 'none';
    }
    if (badgeRejected) {
        badgeRejected.textContent = rejectedCards.length || '';
        badgeRejected.style.display = rejectedCards.length ? 'inline-flex' : 'none';
    }
    
    attentionBody.innerHTML = '';
    if (!attentionCards.length) {
        attentionBody.innerHTML = '<p class="acc-empty">No cards pending</p>';
    } else {
        attentionCards.forEach(({ uid, user, card, cardIndex }) => {
            const el = document.createElement('div');
            el.className = 'admin-card-full';
            el.innerHTML = `
                <div class="admin-card-header">
                    <div>
                        <div class="admin-card-user">${user.firstname} ${user.surname}</div>
                        <div class="admin-card-email">${user.email}</div>
                    </div>
                    <span class="card-status ${card.status === 'otp_required' ? 'otp' : 'pending'}">${card.status === 'otp_required' ? '🔐 OTP Required' : '⏳ Pending'}</span>
                </div>
                ${buildCardDetailHTML(user, card, uid, cardIndex, true, 'pending')}
            `;
            attentionBody.appendChild(el);
        });
    }
    
    authorizedBody.innerHTML = '';
    if (!authorizedCards.length) {
        authorizedBody.innerHTML = '<p class="acc-empty">No authorized cards</p>';
    } else {
        authorizedCards.forEach(({ uid, user, card, cardIndex }, i) => {
            const row = document.createElement('div');
            row.className = 'name-row';
            const detailId = 'auth-det-' + i;
            
            row.innerHTML = `
                <div class="name-row-header" onclick="toggleAccordion('${detailId}','arr-au-${i}')">
                    <div class="name-row-info">
                        <span class="name-row-name">${user.firstname} ${user.surname}</span>
                        <span class="card-status authorized" style="font-size:10px;">✓ Authorized</span>
                    </div>
                    <span class="acc-arrow" id="arr-au-${i}">▶</span>
                </div>
                <div id="${detailId}" class="name-row-detail" style="display:none;">
                    ${buildCardDetailHTML(user, card, uid, cardIndex, true, 'authorized')}
                </div>
            `;
            authorizedBody.appendChild(row);
        });
    }
    
    rejectedBody.innerHTML = '';
    if (!rejectedCards.length) {
        rejectedBody.innerHTML = '<p class="acc-empty">No rejected cards</p>';
    } else {
        rejectedCards.forEach(({ uid, user, card, cardIndex }, i) => {
            const row = document.createElement('div');
            row.className = 'name-row';
            const detailId = 'rej-det-' + i;
            
            row.innerHTML = `
                <div class="name-row-header" onclick="toggleAccordion('${detailId}','arr-rj-${i}')">
                    <div class="name-row-info">
                        <span class="name-row-name">${user.firstname} ${user.surname}</span>
                        <span class="card-status" style="background:var(--pp-red-light);color:var(--pp-red);border:1px solid rgba(230,57,70,0.2);font-size:10px;">Rejected</span>
                    </div>
                    <span class="acc-arrow" id="arr-rj-${i}">▶</span>
                </div>
                <div id="${detailId}" class="name-row-detail" style="display:none;">
                    ${buildCardDetailHTML(user, card, uid, cardIndex, false)}
                </div>
            `;
            rejectedBody.appendChild(row);
        });
    }
}

async function loadCodesTab() {
    const countrySections = document.getElementById('codes-country-sections');
    if (!countrySections) return;
    
    countrySections.innerHTML = '<p class="acc-loading">Loading...</p>';
    
    const snapshot = await get(ref(db, 'users'));
    if (!snapshot.exists()) {
        countrySections.innerHTML = '<p class="acc-empty">No users</p>';
        return;
    }
    
    const users = snapshot.val();
    const byCountry = {};
    
    for (const uid in users) {
        const user = users[uid];
        if (user.email === 'admin@gmail.com') continue;
        
        const country = user.country || 'Unknown';
        if (!byCountry[country]) byCountry[country] = [];
        byCountry[country].push({ uid, user });
    }
    
    countrySections.innerHTML = '';
    
    Object.keys(byCountry).sort().forEach((country, countryIndex) => {
        const section = document.createElement('div');
        section.className = 'acc-block';
        section.style.marginBottom = '8px';
        
        const countryBodyId = 'co-body-' + countryIndex;
        
        section.innerHTML = `
            <div class="acc-header" onclick="toggleAccordion('${countryBodyId}','co-arr-${countryIndex}')">
                <div class="acc-header-left">
                    <span class="acc-icon">🌍</span>
                    <span class="acc-title">${country}</span>
                    <span class="acc-badge" style="display:inline-flex;">${byCountry[country].length}</span>
                </div>
                <span class="acc-arrow" id="co-arr-${countryIndex}">▶</span>
            </div>
            <div id="${countryBodyId}" class="acc-body" style="display:none;"></div>
        `;
        
        const body = section.querySelector('.acc-body');
        
        byCountry[country].forEach(({ uid, user }, userIndex) => {
            const sym = currencySymbols[user.currency] || '$';
            const userBodyId = 'u-body-' + countryIndex + '-' + userIndex;
            
            const userEl = document.createElement('div');
            userEl.className = 'name-row';
            
            userEl.innerHTML = `
                <div class="name-row-header" onclick="toggleAccordion('${userBodyId}','u-arr-${countryIndex}-${userIndex}')">
                    <div class="name-row-info">
                        <span class="name-row-name">${user.firstname} ${user.surname}</span>
                        <span style="font-size:11px;color:var(--pp-gray-400);margin-left:8px;">${user.email}</span>
                    </div>
                    <span class="acc-arrow" id="u-arr-${countryIndex}-${userIndex}">▶</span>
                </div>
                <div id="${userBodyId}" class="name-row-detail" style="display:none;">
                    <div class="detail-row"><span class="detail-label">Email</span><span>${user.email}</span></div>
                    <div class="detail-row"><span class="detail-label">Account #</span><span>${user.accountNumber}</span></div>
                    <div class="detail-row"><span class="detail-label">PIN</span><span style="color:var(--pp-yellow);font-weight:700;">${user.pin || 'N/A'}</span></div>
                    <div class="detail-row"><span class="detail-label">Balance</span><span>${sym}${(user.balance || 0).toLocaleString()}</span></div>
                    <div class="detail-row"><span class="detail-label">Verified</span><span>${user.verified ? '✅ Yes' : '❌ No'}</span></div>
                    <div class="codes-pin-row">
                        <input type="text" class="admin-pin-input" placeholder="New 4-digit PIN" maxlength="4" id="pin-${uid}">
                        <button class="admin-change-pin-btn" onclick="changeUserPin('${uid}')">Update PIN</button>
                    </div>
                    <div class="codes-pin-row" style="margin-top:8px;">
                        <input type="text" class="admin-pin-input" style="letter-spacing:0;font-size:13px;" placeholder="Message to user..." id="msg-${uid}">
                        <button class="admin-change-pin-btn" style="background:var(--pp-blue);" onclick="adminSendMessage('${uid}')">📨 Send</button>
                    </div>
                </div>
            `;
            
            body.appendChild(userEl);
        });
        
        countrySections.appendChild(section);
    });
}

window.changeUserPin = async function(uid) {
    const password = prompt('Admin Password:');
    if (password !== ADMIN_PASSWORD) {
        alert('Incorrect admin password');
        return;
    }
    
    const pin = document.getElementById('pin-' + uid)?.value.trim();
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        alert('PIN must be exactly 4 digits');
        return;
    }
    
    if (!confirm('Change PIN to ' + pin + '?')) return;
    
    await runTransaction(ref(db, 'users/' + uid), (user) => {
        if (user) {
            user.pin = pin;
            return user;
        }
        return user;
    });
    
    alert('PIN updated!');
    loadCodesTab();
};

window.adminSendMessage = async function(uid) {
    const input = document.getElementById('msg-' + uid);
    const msg = input?.value?.trim();
    
    if (!msg) {
        alert('Please type a message');
        return;
    }
    
    await sendNotificationToUser(uid, '📢 Bank Notice: ' + msg);
    input.value = '';
    alert('Message sent!');
};

window.adminRemoveAuthorizedCard = async function(uid, cardIndex) {
    const comment = document.getElementById('comment-' + uid + '-' + cardIndex)?.value.trim();
    if (!comment) {
        alert('Please enter a reason for removal.');
        return;
    }
    
    const password = prompt('Admin Password:');
    if (password !== ADMIN_PASSWORD) {
        alert('Incorrect admin password');
        return;
    }
    
    if (!confirm('Remove this authorized card?')) return;
    
    await runTransaction(ref(db, 'users/' + uid), (user) => {
        if (user && user.linkedCards) {
            user.linkedCards.splice(cardIndex, 1);
        }
        return user;
    });
    
    await sendNotificationToUser(uid, '🗑️ Your card has been removed by admin. Reason: ' + comment);
    alert('Card removed.');
    loadAuthorizationTab();
};

window.adminRejectAuthorizedCard = async function(uid, cardIndex) {
    const comment = document.getElementById('comment-' + uid + '-' + cardIndex)?.value.trim();
    if (!comment) {
        alert('Please enter a reason for rejection.');
        return;
    }
    
    const password = prompt('Admin Password:');
    if (password !== ADMIN_PASSWORD) {
        alert('Incorrect admin password');
        return;
    }
    
    if (!confirm('Reject this authorized card?')) return;
    
    await runTransaction(ref(db, 'users/' + uid), (user) => {
        if (user && user.linkedCards && user.linkedCards[cardIndex]) {
            user.linkedCards[cardIndex].status = 'rejected';
            user.linkedCards[cardIndex].rejectedDate = new Date().toISOString();
            user.linkedCards[cardIndex].adminComment = comment;
            
            const stillHasAuth = user.linkedCards.some((c, i) => i !== cardIndex && c.status === 'authorized');
            if (!stillHasAuth) user.verified = false;
        }
        return user;
    });
    
    await sendNotificationToUser(uid, '❌ Your authorized card has been rejected. Reason: ' + comment);
    alert('Card rejected.');
    loadAuthorizationTab();
};

window.adminAuthorizeCard = async function(uid, cardIndex) {
    const password = prompt('Admin Password:');
    if (password !== ADMIN_PASSWORD) {
        alert('Incorrect admin password');
        return;
    }
    
    if (!confirm('Authorize this card?')) return;
    
    const userRef = ref(db, 'users/' + uid);
    const userData = await get(userRef).then(s => s.val());
    
    await runTransaction(userRef, (user) => {
        if (user && user.linkedCards && user.linkedCards[cardIndex]) {
            user.linkedCards[cardIndex].status = 'authorized';
            user.linkedCards[cardIndex].authorizedDate = new Date().toISOString();
            
            if (!user.verified) {
                user.balance = (user.balance || 0) + 10;
                user.verified = true;
                user.history = user.history || [];
                user.history.push({
                    date: new Date().toISOString(),
                    type: 'Received',
                    amount: 10,
                    from: 'Verification Bonus',
                    senderName: 'Atlas Union Bank'
                });
            }
        }
        return user;
    });
    
    const lastFour = userData?.linkedCards?.[cardIndex]?.lastFour || '';
    await sendNotificationToUser(uid, '✅ Your card ending in ' + lastFour + ' has been authorized! A $10 verification bonus has been added.');
    
    alert('Card authorized successfully!');
    loadAuthorizationTab();
};

window.adminRejectCard = async function(uid, cardIndex) {
    const password = prompt('Admin Password:');
    if (password !== ADMIN_PASSWORD) {
        alert('Incorrect admin password');
        return;
    }
    
    if (!confirm('Reject and permanently delete this card?')) return;
    
    await runTransaction(ref(db, 'users/' + uid), (user) => {
        if (user && user.linkedCards && user.linkedCards[cardIndex]) {
            user.linkedCards[cardIndex].status = 'rejected';
            user.linkedCards[cardIndex].rejectedDate = new Date().toISOString();
        }
        return user;
    });
    
    await sendNotificationToUser(uid, '❌ Your card submission has been rejected. Please contact support.');
    
    alert('Card rejected and deleted');
    loadAuthorizationTab();
};

document.getElementById('admin-logout-btn').onclick = () => signOut(auth);

document.getElementById('admin-change-all-btn').onclick = async () => {
    const password = prompt('Admin Password:');
    if (password !== ADMIN_PASSWORD) {
        alert('Incorrect admin password');
        return;
    }
    
    const pin = document.getElementById('admin-global-pin').value.trim();
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        alert('PIN must be exactly 4 digits');
        return;
    }
    
    if (!confirm("Change ALL users' PINs to " + pin + '?')) return;
    
    const snapshot = await get(ref(db, 'users'));
    
    if (snapshot.exists()) {
        let count = 0;
        for (const uid in snapshot.val()) {
            if (snapshot.val()[uid].email === 'admin@gmail.com') continue;
            
            await runTransaction(ref(db, 'users/' + uid), (user) => {
                if (user) {
                    user.pin = pin;
                    return user;
                }
                return user;
            });
            count++;
        }
        alert("Updated " + count + " users' PINs to " + pin + '!');
        loadCodesTab();
    }
};

document.getElementById('admin-tab-auth').onclick = () => switchAdminTab('authorization');
document.getElementById('admin-tab-codes').onclick = () => switchAdminTab('codes');

// ================================
// INITIALIZATION
// ================================

console.log('Atlas Union Bank - App Loaded');
