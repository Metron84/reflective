# THE CREST: Club Database Research Brief

Version 1.1. Locked scoring codebook, matching logic and the Perplexity prompt used to build the club vectors.

Changes in 1.1: dimension labels rewritten as two pole names so direction cannot be misread, `exclusion_pair` replaced by `exclusion_clubs`, five provenance fields added, and a full matching logic section added. Dimension IDs H1 to S4 and all numeric scales are unchanged, so any data already collected stays valid.

---

## PART 1: THE CODEBOOK (LOCKED)

Twelve dimensions, four per pillar. Every dimension is scored 1 to 7 on the same scale for both people and clubs. Direction is fixed: 1 is always the left pole, 7 is always the right pole. Never reverse a scale.

### HEART

| ID | Dimension | 1 means | 7 means |
|---|---|---|---|
| H1 | Success to Suffering | Identity is built on winning and expects it | Identity is built on hardship, endurance and staying |
| H2 | Calm to Volatile | Calm, controlled, feels inevitable | Chaotic, dramatic, jeopardy in every match |
| H3 | Belonging to Distinction | Mass belonging, everyone around you gets it | Cult club, few people around you understand it |
| H4 | Glory to Journey | Trophies are the point of following | The ritual, the travel and the years are the point |

### MIND

| ID | Dimension | 1 means | 7 means |
|---|---|---|---|
| M1 | Results to Aesthetics | Win by any means, style is optional | Style is non-negotiable even at a cost |
| M2 | Control to Risk | Structure, systems, game management | Freedom, flair, accepted volatility |
| M3 | Acquisition to Development | Buys finished stars | Builds and trusts its own |
| M4 | Adaptability to Ideology | Approach changes with each manager or era | One recognisable philosophy across generations |

### SOUL

| ID | Dimension | 1 means | 7 means |
|---|---|---|---|
| S1 | Global to Local | Global super-brand, belongs to the world | Civic institution, belongs to a city or neighbourhood |
| S2 | Modernity to Heritage | Future facing, reinvents itself | Custodian of tradition, ritual and song |
| S3 | Establishment to Defiance | Power, standards, part of the establishment | Outsider, rebel, defined against the system |
| S4 | Entertainment to Meaning | Entertainment and release | Purpose, culture and identity beyond the result |

### Scoring rules

- Score the enduring identity across eras, never the current season, manager, owner or league position.
- 4 is a genuine neutral and should be used often; a club that is not distinctive on a dimension gets 4.
- No club may score above 6 or below 2 on more than five of the twelve dimensions.
- Every non-neutral score must carry one evidence sentence and one source URL.
- Every score carries a confidence value of 1 to 3, and low confidence scores are down-weighted at match time.

### Calibration anchors (do not change)

These three are pre-scored and must be included in every research batch so the scale stays consistent across runs.

| Club | H1 | H2 | H3 | H4 | M1 | M2 | M3 | M4 | S1 | S2 | S3 | S4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Real Madrid | 1 | 4 | 1 | 1 | 3 | 4 | 2 | 2 | 2 | 5 | 1 | 4 |
| Everton | 7 | 6 | 4 | 6 | 3 | 3 | 4 | 3 | 6 | 7 | 4 | 6 |
| St Pauli | 6 | 5 | 7 | 7 | 4 | 5 | 5 | 4 | 7 | 5 | 7 | 7 |

---

## PART 2: FIELDS REQUIRED PER CLUB

Beyond the twelve scores, each club record carries:

**Identity**
- Full name, common name, city, country, founding year, nickname, motto
- Ownership model: member owned, private, state linked, fan trust, listed
- One line on founding context and who the club was originally for

**Culture**
- Two to four supporter rituals, songs or matchday traditions with names
- Stadium name, capacity, and one line on its character
- Two defining historical narratives, chosen from glory, survival, tragedy, revival, resistance, reinvention
- Primary rivalry and what that rivalry reveals about the club's self image

**Football**
- Enduring football identity in one line, spanning eras rather than the current manager
- Academy reputation: strong, moderate, weak, with one supporting fact

**Fit and routing**
- Matched archetype from the list in Part 4
- Three clubs that are cultural near neighbours, for the alternative match slot
- Two clubs that are cultural opposites, for the admire from afar slot
- Exclusion clubs: every club that must never be recommended alongside this one, such as a derby rival or regional antagonist

**Practical, for the UAE audience**
- Typical kickoff window in Gulf Standard Time
- Whether an organised supporters club exists in the UAE, and its name if so
- Broadcast availability in the UAE

---

## PART 3: THE PERPLEXITY PROMPT

Run in batches of ten clubs. Paste the codebook tables from Part 1 above the prompt every time. Do not run all clubs in one pass.

```
You are a football culture researcher building a structured database of club identity.

I am giving you a locked twelve dimension codebook and three pre-scored calibration
clubs. Your job is to score the clubs I name on the same scale, with evidence.

RULES
1. Score enduring cultural identity across the club's whole history. Ignore the
   current season, the current manager, the current owner and the current league
   position entirely.
2. Use the full 1 to 7 range but treat 4 as a genuine neutral. If a club is not
   distinctive on a dimension, score it 4.
3. No club may score above 6 or below 2 on more than five of the twelve dimensions.
4. Every score that is not 4 needs one evidence sentence and one source URL. If you
   cannot source it, score it 4 and set confidence to 1.
5. Give every score a confidence value: 3 well documented, 2 reasonable inference,
   1 thin evidence.
6. Calibrate against the three anchor clubs I have pre-scored. If your score for a
   new club would sit above or below an anchor on a dimension, state why in the
   evidence sentence.
7. Do not use the words big, small, successful or working class as a justification.
8. Where a club's culture is contested between supporter groups, say so in a
   contested_notes field rather than picking one version.
9. Do not make political claims about a club unless the club or its recognised
   supporter groups have made them publicly, and cite that.
10. exclusion_clubs lists every club that must never appear alongside this one in a
    positive recommendation, including derby rivals, regional antagonists and any
    pairing that would read as careless to real supporters. It can hold more than two.
11. Leave vector_version as "1.1", research_status as "draft", last_reviewed and
    reviewed_by empty. Use source_quality_notes to record where the evidence is thin
    or one side of the club's culture is far better documented than another.

OUTPUT
Return valid JSON only. No preamble, no commentary, no markdown fences.
One object per club, in this exact shape:

{
  "club": "",
  "common_name": "",
  "city": "",
  "country": "",
  "founded": 0,
  "nickname": "",
  "motto": "",
  "ownership_model": "",
  "founding_context": "",
  "scores": {
    "H1": {"value": 0, "confidence": 0, "evidence": "", "source": ""},
    "H2": {"value": 0, "confidence": 0, "evidence": "", "source": ""},
    "H3": {"value": 0, "confidence": 0, "evidence": "", "source": ""},
    "H4": {"value": 0, "confidence": 0, "evidence": "", "source": ""},
    "M1": {"value": 0, "confidence": 0, "evidence": "", "source": ""},
    "M2": {"value": 0, "confidence": 0, "evidence": "", "source": ""},
    "M3": {"value": 0, "confidence": 0, "evidence": "", "source": ""},
    "M4": {"value": 0, "confidence": 0, "evidence": "", "source": ""},
    "S1": {"value": 0, "confidence": 0, "evidence": "", "source": ""},
    "S2": {"value": 0, "confidence": 0, "evidence": "", "source": ""},
    "S3": {"value": 0, "confidence": 0, "evidence": "", "source": ""},
    "S4": {"value": 0, "confidence": 0, "evidence": "", "source": ""}
  },
  "rituals": [{"name": "", "description": "", "source": ""}],
  "stadium": {"name": "", "capacity": 0, "character": ""},
  "narratives": [{"type": "", "summary": "", "source": ""}],
  "primary_rivalry": {"opponent": "", "what_it_reveals": ""},
  "football_identity": "",
  "academy_reputation": {"rating": "", "evidence": "", "source": ""},
  "archetype": "",
  "cultural_neighbours": ["", "", ""],
  "cultural_opposites": ["", ""],
  "exclusion_clubs": ["", ""],
  "uae": {
    "kickoff_window_gst": "",
    "supporters_club": "",
    "broadcast": ""
  },
  "contested_notes": "",
  "identity_summary": "",
  "vector_version": "1.1",
  "research_status": "draft",
  "last_reviewed": "",
  "reviewed_by": [],
  "source_quality_notes": ""
}

identity_summary is one sentence, maximum 25 words, written as if describing the
club to someone who has never followed football.

CLUBS IN THIS BATCH
[paste ten club names here]
```

---

## PART 4: ARCHETYPE LIST (LOCKED)

Each club is assigned exactly one. Users receive one too, derived from their own vector.

1. The Romantic Traditionalist
2. The Relentless Achiever
3. The Faithful Sufferer
4. The Tactical Idealist
5. The Community Guardian
6. The Rebel Supporter
7. The Academy Evangelist
8. The Global Dreamer
9. The Matchday Pilgrim
10. The Ambitious Builder
11. The Cult Club Seeker
12. The Standard Bearer

---

## PART 5: CLUB SET, 60 CLUBS IN SIX BATCHES

Superseded for scale and tiering by `docs/crest-club-set-expansion.md` (~60 Tier A deep clubs plus ~160 Tier B light clubs). The six-batch list below remains the Tier A target.

**Batch 1, England and Scotland majors**
Arsenal, Aston Villa, Chelsea, Liverpool, Manchester City, Manchester United, Newcastle United, Tottenham Hotspur, Celtic, Rangers

**Batch 2, England and Scotland identity clubs**
Everton, Leeds United, Nottingham Forest, Sunderland, West Ham United, Sheffield Wednesday, Portsmouth, Wrexham, Hibernian, Dundee United

**Batch 3, Spain, Portugal, Netherlands**
Real Madrid, Barcelona, Atletico Madrid, Athletic Club, Real Sociedad, Real Betis, Benfica, Porto, Ajax, Feyenoord

**Batch 4, Italy, Germany, France**
Juventus, Inter Milan, Milan, Roma, Napoli, Bayern Munich, Borussia Dortmund, St Pauli, Union Berlin, Marseille

**Batch 5, Arab world**
Al Ahly, Zamalek, Wydad Casablanca, Raja Casablanca, Esperance de Tunis, Al Hilal, Al Ittihad, Al Ain, Shabab Al Ahli, Al Wasl

**Batch 6, wider world and cult**
Paris Saint-Germain, Galatasaray, Fenerbahce, Besiktas, Boca Juniors, River Plate, Flamengo, Corinthians, Red Star Belgrade, Panathinaikos

---

## PART 6: MATCHING LOGIC

### Step 1, per dimension similarity

For user u, club c, dimension d:

`similarity = 1 - (|u_d - c_d| / 6)`

That returns 0 for opposite poles and 1 for an exact match.

### Step 2, the weight

Each dimension's weight is the product of three factors, not one.

`w_d = pillar_weight × variance_weight × confidence_factor`

- **pillar_weight** comes from the user's single pillar choice, taken after the quiz, not before.
- **variance_weight** is the standard deviation of that dimension across all 60 clubs, normalised so the mean weight is 1.
- **confidence_factor** is the club's own confidence on that dimension: 3 gives 1.00, 2 gives 0.80, 1 gives 0.60.

Variance weighting is the part most easily dropped and the part that matters most. A dimension where every club scores 5 carries no information, and without this term it still moves results.

### Step 3, raw fit

`raw_fit = sum(w_d × similarity_d) / sum(w_d)`

### Step 4, the displayed percentage

Never show raw_fit directly. Two arbitrary vectors on a 1 to 7 scale average around 0.80, so every user would see a top three of 88, 86 and 85 and stop trusting the number.

- Compute raw_fit for the user against all 60 clubs.
- Rank the results and scale the display value against that user's own distribution, so the top match sits near the top of the range and the tail falls away visibly.
- Show the percentage only for the top three, and never publish a number below 60.

### Step 5, pillar weights

One question, four options, asked after the twelve scored questions.

| User picks | Heart | Mind | Soul |
|---|---:|---:|---:|
| I follow with my gut | 50 | 25 | 25 |
| I love the ideas in football | 25 | 50 | 25 |
| I need to believe in the club | 25 | 25 | 50 |
| All three, equally | 34 | 33 | 33 |

Each pillar weight is divided evenly across its four dimensions.

### Step 6, routing rules

**Primary match.** The highest ranked club after all filters.

**Filters, applied in order.**
1. Remove any club the user already supports or has excluded by hand.
2. Remove every club listed in the primary match's `exclusion_clubs`.
3. Apply a diversification check, so the top three cannot all come from one cultural cluster or one city.

**Alternative matches.** The two highest ranked clubs that survive the filters and sit within a defined distance band of the primary match, rather than simply the next two on the list.

**Cultural neighbours.** Computed from club-to-club vector distance across the database, with the editorial `cultural_neighbours` field used only as a sanity check on the computed result.

**Admire from afar.** A club with a high Mind fit and a low Heart or Soul fit, presented as a respected mismatch rather than a recommendation.

**Red flag.** A club whose Soul scores sit at the opposite pole to the user's, presented with the reason stated plainly.

### Step 7, the output

The result leads with the archetype and the reasoning, never with the number.

Worked example:

> **The Matchday Pilgrim**
> You treat football as ritual rather than consumption. You want history, atmosphere and loyalty through bad years.
> Strongest fit: Everton. Near neighbours: Roma and Celtic.
> Admire from afar: Real Madrid, whose standards you respect and whose expectation of winning you would find airless.

Then the routing: a TRF film about that club's culture, the UAE supporters club if one exists, and the next fixture in a Dubai venue.

---

## PART 7: BUILD SEQUENCE

1. **Freeze the codebook.** Publish a one page researcher sheet giving the meaning of 1, 4 and 7 for all twelve dimensions.
2. **Build the three anchors as full records.** Real Madrid, Everton and St Pauli get complete evidence, rituals, narratives, rivalries and UAE data, not just scores.
3. **Run Batch 1.** Then stop and calibrate before anything else.
4. **Calibrate after every batch.** Check for clubs clustering suspiciously close to the anchors, and for any club carrying too many extreme scores.
5. **Complete all six batches.**
6. **Variance pass.** Compute the standard deviation of each dimension across the full 60 and set the variance weights.
7. **Clustering pass.** Find clubs sitting on top of each other in vector space, then either sharpen them with a second research pass or accept them as a declared cluster.
8. **Supporter validation in Dubai.** Two supporters per club review the identity summary, the vector, the rivalry handling and the culture claims, then `research_status` moves to validated.
9. **Only then write the questions.** Each maps one to one onto a locked dimension, or the front end will be beautiful and the routing will be wrong.
