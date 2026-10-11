/* Guidance for new users: "add to home screen" prompt, "turn on alerts" prompt, and a short tip on every page. */
const Guide=(()=>{
 const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}},set=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},del=k=>{try{localStorage.removeItem(k)}catch(e){}};
 const UA=navigator.userAgent,ios=/iphone|ipad|ipod/i.test(UA),android=/android/i.test(UA),mobile=ios||android;
 const inApp=/FBAN|FBAV|Instagram|Messenger|Snapchat|TikTok|Line\/|; wv\)/i.test(UA);
 const standalone=()=>{try{return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}catch(e){return false}};
 const snoozed=(k,h)=>get(k)&&Date.now()-(+get(k))<h*36e5;
 let deferred=null,sheet=null,cur='';
 const close=()=>{if(sheet){sheet.remove();sheet=null;cur=''}};
 const show=(key,html)=>{if(cur===key&&sheet)return;close();cur=key;sheet=document.createElement('div');sheet.className='sheet';
  sheet.innerHTML='<div class="sheet-card"><img class="sicon" src="img/icon-192.png" alt="">'+html+'</div>';document.body.appendChild(sheet);requestAnimationFrame(()=>sheet&&sheet.classList.add('in'));return sheet};
 const later=(k,h)=>{set(k,Date.now());close();setTimeout(()=>Guide.sheets(),300)};
 const SHARE='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8"/></svg>';
 const needInstall=()=>mobile&&!standalone()&&!get('iit-installed')&&!snoozed('iit-install-later',24);
 const needAlerts=()=>!!(Auth.me()&&window.Notification&&Notification.permission==='default'&&typeof Push!=='undefined'&&Push.can()&&!snoozed('iit-alerts-later',24));
 function installSheet(){
  if(inApp){const s=show('inapp','<h3>Open in your browser</h3><p class="muted">This link opened inside another app, where it cannot be installed. Tap the <b>⋯</b> or <b>⋮</b> menu and choose <b>Open in browser</b> (Chrome or Safari). Then you can add IIT Transport to your home screen.</p><button class="btn full" id="gcopy">Copy the link</button><button class="btn alt full" id="glater">Later</button>');
   s.querySelector('#gcopy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href.split('#')[0]);s.querySelector('#gcopy').textContent='Copied ✔ Paste it in your browser'}catch(e){prompt('Copy this link:',location.href.split('#')[0])}};
   s.querySelector('#glater').onclick=()=>later('iit-install-later');return}
  if(ios){const s=show('ios','<h3>Add IIT Transport to your Home Screen</h3><ol><li><i>1</i><span>Tap the <b>Share</b> button '+SHARE+' at the bottom of Safari</span></li><li><i>2</i><span>Scroll down and tap <b>Add to Home Screen</b></span></li><li><i>3</i><span>Tap <b>Add</b>. Open the app from its icon and you will also get <b>alerts</b>.</span></li></ol><button class="btn full" id="glater">Got it</button>');
   s.querySelector('#glater').onclick=()=>later('iit-install-later');return}
  if(deferred){const s=show('android-ok','<h3>Install IIT Transport</h3><p class="muted">Add the app to your home screen to open it in one tap and get alerts.</p><button class="btn full" id="ginst">📲 Install the app</button><button class="btn alt full" id="glater">Later</button>');
   s.querySelector('#ginst').onclick=async()=>{deferred.prompt();const r=await deferred.userChoice;deferred=null;if(r&&r.outcome==='accepted')set('iit-installed','1');close();setTimeout(()=>Guide.sheets(),400)};
   s.querySelector('#glater').onclick=()=>later('iit-install-later');return}
  const s=show('android','<h3>Add IIT Transport to your home screen</h3><ol><li><i>1</i><span>Tap the <b>⋮</b> menu at the top right of your browser</span></li><li><i>2</i><span>Tap <b>Install app</b> or <b>Add to Home screen</b></span></li></ol><button class="btn full" id="glater">Got it</button>');
  s.querySelector('#glater').onclick=()=>later('iit-install-later')}
 function alertsSheet(){const s=show('alerts','<h3>🔔 Turn on alerts</h3><p class="muted">Get an instant alert when a driver accepts your request, when someone asks for your ride, or when you get a chat message, even if the app is closed.</p><button class="btn full" id="gon">Turn on alerts</button><button class="btn alt full" id="glater">Not now</button><div id="gmsg" class="err" hidden></div>');
  s.querySelector('#glater').onclick=()=>later('iit-alerts-later');
  s.querySelector('#gon').onclick=async()=>{try{await Push.enable();s.querySelector('.sheet-card').innerHTML='<h3>✅ Alerts are on</h3><p class="muted">You will be notified about requests and messages.</p>';setTimeout(close,1600)}
   catch(e){const m=s.querySelector('#gmsg');m.hidden=false;m.textContent=e.message||'Could not turn on alerts.'}}}
 document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.hint button');if(b){const h=b.parentElement;set('iit-hint-'+h.dataset.k,'1');h.remove()}});
 addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(cur==='android'||!sheet)Guide.sheets()});
 addEventListener('appinstalled',()=>{set('iit-installed','1');close()});
 return{
  hint(key,html){return get('iit-hint-'+key)?'':'<div class="hint" data-k="'+key+'"><span>💡</span><div>'+html+'</div><button type="button" aria-label="Hide this tip">✕</button></div>'},
  resetHints(){try{Object.keys(localStorage).filter(k=>k.startsWith('iit-hint-')).forEach(k=>del(k))}catch(e){}},
  sheets(){clearTimeout(this._t);this._t=setTimeout(()=>{if(needInstall())installSheet();else if(needAlerts())alertsSheet();else close()},cur?0:900)}}})();
