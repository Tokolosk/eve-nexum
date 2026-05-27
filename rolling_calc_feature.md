# Wormhole Rolling Calculator — Design

## 1. Goal

Turn the per-connection **mass tracker** (`ConnectionPanel.tsx`) into a proper
**rolling calculator**: pick a roller ship, click each pass, and the panel tells
you — accounting for the **±10% mass variance** — whether the next pass is safe,
might collapse the hole, and (via side-tracking) whether a collapse would
**strand your roller on the wrong side**.

"Rolling" = deliberately jumping mass through a wormhole to collapse it and force
a fresh static. The danger is collapsing it while your roller is on the far side
(stranded) or collapsing it earlier than expected because the hole's real mass
was on the low end of its ±10% band.

Scope (from product decisions): **per-connection** (upgrade the existing panel),
**model ±10% variance** with worst-case guidance, **roller ship with cold/hot
masses + side tracking**.

## 2. Domain model

- **Total mass** `T` (nominal, from `wormholes.json` → `whSpec.totalMass`). The
  *actual* collapse threshold is uniformly somewhere in **`[0.9·T, 1.1·T]`**.
  - `worstTotal = 0.9·T` (collapses soonest — the number we make decisions on)
  - `bestTotal  = 1.1·T`
- **Max jump mass** `J` (`whSpec.maxJumpMass`) — a ship heavier than `J` can't
  pass at all. (Treated as fixed; variance is applied to total only.)
- **Mass used** `M` — cumulative kg pushed through, **already persisted** on the
  connection (`massUsed`, BIGINT kg) and synced in real time.
- **In-game status bands** (function of *actual* remaining fraction): `stable`
  > 50%, `destabilized` (in-game "reduced") 10–50%, `critical` ≤ 10%. Already
  stored as `massStatus`.

### Collapse state from `M` vs the variance band
- **Open (certain)** — `M < worstTotal`
- **May have collapsed** — `worstTotal ≤ M < bestTotal`
- **Collapsed (certain)** — `M ≥ bestTotal`

### Remaining, as a range
- `worstRemaining = max(0, worstTotal − M)` — the mass you can *safely* count on.
- `bestRemaining  = max(0, bestTotal − M)`.

### Optional tightening from observed status (v1.1, nice-to-have)
The in-game text the user already records in `massStatus` constrains the band:
- `stable` ⇒ actual remaining > 50% ⇒ `actual > 2M` ⇒ raise the lower bound to
  `max(0.9·T, 2M)`.
- `critical` ⇒ actual remaining ≤ 10% ⇒ `actual ≤ M / 0.9` ⇒ lower the upper
  bound. Helps the "is it about to pop" call. Keep behind the same math, applied
  only when a status is explicitly set. Flag in UI as "narrowed by observed
  status."

## 3. Data already present (no schema change)

- `whSpec` via `useWormholeTypes()` → `{ totalMass, maxJumpMass, massRegen,
  lifetimeHours, dest, src }` (keyed by WH code; `server/data/wormholes.json`).
- Connection carries `type` (WH code), `massUsed` (kg), `massStatus`, `size`.
- `PATCH /api/maps/:mapId/connections/:id` already accepts `massUsed` +
  `massStatus`; `mapStore.updateConnection` is optimistic + synced.
- `useCharacterLocation().ship` gives the viewer's live ship mass (already used
  for the "~N more jumps" budget line) — we keep that as a quick "use my current
  ship as roller" shortcut.

**What syncs vs. local:**
- **Shared (persisted, synced):** `massUsed`, `massStatus`. The cumulative roll
  is corp-shared truth — everyone watching the hole sees progress live. *No
  change to what's stored.*
- **Local (localStorage, per user):** the roller ship config (name + cold + hot
  mass) and the current **side** the roller is on. Side-tracking is a property of
  *the person physically rolling*, not the hole, so it doesn't belong on the
  shared record. `nexum.roller` = `{ name, coldKg, hotKg }`.

## 4. Calculation logic (precise)

Given `M`, `worstTotal`, `bestTotal`, and a prospective pass of mass `m`:

```
afterM = M + m
SAFE      : afterM <  worstTotal           // cannot collapse — green
RISKY     : worstTotal <= afterM < bestTotal // might collapse — amber
COLLAPSE  : afterM >= bestTotal             // will collapse — red (intended last pass)
```

Side-tracking:
- Roller starts **Home**. Each pass flips `side` (Home→Far→Home…). A round trip
  = 2 passes, ends Home.
- A pass that is **RISKY or COLLAPSE** and ends the roller **Far** ⇒
  **STRAND RISK** (if it pops, the roller is on the wrong side). Surface this
  loudly. The safe play: make the collapsing pass an *inbound* (Home-ending) one.

"Safe passes left" estimate (for the summary line), using the roller's chosen
per-pass mass `m` (default: hot out / cold back average, or just the selected
button's mass): `floor(worstRemaining / m)` — the number of passes guaranteed not
to collapse it. Also show `floor(bestRemaining / m)` as the optimistic count →
"≈ a–b passes left."

Blocking: if `coldKg > J` the roller can't use this hole at all; if `hotKg > J`
it can only pass cold (disable the hot button + note it).

## 5. UI — replaces the `mass-tracker` block in `ConnectionPanel.tsx`

Keep everything above it (WH type, mass/time status, size) unchanged. Replace the
tracker section (current lines ~206–270) with:

1. **Variance readout** (always, when `whSpec` resolved):
   - Bar shows `M` against `T`, with worst/best thresholds marked (e.g. a hatch
     at 90% and 110%, or two ticks). Reuse `.mass-tracker__bar/__fill` + a new
     `.mass-tracker__band` overlay for the ±10% zone.
   - Text: `worstRemaining`–`bestRemaining` remaining · max jump `J`.
   - Collapse-state pill: Open / May have collapsed / Collapsed.

2. **Roller config row:**
   - A small editable roller: name + cold (kg) + hot (kg) inputs, persisted to
     `localStorage`. A dropdown of built-in presets (e.g. *Higgs BS*, *Praxis*,
     *Megathron*, *Bhaalgorn*) seeds the masses; "Use my ship" pulls
     `location.ship.mass` as cold. Editable so people tune for fits.

3. **Pass controls** (the heart of it):
   - **Side indicator**: "Roller: ◉ Home" / "◉ Far".
   - Two primary buttons: **`Pass — hot (+X)`** and **`Pass — cold (+Y)`**. Each:
     `addMass`, flip side, recompute. Disabled/annotated per the blocking rules.
   - Each button is **colour-forecasted** for *its* outcome from the current `M`:
     green SAFE / amber RISKY / red COLLAPSE, with a tooltip ("ends Far — strand
     risk" when applicable).
   - **Undo last pass** (pops the last applied mass + restores side) and
     **Reset** (M→0, side→Home). Undo needs a small local stack of applied
     masses since `massUsed` is just a running total.

4. **Guidance line**: e.g. "≈ 3–4 safe passes left. Next hot pass is SAFE." or a
   prominent warning "⚠ Next pass may collapse the hole — you'd be stranded on
   the Far side. Make it an inbound pass." Drives off §4.

5. Keep the existing quick **add-mass presets** (frigate/cruiser/HIC/dread) as a
   secondary "other ships passed" row for mass that isn't your roller — they feed
   the same `M`. (They don't flip the roller side.)

Readonly users: inputs/buttons disabled (the panel already no-ops mutations via
`canEdit`); the readout + forecast still compute and display.

## 6. Edge cases
- **No WH type / no mass data** — keep the current hints ("enter a WH type…").
- **K162** — carries no mass spec; the auto-detect already prefers the real
  far-side code. If only K162 is known, show "enter the far-side code for mass
  data."
- **`massUsed` already past `bestTotal`** — show Collapsed; buttons → "already
  collapsed (reset?)".
- **Roller heavier than `J`** — block with a clear message (cold) / hot-only.
- **Regen** (`massRegen` > 0, rare on rolling targets) — ignore for v1; note as
  a future refinement (most rolling targets are 0-regen).
- **Concurrent rollers** — two people clicking passes both push `massUsed`;
  optimistic + synced handles it, last-write merges the total. Side is local to
  each, which is correct (each tracks their own ship).

## 7. Phased rollout
1. **Logic + variance readout**: pure functions (`passOutcome`, `collapseState`,
   `remainingRange`) + the worst/best bar and collapse pill. No new persistence.
2. **Roller config**: localStorage roller (name/cold/hot), presets, "use my
   ship", blocking rules.
3. **Pass controls + side-tracking**: hot/cold pass buttons with per-button
   forecast, side indicator, undo/reset, guidance line.
4. **(v1.1)** Tighten the band from observed `massStatus` (§2); regen handling.

## 8. Notes / risks
- **Variance is the whole point** — all "safe/can I make another pass" decisions
  read `worstTotal`, never nominal. Nominal is shown only as context.
- **No schema/endpoint change** — rides the existing `massUsed`/`massStatus`
  PATCH + sync. Keeps the realtime story intact.
- **Side is intentionally local** — it's about the pilot, not the hole; syncing
  it would be wrong when multiple people watch one hole.
- **Masses are user-tunable** — fits vary (Higgs anchor, prop mod size), so
  presets seed but never lock the numbers.
