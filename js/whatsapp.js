/* wa.me link only. The number is used to build the link and is never shown on the page. */
function waLink(r){let n=String(r.route.whatsapp_number).replace(/\D/g,'');if(n.length===8)n='216'+n;
 const msg=`Hi ${r.route.driver_name}, I saw your ride (${DIR[r.route.direction]}, ${r.departure_time}, ${r.days.join('/')}) on IIT Transport. Do you have a seat?`;
 return`https://wa.me/${n}?text=${encodeURIComponent(msg)}`}
