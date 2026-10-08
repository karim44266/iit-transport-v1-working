/* Real backend: same Auth/Store interface as the old localStorage layer, so the screens did not change. */
if(!SUPABASE_URL||!SUPABASE_ANON_KEY)document.addEventListener('DOMContentLoaded',()=>{document.getElementById('app').innerHTML='<div class="card"><h2>Almost there</h2>Set SUPABASE_URL and SUPABASE_ANON_KEY in <b>js/config.js</b> (see README).</div>'});
const sb=supabase.createClient(SUPABASE_URL||'https://example.supabase.co',SUPABASE_ANON_KEY||'x');
const must=r=>{if(r.error)throw Error(r.error.message);return r.data};
const depAt=r=>new Date(r.date+'T'+r.departure_time).getTime(),expired=r=>!r.date||Date.now()>depAt(r)+36e5;
let CUR_USER=null;
const Auth={
 async init(){const{data:{session}}=await sb.auth.getSession();await this._load(session)},
 async _load(s){if(!s){CUR_USER=null;return}const d=must(await sb.rpc('my_profile')),p=Array.isArray(d)?d[0]:d;CUR_USER=p?{id:s.user.id,name:p.name,email:s.user.email,phone:p.phone||'',photo:p.photo||''}:null},
 me(){return CUR_USER},
 async register({name,email,phone,password}){email=email.trim().toLowerCase();
  if(ALLOWED_DOMAINS.length&&!ALLOWED_DOMAINS.some(d=>email.endsWith('@'+d)))throw Error('Use your IIT email ('+ALLOWED_DOMAINS.map(d=>'@'+d).join(', ')+').');
  const{data,error}=await sb.auth.signUp({email,password,options:{data:{name:name.trim(),phone}}});if(error)throw Error(error.message);
  if(!data.session)throw Error('Account created. Check your email to confirm it, then log in.');await this._load(data.session);return CUR_USER},
 async login(email,password){const{data,error}=await sb.auth.signInWithPassword({email:email.trim(),password});if(error)throw Error(error.message);await this._load(data.session);return CUR_USER},
 logout(){CUR_USER=null;sb.auth.signOut()},
 async update(id,p){must(await sb.from('profiles').update(p).eq('id',id));Object.assign(CUR_USER,p);return CUR_USER}};
const RIDE='*,route:routes(*),owner:profiles(name,photo)';
const shape=r=>({...r,expired:expired(r),route:{...r.route,driver_name:(r.owner&&r.owner.name)||'Driver',whatsapp_number:''}});
const Store={
 async rides(){return must(await sb.from('rides').select(RIDE).eq('active',true)).map(shape).filter(r=>!r.expired).sort((a,b)=>(a.date+a.departure_time).localeCompare(b.date+b.departure_time))},
 async ride(id){return(await this.rides()).find(r=>r.id===id)||null},
 async rideAny(id){const r=must(await sb.from('rides').select(RIDE).eq('id',id).maybeSingle());return r?shape(r):null},
 async myRides(u){return must(await sb.from('rides').select(RIDE).eq('owner_id',u).order('created_at',{ascending:false})).map(shape)},
 async myRide(id,u){return(await this.myRides(u)).find(r=>r.id===id)||null},
 async myRoutes(u){return must(await sb.from('routes').select('*').eq('owner_id',u).order('created_at',{ascending:false}))},
 async create(u,route,ride){let rid=route.id;
  if(!rid){const{name,direction,route_geojson,note}=route;rid=must(await sb.from('routes').insert({owner_id:u,name,direction,route_geojson,note:note||null}).select('id').single()).id}
  must(await sb.from('rides').insert({route_id:rid,owner_id:u,departure_time:ride.departure_time,date:ride.date,days:ride.days,seats_total:ride.seats_total,seats_available:ride.seats_total}))},
 async update(id,u,p){must(await sb.from('rides').update({...p,updated_at:new Date().toISOString()}).eq('id',id).eq('owner_id',u))},
 async remove(id,u){must(await sb.from('rides').delete().eq('id',id).eq('owner_id',u))},
 async delRoute(id,u){must(await sb.from('routes').delete().eq('id',id).eq('owner_id',u))},
 async logContact(){},
 async driverPhone(id){return must(await sb.rpc('driver_phone',{p_ride:id}))||''},
 async apply(id,u,name,drop){must(await sb.rpc('apply_ride',{p_ride:id,p_lat:drop.lat,p_lng:drop.lng}));Push.send({type:'request',ride_id:id})},
 async decide(qid,owner,accept){must(await sb.rpc('decide_request',{p_req:qid,p_accept:accept}));Push.send({type:'decision',request_id:qid})},
 async cancelRequest(id){must(await sb.rpc('cancel_request',{p_ride:id}))},
 async requests(id){return must(await sb.from('requests').select('*,user:profiles(name,photo)').eq('ride_id',id).order('created_at')).map(q=>({...q,name:q.user.name,drop:{lat:q.drop_lat,lng:q.drop_lng}}))},
 async myRequest(id,u){const q=must(await sb.from('requests').select('*').eq('ride_id',id).eq('user_id',u).maybeSingle());return q?{...q,drop:{lat:q.drop_lat,lng:q.drop_lng}}:null},
 async myRequests(u){return must(await sb.from('requests').select('*,ride:rides('+RIDE+')').eq('user_id',u).order('created_at',{ascending:false})).filter(q=>q.ride).map(q=>({...shape(q.ride),request:q}))},
 async pending(u){const o={};must(await sb.from('requests').select('ride_id,ride:rides!inner(owner_id,date,departure_time)').eq('status','pending').eq('ride.owner_id',u)).forEach(q=>{if(!expired(q.ride))o[q.ride_id]=(o[q.ride_id]||0)+1});return o},
 async passengers(id){return must(await sb.from('requests').select('*,user:profiles(name,photo)').eq('ride_id',id).eq('status','accepted')).map(q=>({...q,name:q.user.name}))},
 async isMember(id){return !!must(await sb.rpc('is_member',{p_ride:id}))},
 async messages(id){if(!(await this.isMember(id)))return null;return must(await sb.from('messages').select('*,p:profiles(name)').eq('ride_id',id).order('created_at')).map(m=>({id:m.id,ride_id:m.ride_id,user_id:m.user_id,name:(m.p&&m.p.name)||'',text:m.text,at:m.created_at}))},
 async send(id,u,name,text){must(await sb.from('messages').insert({ride_id:id,user_id:u,text:text.slice(0,500)}));Push.send({type:'message',ride_id:id})},
 async myChats(u){const[mine,asRider]=await Promise.all([this.myRides(u),this.myRequests(u)]);
  const has=new Set(must(await sb.from('requests').select('ride_id').eq('status','accepted')).map(q=>q.ride_id));
  const rides=[...mine.filter(r=>has.has(r.id)),...asRider.filter(r=>r.request.status==='accepted')];if(!rides.length)return[];
  const ms=must(await sb.from('messages').select('ride_id,text,created_at,user_id,p:profiles(name)').in('ride_id',rides.map(r=>r.id)).order('created_at',{ascending:false}).limit(300)),last={};
  ms.forEach(m=>{if(m.user_id&&!last[m.ride_id])last[m.ride_id]={text:m.text,name:m.user_id===u?'You':(m.p&&m.p.name)||'',at:m.created_at}});
  return rides.map(r=>({...r,last:last[r.id]||null})).sort((a,b)=>((b.last&&b.last.at)||b.created_at||'').localeCompare((a.last&&a.last.at)||a.created_at||''))}};
