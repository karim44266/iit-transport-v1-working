const GREEN=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()||'#1e4b9a',IIT=[34.8410896,10.7551184]; /* exact IIT pin from Google Maps */
const MAPTILER_KEY=''; /* optional free key; empty = OpenStreetMap tiles (fine for testing, not for heavy traffic) */
let M=null,RL=null;
const ICO={full:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:11px"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
 loc:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="display:block;margin:10px"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>'};
function initMap(id){document.body.style.overflow='';
 M=L.map(id,{preferCanvas:true,zoomSnap:.5,tapTolerance:15}).setView(IIT,13);RL=null;
 const url=MAPTILER_KEY?`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`:'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
 L.tileLayer(url,{maxZoom:19,tileSize:MAPTILER_KEY?512:256,zoomOffset:MAPTILER_KEY?-1:0,attribution:MAPTILER_KEY?'© MapTiler © OpenStreetMap contributors':'© OpenStreetMap contributors'}).addTo(M);
 L.marker(IIT,{icon:L.divIcon({className:'',html:'<div class="iit-pin">IIT</div>',iconSize:[38,38],iconAnchor:[19,19]}),zIndexOffset:500}).addTo(M).bindPopup('<b>IIT</b><br>Institut International de Technologie');
 const w=document.getElementById(id).parentElement;
 const ctl=(title,svg,fn)=>{const C=L.Control.extend({onAdd(){const b=L.DomUtil.create('div','leaflet-bar'),a=L.DomUtil.create('a','',b);a.href='#';a.title=title;a.setAttribute('role','button');a.setAttribute('aria-label',title);a.innerHTML=svg;
  L.DomEvent.disableClickPropagation(b);L.DomEvent.on(a,'click',ev=>{L.DomEvent.preventDefault(ev);fn()});return b}});new C({position:'topleft'}).addTo(M)};
 if(w&&w.classList.contains('mapw')){
  const fs=on=>{w.classList.toggle('fs',on);document.body.style.overflow=on?'hidden':'';setTimeout(()=>M&&M.invalidateSize(),60)};
  const x=document.createElement('button');x.type='button';x.className='fsclose';x.textContent='✕ Close map';x.onclick=()=>fs(false);w.appendChild(x);
  ctl('Full screen',ICO.full,()=>fs(!w.classList.contains('fs')));
  document.addEventListener('keydown',function k(e){if(!M){document.removeEventListener('keydown',k);return}if(e.key==='Escape'&&w.classList.contains('fs'))fs(false)})}
 ctl('My position',ICO.loc,()=>{if(!navigator.geolocation)return alert('Location is not available on this device.');
  navigator.geolocation.getCurrentPosition(p=>{const ll=[p.coords.latitude,p.coords.longitude];M.setView(ll,16);if(M._me)M._me.remove();M._me=L.circleMarker(ll,{radius:8,color:'#fff',weight:3,fillColor:'#2f6fdb',fillOpacity:1}).addTo(M)},
   ()=>alert('Location is blocked. Allow it in your browser settings (it also needs the https link).'),{enableHighAccuracy:true,timeout:10000})});
 return M}
/* A route = white casing + coloured line + green start dot + red end dot */
const LINE={lineCap:'round',lineJoin:'round',interactive:false},DOT=(c)=>({radius:9,color:'#fff',weight:3,fillColor:c,fillOpacity:1,interactive:false});
function showRoute(geo){clearRoute();const c=geo&&geo.geometry&&geo.geometry.coordinates;if(!c||c.length<2)return;const p=c.map(q=>[q[1],q[0]]);
 RL=L.featureGroup([L.polyline(p,{...LINE,color:'#fff',weight:11,opacity:.95}),L.polyline(p,{...LINE,color:GREEN,weight:6}),L.circleMarker(p[0],DOT('#1a8f4a')),L.circleMarker(p[p.length-1],DOT('#d6322a'))]).addTo(M);
 M.fitBounds(RL.getBounds(),{padding:[30,30]})}
function clearRoute(){if(RL){RL.remove();RL=null}}
/* Drawing on the map. One finger draws, TWO fingers zoom/move the map, so you never have to stop.
   Each new stroke continues the route (starting near where you stopped); Undo removes the last stroke. */
function mapDraw(onChange){const c=M.getContainer(),w=c.parentElement,D={on:false,segs:[],cur:null},ptrs=new Set();
 const casing=L.polyline([],{...LINE,color:'#fff',weight:11,opacity:.95}),line=L.polyline([],{...LINE,color:GREEN,weight:6}),
  ds=L.circleMarker([0,0],{...DOT('#1a8f4a'),opacity:0,fillOpacity:0}),de=L.circleMarker([0,0],{...DOT('#d6322a'),opacity:0,fillOpacity:0});
 const DG=L.featureGroup([casing,line,ds,de]).addTo(M);
 const flat=()=>[].concat(...D.segs,D.cur||[]),km=()=>{const p=flat();let t=0;for(let i=1;i<p.length;i++)t+=p[i-1].distanceTo(p[i]);return t/1000};
 const vis=(m,on)=>m.setStyle({opacity:on?1:0,fillOpacity:on?1:0});
 const redraw=()=>{const p=flat();casing.setLatLngs(p);line.setLatLngs(p);if(p.length>1){ds.setLatLng(p[0]);de.setLatLng(p[p.length-1])}vis(ds,p.length>1);vis(de,p.length>1)};
 const geo=()=>{const p=[].concat(...D.segs);return p.length>1?{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:p.map(q=>[+q.lng.toFixed(6),+q.lat.toFixed(6)])}}:null};
 /* toolbar */
 const bar=document.createElement('div');bar.className='mbar';
 bar.innerHTML='<button type="button" data-a="draw" class="pulse">✏️ Draw</button><button type="button" data-a="move" class="on">✋ Move</button><button type="button" data-a="undo" disabled>↩ Undo</button><button type="button" data-a="clear" disabled>🗑 Clear</button>';
 w.appendChild(bar);L.DomEvent.disableClickPropagation(bar);const B=a=>bar.querySelector('[data-a='+a+']');
 const changed=()=>{redraw();B('undo').disabled=B('clear').disabled=!D.segs.length;if(onChange)onChange(geo(),km())};
 D.setOn=on=>{D.on=on;ptrs.clear();D.cur=null;redraw();c.style.touchAction=on?'none':'';c.classList.toggle('drawing',on);
  M.dragging[on?'disable':'enable']();M.doubleClickZoom[on?'disable':'enable']();B('draw').classList.toggle('on',on);B('move').classList.toggle('on',!on);B('draw').classList.remove('pulse')};
 D.undo=()=>{D.segs.pop();changed()};D.clear=()=>{D.segs=[];D.cur=null;changed()};D.geo=geo;D.km=km;
 D.enable=v=>{bar.hidden=!v;if(!v){D.setOn(false);D.segs=[];D.cur=null;redraw()}};
 bar.addEventListener('click',e=>{const a=e.target.dataset&&e.target.dataset.a;if(a==='draw')D.setOn(true);if(a==='move')D.setOn(false);if(a==='undo')D.undo();if(a==='clear')D.clear()});
 /* pointer handling */
 const px=ll=>M.latLngToContainerPoint(ll),skip=e=>e.target.closest&&e.target.closest('.leaflet-control,.mbar,.fsclose');
 const seg=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;if(!l)return Math.hypot(p.x-a.x,p.y-a.y);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)};
 const simplify=pts=>{if(pts.length<3)return pts;const P=pts.map(px),keep=new Uint8Array(pts.length),st=[[0,pts.length-1]];keep[0]=keep[pts.length-1]=1;
  while(st.length){const[a,b]=st.pop();let md=0,mi=-1;for(let i=a+1;i<b;i++){const d=seg(P[i],P[a],P[b]);if(d>md){md=d;mi=i}}if(md>2&&mi>0){keep[mi]=1;st.push([a,mi],[mi,b])}}
  return pts.filter((_,i)=>keep[i])};
 let raf=0;const later=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;redraw()})};
 c.addEventListener('pointerdown',e=>{if(!D.on||skip(e)||(e.pointerType==='mouse'&&e.button!==0))return;ptrs.add(e.pointerId);
  if(ptrs.size>1){D.cur=null;redraw();return}                     /* second finger = zoom gesture, not drawing */
  let ll=M.mouseEventToLatLng(e);const last=D.segs.length&&D.segs[D.segs.length-1].slice(-1)[0];
  if(last&&px(last).distanceTo(px(ll))<44)ll=last;                /* continue from where you stopped */
  D.cur=[ll];redraw()});
 c.addEventListener('pointermove',e=>{if(!D.cur||ptrs.size!==1||!ptrs.has(e.pointerId))return;const ll=M.mouseEventToLatLng(e);
  if(px(ll).distanceTo(px(D.cur[D.cur.length-1]))<4)return;D.cur.push(ll);later()});
 const end=e=>{if(!ptrs.has(e.pointerId))return;ptrs.delete(e.pointerId);if(ptrs.size||!D.cur)return;const s=D.cur;D.cur=null;if(s.length>=2)D.segs.push(simplify(s));changed()};
 c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);c.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')end(e)});
 return D}
