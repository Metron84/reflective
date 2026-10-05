import { loanFromLine } from "@/lib/ultima/player-club";
import styles from "./ultima.module.css";

/** Club name plus muted "on loan from …" when Sportmonks marks a loan. */
export default function UltimaPlayerClub({ player, className }) {
  const loan = loanFromLine(player);
  return (
    <span className={className}>
      {player?.club || "-"}
      {loan ? <span className={styles.clubLoan}> {loan}</span> : null}
    </span>
  );
}
