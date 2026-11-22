# Janaseva Hub – Integrated working folder

This folder contains the Janaseva Hub build with the simplified navigation:
- **Overview**
- **Services**
- **Live Updates**
- **Learning Center**, organized into Early Childhood / Anganwadi, Study Materials, Exam Preparation, and Health & Well-being
- One **Tools & Resources** menu containing Planner, AI Tools and Document Studio

The Jobs and Schemes pages and their dashboard shortcuts have been removed from the user interface as requested. Their old database tables/backend routes may remain in the project for compatibility, but they are no longer exposed in the website navigation or pages.

## Run on macOS / VS Code

1. Install Node.js 20 or later.
2. Open this folder in VS Code.
3. In Terminal, run:

   ```bash
   npm run install:all
   npm start
   ```

4. Open http://localhost:3000

The local SQLite database is created at `backend/data/janaseva.db` the first time the backend starts. Keep the terminal open while using the local site.

## Important data coverage limitation

This is an integrated application build, **not yet a complete nationwide automatic job/scheme aggregator**. The existing live-update backend polls the configured PIB RSS feed and user-configured feeds. It does not yet crawl and verify every Central ministry, State and UT recruitment board or scheme department. The Jobs page will therefore show only records already present in the database with verified application start/end dates; this build starts with no verified job records. The Schemes page contains only the starter scheme directory from the earlier project version, not a complete current list for every State/UT. Do not interpret an empty page as proof that no government openings or schemes exist.

Before public launch, add and maintain official source connectors for each ministry, recruitment board and State/UT department, then implement source-specific parsing and verification. RSS aggregator results such as FreeJobAlert may be used for discovery only; final dates, eligibility, vacancy counts and application links must be checked against the official notification. Do not claim full coverage until those connectors have been built and tested.

## Deployment and security

This is a local development build. It is not deployed or guaranteed to run 24/7. Before public hosting, set a strong `JWT_SECRET`, use HTTPS, configure persistent database storage and backups, and review security/rate limits. Never collect Aadhaar numbers, OTPs, passwords for government portals or payment credentials.
