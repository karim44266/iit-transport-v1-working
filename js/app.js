const $=s=>document.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],DIR={to_iit:'Home → IIT',from_iit:'IIT → Home'};
const ago=iso=>{const m=Math.round((Date.now()-new Date(iso))/6e4);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'};
const card=r=>`<a class="card ride" href="#/ride/${r.id}"><div><b class="tm">${r.departure_time}</b> <span class="tag">${DIR[r.route.direction]}</span>
 <div>${esc(r.route.name)}</div><div class="muted">${r.days.join(' · ')} · updated ${ago(r.updated_at)}</div>${near(r)}</div>
 <div class="seats ${r.seats_available?'':'full'}">${r.seats_available?`<span>${r.seats_available}</span>seats`:'FULL'}</div></a>`;

/* ---- Home: public list with search and filters ---- */
async function home(){const all=await Store.rides();
 app.innerHTML=`<div class="filters"><input id="fq" class="wide" placeholder="Search a route or area (e.g. Gremda)">
 <select id="fd"><option value="">Any direction</option><option value="to_iit">Home → IIT</option><option value="from_iit">IIT → Home</option></select>
 <select id="fy"><option value="">Any day</option>${DAYS.map(d=>`<option>${d}</option>`).join('')}</select>
 <input id="ft" type="time" title="Leaves after"><label class="chk"><input id="fs" type="checkbox"> Seats available only</label></div><div id="list"></div>`;
 const draw=()=>{const q=$('#fq').value.trim().toLowerCase(),d=$('#fd').value,y=$('#fy').value,t=$('#ft').value,s=$('#fs').checked;
  const l=all.filter(r=>(!q||r.route.name.toLowerCase().includes(q))&&(!d||r.route.direction===d)&&(!y||r.days.includes(y))&&(!t||r.departure_time>=t)&&(!s||r.seats_available>0));
  $('#list').innerHTML=l.length?l.map(card).join(''):'<div class="card muted">No rides found. Be the first to <a href="#/create">offer one</a>.</div>'};
 ['fq','fd','fy','ft','fs'].forEach(i=>$('#'+i).oninput=draw);draw()}

/* ---- Ride details ---- */
async function rideView(id){const r=await Store.ride(id);
 if(!r){app.innerHTML='<div class="card">Ride not found or no longer active. <a href="#/">Back</a></div>';return}
 const full=!r.seats_available;
 app.innerHTML=`<a class="back" href="#/">← All rides</a><div class="card"><b class="tm">${r.departure_time}</b> <span class="tag">${DIR[r.route.direction]}</span>
 <h2>${esc(r.route.name)}</h2><div class="muted">${r.days.join(' · ')} · ${esc(r.route.driver_name)} · updated ${ago(r.updated_at)}</div>
 ${r.route.note?`<p>📝 ${esc(r.route.note)}</p>`:''}<div class="mapw"><div id="map"></div></div>
 <div id="eta" style="margin-top:12px"></div><div class="seatline">${full?'<span class="seats full">FULL</span>':`<b>${r.seats_available}</b> of ${r.seats_total} seats available`}</div>
 ${full?'<button class="btn" disabled>Ride is full</button>':`<a class="btn" target="_blank" rel="noopener" href="${waLink(r)}">Contact on WhatsApp</a>`}</div>`;
 initMap('map');showRoute(r.route.route_geojson);
 const c0=r.route.route_geojson.geometry.coordinates[0];L.circleMarker([c0[1],c0[0]],{radius:8,color:GREEN,fillOpacity:1}).addTo(M).bindTooltip('Driver starts',{permanent:true,direction:'top'});
 drawYou(r);etaBlock(r)}

/* ---- Create ride ---- */
async function createView(){const mine=await Store.myRoutes();let geo=null,reuse=null;
 app.innerHTML=`<a class="back" href="#/">← Back</a><div class="card"><h2>Offer a ride</h2>
 ${mine.length?`<label>Use one of your saved routes?</label><select id="sr"><option value="">No, draw a new route</option>${mine.map(m=>`<option value="${m.id}">${esc(m.name)} (${DIR[m.direction]})</option>`).join('')}</select>`:''}
 <div id="newr"><div class="row"><div><label>Your name</label><input id="dn"></div><div><label>WhatsApp number</label><input id="dw" type="tel" placeholder="e.g. 22 123 456"></div></div>
 <div class="row"><div><label>Route name</label><input id="rn" placeholder="e.g. Gremda → IIT"></div><div><label>Direction</label><select id="dd"><option value="to_iit">Home → IIT</option><option value="from_iit">IIT → Home</option></select></div></div>
 <label>Note (optional)</label><input id="nt" placeholder="e.g. meet in front of Block B"></div>
 <div class="row"><div><label>Departure time</label><input id="tm" type="time"></div><div><label>Seats</label><input id="st" type="number" min="1" max="8" value="3"></div></div>
 <label>Driving days</label><div class="days">${DAYS.map(d=>`<label class="chip"><input type="checkbox" value="${d}" ${d!=='Sat'&&d!=='Sun'?'checked':''}>${d}</label>`).join('')}</div>
 <div class="mapw"><div id="map"></div><div id="pad" hidden></div></div>
 <div id="drawbar"><button class="btn alt" id="dv" type="button">✏️ Draw my route</button><button class="btn alt" id="cl" type="button">Clear</button></div>
 <div class="muted" id="info">Tap "Draw my route", then draw with your finger. Tap again to move the map.</div>
 <button class="btn" id="pub">Publish ride</button></div>`;
 initMap('map');const pad=$('#pad'),sr=$('#sr');
 drawTool(pad,g=>{geo=g;reuse=null;if(sr)sr.value='';$('#info').textContent='Route drawn ✔ Draw again to replace it.'});
 $('#dv').onclick=()=>{const on=pad.hidden;pad.hidden=!on;$('#dv').textContent=on?'Stop drawing (move the map)':'✏️ Draw my route'};
 $('#cl').onclick=()=>{geo=null;clearRoute();$('#info').textContent='Cleared.'};
 if(sr)sr.onchange=()=>{reuse=mine.find(m=>m.id===sr.value)||null;pad.hidden=true;
  $('#newr').style.display=$('#drawbar').style.display=reuse?'none':'';
  if(reuse){geo=null;showRoute(reuse.route_geojson);$('#info').textContent='Using your saved route.'}else clearRoute()};
 $('#pub').onclick=async()=>{const days=[...document.querySelectorAll('.days input:checked')].map(x=>x.value),time=$('#tm').value,seats=+$('#st').value;let route=reuse;
  if(!reuse){const dn=$('#dn').value.trim(),dw=$('#dw').value.trim(),rn=$('#rn').value.trim();
   if(!dn||dw.replace(/\D/g,'').length<8||!rn||!geo)return alert('Enter your name, a valid WhatsApp number, a route name, and draw your route.');
   route={driver_name:dn,whatsapp_number:dw,name:rn,direction:$('#dd').value,route_geojson:geo,note:$('#nt').value.trim()}}
  if(!time||!days.length||!(seats>0))return alert('Choose a departure time, at least one day and the number of seats.');
  const tok=await Store.create(route,{departure_time:time,days,seats_total:seats});
  const link=location.href.split('#')[0]+'#/manage/'+tok;
  app.innerHTML=`<div class="card"><h2>Your ride is published ✔</h2><p>Save this <b>private link</b>. It is the only way to edit, deactivate or delete your ride, and it is not shown to anyone else.</p>
  <div class="linkbox" id="lk">${esc(link)}</div><button class="btn alt" id="cp">Copy link</button><a class="btn" href="#/manage/${tok}">Manage my ride</a></div>`;
  $('#cp').onclick=()=>{navigator.clipboard?navigator.clipboard.writeText(link).then(()=>$('#cp').textContent='Copied ✔'):prompt('Copy this link',link)}}}

/* ---- Manage ride (private token link) ---- */
async function manageView(tok){const r=await Store.byToken(tok);
 if(!r){app.innerHTML='<div class="card">This management link is not valid. <a href="#/">Back</a></div>';return}
 app.innerHTML=`<a class="back" href="#/">← All rides</a><div class="card"><h2>Manage your ride</h2><div id="mi"></div><div class="mapw"><div id="map"></div></div>
 <div class="muted" style="margin-top:8px">Keep this page's link private. Anyone who has it can change or delete this ride.</div></div>`;
 initMap('map');showRoute(r.route.route_geojson);
 const set=async p=>{Object.assign(r,await Store.update(tok,p));paint()};
 const paint=()=>{$('#mi').innerHTML=`<div><b class="tm">${r.departure_time}</b> <span class="tag">${r.active?'Active':'Inactive'}</span></div><div>${esc(r.route.name)} · ${r.days.join(' · ')}</div>
  <div class="stepper"><button class="btn alt" id="mn">−</button><span><b>${r.seats_available}</b> of ${r.seats_total} seats left</span><button class="btn alt" id="pl">+</button></div>
  <button class="btn alt" id="ac">${r.active?'Deactivate':'Reactivate'}</button><button class="btn no" id="dl">Delete ride</button>`;
  $('#mn').onclick=()=>set({seats_available:Math.max(0,r.seats_available-1)});
  $('#pl').onclick=()=>set({seats_available:Math.min(r.seats_total,r.seats_available+1)});
  $('#ac').onclick=()=>set({active:!r.active});
  $('#dl').onclick=async()=>{if(confirm('Delete this ride for good?')){await Store.remove(tok);location.hash='#/'}}};
 paint()}

/* ---- Router ---- */
function router(){if(M){M.remove();M=null}const [,p,arg]=(location.hash.slice(1)||'/').split('/');scrollTo(0,0);
 ({ride:rideView,create:createView,manage:manageView}[p]||home)(arg)}
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
addEventListener('hashchange',router);router();
if(navigator.permissions)navigator.permissions.query({name:'geolocation'}).then(p=>{if(p.state==='granted')locate().then(()=>{locBar();router()})}).catch(()=>{});
locBar();
