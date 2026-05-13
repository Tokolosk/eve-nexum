# Pathfinder Audit — Server & Web

Synthesis of two parallel audits (server-side and web-side). Findings ranked by impact.

## Fixed in this pass

**CRITICAL**
- Admin self-promote bug — `server/src/routes/auth.ts` (CASE now guarded with `$7 IS NOT NULL`).
- IDOR on signatures/structures — `server/src/routes/maps.ts` (`verifySystemInMap` helper now called from all eight sig/structure handlers).
- Missing write check on `POST /:mapId/systems` — now calls `requireMapWrite`.

**HIGH — server**
- Session cookie `sameSite: 'lax'` set, `express.json({ limit: '2mb' })`, secret moved to `config.ts` with a production-only guard.
- OAuth state now `crypto.randomBytes(32).toString('hex')`; callback rejects when `req.session.oauthState` is missing.
- Session fixation: `req.session.regenerate(...)` before assigning `userId` on successful login.
- `readonly` users can no longer rename corp maps — PATCH `/:mapId` uses `requireMapWrite`.
- GET signatures/structures use read-access (`getMapAccess`) instead of `requireMapWrite`.
- `requireAdmin` middleware now re-verifies role from the DB on every request and syncs it back to the session.
- Input validation: map name capped at 200 chars; `panelOrder` validated as a bounded array of short strings; `/maps/import` capped at 500 systems / 2000 connections; `destinationId` coerced and range-checked (positive int32).
- Admin demote: refuses self-demote and refuses to demote the configured `ADMIN_CHAR_ID`.
- Rate limiting: `express-rate-limit` applied — tight limit on `/auth`, looser limit on ESI proxies (`/api/character`, `/api/killboard`, `/api/activity`, `/api/incursions`, `/api/insurgency`), IP-keyed limit on public `/api/systems`.
- OAuth tokens encrypted at rest — AES-256-GCM via `utils/tokenCrypto.ts`, wire format `enc:v1:base64(iv||tag||ct)`, `TOKEN_ENCRYPTION_KEY` env var required in prod (derived from `SESSION_SECRET` in dev). `migrate.ts` rolls forward any legacy plaintext rows on boot; `eveToken.ts` transparently decrypts/encrypts on refresh.
- Admin audit log — new `admin_audit` table; PATCH `/api/admin/users/:id/role` writes a row with actor, target, old/new role; new `GET /api/admin/audit` returns the last 200 actions.

## HIGH — web

- **Wide `useMapStore()` destructures cascade re-renders** — `App.tsx`, `Toolbar.tsx:64`, `MapSidebar.tsx:9`, `MapCanvas.tsx:76`, `SystemPanel.tsx:53` all pull 10+ fields with no selector, so every store mutation re-renders these. This is the root of the race-condition class patched in commit `3a8a396`. Fix: `useMapStore(s => s.field)` per field.
- **Per-node hook subscribers** — `SystemNode.tsx:25-28` calls `useIncursions()` and `useInsurgency()` for every node, each registering its own subscriber and 1-hour `setInterval`. With 50 nodes that's 100 timers. Lift to `MapCanvas` and pass down, or make it a singleton.
- **`@uiw/react-md-editor` renders markdown to HTML via an unsafe-HTML React prop** (`NotesEditor.tsx:47`, `SystemPanel.tsx:115`) with no explicit sanitizer. Sig/structure notes are co-user-authored on corp maps. Configure `previewOptions={{ rehypePlugins: [[rehypeSanitize]] }}`.
- **Sort-on-paste runs against stale state** — `SignaturePane.tsx:183`. The final `setSigs(prev => [...prev].sort(...))` runs before the per-sig `setSigs` calls from the `for await` loop have flushed, so the sort is a no-op on new entries. Likely the bug commit `883e51d` aimed at. Collect locally then one final setter.
- **`SignaturePane` re-renders every 1 s** to update "Age" labels — rerenders all `<NotesEditor>` MDEditor instances. Extract elapsed cell into its own child.
- **`mapStore` module-level debounce timers (`nameTimer`, `moveTimers`)** survive across `switchMap` — pending writes fire against the wrong map. Clear in `switchMap`.
- **`useEsiSystem` per-node on initial load** — `SystemNode.tsx:24`. N parallel `/universe/systems/{id}/` requests to ESI. Batch via backend or add a concurrency limit.
- **`Toolbar.useNow` ticks every 5 s** re-rendering the whole toolbar despite only one label needing it — scope into a child.
- **`AuthContext` value object recreated every render** (`AuthContext.tsx:53`) — `useMemo` the value, separate `user` from `actions`.

## Server performance

- **`GET /api/admin/users`** (`admin.ts:9-29`) — correlated `IN (SELECT … IN (SELECT …))` plus double `LEFT JOIN COUNT(DISTINCT)` is cartesian-explosive. Rewrite as two grouped subqueries joined on `user_id`.
- **`GET /:mapId`** (`maps.ts:191-227`) — 4 sequential awaits; `systems` and `connections` should be `Promise.all`.
- **`/maps/import`** runs N serial INSERTs in a transaction (`maps.ts:120-188`). Use bulk INSERT or `pg-copy-streams`.
- **`stats.ts:23-71`** pulls every user event into memory and buckets in JS. Push aggregation to SQL with `WHERE created_at >= start.year` + `GROUP BY` + `FILTER`.
- **`recordSnapshot()`** (`activity.ts:93-130`) — one `INSERT … ON CONFLICT` per tracked system serially. Batch with `unnest()` or multi-row VALUES.
- **`/api/activity/:systemId`** (`activity.ts:160-168`) writes a DB snapshot on *every* request, regardless of ESI cache hits. Gate snapshots on "last recorded" timestamp.
- **`/auth/me`** queries DB on every call (`auth.ts:163-188`) — cache prefs on session, invalidate on PATCH.
- **`migrate.ts:97-113`** — missing index on `system_activity(hour)` for the `pruneOldRows` DELETE.
- **`killboard.ts:132-134`** — up to 25 parallel ESI fetches per request with no concurrency cap or shared in-flight dedupe.
- **`expireMaps`** (`index.ts:58-66`) runs hourly with full-scan on `maps`; add index on `last_active_at`.

## Cross-cutting pattern mismatches (both sides)

- **Error response shapes** — Server has JSON `{error}` in most routes but text `.send('…')` in `auth.ts`. Web has `{loading, error}` in `useStats`/`useKillboard` but silent `.catch(() => {})` in `SignaturePane.tsx:120` and others. Pick one shape; surface failures via toast on the client.
- **Validation** — No schema lib (zod/joi) anywhere. Server uses ad-hoc `parseInt`/`String(…)`; client trusts shape. Either adopt one, or share validators between client and server.
- **Auth checks** — Server: `routes/auth.ts` does manual `req.session.userId` checks instead of `requireAuth`; `routes/activity.ts`, `incursions.ts`, `insurgency.ts`, `killboard.ts`, `systems.ts` have no auth at all (intentional?). Web: `AuthUser.role` exists but the UI never enforces it — every edit button is always rendered for `readonly` users.
- **Logging** — Both sides: mixed `console.{log,error,warn}` with inconsistent prefixes. Add a small logger module on each side.
- **Caching** — Server: `incursions.ts`, `insurgency.ts`, `killboard.ts`, `activity.ts` each invent their own TTL cache. Web: similar per-hook caches. Shared utility on each side.
- **Direct `fetch` vs `api()` helper** — `useEsiSearch.ts:43` hits same-origin `/api/systems/search` with raw `fetch`; everywhere else uses `api()`.
- **Storage key naming** — `'nexum.foo'` (dot) vs `'nexum:last_character'` (colon) — pick one.
- **Confirmation flows** — `Toolbar.tsx` uses native `prompt()`/`confirm()`; `SignaturePane`/`StructuresPane` use `ConfirmModal`; `MapSidebar` uses native `alert()`. Standardise on `ConfirmModal`.
- **Role naming drift** — `session.d.ts:8` declares `'admin' | 'member' | 'readonly'`, `migrate.ts:23` migrates `'standard'` → `'readonly'`, `auth.ts:133` types role as `'admin' | 'standard'` (stale). Clean up.

## Latent correctness bugs

- **`activity.ts` `fetching` boolean is a soft-lock that races** — two concurrent callers see `fetching=false`. Use a `Promise` cache.
- **`activity.ts` module-level state** (`systemHistory`, `trackedSystems`, `esiCache`, `fetching`) and `init().then(scheduleNextPoll)` at module-import time, before `migrate()` finishes.
- **`mapStore.setMapName`** uses a module-level `nameTimer` — two maps open in two tabs collide. Key by `activeMapId` like `moveTimers`.
- **`addSystem` duplicate-detection** (`mapStore.ts:381-386`) — case-insensitive name match blocks adding the same hub twice across separate chains in K-space.
- **`useLocationTracking`** can fire `addSystem` before `loadMaps` completes; guards mostly handle it but `prevMapSystemId` going stale yields overlapping fallback positions.

## Lower-priority nits

- **`maps.ts:267`** uses `req.params.mapId` while rest of route uses destructured `access`.
- **`req.session.role ?? 'readonly'`** repeated 12 times in `maps.ts` — extract helper.
- **`killboard.ts:88`** uses `/:systemId(\\d+)` regex; `activity.ts:160` doesn't — align.
- **`migrate.ts:18-23`** repeats columns already in `CREATE TABLE` above.
- **`MapCanvas.tsx:82-86`** `initialNodes` is dead after second render; simpler form is `useNodesState<Node>([])`.
- **`mapStore.ts:24-27`** `emptyMap()` returns invalid `id: ''` — use `null`.
- **`ContextMenu.tsx:61`** magic numbers `34`/`12` tied to CSS row height — brittle coupling (not a CSS size suggestion).
- **WormholeTypePicker and LeadsToDropdown** duplicate ~80% of structure — extract shared `<Popover>` primitive.
- **`MapCanvas.tsx:289-301`** and `MapSidebar.tsx:22-36` re-implement the same dx/dy → handle string mapping — extract `pickHandles(src, tgt)` util.
- **`StructuresPane.tsx:91-115`** and `SignaturePane.tsx:173-181` paste handlers do sequential `await` — use `Promise.all`.
- **`mapStore.ts:159-168`** `applyUndo` for `remove_system` could `Promise.all` the connection POSTs.
