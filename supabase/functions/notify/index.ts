// Edge Function "notify": sends a push alert after a request, an accept/decline, or a chat message.
// The caller's login is checked, and recipients are decided here (never trusted from the app).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...cors,'Content-Type':'application/json'}})
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 try{
  const url=Deno.env.get('SUPABASE_URL')
  const me=createClient(url,Deno.env.get('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:req.headers.get('Authorization')||''}}})
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const {data:{user}}=await me.auth.getUser()
  if(!user)return json({error:'not logged in'},401)
  const b=await req.json()
  const name=async id=>((await admin.from('profiles').select('name').eq('id',id).maybeSingle()).data||{}).name||'Someone'
  const rideInfo=async id=>{const r=(await admin.from('rides').select('id,owner_id,route_id').eq('id',id).maybeSingle()).data;if(!r)return null
   const ro=(await admin.from('routes').select('name').eq('id',r.route_id).maybeSingle()).data;return {...r,route:(ro&&ro.name)||'your ride'}}
  let to=[],msg=null
  if(b.type==='request'){
   const q=(await me.from('requests').select('status').eq('ride_id',b.ride_id).eq('user_id',user.id).maybeSingle()).data
   const r=q&&q.status==='pending'?await rideInfo(b.ride_id):null
   if(r){to=[r.owner_id];msg={title:'New ride request',body:(await name(user.id))+' wants a seat on '+r.route,url:'./#/manage/'+r.id}}
  }else if(b.type==='decision'){
   const q=(await admin.from('requests').select('id,ride_id,user_id,status').eq('id',b.request_id).maybeSingle()).data
   const r=q?await rideInfo(q.ride_id):null
   if(r&&r.owner_id===user.id&&(q.status==='accepted'||q.status==='declined')){to=[q.user_id]
    msg=q.status==='accepted'?{title:'Request accepted ✅',body:'You have a seat on '+r.route+'. Open the group chat.',url:'./#/chat/'+r.id}:{title:'Request declined',body:'The driver of '+r.route+' declined your request.',url:'./#/me'}}
  }else if(b.type==='message'){
   const mem=(await me.rpc('is_member',{p_ride:b.ride_id})).data
   const r=mem?await rideInfo(b.ride_id):null
   const m=r?(await me.from('messages').select('text,created_at').eq('ride_id',b.ride_id).eq('user_id',user.id).order('created_at',{ascending:false}).limit(1)).data:null
   if(r&&m&&m[0]&&Date.now()-new Date(m[0].created_at).getTime()<30000){
    const acc=(await admin.from('requests').select('user_id').eq('ride_id',r.id).eq('status','accepted')).data||[]
    to=[r.owner_id,...acc.map(x=>x.user_id)].filter(x=>x!==user.id)
    msg={title:r.route,body:(await name(user.id))+': '+m[0].text.slice(0,80),url:'./#/chat/'+r.id}}
  }
  if(!msg||!to.length)return json({sent:0})
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:admin@example.com',Deno.env.get('VAPID_PUBLIC_KEY'),Deno.env.get('VAPID_PRIVATE_KEY'))
  const subs=(await admin.from('push_subscriptions').select('endpoint,p256dh,auth_key').in('user_id',to)).data||[]
  let sent=0
  await Promise.all(subs.map(async s=>{try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth_key}},JSON.stringify(msg));sent++}
   catch(e){if(e.statusCode===404||e.statusCode===410)await admin.from('push_subscriptions').delete().eq('endpoint',s.endpoint)}}))
  return json({sent})
 }catch(e){return json({error:String((e&&e.message)||e)},500)}
})
