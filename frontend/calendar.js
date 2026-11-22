(() => {
  const $ = id => document.getElementById(id);
  const dialog = $('calendar-dialog');
  if (!dialog) return;
  const today = new Date(); today.setHours(0,0,0,0);
  let shown = new Date(today.getFullYear(), today.getMonth(), 1);
  let selected = new Date(today);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const special = [
    ['01-12','National Youth Day','జాతీయ యువజన దినోత్సవం','Awareness'],['01-26','Republic Day','గణతంత్ర దినోత్సవం','National'],
    ['02-28','National Science Day','జాతీయ విజ్ఞాన దినోత్సవం','Education'],['03-08','International Women’s Day','అంతర్జాతీయ మహిళా దినోత్సవం','Awareness'],
    ['03-22','World Water Day','ప్రపంచ జల దినోత్సవం','Awareness'],['04-07','World Health Day','ప్రపంచ ఆరోగ్య దినోత్సవం','Awareness'],
    ['04-22','Earth Day','భూమి దినోత్సవం','Awareness'],['05-01','May Day','మే దినోత్సవం','Observance'],['06-05','World Environment Day','ప్రపంచ పర్యావరణ దినోత్సవం','Awareness'],
    ['06-21','International Day of Yoga','అంతర్జాతీయ యోగా దినోత్సవం','Health'],['07-11','World Population Day','ప్రపంచ జనాభా దినోత్సవం','Awareness'],
    ['08-15','Independence Day','స్వాతంత్ర్య దినోత్సవం','National'],['09-05','Teachers’ Day','ఉపాధ్యాయ దినోత్సవం','Education'],
    ['09-08','International Literacy Day','అంతర్జాతీయ అక్షరాస్యత దినోత్సవం','Education'],['10-02','Gandhi Jayanti','గాంధీ జయంతి','National'],
    ['10-16','World Food Day','ప్రపంచ ఆహార దినోత్సవం','Awareness'],['11-14','Children’s Day','బాలల దినోత్సవం','Education'],
    ['11-26','Constitution Day','రాజ్యాంగ దినోత్సవం','National'],['12-01','World AIDS Day','ప్రపంచ ఎయిడ్స్ దినోత్సవం','Awareness'],
    ['12-10','Human Rights Day','మానవ హక్కుల దినోత్సవం','Awareness']
  ];
  const remindersKey = 'jh_calendar_reminders_v1';
  const readReminders = () => { try { return JSON.parse(localStorage.getItem(remindersKey) || '[]'); } catch { return []; } };
  const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const same = (a,b) => dateKey(a) === dateKey(b);
  const te = () => (localStorage.getItem('jh_language') || 'en') === 'te';
  const eventData = d => {
    const key = `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const rows = special.filter(x => x[0] === key).map(x => ({title: te()?x[2]:x[1], category:x[3], kind:'special'}));
    return rows.concat(readReminders().filter(x=>x.date===dateKey(d)).map(x=>({title:x.title,category:te()?'వ్యక్తిగత రిమైండర్':'Personal reminder',kind:'reminder'})));
  };
  function render(){
    $('calendar-month-label').textContent = `${months[shown.getMonth()]} ${shown.getFullYear()}`;
    const first = new Date(shown.getFullYear(),shown.getMonth(),1).getDay();
    const count = new Date(shown.getFullYear(),shown.getMonth()+1,0).getDate();
    const cells = [];
    for(let i=0;i<first;i++) cells.push('<span class="calendar-empty"></span>');
    for(let day=1;day<=count;day++){
      const d = new Date(shown.getFullYear(),shown.getMonth(),day); const has=eventData(d).length>0;
      cells.push(`<button type="button" class="calendar-day${same(d,today)?' is-today':''}${same(d,selected)?' is-selected':''}${has?' has-event':''}" data-day="${day}">${day}${has?'<i></i>':''}</button>`);
    }
    $('calendar-days').innerHTML=cells.join('');
    $('calendar-days').querySelectorAll('[data-day]').forEach(b=>b.addEventListener('click',()=>{selected=new Date(shown.getFullYear(),shown.getMonth(),Number(b.dataset.day));renderEvents();render();}));
    renderEvents();
    $('calendar-corner-month').textContent = months[today.getMonth()].toUpperCase();
    $('calendar-corner-date').textContent = today.toLocaleDateString(te()?'te-IN':'en-IN',{day:'numeric',month:'short',year:'numeric'});
    const upcoming=[]; for(let n=0;n<370 && upcoming.length===0;n++){const d=new Date(today);d.setDate(today.getDate()+n);if(eventData(d).length)upcoming.push({d,e:eventData(d)[0]});}
    $('calendar-corner-next').textContent = upcoming.length ? `${upcoming[0].e.title} · ${upcoming[0].d.toLocaleDateString(te()?'te-IN':'en-IN',{day:'numeric',month:'short'})}` : (te()?'ప్రత్యేక తేదీలు చూడండి':'View special dates');
  }
  function renderEvents(){
    const region=$('calendar-region').value; const rows=eventData(selected).filter(e=>region==='all'||region==='state' ? (region==='all'||e.kind==='reminder') : e.category==='National'||e.category==='Education'||e.category==='Awareness'||e.category==='Health'||e.category==='Observance');
    $('calendar-selected-label').textContent=selected.toLocaleDateString(te()?'te-IN':'en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    $('calendar-event-list').innerHTML=rows.length?rows.map(e=>`<div class="calendar-event"><b>${escapeHtml(e.title)}</b><small>${escapeHtml(e.category)}</small></div>`).join(''):`<p class="muted">${te()?'ఈ తేదీకి నమోదు చేసిన ప్రత్యేక తేదీలు లేవు.':'No listed events for this date.'}</p>`;
    $('calendar-reminder-date').value=dateKey(selected);
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  $('calendar-open').addEventListener('click',()=>{render();dialog.showModal();});
  $('calendar-close').addEventListener('click',()=>dialog.close());
  $('calendar-prev').addEventListener('click',()=>{shown=new Date(shown.getFullYear(),shown.getMonth()-1,1);render();});
  $('calendar-next').addEventListener('click',()=>{shown=new Date(shown.getFullYear(),shown.getMonth()+1,1);render();});
  $('calendar-region').addEventListener('change',renderEvents);
  $('calendar-state').addEventListener('change',renderEvents);
  $('calendar-add-reminder').addEventListener('click',()=>{const title=$('calendar-reminder-title').value.trim(),date=$('calendar-reminder-date').value;if(!title||!date){$('calendar-reminder-title').focus();return;}const items=readReminders();items.push({title,date,id:Date.now()});localStorage.setItem(remindersKey,JSON.stringify(items));$('calendar-reminder-title').value='';selected=new Date(`${date}T00:00:00`);shown=new Date(selected.getFullYear(),selected.getMonth(),1);render();});
  window.addEventListener('jh-language-change',render);
  render();
})();
