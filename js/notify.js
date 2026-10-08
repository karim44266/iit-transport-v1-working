/* In-app notifications (realtime): new requests, accepted/declined, new chat messages. */
/* Background alerts (Web Push): works even when the app is closed. */
const Push={
 b64:s=>Uint8Array.from(atob((s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)),
 can(){return !!(window.Notification&&'serviceWorker' in navigator&&'PushManager' in window&&VAPID_PUBLIC_KEY)},
 async enable(){
  if(!(window.Notification&&'PushManager' in window))throw Error('This browser cannot receive background alerts. On iPhone: tap Share, then Add to Home Screen, and open the app from there.');
  if(!VAPID_PUBLIC_KEY)throw Error('Alerts are not configured yet.');
  if(await Notification.requestPermission()!=='granted')throw Error('Alerts were not allowed. You can allow them in your phone or browser settings.');
  await this.save()},
 async save(){const u=Auth.me();if(!u||!this.can())return;const reg=await navigator.serviceWorker.ready;
  const sub=(await reg.pushManager.getSubscription())||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:this.b64(VAPID_PUBLIC_KEY)}),j=sub.toJSON();
  must(await sb.rpc('save_push',{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth}))},
 async forget(){try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub)await sb.rpc('forget_push',{p_endpoint:sub.endpoint})}catch(e){}},
 send(body){try{sb.functions.invoke('notify',{body}).catch(()=>{})}catch(e){}}};
const Notify=(()=>{let ch=null,uid=null,box=null;
 const toast=(t,href)=>{if(!box){box=document.createElement('div');box.id='toasts';document.body.appendChild(box)}
  const d=document.createElement('div');d.className='toast';d.textContent=t;d.onclick=()=>{location.hash=href;d.remove()};box.appendChild(d);setTimeout(()=>d.remove(),7000);
  if(document.hidden&&window.Notification&&Notification.permission==='granted')new Notification('IIT Transport',{body:t})};
 const badge=async()=>{const u=Auth.me();if(!u)return;try{const p=await Store.pending(u.id),c=Object.values(p).reduce((a,x)=>a+x,0);document.querySelectorAll('.nb').forEach(b=>{b.textContent=c;b.hidden=!c});document.title=(c?'('+c+') ':'')+'IIT Transport'}catch(e){}};
 const who=async id=>{try{const{data}=await sb.from('profiles').select('name').eq('id',id).maybeSingle();return data?data.name:'Someone'}catch(e){return'Someone'}};
 const start=u=>{uid=u.id;ch=sb.channel('notif-'+u.id)
  .on('postgres_changes',{event:'*',schema:'public',table:'requests'},async p=>{const n=p.new||{};
   if(p.eventType==='INSERT'&&n.user_id!==uid)toast('🔔 New ride request from '+await who(n.user_id),'#/manage/'+n.ride_id);
   if(p.eventType==='UPDATE'&&n.user_id===uid&&n.status==='accepted')toast('✅ Your request was accepted!','#/chat/'+n.ride_id);
   if(p.eventType==='UPDATE'&&n.user_id===uid&&n.status==='declined')toast('❌ A driver declined your request','#/me');
   badge()})
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async p=>{const n=p.new;
   if(!n.user_id||n.user_id===uid||location.hash==='#/chat/'+n.ride_id)return;toast('💬 '+await who(n.user_id)+': '+n.text.slice(0,60),'#/chat/'+n.ride_id)})
  .subscribe();badge();if(window.Notification&&Notification.permission==='granted')Push.save().catch(()=>{})};
 return{sync(){const u=Auth.me();if(u&&uid!==u.id){this.stop();start(u)}else if(!u&&uid)this.stop();else if(u)badge()},
  stop(){if(ch)sb.removeChannel(ch);ch=null;uid=null},enable(){if(window.Notification)Notification.requestPermission()}}})();
