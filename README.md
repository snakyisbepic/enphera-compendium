# Enphera Compendium

A modular, SSR-first worldbuilding compendium website. Markdown files in `content/` are the source of truth; a PIN-protected admin panel at `/admin` lets the owner upload, replace, delete, and reorder chapters without touching code. The public site renders every chapter on a single long page so AI web scrapers (Grok, Claude, etc.) can read the full text directly in the raw HTML.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma (SQLite) · iron-session · remark/rehype.

---

## Quick start (local)

```bash
# 1. Install dependencies
npm install        # or: bun install / pnpm install / yarn install

# 2. Configure environment
cp .env.example .env.local
#   → open .env.local and set ADMIN_PIN + SESSION_SECRET

# 3. Create the SQLite database and tables
npm run db:push

# 4. Run the dev server
npm run dev
# Visit http://localhost:3000
```

The `content/` directory ships with 5 sample chapters. On first run the app auto-seeds the database from these files — no manual setup needed.

To manage chapters: open `/admin` and enter the PIN you set in `.env.local` (default `1234`).

---

## ⚠️ Important: this site does NOT work on Netlify or Vercel

The architecture depends on three things that **serverless hosts cannot provide**:

1. **A persistent filesystem** — markdown files are read from `content/` via `fs.readFile`, and the admin panel writes new `.md` files there. Serverless functions have an ephemeral, read-only filesystem — uploads would silently vanish.
2. **SQLite on disk** — SQLite needs a persistent local file. Serverless hosts spin up fresh containers per invocation.
3. **A long-lived Node process** — for the admin session cookie and Prisma client to remain warm.

On Netlify/Vercel the **public reading page would work** (markdown baked in at build time), but the **entire admin panel would silently fail** — uploads, deletes, reorder, and scan would all appear to succeed then lose their changes.

### Hosts that DO work

| Host | Why | Effort | Notes |
|------|-----|--------|-------|
| **Railway** | Persistent volumes, runs Next.js as a long-lived container, SQLite just works | Lowest | Easiest path. Connect your GitHub repo or `railway up` from CLI. |
| **Render** | Persistent disks on the paid plan | Low | Web Service + Disk. |
| **Fly.io** | Persistent volumes, great for SQLite + Node | Low–medium | Use a `fly.toml` with a mounted volume. |
| **VPS** (DigitalOcean droplet, Hetzner, etc.) | Full filesystem control | Medium | Run `npm run build && npm run start` behind nginx/Caddy. |

---

## Deploying to Railway (recommended — takes ~5 minutes)

1. **Push this folder to a GitHub repo** (or use the Railway CLI: `railway init && railway up`).
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
3. In the project settings:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm run start`
   - **Node version:** 20 or later
4. Add a **Volume** (Settings → Volumes):
   - Mount path: `/data`
   - This is where the SQLite database AND your `content/` directory will live persistently.
5. Set **Environment Variables** (Settings → Variables):
   ```
   DATABASE_URL=file:/data/enphera.db
   ADMIN_PIN=<your-pin>
   SESSION_SECRET=<openssl rand -hex 32>
   NODE_ENV=production
   ```
6. **Important:** for `content/` to persist across redeploys, you need to either:
   - **Option A (simplest):** symlink `content/` to `/data/content/` by adding a `postinstall` script: `"postinstall": "prisma generate && mkdir -p /data/content && cp -rn content/* /data/content/ 2>/dev/null; ln -sfn /data/content content"`.
   - **Option B (cleaner):** change `CONTENT_DIR` in `src/lib/chapters.ts` from `path.resolve(process.cwd(), 'content')` to `path.resolve(process.env.CONTENT_DIR || '/data/content')`, set `CONTENT_DIR=/data/content` as an env var, and pre-copy your starter chapters into the volume on first deploy.
7. First deploy: Railway runs `postinstall` (which generates the Prisma client). On first visit, the app auto-creates the SQLite tables and seeds chapters from `content/`.

---

## Deploying to a VPS (DigitalOcean / Hetzner / etc.)

```bash
# On the server (after installing Node 20+, git, and nginx):
git clone <your-repo> /opt/enphera
cd /opt/enphera
cp .env.example .env
# Edit .env: set DATABASE_URL, ADMIN_PIN, SESSION_SECRET, NODE_ENV=production

npm install
npm run db:push
npm run build

# Run with a process manager (pm2 or systemd):
pm2 start "npm run start" --name enphera
pm2 save
pm2 startup

# Configure nginx to proxy http://localhost:3000
```

The `content/` directory lives at `/opt/enphera/content/` and persists normally on a VPS.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | SQLite path. Use an absolute path that lives on a persistent volume on the host (e.g. `file:/data/enphera.db`). |
| `ADMIN_PIN` | ✅ | 4–8 digit PIN for the admin panel. Default `1234`. **Change before deploying.** |
| `SESSION_SECRET` | ✅ | Long random string for cookie encryption. Generate with `openssl rand -hex 32`. |
| `SESSION_COOKIE_NAME` | optional | Cookie name. Defaults to `enphera_admin_session`. |
| `NODE_ENV` | optional | Set to `production` on the host. |

---

## File structure

```
content/                      Markdown chapter files (source of truth)
  00-welcome.md
  01-cosmology.md
  02-vona.md
  03-species.md
  04-liravaen.md
db/                           SQLite database file lives here (auto-created)
prisma/
  schema.prisma               Chapter model (metadata only)
public/                       Static assets
src/
  app/
    page.tsx                  Public compendium (SSR all chapters on one page)
    layout.tsx                Root layout with fonts
    admin/
      page.tsx                PIN-gated admin panel
    api/
      chapters/route.ts       GET /api/chapters (public)
      admin/
        auth/route.ts         POST /api/admin/auth (PIN → session cookie)
        session/route.ts      GET /api/admin/session
        chapters/
          route.ts            POST /api/admin/chapters (upload)
          [id]/route.ts       GET (preview), PUT (replace), DELETE
        reorder/route.ts     PATCH /api/admin/reorder
        scan/route.ts         POST /api/admin/scan (sync content/ ↔ DB)
  components/
    chapter-renderer.tsx      Markdown → HTML (server component)
    table-of-contents.tsx     Sidebar TOC with active-chapter tracking
    admin/
      pin-gate.tsx
      chapter-card.tsx        dnd-kit sortable card
      admin-dashboard.tsx
  lib/
    db.ts                     Prisma client
    session.ts                iron-session helpers
    chapters.ts               File I/O + frontmatter parsing + DB sync
    markdown.ts               remark → HTML pipeline
```

---

## How chapters work

- Each chapter is a markdown file in `content/` named like `01-cosmology.md`.
- The filename's leading number (`01-`, `02-`, ...) is purely cosmetic; actual sort order is stored in the DB and editable via drag-and-drop in the admin panel.
- Optional YAML frontmatter at the top of each file:
  ```yaml
  ---
  title: "Cosmology & The Planet"
  status: "canon"   # canon | draft | open  (optional)
  ---
  ```
- If no `title` is provided, it's derived from the filename.
- If `status` is `draft`, a "DRAFT" badge appears next to the chapter title.

To add a new chapter: upload a `.md` file via the admin panel, or drop the file into `content/` and click "Scan content/" in the admin dashboard.

---

## Admin features

- **PIN gate** at `/admin` — wrong PIN triggers a shake animation; correct PIN sets a 24-hour encrypted cookie.
- **Chapter cards** with: Replace (file picker), Preview (modal renders HTML), Delete (confirmation), and up/down arrows.
- **Drag-and-drop reordering** via @dnd-kit (also works with touch + keyboard).
- **Upload zone** for adding new `.md` files; frontmatter is parsed automatically.
- **Scan content/** button syncs the DB with on-disk markdown files (adds new, flags missing).
- **Sign out** clears the session cookie.

---

## Security notes

- Filenames are validated strictly: only `.md` extension, alphanumeric + dashes + underscores + dots, no path traversal, and the resolved path must stay inside `content/`.
- All admin API routes verify the session cookie and return 401 if missing/invalid.
- The `SESSION_SECRET` is used by iron-session to encrypt the cookie — **use a strong, unique secret** (≥ 32 chars).
- The PIN is checked against an env var, never stored in the database.

---

## Troubleshooting

**"Prisma can't reach the database"** — Make sure `DATABASE_URL` points to a writable path on a persistent volume. On serverless hosts, this will silently fail.

**"Uploads disappear after redeploy"** — Your `content/` directory isn't on a persistent volume. See the Railway deployment notes above.

**"Wrong PIN" error after setting a new one** — Restart the server after changing env vars so the new value is loaded.

**Admin page shows blank screen** — Check the browser console. If you see 401 errors on `/api/admin/session`, your `SESSION_SECRET` may have changed (which invalidates existing cookies) or the cookie has expired (24h TTL). Just re-enter the PIN.

---

## License & ownership

This is a private worldbuilding project. All sample chapters in `content/` are placeholders to be replaced with your own.
