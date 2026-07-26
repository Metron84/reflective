#!/usr/bin/env node
/**
 * Generate SAMPLE nation Stand chapters (Championship ignored).
 * Tier A: ch01–ch03 · Tier B: ch01–ch02 · Tier C: ch01
 * Skips hand-authored (generated === false).
 *
 * Run: node scripts/generate-stand-nations.mjs
 *      node scripts/generate-stand-nations.mjs --force-auto
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

const CHAPTER_TITLES = {
  1: "The Camp",
  2: "The Catalogue",
  3: "The Return",
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

function chaptersForTier(tier) {
  if (tier === "A") return [1, 2, 3];
  if (tier === "B") return [1, 2];
  if (tier === "C") return [1];
  return [];
}

function nationPersons(nation, nameById, rowsByPerson, n = 8) {
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

function openScene(name, chapterNum) {
  const scenes = [
    `Tournament night. ${name} flags in a foreign square. The anthem starts.`,
    `Group stage morning. ${name} colours on balconies and phones. The camp rebuilds.`,
    `Knockout air. ${name} feels close and far at once. The square is quieter, sharper.`,
  ];
  return scenes[chapterNum - 1];
}

function buildNationChapter(nation, persons, chapterNum) {
  const slug = nation.id.replace(/^nation-/, "");
  const id = `na.${slug}.ch${String(chapterNum).padStart(2, "0")}`;
  const name = nation.display_name;
  const p = persons;
  const title = `${name}: ${CHAPTER_TITLES[chapterNum]}`;

  // Rotate which persons feature by chapter so arcs feel distinct
  const offset = (chapterNum - 1) * 2;
  const slot = (i) => p[(offset + i) % Math.max(p.length, 1)] ?? null;

  const beats = [
    [
      {
        scene: openScene(name, chapterNum),
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
        scene:
          chapterNum === 1
            ? `Someone near you only knows ${name} through clubs. Someone else only through tournaments.`
            : chapterNum === 2
              ? `The chat argues what ${name} really is: style, fight, or family.`
              : `A young fan asks if ${name} still matters between tournaments.`,
        prompt:
          chapterNum === 3
            ? "What do you tell them?"
            : `Which ${name} do you carry into the night?`,
        choices:
          chapterNum === 3
            ? [
                {
                  id: "A",
                  label: "Yes. Ordinary weeks still carry the flag.",
                  tags: ["loyal", "nation"],
                },
                {
                  id: "B",
                  label: "Tournaments wake it. Clubs keep it warm.",
                  tags: ["hybrid", "honest"],
                },
                {
                  id: "C",
                  label: "It matters when you show up. That is the whole rule.",
                  tags: ["honest", "forward"],
                },
              ]
            : [
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
            label: `${slot(0)?.name ?? "A legend"}. The first ship.`,
            tags: ["memory"],
          },
          {
            id: "B",
            label: `${slot(1)?.name ?? "Another legend"}. The second ship.`,
            tags: ["memory"],
          },
          {
            id: "C",
            label: `${slot(2)?.name ?? "A third name"}. The quiet craft.`,
            tags: ["memory"],
          },
        ],
        refs: [slot(0), slot(1), slot(2)]
          .filter(Boolean)
          .map((x) => ({ type: "person", id: x.id })),
      },
      {
        scene:
          chapterNum === 2
            ? `Club colours under the jacket. ${name} colours in the chat header.`
            : `Club colours sit under the jacket. Nation colours above.`,
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
        cliffhanger: `Tomorrow: Part 2. ${CHAPTER_TITLES[chapterNum]} continues for ${name}.`,
      },
    ],
    [
      {
        scene: `SAMPLE. Next GST day. A clip of ${slot(3)?.name ?? "a national icon"} circles the chat.`,
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
        refs: slot(3) ? [{ type: "person", id: slot(3).id }] : [],
      },
      {
        scene: `${slot(4)?.name ?? "A captain"} lifts talk of leadership.`,
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
        refs: slot(4) ? [{ type: "person", id: slot(4).id }] : [],
      },
      {
        scene:
          chapterNum === 3
            ? `Someone says ${name} peaked already. The chat goes cold.`
            : `A rival fan says ${name} only wakes up for tournaments.`,
        prompt: "How do you answer?",
        choices:
          chapterNum === 3
            ? [
                {
                  id: "A",
                  label: "Peaks return. So do we.",
                  tags: ["loyal", "forward"],
                },
                {
                  id: "B",
                  label: "Correct with names. Not volume.",
                  tags: ["memory", "honest"],
                },
                {
                  id: "C",
                  label: "Invite them to the next matchday. Convert.",
                  tags: ["collective", "grace"],
                },
              ]
            : [
                {
                  id: "A",
                  label: "Smile. Let the next match speak.",
                  tags: ["calm", "nation"],
                },
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
        scene: slot(5)
          ? `Someone ranks ${slot(5).name} too low. The chat splits.`
          : `Someone ranks the national heroes wrongly. The chat splits.`,
        prompt: "Your move?",
        choices: [
          {
            id: "A",
            label: "Argue with tape. Not volume.",
            tags: ["honest", "memory"],
          },
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
        refs: slot(5) ? [{ type: "person", id: slot(5).id }] : [],
      },
      {
        scene: `Day two closes. Second line for your ${name} Stand.`,
        prompt: "Pick the closer.",
        choices: [
          {
            id: "A",
            label: "Beauty and steel. Same camp.",
            tags: ["hybrid", "memory"],
          },
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
        scene:
          chapterNum === 1
            ? `A young fan asks why older names still matter.`
            : chapterNum === 2
              ? `Someone wants only current players in the ${name} story.`
              : `The return: club week starts tomorrow. ${name} softens.`,
        prompt:
          chapterNum === 3 ? "How do you leave the camp?" : "What do you teach?",
        choices:
          chapterNum === 3
            ? [
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
              ]
            : [
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
        scene:
          chapterNum === 3
            ? `One last craft beat. ${slot(6)?.name ?? "A quiet hero"} still teaches something.`
            : `Club football returns tomorrow. ${name} fades for a while.`,
        prompt:
          chapterNum === 3
            ? "What do you take forward?"
            : "How do you leave the camp?",
        choices:
          chapterNum === 3
            ? [
                {
                  id: "A",
                  label: "Standards without erasing joy.",
                  tags: ["honest", "grace"],
                },
                {
                  id: "B",
                  label: "Courage to love across club crests.",
                  tags: ["hybrid", "proud"],
                },
                {
                  id: "C",
                  label: "Show up. That is the nation.",
                  tags: ["loyal", "forward"],
                },
              ]
            : [
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
        refs: slot(6) ? [{ type: "person", id: slot(6).id }] : [],
      },
      {
        scene: `One image stays: many ships, one harbour. The danger of a single story of ${name}.`,
        prompt: `What is ${name} to you in one feeling?`,
        choices: [
          { id: "A", label: "Pride that travels.", tags: ["proud", "diaspora"] },
          {
            id: "B",
            label: "Craft under pressure.",
            tags: ["patient", "memory"],
          },
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
        cliffhanger:
          chapterNum < 3
            ? `Chapter complete. Next: ${name} · ${CHAPTER_TITLES[chapterNum + 1]}.`
            : `Arc complete for ${name}. Share your Stand. More nations await.`,
      },
    ],
  ];

  const questions = [];
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
    title,
    logline: `SAMPLE. Auto-generated ${title}. Entity-bound to players_seed. Editorial pass pending.`,
    questions_per_day: 5,
    pack_persons_from_seed: p.map((x) => x.id),
    generated: true,
    chapter_number: chapterNum,
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
    share_template: `The Stand · ${name} · ${CHAPTER_TITLES[chapterNum]}\nDay {day}/3 · "{stand_line}"\nthereflectivefootball.com/stand`,
    next_paths: [
      "Continue tomorrow (saved if signed in)",
      "Play The Guesser",
      "Watch a TRF film",
    ],
  };
}

function main() {
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

  const targets = nations.filter((n) => ["A", "B", "C"].includes(n.stand_tier));

  for (const nation of targets) {
    const persons = nationPersons(nation, nameById, rowsByPerson, 8);
    for (const chapterNum of chaptersForTier(nation.stand_tier)) {
      const slug = nation.id.replace(/^nation-/, "");
      const chapterId = `na.${slug}.ch${String(chapterNum).padStart(2, "0")}`;
      const outPath = path.join(CHAPTERS, `${chapterId}.json`);
      if (shouldSkip(outPath)) {
        skipped += 1;
        continue;
      }
      const chapter = buildNationChapter(nation, persons, chapterNum);
      fs.writeFileSync(outPath, JSON.stringify(chapter, null, 2));
      written += 1;
      console.log(chapterId);
    }
  }

  console.log(`\nDone. Written ${written}, skipped ${skipped}`);
  console.log(
    `Nation targets: ${targets.length} (A/B/C). Championship ignored.`,
  );
}

main();
