/* In-app notifications (realtime): new requests, accepted/declined, new chat messages. */
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
  .subscribe();badge()};
 return{sync(){const u=Auth.me();if(u&&uid!==u.id){this.stop();start(u)}else if(!u&&uid)this.stop();else if(u)badge()},
  stop(){if(ch)sb.removeChannel(ch);ch=null;uid=null},enable(){if(window.Notification)Notification.requestPermission()}}})();
