"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import Arrival from "@the-crest/components/Arrival";
import GroundFinale from "@the-crest/components/GroundFinale";
import Starfield from "@the-crest/components/Starfield";
import {
  destinationGlowColors,
  provisionalDestination,
} from "@the-crest/lib/provisional-match";
import { selectMatches } from "@the-crest/lib/select";
import {
  countQuizAnswers,
  initialState,
  isQuizComplete,
  loadPersistedState,
  persistState,
  quizReducer,
  TOTAL_QUIZ_QUESTIONS,
} from "@the-crest/lib/quiz-reducer";
import { sectionAt } from "@the-crest/lib/quiz-content";
import { SCOPE_PALETTE } from "@the-crest/lib/scope";
import JourneyShell from "./JourneyShell";
import OpeningScreen from "./OpeningScreen";
import OwnedClubScreen from "./OwnedClubScreen";
import QuestionScreen from "./QuestionScreen";
import ScopeScreen from "./ScopeScreen";
import styles from "./CrestApp.module.css";

function skipArrivalOnLoad() {
  const loaded = loadPersistedState();
  return Boolean(loaded && loaded.step === "complete" && isQuizComplete(loaded));
}

/**
 * @param {{ clubs: object[] }} props
 */
export default function CrestApp({ clubs }) {
  const [state, dispatch] = useReducer(
    quizReducer,
    undefined,
    () => loadPersistedState() ?? initialState(),
  );

  const [arrivalDone, setArrivalDone] = useState(skipArrivalOnLoad);
  const [starfieldControl, setStarfieldControl] = useState(() =>
    skipArrivalOnLoad()
      ? { opacity: 0, running: false, warpMultiplier: 1, streak: false }
      : { opacity: 1, running: true, warpMultiplier: 1, streak: false },
  );

  useEffect(() => {
    persistState(state);
  }, [state]);

  useEffect(() => {
    if (state.step !== "complete") {
      setArrivalDone(false);
      setStarfieldControl({
        opacity: 1,
        running: true,
        warpMultiplier: 1,
        streak: false,
      });
    }
  }, [state.step]);

  const screenKey = `${state.step}-${state.quizIndex}`;

  const answeredCount = useMemo(() => countQuizAnswers(state), [state]);
  const journeyProgress =
    TOTAL_QUIZ_QUESTIONS > 0 ? answeredCount / TOTAL_QUIZ_QUESTIONS : 0;

  const quizComplete = state.step === "complete" && isQuizComplete(state);

  const provisional = useMemo(
    () => provisionalDestination(state, clubs),
    [
      state.scores,
      state.pillar,
      state.ownedSlugs,
      state.hatedColors,
      state.character,
      state.leagueScope,
      state.sensesAnswers,
      clubs,
    ],
  );

  const finalResult = useMemo(() => {
    if (!quizComplete || !state.pillar) return null;
    return selectMatches(
      /** @type {number[]} */ (state.scores),
      clubs,
      state.pillar,
      state.ownedSlugs,
      state.hatedColors,
      state.character,
      state.leagueScope,
      state.sensesAnswers,
    );
  }, [
    quizComplete,
    state.scores,
    state.pillar,
    state.ownedSlugs,
    state.hatedColors,
    state.character,
    state.leagueScope,
    state.sensesAnswers,
    clubs,
  ]);

  const finalClub = finalResult?.primary?.club ?? null;

  const destinationClub = finalClub ?? provisional?.club ?? null;

  const glow = useMemo(() => {
    if (destinationClub) return destinationGlowColors(destinationClub);
    if (state.leagueScope && state.leagueScope !== "all") {
      return SCOPE_PALETTE[state.leagueScope];
    }
    return destinationGlowColors(null);
  }, [destinationClub, state.leagueScope]);

  const section = state.step === "quiz" ? sectionAt(state.quizIndex) : "heart";
  const approach =
    state.step === "complete" || section === "soul"
      ? 2
      : section === "senses"
        ? 1
        : 0;

  const destinationMix = useMemo(() => {
    if (destinationClub) {
      const fit = provisional?.raw ?? 0;
      return Math.min(1, journeyProgress * 0.85 + fit * 0.2);
    }
    if (state.leagueScope && state.leagueScope !== "all") return 1;
    return 0;
  }, [
    destinationClub,
    journeyProgress,
    provisional?.raw,
    state.leagueScope,
  ]);

  const starfieldProgress = useMemo(() => {
    const fit = provisional?.raw ?? 0;
    return Math.min(1, journeyProgress * 0.9 + fit * 0.12);
  }, [journeyProgress, provisional?.raw]);

  const patchStarfield = useCallback((patch) => {
    setStarfieldControl((prev) => ({ ...prev, ...patch }));
  }, []);

  const onArrivalComplete = useCallback(() => {
    setArrivalDone(true);
  }, []);

  const handleRestart = useCallback(() => {
    dispatch({ type: "RESTART" });
  }, []);

  const handleRemap = useCallback((scope) => {
    dispatch({ type: "REMAP", payload: scope });
    setArrivalDone(false);
    setStarfieldControl({
      opacity: 1,
      running: true,
      warpMultiplier: 1,
      streak: false,
    });
  }, []);

  const showLanding = state.step === "start";
  const showJourney =
    state.step === "scope" || state.step === "owned" || state.step === "quiz";
  const showArrival = quizComplete && !arrivalDone;
  const showGroundFinale = quizComplete && arrivalDone;
  const showStarfield = !showGroundFinale;

  return (
    <>
      {showStarfield ? (
        <Starfield
          progress={starfieldProgress}
          boost={answeredCount}
          opacity={starfieldControl.opacity}
          running={starfieldControl.running}
          warpMultiplier={starfieldControl.warpMultiplier}
          streak={starfieldControl.streak}
          destinationGlowRgb={glow.primary}
          destinationMix={destinationMix}
          horizonRgb={glow.secondary}
          approach={approach}
        />
      ) : null}
      {showArrival ? (
        <Arrival
          key={`${destinationClub?.slug ?? "none"}-${state.leagueScope}`}
          club={destinationClub}
          onComplete={onArrivalComplete}
          onStarfield={patchStarfield}
        />
      ) : null}
      {showGroundFinale ? (
        <GroundFinale
          club={destinationClub}
          match={finalResult?.primary ?? null}
          countryFits={finalResult?.byCountry ?? []}
          sensesAnswers={state.sensesAnswers}
          scores={state.scores}
          leagueScope={state.leagueScope}
          onRestart={handleRestart}
          onRemap={handleRemap}
        />
      ) : null}
      {showLanding ? (
        <div className={`${styles.app} ${styles.appLanding}`}>
          <OpeningScreen onStart={() => dispatch({ type: "START" })} />
        </div>
      ) : null}
      {showJourney ? (
        <div className={`${styles.app} ${styles.appJourney}`}>
          <JourneyShell progress={starfieldProgress}>
            {state.step === "scope" && (
              <div key="scope" className={styles.screenEnter}>
                <ScopeScreen
                  value={state.leagueScope}
                  onChange={(id) =>
                    dispatch({ type: "SET_SCOPE", payload: id })
                  }
                  onBegin={() =>
                    dispatch({
                      type: "CONFIRM_SCOPE",
                      payload: state.leagueScope,
                    })
                  }
                  onBack={() => dispatch({ type: "BACK" })}
                />
              </div>
            )}
            {state.step === "owned" && (
              <div key={screenKey} className={styles.screenEnter}>
                <OwnedClubScreen
                  clubs={clubs}
                  onChooseClub={(slug) =>
                    dispatch({ type: "CHOOSE_OWNED", payload: slug })
                  }
                  onNoClub={() => dispatch({ type: "NO_CLUB_YET" })}
                  onBack={() => dispatch({ type: "BACK" })}
                />
              </div>
            )}
            {state.step === "quiz" && (
              <div key={screenKey} className={styles.screenEnter}>
                <QuestionScreen
                  quizIndex={state.quizIndex}
                  scores={state.scores}
                  character={state.character}
                  hatedColors={state.hatedColors}
                  sensesAnswers={state.sensesAnswers}
                  onAnswerDimension={(index, value) =>
                    dispatch({
                      type: "ANSWER_DIMENSION",
                      payload: { index, value },
                    })
                  }
                  onAnswerSense={(index, value) =>
                    dispatch({
                      type: "ANSWER_SENSE",
                      payload: { index, value },
                    })
                  }
                  onAnswerCharacter={(key, value) =>
                    dispatch({
                      type: "ANSWER_CHARACTER",
                      payload: { key, value },
                    })
                  }
                  onAnswerPillar={(w) =>
                    dispatch({ type: "ANSWER_PILLAR", payload: w })
                  }
                  onAnswerColor={(color) =>
                    dispatch({ type: "ANSWER_COLOR", payload: color })
                  }
                  onBack={() => dispatch({ type: "BACK" })}
                  journey
                />
              </div>
            )}
          </JourneyShell>
        </div>
      ) : null}
    </>
  );
}
