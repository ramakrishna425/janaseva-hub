const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let token=localStorage.getItem("jh_token")||"", user=null, authMode="login";
const headers=()=>({"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})});
async function api(url,opts={}){const r=await fetch(url,{...opts,headers:{...headers(),...(opts.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Request failed");return data}
function notice(msg,error=false){const n=$("#notice");n.textContent=msg;n.hidden=false;n.classList.toggle("error",error);setTimeout(()=>n.hidden=true,5000)}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function view(name){$$(".view").forEach(x=>x.classList.toggle("active",x.id===name));$$("[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===name));if(name==="services")window.loadServices();if(name==="live-updates")loadLiveUpdates();if(name==="planner")loadPlanner();window.scrollTo({top:0,behavior:"smooth"})}
$$("[data-view]").forEach(b=>b.addEventListener("click",()=>view(b.dataset.view)));
function updateAccount(){ $("#user-label").textContent=user?user.name:"Guest";$("#auth-button").textContent=user?"Sign out":"Sign in"; }
$("#auth-button").onclick=async()=>{if(user){token="";user=null;localStorage.removeItem("jh_token");updateAccount();loadDashboard();notice("Signed out.");}else openAuth()};
function openAuth(){authMode="login";$("#auth-title").textContent="Sign in";$("#name-wrap").hidden=true;$("#auth-password").autocomplete="current-password";$("#auth-dialog").showModal()}
$("#switch-auth").onclick=()=>{authMode=authMode==="login"?"register":"login";$("#auth-title").textContent=authMode==="login"?"Sign in":"Create account";$("#name-wrap").hidden=authMode==="login";$("#auth-password").autocomplete=authMode==="login"?"current-password":"new-password";$("#auth-switch").innerHTML=authMode==="login"?'New here? <button class="text-btn" id="switch-auth">Create an account</button>':'Already registered? <button class="text-btn" id="switch-auth">Sign in</button>';$("#switch-auth").onclick=()=>{authMode=authMode==="login"?"register":"login";$("#auth-title").textContent=authMode==="login"?"Sign in":"Create account";$("#name-wrap").hidden=authMode==="login";$("#auth-switch").innerHTML=authMode==="login"?'New here? <button class="text-btn" id="switch-auth">Create an account</button>':'Already registered? <button class="text-btn" id="switch-auth">Sign in</button>';$("#switch-auth").onclick=()=>location.reload()}}
$("#auth-form").onsubmit=async e=>{e.preventDefault();try{const data=await api(`/api/auth/${authMode}`,{method:"POST",body:JSON.stringify({name:$("#auth-name").value,email:$("#auth-email").value,password:$("#auth-password").value})});token=data.token;user=data.user;localStorage.setItem("jh_token",token);$("#auth-dialog").close();updateAccount();loadDashboard();notice("Welcome, "+user.name+".");}catch(e){notice(e.message,true)}};
async function loadDashboard(){
  if(user){
    try{
      const alerts=await api("/api/notifications");
      const unread=alerts.notifications.filter(x=>!x.read).length;
      const accountLabel=$("#user-label");
      if(accountLabel) accountLabel.title=`${unread} unread notification(s)`;
    }catch(e){/* Dashboard remains usable if personal notifications are unavailable. */}
  }
}
function showForm(title,fields,submit){$("#item-title").textContent=title;const form=$("#item-form");form.innerHTML=fields.map(f=>`<label>${f.label}${f.type==="textarea"?`<textarea name="${f.name}" rows="3" placeholder="${f.placeholder||""}"></textarea>`:`<input name="${f.name}" type="${f.type||"text"}" placeholder="${f.placeholder||""}" ${f.required?"required":""}>`}</label>`).join("")+'<button class="btn primary">Save</button>';form.onsubmit=async e=>{e.preventDefault();const obj=Object.fromEntries(new FormData(form));try{await submit(obj);$("#item-dialog").close();notice("Saved successfully.");loadDashboard();loadPlanner()}catch(err){notice(err.message,true)}};$("#item-dialog").showModal()}
async function loadPlanner(){if(!user){$("#reminders-list").innerHTML='<div class="empty">Sign in to use your personal planner and notifications.</div>';$("#feeds-list").innerHTML="";$("#notifications-list").innerHTML="";return}try{const [r,f,n]=await Promise.all([api("/api/reminders"),api("/api/feeds"),api("/api/notifications")]);$("#reminders-list").innerHTML=r.reminders.map(x=>`<div class="reminder"><label><input type="checkbox" ${x.done?"checked":""} onchange="toggleReminder(${x.id},this.checked)"> ${esc(x.title)} <small>${esc(x.due_at)}</small></label><button class="text-btn" onclick="deleteReminder(${x.id})">Delete</button></div>`).join("")||'<div class="empty">No reminders yet.</div>';$("#feeds-list").innerHTML=f.feeds.map(x=>`<div class="job-row"><span>${esc(x.name)}<small>${esc(x.url)}</small></span><button class="text-btn" onclick="deleteFeed(${x.id})">Remove</button></div>`).join("")||'<div class="empty">No feeds configured.</div>';$("#notifications-list").innerHTML=n.notifications.map(x=>`<div class="notification"><div><b>${esc(x.title)}</b><small>${esc(x.message)} · ${esc(x.created_at)}</small></div><div>${x.url?`<a href="${esc(x.url)}" target="_blank">Open ↗</a>`:""}<button class="text-btn" onclick="readNotification(${x.id})">${x.read?"Read":"Mark read"}</button></div></div>`).join("")||'<div class="empty">No notifications yet.</div>'}catch(e){notice(e.message,true)}}
$("#add-reminder").onclick=()=>{if(!user)return openAuth();showForm("Add reminder",[{name:"title",label:"Reminder",required:true},{name:"due_at",label:"Due date",type:"date",required:true}],o=>api("/api/reminders",{method:"POST",body:JSON.stringify({title:o.title,due_at:o.due_at})}))};
window.toggleReminder=async(id,done)=>{await api(`/api/reminders/${id}`,{method:"PATCH",body:JSON.stringify({done})});loadPlanner()};
window.deleteReminder=async id=>{await api(`/api/reminders/${id}`,{method:"DELETE"});loadPlanner()};
$("#add-feed").onclick=async()=>{if(!user)return openAuth();try{await api("/api/feeds",{method:"POST",body:JSON.stringify({name:$("#feed-name").value,url:$("#feed-url").value})});$("#feed-name").value=$("#feed-url").value="";notice("Feed added. It will be checked every 30 minutes while the server is running.");loadPlanner()}catch(e){notice(e.message,true)}};
window.deleteFeed=async id=>{await api(`/api/feeds/${id}`,{method:"DELETE"});loadPlanner()};
$("#check-feeds").onclick=async()=>{if(!user)return openAuth();try{await api("/api/feeds/check",{method:"POST"});notice("Feed check completed.");loadPlanner()}catch(e){notice(e.message,true)}};
window.readNotification=async id=>{await api(`/api/notifications/${id}/read`,{method:"PATCH"});loadPlanner();loadDashboard()};
$("#pct-go").onclick=()=>$("#pct-result").textContent=($("#pct-a").value*$("#pct-b").value/100).toLocaleString("en-IN",{maximumFractionDigits:2});
$("#age-go").onclick=()=>{const d=new Date($("#dob").value);if(isNaN(d))return;const n=new Date();let y=n.getFullYear()-d.getFullYear();if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))y--;$("#age-result").textContent=`Age: ${y} years`};
$("#si-go").onclick=()=>$("#si-result").textContent="Interest: ₹"+($("#si-p").value*$("#si-r").value*$("#si-t").value/100).toLocaleString("en-IN",{maximumFractionDigits:2});

let liveSearchTimer=null;
window.toggleLiveRead=function(id){const key="jh_live_read_"+id;localStorage.getItem(key)==="1"?localStorage.removeItem(key):localStorage.setItem(key,"1");loadLiveUpdates()};
function addLiveArchiveControls(){
 const filters=document.querySelector(".live-date-filters"); if(!filters||document.getElementById("live-archive-range"))return;
 const wrap=document.createElement("div");wrap.id="live-archive-range";wrap.className="live-archive-range";wrap.innerHTML='<span>Browse history:</span><button type="button" data-days="7">7 days</button><button type="button" data-days="30">30 days</button><button type="button" data-days="90">3 months</button><button type="button" data-days="all" class="selected">All time</button><label class="live-unread-toggle"><input type="checkbox" id="live-unread-only"> Unread only</label>';
 filters.insertAdjacentElement("afterend",wrap);
 wrap.querySelectorAll("button[data-days]").forEach(btn=>btn.addEventListener("click",()=>{const days=btn.dataset.days;const to=new Date();const from=new Date();if(days==="all"){document.getElementById("notice-from").value="";document.getElementById("notice-to").value=""}else{from.setDate(from.getDate()-Number(days));document.getElementById("notice-from").value=from.toISOString().slice(0,10);document.getElementById("notice-to").value=to.toISOString().slice(0,10)}wrap.querySelectorAll("button[data-days]").forEach(x=>x.classList.toggle("selected",x===btn));loadLiveUpdates()}));
 const unread=document.getElementById("live-unread-only");unread.addEventListener("change",loadLiveUpdates);
}
addLiveArchiveControls();
async function loadLiveUpdates(){
 const list=$("#live-updates-list"); if(!list)return;
 list.innerHTML='<div class="panel empty">Loading notifications…</div>';
 try{
  const params=new URLSearchParams({q:$("#live-search").value||"",category:$("#live-category").value||"all",from:$("#notice-from").value||"",to:$("#notice-to").value||""});
  const d=await api(`/api/public/notifications?${params.toString()}`);
  const checked=d.last_checked?new Date(d.last_checked).toLocaleString("en-IN"):"Not checked yet";
  $("#live-source-status").textContent=d.sources?.length?`${d.sources.length} official source monitored`:"No official sources configured";
  const feedError=(d.sources||[]).find(x=>x.last_error)?.last_error;
  $("#live-last-checked").textContent=`Last successful feed check: ${checked}${feedError?" · Source warning: "+feedError:""}`;
  $("#live-refresh-rate").textContent=`Auto refresh · ${d.refresh_minutes||15} min`;
  const visibleItems = document.getElementById("live-unread-only")?.checked ? d.items.filter(item=>localStorage.getItem("jh_live_read_"+`${item.kind}-${item.id}`)!=="1") : d.items;
  list.innerHTML=visibleItems.map(item=>{
   const when=item.published_date||"Date not available";
   const kind=item.kind==="job"?"Recruitment listing":"Official feed";
   const readId=`${item.kind}-${item.id}`;
   const isRead=localStorage.getItem("jh_live_read_"+readId)==="1";
   return `<article class="live-card ${isRead?"live-card-read":""}"><div class="live-card-head"><div><span class="tag">${esc(item.category||kind)}</span> ${item.archived?'<span class="tag archived-tag">Archived notice</span>':""} <span class="tag read-state">${isRead?"Read":"Unread"}</span></div><small>Released: ${esc(when)}</small></div><h3>${esc(item.title)}</h3><p>${esc(item.summary||"Open the original source for full details.")}</p><div class="live-card-foot"><small>${esc(item.source)} · ${kind}</small><div class="live-card-actions">${item.url?`<a class="btn light" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Official notice ↗</a>`:""}<button class="btn light" type="button" onclick="toggleLiveRead('${readId}')">${isRead?"Mark unread":"Mark read"}</button></div></div></article>`;
  }).join("")||'<div class="panel empty">No notifications found for this date range. Try a wider range or another keyword.</div>';
 }catch(e){list.innerHTML=`<div class="panel empty">Unable to load notifications: ${esc(e.message)}.</div>`;}
}
async function loadActiveNotifications(){
 const activeList=$("#active-notifications-list"), upcomingList=$("#upcoming-notifications-list"); if(!activeList)return;
 try{
  const d=await api("/api/public/active-notifications");
  activeList.innerHTML=d.active.map(j=>`<article class="live-card"><div class="live-card-head"><span class="tag">${esc(j.status)}</span><small>Last date: ${esc(j.application_end)}</small></div><h3>${esc(j.title)}</h3><p><b>${esc(j.organisation)}</b> · ${esc(j.region||"")}</p><p>Released: ${esc(j.notification_date||"Not recorded")} · Applications: ${esc(j.application_start||"Not specified")} to ${esc(j.application_end)} · ${j.days_remaining} day(s) remaining</p>${j.notification_url?`<a class="btn light" href="${esc(j.notification_url)}" target="_blank" rel="noopener noreferrer">Official notification / apply ↗</a>`:"<p class=muted>Official link not recorded.</p>"}</article>`).join("")||'<div class="panel empty">No active applications with recorded dates right now.</div>';
  upcomingList.innerHTML=d.upcoming.length?'<h3>Upcoming applications</h3>'+d.upcoming.map(j=>`<article class="live-card"><div class="live-card-head"><span class="tag">Upcoming</span><small>Opens: ${esc(j.application_start)}</small></div><h3>${esc(j.title)}</h3><p>${esc(j.organisation)} · Last date: ${esc(j.application_end)}</p>${j.notification_url?`<a class="btn light" href="${esc(j.notification_url)}" target="_blank" rel="noopener noreferrer">Official notification ↗</a>`:""}</article>`).join(""):"";
 }catch(e){activeList.innerHTML=`<div class="panel empty">Unable to load active notifications: ${esc(e.message)}.</div>`;}
}
function selectNoticeTab(tab){
 const datewise=tab==="datewise"; $("#datewise-panel").hidden=!datewise; $("#active-notifications-panel").hidden=datewise;
 document.querySelectorAll(".notice-tab").forEach(b=>{b.classList.toggle("active",b.dataset.noticeTab===tab);b.classList.toggle("primary",b.dataset.noticeTab===tab);b.classList.toggle("light",b.dataset.noticeTab!==tab)});
 if(datewise)loadLiveUpdates();else loadActiveNotifications();
}
document.querySelectorAll(".notice-tab").forEach(b=>b.addEventListener("click",()=>selectNoticeTab(b.dataset.noticeTab)));
$("#notice-from")?.addEventListener("change",loadLiveUpdates); $("#notice-to")?.addEventListener("change",loadLiveUpdates);
$("#notice-date-clear")?.addEventListener("click",()=>{$("#notice-from").value="";$("#notice-to").value="";loadLiveUpdates()});
$("#live-refresh")?.addEventListener("click",()=>{loadLiveUpdates();loadActiveNotifications()});
$("#live-category")?.addEventListener("change",loadLiveUpdates);
$("#live-search")?.addEventListener("input",()=>{clearTimeout(liveSearchTimer);liveSearchTimer=setTimeout(loadLiveUpdates,300)});
setInterval(()=>{if(document.visibilityState==="visible" && $("#live-updates")?.classList.contains("active")){loadLiveUpdates();loadActiveNotifications()}},5*60*1000);
$("#today").textContent=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
(async()=>{if(token){try{const d=await api("/api/me");user=d.user}catch{token="";localStorage.removeItem("jh_token")}}updateAccount();await loadDashboard()})();
