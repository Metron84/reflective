import { getServiceClient } from "@/lib/supabase";
import {
  getAnswerPersons,
  getCompareRow,
  getAnswerPayload,
  resolveSubmission,
} from "./registry";
import { gstDay, puzzleNumber, MAX_ATTEMPTS } from "./config";
import { confederationOf } from "./confederations";

// SERVER ONLY. The answer computed here must never be serialized into
// any client payload while a game is live.

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Daily answer as person payload with compare row for the mode. */
export async function getDailyAnswer(mode, day = gstDay()) {
  const pool = getAnswerPersons(mode);
  if (!pool.length) return null;

  const supabase = getServiceClient();
  if (supabase) {
    const { data } = await supabase
      .from("puzzles")
      .select("player_id")
      .eq("puzzle_date", day)
      .eq("mode", mode)
      .single();
    if (data?.player_id) {
      const row = pool
        .flatMap((p) => p.rows)
        .find((r) => r.id === data.player_id);
      if (row?.person_id) {
        return getAnswerPayload(mode, row.person_id);
      }
    }
  }

  const person = pool[fnv1a(`trf:${day}:${mode}`) % pool.length];
  return getAnswerPayload(mode, person.personId);
}

const CLOSE_BIRTH_YEAR = 5;
const CLOSE_SHIRT_NUMBER = 2;
const POSITION_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 };

const LEAGUE_LABELS = {
  premier_league: "Premier League",
  la_liga: "La Liga",
  serie_a: "Serie A",
  bundesliga: "Bundesliga",
  ligue_1: "Ligue 1",
};

function numericHint(guessValue, answerValue) {
  if (guessValue == null || answerValue == null) return null;
  if (guessValue === answerValue) return null;
  return answerValue > guessValue ? "up" : "down";
}

function status(correct, close) {
  if (correct) return "correct";
  if (close) return "close";
  return "wrong";
}

function buildClubFeedback(guessedRow, answerRow) {
  const guessedClubs = guessedRow.clubs ?? [];
  const answerClubs = answerRow.clubs ?? [];

  if (!guessedClubs.length) {
    return {
      key: "club",
      label: "Club",
      short: "Club",
      value: null,
      clubs: null,
      status: "na",
      hint: null,
    };
  }

  const clubs = guessedClubs.map((club) => ({
    name: club,
    status: answerClubs.includes(club) ? "correct" : "wrong",
  }));
  const clubOverlap = clubs.some((chip) => chip.status === "correct");

  return {
    key: "club",
    label: "Club",
    short: "Club",
    value: guessedClubs.join(", "),
    clubs,
    status: status(clubOverlap, false),
    hint: null,
  };
}

export function compareToAnswer(guessedRow, answerRow) {
  const sameConfederation =
    confederationOf(guessedRow.nationality) != null &&
    confederationOf(guessedRow.nationality) ===
      confederationOf(answerRow.nationality);

  return [
    {
      key: "nationality",
      label: "Nation",
      short: "Nat",
      value: guessedRow.nationality,
      status: status(
        guessedRow.nationality === answerRow.nationality,
        sameConfederation && guessedRow.nationality !== answerRow.nationality
      ),
      hint: null,
    },
    {
      key: "league",
      label: "League",
      short: "Lge",
      value: guessedRow.league
        ? LEAGUE_LABELS[guessedRow.league] ?? guessedRow.league
        : null,
      status:
        guessedRow.league == null || answerRow.league == null
          ? guessedRow.league === answerRow.league
            ? "correct"
            : "na"
          : status(guessedRow.league === answerRow.league, false),
      hint: null,
    },
    buildClubFeedback(guessedRow, answerRow),
    {
      key: "position",
      label: "Position",
      short: "Pos",
      value: guessedRow.position,
      status: status(
        guessedRow.position === answerRow.position,
        guessedRow.position !== answerRow.position &&
          guessedRow.position !== "GK" &&
          answerRow.position !== "GK" &&
          Math.abs(
            POSITION_ORDER[guessedRow.position] -
              POSITION_ORDER[answerRow.position]
          ) === 1
      ),
      hint: null,
    },
    {
      key: "birth_year",
      label: "Born",
      short: "Born",
      value: String(guessedRow.birth_year),
      status: status(
        guessedRow.birth_year === answerRow.birth_year,
        Math.abs(guessedRow.birth_year - answerRow.birth_year) <=
          CLOSE_BIRTH_YEAR
      ),
      hint: numericHint(guessedRow.birth_year, answerRow.birth_year),
    },
    {
      key: "shirt_number",
      label: "Shirt",
      short: "Shirt",
      value:
        guessedRow.shirt_number == null
          ? null
          : String(guessedRow.shirt_number),
      status:
        guessedRow.shirt_number == null || answerRow.shirt_number == null
          ? "na"
          : status(
              guessedRow.shirt_number === answerRow.shirt_number,
              Math.abs(guessedRow.shirt_number - answerRow.shirt_number) <=
                CLOSE_SHIRT_NUMBER
            ),
      hint: numericHint(guessedRow.shirt_number, answerRow.shirt_number),
    },
  ];
}

export function isSolved(guessPersonId, answerPersonId) {
  return guessPersonId === answerPersonId;
}

const EMOJI = {
  correct: "\u{1F7E9}",
  close: "\u{1F7E8}",
  wrong: "\u2B1B",
  na: "\u2B1C",
};

export async function hydrateGameGuesses(mode, game, day = gstDay()) {
  if (!game.guesses.length) return game;
  const answer = await getDailyAnswer(mode, day);
  if (!answer) return game;

  return {
    ...game,
    guesses: game.guesses.map((g) => {
      let personId = g.personId;
      if (!personId && g.name) {
        const resolved = resolveSubmission(mode, { guess: g.name });
        if (resolved.type === "single") personId = resolved.person.personId;
      }
      const guessRow = personId ? getCompareRow(mode, personId) : null;
      if (!guessRow) return g;
      return {
        personId,
        name: g.name,
        feedback: compareToAnswer(guessRow, answer.row),
      };
    }),
  };
}

import { shareClueSuffix } from "./clues";

export function shareGrid(modeName, game, day) {
  const score = game.solved
    ? `${game.attempts}/${MAX_ATTEMPTS}`
    : `X/${MAX_ATTEMPTS}`;
  const lines = game.guesses.map((g) =>
    g.feedback.map((f) => EMOJI[f.status]).join("")
  );
  const cluePart = shareClueSuffix(game.revealedClues);
  return [
    `The Guesser #${puzzleNumber(day)} (${modeName}) ${score} · ${cluePart}`,
    ...lines,
    "thereflectivefootball.com/guesser",
  ].join("\n");
}
