require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const Parser = require("rss-parser");
const cron = require("node-cron");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.JWT_SECRET || "local-development-secret-change-me";
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "janaseva.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS jobs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, organisation TEXT NOT NULL,
 region TEXT DEFAULT '', category TEXT DEFAULT '', notification_url TEXT DEFAULT '',
 application_start TEXT DEFAULT '', application_end TEXT DEFAULT '', exam_date TEXT DEFAULT '',
 status TEXT DEFAULT 'Open', description TEXT DEFAULT '', source TEXT DEFAULT 'Manual',
 external_id TEXT UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS saved_jobs (
 user_id INTEGER NOT NULL, job_id INTEGER NOT NULL, stage TEXT DEFAULT 'Interested',
 notes TEXT DEFAULT '', reminder_date TEXT, PRIMARY KEY(user_id, job_id),
 FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(job_id) REFERENCES jobs(id)
);
CREATE TABLE IF NOT EXISTS schemes (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, level TEXT DEFAULT 'Central',
 summary TEXT DEFAULT '', eligibility TEXT DEFAULT '', documents TEXT DEFAULT '',
 official_url TEXT DEFAULT '', updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reminders (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL,
 due_at TEXT NOT NULL, done INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL,
 message TEXT NOT NULL, url TEXT DEFAULT '', read INTEGER DEFAULT 0,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS feed_sources (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
 enabled INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS feed_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, title TEXT NOT NULL,
 url TEXT NOT NULL UNIQUE, published TEXT DEFAULT '', summary TEXT DEFAULT '',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);
// Safe additive migrations for live government updates.
function ensureColumn(table, column, definition) {
 const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
 if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn("jobs", "notification_date", "TEXT DEFAULT ''");
ensureColumn("jobs", "government_level", "TEXT DEFAULT 'state'");
ensureColumn("jobs", "qualification", "TEXT DEFAULT ''");
ensureColumn("jobs", "vacancies", "TEXT DEFAULT ''");
ensureColumn("jobs", "apply_url", "TEXT DEFAULT ''");
ensureColumn("feed_sources", "last_checked", "TEXT DEFAULT ''");
ensureColumn("feed_sources", "last_error", "TEXT DEFAULT ''");
ensureColumn("feed_items", "active", "INTEGER DEFAULT 1");
ensureColumn("feed_items", "category", "TEXT DEFAULT 'Government update'");
ensureColumn("feed_items", "last_seen_at", "TEXT DEFAULT ''");
ensureColumn("feed_items", "last_link_check_at", "TEXT DEFAULT ''");
ensureColumn("feed_items", "unavailable_at", "TEXT DEFAULT ''");
ensureColumn("feed_items", "last_http_status", "INTEGER DEFAULT 0");
ensureColumn("feed_items", "unavailable_checks", "INTEGER DEFAULT 0");
ensureColumn("schemes", "government_level", "TEXT DEFAULT 'central'");
ensureColumn("schemes", "state_name", "TEXT DEFAULT ''");
ensureColumn("schemes", "department", "TEXT DEFAULT ''");
ensureColumn("schemes", "benefits", "TEXT DEFAULT ''");
ensureColumn("schemes", "launch_date", "TEXT DEFAULT ''");
ensureColumn("schemes", "application_start", "TEXT DEFAULT ''");
ensureColumn("schemes", "application_end", "TEXT DEFAULT ''");
ensureColumn("schemes", "status", "TEXT DEFAULT 'Active'");
db.prepare("INSERT OR IGNORE INTO feed_sources(name,url,enabled) VALUES(?,?,1)")
 .run("Press Information Bureau – Government of India", "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1");
const count = db.prepare("SELECT COUNT(*) n FROM schemes").get().n;
if (!count) {
 const insert = db.prepare("INSERT INTO schemes(name,level,summary,eligibility,documents,official_url) VALUES(?,?,?,?,?,?)");
 [
  ["PM-KISAN","Central","Income support scheme for eligible landholding farmer families.","Eligibility and exclusions are determined by the official guidelines.","Aadhaar, bank account and land records as applicable.","https://pmkisan.gov.in/"],
  ["Ayushman Bharat PM-JAY","Central","Health cover for eligible families under the national health assurance programme.","Eligibility must be checked on the official beneficiary portal.","Identity documents requested by the official portal.","https://beneficiary.nha.gov.in/"],
  ["National Scholarship Portal","Central","A common portal for eligible scholarship schemes.","Criteria differ by scholarship, course and category.","As listed in the selected scholarship guidelines.","https://scholarships.gov.in/"],
  ["AP Government Services","State - Andhra Pradesh","Official Andhra Pradesh government services and citizen information.","Depends on the selected service.","Check the relevant service portal.","https://www.ap.gov.in/"]
 ].forEach(x => insert.run(...x));
}
db.prepare("UPDATE schemes SET government_level='state',state_name='Andhra Pradesh' WHERE level LIKE 'State%'").run();
const parser = new Parser({ timeout: 12000, headers: { "User-Agent": "JanasevaHub/1.0" } });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

function tokenFor(user) { return jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: "7d" }); }
function auth(req, res, next) {
 const h = req.headers.authorization || "";
 try { req.user = jwt.verify(h.startsWith("Bearer ") ? h.slice(7) : "", SECRET); next(); }
 catch { res.status(401).json({ error: "Please sign in to continue." }); }
}
function clean(v, max=4000) { return String(v ?? "").trim().slice(0,max); }

app.get("/api/health", (req,res) => res.json({ ok:true, app:"Janaseva Hub", time:new Date().toISOString() }));
app.post("/api/auth/register", async (req,res) => {
 const name=clean(req.body.name,80), email=clean(req.body.email,160).toLowerCase(), password=String(req.body.password||"");
 if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<8) return res.status(400).json({error:"Enter a name, valid email and password of at least 8 characters."});
 try {
  const hash=await bcrypt.hash(password,12);
  const result=db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)").run(name,email,hash);
  const user={id:Number(result.lastInsertRowid),name,email};
  res.json({token:tokenFor(user),user});
 } catch { res.status(409).json({error:"An account with this email may already exist."}); }
});
app.post("/api/auth/login", async (req,res) => {
 const email=clean(req.body.email,160).toLowerCase(), password=String(req.body.password||"");
 const user=db.prepare("SELECT * FROM users WHERE email=?").get(email);
 if (!user || !(await bcrypt.compare(password,user.password_hash))) return res.status(401).json({error:"Email or password is incorrect."});
 res.json({token:tokenFor(user),user:{id:user.id,name:user.name,email:user.email}});
});
app.get("/api/me",auth,(req,res)=> {
 const user=db.prepare("SELECT id,name,email,created_at FROM users WHERE id=?").get(req.user.id);
 res.json({user});
});

app.get("/api/jobs",(req,res)=>{
 const q=clean(req.query.q,120), scope=clean(req.query.scope,20)||"all", today=new Date().toISOString().slice(0,10);
 let sql="SELECT * FROM jobs WHERE application_start<>'' AND application_end<>'' AND application_start<=? AND application_end>=?";
 const args=[today,today];
 if(scope==="central") sql+=" AND lower(government_level)='central'";
 if(scope==="states") sql+=" AND lower(government_level)<>'central'";
 if(q){sql+=" AND (title LIKE ? OR organisation LIKE ? OR region LIKE ? OR qualification LIKE ?)";args.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`)}
 sql+=" ORDER BY application_end ASC LIMIT 300";
 res.json({jobs:db.prepare(sql).all(...args),scope,as_of:today,note:"Only listings with recorded application dates covering today are shown. Confirm details on the official recruitment notice."});
});
app.post("/api/jobs",auth,(req,res)=>{
 const b=req.body;
 if(!clean(b.title,180)||!clean(b.organisation,180)) return res.status(400).json({error:"Job title and organisation are required."});
 const r=db.prepare(`INSERT INTO jobs(title,organisation,region,category,notification_url,application_start,application_end,exam_date,status,description,notification_date,government_level,qualification,vacancies,apply_url)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(clean(b.title,180),clean(b.organisation,180),clean(b.region,100),clean(b.category,100),clean(b.notification_url,500),clean(b.application_start,30),clean(b.application_end,30),clean(b.exam_date,30),clean(b.status,40)||"Open",clean(b.description),clean(b.notification_date,30),clean(b.government_level,20)||"state",clean(b.qualification,250),clean(b.vacancies,50),clean(b.apply_url,500));
 res.json({id:Number(r.lastInsertRowid)});
});
app.post("/api/jobs/:id/save",auth,(req,res)=>{
 const id=Number(req.params.id);
 if(!db.prepare("SELECT id FROM jobs WHERE id=?").get(id)) return res.status(404).json({error:"Job not found."});
 db.prepare(`INSERT INTO saved_jobs(user_id,job_id,stage,notes,reminder_date) VALUES(?,?,?,?,?)
 ON CONFLICT(user_id,job_id) DO UPDATE SET stage=excluded.stage,notes=excluded.notes,reminder_date=excluded.reminder_date`)
 .run(req.user.id,id,clean(req.body.stage,60)||"Interested",clean(req.body.notes,1000),clean(req.body.reminder_date,30));
 res.json({ok:true});
});
app.get("/api/my/jobs",auth,(req,res)=>res.json({jobs:db.prepare(`SELECT j.*,s.stage,s.notes,s.reminder_date FROM saved_jobs s JOIN jobs j ON j.id=s.job_id WHERE s.user_id=? ORDER BY s.rowid DESC`).all(req.user.id)}));
app.delete("/api/my/jobs/:id",auth,(req,res)=>{db.prepare("DELETE FROM saved_jobs WHERE user_id=? AND job_id=?").run(req.user.id,Number(req.params.id));res.json({ok:true});});

app.get("/api/schemes",(req,res)=>{
 const scope=clean(req.query.scope,20)||"all"; let sql="SELECT * FROM schemes WHERE lower(status)='active' AND (application_end='' OR application_end>=date('now'))";
 if(scope==="central") sql+=" AND lower(government_level)='central'";
 if(scope==="states") sql+=" AND lower(government_level)<>'central'";
 sql+=" ORDER BY level,name"; res.json({schemes:db.prepare(sql).all(),scope});
});
app.post("/api/schemes",auth,(req,res)=>{
 const b=req.body;
 if(!clean(b.name,180)) return res.status(400).json({error:"Scheme name is required."});
 const r=db.prepare("INSERT INTO schemes(name,level,summary,eligibility,documents,official_url) VALUES(?,?,?,?,?,?)").run(clean(b.name,180),clean(b.level,80),clean(b.summary),clean(b.eligibility),clean(b.documents),clean(b.official_url,500));
 res.json({id:Number(r.lastInsertRowid)});
});
app.get("/api/reminders",auth,(req,res)=>res.json({reminders:db.prepare("SELECT * FROM reminders WHERE user_id=? ORDER BY due_at").all(req.user.id)}));
app.post("/api/reminders",auth,(req,res)=>{
 const title=clean(req.body.title,180), due=clean(req.body.due_at,40);
 if(!title||!due) return res.status(400).json({error:"Reminder title and date are required."});
 const r=db.prepare("INSERT INTO reminders(user_id,title,due_at) VALUES(?,?,?)").run(req.user.id,title,due);
 res.json({id:Number(r.lastInsertRowid)});
});
app.patch("/api/reminders/:id",auth,(req,res)=>{db.prepare("UPDATE reminders SET done=? WHERE id=? AND user_id=?").run(req.body.done?1:0,Number(req.params.id),req.user.id);res.json({ok:true});});
app.delete("/api/reminders/:id",auth,(req,res)=>{db.prepare("DELETE FROM reminders WHERE id=? AND user_id=?").run(Number(req.params.id),req.user.id);res.json({ok:true});});
app.get("/api/notifications",auth,(req,res)=>res.json({notifications:db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100").all(req.user.id)}));
app.patch("/api/notifications/:id/read",auth,(req,res)=>{db.prepare("UPDATE notifications SET read=1 WHERE id=? AND user_id=?").run(Number(req.params.id),req.user.id);res.json({ok:true});});

// Public date-wise notifications and currently-open application listings.
// Feed publication dates are normalized for filtering; application status is only
// determined when an official/manual job record has a verified application window.
function asDateOnly(value) {
 if (!value) return "";
 const d = new Date(value);
 return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0,10);
}
app.get("/api/public/notifications", (req,res) => {
 const from = clean(req.query.from,10), to = clean(req.query.to,10);
 const q = clean(req.query.q,100).toLowerCase();
 const category = clean(req.query.category,60);
 if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) return res.status(400).json({error:"Use YYYY-MM-DD dates."});
 if (from && to && from > to) return res.status(400).json({error:"From date must be on or before To date."});
 const feedRows = db.prepare("SELECT id,source,title,url,published,summary,category,created_at,active FROM feed_items ORDER BY id DESC LIMIT 5000").all();
 const jobRows = db.prepare("SELECT id,title,organisation AS source,notification_url AS url,notification_date AS published,description AS summary,category,created_at,application_start,application_end,exam_date FROM jobs ORDER BY id DESC LIMIT 1000").all();
 const combined = [...feedRows,...jobRows].map(x=>({...x,published_date:asDateOnly(x.published)||asDateOnly(x.created_at),kind:x.application_end!==undefined?"job":"feed",archived:x.active===0}));
 const items = combined.filter(x=>{
  if (from && (!x.published_date || x.published_date < from)) return false;
  if (to && (!x.published_date || x.published_date > to)) return false;
  if (category && category!=="all" && x.category!==category) return false;
  if (q && !(`${x.title} ${x.summary||""} ${x.source||""}`).toLowerCase().includes(q)) return false;
  return true;
 }).sort((a,b)=>(b.published_date||"").localeCompare(a.published_date||""));
 const sources = db.prepare("SELECT name,last_checked,last_error FROM feed_sources WHERE enabled=1 ORDER BY name").all();
 res.json({items:items.slice(0,300),sources,last_checked:sources.map(x=>x.last_checked).filter(Boolean).sort().at(-1)||"",refresh_minutes:15});
});
app.get("/api/public/active-notifications", (req,res) => {
 const today = new Date().toISOString().slice(0,10);
 const rows = db.prepare("SELECT id,title,organisation,region,category,notification_url,notification_date,application_start,application_end,exam_date,description FROM jobs WHERE application_end<>'' ORDER BY application_end ASC").all();
 const active = rows.filter(j => (!j.application_start || j.application_start <= today) && j.application_end >= today).map(j=>({...j,status:(new Date(j.application_end+'T23:59:59Z')-new Date(today+'T00:00:00Z'))/86400000 <= 7 ? "Closing Soon":"Active",days_remaining:Math.max(0,Math.ceil((new Date(j.application_end+'T23:59:59Z')-new Date(today+'T00:00:00Z'))/86400000))}));
 const upcoming = rows.filter(j => j.application_start && j.application_start > today).map(j=>({...j,status:"Upcoming"}));
 res.json({today,active,upcoming,note:"Application status is calculated only from listings with an entered application start/end date. Verify the official notice before applying."});
});

// Public live updates sourced from official RSS/Atom feeds.
app.get("/api/public/updates", (req,res) => {
 const category=clean(req.query.category,60), q=clean(req.query.q,100);
 let sql="SELECT id,source,title,url,published,summary,created_at,category,last_seen_at,unavailable_at FROM feed_items WHERE active=1";
 const args=[];
 if(category && category!=="all"){sql+=" AND category=?";args.push(category)}
 if(q){sql+=" AND (title LIKE ? OR summary LIKE ? OR source LIKE ?)";args.push(`%${q}%`,`%${q}%`,`%${q}%`)}
 sql+=" ORDER BY COALESCE(published,created_at) DESC,id DESC LIMIT 100";
 const items=db.prepare(sql).all(...args);
 const sources=db.prepare("SELECT name,last_checked,last_error FROM feed_sources WHERE enabled=1 ORDER BY name").all();
 res.json({items,sources,last_checked:sources.map(x=>x.last_checked).filter(Boolean).sort().at(-1)||"",refresh_minutes:15,notice:"Updates are collected from official RSS feeds. Open the original source to confirm details."});
});
app.get("/api/public/updates/status",(req,res)=>{
 const sources=db.prepare("SELECT name,url,last_checked,last_error,enabled FROM feed_sources ORDER BY name").all();
 const active=db.prepare("SELECT COUNT(*) n FROM feed_items WHERE active=1").get().n;
 const archived=db.prepare("SELECT COUNT(*) n FROM feed_items WHERE active=0").get().n;
 res.json({ok:true,active,archived,sources,checked_at:sources.map(x=>x.last_checked).filter(Boolean).sort().at(-1)||null});
});
app.get("/api/feeds",auth,(req,res)=>res.json({feeds:db.prepare("SELECT * FROM feed_sources ORDER BY id").all()}));
function safeFeedUrl(value){
 try { const u=new URL(value); return u.protocol==="https:" && !!u.hostname && !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname); }
 catch { return false; }
}
app.post("/api/feeds",auth,(req,res)=>{
 const name=clean(req.body.name,120), url=clean(req.body.url,500);
 if(!name || !safeFeedUrl(url)) return res.status(400).json({error:"Enter a named public HTTPS RSS/Atom feed URL."});
 try { const r=db.prepare("INSERT INTO feed_sources(name,url) VALUES(?,?)").run(name,url); res.json({id:Number(r.lastInsertRowid)}); }
 catch { res.status(409).json({error:"This feed is already added."}); }
});
app.delete("/api/feeds/:id",auth,(req,res)=>{db.prepare("DELETE FROM feed_sources WHERE id=?").run(Number(req.params.id));res.json({ok:true});});
function classifyUpdate(title, summary="") {
 const t=(title+" "+summary).toLowerCase();
 if(/recruit|vacanc|job|appointment|selection|admit card|hall ticket|answer key|result|exam|application form/.test(t)) return "Recruitment & exams";
 if(/scheme|beneficiar|subsid|pension|yojana|welfare|farmer|scholarship/.test(t)) return "Schemes & benefits";
 return "Government announcements";
}
async function pollFeeds() {
 const feeds=db.prepare("SELECT * FROM feed_sources WHERE enabled=1").all(); const now=new Date().toISOString();
 for(const feed of feeds) {
  try {
   const data=await parser.parseURL(feed.url);
   const upsert=db.prepare(`INSERT INTO feed_items(source,title,url,published,summary,category,last_seen_at,active) VALUES(?,?,?,?,?,?,?,1)
    ON CONFLICT(url) DO UPDATE SET source=excluded.source,title=excluded.title,published=CASE WHEN excluded.published<>'' THEN excluded.published ELSE feed_items.published END,summary=excluded.summary,category=excluded.category,last_seen_at=excluded.last_seen_at,active=CASE WHEN feed_items.unavailable_checks>=2 THEN 0 ELSE 1 END`);
   const users=db.prepare("SELECT id FROM users").all(), exists=db.prepare("SELECT id FROM feed_items WHERE url=?"), addNotice=db.prepare("INSERT INTO notifications(user_id,title,message,url) VALUES(?,?,?,?)");
   for(const item of (data.items||[]).slice(0,80)) {
    const url=clean(item.link,1000), title=clean(item.title,300), summary=clean(item.contentSnippet||item.content||item.summary,1500);
    if(!url||!title||!safeFeedUrl(url)) continue;
    const prior=exists.get(url);
    upsert.run(feed.name,title,url,asDateOnly(item.isoDate||item.pubDate)||clean(item.isoDate||item.pubDate,60),summary,classifyUpdate(title,summary),now);
    if(!prior) users.forEach(u=>addNotice.run(u.id,"New government update",title,url));
   }
   db.prepare("UPDATE feed_sources SET last_checked=?,last_error='' WHERE id=?").run(now,feed.id);
  } catch(e) {
   db.prepare("UPDATE feed_sources SET last_error=? WHERE id=?").run(clean(e.message,300),feed.id);
   console.warn("Official feed check failed:",feed.name,e.message);
  }
 }
}
// Only clear 404/410 responses are archived. 403/429/timeouts are inconclusive.
async function verifyNoticeLinks(){
 const rows=db.prepare("SELECT id,url FROM feed_items WHERE active=1 AND (last_link_check_at='' OR last_link_check_at<?) ORDER BY id DESC LIMIT 20").all(new Date(Date.now()-86400000).toISOString());
 for(const row of rows){ let status=0; const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),9000);
  try { let r=await fetch(row.url,{method:"HEAD",redirect:"follow",signal:controller.signal,headers:{"User-Agent":"JanasevaHub-NoticeVerifier/1.0"}});
   if(r.status===405||r.status===501) r=await fetch(row.url,{method:"GET",redirect:"follow",signal:controller.signal,headers:{"User-Agent":"JanasevaHub-NoticeVerifier/1.0","Range":"bytes=0-0"}}); status=r.status;
  }catch(e){} finally {clearTimeout(timer)}
  const gone=[404,410].includes(status), checked=new Date().toISOString();
  db.prepare("UPDATE feed_items SET last_link_check_at=?,last_http_status=?,unavailable_checks=CASE WHEN ? THEN unavailable_checks+1 ELSE unavailable_checks END,active=CASE WHEN ? AND unavailable_checks+1>=2 THEN 0 ELSE active END,unavailable_at=CASE WHEN ? AND unavailable_checks+1>=2 THEN ? ELSE unavailable_at END WHERE id=?").run(checked,status,gone?1:0,gone?1:0,gone?1:0,checked,row.id);
 }
}
app.get("/api/feed-items",auth,(req,res)=>res.json({items:db.prepare("SELECT * FROM feed_items ORDER BY id DESC LIMIT 100").all()}));
cron.schedule("*/15 * * * *",()=>{pollFeeds().then(verifyNoticeLinks).catch(e=>console.warn("Scheduled update check failed",e.message));});
app.post("/api/feeds/check",auth,async(req,res)=>{await pollFeeds();await verifyNoticeLinks();res.json({ok:true,message:"Official feed check completed."});});
setTimeout(()=>pollFeeds().then(verifyNoticeLinks).catch(e=>console.warn("Initial update check failed",e.message)),1500);

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"..","frontend","index.html")));
app.listen(PORT,()=>console.log(`Janaseva Hub running at http://localhost:${PORT}`));
