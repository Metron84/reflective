# The Beautiful Archive — Finish List

Everything remaining, in order. Nothing else is needed after this.

**Status at 10 August 2026:** 29 published · 211 holding · 35 quarantined · 40 low confidence
**Built:** data layer · index route · entry pages · search · lens layer · PWA caching · homepage door · checklist/museum exports · maintenance doc · launch readiness (sitemap, JSON-LD, canonical, OG)
**Closed:** research phase. No further Perplexity passes.
**Lenses:** 29 published entries have lens records.

---

## 1. Lenses for the 29 published entries

**Done.** 29 lens records / 87 passages promoted and pushed.

---

## 2. Museum verification batch

One sitting. Clears roughly 18 of the 40 low-confidence entries.

**Your part**

- Open each club museum's official site.
- Confirm founding year, location, and that it is currently open.
- Use `exports/museum-worklist.csv` (regenerate with `npm run export:checklist`).
- Anything permanently closed goes to quarantine.

**Then, to Cursor**

```
Apply the museum verification results.

1. For each id below, set confidence 'high' and apply the corrections
   given: [paste corrections]
2. For each id listed as closed, move to quarantine.json with reason
   "permanently_closed" and a note giving the closure year.
3. Add a comment at the top of the museum section of holding.json:
   museum entries carry opening and ticketing details that date quickly
   and should be rechecked annually.
4. Report the new low-confidence count.

Commit with message "chore(archive): verify museum entries".
```

---

## 3. Verification batches

The bulk of the work, and the only part nobody can do for you.

**Order**

- Films, music, art, photography first. These verify fastest.
- Books next.
- Documentaries last. They carry the most risk.
- The four original low-confidence entries and the Captains pair go last of all.

**Method**

- Batches of twenty, in the order `exports/archive-checklist.csv` is sorted.
- PUBLISH means you would defend the entry to a journalist. Anything short of that stays in holding.
- Write the corrected value in the correction column, not a description of the problem.

**The publish instruction, same shape every time**

```
Move these ids from holding.json to entries.json with verified: true
and status 'published'. Apply the corrections listed. Change nothing
else. Report published and holding totals.

[ids]
[corrections]
```

**Targets**

- 50 published: the archive is credible.
- 100 published: launch readiness kicks in.
- 150 published: the library is complete enough to stop worrying about size.

---

## 4. Launch readiness, at roughly 100 published

**Built early (ungated SEO).** Sitemap, JSON-LD, canonical URLs, OG cards shipped. `isArchiveLaunchReady()` gates at 100 published for future scale features. Lighthouse mobile performance scored 75 on local headless (a11y/SEO ≥96).

---

## 5. The announcement

- The archive is the first thing on the site that is not a game or a film, so it gets its own launch, not a mention.
- Lead with the count and the claim: a curated library of football in books, film, photography, music and art.
- The Instagram cut is the photography entries, because those are the images that travel.
- Point the Zenodo report at the archive and the archive at the report. They are the same argument.
- One line for the pitch: everyone else lists what exists, we tell you where to start.

---

## 6. Maintenance cadence

**Written:** `docs/archive-maintenance.md` (linked from README).

---

## Open items carried forward

- Africa is the thinnest region across the whole collection. Worth one Africa-specific pass once holding is under fifty.
- The quarantined terrace-music records name fanbases for a future song-level pass. Those notes are in `quarantine.json`.
- `women-play-football-not-womens-football-2024` stays low confidence until the work's public accessibility is confirmed.

---

## Standing rules

- Nothing publishes without `verified: true`.
- The validator flags bad data. It never rewrites it.
- Holding is never precached and never indexed.
- Preview only via `NEXT_PUBLIC_ARCHIVE_PREVIEW=true` in `.env.local`, never in production.
- Do not invent facts. Low confidence is always a better answer than a guess.

---

# Inventories

Full dump from `content/archive/` as of this update. Counts: **29 published · 211 holding · 40 low confidence · 35 quarantine**.

---

## A. Published (29)

- `bend-it-like-beckham-2002` — Bend It Like Beckham (film, 2002, Europe) [high]
- `blue-is-the-colour-1972` — Blue Is the Colour (music, 1972, Europe) [high]
- `bobby-moore-statue-2007` — Bobby Moore Statue (artwork, 2007, Europe) [high]
- `diego-maradona-2019` — Diego Maradona (documentary, 2019, South America) [high]
- `dynamism-of-a-soccer-player-1913` — Dynamism of a Soccer Player (artwork, 1913, Europe) [high]
- `escape-to-victory-1981` — Escape to Victory (film, 1981, Europe) [high]
- `fear-and-loathing-in-la-liga-barcelona-vs-real-madrid-2013` — Fear and Loathing in La Liga: Barcelona vs Real Madrid (book, 2013, Europe) [high]
- `football-against-the-enemy-1994` — Football Against the Enemy (book, 1994, Europe) [high]
- `going-to-the-match-1953` — Going to the Match (artwork, 1953, Europe) [high]
- `how-soccer-explains-the-world-2004` — How Soccer Explains the World (book, 2004, North America) [high]
- `inverting-the-pyramid-the-history-of-football-tactics-2008` — Inverting the Pyramid: The History of Football Tactics (book, 2008, Europe) [high]
- `looking-for-eric-2009` — Looking for Eric (film, 2009, Europe) [high]
- `offside-2006` — Offside (film, 2006, Middle East) [high]
- `shaolin-soccer-2001` — Shaolin Soccer (film, 2001, Asia) [high]
- `soccer-in-sun-and-shadow-1995` — Soccer in Sun and Shadow (book, 1995, South America) [high]
- `sunderland-til-i-die-2018` — Sunderland 'Til I Die (docuseries, 2018, Europe) [high]
- `the-ball-is-round-a-global-history-of-football-2006` — The Ball Is Round: A Global History of Football (book, 2006, Europe) [high]
- `the-cup-1999` — The Cup (film, 1999, Asia) [high]
- `the-damned-united-2009` — The Damned United (film, 2009, Europe) [high]
- `the-football-players-1908` — The Football Players (artwork, 1908, Europe) [high]
- `the-miracle-of-bern-2003` — The Miracle of Bern (film, 2003, Europe) [high]
- `the-two-escobars-2010` — The Two Escobars (documentary, 2010, South America) [high]
- `three-lions-1996` — Three Lions (music, 1996, Europe) [high]
- `uefa-champions-league-anthem-1992` — UEFA Champions League Anthem (music, 1992, Europe) [high]
- `united-trinity-2008` — United Trinity (artwork, 2008, Europe) [high]
- `waka-waka-2010` — Waka Waka (music, 2010, Africa) [high]
- `wavin-flag-2010` — Wavin' Flag (music, 2010, Africa) [high]
- `world-in-motion-1990` — World in Motion  (music, 1990, Europe) [high]
- `youll-never-walk-alone-1963` — You'll Never Walk Alone (music, 1963, Europe) [high]

---

## B. Holding (211)

- `100-years-of-womens-football-mural-2021` — 100 Years of Women's Football Mural (artwork, 2021, Oceania) [high]
- `a-beautiful-game-international-perspectives-on-womens-football-2007` — A Beautiful Game: International Perspectives on Women's Football (book, 2007, International) [low]
- `a-patria-em-chuteiras-1994` — A Pátria em Chuteiras (book, 1994, South America) [high]
- `a-shot-at-glory-2001` — A Shot at Glory (film, 2001, Europe) [high]
- `a-sombra-das-chuteiras-imortais-1993` — À Sombra das Chuteiras Imortais (book, 1993, South America) [high]
- `a-womans-game-marta-vieira-da-silva-2018` — A Woman's Game: Marta Vieira da Silva (docuseries, 2018, South America) [high]
- `a-womans-game-the-rise-fall-and-rise-again-of-womens-football-2022` — A Woman's Game: The Rise, Fall, and Rise Again of Women's Football (book, 2022, Europe) [high]
- `a-womans-goal-2013` — A Woman's Goal (photography, 2013, Asia) [high]
- `afrosport-2023` — Afrosport (photography, 2023, Africa) [high]
- `ajax-museum-johan-cruyff-arena-experience` — Ajax Museum / Johan Cruyff Arena Experience (museum, —, Europe) [low]
- `all-hexodot-everything-2019` — All Hexodot Everything (artwork, 2019, Europe) [high]
- `all-roads-lead-down-under-2023` — All Roads Lead Down Under (docuseries, 2023, International) [low]
- `amen-grassroots-football-2010` — Amen: Grassroots Football (photography, 2010, Africa) [high]
- `amen-grassroots-football-2010-b` — Amen: Grassroots Football (artwork, 2010, Africa) [high]
- `anfield-rap-1988` — Anfield Rap (music, 1988, Europe) [high]
- `angels-with-dirty-faces-the-footballing-history-of-argentina-2016` — Angels with Dirty Faces: The Footballing History of Argentina (book, 2016, South America) [high]
- `argentinos-juniors-museum-stadium-tour` — Argentinos Juniors Museum / Stadium Tour (museum, —, South America) [low]
- `arqueros-ilusionistas-y-goleadores-1998` — Arqueros, ilusionistas y goleadores (book, 1998, South America) [high]
- `as-donas-da-bola-2014` — As Donas da Bola (photography, 2014, South America) [high]
- `as-mulheres-no-universo-do-futebol-brasileiro-2020` — As mulheres no universo do futebol brasileiro (book, 2020, South America) [high]
- `atlas-lions-terrace-calls-qatar-2022-2022` — Atlas Lions terrace calls (Qatar 2022) (music, 2022, Africa) [medium]
- `australian-womens-soccer-the-first-twenty-years-1994` — Australian Women's Soccer: The First Twenty Years (book, 1994, Oceania) [high]
- `bamboo-goalposts-one-mans-quest-to-teach-the-peoples-republi-2008` — Bamboo Goalposts: One Man's Quest to Teach the People's Republic of China to Love Football (book, 2008, Asia) [high]
- `banned-2018` — Banned (artwork, 2018, Europe) [high]
- `barcelona-1974` — Barcelona (artwork, 1974, Europe) [high]
- `bayern-2000` — Bayern (music, 2000, Europe) [high]
- `behind-the-curtain-travels-in-eastern-european-football-2006` — Behind the Curtain: Travels in Eastern European Football (book, 2006, Europe) [high]
- `belfast-celtic-museum` — Belfast Celtic Museum (museum, —, Europe) [low]
- `belles-of-the-ball-early-history-of-womens-football-1991` — Belles of the Ball: Early History of Women's Football (book, 1991, Europe) [high]
- `beyond-bend-it-like-beckham-the-global-phenomenon-of-womens-soccer-2012` — Beyond Bend It Like Beckham: The Global Phenomenon of Women's Soccer (book, 2012, International) [low]
- `bigil-2019` — Bigil (film, 2019, Asia) [high]
- `bill-shankly-statue-1997` — Bill Shankly Statue (artwork, 1997, Europe) [high]
- `bisang-2006` — Bisang (documentary, 2006, Asia) [low]
- `black-diamond-2020` — Black Diamond (documentary, 2020, Africa) [high]
- `blue-moon-1990` — Blue Moon (music, 1990, Europe) [high]
- `bobby-charlton-1991` — Bobby Charlton (artwork, 1991, Europe) [high]
- `brasil-decime-que-se-siente-2014` — Brasil Decime Qué Se Siente (music, 2014, South America) [high]
- `cant-del-barca-1974` — Cant del Barça (music, 1974, Europe) [high]
- `captains-2022` — Captains (docuseries, 2022, International) [low]
- `captains-of-the-world-2023` — Captains of the World (docuseries, 2023, International) [low]
- `carli-lloyd-mural-2019` — Carli Lloyd Mural (artwork, 2019, North America) [high]
- `carsi-her-seye-karsi` — Çarşı, her şeye karşı (music, —, Europe) [low]
- `champions-league-koulikoro-2023` — Champions League Koulikoro (photography, 2023, Africa) [high]
- `chinese-ladies-playing-cuju-1490` — Chinese Ladies Playing Cuju (artwork, 1490, Asia) [low]
- `copa-71-2023` — Copa 71 (documentary, 2023, North America) [high]
- `coup-de-tete-1979` — Coup de Tête (film, 1979, Europe) [high]
- `cup-final-1991` — Cup Final (film, 1991, Middle East) [high]
- `daehan-minguk-chant-2002` — Daehan Minguk chant (music, 2002, Asia) [high]
- `dare-to-dream-the-story-of-the-us-womens-soccer-team-2007` — Dare to Dream: The Story of the U.S. Women's Soccer Team (documentary, 2007, North America) [high]
- `das-reboot-how-german-football-reinvented-itself-and-conquer-2015` — Das Reboot: How German Football Reinvented Itself and Conquered the World (book, 2015, Europe) [high]
- `destined-to-play-the-untold-story-of-saudi-womens-football-2023` — Destined to Play: The Untold Story of Saudi Women's Football (documentary, 2023, Middle East) [high]
- `deutsches-fu-ballmuseum-2015` — Deutsches Fußballmuseum (museum, 2015, Europe) [high]
- `dhan-dhana-dhan-goal-2007` — Dhan Dhana Dhan Goal (film, 2007, Asia) [high]
- `diamantino-2018` — Diamantino (film, 2018, Europe) [high]
- `dogdugun-gunden-beri` — Doğduğun Günden Beri (music, —, Europe) [low]
- `egaro-2011` — Egaro (film, 2011, Asia) [high]
- `el-chanfle-1979` — El Chanfle (film, 1979, North America) [high]
- `equal-playing-field-2021` — Equal Playing Field (documentary, 2021, International) [high]
- `es-un-sentimiento-no-puedo-parar` — Es un sentimiento, no puedo parar (music, —, South America) [low]
- `european-fields-the-landscape-of-lower-league-football-2006` — European Fields: The Landscape of Lower League Football (photography, 2006, Europe) [high]
- `fc-barcelona-museum-1984` — FC Barcelona Museum (museum, 1984, Europe) [high]
- `fc-bayern-museum` — FC Bayern Museum (museum, —, Europe) [low]
- `fc-porto-museum-2013` — FC Porto Museum (museum, 2013, Europe) [high]
- `fc-st-pauli-museum` — FC St. Pauli Museum (museum, —, Europe) [low]
- `fc-venus-2005` — FC Venus (film, 2005, Europe) [high]
- `feet-of-the-chameleon-the-story-of-african-football-2009` — Feet of the Chameleon: The Story of African Football (book, 2009, Africa) [high]
- `fifa-museum-2016` — FIFA Museum (museum, 2016, Europe) [high]
- `football-1839` — Football (artwork, 1839, Europe) [high]
- `football-days-classic-football-photographs-2005` — Football Days: Classic Football Photographs (photography, 2005, Europe) [high]
- `football-in-the-middle-east-state-society-and-the-beautiful-2022` — Football in the Middle East: State, Society, and the Beautiful Game (book, 2022, Middle East) [high]
- `football-iranian-style-2001` — Football Iranian Style (documentary, 2001, Middle East) [high]
- `football-rebels-2013` — Football Rebels (docuseries, 2013, Europe) [high]
- `football-under-cover-2008` — Football Under Cover (documentary, 2008, Middle East) [high]
- `footballs-forgotten-legends-the-dick-kerr-ladies-2021` — Football's Forgotten Legends: The Dick, Kerr Ladies (book, 2021, Europe) [high]
- `futebol-de-mulheres-no-brasil-desafios-para-as-politicas-publicas-2020` — Futebol de mulheres no Brasil: Desafios para as políticas públicas (book, 2020, South America) [high]
- `futebol-feminino-no-brasil-entre-festas-circos-e-suburbios-uma-historia-social-1915-1941-2023` — Futebol feminino no Brasil: Entre festas, circos e subúrbios, uma história social (1915-1941) (book, 2023, South America) [high]
- `futebol-the-brazilian-way-of-life-2002` — Futebol: The Brazilian Way of Life (book, 2002, South America) [high]
- `garrincha-hero-of-the-jungle-1962` — Garrincha: Hero of the Jungle (documentary, 1962, South America) [high]
- `girls-on-fire-2021` — Girls on Fire (documentary, 2021, Asia) [high]
- `girls-with-balls-the-secret-history-of-womens-football-2015` — Girls With Balls: The Secret History of Women's Football (book, 2015, Europe) [high]
- `goal-click-womens-football-in-2019-2019` — Goal Click: Women's Football in 2019 (photography, 2019, International) [high]
- `goalkeepers-from-the-fields-of-europe-2026` — Goalkeepers: From the Fields of Europe (photography, 2026, Europe) [high]
- `gracie-2007` — Gracie (film, 2007, North America) [high]
- `green-lions-2022` — Green Lions (documentary, 2022, Africa) [high]
- `habebi-barchaloni-2012` — Habebi Barchaloni (music, 2012, Middle East) [high]
- `hala-madrid-y-nada-mas-2014` — Hala Madrid y Nada Más (music, 2014, Europe) [high]
- `hamburger-sv-museum` — Hamburger SV Museum (museum, —, Europe) [low]
- `headbutt-zidane-materazzi-2012` — Headbutt (Zidane-Materazzi) (artwork, 2012, Europe) [high]
- `her-best-move-2007` — Her Best Move (film, 2007, North America) [high]
- `hillsborough-1989` — Hillsborough  (artwork, 1989, Europe) [high]
- `himno-del-athletic-club` — Himno del Athletic Club (music, —, Europe) [low]
- `himno-del-real-betis` — Himno del Real Betis (music, —, Europe) [low]
- `honeyball-2026` — Honeyball (photography, 2026, Europe) [high]
- `hymn-of-olympiacos-1931` — Hymn of Olympiacos (music, 1931, Europe) [high]
- `ilusion-nacional-2014` — Ilusión Nacional (documentary, 2014, North America) [high]
- `im-forever-blowing-bubbles-1920` — I'm Forever Blowing Bubbles (music, 1920, Europe) [high]
- `in-a-league-of-their-own-the-dick-kerr-ladies-1917-1965-1994` — In a League of Their Own! The Dick, Kerr Ladies 1917-1965 (book, 1994, Europe) [high]
- `iraqs-football-underdogs-2024` — Iraq's Football Underdogs (documentary, 2024, Middle East) [high]
- `irish-fa-education-and-heritage-centre` — Irish FA Education and Heritage Centre (museum, —, Europe) [low]
- `japan-football-museum-2003` — Japan Football Museum (museum, 2003, Asia) [high]
- `juventus-museum` — Juventus Museum (museum, —, Europe) [low]
- `khartoum-offside-2019` — Khartoum Offside (documentary, 2019, Middle East) [high]
- `kung-fu-soccer-2026` — Kung Fu Soccer (film, 2026, Asia) [high]
- `lenak-hilaly-2020` — Lenak Hilaly (music, 2020, Middle East) [high]
- `let-the-girls-play-2018` — Let the Girls Play (film, 2018, Europe) [high]
- `leuchte-auf-mein-stern-borussia` — Leuchte auf, mein Stern Borussia (music, —, Europe) [low]
- `lfg-2021` — LFG (documentary, 2021, North America) [high]
- `life-after-footy-legends-of-the-pacific-2018` — Life After Footy: Legends of the Pacific (documentary, 2018, Oceania) [high]
- `liverpool-fc-museum` — Liverpool FC Museum (museum, —, Europe) [low]
- `made-in-senegal-2020` — Made in Senegal (documentary, 2020, Africa) [high]
- `magnum-football-2002` — Magnum Football (photography, 2002, Europe) [high]
- `maidaan-2024` — Maidaan (film, 2024, Asia) [high]
- `maitanam-the-story-of-football-in-kerala-2022` — Maitanam: The Story of Football in Kerala (documentary, 2022, Asia) [high]
- `maradona-by-kusturica-2008` — Maradona by Kusturica (documentary, 2008, South America) [high]
- `marcha-do-flamengo-1945` — Marcha do Flamengo (music, 1945, South America) [high]
- `matildas-fifa-womens-world-cup-2023-bronze-bas-relief-2024` — Matildas FIFA Women's World Cup 2023 Bronze Bas Relief (artwork, 2024, Oceania) [high]
- `matildas-the-world-at-our-feet-2023` — Matildas: The World at Our Feet (docuseries, 2023, Oceania) [high]
- `metegol-2013` — Metegol (film, 2013, South America) [high]
- `mexico-86-2026` — Mexico 86 (documentary, 2026, North America) [low]
- `middle-east-archive-football-2024` — Middle East Archive: Football (photography, 2024, Middle East) [high]
- `minas-do-futebol-2017` — Minas do Futebol (documentary, 2017, South America) [high]
- `mondo-milan` — Mondo Milan (museum, —, Europe) [low]
- `morbo-the-story-of-spanish-football-2001` — Morbo: The Story of Spanish Football (book, 2001, Europe) [high]
- `more-than-just-a-game-football-v-apartheid-2008` — More Than Just a Game: Football v. Apartheid (book, 2008, Africa) [high]
- `muchachos-ahora-nos-volvimos-a-ilusionar-2022` — Muchachos, Ahora Nos Volvimos a Ilusionar (music, 2022, South America) [high]
- `museo-de-la-pasion-boquense-2001` — Museo de la Pasión Boquense (museum, 2001, South America) [high]
- `museo-del-calcio-2000` — Museo del Calcio (museum, 2000, Europe) [high]
- `museo-del-futbol-1975` — Museo del Fútbol (museum, 1975, South America) [high]
- `museo-penarol` — Museo Peñarol (museum, —, South America) [low]
- `museo-river-2009` — Museo River (museum, 2009, South America) [high]
- `museu-benfica-cosme-damiao-2013` — Museu Benfica – Cosme Damião (museum, 2013, Europe) [high]
- `museu-do-futebol-2008` — Museu do Futebol (museum, 2008, South America) [high]
- `my-beautiful-sisters-2024` — My Beautiful Sisters (book, 2024, Middle East) [high]
- `my-football-summer-2006` — My Football Summer (documentary, 2006, Asia) [high]
- `national-football-museum-2001` — National Football Museum (museum, 2001, Europe) [high]
- `national-football-museum-research-centre-2001` — National Football Museum Research Centre (museum, 2001, Europe) [high]
- `never-say-die-the-hundred-year-overnight-success-of-australian-womens-football-2019` — Never Say Die: The Hundred-Year Overnight Success of Australian Women's Football (book, 2019, Oceania) [high]
- `no-maravilhoso-mundo-do-futebol-1998` — No Maravilhoso Mundo do Futebol (photography, 1998, South America) [high]
- `notti-magiche-1990` — Notti magiche (music, 1990, Europe) [high]
- `number-12-when-greed-and-corruption-become-the-norm-2018` — Number 12: When Greed and Corruption Become the Norm (documentary, 2018, Africa) [high]
- `oh-pilseung-korea-2002` — Oh Pilseung Korea (music, 2002, Asia) [high]
- `oh-ya-hilali` — Oh Ya Hilali (music, —, Middle East) [low]
- `ola-bola-2016` — Ola Bola (film, 2016, Asia) [high]
- `outcasts-united-2009` — Outcasts United (book, 2009, North America) [high]
- `over-land-and-sea-2026` — Over Land and Sea (photography, 2026, Europe) [high]
- `parma-calcio-museum` — Parma Calcio Museum (museum, —, Europe) [low]
- `play-by-play-1984` — Play by Play (book, 1984, South America) [low]
- `queen-of-we-2025` — Queen of WE (documentary, 2025, Asia) [low]
- `queens-of-the-field-2020` — Queens of the Field (film, 2020, Europe) [high]
- `queens-roar-2022` — Queens' Roar (photography, 2022, Europe) [high]
- `quite-unfit-for-females-1921` — Quite Unfit for Females (documentary, 1921, Europe) [high]
- `ragazzi-di-stadio-1980` — Ragazzi di Stadio (photography, 1980, Europe) [high]
- `rain-on-dry-earth-2024` — Rain On Dry Earth (photography, 2024, Africa) [high]
- `rajawi-filistini-2019` — Rajawi Filistini (music, 2019, Africa) [high]
- `rise-2018` — Rise (photography, 2018, Europe) [high]
- `road-to-rio-a-documentary-from-the-fan-to-the-fan-2016` — Road to Rio: A Documentary From the Fan to the Fan (documentary, 2016, South America) [high]
- `roma-non-si-discute-si-ama-1974` — Roma (non si discute, si ama) (music, 1974, Europe) [high]
- `samurai-blue-project-one-creature-2026` — SAMURAI BLUE Project: ONE CREATURE (documentary, 2026, Asia) [high]
- `san-siro-museum` — San Siro Museum (museum, —, Europe) [low]
- `scottish-football-museum-2001` — Scottish Football Museum (museum, 2001, Europe) [high]
- `seven-nation-army-azzurri-terrace-form-2006` — Seven Nation Army (Azzurri terrace form) (music, 2006, Europe) [high]
- `she-can-kick-it-2025` — SHE CAN KICK IT! (photography, 2025, Europe) [high]
- `shes-the-man-2006` — She's the Man (film, 2006, North America) [high]
- `shoomilah-shoomilah-2017` — Shoomilah, Shoomilah (music, 2017, Middle East) [high]
- `soccer-south-of-the-umbilo-2010` — Soccer: South of the Umbilo (documentary, 2010, Africa) [high]
- `soccer-women-sexual-liberation-kicking-off-a-new-era-2004` — Soccer, Women, Sexual Liberation: Kicking Off a New Era (book, 2004, International) [high]
- `soccernomics-2009` — Soccernomics (book, 2009, Europe) [high]
- `soka-afrika-2011` — Soka Afrika (documentary, 2011, Africa) [high]
- `sunderland-vs-aston-villa-1895` — Sunderland vs. Aston Villa (artwork, 1895, Europe) [high]
- `take-us-home-leeds-united-2019` — Take Us Home: Leeds United (docuseries, 2019, Europe) [high]
- `the-african-game-2010` — The African Game (photography, 2010, Africa) [high]
- `the-african-giant-2025` — The African Giant (docuseries, 2025, Africa) [high]
- `the-away-game-2006` — The Away Game (documentary, 2006, Oceania) [high]
- `the-beautiful-game-2012` — The Beautiful Game (documentary, 2012, Africa) [high]
- `the-beautiful-game-reimagined-womens-soccer-in-brazil-2025` — The Beautiful Game Reimagined: Women's Soccer in Brazil (book, 2025, South America) [low]
- `the-champions-2003` — The Champions (artwork, 2003, Europe) [high]
- `the-corinthians-we-were-the-champions-2026` — The Corinthians: We Were the Champions (documentary, 2026, Europe) [low]
- `the-dick-kerrs-ladies-the-football-team-that-changed-the-world-2004` — The Dick, Kerr's Ladies: The Football Team that Changed the World (book, 2004, Europe) [high]
- `the-dirty-game-uncovering-the-scandal-at-fifa-2015` — The Dirty Game: Uncovering the Scandal at FIFA (book, 2015, Europe) [high]
- `the-football-men-up-close-with-the-giants-of-the-modern-game-2011` — The Football Men: Up Close with the Giants of the Modern Game (book, 2011, Europe) [high]
- `the-game-of-their-lives-2002` — The Game of Their Lives (documentary, 2002, Asia) [high]
- `the-homes-of-football-1996` — The Homes of Football (photography, 1996, Europe) [high]
- `the-lowry-2000` — The Lowry (museum, 2000, Europe) [high]
- `the-matilda-effect-2023` — The Matilda Effect (book, 2023, Oceania) [high]
- `the-other-final-2003` — The Other Final (documentary, 2003, International) [high]
- `the-splash-2004` — The Splash (artwork, 2004, Europe) [high]
- `the-story-of-the-2015-fifa-womens-world-cup-2015` — The Story of the 2015 FIFA Women's World Cup (documentary, 2015, North America) [low]
- `the-strange-death-of-womens-football-in-1921-2014` — The Strange Death of Women's Football in 1921 (book, 2014, Europe) [high]
- `the-turbulent-world-of-middle-east-soccer-2016` — The Turbulent World of Middle East Soccer (book, 2016, Middle East) [high]
- `thirty-one-nil-on-the-road-with-footballs-outsiders-2014` — Thirty-One Nil: On the Road with Football's Outsiders (book, 2014, Europe) [high]
- `this-is-football-belief-2019` — This Is Football: Belief (docuseries, 2019, Asia) [high]
- `tour-bernabeu-real-madrid-museum` — Tour Bernabéu / Real Madrid Museum (museum, —, Europe) [low]
- `trailblazers-2024` — Trailblazers (documentary, 2024, Oceania) [high]
- `trailblazers-exhibition-poster-2022` — Trailblazers Exhibition Poster (artwork, 2022, Europe) [high]
- `triste-solitario-y-final-1973` — Triste, solitario y final (book, 1973, South America) [high]
- `two-half-times-in-hell-1961` — Two Half-Times in Hell (film, 1961, Europe) [high]
- `ultras-a-way-of-life-2019` — Ultras: A Way of Life (photography, 2019, International) [high]
- `un-giorno-all-improvviso` — Un giorno all'improvviso (music, —, Europe) [low]
- `utae-urawa-wo-aisuru-nara-pippi` — Utae, Urawa wo Aisuru nara (Pippi) (music, —, Asia) [low]
- `valencia-cf-mestalla-tour-museum` — Valencia CF Mestalla Tour / Museum (museum, —, Europe) [low]
- `vamos-vamos-argentina-1978` — Vamos, vamos, Argentina (music, 1978, South America) [high]
- `we-are-diamonds-we-are-reds` — We are Diamonds / We are REDS (music, —, Asia) [low]
- `we-must-go-2014` — We Must Go (documentary, 2014, Africa) [high]
- `wembley-1923` — Wembley (artwork, 1923, Europe) [high]
- `what-do-women-footballers-want-2024` — What Do Women (Footballers) Want? (artwork, 2024, Europe) [high]
- `when-football-banned-women-2017` — When Football Banned Women (documentary, 2017, Europe) [low]
- `when-friday-comes-football-war-and-revolution-in-the-middle-2013` — When Friday Comes: Football, War and Revolution in the Middle East (book, 2013, Middle East) [high]
- `women-in-boots-football-and-feminism-in-the-1970s-2020` — Women in Boots: Football and Feminism in the 1970s (book, 2020, Oceania) [high]
- `women-play-football-not-womens-football-2024` — Women Play Football, Not Women's Football (photography, 2024, Europe) [low]
- `womens-football-in-africa-2024` — Women's Football in Africa (book, 2024, Africa) [high]
- `yasa-fenerbahce-1974` — Yaşa Fenerbahçe (music, 1974, Europe) [high]

---

## C. Low confidence within holding (40)

- `a-beautiful-game-international-perspectives-on-womens-football-2007` — A Beautiful Game: International Perspectives on Women's Football (book, 2007, International) [low]
- `ajax-museum-johan-cruyff-arena-experience` — Ajax Museum / Johan Cruyff Arena Experience (museum, —, Europe) [low]
- `all-roads-lead-down-under-2023` — All Roads Lead Down Under (docuseries, 2023, International) [low]
- `argentinos-juniors-museum-stadium-tour` — Argentinos Juniors Museum / Stadium Tour (museum, —, South America) [low]
- `belfast-celtic-museum` — Belfast Celtic Museum (museum, —, Europe) [low]
- `beyond-bend-it-like-beckham-the-global-phenomenon-of-womens-soccer-2012` — Beyond Bend It Like Beckham: The Global Phenomenon of Women's Soccer (book, 2012, International) [low]
- `bisang-2006` — Bisang (documentary, 2006, Asia) [low]
- `captains-2022` — Captains (docuseries, 2022, International) [low]
- `captains-of-the-world-2023` — Captains of the World (docuseries, 2023, International) [low]
- `carsi-her-seye-karsi` — Çarşı, her şeye karşı (music, —, Europe) [low]
- `chinese-ladies-playing-cuju-1490` — Chinese Ladies Playing Cuju (artwork, 1490, Asia) [low]
- `dogdugun-gunden-beri` — Doğduğun Günden Beri (music, —, Europe) [low]
- `es-un-sentimiento-no-puedo-parar` — Es un sentimiento, no puedo parar (music, —, South America) [low]
- `fc-bayern-museum` — FC Bayern Museum (museum, —, Europe) [low]
- `fc-st-pauli-museum` — FC St. Pauli Museum (museum, —, Europe) [low]
- `hamburger-sv-museum` — Hamburger SV Museum (museum, —, Europe) [low]
- `himno-del-athletic-club` — Himno del Athletic Club (music, —, Europe) [low]
- `himno-del-real-betis` — Himno del Real Betis (music, —, Europe) [low]
- `irish-fa-education-and-heritage-centre` — Irish FA Education and Heritage Centre (museum, —, Europe) [low]
- `juventus-museum` — Juventus Museum (museum, —, Europe) [low]
- `leuchte-auf-mein-stern-borussia` — Leuchte auf, mein Stern Borussia (music, —, Europe) [low]
- `liverpool-fc-museum` — Liverpool FC Museum (museum, —, Europe) [low]
- `mexico-86-2026` — Mexico 86 (documentary, 2026, North America) [low]
- `mondo-milan` — Mondo Milan (museum, —, Europe) [low]
- `museo-penarol` — Museo Peñarol (museum, —, South America) [low]
- `oh-ya-hilali` — Oh Ya Hilali (music, —, Middle East) [low]
- `parma-calcio-museum` — Parma Calcio Museum (museum, —, Europe) [low]
- `play-by-play-1984` — Play by Play (book, 1984, South America) [low]
- `queen-of-we-2025` — Queen of WE (documentary, 2025, Asia) [low]
- `san-siro-museum` — San Siro Museum (museum, —, Europe) [low]
- `the-beautiful-game-reimagined-womens-soccer-in-brazil-2025` — The Beautiful Game Reimagined: Women's Soccer in Brazil (book, 2025, South America) [low]
- `the-corinthians-we-were-the-champions-2026` — The Corinthians: We Were the Champions (documentary, 2026, Europe) [low]
- `the-story-of-the-2015-fifa-womens-world-cup-2015` — The Story of the 2015 FIFA Women's World Cup (documentary, 2015, North America) [low]
- `tour-bernabeu-real-madrid-museum` — Tour Bernabéu / Real Madrid Museum (museum, —, Europe) [low]
- `un-giorno-all-improvviso` — Un giorno all'improvviso (music, —, Europe) [low]
- `utae-urawa-wo-aisuru-nara-pippi` — Utae, Urawa wo Aisuru nara (Pippi) (music, —, Asia) [low]
- `valencia-cf-mestalla-tour-museum` — Valencia CF Mestalla Tour / Museum (museum, —, Europe) [low]
- `we-are-diamonds-we-are-reds` — We are Diamonds / We are REDS (music, —, Asia) [low]
- `when-football-banned-women-2017` — When Football Banned Women (documentary, 2017, Europe) [low]
- `women-play-football-not-womens-football-2024` — Women Play Football, Not Women's Football (photography, 2024, Europe) [low]

---

## D. Quarantine (35)

- An Inconvenient Truth — `off_scope_non_football_climate_or_human_rights`
- Before the Flood — `off_scope_non_football_climate_or_human_rights`
- Chasing Ice — `off_scope_non_football_climate_or_human_rights`
- Gasland — `off_scope_non_football_climate_or_human_rights`
- The Cove — `off_scope_non_football_climate_or_human_rights`
- I Am Greta — `off_scope_non_football_climate_or_human_rights`
- Freedom to Breathe — `off_scope_non_football_climate_or_human_rights`
- A Fierce Green Fire — `off_scope_non_football_climate_or_human_rights`
- There's Something in the Water — `off_scope_non_football_climate_or_human_rights`
- A Matter of Justice — `off_scope_non_football_climate_or_human_rights`
- In Whose Backyard? — `off_scope_non_football_climate_or_human_rights`
- Edge of Hope — `off_scope_non_football_climate_or_human_rights`
- I'm Not an Activist — `off_scope_non_football_climate_or_human_rights`
- Climate Change — `off_scope_non_football_climate_or_human_rights`
- Recycled Life — `off_scope_non_football_climate_or_human_rights`
- How to Blow Up a Pipeline — `off_scope_non_football_climate_or_human_rights`
- The 11th Hour — `off_scope_non_football_climate_or_human_rights`
- I Am Not Your Negro — `off_scope_non_football_climate_or_human_rights`
- The True Cost — `off_scope_non_football_climate_or_human_rights`
- The WHY Series: Human Rights Documentaries — `off_scope_non_football_climate_or_human_rights`
- I Am Not an Activist (Climate Anthology Short) — `off_scope_non_football_climate_or_human_rights`
- We the Fans — `american_football_not_association_football`
- Culture of Winning: Polynesian Football Pride — `american_football_not_association_football`
- The American Football Dream — `american_football_not_association_football`
- Ultras Ahlawy songbook — `category_not_a_discrete_work` · note: Ultras Ahlawy (Al Ahly, Egypt)
- Persepolis ultras songbook — `category_not_a_discrete_work` · note: Persepolis FC ultras (Tehran, Iran)
- Ultras White Knights songbook — `category_not_a_discrete_work` · note: Ultras White Knights (Zamalek, Egypt)
- Esteghlal ultras songbook — `category_not_a_discrete_work` · note: Esteghlal FC ultras (Tehran, Iran)
- ultrAslan / Cimbom terrace book — `category_not_a_discrete_work` · note: ultrAslan / Cimbom (Galatasaray, Turkey)
- Gaviões da Fiel samba repertoire — `category_not_a_discrete_work` · note: Gaviões da Fiel (Corinthians, Brazil)
- Panathinaikos Gate 13 repertoire — `category_not_a_discrete_work` · note: Gate 13 (Panathinaikos, Greece)
- PAOK Gate 4 repertoire — `category_not_a_discrete_work` · note: Gate 4 (PAOK Thessaloniki, Greece)
- Super Eagles fan anthems (tournament cycles) — `category_not_a_discrete_work` · note: Super Eagles fans / Nigeria national-team campaign songs
- Lions of Teranga fan soundtrack — `category_not_a_discrete_work` · note: Lions of Teranga fans (Senegal national team)
- You'll Never Walk Alone (Südtribüne practice) — `category_not_a_discrete_work` · note: Borussia Dortmund Südtribüne (YNWA adoption)
