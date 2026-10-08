const GREEN=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()||'#c8102e',IIT=[34.8410896,10.7551184]; /* exact IIT pin from Google Maps */
const MAPTILER_KEY=''; /* optional free key; empty = OpenStreetMap tiles (fine for testing, not for heavy traffic) */
let M=null,RL=null;
function initMap(id){document.body.style.overflow='';M=L.map(id).setView(IIT,13);RL=null;
 const url=MAPTILER_KEY?`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`:'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
 L.tileLayer(url,{maxZoom:19,tileSize:MAPTILER_KEY?512:256,zoomOffset:MAPTILER_KEY?-1:0,attribution:MAPTILER_KEY?'© MapTiler © OpenStreetMap contributors':'© OpenStreetMap contributors'}).addTo(M);
 L.marker(IIT,{icon:L.divIcon({className:'',html:'<div class="iit-pin">IIT</div>',iconSize:[38,38],iconAnchor:[19,19]}),zIndexOffset:500}).addTo(M).bindPopup('<b>IIT</b><br>Institut International de Technologie');
 /* Full screen: big map for long routes. Works on every map; drawing buttons follow the page's own buttons. */
 const w=document.getElementById(id).parentElement;
 if(w&&w.classList.contains('mapw')){
  const bar=document.createElement('div');bar.className='fsbar';
  bar.innerHTML='<button type="button" data-a="draw">✏️ Draw</button><button type="button" data-a="clear">Clear</button><button type="button" data-a="close">✕ Close</button>';
  w.appendChild(bar);
  const dv=()=>document.getElementById('dv'),sync=()=>{const d=dv();bar.querySelector('[data-a=draw]').style.display=bar.querySelector('[data-a=clear]').style.display=d?'':'none';
   if(d)bar.querySelector('[data-a=draw]').textContent=d.textContent.includes('Stop')?'✋ Move map':'✏️ Draw'};
  const fs=on=>{w.classList.toggle('fs',on);document.body.style.overflow=on?'hidden':'';sync();setTimeout(()=>M&&M.invalidateSize(),60)};
  bar.onclick=e=>{const a=e.target.dataset.a;if(a==='close')fs(false);
   if(a==='draw'&&dv()){dv().click();sync()}if(a==='clear'){const c=document.getElementById('cl');if(c)c.click()}};
  const C=L.Control.extend({onAdd(){const b=L.DomUtil.create('div','leaflet-bar'),a=L.DomUtil.create('a','',b);a.href='#';a.title='Full screen';a.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:6px"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';a.style.cssText='width:30px;height:30px;display:block';
   L.DomEvent.disableClickPropagation(b);L.DomEvent.on(a,'click',ev=>{L.DomEvent.preventDefault(ev);fs(!w.classList.contains('fs'))});return b}});
  new C({position:'topleft'}).addTo(M);
  document.addEventListener('keydown',function k(e){if(!M){document.removeEventListener('keydown',k);return}if(e.key==='Escape'&&w.classList.contains('fs'))fs(false)})}
 return M}
function showRoute(geo){clearRoute();const c=geo&&geo.geometry&&geo.geometry.coordinates;if(!c||c.length<2)return;RL=L.geoJSON(geo,{style:{color:GREEN,weight:6}}).addTo(M);M.fitBounds(RL.getBounds(),{padding:[24,24]})}
function clearRoute(){if(RL){RL.remove();RL=null}}
/* Freehand drawing: finger/mouse on a transparent pad over the map, saved as a GeoJSON LineString [lng,lat] */
function drawTool(pad,onDone){let pts=[],dr=false,ln=null;
 const P=e=>{const r=pad.getBoundingClientRect();return M.containerPointToLatLng(L.point(e.clientX-r.left,e.clientY-r.top))};
 pad.onpointerdown=e=>{pad.setPointerCapture(e.pointerId);dr=true;pts=[P(e)];clearRoute();if(ln)ln.remove();ln=L.polyline(pts,{color:GREEN,weight:6}).addTo(M)};
 pad.onpointermove=e=>{if(dr){pts.push(P(e));ln.setLatLngs(pts)}};
 pad.onpointerup=()=>{if(!dr)return;dr=false;if(ln){ln.remove();ln=null}if(pts.length<4)return;
  const a=[];for(const p of pts)if(!a.length||a[a.length-1].distanceTo(p)>8)a.push(p);a.push(pts[pts.length-1]);
  const geo={type:'Feature',properties:{},geometry:{type:'LineString',coordinates:a.map(p=>[+p.lng.toFixed(6),+p.lat.toFixed(6)])}};
  showRoute(geo);onDone(geo)};
 pad.onpointercancel=()=>{dr=false;if(ln){ln.remove();ln=null}}}
