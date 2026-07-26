#!/usr/bin/env node
/**
 * Generate SAMPLE Tier A club chapter 1 packs from entity indexes + composer templates.
 * Skips chapters that already exist. Does not invent persons.
 *
 * Run: node scripts/generate-stand-tier-a-chapters.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const STAND = path.join(ROOT, "data/stand");
const CHAPTERS = path.join(STAND, "chapters");
const SEED = path.join(ROOT, "data/players_seed.json");

const LANE_COMPOSER = {
  serie_a: "dante-alighieri",
  premier_league: "zadie-smith",
  la_liga: "cervantes",
  bundesliga: "goethe",
};

const LANE_FAMILY = {
  serie_a: "Circles of the Season",
  premier_league: "No Pure Shirt",
  la_liga: "Knight of the Wrong Score",
  bundesliga: "The Striving Ground",
};

const LANE_PREFIX = {
  serie_a: "sa",
  premier_league: "pl",
  la_liga: "ll",
  bundesliga: "bl",
};

function load(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function personName(seedById, id) {
  return seedById.get(id)?.name ?? id;
}

function pickPersons(club, seedById, n = 5) {
  const scored = club.person_ids
    .map((id) => {
      const rows = [...seedById.values()].filter((r) => r.person_id === id);
      const canonical = rows.some((r) => r.canonical);
      return { id, name: personName(seedById, id), canonical, rowCount: rows.length };
    })
    .sort((a, b) => Number(b.canonical) - Number(a.canonical) || b.rowCount - a.rowCount);
  return scored.slice(0, n);
}

function rivalFor(club, clubs) {
  const league = club.leagues[0];
  const peers = clubs
    .filter((c) => c.id !== club.id && c.leagues.includes(league) && c.stand_tier === "A")
    .sort((a, b) => b.person_count - a.person_count);
  return peers[0] ?? null;
}

function buildChapter(club, lane, persons, rival, nationHint) {
  const composer = LANE_COMPOSER[lane];
  const family = LANE_FAMILY[lane];
  const prefix = LANE_PREFIX[lane];
  const id = `${prefix}.${club.id}.ch01`;
  const short = club.short_name;
  const p = persons;
  const rivalName = rival?.short_name ?? "the rivals";
  const rivalId = rival?.id;

  const secondary = [
    ...p.map((x) => ({ type: "person", id: x.id })),
    ...(rivalId ? [{ type: "club", id: rivalId }] : []),
    ...(nationHint ? [{ type: "nation", id: nationHint }] : []),
  ];

  const sceneOpen =
    lane === "premier_league"
      ? `${short} Saturday. Two buses outside. Hybrid city air.`
      : lane === "la_liga"
        ? `${short} night. The dream was beautiful. The board may not agree.`
        : lane === "bundesliga"
          ? `Cold night at ${short}. Full terrace. A club as a project.`
          : `Away night. ${short} one down. Your end is still unfinished.`;

  const questions = [];

  const dayBeats = [
    // day 1
    [
      {
        scene: sceneOpen,
        prompt: "What do you do next?",
        choices: [
          { id: "A", label: "Keep the songs going. Noise is the point.", tags: ["loud", "loyal"] },
          { id: "B", label: "Hard silence. Let them feel the stare.", tags: ["patient", "intense"] },
          { id: "C", label: "One burst, then rebuild. Save the throat.", tags: ["patient", "tactical"] },
        ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene: `Rival noise finds ${short}. They want a reaction.`,
        prompt: "How do you answer?",
        choices: [
          { id: "A", label: "Louder. Same songs.", tags: ["loud", "loyal"] },
          { id: "B", label: "Turn as one. Make the pitch the stage.", tags: ["collective", "intense"] },
          { id: "C", label: "Point at the badge. Let the shirt answer.", tags: ["proud", "calm"] },
        ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene: `The night thins. Someone names a ${short} ghost.`,
        prompt: "Whose name do you reach for?",
        choices: [
          { id: "A", label: `${p[0]?.name ?? "A club legend"}. The first memory.`, tags: ["memory"] },
          { id: "B", label: `${p[1]?.name ?? "Another legend"}. The second memory.`, tags: ["memory"] },
          { id: "C", label: `${p[2]?.name ?? "A third name"}. The local thread.`, tags: ["memory", "local"] },
        ],
        refs: [
          { type: "club", id: club.id },
          ...p.slice(0, 3).map((x) => ({ type: "person", id: x.id })),
        ],
      },
      {
        scene:
          lane === "premier_league"
            ? `Family in one colour. Friends in another. ${short} in the middle.`
            : nationHint
              ? `International week brushes the calendar. Club shirt still on.`
              : `${rivalName} week talk drifts into the chat.`,
        prompt: "Where does loyalty sit?",
        choices:
          lane === "premier_league"
            ? [
                { id: "A", label: `${short} first. The shirt is the vote.`, tags: ["club", "loyal"] },
                { id: "B", label: "People first. Shirt second tonight.", tags: ["hybrid", "honest"] },
                { id: "C", label: "Both. No pure identity.", tags: ["hybrid", "proud"] },
              ]
            : [
                { id: "A", label: `${short} first. Ordinary days matter.`, tags: ["club", "loyal"] },
                { id: "B", label: "Nation or rival pressure first. Club waits.", tags: ["honest"] },
                { id: "C", label: "Both, without apology.", tags: ["hybrid", "honest"] },
              ],
        refs: [
          { type: "club", id: club.id },
          ...(nationHint ? [{ type: "nation", id: nationHint }] : []),
          ...(rivalId ? [{ type: "club", id: rivalId }] : []),
        ],
      },
      {
        scene: `Five questions. Name your ${short} Stand for this week.`,
        prompt: "Which line is closest?",
        choices: [
          { id: "A", label: "Loud when it hurts.", tags: ["loud", "loyal"] },
          { id: "B", label: "Quiet steel. Memory-led.", tags: ["patient", "memory"] },
          { id: "C", label: "Hybrid heart. No clean split.", tags: ["hybrid", "honest"] },
        ],
        refs: [{ type: "club", id: club.id }],
        cliffhanger: `Tomorrow: Part 2. ${short} continues. Exits, rivals, and the bar after.`,
      },
    ],
    // day 2
    [
      {
        scene: `SAMPLE. Next GST day. The result is history. The bar is not.`,
        prompt: "What do you defend first?",
        choices: [
          { id: "A", label: "The effort. They ran.", tags: ["effort", "loyal"] },
          { id: "B", label: "The idea of the team.", tags: ["romance", "identity"] },
          { id: "C", label: "The truth. Love is not silence.", tags: ["honest", "demanding"] },
        ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene: p[3]
          ? `Talk turns to ${p[3].name}. Careers move. Stands argue.`
          : `Talk turns to players who leave ${short}.`,
        prompt: "What is your Stand on exits?",
        choices: [
          { id: "A", label: "Thank the years. Wish them well.", tags: ["grace", "forward"] },
          { id: "B", label: "Cold in the other shirt. Warm for the tape.", tags: ["loyal", "hurt"] },
          { id: "C", label: "Judge the exit, not the person.", tags: ["honest", "hybrid"] },
        ],
        refs: [
          { type: "club", id: club.id },
          ...(p[3] ? [{ type: "person", id: p[3].id }] : []),
        ],
      },
      {
        scene: p[4]
          ? `A younger fan asks why ${p[4].name} still matters.`
          : `A younger fan asks why old names still matter.`,
        prompt: "What do you teach?",
        choices: [
          { id: "A", label: "Showing up is the badge.", tags: ["loyal", "local"] },
          { id: "B", label: "Captains carry weather.", tags: ["leadership", "memory"] },
          { id: "C", label: "Honour the past. Demand the present.", tags: ["honest", "forward"] },
        ],
        refs: [
          { type: "club", id: club.id },
          ...(p[4] ? [{ type: "person", id: p[4].id }] : []),
        ],
      },
      {
        scene: rivalId
          ? `${rivalName} talk. Old scars. Fresh noise.`
          : `Rival week energy without a single name.`,
        prompt: "How do you carry rivalry?",
        choices: [
          { id: "A", label: "Fuel. Keep it sharp.", tags: ["rival", "loud"] },
          { id: "B", label: "Quiet contempt. Save voice for us.", tags: ["rival", "patient"] },
          { id: "C", label: "Joke first. Steel second.", tags: ["rival", "calm"] },
        ],
        refs: [
          { type: "club", id: club.id },
          ...(rivalId ? [{ type: "club", id: rivalId }] : []),
        ],
      },
      {
        scene: `Day two closes. Second line for ${short}.`,
        prompt: "Pick the closer.",
        choices: [
          { id: "A", label: "Grace for leavers. Fire for stayers.", tags: ["grace", "loyal"] },
          { id: "B", label: "Truth in the bar. Noise in the end.", tags: ["honest", "loud"] },
          { id: "C", label: "Rivals outside. Memory inside.", tags: ["rival", "memory"] },
        ],
        refs: [{ type: "club", id: club.id }],
        cliffhanger: `Tomorrow: Part 3. Diaspora and the last name for your ${short} Stand.`,
      },
    ],
    // day 3
    [
      {
        scene: `SAMPLE. You are not at the ground. The stream is late. The chat is early.`,
        prompt: `How do you keep the ${short} Stand alive from away?`,
        choices: [
          { id: "A", label: "Full kit energy. Watch like the end.", tags: ["loud", "diaspora"] },
          { id: "B", label: "Quiet ritual. Same hour. Same scarf.", tags: ["patient", "diaspora"] },
          { id: "C", label: "Bring someone new into the chat.", tags: ["collective", "diaspora"] },
        ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene: `A clip of a ${short} season rolls through. Then another club. Careers are long.`,
        prompt: "What do you celebrate in those who passed through?",
        choices: [
          { id: "A", label: "The joy they left in the stand.", tags: ["grace", "memory"] },
          { id: "B", label: "Only the years they were truly ours.", tags: ["loyal", "boundary"] },
          { id: "C", label: "The whole arc. Chapters matter.", tags: ["honest", "forward"] },
        ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene:
          lane === "la_liga"
            ? `Style vs points. ${short} fans know the argument.`
            : lane === "bundesliga"
              ? `Project vs glory. ${short} as Bildung.`
              : `Someone asks what ${short} means when results thin.`,
        prompt: "Your answer?",
        choices:
          lane === "la_liga"
            ? [
                { id: "A", label: "Defend the dream.", tags: ["romance"] },
                { id: "B", label: "Demand the points.", tags: ["demanding"] },
                { id: "C", label: "Laugh and ride again.", tags: ["grace", "forward"] },
              ]
            : [
                { id: "A", label: "Identity first. Results follow.", tags: ["identity", "loyal"] },
                { id: "B", label: "Points first. Romance later.", tags: ["demanding"] },
                { id: "C", label: "Both. That is the craft.", tags: ["hybrid", "honest"] },
              ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene: `One more craft beat for ${short}.`,
        prompt: "What kind of hero do you honour most?",
        choices: [
          { id: "A", label: "The thunder. Moments that shake the ground.", tags: ["loud", "memory"] },
          { id: "B", label: "The metronome. The team breathes.", tags: ["patient", "memory"] },
          { id: "C", label: "The survivor. Weather without leaving.", tags: ["loyal", "local"] },
        ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene: `Chapter end. Name your ${short} Stand.`,
        prompt: "Who were you across these three days?",
        choices: [
          { id: "A", label: "The loud pilgrim. Noise as love.", tags: ["loud", "loyal", "chapter_end"] },
          { id: "B", label: "The memory keeper. Names as shelter.", tags: ["memory", "patient", "chapter_end"] },
          { id: "C", label: "The hybrid. No apology.", tags: ["hybrid", "honest", "chapter_end"] },
        ],
        refs: [{ type: "club", id: club.id }],
        cliffhanger: `Chapter complete. Share your Stand. Next ${short} chapter when commissioned.`,
      },
    ],
  ];

  let order = 1;
  for (let day = 1; day <= 3; day++) {
    for (const beat of dayBeats[day - 1]) {
      const q = {
        order,
        day,
        badge_lens: "club",
        scene: beat.scene,
        prompt: beat.prompt,
        choices: beat.choices,
        entity_refs: beat.refs,
      };
      if (beat.cliffhanger) q.cliffhanger = beat.cliffhanger;
      questions.push(q);
      order += 1;
    }
  }

  return {
    id,
    status: "sample",
    lane,
    composer_id: composer,
    family,
    primary_entity: { type: "club", id: club.id },
    secondary_entities: secondary,
    title: `${short}: Chapter One`,
    logline: `SAMPLE. Auto-generated Tier A pack for ${club.display_name}. Entity-bound to players_seed. Editorial pass pending.`,
    questions_per_day: 5,
    pack_persons_from_seed: p.map((x) => x.id),
    generated: true,
    questions,
    day_wall: {
      headline: "Part complete for today",
      body: `You used today's five questions. Your ${short} chapter continues tomorrow at midnight GST.`,
      resume_copy: `Tomorrow: pick up at the next question. ${short} waits.`,
    },
    signup: {
      headline: "Save your Stand",
      body: "Sign up free to keep this chapter, your badges, and your place in the queue. Anonymous progress resets.",
      cta_primary: "Sign up free",
      cta_secondary: "Maybe later",
    },
    share_template: `The Stand · ${short} · Chapter One\nDay {day}/3 · "{stand_line}"\nthereflectivefootball.com/stand`,
    next_paths: [
      "Continue tomorrow (saved if signed in)",
      "Play The Guesser",
      "Watch a TRF film",
    ],
  };
}

function nationHintForLeague(lane) {
  if (lane === "serie_a") return "nation-italy";
  if (lane === "premier_league") return "nation-england";
  if (lane === "la_liga") return "nation-spain";
  if (lane === "bundesliga") return "nation-germany";
  return null;
}

function main() {
  const clubs = load(path.join(STAND, "clubs.json"));
  const seed = load(SEED);
  const seedByPerson = new Map();
  for (const row of seed.players) {
    if (!seedByPerson.has(row.person_id)) seedByPerson.set(row.person_id, row);
  }
  // also map for name lookup from any row
  const seedRowsByPerson = new Map();
  for (const row of seed.players) {
    if (!seedRowsByPerson.has(row.person_id)) seedRowsByPerson.set(row.person_id, []);
    seedRowsByPerson.get(row.person_id).push(row);
  }
  const nameById = new Map(
    [...seedRowsByPerson.entries()].map(([id, rows]) => [id, rows[0].name]),
  );

  fs.mkdirSync(CHAPTERS, { recursive: true });
  let written = 0;
  let skipped = 0;

  for (const lane of Object.keys(LANE_COMPOSER)) {
    const tierA = clubs.filter((c) => c.leagues.includes(lane) && c.stand_tier === "A");
    for (const club of tierA) {
      const chapterId = `${LANE_PREFIX[lane]}.${club.id}.ch01`;
      const outPath = path.join(CHAPTERS, `${chapterId}.json`);
      // Never overwrite hand-authored packs (generated: false or missing flag with editorial logline).
      if (fs.existsSync(outPath)) {
        const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
        if (existing.generated === false || existing.generated == null) {
          skipped += 1;
          continue;
        }
        // Regenerating SAMPLE auto packs is allowed only with --force
        if (!process.argv.includes("--force")) {
          skipped += 1;
          continue;
        }
      }
      const persons = pickPersons(
        club,
        new Map(
          club.person_ids.map((id) => [
            id,
            { person_id: id, name: nameById.get(id), canonical: seedRowsByPerson.get(id)?.some((r) => r.canonical), rowCount: seedRowsByPerson.get(id)?.length ?? 0 },
          ]),
        ),
        5,
      );
      // fix pickPersons - I overcomplicated. Simpler:
      const simplePersons = club.person_ids
        .map((id) => ({
          id,
          name: nameById.get(id) ?? id,
          canonical: seedRowsByPerson.get(id)?.some((r) => r.canonical) ?? false,
          rowCount: seedRowsByPerson.get(id)?.length ?? 0,
        }))
        .sort((a, b) => Number(b.canonical) - Number(a.canonical) || b.rowCount - a.rowCount)
        .slice(0, 5);

      const rival = rivalFor(club, clubs);
      const chapter = buildChapter(
        club,
        lane,
        simplePersons,
        rival,
        nationHintForLeague(lane),
      );
      fs.writeFileSync(outPath, JSON.stringify(chapter, null, 2));
      written += 1;
      console.log(`wrote ${chapterId}`);
    }
  }

  console.log(`\nDone. Written ${written}, skipped existing ${skipped}`);
}

main();
