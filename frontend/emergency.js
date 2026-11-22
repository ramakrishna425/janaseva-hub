(()=>{
 const $=s=>document.querySelector(s);
 const states=[
 'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
 'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];
 const national=[
  ['Integrated emergency response / సమగ్ర అత్యవసర సహాయం','112','Police, fire, medical and other urgent response – all India','Emergency','India','National Portal of India','https://www.mha.gov.in/emergency-response-support-system-erss'],
  ['National Ambulance Service / జాతీయ అంబులెన్స్','102','National Ambulance Service','Medical','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['Police / పోలీస్','100','Police helpline; use 112 for integrated emergency response','Police','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['Fire / అగ్నిమాపక','101','Fire and rescue','Fire','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['Cyber financial fraud / సైబర్ ఆర్థిక మోసం','1930','Report financial cyber fraud promptly','Cyber','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['LPG leak emergency / గ్యాస్ లీక్','1906','LPG leakage emergency','Utility','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['Disaster relief / విపత్తు సహాయం','1070','Relief Commissioner for natural calamities; routing may vary','Disaster','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['District disaster control room / జిల్లా విపత్తు నియంత్రణ','1077','District control room; confirm local routing','Disaster','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['Road accident assistance / రోడ్డు ప్రమాదం','1073','Road accident helpline listed by National Portal','Road','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['National Highway emergency assistance / జాతీయ రహదారి సహాయం','1033','Emergency relief centre on National Highways','Road','India','Incredible India','https://www.incredibleindia.gov.in/en/emergency'],
  ['Railway assistance / రైల్వే సహాయం','139','Railway enquiry and assistance; for immediate danger use 112','Rail','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['Child Helpline / బాలల సహాయవాణి','1098','Children in distress or at risk','Child','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['Women Helpline / మహిళా సహాయవాణి','181','Women in distress; availability/routing can vary by state','Women','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['Senior Citizens Helpline / వృద్ధుల సహాయం','14567','Elderline support','Support','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['Persons with Disabilities Helpline / దివ్యాంగుల సహాయం','14456','Disability support information','Support','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['National Consumer Helpline / వినియోగదారుల సహాయం','1915','Consumer grievance assistance','Public service','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['Tourist Helpline / పర్యాటకుల సహాయం','1363','Tourist assistance','Travel','India','Incredible India','https://www.incredibleindia.gov.in/en/emergency'],
  ['UIDAI Aadhaar / ఆధార్ సహాయం','1947','Aadhaar support (not emergency response)','Public service','India','National Portal of India','https://www.india.gov.in/directory/helpline'],
  ['National Narcotics Helpline (MANAS) / మాదకద్రవ్యాల సమాచారం','1933','Report narcotics-related information','Public safety','India','National Portal of India','https://www.india.gov.in/directory/helpline']
 ];
 // Only locally-specific numbers transcribed from official government pages.
 const local=[
  ['Andhra Pradesh','Tirupati','Collectorate control room','0877-2236007','District administration contact','Collectorate','https://tirupati.ap.gov.in/helpline/'],
  ['Andhra Pradesh','Tirupati','Collectorate control room toll-free','1800-425-3077','District administration contact','Collectorate','https://tirupati.ap.gov.in/helpline/'],
  ['Andhra Pradesh','Tirupati','RPF railway security','182','Railway security','Rail','https://tirupati.ap.gov.in/helpline/'],
  ['Andhra Pradesh','Tirupati','State call centre','1100','Public service grievance / state call centre','Public service','https://tirupati.ap.gov.in/helpline/'],
  ['Andhra Pradesh','NTR (Vijayawada)','State call centre','1100','State call centre','Public service','https://ntr.ap.gov.in/helpline/'],
  ['Andhra Pradesh','NTR (Vijayawada)','BSNL customer helpline','1800-180-1503','Telecom customer support','Utility','https://ntr.ap.gov.in/helpline/'],
  ['Andhra Pradesh','Guntur','State call centre','1902','State call centre / grievance','Public service','https://guntur.ap.gov.in/helpline/'],
  ['Andhra Pradesh','Kadapa','Collectorate control room','1077','District control room','Disaster','https://kadapa.ap.gov.in/help-line/'],
  ['Andhra Pradesh','Kadapa','Municipal corporation','18001208757','Municipal services','Utility','https://kadapa.ap.gov.in/help-line/'],
  ['Andhra Pradesh','Kadapa','Electricity complaints (APSPDCL)','08562-223431','Electricity complaint contact','Utility','https://kadapa.ap.gov.in/help-line/'],
  ['Andhra Pradesh','Kurnool','Collectorate control room','08518-277305','District control room','Disaster','https://kurnool.ap.gov.in/helpline/'],
  ['Andhra Pradesh','Kakinada','Collectorate control room','1800-425-3077','District control room','Disaster','https://kakinada.ap.gov.in/helpline/'],
  ['Andhra Pradesh','Annamayya','State call centre','1100','State call centre','Public service','https://annamayya.ap.gov.in/helpline/'],
  ['Andhra Pradesh','Srikakulam','Railway enquiry','131 / 135','Railway enquiry','Rail','https://srikakulam.ap.gov.in/helpline/'],
  ['Andhra Pradesh','Prakasam','Police command control','08592-286110','District police control room','Police','https://prakasampolice.ap.gov.in/CommandControl.html'],
  ['Andhra Pradesh','Prakasam','Police WhatsApp / command control','9121102266','District police command control','Police','https://prakasampolice.ap.gov.in/CommandControl.html'],
  ['Telangana','Hyderabad','Collectorate control room','040-23202813','District administration','Collectorate','https://hyderabad.telangana.gov.in/helpline/'],
  ['Telangana','Hyderabad','Blood bank information','040-24745243','Blood bank contact listed by Telangana government','Medical','https://www.telangana.gov.in/Contacts/emergency-contacts/'],
  ['Telangana','Hyderabad','Osmania General Hospital','040-23538846','Hospital contact','Hospital','https://www.telangana.gov.in/Contacts/emergency-contacts/'],
  ['Telangana','Hyderabad','Gandhi Hospital','040-27505566','Hospital contact','Hospital','https://www.telangana.gov.in/Contacts/emergency-contacts/'],
  ['Telangana','Hyderabad','Government Chest Hospital','040-23814421','Hospital contact','Hospital','https://www.telangana.gov.in/Contacts/emergency-contacts/'],
  ['Telangana','Statewide','MeeSeva call centre','1100','MeeSeva / citizen services','Public service','https://www.telangana.gov.in/Contacts/emergency-contacts/'],
  ['Telangana','Statewide','MeeSeva call centre','1800-425-1110','MeeSeva / citizen services','Public service','https://www.telangana.gov.in/Contacts/emergency-contacts/'],
  ['Telangana','Statewide','Electricity complaints','1912','Electricity complaint helpline','Utility','https://www.telangana.gov.in/Contacts/emergency-contacts/'],
  ['Telangana','Statewide','Railway enquiry','131 / 135','Railway enquiry','Rail','https://www.telangana.gov.in/Contacts/emergency-contacts/'],
  ['Kerala','Statewide','State Emergency Operations Centre','1070 / 1079','Kerala disaster management control room','Disaster','https://sdma.kerala.gov.in/wp-content/uploads/2026/06/Directory-wpn.pdf'],
  ['Kerala','Statewide','State Emergency Operations Centre','0471-2778800','Kerala disaster management control room','Disaster','https://sdma.kerala.gov.in/wp-content/uploads/2026/06/Directory-wpn.pdf'],
  ['Kerala','District-wide','District Emergency Operations Centre','1077','District emergency operations centre','Disaster','https://sdma.kerala.gov.in/wp-content/uploads/2026/06/Directory-wpn.pdf'],
  ['Kerala','Statewide','Highway Police Alert','9846100100','Highway emergency alert','Road','https://sdma.kerala.gov.in/wp-content/uploads/2026/06/Directory-wpn.pdf'],
  ['Kerala','Statewide','Water Authority','1916','Water supply complaints','Utility','https://alappuzha.nic.in/en/department/state-emergency-contact-numbers/'],
  ['Kerala','Statewide','Electricity complaints','1912','KSEB electricity complaints','Utility','https://sdma.kerala.gov.in/wp-content/uploads/2026/06/Directory-wpn.pdf'],
  ['Kerala','Statewide','Coastal police','1093','Coastal security','Police','https://alappuzha.nic.in/en/department/state-emergency-contact-numbers/'],
  ['Kerala','Statewide','Coast Guard','1554','Maritime emergency assistance','Transport','https://alappuzha.nic.in/en/department/state-emergency-contact-numbers/'],
  ['Kerala','Alappuzha','Fisheries control room','8547155621','Fisheries assistance','Transport','https://alappuzha.nic.in/en/department/state-emergency-contact-numbers/'],
  ['Tamil Nadu','Madurai','Collectorate board','0452-2546100','District administration','Collectorate','https://madurai.nic.in/helpline/'],
  ['Tamil Nadu','Madurai','Electricity complaints','1912','Electricity complaint helpline','Utility','https://madurai.nic.in/helpline/'],
  ['Tamil Nadu','Madurai','Health insurance scheme','1800-425-3993','Chief Minister’s Comprehensive Health Insurance Scheme','Medical','https://madurai.nic.in/helpline/'],
  ['Tamil Nadu','Dindigul','District emergency / Collectorate control room','1077','District control room','Disaster','https://dindigul.nic.in/helpline/'],
  ['Tamil Nadu','Kanyakumari','Collectorate board','04652-279090','District administration','Collectorate','https://kanniyakumari.nic.in/helpline/'],
  ['Tamil Nadu','Kanyakumari','Coastal help line','1093','Coastal security','Police','https://kanniyakumari.nic.in/helpline/'],
  ['Delhi','Statewide','Traffic Police','1095','Delhi Traffic Police','Traffic','https://delhipolice.mha.gov.in/RTImanualFiles/38145_Manual%203.pdf'],
  ['Delhi','Statewide','Senior citizen assistance','1291','Delhi senior citizen helpline listed in official police manual','Support','https://delhipolice.mha.gov.in/RTImanualFiles/38145_Manual%203.pdf']
 ];
 const $esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const stateSel=$('#emergency-state'), nationalBox=$('#emergency-national-list'), stateBox=$('#emergency-state-list');
 if(!stateSel||!nationalBox||!stateBox)return;
 states.forEach(st=>{const o=document.createElement('option');o.value=st;o.textContent=st;stateSel.appendChild(o)});
 const qel=$('#emergency-search'), regionEl=$('#emergency-region');
 const card=(name,number,detail,tag,place,source,url)=>`<article class="emergency-card"><span class="emergency-tag">${$esc(tag)}${place&&place!=='India'?' · '+$esc(place):''}</span><h4>${$esc(name)}</h4><div class="emergency-number">${$esc(number)}</div><p>${$esc(detail)}</p><div class="emergency-actions"><a class="btn light emergency-call" href="tel:${$esc(number.replace(/[^0-9+]/g,''))}">☎ Call</a>${url?`<a class="emergency-source" href="${$esc(url)}" target="_blank" rel="noopener noreferrer">Official source: ${$esc(source||'Government website')} ↗</a>`:''}</div></article>`;
 function render(){
  const q=(qel.value||'').trim().toLowerCase(), region=regionEl.value, selected=stateSel.value;
  const ns=region==='state'?[]:national.filter(x=>x.join(' ').toLowerCase().includes(q));
  nationalBox.innerHTML=ns.length?ns.map(x=>card(x[0],x[1],x[2],x[3],x[4],x[5],x[6])).join(''):'<div class="emergency-empty">No matching national contacts.</div>';
  const list=region==='national'?[]:local.filter(x=>(selected==='all'||x[0]===selected)&&(!q||x.join(' ').toLowerCase().includes(q)));
  stateBox.innerHTML=list.length?list.map(x=>card(`${x[1]} · ${x[2]}`,x[3],x[4],x[5],x[0], 'Official government directory',x[6])).join(''):'<div class="emergency-empty">No locally verified match for this filter. Use 112 for urgent emergencies, or open the official state/district helpline directory below. We do not invent local numbers.</div>';
 }
 qel?.addEventListener('input',render);regionEl?.addEventListener('change',render);stateSel.addEventListener('change',render);
 const note=document.querySelector('.emergency-sources');
 if(note) note.innerHTML='Official directories: <a href="https://www.india.gov.in/directory/helpline" target="_blank" rel="noopener">National Portal of India</a> · <a href="https://www.mha.gov.in/emergency-response-support-system-erss" target="_blank" rel="noopener">MHA ERSS 112</a> · <a href="https://www.telangana.gov.in/Contacts/emergency-contacts/" target="_blank" rel="noopener">Telangana</a> · <a href="https://sdma.kerala.gov.in/wp-content/uploads/2026/06/Directory-wpn.pdf" target="_blank" rel="noopener">Kerala 2026 Directory</a> · <a href="https://tirupati.ap.gov.in/helpline/" target="_blank" rel="noopener">Tirupati</a> · <a href="https://madurai.nic.in/helpline/" target="_blank" rel="noopener">Madurai</a>. Local contacts are shown only where an official source was found. Verify before relying on non-emergency contacts.';
 render();
})();