/* Data layer. Phase 3 replaces this file with supabase.js exposing the same async methods. */
const Store=(()=>{
 const K='iit-transport-v1',now=()=>new Date().toISOString();
 const get=()=>{try{return JSON.parse(localStorage.getItem(K))||{routes:[],rides:[],mine:[]}}catch(e){return{routes:[],rides:[],mine:[]}}};
 const put=d=>localStorage.setItem(K,JSON.stringify(d));
 const hex=a=>[...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const hash=async t=>(crypto.subtle?hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t))):t);
 const pub=({management_token_hash,...r})=>r;
 return{
  async rides(){const d=get();return d.rides.filter(r=>r.active).map(r=>({...pub(r),route:d.routes.find(x=>x.id===r.route_id)})).sort((a,b)=>a.departure_time.localeCompare(b.departure_time))},
  async ride(id){return(await this.rides()).find(r=>r.id===id)||null},
  async myRoutes(){const d=get();return d.routes.filter(r=>d.mine.includes(r.id))},
  async create(route,ride){const d=get();let rid=route.id;
   if(!rid){rid=crypto.randomUUID();d.routes.push({...route,id:rid,created_at:now(),updated_at:now()});d.mine.push(rid)}
   const tok=hex(crypto.getRandomValues(new Uint8Array(16)));
   d.rides.push({...ride,id:crypto.randomUUID(),route_id:rid,seats_available:ride.seats_total,active:true,management_token_hash:await hash(tok),created_at:now(),updated_at:now()});
   put(d);return tok},
  async byToken(t){const d=get(),h=await hash(t),r=d.rides.find(x=>x.management_token_hash===h);return r?{...pub(r),route:d.routes.find(x=>x.id===r.route_id)}:null},
  async update(t,patch){const d=get(),h=await hash(t),r=d.rides.find(x=>x.management_token_hash===h);if(!r)return null;Object.assign(r,patch,{updated_at:now()});put(d);return pub(r)},
  async remove(t){const d=get(),h=await hash(t);d.rides=d.rides.filter(x=>x.management_token_hash!==h);put(d)}
 }})();
