(() => {
 const tools = [
  {name:'ChatGPT',category:'Assistant',icon:'✳️',desc:'General AI assistant for explanations, drafting, brainstorming, analysis and learning.',url:'https://chatgpt.com/',access:'Free and paid plans'},
  {name:'Google Gemini',category:'Assistant',icon:'✦',desc:'AI assistant for questions, writing, planning and working with Google services.',url:'https://gemini.google.com/',access:'Free and paid plans'},
  {name:'Claude',category:'Assistant',icon:'✳',desc:'AI assistant useful for writing, reasoning, document analysis and coding.',url:'https://claude.ai/',access:'Free and paid plans'},
  {name:'Microsoft Copilot',category:'Assistant',icon:'🌀',desc:'AI assistant for answers, web-supported research and Microsoft workflows.',url:'https://copilot.microsoft.com/',access:'Free and paid plans'},
  {name:'Perplexity',category:'Research',icon:'🔎',desc:'AI-powered web research and answers with source links to explore.',url:'https://www.perplexity.ai/',access:'Free and paid plans'},
  {name:'Google NotebookLM',category:'Research',icon:'📚',desc:'Study and research assistant that works with sources you provide, such as PDFs and notes.',url:'https://notebooklm.google.com/',access:'Free access; limits may apply'},
  {name:'Elicit',category:'Research',icon:'🧪',desc:'Research workflow tool for finding and reviewing academic papers.',url:'https://elicit.com/',access:'Free and paid plans'},
  {name:'Grammarly',category:'Writing',icon:'✍️',desc:'Writing assistance for grammar, clarity, tone and drafting.',url:'https://www.grammarly.com/',access:'Free and paid plans'},
  {name:'DeepL',category:'Writing',icon:'🌐',desc:'Translation and writing tools for supported languages.',url:'https://www.deepl.com/',access:'Free and paid plans'},
  {name:'QuillBot',category:'Writing',icon:'📝',desc:'Paraphrasing, summarizing and writing assistance.',url:'https://quillbot.com/',access:'Free and paid plans'},
  {name:'Canva Magic Studio',category:'Image',icon:'🎨',desc:'Design platform with AI features for graphics, presentations and social content.',url:'https://www.canva.com/magic/',access:'Free and paid plans'},
  {name:'Adobe Firefly',category:'Image',icon:'🔥',desc:'Generative AI tools for creating and editing images and design assets.',url:'https://firefly.adobe.com/',access:'Free credits and paid plans'},
  {name:'Ideogram',category:'Image',icon:'🖼️',desc:'AI image generation, including designs that incorporate text.',url:'https://ideogram.ai/',access:'Free and paid plans'},
  {name:'Leonardo AI',category:'Image',icon:'🦁',desc:'AI image generation and creative asset tools.',url:'https://leonardo.ai/',access:'Free and paid plans'},
  {name:'Midjourney',category:'Image',icon:'🌌',desc:'AI image generation for artistic and visual concepts.',url:'https://www.midjourney.com/',access:'Paid plans'},
  {name:'Runway',category:'Video',icon:'🎬',desc:'AI-assisted video generation and editing tools.',url:'https://runwayml.com/',access:'Free access/credits and paid plans'},
  {name:'Kling AI',category:'Video',icon:'🎥',desc:'AI video and image generation tools.',url:'https://klingai.com/',access:'Free credits and paid plans'},
  {name:'Synthesia',category:'Video',icon:'🧑‍🏫',desc:'Create presenter-style videos with AI avatars and voiceovers.',url:'https://www.synthesia.io/',access:'Free demo and paid plans'},
  {name:'ElevenLabs',category:'Audio',icon:'🎙️',desc:'AI voice generation, text-to-speech and audio tools.',url:'https://elevenlabs.io/',access:'Free tier and paid plans'},
  {name:'Suno',category:'Audio',icon:'🎵',desc:'Generate music and songs from text prompts.',url:'https://suno.com/',access:'Free tier and paid plans'},
  {name:'Udio',category:'Audio',icon:'🎧',desc:'AI music creation and audio experimentation.',url:'https://www.udio.com/',access:'Free access and paid options may vary'},
  {name:'Gamma',category:'Productivity',icon:'📊',desc:'Create presentations, documents and web pages with AI assistance.',url:'https://gamma.app/',access:'Free credits and paid plans'},
  {name:'Otter.ai',category:'Productivity',icon:'🗣️',desc:'Meeting transcription, summaries and searchable conversation notes.',url:'https://otter.ai/',access:'Free and paid plans'},
  {name:'Cursor',category:'Coding',icon:'⌨️',desc:'AI-powered code editor for understanding, writing and editing code.',url:'https://cursor.com/',access:'Free and paid plans'},
  {name:'GitHub Copilot',category:'Coding',icon:'🐙',desc:'AI coding assistant integrated with supported development environments.',url:'https://github.com/features/copilot',access:'Free and paid plans'},
  {name:'Replit',category:'Coding',icon:'💻',desc:'Online coding workspace with AI-assisted app building and deployment tools.',url:'https://replit.com/',access:'Free and paid plans'}
 ];
 const $=s=>document.querySelector(s); const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(){const host=$('#ai-tools-list');if(!host)return;const q=($('#ai-search')?.value||'').trim().toLowerCase();const cat=$('#ai-category')?.value||'all';const rows=tools.filter(t=>(cat==='all'||t.category===cat)&&(!q||`${t.name} ${t.category} ${t.desc}`.toLowerCase().includes(q)));$('#ai-count').textContent=`Showing ${rows.length} of ${tools.length} AI tools`;host.innerHTML=rows.map(t=>`<article class="ai-card"><div class="ai-card-top"><span class="ai-icon" aria-hidden="true">${t.icon}</span><span class="tag">${esc(t.category)}</span></div><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p><div class="ai-meta">${esc(t.access)}</div><a class="btn light" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Visit official website ↗</a></article>`).join('')||'<div class="panel empty">No matching AI tools. Try another search or category.</div>'}
 document.addEventListener('DOMContentLoaded',()=>{ $('#ai-search')?.addEventListener('input',render);$('#ai-category')?.addEventListener('change',render);render();});
})();
