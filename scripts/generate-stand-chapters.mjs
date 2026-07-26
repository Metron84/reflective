#!/usr/bin/env node
/**
 * Generate SAMPLE Stand chapters for all seeded leagues.
 * - Club tiers A/B/C (D skipped until DB grows)
 * - Tier A: ch01–ch03 · Tier B/C: ch01
 * - Nation packs for tiers A/B
 * - Skips hand-authored (generated === false) unless --force-auto
 *
 * Run: node scripts/generate-stand-chapters.mjs
 *      node scripts/generate-stand-chapters.mjs --force-auto
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const STAND = path.join(ROOT, "data/stand");
const CHAPTERS = path.join(STAND, "chapters");
const SEED = path.join(ROOT, "data/players_seed.json");
const FORCE_AUTO = process.argv.includes("--force-auto");

const LANE_META = {
  serie_a: {
    composer: "dante-alighieri",
    family: "Circles of the Season",
    prefix: "sa",
    nation: "nation-italy",
  },
  premier_league: {
    composer: "zadie-smith",
    family: "No Pure Shirt",
    prefix: "pl",
    nation: "nation-england",
  },
  la_liga: {
    composer: "cervantes",
    family: "Knight of the Wrong Score",
    prefix: "ll",
    nation: "nation-spain",
  },
  bundesliga: {
    composer: "goethe",
    family: "The Striving Ground",
    prefix: "bl",
    nation: "nation-germany",
  },
  ligue_1: {
    composer: "albert-camus",
    family: "The Honest Crowd",
    prefix: "l1",
    nation: "nation-france",
  },
};

const CHAPTER_TITLES = {
  1: "Chapter One",
  2: "Chapter Two",
  3: "Chapter Three",
};

function load(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function shouldSkip(outPath) {
  if (!fs.existsSync(outPath)) return false;
  const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
  if (existing.generated === false) return true;
  if (!FORCE_AUTO) return true;
  return false;
}

function rivalFor(club, clubs) {
  const league = club.leagues[0];
  const peers = clubs
    .filter(
      (c) =>
        c.id !== club.id &&
        c.leagues.includes(league) &&
        (c.stand_tier === "A" || c.stand_tier === "B"),
    )
    .sort((a, b) => b.person_count - a.person_count);
  return peers[0] ?? null;
}

function pickPersons(club, nameById, rowsByPerson, n = 5) {
  return club.person_ids
    .map((id) => ({
      id,
      name: nameById.get(id) ?? id,
      canonical: rowsByPerson.get(id)?.some((r) => r.canonical) ?? false,
      rowCount: rowsByPerson.get(id)?.length ?? 0,
    }))
    .sort(
      (a, b) =>
        Number(b.canonical) - Number(a.canonical) || b.rowCount - a.rowCount,
    )
    .slice(0, n);
}

function clubOpenScene(lane, short, chapterNum) {
  const variants = {
    serie_a: [
      `Away night. ${short} one down. Your end is still unfinished.`,
      `Home night. ${short} chasing the game. Rain on the curva.`,
      `Derby week air. ${short} colours everywhere. The season turns a corner.`,
    ],
    premier_league: [
      `${short} Saturday. Two buses outside. Hybrid city air.`,
      `Midweek floodlights. ${short} need a result. The stand arrives early.`,
      `Sunday lunch kickoff. ${short} in the blood and the group chat.`,
    ],
    la_liga: [
      `${short} night. The dream was beautiful. The board may not agree.`,
      `Late kickoff. ${short} hunting a goal. Romance under pressure.`,
      `Sunday heat. ${short} ask for patience and points together.`,
    ],
    bundesliga: [
      `Cold night at ${short}. Full terrace. A club as a project.`,
      `Grey afternoon. ${short} working the ball. Industry and hope.`,
      `European itch week. ${short} between local love and bigger stages.`,
    ],
    ligue_1: [
      `${short} night. Honest crowd. The result will be what it is.`,
      `Provincial pride. ${short} against the noise from elsewhere.`,
      `Clear sky, hard pitch. ${short} ask only that you show up true.`,
    ],
  };
  return (variants[lane] || variants.serie_a)[chapterNum - 1];
}

function buildClubChapter(club, lane, chapterNum, persons, rival, nationId) {
  const meta = LANE_META[lane];
  const short = club.short_name;
  const id = `${meta.prefix}.${club.id}.ch${String(chapterNum).padStart(2, "0")}`;
  const rivalName = rival?.short_name ?? "the rivals";
  const rivalId = rival?.id;
  const p = persons;

  const secondary = [
    ...p.map((x) => ({ type: "person", id: x.id })),
    ...(rivalId ? [{ type: "club", id: rivalId }] : []),
    ...(nationId ? [{ type: "nation", id: nationId }] : []),
  ];

  const dayThemes = [
    // day 1 themes by chapter
    {
      1: "match body",
      2: "after the thin night",
      3: "season hinge",
    },
  ];

  void dayThemes;

  const dayBeats = [
    [
      {
        scene: clubOpenScene(lane, short, chapterNum),
        prompt: "What do you do next?",
        choices: [
          {
            id: "A",
            label: "Keep the songs going. Noise is the point.",
            tags: ["loud", "loyal"],
          },
          {
            id: "B",
            label: "Hard silence. Let them feel the stare.",
            tags: ["patient", "intense"],
          },
          {
            id: "C",
            label: "One burst, then rebuild. Save the throat.",
            tags: ["patient", "tactical"],
          },
        ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene:
          chapterNum === 2
            ? `The week after still smells of the result. ${short} fans argue in kindness.`
            : chapterNum === 3
              ? `Big week. ${short} need bodies and belief in the same hour.`
              : `Rival noise finds ${short}. They want a reaction.`,
        prompt: "How do you answer?",
        choices: [
          { id: "A", label: "Louder. Same songs.", tags: ["loud", "loyal"] },
          {
            id: "B",
            label: "Turn as one. Make the pitch the stage.",
            tags: ["collective", "intense"],
          },
          {
            id: "C",
            label: "Point at the badge. Let the shirt answer.",
            tags: ["proud", "calm"],
          },
        ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene: `The night thins. Someone names a ${short} ghost.`,
        prompt: "Whose name do you reach for?",
        choices: [
          {
            id: "A",
            label: `${p[0]?.name ?? "A club legend"}. The first memory.`,
            tags: ["memory"],
          },
          {
            id: "B",
            label: `${p[1]?.name ?? "Another legend"}. The second memory.`,
            tags: ["memory"],
          },
          {
            id: "C",
            label: `${p[2]?.name ?? "A third name"}. The local thread.`,
            tags: ["memory", "local"],
          },
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
            : lane === "ligue_1"
              ? `Paris noise and provincial truth. ${short} sit somewhere between.`
              : nationId
                ? `International week brushes the calendar. Club shirt still on.`
                : `${rivalName} week talk drifts into the chat.`,
        prompt: "Where does loyalty sit?",
        choices:
          lane === "premier_league"
            ? [
                {
                  id: "A",
                  label: `${short} first. The shirt is the vote.`,
                  tags: ["club", "loyal"],
                },
                {
                  id: "B",
                  label: "People first. Shirt second tonight.",
                  tags: ["hybrid", "honest"],
                },
                {
                  id: "C",
                  label: "Both. No pure identity.",
                  tags: ["hybrid", "proud"],
                },
              ]
            : [
                {
                  id: "A",
                  label: `${short} first. Ordinary days matter.`,
                  tags: ["club", "loyal"],
                },
                {
                  id: "B",
                  label: "Nation or rival pressure first. Club waits.",
                  tags: ["honest"],
                },
                {
                  id: "C",
                  label: "Both, without apology.",
                  tags: ["hybrid", "honest"],
                },
              ],
        refs: [
          { type: "club", id: club.id },
          ...(nationId ? [{ type: "nation", id: nationId }] : []),
          ...(rivalId ? [{ type: "club", id: rivalId }] : []),
        ],
      },
      {
        scene: `Five questions. Name your ${short} Stand for this week.`,
        prompt: "Which line is closest?",
        choices: [
          { id: "A", label: "Loud when it hurts.", tags: ["loud", "loyal"] },
          {
            id: "B",
            label: "Quiet steel. Memory-led.",
            tags: ["patient", "memory"],
          },
          {
            id: "C",
            label: "Hybrid heart. No clean split.",
            tags: ["hybrid", "honest"],
          },
        ],
        refs: [{ type: "club", id: club.id }],
        cliffhanger: `Tomorrow: Part 2. ${short} continues.`,
      },
    ],
    [
      {
        scene: `SAMPLE. Next GST day. The result is history. The bar is not.`,
        prompt: "What do you defend first?",
        choices: [
          { id: "A", label: "The effort. They ran.", tags: ["effort", "loyal"] },
          {
            id: "B",
            label: "The idea of the team.",
            tags: ["romance", "identity"],
          },
          {
            id: "C",
            label: "The truth. Love is not silence.",
            tags: ["honest", "demanding"],
          },
        ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene: p[3]
          ? `Talk turns to ${p[3].name}. Careers move. Stands argue.`
          : `Talk turns to players who leave ${short}.`,
        prompt: "What is your Stand on exits?",
        choices: [
          {
            id: "A",
            label: "Thank the years. Wish them well.",
            tags: ["grace", "forward"],
          },
          {
            id: "B",
            label: "Cold in the other shirt. Warm for the tape.",
            tags: ["loyal", "hurt"],
          },
          {
            id: "C",
            label: "Judge the exit, not the person.",
            tags: ["honest", "hybrid"],
          },
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
          {
            id: "A",
            label: "Showing up is the badge.",
            tags: ["loyal", "local"],
          },
          {
            id: "B",
            label: "Captains carry weather.",
            tags: ["leadership", "memory"],
          },
          {
            id: "C",
            label: "Honour the past. Demand the present.",
            tags: ["honest", "forward"],
          },
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
          {
            id: "B",
            label: "Quiet contempt. Save voice for us.",
            tags: ["rival", "patient"],
          },
          {
            id: "C",
            label: "Joke first. Steel second.",
            tags: ["rival", "calm"],
          },
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
          {
            id: "A",
            label: "Grace for leavers. Fire for stayers.",
            tags: ["grace", "loyal"],
          },
          {
            id: "B",
            label: "Truth in the bar. Noise in the end.",
            tags: ["honest", "loud"],
          },
          {
            id: "C",
            label: "Rivals outside. Memory inside.",
            tags: ["rival", "memory"],
          },
        ],
        refs: [{ type: "club", id: club.id }],
        cliffhanger: `Tomorrow: Part 3. Diaspora and the last name for your ${short} Stand.`,
      },
    ],
    [
      {
        scene: `SAMPLE. You are not at the ground. The stream is late. The chat is early.`,
        prompt: `How do you keep the ${short} Stand alive from away?`,
        choices: [
          {
            id: "A",
            label: "Full kit energy. Watch like the end.",
            tags: ["loud", "diaspora"],
          },
          {
            id: "B",
            label: "Quiet ritual. Same hour. Same scarf.",
            tags: ["patient", "diaspora"],
          },
          {
            id: "C",
            label: "Bring someone new into the chat.",
            tags: ["collective", "diaspora"],
          },
        ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene: `A clip of a ${short} season rolls through. Then another club. Careers are long.`,
        prompt: "What do you celebrate in those who passed through?",
        choices: [
          {
            id: "A",
            label: "The joy they left in the stand.",
            tags: ["grace", "memory"],
          },
          {
            id: "B",
            label: "Only the years they were truly ours.",
            tags: ["loyal", "boundary"],
          },
          {
            id: "C",
            label: "The whole arc. Chapters matter.",
            tags: ["honest", "forward"],
          },
        ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene:
          lane === "la_liga"
            ? `Style vs points. ${short} fans know the argument.`
            : lane === "bundesliga"
              ? `Project vs glory. ${short} as Bildung.`
              : lane === "ligue_1"
                ? `Honesty vs theatre. ${short} choose a posture.`
                : `Someone asks what ${short} means when results thin.`,
        prompt: "Your answer?",
        choices:
          lane === "la_liga"
            ? [
                { id: "A", label: "Defend the dream.", tags: ["romance"] },
                { id: "B", label: "Demand the points.", tags: ["demanding"] },
                {
                  id: "C",
                  label: "Laugh and ride again.",
                  tags: ["grace", "forward"],
                },
              ]
            : [
                {
                  id: "A",
                  label: "Identity first. Results follow.",
                  tags: ["identity", "loyal"],
                },
                {
                  id: "B",
                  label: "Points first. Romance later.",
                  tags: ["demanding"],
                },
                {
                  id: "C",
                  label: "Both. That is the craft.",
                  tags: ["hybrid", "honest"],
                },
              ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene: `One more craft beat for ${short}.`,
        prompt: "What kind of hero do you honour most?",
        choices: [
          {
            id: "A",
            label: "The thunder. Moments that shake the ground.",
            tags: ["loud", "memory"],
          },
          {
            id: "B",
            label: "The metronome. The team breathes.",
            tags: ["patient", "memory"],
          },
          {
            id: "C",
            label: "The survivor. Weather without leaving.",
            tags: ["loyal", "local"],
          },
        ],
        refs: [{ type: "club", id: club.id }],
      },
      {
        scene: `Chapter end. Name your ${short} Stand.`,
        prompt: "Who were you across these three days?",
        choices: [
          {
            id: "A",
            label: "The loud pilgrim. Noise as love.",
            tags: ["loud", "loyal", "chapter_end"],
          },
          {
            id: "B",
            label: "The memory keeper. Names as shelter.",
            tags: ["memory", "patient", "chapter_end"],
          },
          {
            id: "C",
            label: "The hybrid. No apology.",
            tags: ["hybrid", "honest", "chapter_end"],
          },
        ],
        refs: [{ type: "club", id: club.id }],
        cliffhanger:
          chapterNum < 3
            ? `Chapter complete. Next: ${short} ${CHAPTER_TITLES[chapterNum + 1]} when you continue.`
            : `Arc complete for now. Share your Stand. More ${short} packs when commissioned.`,
      },
    ],
  ];

  const questions = [];
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
    composer_id: meta.composer,
    family: meta.family,
    primary_entity: { type: "club", id: club.id },
    secondary_entities: secondary,
    title: `${short}: ${CHAPTER_TITLES[chapterNum]}`,
    logline: `SAMPLE. Auto-generated ${club.display_name} ${CHAPTER_TITLES[chapterNum]}. Entity-bound to players_seed. Editorial pass pending.`,
    questions_per_day: 5,
    pack_persons_from_seed: p.map((x) => x.id),
    generated: true,
    chapter_number: chapterNum,
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
    share_template: `The Stand · ${short} · ${CHAPTER_TITLES[chapterNum]}\nDay {day}/3 · "{stand_line}"\nthereflectivefootball.com/stand`,
    next_paths: [
      "Continue tomorrow (saved if signed in)",
      "Play The Guesser",
      "Watch a TRF film",
    ],
  };
}

function nationPersons(nation, nameById, rowsByPerson, n = 6) {
  return nation.person_ids
    .map((id) => ({
      id,
      name: nameById.get(id) ?? id,
      canonical: rowsByPerson.get(id)?.some((r) => r.canonical) ?? false,
      rowCount: rowsByPerson.get(id)?.length ?? 0,
      worldCup: rowsByPerson.get(id)?.some((r) => r.category === "world_cup"),
    }))
    .sort(
      (a, b) =>
        Number(b.worldCup) - Number(a.worldCup) ||
        Number(b.canonical) - Number(a.canonical) ||
        b.rowCount - a.rowCount,
    )
    .slice(0, n);
}

function buildNationChapter(nation, persons) {
  const slug = nation.id.replace(/^nation-/, "");
  const id = `na.${slug}.ch01`;
  const name = nation.display_name;
  const p = persons;

  const questions = [];
  const beats = [
    [
      {
        scene: `Tournament night. ${name} flags in a foreign square. The anthem starts.`,
        prompt: "How do you stand?",
        choices: [
          { id: "A", label: "Sing full. Memory as volume.", tags: ["loud", "nation"] },
          {
            id: "B",
            label: "Quiet hand on heart. Belonging without theatre.",
            tags: ["patient", "nation"],
          },
          {
            id: "C",
            label: "Watch the faces first. Then join when it feels true.",
            tags: ["honest", "nation"],
          },
        ],
      },
      {
        scene: `Someone near you only knows ${name} through clubs. Someone else only through tournaments.`,
        prompt: `Which ${name} do you carry into the night?`,
        choices: [
          {
            id: "A",
            label: "The tournament nation. Flags and one summer at a time.",
            tags: ["tournament", "nation"],
          },
          {
            id: "B",
            label: "The club nation. Weekend blood first.",
            tags: ["club", "nation"],
          },
          {
            id: "C",
            label: "Both. Different ships. Same fleet.",
            tags: ["hybrid", "nation"],
          },
        ],
      },
      {
        scene: `The square needs a name to warm the cold wait.`,
        prompt: "Whose name do you give them?",
        choices: [
          {
            id: "A",
            label: `${p[0]?.name ?? "A legend"}. The first ship.`,
            tags: ["memory"],
          },
          {
            id: "B",
            label: `${p[1]?.name ?? "Another legend"}. The second ship.`,
            tags: ["memory"],
          },
          {
            id: "C",
            label: `${p[2]?.name ?? "A third name"}. The quiet craft.`,
            tags: ["memory"],
          },
        ],
        refs: p.slice(0, 3).map((x) => ({ type: "person", id: x.id })),
      },
      {
        scene: `Club colours sit under the jacket. Nation colours above.`,
        prompt: "If they clash this week, who speaks first?",
        choices: [
          {
            id: "A",
            label: `${name} first. Nation nights rewrite the calendar.`,
            tags: ["nation", "duty"],
          },
          {
            id: "B",
            label: "Club first. The ordinary love does not pause.",
            tags: ["club", "loyal"],
          },
          {
            id: "C",
            label: "I refuse the clash. Two loves. No ranking tonight.",
            tags: ["hybrid", "honest"],
          },
        ],
      },
      {
        scene: `Day one ends. Name your ${name} Stand for this week.`,
        prompt: "Which line is closest?",
        choices: [
          {
            id: "A",
            label: "Loud in the square. Soft in the memory.",
            tags: ["loud", "memory"],
          },
          {
            id: "B",
            label: "Quiet belonging. Deep fleet.",
            tags: ["patient", "nation"],
          },
          {
            id: "C",
            label: "Club and country. No clean split.",
            tags: ["hybrid", "honest"],
          },
        ],
        cliffhanger: `Tomorrow: Part 2. The catalogue of ${name} continues.`,
      },
    ],
    [
      {
        scene: `SAMPLE. Next GST day. A clip of ${p[3]?.name ?? "a national icon"} circles the chat.`,
        prompt: "What do you honour first?",
        choices: [
          {
            id: "A",
            label: "The craft. Seeing the game early.",
            tags: ["patient", "memory"],
          },
          {
            id: "B",
            label: "The fight. Winning the ugly metres.",
            tags: ["loud", "effort"],
          },
          {
            id: "C",
            label: "Both. Beauty without steel is a postcard.",
            tags: ["hybrid", "honest"],
          },
        ],
        refs: p[3] ? [{ type: "person", id: p[3].id }] : [],
      },
      {
        scene: `${p[4]?.name ?? "A captain"} lifts talk of leadership.`,
        prompt: "What kind of captain do you trust?",
        choices: [
          {
            id: "A",
            label: "The organiser. Quiet orders. Loud example.",
            tags: ["leadership", "patient"],
          },
          {
            id: "B",
            label: "The warrior. First into the duel.",
            tags: ["leadership", "loud"],
          },
          {
            id: "C",
            label: "The translator. Club egos into one camp.",
            tags: ["leadership", "hybrid"],
          },
        ],
        refs: p[4] ? [{ type: "person", id: p[4].id }] : [],
      },
      {
        scene: `A rival fan says ${name} only wakes up for tournaments.`,
        prompt: "How do you answer?",
        choices: [
          { id: "A", label: "Smile. Let the next match speak.", tags: ["calm", "nation"] },
          {
            id: "B",
            label: "Correct them with history. Names, not noise.",
            tags: ["memory", "honest"],
          },
          {
            id: "C",
            label: "Invite them to watch with you. Convert, do not conquer.",
            tags: ["collective", "grace"],
          },
        ],
      },
      {
        scene: p[5]
          ? `Someone ranks ${p[5].name} too low. The chat splits.`
          : `Someone ranks the national heroes wrongly. The chat splits.`,
        prompt: "Your move?",
        choices: [
          { id: "A", label: "Argue with tape. Not volume.", tags: ["honest", "memory"] },
          {
            id: "B",
            label: "Shrug. Lists are noise. Love is not a ballot.",
            tags: ["calm", "grace"],
          },
          {
            id: "C",
            label: "Add the name. Explain why the fleet needs them.",
            tags: ["proud", "memory"],
          },
        ],
        refs: p[5] ? [{ type: "person", id: p[5].id }] : [],
      },
      {
        scene: `Day two closes. Second line for your ${name} Stand.`,
        prompt: "Pick the closer.",
        choices: [
          { id: "A", label: "Beauty and steel. Same camp.", tags: ["hybrid", "memory"] },
          {
            id: "B",
            label: "Captains over celebrities.",
            tags: ["leadership", "patient"],
          },
          {
            id: "C",
            label: "History first. Volume second.",
            tags: ["memory", "calm"],
          },
        ],
        cliffhanger: `Tomorrow: Part 3. Diaspora night for ${name}.`,
      },
    ],
    [
      {
        scene: `SAMPLE. You are not home. The stream lags. The chat does not.`,
        prompt: `How do you keep the ${name} Stand alive from away?`,
        choices: [
          {
            id: "A",
            label: "Full voice on the call. Sing like the square.",
            tags: ["loud", "diaspora"],
          },
          {
            id: "B",
            label: "Same scarf. Same hour. Quiet ritual.",
            tags: ["patient", "diaspora"],
          },
          {
            id: "C",
            label: "Bring a friend who has never cared. Grow the fleet.",
            tags: ["collective", "diaspora"],
          },
        ],
      },
      {
        scene: `A young fan asks why older names still matter.`,
        prompt: "What do you teach?",
        choices: [
          {
            id: "A",
            label: "The catalogue is the map. Without it you wander.",
            tags: ["memory", "nation"],
          },
          {
            id: "B",
            label: "Honour the past. Demand the present. Both.",
            tags: ["honest", "hybrid"],
          },
          {
            id: "C",
            label: "Love who wears the shirt now. Memory is dessert.",
            tags: ["forward", "nation"],
          },
        ],
      },
      {
        scene: `Club football returns tomorrow. ${name} fades for a while.`,
        prompt: "How do you leave the camp?",
        choices: [
          {
            id: "A",
            label: "Clean switch. Club colours until the next call.",
            tags: ["club", "forward"],
          },
          {
            id: "B",
            label: "Keep a thread of nation in the week. Small rituals.",
            tags: ["nation", "loyal"],
          },
          {
            id: "C",
            label: "No leaving. Dual citizenship of the heart.",
            tags: ["hybrid", "honest"],
          },
        ],
      },
      {
        scene: `One image stays: many ships, one harbour. The danger of a single story of ${name}.`,
        prompt: `What is ${name} to you in one feeling?`,
        choices: [
          { id: "A", label: "Pride that travels.", tags: ["proud", "diaspora"] },
          { id: "B", label: "Craft under pressure.", tags: ["patient", "memory"] },
          {
            id: "C",
            label: "Family argument that still sits at the same table.",
            tags: ["collective", "honest"],
          },
        ],
      },
      {
        scene: `Chapter end. Name your ${name} Stand.`,
        prompt: "Who were you across these three days?",
        choices: [
          {
            id: "A",
            label: "The loud pilgrim of the square.",
            tags: ["loud", "nation", "chapter_end"],
          },
          {
            id: "B",
            label: "The catalogue keeper. Names as shelter.",
            tags: ["memory", "patient", "chapter_end"],
          },
          {
            id: "C",
            label: "The hybrid. Nation and club. No apology.",
            tags: ["hybrid", "honest", "chapter_end"],
          },
        ],
        cliffhanger: `Chapter complete. Share your Stand. More ${name} packs when commissioned.`,
      },
    ],
  ];

  let order = 1;
  for (let day = 1; day <= 3; day++) {
    for (const beat of beats[day - 1]) {
      questions.push({
        order,
        day,
        badge_lens: "nation",
        scene: beat.scene,
        prompt: beat.prompt,
        choices: beat.choices,
        entity_refs: [
          { type: "nation", id: nation.id },
          ...(beat.refs || []),
        ],
        ...(beat.cliffhanger ? { cliffhanger: beat.cliffhanger } : {}),
      });
      order += 1;
    }
  }

  return {
    id,
    status: "sample",
    lane: "nations",
    composer_id: "homer",
    family: "Catalogue of Peoples",
    primary_entity: { type: "nation", id: nation.id },
    secondary_entities: p.map((x) => ({ type: "person", id: x.id })),
    title: `${name}: The Camp`,
    logline: `SAMPLE. Auto-generated nation pack for ${name}. Entity-bound to players_seed.`,
    questions_per_day: 5,
    pack_persons_from_seed: p.map((x) => x.id),
    generated: true,
    chapter_number: 1,
    questions,
    day_wall: {
      headline: "Part complete for today",
      body: `You used today's five questions. Your ${name} chapter continues tomorrow at midnight GST.`,
      resume_copy: `Tomorrow: pick up at the next question. ${name} waits.`,
    },
    signup: {
      headline: "Save your Stand",
      body: "Sign up free to keep this chapter, your badges, and your place in the queue. Anonymous progress resets.",
      cta_primary: "Sign up free",
      cta_secondary: "Maybe later",
    },
    share_template: `The Stand · ${name} · The Camp\nDay {day}/3 · "{stand_line}"\nthereflectivefootball.com/stand`,
    next_paths: [
      "Continue tomorrow (saved if signed in)",
      "Play The Guesser",
      "Watch a TRF film",
    ],
  };
}

function chaptersForTier(tier) {
  if (tier === "A") return [1, 2, 3];
  if (tier === "B" || tier === "C") return [1];
  return [];
}

function main() {
  const clubs = load(path.join(STAND, "clubs.json"));
  const nations = load(path.join(STAND, "nations.json"));
  const seed = load(SEED);
  const rowsByPerson = new Map();
  for (const row of seed.players) {
    if (!rowsByPerson.has(row.person_id)) rowsByPerson.set(row.person_id, []);
    rowsByPerson.get(row.person_id).push(row);
  }
  const nameById = new Map(
    [...rowsByPerson.entries()].map(([id, rows]) => [id, rows[0].name]),
  );

  fs.mkdirSync(CHAPTERS, { recursive: true });
  let written = 0;
  let skipped = 0;

  for (const [lane, meta] of Object.entries(LANE_META)) {
    const laneClubs = clubs.filter(
      (c) => c.leagues.includes(lane) && ["A", "B", "C"].includes(c.stand_tier),
    );
    for (const club of laneClubs) {
      const persons = pickPersons(club, nameById, rowsByPerson, 5);
      const rival = rivalFor(club, clubs);
      for (const chapterNum of chaptersForTier(club.stand_tier)) {
        const chapterId = `${meta.prefix}.${club.id}.ch${String(chapterNum).padStart(2, "0")}`;
        const outPath = path.join(CHAPTERS, `${chapterId}.json`);
        if (shouldSkip(outPath)) {
          skipped += 1;
          continue;
        }
        const chapter = buildClubChapter(
          club,
          lane,
          chapterNum,
          persons,
          rival,
          meta.nation,
        );
        fs.writeFileSync(outPath, JSON.stringify(chapter, null, 2));
        written += 1;
        console.log(`club ${chapterId}`);
      }
    }
  }

  for (const nation of nations.filter((n) =>
    ["A", "B"].includes(n.stand_tier),
  )) {
    const chapterId = `na.${nation.id.replace(/^nation-/, "")}.ch01`;
    const outPath = path.join(CHAPTERS, `${chapterId}.json`);
    if (shouldSkip(outPath)) {
      skipped += 1;
      continue;
    }
    const persons = nationPersons(nation, nameById, rowsByPerson, 6);
    const chapter = buildNationChapter(nation, persons);
    fs.writeFileSync(outPath, JSON.stringify(chapter, null, 2));
    written += 1;
    console.log(`nation ${chapterId}`);
  }

  console.log(`\nDone. Written ${written}, skipped ${skipped}`);
  console.log(
    "Championship: still 0 clubs in seed. Player packs: hand-only for now.",
  );
}

main();
