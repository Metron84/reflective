# Ultima — Master Specification v4

### The Reflective Football · August 2026 · Games · Play

**Brand reference:** TRF Brand Guidelines v1.0 (July 2026)
**Data reference:** Sportmonks Football API, introduced at Phase F
**Repo path:** `docs/TRF_Ultima_Master_Spec.md`
**Supersedes:** v1, v2, v3, v3.1 (Aug 2026). v1 in the repo is to be replaced by this file, not appended to.

---

## 0. North star

**Ultima is a fan-first, invite-only fantasy league inside thereflectivefootball.com** — one competition, one commissioner, live snake draft, weekly lineups across **Premier League, LaLiga, and Serie A**. It should feel like a **matchday programme that comes alive on Saturday**: cream editorial pages, navy draft and live moments, one signal-red accent per screen.

**Not** a marketplace of leagues, not an FPL-clone aesthetic, not betting-adjacent UI.

### 0.1 What changed in v4

- Full **route map, hub layout and no-dead-ends funnel** restored.
- **Site and repo integration** specified: games manifest, door copy, auth redirect, sitemap, loading shells.
- **Stack contract** written: SSE event types, job schedule, role storage, rate limits, error shape.
- **Draft lifecycle states** and **bot seating rules** named.
- **Profile, invite, standings, draft feed and trade UI** specified.
- **Mock provider contract** and a **filled worked example** added as appendices.
- **Postponed fixture rule corrected**: a fixture scores in the gameweek it is actually played, not the one it was scheduled in.
- **Security and compliance** pulled into one section.

---

## 1. Product definition

### 1.1 Name and placement

| Field | Value |
|-------|--------|
| Product name | **Ultima** |
| Parent | The Reflective Football |
| Surface | **Play** (Watch · Vote · **Play**) |
| Games door eyebrow | Games. For the Fun. |
| Route | `/ultima` |
| Auth | Supabase account required for participation |

### 1.2 Core model

- One competition, one commissioner, invite-only, maximum **10 seats**.
- Live snake draft, 25 rounds, 250 picks.
- Squad of **25**, positionless, drafted across three leagues.
- Weekly **starting XI of 11** scores; the 14 bench players do not.
- Free agency add and drop all season; trades from gameweek 4.
- Empty seats filled by **bot personas**, no AI inference, no API cost.

### 1.3 Non-goals (v1)

- Public league creation, auction draft, more than three leagues.
- Cash prizes, entry fees, betting odds.
- Native mobile app, push notifications.
- Client-side provider calls.
- Positions, formations, captains, chips.
- Waiver bidding, budgets, keeper rules.
- Languages other than English.

---

## 2. Brand and design system

### 2.1 Colour

| Token | Hex | Use |
|-------|-----|-----|
| Paper Cream | `#F2EDE4` | Landing, rules, standings, squad, market, trades |
| Deep Navy | `#0A111F` | Draft room, live strips, locked slots |
| Signal Red | `#D8232A` | One live signal per screen |

- **Red discipline:** one hero action per view. Destructive confirmation is the only other permitted red, never on the same screen state as a red primary.
- **Ground:** subtle cream grain or paper texture, never flat sterile white. Navy blocks carry no texture.

### 2.2 Typography

| Role | Face | Use |
|------|------|------|
| Display | Bodoni Moda | "Ultima", gameweek headlines, commissioner notes |
| UI / body | Archivo | Roster, stats, tabs, rules, timers, all buttons (400 to 800) |
| Impact numbers | Bebas Neue | Live points ticker on matchday only |

Eyebrows: Archivo, letter-spaced caps (`GAMES · ULTIMA`, `GAMEWEEK 12`).

### 2.3 Crest usage

- TRF crest whole, on cream or navy only, per the brand PDF.
- Minimum 120px on web; clear space at least the rope width on all sides.
- No recolour, stretch, drop shadow, outline or effect. Never rebuilt from parts, never cropped.
- Ultima wordmark is Bodoni Moda. There is **no separate Ultima crest** unless Melo makes one.

### 2.4 Screen rhythm

| Screen | Ground | Single red signal |
|--------|--------|-------------------|
| `/ultima` hub | Cream | Redeem invite, or Enter draft when live |
| Join, profile | Cream | Primary continue |
| Draft room | Navy | On-the-clock progress line |
| Squad, default | Cream | Save XI |
| Squad, live | Cream with navy live strip | Live points pulse |
| Market | Cream | Add |
| Trades | Cream | Send proposal |
| Standings | Cream | None |
| Rules, log | Cream | None |
| Admin | Cream | Destructive and lock actions only |

### 2.5 Design language

- Cream-first editorial pages, footage-led navy blocks for draft and live.
- Quiet chrome: hairline icons, forward arrows, thin borders.
- Motion restrained: skeleton opacity pulse only, no slot-machine draft UI.
- **Loading shells:** an Ultima `loading.js` per route folder, matching the site-wide RouteSkeleton pattern already used for `/films`, `/games`, `/codemaster` and `/reflections`.

---

## 3. Voice and copy

- Honest, warm, fan-first. Short, clear, direct. **No em-dashes.**
- No disparaging copy in errors or player context.
- Avoid "ultimate experience", "crushing it", and all betting language.
- Mark **Provisional** while a gameweek is live.

**Sample lines**

- Landing: "Draft across the Premier League, LaLiga, and Serie A. 25 players. Invite only."
- Draft counter: "Four from every league. Two LaLiga to go."
- Forced pick: "LaLiga only. You need two more and you have two picks left."
- Lock notice: "LaLiga is live. Your LaLiga slots are set."
- Market: "Free agent. Add him and someone has to go."
- Bolt: "Bolt. Round 21 pick, eight points, plus two."
- Trade verdict: "Even trade. Both sides project within nine percent."
- Drop: "Drop him and he goes back to the market. Anyone can take him."
- No gameweek: "No gameweek this week. The leagues are on a break."

---

## 4. User roles

| Role | Capabilities |
|------|----------------|
| **Visitor** | Read landing and rules; cannot join without an invite |
| **Manager** | Draft, set weekly XI, add and drop, propose and vote on trades, view all squads |
| **Commissioner** | Everything a manager does, plus invites, draft control, pool flags, corrections, season config |
| **Backup commissioner** | One named manager who can **start, pause and resume the draft only**, for the case where Melo is filming. No corrections, no invites, no pool flags |
| **Bot** | Server-run manager occupying an unfilled seat |

**Commissioner is also a manager.** Every commissioner and backup action writes a public row at `/ultima/log`. The commissioner cannot undo their own pick, cannot veto a trade unilaterally, and every score correction carries a typed reason shown to the league.

---

## 5. Information architecture

### 5.1 Routes

| Route | Purpose | Auth | Indexed |
|-------|---------|------|---------|
| `/ultima` | Hub, rules summary, invite CTA | Public | Yes |
| `/ultima/rules` | Canonical scoring and floors | Public | Yes |
| `/ultima/join/[code]` | Invite redemption | Sign-in required | No |
| `/ultima/profile` | Team identity | Manager | No |
| `/ultima/draft` | Live draft room | Manager, profile complete | No |
| `/ultima/squad` | XI and Squad tabs | Manager | No |
| `/ultima/market` | Free agency | Manager | No |
| `/ultima/trades` | Trade list and builder | Manager, gameweek 4 onward | No |
| `/ultima/trades/[id]` | Single trade, verdict, review | Manager | No |
| `/ultima/standings` | League table, Bolt board, bot risk numbers | Manager, public TBD | TBD |
| `/ultima/log` | Public commissioner audit log | Manager | No |
| `/ultima/admin` | Commissioner tools | Commissioner only | No |

**Auth redirect:** any manager route hit while signed out redirects to `/signin?next=<route>`, matching the existing site pattern.

### 5.2 Hub layout

Doors pattern, stacked rows plus arrow, matching the homepage and Games doors.

```
Ultima
  Draft room        →   status line
  My squad          →   status line
  Market            →   status line
  Trades            →   status line
  Standings         →   status line
  Rules             →   status line
```

Status lines are live, not decorative.

| Row | Example status |
|-----|----------------|
| Draft room | "Opens 14 August, 20:00" · "Live. You are on the clock." · "Complete" |
| My squad | "Set your XI. LaLiga locks Friday 21:00." |
| Market | "37 free agents." |
| Trades | "One proposal waiting." · "Trades open at gameweek 4." |
| Standings | "You are 4th. 212 points." |
| Rules | "Scoring, floors and locks." |

### 5.3 No dead ends

| After… | Next |
|--------|------|
| Invite redeemed | Profile, then draft lobby |
| Profile saved | Draft lobby, or hub if the draft is not open |
| Draft pick made | Back to the board, queue surfaced |
| Draft complete | Squad, plus "Set your XI before [kickoff]" |
| XI saved | Market, or Standings |
| Add or drop | Squad |
| Trade sent | Trades list, plus Squad |
| Gameweek final | Standings, plus Watch Films and Play Codemaster |
| No invite | "Ask the commissioner", plus Films and Games |
| No gameweek this week | Films and Codemaster |

---

## 6. Site and repo integration

### 6.1 Repo actions

| Item | Action |
|------|--------|
| `docs/TRF_Ultima_Master_Spec.md` | Replace v1 content with this v4 file |
| Superseded versions | Note in section 20; do not keep v1 to v3.1 in the repo |
| `CLAUDE.md` or build brief | Point at v4 as the single source of truth before Phase A starts |
| `content/games.json` | Replace the `ultimate-fantasy-manager` entry |
| Homepage door status | Replace the six-league, ten-player hook |

### 6.2 Games manifest

| Field | Value |
|-------|--------|
| `slug` | `ultima` |
| `title` | `Ultima` |
| `hook` | `Draft PL, LaLiga, and Serie A. 25 players. Invite only.` |
| `href` | `/ultima` |
| `statusLabel` | `Coming for the 26/27 season` |

### 6.3 Homepage and chrome

- Games door status line: `Ultima. Draft PL, LaLiga, Serie A. Invite only.`
- `/ultima` and `/ultima/rules` enter the sitemap and carry canonical tags when the landing page goes public. Every other route is `noindex`.
- Ultima is added behind an `ULTIMA_ENABLED` flag in `lib/config.js`, matching the pattern used to park The Stand and gate the LaLiga campaign.

---

## 7. Season, gameweeks and locking

### 7.1 Gameweek definition

- A gameweek is a calendar window, **Friday 00:00 to Thursday 23:59 Gulf Standard Time**.
- A window becomes a numbered gameweek **only if it contains fixtures**.
- International breaks and empty windows are **skipped and never numbered**, so the schedule reads GW11, GW12, GW13 with no gaps.
- Gameweek rows are created by a weekly job from the fixture table, not by hand.

### 7.2 Matchday locking

Each league opens its matchday at its **first kickoff inside the window**. Locking follows the player, not the clock.

- A lineup slot **locks when the league of the player in it opens its matchday**.
- An empty slot **stays editable**, but can only be filled from leagues that have not yet opened.
- Once all three leagues have opened, the XI is fully locked for the window.
- A locked player cannot be dropped or traded until the window closes.

**Worked example.** LaLiga opens Friday 21:00, Premier League Saturday 12:30, Serie A Saturday 18:00. LaLiga slots freeze Friday night. Premier League slots stay live until Saturday lunchtime. Serie A slots are still editable Saturday afternoon.

### 7.3 Auto-start

Fires **per league, at that league's opening kickoff**.

- Any unfilled slot the 3-per-league floor requires from the opening league is filled automatically.
- Fill order: the player who held that slot last gameweek, then the highest points-per-game eligible bench player.
- An inactive, injured or departed player is skipped.
- Auto-started slots are flagged to the manager and in the log.

### 7.4 Roster and floors

| Rule | Value |
|------|-------|
| Squad size | 25, fixed |
| Starting XI | 11, scores |
| Bench | 14, does not score |
| Positions | None |
| Squad league floor | Minimum 4 from each league |
| XI league floor | Minimum 3 from each league, 2 free slots |
| Club cap | None |
| One slot per player | A player occupies exactly one XI slot, even with two fixtures in the window |

**Floor relaxation.** When a squad player is flagged departed or long-term inactive, the affected floor relaxes by one for that manager until they sign a replacement. Logged and visible.

---

## 8. Scoring

### 8.1 Points table

| Event | Rule | Points |
|-------|------|--------|
| Goal | Each goal scored | 3 |
| Assist | Each assist | 1 |
| Match rating | 7.0 to 7.4 inclusive | 1 |
| Match rating | 7.5 and above | 2 |
| **Bolt bonus** | See 8.2 | +2 |

Only the starting XI scores. A player with two fixtures in the window scores from both into the same slot.

### 8.2 Bolt bonus

- **Eligible:** anyone drafted **round 16 or later**, and anyone signed from free agency **who went undrafted**.
- **Award:** **+2** in any gameweek where that player returns **6 or more base points** while starting.
- Eligibility is fixed at draft time and never changes, so a round-1 player dropped and re-signed never carries it.
- Bolt shows as a distinct line on the scorecard, never folded silently into the total.
- **Bolt of the Season** goes to the highest bonus total and the manager who found him.

### 8.3 Edge cases

| Case | Rule |
|------|------|
| No rating returned | 0 rating points; goals and assists still count |
| Two fixtures in one window | Both score into the one slot, ratings banded per fixture |
| **Postponed or abandoned** | The fixture scores in the gameweek it is **actually played**, using the lineup in force that week. Its `gameweek` field is reassigned by the fixture sync job |
| Provider correction after FT | Recompute from stored events, adjustment shown in the audit |
| Own goals, cards, penalties | No points v1 |
| Captain multiplier | None v1 |
| Tiebreaker | Total points, then goals, then assists, then reverse draft slot |

**Why the postponement rule changed from v3.1:** assigning a rescheduled fixture back to its original gameweek would rewrite a table that was marked Final weeks earlier, against lineups nobody could still edit. Scoring it where it is played keeps every gameweek settled once it closes.

### 8.4 Score states

- **Provisional:** any fixture in the window is not final.
- **Final:** all fixtures final and the correction window closed, 24 hours after the last full-time.

### 8.5 Rating comparability

**Study, before Phase A exits.** Sample 30 finished matches per league, record every rating, compute the mean and the share of ratings landing in each band.

**Output.** If the share landing in a band differs by more than 5 percentage points between leagues, thresholds are calibrated per league, not the points values. Calibration uses the band share of the median league as the target:

```
threshold_L_band1 = the rating value at which league L reaches
                    the same cumulative share as the median league at 7.0
threshold_L_band2 = the same, measured at 7.5
```

- Thresholds are stored in `ultima_competition.rating_thresholds` as a per-league pair, never hard-coded.
- **Melo signs off** the calibration before Phase A closes.
- Managers see the calibrated numbers on `/ultima/rules` with one line of explanation, because a hidden adjustment to two of four scoring events would be indefensible when someone loses by a point.

---

## 9. Draft

### 9.1 Lifecycle

```
lobby → live → (paused) → complete | cancelled
```

| State | Meaning |
|-------|---------|
| `lobby` | Invites open, seats filling, order not yet set. Commissioner can still invite |
| `live` | Seats frozen, bots seated, order set, clock running |
| `paused` | Commissioner or backup paused; clock frozen; board read-only |
| `complete` | 250 picks made; squads written; market opens |
| `cancelled` | Commissioner cancelled with a typed confirmation; all picks discarded and logged |

- The draft **can run across sessions**. Pausing overnight is supported and the clock resumes exactly where it stopped.
- On the 5-minute and 24-hour timer options the draft is expected to be multi-session, and the hub status line carries the resume time.

### 9.2 Seating and the human-bot mix

- Invites can be issued to a maximum of **10 humans**; the eleventh redemption is rejected.
- **Bots are seated at the moment the draft moves to `live`**, one per unfilled seat, never earlier. A late human cannot displace a seated bot.
- A league can run with any human count from 1 upward. Two humans and eight bots is a valid league.
- **Draft order is randomised across all ten seats**, humans and bots together, unless the commissioner sets it.
- Bots appear on standings, the draft board and the feed by **persona name with a BOT tag**, never as "Manager 3".
- Persona assignment is random from the nine, without repeats, unless the commissioner picks.

### 9.3 Timer

| Option | 250 picks |
|--------|-----------|
| 30 seconds | about 2 hours 5 minutes |
| 60 seconds | about 4 hours 10 minutes |
| 90 seconds | about 6 hours 15 minutes |
| 2 minutes | about 8 hours 20 minutes |
| 5 minutes | multi-session |
| 24 hours (async) | multi-day |

- On expiry: auto-pick from queue, then best available by ranking, then forced by league deficit.
- Server-authoritative clock. Reconnect restores board, queue and clock.
- Bots pick instantly, so a bot-heavy league drafts far faster than the table suggests.

### 9.4 League floor counter and forced pick

- Visible to **every manager**, not only the one on the clock.
- Per manager per league: `deficit = max(0, 4 − count)`.
- A pick is rejected if, after it, `sum(deficits) > remaining slots`.
- The guard uses `min(remaining slots, draftable players remaining in that league)`.
- States: **Open**, **Warning** at deficit equals remaining slots minus two, **Forced** at deficit equals remaining slots.
- In Forced state the board filters to deficit leagues and the header states why.
- Reminders at rounds 15 and 20 for any manager carrying a deficit.
- Display: `PL 9 · LaLiga 2 (need 2) · Serie A 1 (need 3) · 4 picks left`.

### 9.5 Draft room UX

- Navy full-bleed room, league tabs PL | LaLiga | Serie A.
- Signal red only on the thin progress line under the on-the-clock name.
- Player row: name, club, league, availability flag, Bolt-eligible marker from round 16.
- Queue: ordered, reorderable, persists across reconnects.

### 9.6 Draft feed

- A **tab on mobile, a right rail on desktop**, never a floating overlay.
- Shows **every pick**, human and bot, newest first: round, pick number, manager, player, club, league.
- Bot picks carry their templated rationale line. Human picks carry no commentary.
- Forced picks are marked "Forced. LaLiga minimum."
- The feed **persists after the draft** at `/ultima/draft`, which becomes a read-only draft history once the state is `complete`. This is the archive Melo cuts footage against.

---

## 10. Bot managers

### 10.1 How a persona works

No AI inference, no API cost. A persona is a set of numbers in a config file.

- Every available player carries observable values: goals rate, assists rate, rating average, rating consistency, minutes reliability, club strength, fixtures in the next window, league, draft round.
- A persona holds a weight against each value plus four behaviour traits.
- On its turn the bot scores the entire available pool, applies the floor guard, adds a seeded wobble, and takes the top name.

### 10.2 The three axes

| Axis | 0 | 1 |
|------|---|---|
| **Risk** | Only proven, heavily-played names | Reaches deep for unproven players |
| **Horizon** | Chases last week's form | Season averages and fixture load |
| **Discipline** | Ignores the league floor until forced | Fills the floor on schedule |

**Wobble** is the chance per pick that the bot ignores its own logic. It rises as discipline falls, and it is what stops a human solving a bot over 25 rounds.

### 10.3 The nine personas

| Bot | Risk | Horizon | Discipline | Behaviour |
|-----|------|---------|-----------|-----------|
| The Accountant | 0.1 | 0.9 | 0.9 | Proven minutes only, never panics, quietly third |
| The Banker | 0.2 | 0.8 | 0.5 | Famous names and big clubs, ages badly |
| The Analyst | 0.3 | 1.0 | 1.0 | Best drafter in the league, worst at reacting |
| The Pragmatist | 0.4 | 0.6 | 0.7 | Takes the obvious pick, fills the floor on schedule |
| The Streaker | 0.5 | 0.1 | 0.4 | Chases whoever scored last week, always |
| The Contrarian | 0.6 | 0.5 | 0.6 | Fades whatever the room just took |
| The Scout | 0.8 | 0.7 | 0.8 | Empty first ten rounds, dangerous by March |
| The Gambler | 0.9 | 0.2 | 0.3 | Unproven names, top or bottom, no middle |
| The Panicker | 0.7 | 0.3 | 0.1 | Forced into LaLiga in round 24, every time |

### 10.4 Config shape

```
{
  "id": "the_gambler",
  "name": "The Gambler",
  "risk": 0.9,
  "horizon": 0.2,
  "discipline": 0.3,
  "wobble": 0.18,
  "weights": {
    "goals_rate": 1.0,
    "assists_rate": 0.4,
    "rating_avg": 0.2,
    "rating_consistency": -0.3,
    "minutes_reliability": 0.1,
    "club_strength": 0.1,
    "fixtures_next": 0.3,
    "draft_round": 0.6
  },
  "rationale_lines": [
    "Nobody has heard of him yet.",
    "This is the one.",
    "Boring is worse than wrong."
  ]
}
```

Config lives at `data/ultima/personas.json`.

### 10.5 Scope and visibility

- **Phase H:** draft picks and weekly XI selection, respecting every floor and lock a human faces.
- **Later:** free agency claims. Bots stay out of the trade machine, because a weighted bot cannot argue.
- All bot actions run server-side, are logged, and carry no information a human does not have.
- **Every squad, XI and live score is public to every manager**, human or bot.
- Each bot's **risk number is published on the standings page** before the draft opens.

---

## 11. Free agency market

- Every **undrafted player** is a free agent once the draft state is `complete`.
- Squad stays at 25, so **every add requires a drop** in the same transaction.
- Claims are **first come, first served** v1. No bidding, no budget, no waiver period.
- A dropped player returns to the market immediately.
- A player whose league has opened cannot enter the current XI; a player in a locked slot cannot be dropped until the window closes.
- Bolt eligibility travels with the player.
- Market screen: cream, filter by league, sort by points per game, next fixture, Bolt eligibility.

---

## 12. Trade machine

Trades open at **gameweek 4**, because the fairness engine needs three gameweeks of played data.

### 12.1 Rules

- Manager to manager, **equal player counts**, so both squads stay at 25.
- Both squads must satisfy the 4-per-league squad floor after the trade, unless already relaxed by an inactive flag.
- Players in a locked slot cannot be traded until the window closes.
- **Deadline:** the close of the third-from-last gameweek.
- Bots neither propose, accept nor vote.

### 12.2 Fairness validator

```
projected = points_per_game
          × fixtures_remaining_for_club
          × minutes_reliability
          + bolt_expectation
```

| Gap between sides | Verdict |
|-------------------|---------|
| Within 10% | Even trade |
| 10% to 25% | Slight edge to [manager] |
| Above 25% | Lopsided, favours [manager] |
| Fewer than 3 gameweeks on any player | Not enough data |

Advisory and public, never blocking.

### 12.3 Approval flow

1. Proposer builds the trade and sees the verdict before sending.
2. Receiver accepts or declines, seeing the same verdict.
3. On acceptance the trade enters a **24 hour league review**.
4. A **majority veto by the other human managers** cancels it.
5. If no veto, the trade executes. An hourly job resolves expired reviews.

The commissioner has no unilateral veto, because the commissioner is also a manager.

### 12.4 Trade builder on mobile (390px)

- Two stacked panels: **You give** above, **You get** below, each a list with an Add player row.
- Tapping Add opens a bottom sheet: your squad for the top panel, the chosen opponent's squad for the bottom.
- Opponent is chosen first, from a single select at the top, because every list below depends on it.
- **Sticky footer** carries the live verdict as you build: "Even trade. Within 4%." and the Send control.
- Counts must match; Send is disabled with the reason "Two for two. Add one more." when they do not.
- Floor violations surface inline under the offending panel, naming the league.
- Locked players render navy with a padlock and cannot be selected.
- No drag and drop, no horizontal scroll, one bottom sheet at a time.

---

## 13. Squad and XI on mobile (390px)

### 13.1 Structure

- Two tabs: **XI** and **Squad**.
- Sticky header carries the floor counter and Save: `PL 3/3 · LaLiga 2/3 · Serie A 3/3`.
- Save is disabled while invalid, with the reason in one line underneath: "One more from LaLiga."

### 13.2 XI tab

- Eleven slot rows grouped **Premier League ×3, LaLiga ×3, Serie A ×3, Free ×2**.
- Row: player name, club, three-letter league tag, points last gameweek, lock state.
- Tap a slot to open a **bottom sheet** of eligible bench players, filtered to that slot's requirement, sorted by points per game.
- Locked slots render navy with a hairline padlock and no tap target; the group header reads "LaLiga is live".
- One bottom sheet at a time. No drag and drop. No horizontal scroll. No stacked modals.

### 13.3 Squad tab

- Twenty-five rows sectioned by league, each section headed with the count against the floor.
- Row: name, club, season points, next fixture, status flag, Bolt marker.
- Overflow menu per row: Move to XI, Drop, Propose trade.

### 13.4 Live state

- A navy strip pins under the header during a live window: running total, Provisional flag, Bebas Neue number.
- The strip is the only place Bebas appears on this screen.

---

## 14. Profile, invites and standings

### 14.1 Profile

| Field | Rule |
|-------|------|
| Team name | Required, 3 to 24 characters, unique within the league, no URLs |
| Manager name | Pulled from the TRF account, editable once before the draft |
| Colour chip | One from a fixed palette of eight brand-safe tones, used on standings and the draft board |
| Crest or avatar | **Not in v1.** Text and colour only, which keeps moderation at zero |

Profile must be complete before a manager can enter the draft room.

### 14.2 Invites

| Field | Rule |
|-------|------|
| Format | 8 characters, uppercase alphanumeric, ambiguous characters removed |
| Issue | Commissioner generates one code per seat. No master code |
| Uses | **Single use** |
| Expiry | 14 days, or draft start, whichever comes first |
| Cap | Rejected once 10 seats are taken |
| After draft start | Rejected with "The draft has started. Ask the commissioner about next season." |
| Waitlist | None in v1 |

Bots fill whatever seats remain when the draft goes live, so an unclaimed invite simply becomes a bot.

### 14.3 Standings

- **Season table** by default: rank, colour chip, team name, manager or BOT tag, gameweek points, season points, Bolt points.
- **Gameweek picker** switches the table to any completed gameweek, with Provisional marked while live.
- **Bolt board** as a second block: top five bonus earners, the player, and the manager who found him.
- **Bot risk numbers** shown in a third block, one row per bot: persona name, risk, horizon, discipline, and its one-line behaviour description.
- **Tie resolution is shown, not hidden:** a tied rank displays the tiebreaker that separated them.
- **Season winner** takes a full-width cream block at the top once the final gameweek is Final, with the Bolt of the Season named underneath.

---

## 15. Controls and navigation

### 15.1 Control grammar

| Type | Appearance | Rule |
|------|-----------|------|
| **Primary** | Filled signal red, cream label, Archivo 600 | One per screen state, never two |
| **Secondary** | Hairline navy border, transparent fill | Any number, never competing with primary |
| **Quiet** | Text only, navy, underline on press | Back, skip, learn more |
| **Destructive** | Hairline red border, red label; filled red only inside a confirm sheet | Always behind a confirmation |
| **Disabled** | 40% opacity, no press state | Must carry a reason line, never disabled silently |

Minimum touch target 44 × 44px including icon-only controls. Every control has an `:active` press state. No icon-only control without an accessible label.

### 15.2 Navigation controls

| Control | Behaviour |
|---------|-----------|
| **Back (browser)** | Never traps. From a bottom sheet it closes the sheet, it does not leave the page |
| **Back (in-app)** | Returns to the Ultima hub, not browser history, so a deep link never dead-ends |
| **Forward** | Standard browser behaviour; no app state depends on it |
| **Close (X)** | Top right, 44px, discards nothing already saved |
| **Hub** | Crest tap returns to `/ultima` from any Ultima page |
| **Tabs** | Preserve scroll position per tab within a session |
| **Refresh** | Restores full state from the server, including draft clock and live scores |

### 15.3 Action controls by screen

| Screen | Primary | Secondary | Destructive | Quiet |
|--------|---------|-----------|-------------|-------|
| Hub | Enter draft / Set XI, by state | — | — | Films, Games |
| Landing | Redeem invite | Read the rules | — | Films, Games |
| Join | Join the league | — | — | Back |
| Profile | Save and continue | — | — | Back |
| Draft room | Draft [player] | Add to queue, Remove from queue | — | Back to hub |
| Draft queue | Save order | — | Clear queue | Close |
| Draft feed | — | Filter to my picks | — | Close |
| XI tab | Save XI | Reset to last saved | — | Back |
| Slot sheet | Select | — | Clear slot | Close |
| Squad tab | — | Move to XI, Propose trade | Drop | Back |
| Market | Add | Filter, Sort | — | Back |
| Add sheet | Confirm add | Choose a different player | Drop [name] | Cancel |
| Trade builder | Send proposal | Add player, Remove player | — | Cancel |
| Trade received | Accept | Decline | — | Close |
| Trade review | Veto | — | — | Close |
| Standings | — | Gameweek picker | — | Back |
| Log | — | Filter by action | — | Back |
| Admin | Save config | Pause draft, Flag player | Undo pick, Cancel draft, Override score | Back |

### 15.4 Confirmation rules

| Action | Treatment |
|--------|-----------|
| Save XI | Immediate, toast confirms, editable until lock |
| Add from market | Confirm sheet, because it forces a drop |
| Drop a player | Confirm sheet naming the player, warning he returns to the market |
| Send a trade | Confirm sheet showing the fairness verdict |
| Accept a trade | Confirm sheet, because it starts the 24 hour review |
| Veto a trade | Immediate, reversible until the window closes |
| Draft a player | **No confirmation.** The timer is the pressure; a dialog costs picks |
| Commissioner undo pick | Confirm sheet, typed reason, logged publicly |
| Cancel draft | Confirm sheet, typed league name required |
| Override a score | Confirm sheet, typed reason, logged publicly |

Confirm sheets carry exactly two controls: the destructive action and Cancel. Cancel sits left, always quiet, never red.

### 15.5 Undo

| Action | Undo window |
|--------|-------------|
| Save XI | Until the relevant league locks |
| Drop | None once confirmed; the player is public immediately |
| Trade veto | Until the review window closes |
| Draft pick | Commissioner only, audited, emergency use |
| Score override | Superseded by a further override, never silently reverted |

### 15.6 Required states

- **Default**, **pressed**, **disabled with reason**, **loading**, **success**, **error** on every control.
- Loading uses the skeleton opacity pulse, never a full-screen spinner.
- Success is a single-line toast, bottom, 3 seconds, dismissible, never blocking.
- Errors state what happened and what to do: "That pick did not land. Someone took him first. Pick again."

### 15.7 Empty and edge states

| State | Treatment |
|-------|-----------|
| No invite | "Ask the commissioner." Plus Films and Games |
| Draft not open | Countdown plus rules link |
| Draft paused | Navy banner, "Paused by the commissioner", resume time if set |
| Squad empty pre-draft | "Your squad fills on draft night." |
| Market empty for a filter | "No free agents in LaLiga right now." Clear filter control |
| No fixtures this window | "No gameweek this week. The leagues are on a break." |
| Connection lost mid-draft | Navy banner, "Reconnecting", clock keeps running server-side |
| Trades before GW4 | "Not enough data yet. Trades open at gameweek 4." |

### 15.8 Keyboard and assistive

- Every control reachable by tab, in visual order.
- Bottom sheets trap focus and return focus to the trigger on close.
- Escape closes a sheet, never the page.
- Live score updates announce politely, never interrupting.
- Colour is never the only signal: locked slots carry a padlock, Bolt carries a marker, deficits carry a number.

---

## 16. Technical architecture

### 16.1 Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js App Router, existing repo |
| API | Route handlers and server actions |
| DB | Supabase Postgres with RLS |
| Auth | Supabase Auth, reusing TRF accounts |
| Live updates | SSE |
| Jobs | Vercel cron |
| Provider | Adapter pattern, mock first |
| Feature flag | `ULTIMA_ENABLED` in `lib/config.js` |

### 16.2 SSE event types

Single stream per competition at `/api/ultima/stream`, filtered server-side by role.

| Event | Payload | When |
|-------|---------|------|
| `draft.tick` | pick_number, seconds_remaining | Every second while `live` |
| `draft.pick` | manager, player, round, pick_number, forced, rationale | On every pick |
| `draft.state` | state, paused_by, resume_at | On any lifecycle change |
| `draft.queue` | manager-scoped queue | On reconnect and queue save |
| `score.update` | manager_id, gameweek, points, bolt_points, provisional | After each scoring recompute |
| `market.transaction` | manager, added, dropped | On any add or drop |
| `trade.state` | trade_id, state, votes | On propose, accept, veto, expiry |
| `lineup.lock` | league, locked_at | At each league's opening kickoff |

### 16.3 Job schedule

| Job | Cadence |
|-----|---------|
| Fixture sync, including reschedules and gameweek reassignment | Daily 03:00 GST |
| Gameweek creation from fixtures | Weekly, Thursday 23:30 GST |
| Player pool sync | Weekly, or on commissioner trigger |
| Livescore poll | Every 60s while any league's matchday is open |
| Post-match stats | Full-time plus 5 minutes, and a correction pass at full-time plus 24 hours |
| Scoring recompute | After every stats write |
| Lineup lock and auto-start | At each league's opening kickoff |
| Trade review expiry | Hourly |
| Gameweek finalisation | 24 hours after the last full-time in the window |

### 16.4 Roles and permissions

- Commissioner and backup stored as a **Supabase custom claim** `ultima_role`, with an env allowlist as the break-glass fallback.
- Every write path re-checks the claim server-side. No client-side role gating.
- All scoring, draft, market and trade writes are server-only.

### 16.5 Rate limits

| Endpoint | Limit |
|----------|-------|
| Invite redeem | 5 per hour per IP, plus a honeypot field |
| Draft pick | One per manager per turn, server-enforced |
| Queue save | 30 per minute per manager |
| Market add or drop | 10 per minute per manager |
| Trade propose | 20 per day per manager |
| Trade veto | One per trade per manager |

### 16.6 Error shape

```
{
  "code": "PICK_TAKEN",
  "message": "That pick did not land. Someone took him first. Pick again.",
  "field": null
}
```

- `message` is the user-facing line from section 15.6, written in TRF voice, never a raw exception.
- Codes: `PICK_TAKEN`, `NOT_YOUR_TURN`, `FLOOR_IMPOSSIBLE`, `LEAGUE_LOCKED`, `SQUAD_FULL`, `FLOOR_VIOLATION`, `INVITE_INVALID`, `INVITE_EXPIRED`, `LEAGUE_FULL`, `TRADE_UNEVEN`, `TRADE_TOO_EARLY`, `NOT_COMMISSIONER`.

### 16.7 Analytics

- `ultima_events` table mirroring the existing vote and play event pattern: `event`, `manager_id`, `payload`, `created_at`.
- Events: `invite_redeemed`, `profile_saved`, `draft_entered`, `pick_made`, `xi_saved`, `xi_auto_started`, `market_add`, `trade_proposed`, `trade_executed`, `standings_viewed`.

---

## 17. Data provider

### 17.1 Adapter

```
StatsProvider (interface)
  getPlayers(league)
  getFixtures(league, from, to)
  getPlayerMatchStats(fixtureId)

  → MockProvider       (Phases A to E, G to J)
  → SportmonksProvider (Phase F onward)
```

Nothing above the adapter knows which provider is live.

### 17.2 Mock provider contract

| Item | Value |
|------|-------|
| Location | `data/ultima/seed/` |
| Files | `players.pl.json`, `players.laliga.json`, `players.seriea.json`, `fixtures.json`, `stats.gw-sample.json`, `rankings.json` |
| Volume | About 500 draftable players per league |
| Player fields | `provider_id`, `name`, `club`, `league`, `active`, `goals_rate`, `assists_rate`, `rating_avg`, `rating_consistency`, `minutes_reliability`, `club_strength` |
| Seeding of derived values | `goals_rate` and `assists_rate` as per-90 from last season; `rating_avg` and `rating_consistency` as mean and standard deviation from last season; `minutes_reliability` as appearances divided by club fixtures; `club_strength` as last season's final league position normalised to 0 to 1 |
| Manual draft ranking | `rankings.json`, one ordered list per league, sourced from last season's total fantasy points under this scoring system |
| Historical gameweek | One real completed round per league, hand-entered, matching the appendix worked example |

**Phase A gate:** the seed loads, the appendix example scores exactly, and Melo signs the calibration.

### 17.3 Sportmonks, Phase F

| Item | Value |
|------|-------|
| Plan | Starter, three leagues in use |
| League IDs | Confirm the three IDs from provider docs at Phase F; do not hard-code guesses |
| Endpoints | Schedules and results, Livescores and events, Statistics |
| Field mapping | Goals, assists and rating come from the Statistics type IDs; confirm each ID against provider docs and record the mapping in `docs/ultima-provider-mapping.md` |
| Call budget | 2,000 per entity per hour. Livescore polling bulk by date and league is 3 calls per minute, 180 per hour, comfortably inside budget |
| Key handling | Server-only in Vercel env, never in the client or in commits |
| Idempotency | `(fixture_id, provider_revision)` |
| **Exit gate** | The seeded historical gameweek re-scored through the live provider matches the mock result. If rating sources differ, the gate validates structure only and that is stated in the handover |

---

## 18. Notifications

- **In-app first:** hub status lines and a header dot carry every state change. This is the only channel that must exist at launch.
- **Email via Resend**, reusing the existing `concierge@thereflectivefootball.com` sender already wired for the Concierge inbox.

| Trigger | Channel | Timing |
|---------|---------|--------|
| You are on the clock | Email plus in-app | Immediate, and only on timers of 5 minutes or longer |
| Pick auto-made on expiry | Email plus in-app | Immediate |
| Draft starting | Email | 24 hours and 1 hour before |
| XI not set | Email | 3 hours before the first league opens |
| Trade proposed to you | Email plus in-app | Immediate |
| Trade in review | In-app | On acceptance |
| Gameweek final | In-app | On finalisation |

- **No push notifications in v1.** Revisit only if the PWA gains push, which is already parked site-wide.
- Every email carries a one-click link straight to the relevant Ultima route.

---

## 19. Security and compliance

- Provider key, service role key and Resend key are **server-only**, never in the client bundle or a commit.
- All scoring, draft, market and trade writes go through authenticated, authorised server routes.
- **RLS summary:** authenticated managers read all squads, lineups, scores, standings and the public log. Anonymous users read **nothing** beyond the landing and rules content, which is static. Every write policy is server-role only.
- Invite redemption is rate-limited and honeypotted, matching the Write to Melo pattern already on the site.
- `ultima_admin_log` is **append only**. No update or delete policy exists on it for any role, including the commissioner.
- **No cash prizes, no entry fee, no odds.** Ultima is a free invite-only game run by a Shams-licensed UAE entity, and it stays outside any gaming or wagering definition by design. Any prize is non-cash and awarded on camera.
- English only in v1.

---

## 20. Data model

- `ultima_competition` (season, window rule, max seats, timer_setting, rating_thresholds, trade_deadline_gw)
- `ultima_invites` (code, expires_at, used_by, used_at, created_by)
- `ultima_managers` (user_id, team_name, colour, draft_slot, is_bot, persona_id, is_backup_commissioner)
- `ultima_bot_personas` (id, name, risk, horizon, discipline, wobble, weights, rationale_lines)
- `ultima_players` (provider_id, name, league, club, active, draft_round, bolt_eligible, inactive_flag, seed_metrics)
- `ultima_draft_state` (state, order, current_pick, paused_by, paused_at, resume_at)
- `ultima_draft_picks` (manager_id, player_id, round, pick_number, picked_at, auto_picked, forced, rationale)
- `ultima_draft_queues` (manager_id, player_id, position)
- `ultima_rosters` (manager_id, player_id)
- `ultima_lineups` (manager_id, gameweek, slot, player_id, locked_at, auto_started)
- `ultima_gameweeks` (number, window_start, window_end, league_open_at, state)
- `ultima_fixtures` (provider_id, league, kickoff, status, gameweek)
- `ultima_player_match_stats` (fixture_id, player_id, goals, assists, rating, raw_json)
- `ultima_manager_gameweek_scores` (manager_id, gameweek, points, bolt_points, version)
- `ultima_transactions` (manager_id, type, player_id, gameweek, created_at)
- `ultima_trades` (proposer_id, receiver_id, state, verdict_json, created_at, resolved_at)
- `ultima_trade_players` (trade_id, player_id, from_manager_id, to_manager_id)
- `ultima_trade_votes` (trade_id, manager_id, veto)
- `ultima_score_adjustments` (who, why, before, after)
- `ultima_admin_log` (actor_id, action, reason, payload, created_at) — publicly readable, append only
- `ultima_events` (event, manager_id, payload, created_at)

---

## 21. Phasing

| Phase | Deliverable | Exit |
|-------|-------------|------|
| **A** | Spec in repo, schema, adapter, mock seed, rating study, worked example signed | Seed loads; appendix example scores exactly; thresholds signed off |
| **B** | Hub, landing, rules, invites capped at 10, profile, player browse | Eleventh redemption rejected; auth redirect works |
| **C** | Live draft: lifecycle, timer, queue, floor counter, forced pick, feed, reconnect | 10 seats complete 25 rounds; every squad holds 4 per league |
| **D** | Squad, XI, per-league locks, auto-start, historical scoring incl. Bolt | Points match the appendix; each league locks independently |
| **E** | Market, drops, replacements, floor relaxation | Add and drop keeps squads at 25 and respects locks |
| **F** | **Sportmonks introduced behind the adapter** | Re-scored gameweek matches the mock |
| **G** | Live matchday, SSE, provisional to final, notifications | Within SLA; emails deliver |
| **H** | Bot personas: seating, draft, XI, published risk numbers, rationale feed | A 2-human league completes a full draft and gameweek |
| **I** | Trade machine, validator, mobile builder | Ships before gameweek 4 |
| **J** | Admin corrections, public log, analytics events | One correction recomputes with a public audit row |

**Stop for Melo review** at the end of each phase.

Phases A to G are the launch build. H and I can land after kickoff: bots only matter if humans do not fill the seats, and trades cannot function before gameweek 4.

---

## 22. Acceptance tests

1. Eleventh invite redemption rejected; expired code rejected; used code rejected.
2. Signed-out hit on `/ultima/squad` redirects to `/signin?next=/ultima/squad`.
3. Snake order correct for 10 seats across 25 rounds.
4. Pick rejected when it makes the 4-per-league floor impossible, accounting for remaining supply.
5. Forced state filters the board to deficit leagues and states why.
6. Floor counter visible to a manager not on the clock.
7. Timer expiry auto-picks from queue, then ranking, then deficit.
8. Reconnect mid-draft restores board, queue and clock.
9. Draft pauses overnight and resumes on the same second.
10. Bots seat only at `live`, one per empty seat, named by persona with a BOT tag.
11. LaLiga slots lock at the LaLiga opening kickoff while Premier League slots stay editable.
12. An empty slot still takes a Serie A player after the Premier League has opened.
13. Auto-start fires per league and skips an inactive player.
14. Bench players score zero; a player with two fixtures scores both into one slot.
15. A rescheduled fixture scores in the week it is played, and no Final gameweek is rewritten.
16. Bolt fires on a round-21 player with 6 base points and not on a re-signed round-1 player.
17. Add and drop keeps the squad at 25 and refuses a locked player.
18. Inactive flag relaxes the floor and is logged.
19. Trade rejected when uneven, when it breaks a floor, or before gameweek 4.
20. Majority veto cancels an accepted trade inside 24 hours; the hourly job executes an unvetoed one.
21. Commissioner correction writes a public log row with a typed reason; the log rejects update and delete.
22. Two bots with different risk numbers produce measurably different squads from the same pool.
23. A bot posts a rationale line matching its persona with every pick.
24. Standings show tie resolution, Bolt board and bot risk numbers.
25. Browser back closes an open bottom sheet without leaving the page.
26. Escape closes a sheet and returns focus to the trigger.
27. Every disabled control on every screen carries a reason line.
28. Drop and Cancel-draft require confirmation; drafting a player does not.
29. `/ultima/squad` and `/ultima/trades` at 390px: no horizontal scroll, one bottom sheet, Save disabled with a stated reason.
30. Anonymous client cannot read any Ultima table.
31. No provider, service or Resend key in the client bundle or browser network tab.
32. All copy free of em-dashes; cream, navy and red discipline holds on every screen in the rhythm table.

---

## 23. Open decisions (Melo)

- [ ] Draft date and timer option
- [ ] Gameweek 1 date
- [ ] Whether standings are public to non-members
- [ ] Backup commissioner, named or none
- [ ] Prize or on-camera league name
- [ ] Confirm **Ultima** as the public name

---

## Appendix A — Worked example, gameweek 12

Illustrative fixture for engineering QA. The real seed must reproduce this shape exactly.

**Lock timeline:** LaLiga opens Friday 21:00, Premier League Saturday 12:30, Serie A Saturday 18:00.

| Slot | League | Player | Round | Goals | Assists | Rating | Base | Bolt |
|------|--------|--------|-------|-------|---------|--------|------|------|
| 1 | PL | Player A | 2 | 1 | 1 | 8.1 | 6 | — |
| 2 | PL | Player B | 7 | 0 | 0 | 6.8 | 0 | — |
| 3 | PL | Player C | 11 | 1 | 0 | 7.6 | 5 | — |
| 4 | LL | Player D | 1 | 0 | 2 | 7.9 | 4 | — |
| 5 | LL | Player E | 9 | 2 | 0 | 8.3 | 8 | — |
| 6 | LL | Player F | 14 | 0 | 1 | 7.2 | 2 | — |
| 7 | SA | Player G | 5 | 1 | 0 | 7.4 | 4 | — |
| 8 | SA | Player H | 18 | 1 | 1 | 7.7 | 6 | **+2** |
| 9 | SA | Player I | 20 | 0 | 0 | 7.1 | 1 | no |
| 10 | Free, PL | Player J | 13 | 0 | 1 | 6.9 | 1 | — |
| 11 | Free, LL | Player K | 6 | 1 / 0 | 0 / 0 | 7.5 / 6.6 | 5 | — |

- Player K has **two fixtures** in the window: 3 for the goal plus 2 for the 7.5 rating, then 0 from the second fixture.
- Player H is **Bolt eligible** at round 18 and returns 6 base points, so the bonus fires.
- Player I is Bolt eligible at round 20 but returns 1 base point, below the threshold, so it does not.
- A bench player scored 12 this week and contributes **nothing**.

**Base total: 42. Bolt: +2. Gameweek total: 44.**

---

## 24. Document control

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | Aug 2026 | Initial master spec |
| 2.0 | Aug 2026 | Squad 25, 10 managers, weekly XI, dual floors, mock-provider build order |
| 3.0 | Aug 2026 | Per-league locks, free agency, Bolt bonus, live draft, bots, trade machine |
| 3.1 | Aug 2026 | Risk-scaled bot personas replacing the TPD dependency; controls and navigation |
| 4.0 | Aug 2026 | Routes and hub, repo integration, stack contract, draft lifecycle, bot seating, profile, invites, standings, feed, trade UI, mock contract, calibration output, notifications, security section, worked example. Postponed-fixture rule corrected |
