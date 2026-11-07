"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
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
import ResultScreen from "./ResultScreen";
import ScopeScreen from "./ScopeScreen";
import styles from "./CrestApp.module.css";

/**
 * @param {{ clubs: object[] }} props
 */
export default function CrestApp({ clubs }) {
  const [state, dispatch] = useReducer(
    quizReducer,
    undefined,
    () => loadPersistedState() ?? initialState(),
  );

  useEffect(() => {
    persistState(state);
  }, [state]);

  const showResult = state.step === "complete" && isQuizComplete(state);
  const starfieldControl = showResult
    ? { opacity: 0, running: false, warpMultiplier: 1, streak: false }
    : { opacity: 1, running: true, warpMultiplier: 1, streak: false };

  const screenKey = `${state.step}-${state.quizIndex}`;

  const answeredCount = useMemo(() => countQuizAnswers(state), [state]);
  const journeyProgress =
    TOTAL_QUIZ_QUESTIONS > 0 ? answeredCount / TOTAL_QUIZ_QUESTIONS : 0;

  const provisional = useMemo(
    () => provisionalDestination(state, clubs),
    [state, clubs],
  );

  const finalResult = useMemo(() => {
    if (!showResult || !state.pillar) return null;
    return selectMatches(
      /** @type {number[]} */ (state.scores),
      clubs,
      state.pillar,
      state.ownedSlugs,
      null,
      null,
      state.leagueScope,
      null,
    );
  }, [showResult, state, clubs]);

  const destinationClub =
    finalResult?.primary?.club ?? provisional?.club ?? null;

  const glow = useMemo(() => {
    if (destinationClub) return destinationGlowColors(destinationClub);
    if (state.leagueScope && state.leagueScope !== "all") {
      return SCOPE_PALETTE[state.leagueScope];
    }
    return destinationGlowColors(null);
  }, [destinationClub, state.leagueScope]);

  const section = state.step === "quiz" ? sectionAt(state.quizIndex) : "heart";
  const approach = state.step === "complete" || section === "soul" ? 2 : 0;

  const destinationMix = useMemo(() => {
    if (destinationClub) {
      const fit = provisional?.raw ?? 0;
      return Math.min(1, journeyProgress * 0.85 + fit * 0.2);
    }
    if (state.leagueScope && state.leagueScope !== "all") return 1;
    return 0;
  }, [destinationClub, journeyProgress, provisional?.raw, state.leagueScope]);

  const starfieldProgress = useMemo(() => {
    const fit = provisional?.raw ?? 0;
    return Math.min(1, journeyProgress * 0.9 + fit * 0.12);
  }, [journeyProgress, provisional?.raw]);

  const handleRestart = useCallback(() => {
    dispatch({ type: "RESTART" });
  }, []);

  const showLanding = state.step === "start";
  const showJourney =
    state.step === "scope" || state.step === "owned" || state.step === "quiz";
  const showResultScreen = Boolean(showResult && finalResult);
  const showStarfield = !showResultScreen;

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
      {showResultScreen ? (
        <ResultScreen
          scores={/** @type {number[]} */ (state.scores)}
          result={finalResult}
          onRestart={handleRestart}
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
                  onAnswerDimension={(index, value) =>
                    dispatch({
                      type: "ANSWER_DIMENSION",
                      payload: { index, value },
                    })
                  }
                  onAnswerPillar={(w) =>
                    dispatch({ type: "ANSWER_PILLAR", payload: w })
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
