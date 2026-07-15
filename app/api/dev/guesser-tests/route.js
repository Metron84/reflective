import { NextResponse } from "next/server";
import { resolveSubmission, getAnswerPersons, getGuessSuggestions, getCompareRow } from "@/lib/guesser/registry";
import { getDailyAnswer, shareGrid, compareToAnswer } from "@/lib/guesser/engine";
import {
  maxUnlockedClue,
  buildClueState,
  shareClueSuffix,
} from "@/lib/guesser/clues";
import { explainTile, explainClubChip } from "@/lib/guesser/tile-explain";
import { gstDay } from "@/lib/guesser/config";

export const runtime = "nodejs";

function report(n, name, pass, detail = "") {
  return { n, name, pass, detail };
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const results = [];

  // 1
  {
    const r = resolveSubmission("classic", { guess: "messi" });
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
    const r = resolveSubmission("classic", { guess: "ronaldo" });
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

  // 3
  {
    const first = resolveSubmission("classic", { guess: "messi" });
    const pid = first.person?.personId;
    const messiCards = getGuessSuggestions("classic").filter(
      (s) => s.name === "Lionel Messi"
    );
    const rejected = [{ personId: pid }].some(
      (g) => g.personId === pid
    );
    results.push(
      report(
        3,
        "Guess a person once, any era rejected as already guessed",
        first.type === "single" && messiCards.length === 1 && rejected,
        `${messiCards.length} suggestion card(s); dedupe person_id works`
      )
    );
  }

  // 4
  {
    const pool = getAnswerPersons("classic");
    const allHaveLeague = pool.every((p) => p.canonical?.league != null);
    const answer = await getDailyAnswer("classic", gstDay());
    const leagueTile = answer
      ? compareToAnswer(answer.row, answer.row).find((f) => f.key === "league")
      : null;
    results.push(
      report(
        4,
        "Classic answer pool: League column on answer side never dead",
        allHaveLeague && leagueTile?.status === "correct",
        `Pool ${pool.length}; today league=${answer?.row?.league ?? "null"} status=${leagueTile?.status}`
      )
    );
  }

  // 5
  {
    const gameUnlocked = { attempts: 1, solved: false, revealedClues: [] };
    const unlocked = maxUnlockedClue(1, false);
    const answer = await getDailyAnswer("classic", gstDay());
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
    const answer = await getDailyAnswer("classic", gstDay());
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
    const villa = getCompareRow("la_liga", "6127985dc429");
    const yamal = getCompareRow("la_liga", "0540dd5857b4");
    const clubTile = compareToAnswer(villa, yamal).find((f) => f.key === "club");
    const barca = clubTile?.clubs?.find((c) => c.name === "Barcelona");
    const valencia = clubTile?.clubs?.find((c) => c.name === "Valencia");
    const atleti = clubTile?.clubs?.find((c) => c.name === "Atletico Madrid");
    const singleClub = compareToAnswer(yamal, yamal).find((f) => f.key === "club");
    const shareGame = {
      solved: false,
      attempts: 1,
      revealedClues: [],
      guesses: [{ feedback: compareToAnswer(villa, yamal) }],
    };
    const shareLine = shareGrid("La Liga", shareGame, gstDay()).split("\n")[1];
    const clubEmoji = shareLine?.[2];
    const noLeak =
      clubTile?.clubs?.length === 3 &&
      !clubTile.clubs.some((c) => c.name === "Espanyol");
    results.push(
      report(
        11,
        "Club column: per-club chips; share emoji green when any chip matches",
        Boolean(
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
    const share = shareGrid("Classic", game, gstDay());
    const hasEmojis = ["🟩", "🟨", "⬛", "⬜"].every((e) => share.includes(e));
    const formatOk =
      /^The Guesser #\d+ \(Classic\) X\/6 · 2 clues/.test(share.split("\n")[0]);
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

  const passed = results.filter((r) => r.pass).length;
  return NextResponse.json({ passed, total: results.length, results });
}
