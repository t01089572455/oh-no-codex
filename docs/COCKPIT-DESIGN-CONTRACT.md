# Oh No, Codex! Cockpit design contract

Status: **LOCKED — GLASS MISSION DASHBOARD (Owner visual refresh 2026-07-31)**

This contract specifies a read-only local Cockpit. Task 6A originally locked
**Calibrated Plush Workshop**. On 2026-07-31 the Owner authorized a visual
refresh: reproduce the glass mission-dashboard reference under
`docs/ui设计参考图/` (Kimi-assisted HTML shell + product-honest data binding)
while preserving GET-only projection of the canonical read model.

Functional locks that still hold:

- zero runtime dependencies; vanilla HTML/CSS/JS
- no second current-state authority
- no write routes, forms, or browser storage
- same `/api/state` payload as `status --json`
- no invented trust percentages or fake metrics

## Lock header

| Field | Locked value |
| --- | --- |
| Register | Product |
| Aesthetic direction | Glass mission dashboard / soft lavender instrument UI |
| Direction name | **Glass Mission Pulse** |
| Color strategy | Soft field `#F0EDF8`, purple-blue accents, teal success, amber drift, red stop |
| Design system | Native semantic HTML plus WAI-ARIA Authoring Practices |
| Icon family | Minimal geometry + brand plush aperture; no icon font CDN |
| Design variance | 8/10 |
| Motion intensity | 2/10 (progress/ring only; reduced-motion removes transitions) |
| Visual density | 7/10 |
| Implementation medium | Zero-runtime-dependency vanilla HTML, CSS, and JavaScript |
| Brand media | `assets/brand/oh-no-codex-plush-hero.png`, unchanged |
| Reference board | `docs/ui设计参考图/vibetether-cockpit-final-oh-no-codex-lockup.png` |

Native HTML and WAI-ARIA patterns are the deliberate system choice. The frozen
V1 contract requires a vanilla local web view and zero runtime dependencies.
Task 6B must not add React, a component framework, a remote font request, or a
second client-side state store merely to imitate another system.

> Every screen must read as the same product if placed side by side.

## Design read

**A warm calibration bench where a mischievous plush observer watches one
precise stop gate decide whether Codex may move on.**

The product must feel quick, collaborative, and exact. It must not feel
hostile, militarized, bureaucratic, or like a generic SaaS administrator.
Warmth comes from the confirmed plush Hero and instrument field. Precision
comes from ruled lines, condensed type, exact labels, and the calibration
rail. Urgency appears only when the runtime state warrants it.

### Direction decision

Three approaches were considered:

1. **Calibrated Plush Workshop, selected.** Industrial signage carries the
   anti-drift purpose while the plush Hero keeps it friendly and specific to
   this product.
2. **Terminal specimen sheet, rejected.** It was precise but too close to a
   generic developer dashboard and did not honor the confirmed Hero.
3. **Plush control room, rejected.** It amplified the mascot but risked making
   blocked and stale evidence feel like a game.

The selected direction passes the counterfactual test: the plush observation
aperture, cursor caliper, and stop-beacon geometry would not be the default
answer for another local developer dashboard.

## Named anti-slop bans

Task 6B must contain none of the following:

- no three equal statistic cards, bento grid, nested cards, glass panels, or
  default admin sidebar;
- no purple-blue glow, mesh gradient, gradient text, or decorative status
  dots;
- no centered marketing hero, fake terminal screenshot, fake metrics, or
  "trusted by" content;
- no pill-shaped badge collection, generic framework typography, or icon-only
  status;
- no fake screws, scratched-metal texture, seven-segment display, or other
  industrial cosplay;
- no repeated mascot stickers and no use of the Hero's coral X as an error
  icon;
- no bouncing, pulsing, spinning, or infinite decorative motion;
- no invented timestamps, percentages, security claims, authority claims, or
  writable controls.

Panels are **instruments**, not floating cards. They share borders in one
continuous frame. Hierarchy comes from scale, rules, and position rather than
shadow stacks.

## Signature: the Calibration Rail

The remembered element is one full-width desktop measurement rail immediately
below the masthead. Below 720 px it becomes a narrow vertical calibration spine
beside the stacked instruments instead of being compressed into an unreadable
miniature.

- A numbered baseline represents `cursor / task_count`.
- A fixed left jaw marks the start of the plan.
- An amber moving jaw marks the current cursor when work is active or ready.
- A red vertical stop shutter closes across the jaw for `BLOCKED_DOC_SYNC`,
  `FAIL`, or `STALE`. It is orthogonal and never forms a diagonal X.
- A mint lock plate replaces the moving jaw for a fresh PASS.
- `UNKNOWN` and `UNAVAILABLE` use a diagonal ink hatch plus literal text.
- The rail always includes text (`CURSOR 2 OF 5`, `BLOCKED`, `FRESH`) and never
  communicates by color alone.

The rail is a data visualization of canonical fields, not decoration. It must
not imply fractional progress beyond the exact cursor and task count. When
there is no accepted plan, it reads `NO REVIEWED PLAN` with an unnumbered
baseline. When the plan is complete, both jaws meet at the far edge and the
label reads `PROJECT COMPLETE`.

The plush Hero appears in a clipped rectangular **observation aperture** in
the masthead. It never becomes a background texture or a substitute for
state. Desktop crop is 112 by 72 CSS pixels; narrow crop is 64 by 48. Use the
existing file with `object-fit: cover` and `object-position: 52% 48%`. The
image is decorative in the persistent masthead (`alt=""`). In the no-plan
empty state only, a larger use may replace, never duplicate, that aperture and
carry the repository's existing descriptive alt text.

## Locked color language

The instrument field is warm because the frozen brief explicitly calls for
instrument paper and the brand Hero contains warm workshop light. It is not a
generic cream landing-page palette. Near-black blue tint ties the field to the
Hero's face; saturated state colors are reserved for evidence.

| Token | OKLCH | Hex | Use |
| --- | --- | --- | --- |
| `field` | `oklch(95.3% 0.016 118.1)` | `#EEF1E5` | Warm yellow-green instrument stock, 60% visual weight |
| `surface` | `oklch(99.1% 0.008 121.6)` | `#FBFDF7` | Primary instrument face |
| `recessed` | `oklch(92.0% 0.017 128.7)` | `#E1E7DB` | Code wells, rail beds, secondary bands |
| `ink` | `oklch(24.0% 0.017 230.0)` | `#172126` | Primary text and structural rules |
| `muted-ink` | `oklch(46.1% 0.021 224.0)` | `#4C5B61` | Secondary copy |
| `subtle-ink` | `oklch(55.8% 0.018 211.1)` | `#68777A` | Nonessential metadata only |
| `border` | `oklch(60.8% 0.023 219.9)` | `#74868C` | Controls and meaningful dividers |
| `calibrated-amber` | `oklch(80.5% 0.148 78.1)` | `#F3B23C` | The one accent; active/current jaw |
| `amber-ink` | `oklch(52.4% 0.121 62.0)` | `#9A5700` | Amber text on light surfaces |
| `stop-red` | `oklch(56.1% 0.178 27.0)` | `#C83C36` | Blocked, FAIL, STALE |
| `proof-mint` | `oklch(50.0% 0.092 170.8)` | `#15745C` | Fresh PASS only |
| `local-info` | `oklch(48.3% 0.190 261.4)` | `#1554C7` | Read-only/local information only |
| `signal-white` | `oklch(100% 0 0)` | `#FFFFFF` | Text on red, mint, or blue signals |

### Recorded contrast

| Pair | Ratio | Requirement |
| --- | ---: | --- |
| `ink` on `field` | 14.31:1 | AAA text |
| `ink` on `surface` | 15.99:1 | AAA text |
| `muted-ink` on `surface` | 6.89:1 | AA text |
| `subtle-ink` on `surface` | 4.55:1 | AA text |
| `border` on `surface` | 3.71:1 | UI boundary |
| `amber-ink` on `surface` | 5.48:1 | AA text |
| `ink` on `calibrated-amber` | 8.77:1 | AAA text |
| `signal-white` on `stop-red` | 5.05:1 | AA text |
| `signal-white` on `proof-mint` | 5.70:1 | AA text |
| `signal-white` on `local-info` | 6.72:1 | AA text |

No dark theme is part of V1. There is no theme switch. State colors must also
change label, geometry, and border pattern so color is never the sole cue.

## Locked typography

Fonts are bundled local WOFF2 assets in Task 6B with their SIL Open Font
License notice. The Cockpit must make no network font request.

| Role | Family | Weight | Use |
| --- | --- | ---: | --- |
| Display | IBM Plex Sans Condensed | 600, 700 | Product name, NOW, state signal |
| Body | IBM Plex Sans | 400, 600 | Goal, behavior, explanatory copy |
| Utility/data | IBM Plex Mono | 400, 600 | Labels, revision, cursor, exact test, next |

Fallbacks are `"Arial Narrow", "Aptos", sans-serif` for display,
`"Aptos", "Segoe UI", sans-serif` for body, and `"Cascadia Mono",
"Consolas", monospace` for data. Bundled fonts are normative; fallbacks are
failure-safe only.

| Token | Desktop | Narrow | Rules |
| --- | --- | --- | --- |
| `display-xl` | 48/48 px | 34/36 px | Condensed 700, tracking `-0.015em` |
| `display-lg` | 32/34 px | 26/28 px | Condensed 700 |
| `heading` | 22/26 px | 20/24 px | Condensed 600 |
| `body` | 16/24 px | 16/24 px | Maximum measure 68ch |
| `data` | 14/20 px | 13/19 px | Mono, tabular numerals |
| `label` | 11/16 px | 11/16 px | Mono 600, `0.10em`, uppercase |

Exact commands preserve punctuation and case. They wrap with
`white-space: pre-wrap`, `overflow-wrap: anywhere`, and `min-width: 0`; the
page itself never gains horizontal overflow.

## Locked structural scales

- Spacing: `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`.
- Radius: `0, 2, 6` px. Use 6 px only for the brand aperture and the single
  refresh control. Instruments and signals use 0 or 2 px.
- Rules: 1 px minor, 2 px instrument boundary, 4 px state edge.
- Elevation: no panel shadows. The unavailable overlay alone may use
  `0 12px 32px rgb(23 33 38 / 16%)`.
- Content width: fluid up to 1440 px with 24 px desktop and 16 px narrow
  gutters.
- Z layers: base 0, sticky masthead 20, skip link 40. There are no modals,
  menus, tooltips, or toasts in V1.
- Focus: 3 px `ink` outer ring plus 2 px `surface` separation. On an ink
  surface, invert those two colors.
- Minimum control target: 48 by 48 CSS pixels.

## Locked motion

Motion has one purpose: reveal that a new state measurement has locked.

- `fast`: 100 ms.
- `measure`: 180 ms.
- `emphasis`: 300 ms.
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- A changed cursor jaw may translate once over 180 ms.
- A changed signal plate may enter with 4 px linear travel and opacity over
  180 ms.
- No element loops, bounces, pulses, spins, or animates merely because a state
  remains active.
- With `prefers-reduced-motion: reduce`, all transforms and transitions are
  removed. State changes remain immediate and fully understandable.

## Voice and exact visible vocabulary

Voice is plain, warm, and technical. It does not scold the user.

Fixed instrument labels:

- `NOW`
- `PROOF`
- `DRIFT`
- `NEXT`
- `RECENT`
- `LOCAL / READ ONLY`
- `REFRESH`

Canonical values are rendered verbatim. Friendly explanations may accompany
them, but cannot rename or soften `FAIL`, `UNKNOWN`, `STALE`,
`BLOCKED_DOC_SYNC`, `SYNC_GOVERNING_DOCUMENTS`, `PROPOSE_PLAN`,
`FREEZE_TASK:<id>`, `START_TASK:<id>`, or `PROJECT_COMPLETE`.

Visible copy must not contain buzzwords, fake metrics, authority language, or
claims of hostile-agent containment. The footer reads:

> Cooperative local guardrail. This view cannot authorize work or stop a
> same-user process.

## Canonical data contract

The page is a projection of the same read model returned by
`ohno status --json`. Task 6B may not define another current-state schema.

| Read-model field | Cockpit placement |
| --- | --- |
| `availability` | Global unavailable gate and masthead locality label |
| `goal` | Masthead goal line |
| `status` | NOW status flag |
| `plan_revision` | Rail utility line, abbreviated visually but full value available in text |
| `cursor`, `task_count` | Calibration Rail |
| `completed_count`, `completed` | RECENT ruled ledger |
| `current_task.id` | NOW primary identifier |
| `current_task.expected_behavior` | NOW main statement |
| `current_task.test_command` | Exact test well |
| `proof_freshness` | PROOF signal |
| `blocker` | DRIFT signal |
| `next_action` | NEXT gate |

The full plan revision must remain in the accessible name or adjacent text
even when the visual line shows the first 12 characters.

Allowed browser-only presentation state is limited to:

- whether one refresh request is in flight;
- the last announced state signature, solely to prevent repetitive live-region
  speech;
- whether the document is visible, solely to pause refresh work.

There is no `localStorage`, `sessionStorage`, IndexedDB, service worker, cookie,
client-authored canonical field, optimistic state, or cached fallback
authority. When the endpoint is unavailable, canonical fields clear and the
page shows UNAVAILABLE rather than presenting an old snapshot as current.

## Page anatomy

### 1. Skip link

The first focusable element is `Skip to current state`. It becomes visible at
the top-left on focus and targets the NOW heading.

### 2. Masthead

One horizontal rule contains:

- the plush observation aperture;
- `OH NO, CODEX!` as the single `h1`;
- the canonical goal, allowed to wrap to two lines before the header grows;
- `LOCAL / READ ONLY`;
- one `REFRESH` button.

There is no navigation rail. The Cockpit is one page with one job.

### 3. Calibration Rail

The desktop signature rail follows the masthead and precedes all state
instruments. On narrow screens its same semantic element becomes the left
spine of the stacked instrument frame. Its accessible name combines cursor,
task count, status, proof, and blocker. Decorative tick marks are hidden from
assistive technology.

### 4. Instrument frame

Desktop uses one asymmetric 12-column frame:

- NOW occupies columns 1 through 8 and is the visual focal point.
- PROOF and DRIFT share columns 9 through 12 as two ruled rows.
- NEXT spans all 12 columns beneath them as a high-contrast gate.
- RECENT is a full-width ruled ledger below NEXT.

No instrument is nested inside another. The exact-test well is a recessed
region within NOW, not a card.

### 5. Honesty footer

The footer contains the cooperative-boundary sentence and no links, version
badge, or release claim.

## Desktop wireframe

Target acceptance viewport: 1440 by 1024 CSS pixels at device scale factor 1.

```text
+--------------------------------------------------------------------------+
| [PLUSH APERTURE] OH NO, CODEX!  Goal text...   LOCAL / READ ONLY [REFRESH]|
+--------------------------------------------------------------------------+
| CALIBRATION RAIL  |0|----|1|----|2|>---|3|----|4|  CURSOR 2 OF 5 ACTIVE |
+----------------------------------------------+---------------------------+
| NOW                                          | PROOF                     |
| task-006                                     | FRESH / FAIL / UNKNOWN    |
| Expected behavior takes the largest measure. +---------------------------+
|                                              | DRIFT                     |
| EXACT TEST                                   | NONE / BLOCKER            |
| node --test ...                              |                           |
+----------------------------------------------+---------------------------+
| NEXT  START_TASK:task-007 / SYNC_GOVERNING_DOCUMENTS / PROJECT_COMPLETE  |
+--------------------------------------------------------------------------+
| RECENT                                                                   |
| task-004  behavior summary...............................................|
| task-005  behavior summary...............................................|
+--------------------------------------------------------------------------+
| Cooperative local guardrail. This view cannot authorize work...          |
+--------------------------------------------------------------------------+
```

## Narrow wireframe

Target acceptance viewport: 390 by 844 CSS pixels at device scale factor 1.

```text
+--------------------------------------+
| [PLUSH] OH NO, CODEX!       [REFRESH]|
| Goal wraps here.  LOCAL / READ ONLY  |
+--------------------------------------+
| CALIBRATION SPINE     CURSOR 2 OF 4  |
+---+----------------------------------+
| 0 | NOW                              |
|   | task-006                         |
|>2 | Expected behavior wraps.         |
|   | EXACT TEST                       |
|   | node --test long-command...      |
+---+----------------------------------+
|   | PROOF        FRESH               |
+---+----------------------------------+
|   | DRIFT        NONE                |
+---+----------------------------------+
|   | NEXT                             |
|   | START_TASK:task-007              |
+---+----------------------------------+
| 4 | RECENT                           |
|   | task-005  behavior summary...    |
+---+----------------------------------+
| Cooperative local guardrail...       |
+--------------------------------------+
```

At widths below 720 px:

- the masthead becomes a two-row grid, not a hidden mobile menu;
- the rail becomes a 24 px vertical spine; it labels start, current, and end
  while the literal cursor count stays above it;
- NOW, PROOF, DRIFT, NEXT, and RECENT stack in that exact order;
- gutters are 16 px and instrument padding is 16 px;
- code and identifiers wrap inside their instrument;
- no fixed-width element exceeds the viewport;
- the footer remains ordinary flow content.

Between 720 and 1119 px the NOW to signal split is 5/3 columns. At 1120 px and
above it is 8/4 within the 12-column frame.

## State model

Every state uses the same anatomy. Only hierarchy, signal plate, rail geometry,
and canonical text change.

| Fixture | NOW | PROOF | DRIFT | NEXT | Signal treatment |
| --- | --- | --- | --- | --- | --- |
| Loading first read | `READING LOCAL STATE` | `NONE` | `NONE` | `NONE` | Static three-tick hatch, polite live region |
| No reviewed plan | `NO ACTIVE TASK` | `NONE` | `NONE` | `PROPOSE_PLAN` | Open rail, larger Hero aperture allowed |
| Frozen cursor ready | `NO ACTIVE TASK` | `NONE` | `NONE` | `START_TASK:<id>` | Amber jaw at cursor |
| Active | Current id, behavior, test | `NONE` | `NONE` | `NONE` | Amber jaw and 4 px amber NOW edge |
| Failed | Current task remains | `FAIL` | `EXACT_TEST_FAILED` | `NONE` | Red stop gate and literal FAIL |
| Unknown | Current task remains | `UNKNOWN` | `VERIFICATION_UNKNOWN` | `NONE` | Ink hatch and literal UNKNOWN |
| Blocked doc sync | `BLOCKED_DOC_SYNC` | Current proof or `NONE` | `DOCUMENT_SYNC_PENDING` | `SYNC_GOVERNING_DOCUMENTS` | Red stop shutter; DRIFT gains the 4 px state edge without DOM reordering |
| Stale PASS | No writable claim | `STALE` | `STALE_PASS` | `NONE` | Split red jaw and literal STALE |
| Fresh PASS | `NO ACTIVE TASK`; completed data stays in RECENT | `FRESH` | `NONE` | Derived next or `PROJECT_COMPLETE` | Mint lock plate |
| Project complete | `NO ACTIVE TASK` | `FRESH` if present | `NONE` | `PROJECT_COMPLETE` | Closed rail, mint lock plate |
| Missing/corrupt state | `UNAVAILABLE` | `UNAVAILABLE` | `STATE_UNAVAILABLE` | `NONE` | Full-width alert, no prior canonical values |
| Endpoint disconnected | `UNAVAILABLE` | `UNAVAILABLE` | `STATE_UNAVAILABLE` | `NONE` | Same fail-closed alert; refresh remains available |

Loading uses no shimmer. Empty states contain no invented task, history, or
metric. Endpoint recovery replaces the unavailable projection in place.

## Refresh and update behavior

- The initial HTML shell renders immediately, then fetches the canonical JSON.
- While the page is visible, at most one no-store request is in flight.
- The implementation target is a 100 to 125 ms refresh cadence so Task 7 can
  test saved-state visibility below the 250 ms p95 budget.
- Background tabs pause the cadence. Visibility or focus triggers one immediate
  refresh.
- `REFRESH` performs the same GET immediately. It never writes product state.
- A successful changed response replaces all canonical fields in one render
  transaction.
- An unsuccessful response clears canonical fields and renders UNAVAILABLE.
- Focus stays on its current control during refresh. No update steals focus or
  scroll position.
- One polite live-region sentence announces meaningful changes, for example
  `Proof changed to FRESH. Next is START_TASK:task-007.`

## Component briefs

### `CockpitFrame`

- Purpose: semantic page shell and canonical render boundary.
- Data: the complete read model or UNAVAILABLE.
- Elements: skip link, `header`, `main`, `footer`, one polite live region.
- Responsive: owns container, gutters, and stacked narrow order.
- Accessibility: exactly one `h1`; loading uses `aria-busy="true"` on `main`.

### `BrandMasthead`

- Purpose: identify product, project goal, locality, and refresh control.
- Data: `goal`, `availability`, request-in-flight presentation state.
- Refresh states: default `REFRESH`, busy `READING` on the same focusable native
  button, error returns to `REFRESH`. Busy uses `aria-disabled="true"` and an
  in-flight guard, never the HTML `disabled` attribute.
- Accessibility: button name is `Refresh local project state`; no icon-only
  control; busy state exposes `aria-disabled` and adjacent live status.

### `CalibrationRail`

- Purpose: show exact plan position and the dominant stop/proof state.
- Data: `plan_revision`, `cursor`, `task_count`, `status`,
  `proof_freshness`, `blocker`.
- Variants: no-plan, ready, active, blocked, stale, fresh, complete,
  unavailable.
- Responsive: horizontal desktop rail becomes the 24 px narrow spine without
  changing its accessible summary.
- Accessibility: one textual summary; tick geometry is `aria-hidden`.
- Edge cases: zero tasks, 120 tasks, long revision, cursor at end. More than
  12 tasks uses evenly spaced minor ticks with only start/current/end labels.

### `NowInstrument`

- Purpose: answer what Codex is doing now.
- Data: `status`, `current_task`.
- Active anatomy: id, expected behavior, exact test.
- Empty anatomy: literal status and no invented task. NEXT alone owns the
  plan-derived action.
- Edge cases: maximum bounded goal, id, behavior, and 1024-byte command wrap
  without clipping.
- Accessibility: `section` labelled by `h2`; exact command uses `code`.

### `SignalStack`

- Purpose: render PROOF and DRIFT without conflating them.
- Data: `proof_freshness`, `blocker`.
- Geometry: two ruled rows, not cards; blocked DRIFT gains stronger border and
  label weight but stays after PROOF in DOM and visual order.
- Accessibility: state word is visible text; pattern and border shape provide
  a non-color cue.

### `NextGate`

- Purpose: show exactly one canonical next action.
- Data: `next_action`.
- Behavior: display only. It is never a button or link.
- Edge cases: long stable task id wraps after the action delimiter without
  truncating the accessible text.
- Accessibility: `section` with heading `NEXT`; changes join the polite live
  announcement.

### `RecentLedger`

- Purpose: show bounded completed summaries.
- Data: `completed_count`, `completed`.
- Empty: literal `NO COMPLETED TASKS`.
- Rows: id plus expected behavior separated by a rule; no row card.
- Accessibility: semantic list with completed total in its label.

### `UnavailableGate`

- Purpose: fail closed when state or endpoint is unavailable.
- Data: no cached canonical data.
- Copy: `LOCAL STATE UNAVAILABLE` followed by `The local state is missing,
  corrupt, or unsupported. Repair .ohno/state.json, then refresh.`
- Accessibility: `role="alert"` only when entering the state; repeated failed
  polls do not repeat the announcement.

## Keyboard and focus contract

The page has no custom keyboard widget and no roving tabindex.

1. Ordinary forward `Tab` exposes `Skip to current state`, then `REFRESH`.
2. `Enter` on the skip link moves focus to the NOW heading using
   `tabindex="-1"` only for that programmatic destination.
3. After a skip, forward `Tab` continues after `main`; it does not jump
   backward to REFRESH. `Shift+Tab` from the NOW destination returns to
   REFRESH according to DOM order.
4. `Enter` or `Space` activates REFRESH when no request is in flight.
5. Busy REFRESH stays focused and ignores duplicate activation.
6. No positive `tabindex` is permitted.

Every focus target displays the locked two-color ring and remains completely
visible at 200% zoom. There is no keyboard trap and no hover-only content.

## Accessibility contract

- Semantic landmarks are `header`, `main`, and `footer`; instruments are
  labelled `section` elements.
- The heading order is one `h1`, then instrument `h2` headings with no skipped
  level.
- Meaningful image use has alt text; the persistent masthead crop is
  decorative.
- Status is always text plus geometry plus color.
- All listed contrast pairs meet WCAG 2.2 AA.
- Body text remains at least 16 px. Utility labels never carry explanatory
  prose.
- The page works at 200% zoom and at 320 CSS px without two-dimensional
  scrolling.
- Touch and pointer targets are at least 48 by 48 px.
- `prefers-reduced-motion` removes all transition and transform effects.
- `forced-colors: active` uses system colors, preserves 2 px boundaries, and
  exposes every state word.
- Live announcements are polite except the first transition into UNAVAILABLE,
  which is an alert.

## Read-only HTTP boundary for Task 6B

This freezes UI behavior, not a new authority:

- `GET /` returns the Cockpit shell.
- `GET /api/state` returns the exact canonical read model.
- static Cockpit and font assets are GET-only.
- `HEAD` may mirror GET metadata.
- every `POST`, `PUT`, `PATCH`, and `DELETE` returns 405 with no state change.
- responses use no-store caching for state.
- the server binds to loopback and prints its exact URL.
- server shutdown closes the listener cleanly.

The Cockpit does not run tests, scan Truth inventory, modify Git, accept a
plan, start a task, verify a task, or invoke hooks.

## Task 6C screenshot and browser acceptance contract

Screenshots must come from the built product and disposable project fixtures,
not a mock or design-only HTML file.

Required display captures:

| Fixture | Desktop 1440x1024 | Narrow 390x844 |
| --- | --- | --- |
| No-plan idle | `assets/cockpit/evidence/desktop-idle.png` | `assets/cockpit/evidence/narrow-idle.png` |
| Active | `assets/cockpit/evidence/desktop-active.png` | `assets/cockpit/evidence/narrow-active.png` |
| Failed | `assets/cockpit/evidence/desktop-failed.png` | `assets/cockpit/evidence/narrow-failed.png` |
| Blocked | `assets/cockpit/evidence/desktop-blocked.png` | `assets/cockpit/evidence/narrow-blocked.png` |
| Stale | `assets/cockpit/evidence/desktop-stale.png` | `assets/cockpit/evidence/narrow-stale.png` |
| Fresh PASS | `assets/cockpit/evidence/desktop-fresh.png` | `assets/cockpit/evidence/narrow-fresh.png` |

Every capture waits for local fonts, the canonical state response, and any
allowed one-shot transition to settle. `desktop-active.png` visibly focuses
REFRESH; `narrow-idle.png` visibly focuses the skip link. Each fixture records
the literal task, proof, blocker, and next values beside its matching
`status --json` assertion; the screenshot does not replace that assertion.
The idle fixture is exact: `status=IDLE`, `plan_revision=null`,
`current_task=null`, `proof_freshness=NONE`, `blocker=NONE`, and
`next_action=PROPOSE_PLAN`.

Task 6C must additionally verify:

- canonical equality with `ohno status --json` for goal, task, proof, blocker,
  cursor, and next action;
- no viewport overflow at 320, 390, 768, and 1440 CSS px;
- skip-link and REFRESH keyboard order, activation, retained focus, and
  visible ring;
- text and UI contrast using computed colors, plus a forced-colors smoke;
- reduced motion has zero transforms and zero transition duration;
- active, blocked, fresh, failed, stale, unknown, no-plan, and unavailable
  state treatments;
- P06 timing begins when the atomic state save completes and ends when current
  task, proof, blocker, and next all reflect the new read model in the DOM;
- after one warm-up, Task 7 records at least 30 P06 samples on each of three
  disposable real-project copies and requires p95 below 250 ms on every copy;
- no request method can mutate project state;
- no local storage, service worker, remote asset, console error, or uncaught
  page error.

Visual acceptance fails if the page resembles a generic card dashboard, the
Hero is missing or distorted, the rail loses its data meaning, state is shown
by color alone, canonical text is truncated, or narrow layout overflows.

## Design pre-flight result

Identity lock:

- [x] One palette, one type superfamily, one radius scale, no off-system value.
- [x] One amber accent; red, mint, and blue are reserved semantic signals.
- [x] Every state preserves the same instrument language.
- [x] The Calibration Rail and plush aperture are brief-specific signatures.

Anti-slop:

- [x] Zero banned reflex fonts or generic purple/blue effects.
- [x] Zero three-card rows, nested cards, centered dark hero, or glass panels.
- [x] Zero buzzwords, fake names, fake metrics, or decorative motion.
- [x] Counterfactual and first-/second-order slop tests pass.

State and accessibility:

- [x] Loading, empty, active, fail, unknown, blocked, stale, fresh, complete,
  unavailable, and disconnected states are specified.
- [x] Contrast, keyboard, focus, screen-reader announcements, forced colors,
  reduced motion, touch target, zoom, and narrow overflow are specified.
- [x] Refresh, visibility change, endpoint failure, and recovery are covered.

Layout and load:

- [x] Masthead split, measurement rail, asymmetric instrument frame, and ruled
  ledger provide four layout families.
- [x] One focal NOW instrument and one REFRESH control keep choices below four.
- [x] No instrument nests inside another.

Scored self-critique:

| Axis | Score / 4 |
| --- | ---: |
| Distinctiveness | 4 |
| Hierarchy and focus | 4 |
| Locked consistency | 4 |
| Accessibility | 4 |
| State and edge coverage | 4 |
| Copy quality | 3 |
| Restraint | 3 |
| Motion motivation | 3 |
| **Total** | **29 / 32** |

Pre-flight revision: a proposed copy-test control was removed because it
created a competing action and clipboard edge cases. Three floating status
cards were replaced by one ruled instrument frame so the NOW hierarchy and
calibration signature remain unmistakable.

## Task 6B build handoff

Target: the Codex implementation controller using the required
`frontend-design` skill and the repository's vanilla TypeScript/CSS boundary.

> Implement exactly this spec. Use native semantic HTML and WAI-ARIA patterns
> with the locked tokens. Do not redesign it, introduce a framework, or create
> a second state source.

Task 6B acceptance is functional A13 only. It must not call the Cockpit
visually accepted until Task 6C produces the named real-browser evidence.
