import { NextResponse } from "next/server";
import {
  resolveSubmission,
} from "@/lib/guesser/registry";
import { getDailyAnswer, shareGrid, compareToAnswer } from "@/lib/guesser/engine";
import {
  maxUnlockedClue,
  buildClueState,
  shareClueSuffix,
} from "@/lib/guesser/clues";
import { explainTile, explainClubChip } from "@/lib/guesser/tile-explain";
import { gstDay, FREE_MODE_SLUG } from "@/lib/guesser/config";
import {
  buildGuessedPersonIdSet,
  isPersonAlreadyGuessed,
} from "@/lib/guesser/dedupe";

export const runtime = "nodejs";

function report(n, name, pass, detail = "") {
  return { n, name, pass, detail };
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const results = [];
  const day = gstDay();
  const messi = resolveSubmission("world_cup", { guess: "messi" });
  const messiPid = messi.person?.personId;

  // 1
  {
    const r = resolveSubmission("world_cup", { guess: "messi" });
    results.push(
      report(
        1,
        'Type "messi" + Enter submits Lionel Messi directly',
        r.type === "single" && r.person.name === "Lionel Messi",
        r.type === "single" ? `Resolved to ${r.person.name}` : `Got ${r.type}`
      )
    );
  }

  // 2
  {
    const r = resolveSubmission("world_cup", { guess: "ronaldo" });
    results.push(
      report(
        2,
        'Type "ronaldo" shows disambiguation with exactly two person cards',
        r.type === "ambiguous" && r.options.length === 2,
        r.type === "ambiguous"
          ? `Options: ${r.options.map((o) => o.person.name).join(", ")}`
          : `Got ${r.type}`
      )
    );
  }

  // 3 — same board dedupe
  {
    const keys = buildGuessedPersonIdSet("world_cup", day, {
      cookiePersonIds: messiPid ? [messiPid] : [],
      dbPersonIds: [],
    });
    const rejected = isPersonAlreadyGuessed(
      "world_cup",
      day,
      messiPid,
      keys
    );
    results.push(
      report(
        3,
        "Guess a person once on a board, same person rejected as already guessed",
        messi.type === "single" && rejected,
        `dedupe key=${messiPid ? `world_cup:${day}:${messiPid}` : "n/a"}`
      )
    );
  }

  // A — cross-mode: Messi in world_cup then la_liga same day
  {
    const wcKeys = buildGuessedPersonIdSet("world_cup", day, {
      cookiePersonIds: messiPid ? [messiPid] : [],
      dbPersonIds: [],
    });
    const laKeys = buildGuessedPersonIdSet("la_liga", day, {
      cookiePersonIds: [],
      dbPersonIds: [],
    });
    const blockedOnWc = isPersonAlreadyGuessed("world_cup", day, messiPid, wcKeys);
    const blockedOnLa = isPersonAlreadyGuessed("la_liga", day, messiPid, laKeys);
    results.push(
      report(
        "A",
        "Messi in world_cup then Messi in la_liga same day: accepted in both",
        messiPid && blockedOnWc && !blockedOnLa,
        `world_cup blocked=${blockedOnWc}; la_liga blocked=${blockedOnLa}`
      )
    );
  }

  // B — twice on one board
  {
    const keys = buildGuessedPersonIdSet("la_liga", day, {
      cookiePersonIds: messiPid ? [messiPid] : [],
      dbPersonIds: [],
    });
    results.push(
      report(
        "B",
        "Messi twice on one board: rejected",
        isPersonAlreadyGuessed("la_liga", day, messiPid, keys),
        `scope la_liga:${day}:${messiPid}`
      )
    );
  }

  // 5
  {
    const gameUnlocked = { attempts: 1, solved: false, revealedClues: [] };
    const unlocked = maxUnlockedClue(1, false);
    const answer = await getDailyAnswer("world_cup", day);
    const clues = buildClueState(answer, gameUnlocked);
    const chip2 = clues.chips.find((c) => c.num === 2);
    const chip3 = clues.chips.find((c) => c.num === 3);
    const gameRevealed = { attempts: 1, solved: false, revealedClues: [2] };
    const suffix = shareClueSuffix(gameRevealed.revealedClues);
    results.push(
      report(
        5,
        "Wrong guess unlocks chip; reveal tracked in share string",
        unlocked === 2 &&
          chip2?.status === "unlocked" &&
          chip3?.status === "locked" &&
          suffix === "1 clue",
        `unlocked=${unlocked}; chip2=${chip2?.status}; chip3=${chip3?.status}; share="${suffix}"`
      )
    );
  }

  // 6
  {
    const answer = await getDailyAnswer("world_cup", day);
    const clues = buildClueState(answer, {
      attempts: 0,
      solved: false,
      revealedClues: [],
    });
    const clueJson = JSON.stringify(clues);
    const hasPersonId =
      clueJson.includes("personId") || clueJson.includes("person_id");
    results.push(
      report(
        6,
        "Pre-game clue payload has no person_id; answer name only at game over",
        !hasPersonId && Boolean(answer?.personId),
        `person_id in client clues=${hasPersonId}; server answer has personId=${Boolean(answer?.personId)}`
      )
    );
  }

  // 7
  {
    const samples = [
      { key: "nationality", status: "correct", value: "Brazil", hint: null },
      { key: "nationality", status: "close", value: "Portugal", hint: null },
      { key: "nationality", status: "wrong", value: "Germany", hint: null },
      { key: "league", status: "correct", value: "La Liga", hint: null },
      {
        key: "club",
        status: "correct",
        value: "Barcelona, Valencia",
        clubs: [
          { name: "Barcelona", status: "correct" },
          { name: "Valencia", status: "wrong" },
        ],
        hint: null,
      },
      { key: "birth_year", status: "close", value: "1987", hint: "down" },
      { key: "shirt_number", status: "wrong", value: "7", hint: "up" },
      { key: "league", status: "na", value: null, hint: null },
    ];
    const chipTips = [
      explainClubChip("Barcelona", "correct"),
      explainClubChip("Valencia", "wrong"),
    ];
    const allPlain = samples.every((f) => {
      const t = explainTile(f);
      return t.length > 8 && !t.includes("—");
    }) && chipTips.every((t) => t.length > 8 && !t.includes("—"));
    results.push(
      report(
        7,
        "Tile tooltips plain sentences for all tile types",
        allPlain,
        samples.map((s) => explainTile(s)).join(" | ") +
          " | " +
          chipTips.join(" | ")
      )
    );
  }

  // 11 — per-club chip grading
  {
    const villa = resolveSubmission("la_liga", { guess: "david villa" });
    const yamal = resolveSubmission("la_liga", { guess: "yamal" });
    const villaRow = villa.type === "single" ? villa.row : null;
    const yamalRow = yamal.type === "single" ? yamal.row : null;
    const clubTile =
      villaRow && yamalRow
        ? compareToAnswer(villaRow, yamalRow).find((f) => f.key === "club")
        : null;
    const barca = clubTile?.clubs?.find((c) => c.name === "Barcelona");
    const valencia = clubTile?.clubs?.find((c) => c.name === "Valencia");
    const atleti = clubTile?.clubs?.find((c) => c.name === "Atletico Madrid");
    const singleClub =
      yamalRow
        ? compareToAnswer(yamalRow, yamalRow).find((f) => f.key === "club")
        : null;
    const shareGame = {
      solved: false,
      attempts: 1,
      revealedClues: [],
      guesses: [
        {
          feedback:
            villaRow && yamalRow ? compareToAnswer(villaRow, yamalRow) : [],
        },
      ],
    };
    const shareLine = shareGrid("La Liga", shareGame, day).split("\n")[1];
    const clubEmoji = shareLine ? [...shareLine][2] : null;
    const noLeak =
      clubTile?.clubs?.length === 3 &&
      !clubTile.clubs.some((c) => c.name === "Espanyol");
    results.push(
      report(
        11,
        "Club column: per-club chips; share emoji green when any chip matches",
        Boolean(
          villa.type === "single" &&
            yamal.type === "single" &&
            barca?.status === "correct" &&
            valencia?.status === "wrong" &&
            atleti?.status === "wrong" &&
            clubTile?.status === "correct" &&
            singleClub?.clubs?.length === 1 &&
            singleClub.clubs[0].status === "correct" &&
            clubEmoji === "\u{1F7E9}" &&
            noLeak
        ),
        `chips=${clubTile?.clubs?.map((c) => `${c.name}:${c.status}`).join(",")}; share=${clubEmoji}`
      )
    );
  }

  // 10
  {
    const game = {
      solved: false,
      attempts: 6,
      revealedClues: [2, 3],
      guesses: [
        {
          feedback: [
            { status: "correct" },
            { status: "close" },
            { status: "wrong" },
            { status: "correct" },
            { status: "na" },
            { status: "wrong" },
          ],
        },
      ],
    };
    const share = shareGrid("World Cup Legends", game, day);
    const hasEmojis = ["🟩", "🟨", "⬛", "⬜"].every((e) => share.includes(e));
    const formatOk =
      /^The Guesser #\d+ \(World Cup Legends\) X\/6 · 2 clues/.test(
        share.split("\n")[0]
      );
    const noEmDash = !share.includes("—") && !share.includes("–");
    results.push(
      report(
        10,
        "Share string format exact; four emoji symbols; no em-dash",
        hasEmojis && formatOk && noEmDash,
        share.split("\n")[0]
      )
    );
  }

  // C — free mode is world_cup
  {
    results.push(
      report(
        "C",
        "World Cup Legends is the free anonymous daily mode",
        FREE_MODE_SLUG === "world_cup",
        `FREE_MODE_SLUG=${FREE_MODE_SLUG}`
      )
    );
  }

  const passed = results.filter((r) => r.pass).length;
  return NextResponse.json({ passed, total: results.length, results });
}
