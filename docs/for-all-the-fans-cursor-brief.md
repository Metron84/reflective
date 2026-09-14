# For All The Fans — Cursor Build Brief
Route: `/for-all-the-fans` · thereflectivefootball.com · Build mobile-first, then desktop

---

## 0. Rules for the whole build

- The page is written **about** service staff, never **at** them.
- Three readers land here: service staff, venue operators, supporters clubs.
- One action only: **Interested**, which routes into the standard TRF signup.
- No separate form, no application, no eligibility questions, no seat counter.
- No words: charity, donation, beneficiary, deserving, hardship, underprivileged, low income, selection.
- Use words: night, room, seat, guest, supporter, invitation, venue.
- Brand tokens only: cream `#F2EDE4`, navy `#0A111F`, signal red `#D8232A`.
- Type: Bodoni Moda for display, Archivo for UI and body.
- Present tense throughout, no em-dashes in any copy string.

---

## 1. Page setup

**Route:** `/for-all-the-fans`
**Title:** For All The Fans | The Reflective Football
**Meta description:** One night a month, the room goes to the people who work every matchday. Register your interest with The Reflective Football.
**OG image:** reuse the TRF card template, navy background, cream wordmark, headline set in Bodoni Moda.

Page background cream, body text navy, signal red reserved for the primary button and the eyebrow rule only.

---

## 2. Hero

Full-width, cream background, no image behind text on mobile.

**Eyebrow**
FOR ALL THE FANS

**Headline**
One night a month, the room goes to them.

**Sub**
Every matchday in Dubai, a room fills with fans. The people who pour the drinks, park the cars, carry the plates and keep the doors never sit down. For All The Fans gives them the room.

**Primary button**
Interested

**Micro-line under button**
Free. One click. We tell you when the first night is set.

**Layout**
- Mobile: eyebrow, headline, sub, button, micro-line, then image below.
- Desktop: 55/45 split, copy left, image right, button sits in the left column.
- Headline clamp: `clamp(2.25rem, 6vw, 4.5rem)`, Bodoni Moda, line-height 1.05.

**Image**
Documentary, eye-level, a real supporters table mid-match. No uniforms as the identifying device, no lone downcast subject, no staged handover.

---

## 3. The idea

**Section heading**
The room nobody looks at.

**Body**
A matchday only works because people are working through it. They hear the goal go in from the corridor. They watch the room celebrate and then clear the glasses. They are supporters too, and they almost never get to be one.

For All The Fans takes one night a month and hands that room over. Same venue, same screens, same tables, same menu. The night is filmed and published as an episode that week.

**Layout:** single column, max-width 62ch, generous leading, no cards or icons.

---

## 4. How a night works

Three steps, numbered `01 02 03`, no icons, thin navy rules between.

**01 A venue gives the room.**
A partner venue opens for one night, with the screens on and the kitchen running.

**02 A supporters club brings the atmosphere.**
A club fills the seats alongside the guests, so it feels like a matchday, not an event.

**03 We film it and publish it.**
The night becomes an episode on The Reflective Football that same week.

**Layout:** stacked on mobile, three columns on desktop, numbers in Bodoni Moda at 2rem in signal red.

---

## 5. Who this is for

**Section heading**
Three ways in.

Three blocks, equal weight, plain text, no cards.

**If you work matchdays**
Hospitality, security, drivers, delivery riders, retail and venue teams across Dubai. You do not need to explain anything or prove how much you love football. Register your interest and we tell you when a night is set.

**If you run a venue**
You have the room, the screens and the night that is quietest on your calendar. We bring the film crew, the audience and the episode.

**If you run a supporters club**
Your members already turn up for every kickoff. This is the night they turn up for someone else.

**Secondary button under the block**
Interested

---

## 6. The promise

**Section heading**
How guests are treated.

- As supporters and guests, not as a story.
- Same room, same view, same hospitality as every other table.
- Full details of the night before anyone commits to attending.
- A separate and clearly explained choice about appearing on camera.
- No speeches, no labels, no questions about anyone's circumstances.

**Layout:** one line per item, thin navy rule between each, no bullets or checkmarks.

---

## 7. Closing invitation

**Headline**
One game. One room. Everyone gets a seat.

**Sub**
Nothing is scheduled yet. Register your interest and you hear first when Night 01 is set.

**Primary button**
Interested

Cream background, navy headline, button in signal red, full-width on mobile.

---

## 8. The Interested flow

This is the only interactive element on the page. Build it as three states in one component, no page navigation on mobile.

**State A — logged out**
- Button label: Interested
- Click opens the existing TRF signup, with `?intent=fatf` appended.
- After signup completes, return to `/for-all-the-fans` and render State C.

**State B — logged in, not yet registered**
- Button label: Interested
- Click writes the interest flag directly, no signup step, no page reload.
- Show an inline spinner on the button, never a full-page loader.

**State C — registered**
- Replace the button in place with the reveal block in section 9.
- Move keyboard focus to the reveal heading.
- Persist the state, so a returning member sees State C on load, not the button.

**Error copy**
- Network failure: We could not save that just now. Please try again.
- Already registered: You are already on the list for this one.

---

## 9. The reveal

Replaces the button in place, cream card on navy rule, no modal.

**Heading**
Your interest is registered.

**Body**
Thank you. When the first For All The Fans night is set, we email you before anyone else. There is nothing else you need to do.

**Optional question, below a thin rule**
One thing, if you have a second.

Which one are you?
- I work matchdays
- I run a venue
- I run a supporters club
- I am a fan

Three-up on desktop, stacked on mobile, styled as text buttons not radio inputs.

**Skip affordance**
Text link: Skip this

Selecting an option saves silently and swaps the question for: Got it, thank you.

---

## 10. Data and consent

**Fields written on interest**
- `fatf_interest` boolean
- `fatf_interest_at` timestamp
- `fatf_role` enum, nullable, from section 9
- `consent_wording_version` string
- `signup_source` string, value `for-all-the-fans`

**Consent line at the signup step**
I agree that The Reflective Football can email me about For All The Fans nights. I can ask to be removed at any time.

- Do not bundle newsletter consent into this line, keep it as a separate optional checkbox.
- Registering interest is not consent to be filmed, and no copy on this page may imply otherwise.
- Restrict signup to 18 and over until a safeguarding process exists.

**Events**
`fatf_page_view`, `fatf_interest_click`, `fatf_interest_complete`, `fatf_role_selected`, `fatf_role_skipped`

---

## 11. Footer

Standard TRF footer, plus a direct link to the privacy notice from the consent line.

**Blocker:** the privacy page is currently a placeholder. Publish the full notice before this page goes live, covering who controls the data, why it is collected, how long it is kept, who else receives it, and how to withdraw consent.

---

## 12. Build order

1. Route, meta, and page shell with brand tokens.
2. Hero, mobile layout only, with a dead button.
3. Sections 3 to 7 as static copy, mobile.
4. Desktop breakpoints for all static sections.
5. Interested component, states A, B and C.
6. Reveal block and the optional role question.
7. Data fields, consent wording, and event tracking.
8. Privacy notice published, then launch.

**QA before launch**
- A first-time visitor can tell in ten seconds what the night is, that it is free, and what happens after clicking.
- No line on the page reads as pity, assessment or charity.
- Test on low-cost Android as well as iPhone and desktop.
- Button is at least 48px tall and full-width on mobile.
- All copy strings checked for em-dashes.
