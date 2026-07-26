"use client";

import CategoryBallotSection from "./CategoryBallotSection";

/** @deprecated Prefer CategoryBallotSection directly. */
export default function BestVideoSection(props) {
  return <CategoryBallotSection {...props} index={props.index ?? 0} />;
}
