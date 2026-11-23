require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool, types } = require("pg");
// PostgreSQL BIGINT IDs are exposed as numbers to preserve the previous SQLite API shape.
types.setTypeParser(20, value => Number(value));
const Parser = require("rss-parser");
const cron = require("node-cron");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.JWT_SECRET;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Add your Supabase PostgreSQL connection string to backend/.env");
  process.exit(1);
}
if (!SECRET || SECRET === "local-development-secret-change-me") {
  console.error("Set a strong JWT_SECRET in backend/.env before starting the server.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});
pool.on("error", err => console.error("Unexpected PostgreSQL pool error:", err.message));

const parser = new Parser({
  timeout: 12000,
  headers: { "User-Agent": "JanasevaHub/1.0" }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

function tokenFor(user) {
  return jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: "7d" });
}
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  try {
    req.user = jwt.verify(h.startsWith("Bearer ") ? h.slice(7) : "", SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Please sign in to continue." });
  }
}
function clean(v, max = 4000) {
  return String(v ?? "").trim().slice(0, max);
}
function asDateOnly(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
function safeFeedUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !!u.hostname &&
      !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname);
  } catch {
    return false;
  }
}
function classifyUpdate(title, summary = "") {
  const t = (title + " " + summary).toLowerCase();
  if (/recruit|vacanc|job|appointment|selection|admit card|hall ticket|answer key|result|exam|application form/.test(t)) {
    return "Recruitment & exams";
  }
  if (/scheme|beneficiar|subsid|pension|yojana|welfare|farmer|scholarship/.test(t)) {
    return "Schemes & benefits";
  }
  return "Government announcements";
}

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, app: "Janaseva Hub", database: "connected", time: new Date().toISOString() });
  } catch (e) {
    console.error("Health database check failed:", e.message);
    res.status(503).json({ ok: false, app: "Janaseva Hub", database: "unavailable" });
  }
});

// Authentication
app.post("/api/auth/register", async (req, res) => {
  const name = clean(req.body.name, 80);
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || "");
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return res.status(400).json({ error: "Enter a name, valid email and password of at least 8 characters." });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email",
      [name, email, hash]
    );
    const user = result.rows[0];
    res.json({ token: tokenFor(user), user });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "An account with this email may already exist." });
    console.error("Registration failed:", e.message);
    res.status(500).json({ error: "Could not create the account. Please try again." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || "");
  try {
    const result = await pool.query("SELECT * FROM users WHERE email=$1 LIMIT 1", [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    res.json({ token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    console.error("Login failed:", e.message);
    res.status(500).json({ error: "Could not sign in. Please try again." });
  }
});

app.get("/api/me", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id,name,email,created_at FROM users WHERE id=$1",
      [req.user.id]
    );
    res.json({ user: result.rows[0] || null });
  } catch (e) {
    console.error("Profile lookup failed:", e.message);
    res.status(500).json({ error: "Could not load your profile." });
  }
});

// Jobs
app.get("/api/jobs", async (req, res) => {
  try {
    const q = clean(req.query.q, 120);
    const result = q
      ? await pool.query(
          "SELECT * FROM jobs WHERE title ILIKE $1 OR organisation ILIKE $1 OR region ILIKE $1 ORDER BY id DESC LIMIT 200",
          [`%${q}%`]
        )
      : await pool.query("SELECT * FROM jobs ORDER BY id DESC LIMIT 200");
    res.json({ jobs: result.rows });
  } catch (e) {
    console.error("Jobs lookup failed:", e.message);
    res.status(500).json({ error: "Could not load jobs." });
  }
});

app.post("/api/jobs", auth, async (req, res) => {
  const b = req.body;
  if (!clean(b.title, 180) || !clean(b.organisation, 180)) {
    return res.status(400).json({ error: "Job title and organisation are required." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO jobs(title,organisation,region,category,notification_url,application_start,application_end,exam_date,status,description,notification_date)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        clean(b.title, 180), clean(b.organisation, 180), clean(b.region, 100),
        clean(b.category, 100), clean(b.notification_url, 500), clean(b.application_start, 30),
        clean(b.application_end, 30), clean(b.exam_date, 30), clean(b.status, 40) || "Open",
        clean(b.description), clean(b.notification_date, 30)
      ]
    );
    res.json({ id: result.rows[0].id });
  } catch (e) {
    console.error("Job creation failed:", e.message);
    res.status(500).json({ error: "Could not save the job." });
  }
});

app.post("/api/jobs/:id/save", auth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid job ID." });
  try {
    const exists = await pool.query("SELECT id FROM jobs WHERE id=$1", [id]);
    if (!exists.rowCount) return res.status(404).json({ error: "Job not found." });
    await pool.query(
      `INSERT INTO saved_jobs(user_id,job_id,stage,notes,reminder_date)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(user_id,job_id) DO UPDATE
       SET stage=EXCLUDED.stage,notes=EXCLUDED.notes,reminder_date=EXCLUDED.reminder_date`,
      [req.user.id, id, clean(req.body.stage, 60) || "Interested", clean(req.body.notes, 1000), clean(req.body.reminder_date, 30)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("Save job failed:", e.message);
    res.status(500).json({ error: "Could not save this job." });
  }
});

app.get("/api/my/jobs", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.*,s.stage,s.notes,s.reminder_date
       FROM saved_jobs s JOIN jobs j ON j.id=s.job_id
       WHERE s.user_id=$1 ORDER BY s.job_id DESC`,
      [req.user.id]
    );
    res.json({ jobs: result.rows });
  } catch (e) {
    console.error("Saved jobs lookup failed:", e.message);
    res.status(500).json({ error: "Could not load your saved jobs." });
  }
});

app.delete("/api/my/jobs/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM saved_jobs WHERE user_id=$1 AND job_id=$2", [req.user.id, Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Remove saved job failed:", e.message);
    res.status(500).json({ error: "Could not remove the saved job." });
  }
});

// Schemes
app.get("/api/schemes", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM schemes ORDER BY level,name");
    res.json({ schemes: result.rows });
  } catch (e) {
    console.error("Schemes lookup failed:", e.message);
    res.status(500).json({ error: "Could not load schemes." });
  }
});

app.post("/api/schemes", auth, async (req, res) => {
  const b = req.body;
  if (!clean(b.name, 180)) return res.status(400).json({ error: "Scheme name is required." });
  try {
    const result = await pool.query(
      `INSERT INTO schemes(name,level,summary,eligibility,documents,official_url)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [clean(b.name, 180), clean(b.level, 80), clean(b.summary), clean(b.eligibility), clean(b.documents), clean(b.official_url, 500)]
    );
    res.json({ id: result.rows[0].id });
  } catch (e) {
    console.error("Scheme creation failed:", e.message);
    res.status(500).json({ error: "Could not save the scheme." });
  }
});

// Reminders
app.get("/api/reminders", auth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM reminders WHERE user_id=$1 ORDER BY due_at", [req.user.id]);
    res.json({ reminders: result.rows });
  } catch (e) {
    console.error("Reminders lookup failed:", e.message);
    res.status(500).json({ error: "Could not load reminders." });
  }
});

app.post("/api/reminders", auth, async (req, res) => {
  const title = clean(req.body.title, 180);
  const due = clean(req.body.due_at, 40);
  if (!title || !due) return res.status(400).json({ error: "Reminder title and date are required." });
  try {
    const result = await pool.query(
      "INSERT INTO reminders(user_id,title,due_at) VALUES($1,$2,$3) RETURNING id",
      [req.user.id, title, due]
    );
    res.json({ id: result.rows[0].id });
  } catch (e) {
    console.error("Reminder creation failed:", e.message);
    res.status(500).json({ error: "Could not create the reminder." });
  }
});

app.patch("/api/reminders/:id", auth, async (req, res) => {
  try {
    await pool.query("UPDATE reminders SET done=$1 WHERE id=$2 AND user_id=$3", [req.body.done ? 1 : 0, Number(req.params.id), req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Reminder update failed:", e.message);
    res.status(500).json({ error: "Could not update the reminder." });
  }
});

app.delete("/api/reminders/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM reminders WHERE id=$1 AND user_id=$2", [Number(req.params.id), req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Reminder delete failed:", e.message);
    res.status(500).json({ error: "Could not delete the reminder." });
  }
});

// Notifications
app.get("/api/notifications", auth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 100", [req.user.id]);
    res.json({ notifications: result.rows });
  } catch (e) {
    console.error("Notifications lookup failed:", e.message);
    res.status(500).json({ error: "Could not load notifications." });
  }
});

app.patch("/api/notifications/:id/read", auth, async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET read=1 WHERE id=$1 AND user_id=$2", [Number(req.params.id), req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Notification update failed:", e.message);
    res.status(500).json({ error: "Could not update the notification." });
  }
});

// Public date-wise notifications and currently-open application listings.
app.get("/api/public/notifications", async (req, res) => {
  const from = clean(req.query.from, 10);
  const to = clean(req.query.to, 10);
  const q = clean(req.query.q, 100).toLowerCase();
  const category = clean(req.query.category, 60);
  if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
    return res.status(400).json({ error: "Use YYYY-MM-DD dates." });
  }
  if (from && to && from > to) return res.status(400).json({ error: "From date must be on or before To date." });
  try {
    const [feedResult, jobResult, sourceResult] = await Promise.all([
      pool.query("SELECT id,source,title,url,published,summary,category,created_at FROM feed_items WHERE active=1 ORDER BY id DESC LIMIT 1000"),
      pool.query("SELECT id,title,organisation AS source,notification_url AS url,notification_date AS published,description AS summary,category,created_at,application_start,application_end,exam_date FROM jobs ORDER BY id DESC LIMIT 1000"),
      pool.query("SELECT name,last_checked,last_error FROM feed_sources WHERE enabled=1 ORDER BY name")
    ]);
    const combined = [...feedResult.rows, ...jobResult.rows].map(x => ({
      ...x,
      published_date: asDateOnly(x.published) || asDateOnly(x.created_at),
      kind: x.application_end !== undefined ? "job" : "feed"
    }));
    const items = combined.filter(x => {
      if (from && (!x.published_date || x.published_date < from)) return false;
      if (to && (!x.published_date || x.published_date > to)) return false;
      if (category && category !== "all" && x.category !== category) return false;
      if (q && !(`${x.title} ${x.summary || ""} ${x.source || ""}`).toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (b.published_date || "").localeCompare(a.published_date || ""));
    const sources = sourceResult.rows;
    res.json({
      items: items.slice(0, 300),
      sources,
      last_checked: sources.map(x => x.last_checked).filter(Boolean).sort().at(-1) || "",
      refresh_minutes: 15
    });
  } catch (e) {
    console.error("Public notifications lookup failed:", e.message);
    res.status(500).json({ error: "Could not load notifications." });
  }
});

app.get("/api/public/active-notifications", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const result = await pool.query(
      "SELECT id,title,organisation,region,category,notification_url,notification_date,application_start,application_end,exam_date,description FROM jobs WHERE application_end<>'' ORDER BY application_end ASC"
    );
    const rows = result.rows;
    const active = rows.filter(j => (!j.application_start || j.application_start <= today) && j.application_end >= today)
      .map(j => ({
        ...j,
        status: (new Date(j.application_end + "T23:59:59Z") - new Date(today + "T00:00:00Z")) / 86400000 <= 7 ? "Closing Soon" : "Active",
        days_remaining: Math.max(0, Math.ceil((new Date(j.application_end + "T23:59:59Z") - new Date(today + "T00:00:00Z")) / 86400000))
      }));
    const upcoming = rows.filter(j => j.application_start && j.application_start > today).map(j => ({ ...j, status: "Upcoming" }));
    res.json({
      today, active, upcoming,
      note: "Application status is calculated only from listings with an entered application start/end date. Verify the official notice before applying."
    });
  } catch (e) {
    console.error("Active notifications lookup failed:", e.message);
    res.status(500).json({ error: "Could not load active notifications." });
  }
});

// Public live updates from official RSS/Atom feeds.
app.get("/api/public/updates", async (req, res) => {
  const category = clean(req.query.category, 60);
  const q = clean(req.query.q, 100);
  const values = [];
  let sql = "SELECT id,source,title,url,published,summary,created_at,category,last_seen_at,unavailable_at FROM feed_items WHERE active=1";
  if (category && category !== "all") {
    values.push(category);
    sql += ` AND category=$${values.length}`;
  }
  if (q) {
    values.push(`%${q}%`);
    const n = values.length;
    sql += ` AND (title ILIKE $${n} OR summary ILIKE $${n} OR source ILIKE $${n})`;
  }
  sql += " ORDER BY COALESCE(NULLIF(published,''),created_at) DESC,id DESC LIMIT 100";
  try {
    const [itemResult, sourceResult] = await Promise.all([
      pool.query(sql, values),
      pool.query("SELECT name,last_checked,last_error FROM feed_sources WHERE enabled=1 ORDER BY name")
    ]);
    const sources = sourceResult.rows;
    res.json({
      items: itemResult.rows,
      sources,
      last_checked: sources.map(x => x.last_checked).filter(Boolean).sort().at(-1) || "",
      refresh_minutes: 15,
      notice: "Updates are collected from official RSS feeds. Open the original source to confirm details."
    });
  } catch (e) {
    console.error("Live updates lookup failed:", e.message);
    res.status(500).json({ error: "Could not load live updates." });
  }
});

app.get("/api/public/updates/status", async (req, res) => {
  try {
    const [sources, active, archived] = await Promise.all([
      pool.query("SELECT name,url,last_checked,last_error,enabled FROM feed_sources ORDER BY name"),
      pool.query("SELECT COUNT(*)::int AS n FROM feed_items WHERE active=1"),
      pool.query("SELECT COUNT(*)::int AS n FROM feed_items WHERE active=0")
    ]);
    res.json({
      ok: true,
      active: active.rows[0].n,
      archived: archived.rows[0].n,
      sources: sources.rows,
      checked_at: sources.rows.map(x => x.last_checked).filter(Boolean).sort().at(-1) || null
    });
  } catch (e) {
    console.error("Update status lookup failed:", e.message);
    res.status(500).json({ error: "Could not load update status." });
  }
});

app.get("/api/feeds", auth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM feed_sources ORDER BY id");
    res.json({ feeds: result.rows });
  } catch (e) {
    console.error("Feeds lookup failed:", e.message);
    res.status(500).json({ error: "Could not load feeds." });
  }
});

app.post("/api/feeds", auth, async (req, res) => {
  const name = clean(req.body.name, 120);
  const url = clean(req.body.url, 500);
  if (!name || !safeFeedUrl(url)) return res.status(400).json({ error: "Enter a named public HTTPS RSS/Atom feed URL." });
  try {
    const result = await pool.query(
      "INSERT INTO feed_sources(name,url) VALUES($1,$2) RETURNING id",
      [name, url]
    );
    res.json({ id: result.rows[0].id });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "This feed is already added." });
    console.error("Add feed failed:", e.message);
    res.status(500).json({ error: "Could not add this feed." });
  }
});

app.delete("/api/feeds/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM feed_sources WHERE id=$1", [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Delete feed failed:", e.message);
    res.status(500).json({ error: "Could not delete this feed." });
  }
});

async function pollFeeds() {
  const feedsResult = await pool.query("SELECT * FROM feed_sources WHERE enabled=1");
  const feeds = feedsResult.rows;
  const now = new Date().toISOString();

  for (const feed of feeds) {
    try {
      const data = await parser.parseURL(feed.url);
      const usersResult = await pool.query("SELECT id FROM users");
      const users = usersResult.rows;

      for (const item of (data.items || []).slice(0, 80)) {
        const url = clean(item.link, 1000);
        const title = clean(item.title, 300);
        const summary = clean(item.contentSnippet || item.content || item.summary, 1500);
        if (!url || !title || !safeFeedUrl(url)) continue;

        const publishedRaw = item.isoDate || item.pubDate;
        const published = asDateOnly(publishedRaw) || clean(publishedRaw, 60);
        const category = classifyUpdate(title, summary);

        const prior = await pool.query("SELECT id FROM feed_items WHERE url=$1", [url]);
        await pool.query(
          `INSERT INTO feed_items(source,title,url,published,summary,category,last_seen_at,active)
           VALUES($1,$2,$3,$4,$5,$6,$7,1)
           ON CONFLICT(url) DO UPDATE SET
             source=EXCLUDED.source,
             title=EXCLUDED.title,
             published=CASE WHEN EXCLUDED.published<>'' THEN EXCLUDED.published ELSE feed_items.published END,
             summary=EXCLUDED.summary,
             category=EXCLUDED.category,
             last_seen_at=EXCLUDED.last_seen_at,
             active=CASE WHEN feed_items.unavailable_checks>=2 THEN 0 ELSE 1 END`,
          [feed.name, title, url, published, summary, category, now]
        );

        if (!prior.rowCount && users.length) {
          await pool.query(
            `INSERT INTO notifications(user_id,title,message,url)
             SELECT id,$1,$2,$3 FROM users`,
            ["New government update", title, url]
          );
        }
      }
      await pool.query("UPDATE feed_sources SET last_checked=$1,last_error='' WHERE id=$2", [now, feed.id]);
    } catch (e) {
      await pool.query("UPDATE feed_sources SET last_error=$1 WHERE id=$2", [clean(e.message, 300), feed.id]).catch(() => {});
      console.warn("Official feed check failed:", feed.name, e.message);
    }
  }
}

// Only clear 404/410 responses are archived. 403/429/timeouts are inconclusive.
async function verifyNoticeLinks() {
  const cutoff = new Date(Date.now() - 86400000).toISOString();
  const result = await pool.query(
    `SELECT id,url FROM feed_items
     WHERE active=1 AND (last_link_check_at='' OR last_link_check_at<$1)
     ORDER BY id DESC LIMIT 20`,
    [cutoff]
  );

  for (const row of result.rows) {
    let status = 0;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      let response = await fetch(row.url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "JanasevaHub-NoticeVerifier/1.0" }
      });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(row.url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { "User-Agent": "JanasevaHub-NoticeVerifier/1.0", "Range": "bytes=0-0" }
        });
      }
      status = response.status;
    } catch (e) {
      // Network errors are inconclusive; do not archive the item.
    } finally {
      clearTimeout(timer);
    }

    const gone = [404, 410].includes(status);
    const checked = new Date().toISOString();
    await pool.query(
      `UPDATE feed_items SET
         last_link_check_at=$1,
         last_http_status=$2,
         unavailable_checks=CASE WHEN $3 THEN unavailable_checks+1 ELSE unavailable_checks END,
         active=CASE WHEN $3 AND unavailable_checks+1>=2 THEN 0 ELSE active END,
         unavailable_at=CASE WHEN $3 AND unavailable_checks+1>=2 THEN $1 ELSE unavailable_at END
       WHERE id=$4`,
      [checked, status, gone, row.id]
    );
  }
}

app.get("/api/feed-items", auth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM feed_items ORDER BY id DESC LIMIT 100");
    res.json({ items: result.rows });
  } catch (e) {
    console.error("Feed items lookup failed:", e.message);
    res.status(500).json({ error: "Could not load feed items." });
  }
});

let feedCheckRunning = false;
async function runFeedChecks() {
  if (feedCheckRunning) return;
  feedCheckRunning = true;
  try {
    await pollFeeds();
    await verifyNoticeLinks();
  } finally {
    feedCheckRunning = false;
  }
}

cron.schedule("*/15 * * * *", () => {
  runFeedChecks().catch(e => console.warn("Scheduled update check failed:", e.message));
});

app.post("/api/feeds/check", auth, async (req, res) => {
  try {
    await runFeedChecks();
    res.json({ ok: true, message: "Official feed check completed." });
  } catch (e) {
    console.error("Manual feed check failed:", e.message);
    res.status(500).json({ error: "The official feed check could not be completed." });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

async function start() {
  try {
    await pool.query("SELECT 1");
    console.log("Supabase PostgreSQL connection successful.");
    app.listen(PORT, () => console.log(`Janaseva Hub running on port ${PORT}`));
    setTimeout(() => {
      runFeedChecks().catch(e => console.warn("Initial update check failed:", e.message));
    }, 1500);
  } catch (e) {
    console.error("Could not connect to Supabase PostgreSQL:", e.message);
    process.exit(1);
  }
}

start();

async function shutdown() {
  console.log("Shutting down Janaseva Hub...");
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
