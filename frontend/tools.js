(()=>{
 const $=s=>document.querySelector(s); const msg=(id,t,err=false)=>{const n=$(id);if(n){n.textContent=t;n.style.color=err?'#a33':'var(--green)'}};
 const file=(id)=>$(id)?.files?.[0];
 function download(blob,name){const a=document.createElement('a');const u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)}
 function safeName(s){return (s||'document').replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'_').slice(0,60)||'document'}
 function parsePages(spec,total){const out=new Set();for(const part of spec.split(',')){const p=part.trim();if(!p)continue;const m=p.match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!m)throw Error('Use page numbers like 1,3-5.');let a=+m[1],b=+(m[2]||m[1]);if(a<1||b<a||b>total)throw Error(`Page range must be between 1 and ${total}.`);for(let i=a;i<=b;i++)out.add(i-1)}return [...out].sort((a,b)=>a-b)}
 document.querySelectorAll('[data-tool-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-tool-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.tool-pane').forEach(x=>x.classList.toggle('active',x.id===b.dataset.toolTab))}));

 // Smart Scanner: local camera/photo capture, page queue and PDF export.
 const scannerPages=[];
 const scannerStatus=(text,error=false)=>{const el=$('#scanner-status');if(el){el.textContent=text;el.classList.toggle('scanner-status-error',error)}};
 const scannerRender=()=>{
  const wrap=$('#scanner-pages-wrap'),grid=$('#scanner-pages'),count=$('#scanner-pages-count');
  if(!wrap||!grid)return;
  wrap.hidden=scannerPages.length===0;
  if(count)count.textContent=`${scannerPages.length} page${scannerPages.length===1?'':'s'}`;
  grid.innerHTML=scannerPages.map((p,i)=>`<div class="scanner-page"><img src="${p.url}" alt="Scanned page ${i+1}"><small>Page ${i+1}</small><button type="button" data-scanner-remove="${i}" aria-label="Remove page ${i+1}">×</button></div>`).join('');
 };
 const scannerAddFiles=(list)=>{
  const images=[...list].filter(f=>f.type.startsWith('image/'));
  if(!images.length){scannerStatus('Please select an image file.',true);return}
  images.forEach(f=>scannerPages.push({file:f,url:URL.createObjectURL(f)}));
  scannerRender();scannerStatus(`${images.length} image${images.length===1?'':'s'} added. You can add more pages or create a PDF.`);
 };
 $('#scanner-camera-input')?.addEventListener('change',e=>{scannerAddFiles(e.target.files||[]);e.target.value=''});
 $('#scanner-upload-input')?.addEventListener('change',e=>{scannerAddFiles(e.target.files||[]);e.target.value=''});
 $('#scanner-pages')?.addEventListener('click',e=>{const b=e.target.closest('[data-scanner-remove]');if(!b)return;const i=Number(b.dataset.scannerRemove);const p=scannerPages.splice(i,1)[0];if(p)URL.revokeObjectURL(p.url);scannerRender();scannerStatus('Page removed.')});
 $('#scanner-clear-pages')?.addEventListener('click',()=>{scannerPages.forEach(p=>URL.revokeObjectURL(p.url));scannerPages.length=0;scannerRender();scannerStatus('All scanned pages cleared.')});
 $('#scanner-create-pdf')?.addEventListener('click',async()=>{
  try{
   if(!scannerPages.length)throw Error('Take a photo or upload at least one image first.');
   const {PDFDocument}=pdfReady(),pdf=await PDFDocument.create();
   for(const item of scannerPages){const f=item.file;let bytes=await f.arrayBuffer(),img;
    if(f.type==='image/png')img=await pdf.embedPng(bytes);
    else if(['image/jpeg','image/jpg'].includes(f.type))img=await pdf.embedJpg(bytes);
    else {const jpg=await imageBlobAsJpg(f);img=await pdf.embedJpg(await jpg.arrayBuffer())}
    const page=pdf.addPage([img.width,img.height]);page.drawImage(img,{x:0,y:0,width:img.width,height:img.height});
   }
   download(new Blob([await pdf.save()],{type:'application/pdf'}),'janaseva-scanned-document.pdf');
   scannerStatus(`PDF created from ${scannerPages.length} page${scannerPages.length===1?'':'s'}. It has been downloaded to your device.`);
  }catch(e){scannerStatus(e.message,true)}
 });
 const openGoogle=(url)=>{const w=window.open(url,'_blank','noopener,noreferrer');if(!w)scannerStatus('Your browser blocked the new tab. Allow pop-ups for this site and try again.',true)};
 $('#scanner-google-search')?.addEventListener('click',()=>{const q=$('#scanner-google-query')?.value.trim();if(!q){scannerStatus('Type a search phrase first.',true);$('#scanner-google-query')?.focus();return}openGoogle('https://www.google.com/search?q='+encodeURIComponent(q))});
 $('#scanner-google-query')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('#scanner-google-search')?.click()});
 $('#scanner-google-lens')?.addEventListener('click',()=>openGoogle('https://lens.google.com/'));

 const pdfReady=()=>{if(!window.PDFLib)throw Error('PDF library did not load. Check your internet connection and refresh.');return window.PDFLib};
 $('#pdf-merge-go')?.addEventListener('click',async()=>{try{const {PDFDocument}=pdfReady(),fs=[...$('#pdf-merge-files').files];if(fs.length<2)throw Error('Choose at least two PDF files.');const out=await PDFDocument.create();for(const f of fs){const src=await PDFDocument.load(await f.arrayBuffer());const pages=await out.copyPages(src,src.getPageIndices());pages.forEach(p=>out.addPage(p))}download(new Blob([await out.save()],{type:'application/pdf'}),'merged.pdf');msg('#pdf-merge-result','Merged successfully.')}catch(e){msg('#pdf-merge-result',e.message,true)}});
 $('#pdf-split-go')?.addEventListener('click',async()=>{try{const {PDFDocument}=pdfReady(),f=file('#pdf-split-file');if(!f)throw Error('Choose a PDF file.');const src=await PDFDocument.load(await f.arrayBuffer()),ids=parsePages($('#pdf-pages').value,src.getPageCount());if(!ids.length)throw Error('Enter the pages to extract.');const out=await PDFDocument.create();(await out.copyPages(src,ids)).forEach(p=>out.addPage(p));download(new Blob([await out.save()],{type:'application/pdf'}),safeName(f.name)+'_pages.pdf');msg('#pdf-split-result','Pages extracted successfully.')}catch(e){msg('#pdf-split-result',e.message,true)}});
 $('#pdf-rotate-go')?.addEventListener('click',async()=>{try{const {PDFDocument,degrees}=pdfReady(),f=file('#pdf-rotate-file');if(!f)throw Error('Choose a PDF file.');const d=await PDFDocument.load(await f.arrayBuffer()),angle=+$('#pdf-rotate-deg').value;d.getPages().forEach(p=>p.setRotation(degrees((p.getRotation().angle+angle)%360)));download(new Blob([await d.save()],{type:'application/pdf'}),safeName(f.name)+'_rotated.pdf');msg('#pdf-rotate-result','PDF rotated successfully.')}catch(e){msg('#pdf-rotate-result',e.message,true)}});
 async function imagesToPdf(inputId,resultId){try{const {PDFDocument}=pdfReady(),fs=[...$(inputId).files];if(!fs.length)throw Error('Choose one or more images.');const pdf=await PDFDocument.create();for(const f of fs){const bytes=await f.arrayBuffer();let img;if(f.type==='image/png')img=await pdf.embedPng(bytes);else if(['image/jpeg','image/jpg'].includes(f.type))img=await pdf.embedJpg(bytes);else{const data=await imageBlobAsJpg(f);img=await pdf.embedJpg(await data.arrayBuffer())}const page=pdf.addPage([img.width,img.height]);page.drawImage(img,{x:0,y:0,width:img.width,height:img.height})}download(new Blob([await pdf.save()],{type:'application/pdf'}),'images.pdf');msg(resultId,'PDF created successfully.')}catch(e){msg(resultId,e.message,true)}}
 $('#images-pdf-go')?.addEventListener('click',()=>imagesToPdf('#images-pdf-files','#images-pdf-result'));$('#image-pdf-go-2')?.addEventListener('click',()=>imagesToPdf('#image-pdf-files-2','#image-pdf-result-2'));
 function imageBlobAsJpg(f){return new Promise((resolve,reject)=>{const im=new Image(),u=URL.createObjectURL(f);im.onload=()=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);c.toBlob(b=>{URL.revokeObjectURL(u);b?resolve(b):reject(Error('Could not convert image.'))},'image/jpeg',.92)};im.onerror=()=>{URL.revokeObjectURL(u);reject(Error('Could not read image.'))};im.src=u})}
 $('#image-convert-go')?.addEventListener('click',()=>{try{const f=file('#image-convert-file');if(!f)throw Error('Choose an image.');const im=new Image(),u=URL.createObjectURL(f);im.onload=()=>{const w=Math.max(1,Number($('#image-width').value)||im.naturalWidth),h=Math.round(im.naturalHeight*w/im.naturalWidth),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);c.toBlob(b=>{if(!b)return msg('#image-convert-result','Conversion failed.',true);const ext=$('#image-format').value.split('/')[1].replace('jpeg','jpg');download(b,safeName(f.name)+'.'+ext);msg('#image-convert-result','Image converted successfully.')},$('#image-format').value,Number($('#image-quality').value)/100);URL.revokeObjectURL(u)};im.onerror=()=>{URL.revokeObjectURL(u);msg('#image-convert-result','Could not read image.',true)};im.src=u}catch(e){msg('#image-convert-result',e.message,true)}});
 $('#sheet-convert-go')?.addEventListener('click',()=>{try{if(!window.XLSX)throw Error('Spreadsheet library did not load. Refresh while online.');const f=file('#sheet-file');if(!f)throw Error('Choose a CSV or Excel file.');const reader=new FileReader();reader.onload=e=>{try{const wb=XLSX.read(e.target.result,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],format=$('#sheet-output').value;if(format==='csv'){const csv=XLSX.utils.sheet_to_csv(ws);download(new Blob([csv],{type:'text/csv;charset=utf-8'}),safeName(f.name)+'.csv')}else{const out=XLSX.utils.book_new();XLSX.utils.book_append_sheet(out,ws,'Sheet1');XLSX.writeFile(out,safeName(f.name)+'.xlsx')}msg('#sheet-result','Converted first worksheet successfully.')}catch(err){msg('#sheet-result',err.message,true)}};reader.readAsArrayBuffer(f)}catch(e){msg('#sheet-result',e.message,true)}});
 $('#docx-extract-go')?.addEventListener('click',async()=>{try{if(!window.mammoth)throw Error('Word reader did not load. Refresh while online.');const f=file('#docx-file');if(!f)throw Error('Choose a .docx file.');const r=await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()});$('#docx-text').value=r.value;msg('#docx-result','Text extracted. Formatting and images are not preserved.')}catch(e){msg('#docx-result',e.message,true)}});
 $('#docx-save-txt')?.addEventListener('click',()=>download(new Blob([$('#docx-text').value],{type:'text/plain;charset=utf-8'}),'word-text.txt'));
 $('#text-save-txt')?.addEventListener('click',()=>download(new Blob([$('#studio-text').value],{type:'text/plain;charset=utf-8'}),'janaseva-note.txt'));
 $('#text-save-html')?.addEventListener('click',()=>{const escaped=$('#studio-text').value.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));download(new Blob([`<!doctype html><meta charset="utf-8"><pre style="white-space:pre-wrap;font:16px sans-serif">${escaped}</pre>`],{type:'text/html;charset=utf-8'}),'janaseva-note.html')});
 $('#text-print-pdf')?.addEventListener('click',()=>{const w=window.open('');if(!w)return;const text=$('#studio-text').value.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));w.document.write(`<!doctype html><meta charset="utf-8"><style>body{font:14px Arial;padding:30px}pre{white-space:pre-wrap}</style><pre>${text}</pre>`);w.document.close();w.focus();w.print()});
})();
