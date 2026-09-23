# Ultima FM24 office

Design source of truth for every seated Ultima page. If this file conflicts with an older look, this file wins.

## Direction

Every seated page is a Football Manager 24 office: dense panels, header strips, rows not cards, one club bar, one Continue button.

Draft and practice rooms move into the night office. The cream mobile desk is retired.

Rules renders in the office when seated and on cream paper when unsigned. Join stays cream.

Mobile first, then desktop. No new stack, no new data, no scoring, Sportmonks, or auth changes.

## Tokens

Enforce everywhere.

| Token | Value |
|---|---|
| Page | `#12151C` with grain |
| Panels | `#181C25` |
| Raised panels | `#1E2430` |
| Ink | `#E6E1D8` |
| Muted ink | `#E6E1D8` at 58% |
| Chrome | hairline, inset highlight, drop shadow |
| Type | Archivo only. No Bodoni Moda on any Ultima surface. |
| Numbers | `tabular-nums` on every number |
| Club name | Archivo 500, 22px mobile, 28px desktop, letter-spacing `-0.01em` |
| Team colour | 4px left stripe only. Kit picker excludes signal red. |
| Signal red `#D8232A` | LIVE and veto only |
| Good / up | existing teal |
| Country tags | ENG ESP ITA GER FRA, never league acronyms |

The rest of thereflectivefootball.com still uses Bodoni. Do not remove the site-wide Bodoni import. Ultima routes must not use it. `.office` and `.ultimaRoot` lock Archivo so nothing inherits display serif.

## Shell

Club bar on every seated page: team stripe, Archivo club name, season line, Continue on the right.

Continue routes to the most urgent real task:

1. On the clock: Make your pick → `/ultima/draft`
2. Open trade or veto: Answer trade → `/ultima/trades` or the trade
3. XV not set: Set your XV → `/ultima/squad`
4. Else: Go to hub → `/ultima`

Continue label names the task.

Desktop left rail and mobile bottom bar show the same doors on every seated page, including live draft and practice rooms: Hub, Pre-draft, Draft, Squad, Table, Market, Trade, Rules, Profile, Log, and Admin if you are commissioner. No More sheet. The mobile bar scrolls sideways if the phone is narrow. Cream Join is the only seated-adjacent surface without the rail.

Rail icons use office metaphors:

- Hub: building
- Pre-draft: clipboard
- Draft: list-numbers
- Squad: shirt
- Table: trophy
- Market: storefront
- Trade: arrows-exchange
- Admin: shield

Safe-area insets at the top of the seated shell and the standalone PWA so nothing sits under the iOS status bar. PWA theme and background are night `#12151C`. `apple-mobile-web-app-status-bar-style` is `black-translucent`.

Draft and practice rooms keep `ultima-live-chrome-off` so the TRF site header and footer stay off. The Ultima rail stays on and stays pinned to the viewport: mobile bar `position: fixed` at the bottom, document scroll frozen. Only the player list and lobby body scroll. Office sheets sit above the rail. Sheet actions clear the bar. Practice pick is a number field or a tap on a slot, not Up / Down.

## Primitives

- Panel: header strip (11px Archivo 500, letter-spaced, muted ink, hairline under), dense body, no box inside a box.
- Row: 48px minimum, hairline separator, primary 15px, meta 13px minimum, number right-aligned.
- Your row: raised panel colour plus team stripe, in every table and list.
- Value scale for expected points: muted ink (low), ink (mid), teal (high). Missing values render `-`.
- Inbox item: sender-type icon, unread dot in teal, subject, sender and time.
- Status bar: thin 4px bar for real ratios only (floor filled, squad filled, fairness).
- Empty states speak as staff and stay honest: "No fixtures synced yet. The scouts report when Sportmonks does."
- Errors become staff messages in the inbox pattern with a retry action, never red boxes.

## Page map

| Route | FM24 equivalent |
|---|---|
| Hub | Home and inbox: briefing, next match, form, movers, league mail, staff radio |
| Pre-draft | Scouting assignments: room list, lobby. Start stays in the top bar. Host sets 2–10 seats and types or taps a pick. Start keeps that order. Season draft stays a random 10. |
| Draft and practice | Draft room: board, picker, queue, picks, plus the full-screen on-the-clock takeover |
| Squad | Squad view: XV grouped by country with floor status, bench below |
| Table | League table: your row highlighted, season points, gameweek, Bolt line |
| Market | Player search: same picker component as the draft |
| Trade | Transfer offers: your side vs their side, advisory fairness bar, red only on live veto |
| Rules | Cream paper when unsigned. Night office when seated. One content source. |
| Join | Cream paper. After a seat, hub plus welcome inbox item. |
| Profile | Club, manager, notifications. Kit colour sets the 4px stripe. |
| Admin | Commissioner only. League state, seats, sync, draft. Destructive actions use a confirm sheet. |
| Log | Inbox rows, newest first, chips for Draft, Trade, Market, Admin |
| Sample | Same shell. SAMPLE chip on the club bar and every panel header. Dev only. |

## Hard rules

- No invented scores, portraits, prices, or nominees.
- No foil cards, no FUT styling, no FM25 tiles.
- No store or legends routes. Never mention We Are Football.
- Copy is short, no em dashes, fans as protagonists, year 2026.

## Build order

Work one step at a time. Stop for review at the end of each step.

1. Shell and club bar. Mobile first.
2. Office primitives: Panel, Row, ValueNumber, Inbox, Status bar, Staff message, Stats strip.
3. Hub `/ultima`: mobile stack then desktop 25 / 50 / 25. Step 2 primitives only. No world tables, no League-break hero, no Scout / My squad buttons.
4. Draft room, picker, and on-the-clock. Night office. Shared by `/ultima/draft` and `/ultima/practice/{code}`. Practice keeps `mutatePlayerPool: false`.
5. Squad `/ultima/squad`: XV and bench lists, country floors, Auto-fill confirm. No pitch graphic.
6. Table `/ultima/standings`: season and gameweek views, form squares from real gameweek ranks, Bolt line, club sheet. XV omitted until the current gameweek locks. LIVE only next to the gameweek label.
7. Market `/ultima/market`: draft picker for free agents, watchlist, scouting tables. No prices. Sign and drop logic unchanged.
8. Trade `/ultima/trades`: received, sent, league, new offer. Fairness advisory. Red only on live veto. Trade logic unchanged.
9. Pre-draft `/ultima/practice`: practice rooms as office rows. Solo does not auto-start. Start sits in the lobby top bar. Host sets seat count (2–10) and pick by number or tap. Start uses that order. Season `/ultima/draft` still shuffles 10. The office rail stays on in rooms.
10. Rules: cream for unsigned, night office for seated, one content source. Join stays cream and lands on the hub.
11. Utility pages: Profile, Admin, Log, Sample. Step 2 primitives only. Kit colours exclude signal red. Destructive admin actions use a confirm sheet and office buttons. Veto stays red. Sample carries a muted SAMPLE chip on the club bar and every panel header.
12. Final sweep: Archivo only on Ultima. Signal red is LIVE and veto only. Staff messages replace red error boxes. Country tags stay ENG ESP ITA GER FRA. Missing values are a dash. Rows stay 48px with 13px minimum text. Safe-area on seated pages and the PWA. Draft and practice hide site chrome. Cream-desk and old-hub leftovers removed.
13. Standalone host `ultima.thereflectivefootball.com` (and local `ultima.localhost`). Middleware rewrites `/` to `/ultima` and `/x` to `/ultima/x`. Non-Ultima routes redirect to the hub. TRF header, footer, and install hint stay off. Auth cookies use `.thereflectivefootball.com` on live TRF hosts so one login works on both. Subdomain manifest: name Ultima, start_url `/`, scope `/`, display standalone, theme and background `#12151C`. Service worker registers at `/sw.js` with scope `/`. Unsigned visitors on that host land on Sign in (`next=/`), not the invite password. After sign-in, a seat opens the office; no seat opens cream Join once. `thereflectivefootball.com/ultima` stays for existing managers. When the host is live, add the Supabase redirect `https://ultima.thereflectivefootball.com/auth/callback`.
