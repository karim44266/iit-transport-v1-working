const $=s=>document.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],DIR={to_iit:'Home → IIT',from_iit:'IIT → Home'};
const todayStr=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
const dayLabel=r=>{const t=todayStr(),tm=new Date(Date.now()+864e5-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);return r.date===t?'Today':r.date===tm?'Tomorrow':new Date(r.date+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})};
const avatar=(p,c='av')=>p&&p.photo?`<img class="${c}" src="${p.photo}" alt="">`:`<div class="${c}">${esc(((p&&p.name)||'?')[0].toUpperCase())}</div>`;
const badge=m=>m<=300?`<span class="bdg ok">✅ On your route · ${fd(m)}</span>`:m<=800?`<span class="bdg warn">⚠️ Small detour · ${fd(m)} off the route</span>`:`<span class="bdg bad">❌ Off your route · ${fd(m)}</span>`;
const dropDist=(r,p)=>nearestOnLine([p.lng,p.lat],r.route.route_geojson.geometry.coordinates).dist;
const ago=iso=>{const m=Math.round((Date.now()-new Date(iso))/6e4);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'};
const card=r=>`<a class="card ride" href="#/ride/${r.id}"><div><b class="tm">${r.departure_time}</b> <span class="tag">${DIR[r.route.direction]}</span>
 <div>${esc(r.route.name)}</div><div class="muted">${dayLabel(r)} · updated ${ago(r.updated_at)}</div>${near(r)}</div>
 <div class="seats ${r.seats_available?'':'full'}">${r.seats_available?`<span>${r.seats_available}</span>seats`:'FULL'}</div></a>`;

/* ---- Home: public list with search and filters ---- */
async function home(){const all=await Store.rides();
 app.innerHTML=`<section class="hero"><div><h1>We share the road!</h1><p>Find a ride to IIT with students and staff, or offer your free seats.</p><a class="btn pill" href="#/${Auth.me()?'create':'register'}">${Auth.me()?'Offer a ride':'Join now'}</a></div></section><div class="filters"><input id="fq" class="wide" placeholder="Search a route or area (e.g. Gremda)">
 <select id="fd"><option value="">Any direction</option><option value="to_iit">Home → IIT</option><option value="from_iit">IIT → Home</option></select>
 <select id="fy"><option value="">Any day</option>${DAYS.map(d=>`<option>${d}</option>`).join('')}</select>
 <input id="ft" type="time" title="Leaves after"><label class="chk"><input id="fs" type="checkbox"> Seats available only</label></div><div id="list"></div>`;
 const draw=()=>{const q=$('#fq').value.trim().toLowerCase(),d=$('#fd').value,y=$('#fy').value,t=$('#ft').value,s=$('#fs').checked;
  const l=all.filter(r=>(!q||r.route.name.toLowerCase().includes(q))&&(!d||r.route.direction===d)&&(!y||r.days.includes(y))&&(!t||r.departure_time>=t)&&(!s||r.seats_available>0));
  $('#list').innerHTML=l.length?l.map(card).join(''):'<div class="card muted">No rides found. Be the first to <a href="#/create">offer one</a>.</div>'};
 ['fq','fd','fy','ft','fs'].forEach(i=>$('#'+i).oninput=draw);draw()}

/* ---- Ride details ---- */
async function rideView(id){const r=await Store.ride(id);
 if(!r){app.innerHTML='<div class="card">Ride not found or no longer active. <a href="#/rides">Back</a></div>';return}
 const full=!r.seats_available;
 app.innerHTML=`<a class="back" href="#/rides">← All rides</a><div class="card"><b class="tm">${r.departure_time}</b> <span class="tag">${DIR[r.route.direction]}</span>
 <h2>${esc(r.route.name)}</h2><div class="muted">${dayLabel(r)} · ${esc(r.route.driver_name)} · updated ${ago(r.updated_at)}</div>
 ${r.route.note?`<p>📝 ${esc(r.route.note)}</p>`:''}<div class="mapw"><div id="map"></div></div>
 <div id="eta" style="margin-top:12px"></div><div class="seatline">${full?'<span class="seats full">FULL</span>':`<b>${r.seats_available}</b> of ${r.seats_total} seats available`}</div>
 <div id="act"></div></div>`;
 initMap('map');showRoute(r.route.route_geojson);
 const c0=r.route.route_geojson.geometry.coordinates[0];L.circleMarker([c0[1],c0[0]],{radius:8,color:GREEN,fillOpacity:1}).addTo(M).bindTooltip('Driver starts',{permanent:true,direction:'top'});
 drawYou(r);etaBlock(r);actions(r)}
async function actions(r){const u=Auth.me(),b=$('#act'),full=!r.seats_available;
 if(!u){b.innerHTML='<a class="btn" href="#/login">Log in to request a seat</a>';return}
 if(r.owner_id===u.id){b.innerHTML=`<p class="muted">This is your ride.</p><a class="btn" href="#/manage/${r.id}">Review requests</a><a class="btn alt" href="#/chat/${r.id}">Group chat</a>`;return}
 const q=await Store.myRequest(r.id,u.id),cancel=t=>{$('#ca').onclick=async()=>{if(confirm(t)){await Store.cancelRequest(r.id,u.id);rideView(r.id)}}};
 if(q&&q.status==='accepted'){b.innerHTML='<div class="loc2 ok">✅ The driver accepted you. You have a seat.</div><a class="btn" href="#/chat/'+r.id+'">Open group chat</a><button class="btn no" id="ca">Cancel my seat</button>';cancel('Give up your seat?');return}
 if(q&&q.status==='pending'){L.marker([q.drop.lat,q.drop.lng]).addTo(M).bindTooltip('Your drop-off',{permanent:true});
  b.innerHTML='<div class="loc2">⏳ Request sent. Waiting for the driver to accept. '+badge(dropDist(r,q.drop))+'</div><button class="btn no" id="ca">Cancel request</button>';cancel('Cancel your request?');return}
 r.route.whatsapp_number=await Store.driverPhone(r.id);const wa=`<a class="btn alt" id="wa" target="_blank" rel="noopener" href="${waLink(r)}">WhatsApp the driver</a>`;
 if(full){b.innerHTML='<button class="btn" disabled>Ride is full</button>';return}
 b.innerHTML=(q?'<div class="loc2 ko">The driver declined your last request. You can try again with another drop-off.</div>':'')+'<div class="loc2">📍 <b>Tap the map</b> where you want to be dropped off. The driver will check it matches his route.</div><div id="mb" style="margin-top:8px"></div><button class="btn" id="ap" disabled>Send request</button>'+wa;
 let drop=null,mk=null;
 M.on('click',e=>{drop={lat:+e.latlng.lat.toFixed(6),lng:+e.latlng.lng.toFixed(6)};if(mk)mk.setLatLng(e.latlng);else mk=L.marker(e.latlng).addTo(M).bindTooltip('Your drop-off',{permanent:true});
  $('#mb').innerHTML=badge(dropDist(r,drop));$('#ap').disabled=false});
 $('#ap').onclick=async()=>{try{await Store.apply(r.id,u.id,u.name,drop);rideView(r.id)}catch(e){alert(e.message);rideView(r.id)}};
 $('#wa').onclick=()=>Store.logContact(u.id,r.id)}

/* ---- Group chat (driver + everyone who applied) ---- */
let CHAT=null,CHCH=null;
async function chatView(id){const u=need();if(!u)return;const r=await Store.rideAny(id),msgs=await Store.messages(id,u.id);if(r&&msgs)r.route.whatsapp_number=await Store.driverPhone(id);
 if(!r||!msgs){app.innerHTML='<div class="card">You can only open the chat of a ride you applied to or drive. <a href="#/rides">Back</a></div>';return}
 app.innerHTML=`<a class="back" href="#/ride/${id}">← Ride</a><div class="card chat"><h2>${esc(r.route.name)}</h2><div class="muted" id="pp"></div><div id="msgs"></div>
 <div class="send"><input id="mt" placeholder="Write a message…" maxlength="500"><button class="btn" id="sd">Send</button></div>
 <a class="muted" target="_blank" rel="noopener" href="${waLink(r)}">Prefer WhatsApp? Contact the driver</a></div>`;
 let last='';const paint=async()=>{const [ms,ps]=await Promise.all([Store.messages(id,u.id),Store.passengers(id)]);if(!ms)return;
  $('#pp').textContent='Driver: '+r.route.driver_name+(ps.length?' · Passengers: '+ps.map(p=>p.name).join(', '):' · no passengers yet');
  const h=ms.map(m=>m.user_id===null?`<div class="sys">${esc(m.text)}</div>`:`<div class="msg ${m.user_id===u.id?'me':''}"><b>${m.user_id===u.id?'You':esc(m.name)}${m.user_id===r.owner_id?' 🚗':''}</b>${esc(m.text)}<i>${hm(new Date(m.at).getHours()*60+new Date(m.at).getMinutes())}</i></div>`).join('');
  if(h!==last){last=h;const b=$('#msgs');b.innerHTML=h||'<div class="sys">No messages yet. Say hi 👋</div>';b.scrollTop=b.scrollHeight}};
 const send=async()=>{const t=$('#mt').value.trim();if(!t)return;$('#mt').value='';try{await Store.send(id,u.id,u.name,t);paint()}catch(e){$('#mt').value=t;alert('Message not sent: '+e.message)}};
 $('#sd').onclick=send;$('#mt').onkeydown=e=>{if(e.key==='Enter')send()};
 await paint();CHAT=setInterval(paint,8000); /* backup only: messages arrive instantly through realtime */
 CHCH=sb.channel('chat-'+id).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'ride_id=eq.'+id},paint).subscribe()}


/* ---- Auth pages ---- */
const need=()=>{const u=Auth.me();if(!u)location.hash='#/login';return u};
const authCard=(t,sub,body)=>`<div class="authwrap"><div class="card auth"><h2>${t}</h2><p class="muted">${sub}</p>${body}<div id="err" class="err" hidden></div></div></div>`;
const fail=e=>{const b=$('#err');b.hidden=false;b.textContent=e.message||'Something went wrong'};
function loginView(){app.innerHTML=authCard('Welcome back','Log in to offer rides and contact drivers.',`<label>Email</label><input id="em" type="email" autocomplete="email"><label>Password</label><input id="pw" type="password" autocomplete="current-password"><button class="btn full" id="go">Log in</button><p class="muted">New here? <a href="#/register">Create an account</a></p>`);
 $('#go').onclick=async()=>{try{await Auth.login($('#em').value,$('#pw').value);location.hash='#/rides';nav()}catch(e){fail(e)}}}
function registerView(){app.innerHTML=authCard('Create your account','Takes 30 seconds. Your phone is only used to build the WhatsApp link.',`<label>Full name</label><input id="nm" autocomplete="name"><label>Email</label><input id="em" type="email" autocomplete="email"><label>WhatsApp number</label><input id="ph" type="tel" placeholder="e.g. 22 123 456"><label>Password (6+ characters)</label><input id="pw" type="password" autocomplete="new-password"><button class="btn full" id="go">Register</button><a class="btn alt full" href="#/login">I already have an account · Log in</a>`);
 $('#go').onclick=async()=>{const n=$('#nm').value.trim(),p=$('#ph').value.trim(),w=$('#pw').value;
  if(!n||$('#em').value.indexOf('@')<1||p.replace(/\D/g,'').length<8||w.length<6)return fail(Error('Fill every field: valid email, phone (8+ digits), password (6+ characters).'));
  try{await Auth.register({name:n,email:$('#em').value,phone:p,password:w});location.hash='#/rides';nav()}catch(e){fail(e)}}}
function nav(){const u=Auth.me();$('#nav').innerHTML=u?`<a href="#/rides">Rides</a><a href="#/create" class="cta">Offer a ride</a><a href="#/me">👤 ${esc(u.name.split(' ')[0])} <span class="dot" id="nb" hidden></span></a>`:`<a href="#/rides">Rides</a><a href="#/login">Log in</a><a href="#/register" class="cta">Register</a>`;Notify.sync()}

/* ---- Create ride: same road as before, or draw a new one ---- */
async function createView(pre){const u=need();if(!u)return;const mine=await Store.myRoutes(u.id);let geo=null,reuse=mine.find(m=>m.id===pre)||null;
 app.innerHTML=`<a class="back" href="#/rides">← Back</a><div class="card"><h2>Offer a ride</h2>
 ${mine.length?`<label>Which road?</label><select id="sr"><option value="">New road (draw it)</option>${mine.map(m=>`<option value="${m.id}" ${reuse&&reuse.id===m.id?'selected':''}>Same as before: ${esc(m.name)} (${DIR[m.direction]})</option>`).join('')}</select>`:''}
 <div id="newr"><div class="row"><div><label>Route name</label><input id="rn" placeholder="e.g. Gremda → IIT"></div><div><label>Direction</label><select id="dd"><option value="to_iit">Home → IIT</option><option value="from_iit">IIT → Home</option></select></div></div>
 <label>Note (optional)</label><input id="nt" placeholder="e.g. meet in front of Block B"></div>
 <div class="row"><div><label>Departure time</label><input id="tm" type="time"></div><div><label>Seats</label><input id="st" type="number" min="1" max="8" value="3"></div></div>
 <label>Date</label><input id="dt" type="date" value="${todayStr()}" min="${todayStr()}"><div class="muted">The ride disappears for riders 1 hour after the departure time.</div>
 <div class="mapw"><div id="map"></div><div id="pad" hidden></div></div>
 <div id="drawbar"><button class="btn alt" id="dv" type="button">✏️ Draw my route</button><button class="btn alt" id="cl" type="button">Clear</button></div>
 <div class="muted" id="info">Tap "Draw my route", then draw with your finger. Tap again to move the map.</div>
 <button class="btn full" id="pub">Publish ride</button></div>`;
 initMap('map');const pad=$('#pad'),sr=$('#sr');
 const mode=()=>{$('#newr').style.display=$('#drawbar').style.display=reuse?'none':'';pad.hidden=true;
  if(reuse){geo=null;showRoute(reuse.route_geojson);$('#info').textContent='Using your saved road. Pick "New road" to draw another.'}else clearRoute()};
 drawTool(pad,g=>{geo=g;$('#info').textContent='Route drawn ✔ Draw again to replace it.'});
 $('#dv').onclick=()=>{const on=pad.hidden;pad.hidden=!on;$('#dv').textContent=on?'Stop drawing (move the map)':'✏️ Draw my route'};
 $('#cl').onclick=()=>{geo=null;clearRoute();$('#info').textContent='Cleared.'};
 if(sr)sr.onchange=()=>{reuse=mine.find(m=>m.id===sr.value)||null;mode()};
 if(reuse)mode();
 $('#pub').onclick=async()=>{const date=$('#dt').value,time=$('#tm').value,seats=+$('#st').value,days=date?[DAYS[(new Date(date+'T12:00').getDay()+6)%7]]:[];let route=reuse;
  if(!reuse){const rn=$('#rn').value.trim();if(!rn||!geo)return alert('Enter a route name and draw your route.');
   route={driver_name:u.name,whatsapp_number:u.phone,name:rn,direction:$('#dd').value,route_geojson:geo,note:$('#nt').value.trim()}}
  if(!time||!date||!(seats>0))return alert('Choose a date, a departure time and the number of seats.');if(depAt({date,departure_time:time})+36e5<Date.now())return alert('This time has already passed.');
  await Store.create(u.id,route,{departure_time:time,date,days,seats_total:seats});location.hash='#/me'}}

/* ---- Manage one of my rides: review requests ---- */
async function manageView(id){const u=need();if(!u)return;const r=await Store.myRide(id,u.id);
 if(!r){app.innerHTML='<div class="card">Ride not found. <a href="#/me">Back</a></div>';return}
 const qs=await Store.requests(id,u.id),pend=qs.filter(q=>q.status==='pending'),acc=qs.filter(q=>q.status==='accepted');
 app.innerHTML=`<a class="back" href="#/me">← My account</a><div class="card"><h2>${esc(r.route.name)}</h2>
 <div><b class="tm">${r.departure_time}</b> <span class="tag">${r.expired?'Expired':r.active?'Active':'Inactive'}</span> <span class="muted">${dayLabel(r)} · <b>${r.seats_available}</b> of ${r.seats_total} seats left</span></div>
 <div class="mapw"><div id="map"></div></div>
 <h3>Requests to review (${pend.length})</h3><div>${pend.map(q=>`<div class="req" data-q="${q.id}">${avatar(q.user)}<div class="rb"><b>${esc(q.user.name)}</b><div>${badge(dropDist(r,q.drop))}</div><button class="btn alt show">Show drop-off</button></div><div><button class="btn ok acc">Accept</button><button class="btn no dec">Decline</button></div></div>`).join('')||'<div class="muted">No pending requests.</div>'}</div>
 <h3>Accepted riders</h3><div>${acc.map(q=>`<div class="req">${avatar(q.user)}<div class="rb"><b>${esc(q.user.name)}</b><div>${badge(dropDist(r,q.drop))}</div></div></div>`).join('')||'<div class="muted">Nobody yet.</div>'}</div>
 <a class="btn" href="#/chat/${r.id}">Open group chat</a><button class="btn alt" id="ac">${r.active?'Deactivate':'Reactivate'}</button><button class="btn no" id="dl">Delete ride</button></div>`;
 initMap('map');showRoute(r.route.route_geojson);const mk={};
 qs.filter(q=>q.status!=='declined').forEach(q=>{mk[q.id]=L.circleMarker([q.drop.lat,q.drop.lng],{radius:8,color:q.status==='accepted'?'#1a8f4a':'#e08a00',fillOpacity:.9}).addTo(M).bindTooltip(q.user.name+' (drop-off)',{permanent:true,direction:'top'})});
 document.querySelectorAll('.req[data-q]').forEach(el=>{const qid=el.dataset.q;
  el.querySelector('.show').onclick=()=>{M.setView(mk[qid].getLatLng(),16);scrollTo(0,document.querySelector('.mapw').offsetTop-80)};
  el.querySelector('.acc').onclick=async()=>{try{await Store.decide(qid,u.id,true);manageView(id)}catch(e){alert(e.message)}};
  el.querySelector('.dec').onclick=async()=>{await Store.decide(qid,u.id,false);manageView(id)}});
 $('#ac').onclick=async()=>{await Store.update(id,u.id,{active:!r.active});manageView(id)};
 $('#dl').onclick=async()=>{if(confirm('Delete this ride for good?')){await Store.remove(id,u.id);location.hash='#/me'}}}

/* ---- My account: profile (with photo) + history ---- */
const shrink=f=>new Promise(res=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas'),s=Math.min(im.width,im.height);c.width=c.height=160;c.getContext('2d').drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,160,160);res(c.toDataURL('image/jpeg',.8))};im.src=URL.createObjectURL(f)});
const RS={pending:'⏳ Pending',accepted:'✅ Accepted',declined:'❌ Declined'};
async function accountView(){const u=need();if(!u)return;const [rides,routes,reqs,pc]=await Promise.all([Store.myRides(u.id),Store.myRoutes(u.id),Store.myRequests(u.id),Store.pending(u.id)]);let photo=u.photo;
 app.innerHTML=`<div class="card prof"><label class="ph" title="Change photo">${avatar({name:u.name,photo},'av big')}<input id="pf" type="file" accept="image/*" hidden><span>Change photo</span></label>
 <div class="pfields"><label>Name</label><input id="pn" value="${esc(u.name)}"><label>WhatsApp number</label><input id="pp" value="${esc(u.phone)}"><div class="muted">${esc(u.email)}</div>
 <button class="btn" id="sv">Save profile</button>${window.Notification&&Notification.permission==='default'?'<button class="btn alt" id="nt">🔔 Enable alerts</button>':''}<button class="btn alt" id="lo">Log out</button> <span id="ok" class="muted"></span></div></div>
 <h3>My requests</h3>${reqs.length?reqs.map(r=>`<div class="card ride2"><div><b class="tm">${r.departure_time}</b> <span class="tag">${RS[r.request.status]}</span><div>${esc(r.route.name)} · ${dayLabel(r)}</div><div class="muted">Driver: ${esc(r.route.driver_name)}</div></div><div>${r.request.status==='accepted'?`<a class="btn alt" href="#/chat/${r.id}">Chat</a>`:''}<a class="btn alt" href="#/ride/${r.id}">View</a></div></div>`).join(''):'<div class="card muted">No requests yet. <a href="#/rides">Browse rides</a>.</div>'}
 <h3>My rides</h3>${rides.length?rides.map(r=>`<div class="card ride2"><div><b class="tm">${r.departure_time}</b> <span class="tag">${r.expired?'Expired':r.active?'Active':'Inactive'}</span>${pc[r.id]?` <span class="dot">${pc[r.id]} new request${pc[r.id]>1?'s':''}</span>`:''}<div>${esc(r.route.name)}</div><div class="muted">${dayLabel(r)} · ${r.seats_available}/${r.seats_total} seats</div></div><div><a class="btn alt" href="#/manage/${r.id}">Requests</a></div></div>`).join(''):'<div class="card muted">No rides yet. <a href="#/create">Offer your first ride</a>.</div>'}
 <h3>My saved roads</h3>${routes.length?routes.map(r=>`<div class="card ride2"><div><b>${esc(r.name)}</b> <span class="tag">${DIR[r.direction]}</span></div><div><a class="btn alt" href="#/create/${r.id}">Offer again</a><button class="btn no" data-rt="${r.id}">Remove</button></div></div>`).join(''):'<div class="card muted">Roads you draw are saved here, so you never draw them twice.</div>'}`;
 $('#pf').onchange=async e=>{if(e.target.files[0]){photo=await shrink(e.target.files[0]);$('.ph .av').outerHTML=avatar({name:u.name,photo},'av big')}};
 $('#sv').onclick=async()=>{const n=$('#pn').value.trim(),p=$('#pp').value.trim();if(!n||p.replace(/\D/g,'').length<8)return alert('Enter a name and a valid phone number.');try{await Auth.update(u.id,{name:n,phone:p,photo});nav();$('#ok').textContent='Saved ✔'}catch(e){alert(e.message)}};
 if($('#nt'))$('#nt').onclick=()=>{Notify.enable();$('#nt').remove()};
 $('#lo').onclick=()=>{Notify.stop();Auth.logout();nav();location.hash='#/'};
 document.querySelectorAll('[data-rt]').forEach(b=>b.onclick=async()=>{if(confirm('Remove this saved road?')){await Store.delRoute(b.dataset.rt,u.id);accountView()}})}

/* ---- Router ---- */
function router(){if(M){M.remove();M=null}if(CHAT){clearInterval(CHAT);CHAT=null}if(CHCH){sb.removeChannel(CHCH);CHCH=null}const [,p,arg]=(location.hash.slice(1)||'/').split('/');scrollTo(0,0);
 (!p&&!Auth.me()?registerView:{rides:home,ride:rideView,create:createView,manage:manageView,login:loginView,chat:chatView,register:registerView,me:accountView}[p]||home)(arg);nav();$('#locbar').style.display=(p==='rides'||p==='ride'||(!p&&Auth.me()))?'':'none'}
/* ---- Your position (kept in memory only, never stored) ---- */
let ME=null;
const locate=()=>new Promise((res,rej)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{ME={lat:p.coords.latitude,lng:p.coords.longitude};res(ME)},rej,{enableHighAccuracy:true,timeout:10000}):rej());
const near=r=>{if(!ME)return'';const i=rideInfo(r,ME);return i.near?`<div class="muted" style="color:var(--acc)">📍 ${fd(i.dist)} from you · reaches you ≈ ${i.arrive}</div>`:`<div class="muted">📍 ${fd(i.dist)} from you</div>`};
function locBar(){const b=$('#locbar');if(ME){b.hidden=true;return}b.hidden=false;
 b.innerHTML='📍 Allow your location to see which rides pass near you and when the driver reaches you. <button class="btn alt" id="lb">Share my location</button>';
 $('#lb').onclick=async()=>{try{await locate();locBar();router()}catch(e){b.textContent='Location was not allowed. You can still browse all rides.'}}}
function drawYou(r){if(!ME)return;const i=rideInfo(r,ME);
 L.circleMarker([ME.lat,ME.lng],{radius:9,color:'#1a73e8',fillOpacity:.9}).addTo(M).bindTooltip('You',{permanent:true,direction:'top'});
 L.polyline([[ME.lat,ME.lng],[i.point[1],i.point[0]]],{color:'#1a73e8',dashArray:'5 6',weight:3}).addTo(M);
 L.marker([i.point[1],i.point[0]]).addTo(M).bindPopup('Closest point on the road');
 M.fitBounds(RL.getBounds().extend([ME.lat,ME.lng]),{padding:[30,30]})}
function etaBlock(r){const b=$('#eta');
 if(!ME){b.innerHTML='<div class="loc2">Share your location to see when the driver reaches you. <button class="btn alt" id="eb">Share my location</button></div>';
  $('#eb').onclick=async()=>{try{await locate();locBar();drawYou(r);etaBlock(r)}catch(e){alert('Location was not allowed.')}};return}
 const i=rideInfo(r,ME),to=r.route.direction==='to_iit';
 b.innerHTML=i.near?`<div class="loc2 ok"><b>✅ This road passes ${fd(i.dist)} from you</b> (about ${Math.max(1,Math.round(i.dist/80))} min walk).<br>${to?'Be at the meeting point by':'The driver passes the point closest to you at about'} <b>${i.arrive}</b>.
  <div class="muted">He leaves at ${r.departure_time} and drives ${fd(i.along)} to reach it, about ${Math.round(i.mins)} min. This is an estimate with typical rush-hour speeds, not live traffic.</div></div>`
  :`<div class="loc2 ko"><b>❌ This road passes ${fd(i.dist)} from you.</b> It does not pass near your location.</div>`}
addEventListener('hashchange',router);Auth.init().catch(e=>console.error(e)).finally(router);
if(navigator.permissions)navigator.permissions.query({name:'geolocation'}).then(p=>{if(p.state==='granted')locate().then(()=>{locBar();router()})}).catch(()=>{});
locBar();
