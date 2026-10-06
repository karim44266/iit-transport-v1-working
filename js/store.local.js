/* Data layer (localStorage demo). Phase 3: replace with Supabase exposing the same async methods. */
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const hex=a=>[...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async t=>(crypto.subtle?hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t))):t);
const DB='iit-transport-v3',USERS='iit-users-v1',SESSION='iit-session-v1',now=()=>new Date().toISOString();
const rd=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const Auth={
 me(){const id=localStorage.getItem(SESSION),u=rd(USERS,[]).find(x=>x.id===id);return u?{id:u.id,name:u.name,email:u.email,phone:u.phone,photo:u.photo||''}:null},
 pub(id){const u=rd(USERS,[]).find(x=>x.id===id);return u?{id:u.id,name:u.name,photo:u.photo||''}:{id,name:'?',photo:''}},
 update(id,p){const us=rd(USERS,[]),u=us.find(x=>x.id===id);if(!u)return null;Object.assign(u,p);localStorage.setItem(USERS,JSON.stringify(us));return this.me()},
 async register({name,email,phone,password}){const us=rd(USERS,[]);email=email.trim().toLowerCase();
  if(ALLOWED_DOMAINS.length&&!ALLOWED_DOMAINS.some(d=>email.endsWith('@'+d)))throw Error('Use your IIT email ('+ALLOWED_DOMAINS.map(d=>'@'+d).join(', ')+').');
  if(us.some(u=>u.email===email))throw Error('This email is already registered. Please log in.');
  const salt=uid(),u={id:uid(),name:name.trim(),email,phone,salt,hash:await sha(salt+password),created_at:now()};
  us.push(u);localStorage.setItem(USERS,JSON.stringify(us));localStorage.setItem(SESSION,u.id);return this.me()},
 async login(email,password){email=email.trim().toLowerCase();const u=rd(USERS,[]).find(x=>x.email===email);
  if(!u||u.hash!==await sha(u.salt+password))throw Error('Wrong email or password.');localStorage.setItem(SESSION,u.id);return this.me()},
 logout(){localStorage.removeItem(SESSION)}};
const depAt=r=>new Date(r.date+'T'+r.departure_time).getTime(),expired=r=>!r.date||Date.now()>depAt(r)+36e5; /* hidden 1h after departure */
const Store=(()=>{
 const get=()=>({routes:[],rides:[],contacts:[],requests:[],messages:[],...rd(DB,{})}),put=d=>localStorage.setItem(DB,JSON.stringify(d));
 const join=(d,r)=>({...r,route:d.routes.find(x=>x.id===r.route_id),expired:expired(r)});
 return{
  async rides(){const d=get();return d.rides.filter(r=>r.active&&!expired(r)).map(r=>join(d,r)).sort((a,b)=>(a.date+a.departure_time).localeCompare(b.date+b.departure_time))},
  async ride(id){return(await this.rides()).find(r=>r.id===id)||null},
  async rideAny(id){const d=get(),r=d.rides.find(x=>x.id===id);return r?join(d,r):null},
  async myRides(u){const d=get();return d.rides.filter(r=>r.owner_id===u).map(r=>join(d,r)).sort((a,b)=>b.created_at.localeCompare(a.created_at))},
  async myRide(id,u){return(await this.myRides(u)).find(r=>r.id===id)||null},
  async myRoutes(u){return get().routes.filter(r=>r.owner_id===u)},
  async create(u,route,ride){const d=get();let rid=route.id;
   if(!rid){rid=uid();d.routes.push({...route,id:rid,owner_id:u,created_at:now()})}
   d.rides.push({...ride,id:uid(),route_id:rid,owner_id:u,seats_available:ride.seats_total,active:true,created_at:now(),updated_at:now()});put(d)},
  async update(id,u,p){const d=get(),r=d.rides.find(x=>x.id===id&&x.owner_id===u);if(!r)return null;Object.assign(r,p,{updated_at:now()});put(d);return r},
  async remove(id,u){const d=get();if(!d.rides.some(x=>x.id===id&&x.owner_id===u))return;d.rides=d.rides.filter(x=>x.id!==id);d.requests=d.requests.filter(q=>q.ride_id!==id);d.messages=d.messages.filter(m=>m.ride_id!==id);put(d)},
  async delRoute(id,u){const d=get();d.routes=d.routes.filter(x=>!(x.id===id&&x.owner_id===u));put(d)},
  async logContact(u,rideId){const d=get();d.contacts.push({user_id:u,ride_id:rideId,at:now()});put(d)},
  /* ---- Requests (driver approves) + group chat of accepted riders ---- */
  async apply(id,u,name,drop){const d=get(),r=d.rides.find(x=>x.id===id);
   if(!r||!r.active||expired(r))throw Error('This ride is no longer available.');if(r.owner_id===u)throw Error('This is your own ride.');
   if(r.seats_available<1)throw Error('This ride is full.');
   if(d.requests.some(q=>q.ride_id===id&&q.user_id===u&&q.status!=='declined'))throw Error('You already requested this ride.');
   d.requests=d.requests.filter(q=>!(q.ride_id===id&&q.user_id===u));
   d.requests.push({id:uid(),ride_id:id,user_id:u,name,drop,status:'pending',at:now()});put(d)},
  async decide(qid,owner,accept){const d=get(),q=d.requests.find(x=>x.id===qid),r=q&&d.rides.find(x=>x.id===q.ride_id&&x.owner_id===owner);if(!r)return;
   if(!accept){q.status='declined';put(d);return}
   if(r.seats_available<1)throw Error('No seats left on this ride.');
   q.status='accepted';r.seats_available--;r.updated_at=now();
   d.requests=d.requests.filter(x=>!(x.user_id===q.user_id&&x.status==='pending')); /* rider got a seat: his other pending requests are removed */
   d.messages.push({id:uid(),ride_id:r.id,user_id:null,name:'',text:q.name+' joined the ride',at:now()});put(d)},
  async cancelRequest(id,u){const d=get(),q=d.requests.find(x=>x.ride_id===id&&x.user_id===u),r=d.rides.find(x=>x.id===id);if(!q)return;
   d.requests=d.requests.filter(x=>x!==q);
   if(q.status==='accepted'&&r){r.seats_available=Math.min(r.seats_total,r.seats_available+1);r.updated_at=now();d.messages.push({id:uid(),ride_id:id,user_id:null,name:'',text:q.name+' left the ride',at:now()})}put(d)},
  async requests(id,owner){const d=get();if(!d.rides.some(x=>x.id===id&&x.owner_id===owner))return[];return d.requests.filter(q=>q.ride_id===id).map(q=>({...q,user:Auth.pub(q.user_id)}))},
  async myRequest(id,u){return get().requests.find(q=>q.ride_id===id&&q.user_id===u)||null},
  async myRequests(u){const d=get();return d.requests.filter(q=>q.user_id===u).reverse().map(q=>{const r=d.rides.find(x=>x.id===q.ride_id);return r?{...join(d,r),request:q}:null}).filter(Boolean)},
  async pending(u){const d=get(),o={};d.requests.filter(q=>q.status==='pending').forEach(q=>{const r=d.rides.find(x=>x.id===q.ride_id);if(r&&r.owner_id===u&&!expired(r))o[r.id]=(o[r.id]||0)+1});return o},
  async passengers(id){return get().requests.filter(q=>q.ride_id===id&&q.status==='accepted').map(q=>({...q,user:Auth.pub(q.user_id)}))},
  async isMember(id,u){const d=get(),r=d.rides.find(x=>x.id===id);return !!r&&(r.owner_id===u||d.requests.some(q=>q.ride_id===id&&q.user_id===u&&q.status==='accepted'))},
  async messages(id,u){return(await this.isMember(id,u))?get().messages.filter(m=>m.ride_id===id):null},
  async send(id,u,name,text){if(!(await this.isMember(id,u)))throw Error('Join the ride to chat.');const d=get();d.messages.push({id:uid(),ride_id:id,user_id:u,name,text:text.slice(0,500),at:now()});put(d)}
 }})();
