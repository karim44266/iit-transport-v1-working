/* Arrival estimates. NO live traffic: speeds follow typical rush hours. Adjust SPEEDS / RUSH to match real Sfax traffic. */
const SPEEDS={normal:35,rush:20},RUSH=[[420,570],[960,1110]]; /* km/h; rush windows in minutes of day (07:00-09:30, 16:00-18:30) */
const kmh=m=>RUSH.some(([a,b])=>m%1440>=a&&m%1440<b)?SPEEDS.rush:SPEEDS.normal;
/* Closest point of a GeoJSON line ([lng,lat] pairs) to a person, plus the distance driven along the line to reach it */
function nearestOnLine(pt,line){const k=Math.cos(pt[1]*Math.PI/180),R=111320;let best={dist:1e12},cum=0;
 for(let i=0;i<line.length-1;i++){const A=line[i],B=line[i+1];
  const ax=(A[0]-pt[0])*k*R,ay=(A[1]-pt[1])*R,bx=(B[0]-pt[0])*k*R,by=(B[1]-pt[1])*R,dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;
  const t=l?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/l)):0,d=Math.hypot(ax+t*dx,ay+t*dy),seg=Math.sqrt(l);
  if(d<best.dist)best={dist:d,along:cum+t*seg,point:[A[0]+t*(B[0]-A[0]),A[1]+t*(B[1]-A[1])]};cum+=seg}
 return best}
function etaMin(alongM,depMin){let t=depMin,left=alongM;while(left>0){const s=Math.min(500,left);t+=s/1000/kmh(t)*60;left-=s}return t-depMin}
const toMin=s=>{const [h,m]=s.split(':');return +h*60+ +m};
const hm=m=>{m=Math.round(m)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
const fd=m=>m<1000?Math.round(m)+' m':(m/1000).toFixed(1)+' km';
function rideInfo(r,me){const n=nearestOnLine([me.lng,me.lat],r.route.route_geojson.geometry.coordinates),dep=toMin(r.departure_time),mins=etaMin(n.along,dep);
 return{dist:n.dist,along:n.along,point:n.point,mins,arrive:hm(dep+mins),near:n.dist<=500}}
