const GREEN='#0b6e4f',IIT=[34.81,10.74]; /* IIT position is approximate: paste exact coordinates here */
const MAPTILER_KEY=''; /* optional free key; empty = OpenStreetMap tiles (fine for testing, not for heavy traffic) */
let M=null,RL=null;
function initMap(id){M=L.map(id).setView(IIT,13);RL=null;
 const url=MAPTILER_KEY?`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`:'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
 L.tileLayer(url,{maxZoom:19,tileSize:MAPTILER_KEY?512:256,zoomOffset:MAPTILER_KEY?-1:0,attribution:'© OpenStreetMap contributors'}).addTo(M);
 L.marker(IIT).addTo(M).bindPopup('IIT');return M}
function showRoute(geo){clearRoute();RL=L.geoJSON(geo,{style:{color:GREEN,weight:6}}).addTo(M);M.fitBounds(RL.getBounds(),{padding:[24,24]})}
function clearRoute(){if(RL){RL.remove();RL=null}}
/* Freehand drawing: finger/mouse on a transparent pad over the map, saved as a GeoJSON LineString [lng,lat] */
function drawTool(pad,onDone){let pts=[],dr=false,ln=null;
 const P=e=>{const r=pad.getBoundingClientRect();return M.containerPointToLatLng(L.point(e.clientX-r.left,e.clientY-r.top))};
 pad.onpointerdown=e=>{pad.setPointerCapture(e.pointerId);dr=true;pts=[P(e)];clearRoute();if(ln)ln.remove();ln=L.polyline(pts,{color:GREEN,weight:6}).addTo(M)};
 pad.onpointermove=e=>{if(dr){pts.push(P(e));ln.setLatLngs(pts)}};
 pad.onpointerup=()=>{if(!dr)return;dr=false;if(ln){ln.remove();ln=null}if(pts.length<4)return;
  const a=[];for(const p of pts)if(!a.length||a[a.length-1].distanceTo(p)>4)a.push(p);a.push(pts[pts.length-1]);
  const geo={type:'Feature',properties:{},geometry:{type:'LineString',coordinates:a.map(p=>[+p.lng.toFixed(6),+p.lat.toFixed(6)])}};
  showRoute(geo);onDone(geo)}}
