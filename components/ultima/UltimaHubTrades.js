"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UltimaPanel from "./UltimaPanel";
import UltimaRow from "./UltimaRow";
import UltimaStaffMessage from "./UltimaStaffMessage";
import styles from "./ultima.module.css";

function hoursLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "Window closing";
  const hours = Math.max(1, Math.ceil(ms / 3_600_000));
  return `${hours}h left`;
}

export default function UltimaHubTrades({ initialCards = [], managerId }) {
  const [cards, setCards] = useState(initialCards);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  if (!cards.length) return null;

  const vetoLive = cards.some((card) => card.state === "review");

  async function act(tradeId, body) {
    setBusyId(tradeId);
    setError("");
    try {
      const res = await fetch("/api/ultima/trades/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade_id: tradeId, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "That did not land.");
        return;
      }
      if (body.veto && !data.vetoed) {
        setCards((current) =>
          current.map((card) =>
            card.id === tradeId
              ? {
                  ...card,
                  already_vetoed: true,
                  veto_count: card.veto_count + 1,
                }
              : card,
          ),
        );
        return;
      }
      if (body.accept) {
        setCards((current) =>
          current.map((card) =>
            card.id === tradeId
              ? {
                  ...card,
                  state: "review",
                  can_accept: false,
                  can_veto: false,
                }
              : card,
          ),
        );
        return;
      }
      setCards((current) => current.filter((card) => card.id !== tradeId));
    } catch {
      setError("Connection lost. Try again.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <UltimaPanel
      title="Trade desk"
      raised
      live={vetoLive}
      id="ultima-trades"
      action={
        <Link href="/ultima/trades" className={styles.opPanelAction}>
          Board
        </Link>
      }
    >
      {cards.map((card) => (
        <div key={card.id}>
          <UltimaRow
            href={`/ultima/trades/${card.id}`}
            primary={`${card.proposer_name} to ${card.receiver_name}`}
            meta={[
              card.state === "proposed" ? "Proposal" : "League review",
              card.state === "review" && card.review_expires_at
                ? hoursLeft(card.review_expires_at)
                : null,
              `${card.giving.join(", ") || "Players"} for ${card.getting.join(", ") || "players"}`,
              card.verdict || null,
              card.state === "review"
                ? `${card.veto_count} veto${card.veto_count === 1 ? "" : "es"} so far`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          {card.can_accept ? (
            <div className={styles.hubTradeActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busyId === card.id}
                onClick={() => act(card.id, { accept: true })}
              >
                {busyId === card.id ? "…" : "Accept"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busyId === card.id}
                onClick={() => act(card.id, { accept: false })}
              >
                Decline
              </button>
            </div>
          ) : null}
          {card.can_veto ? (
            <div className={styles.hubTradeActions}>
              {card.already_vetoed ? (
                <p className={styles.opRowMeta}>You vetoed this.</p>
              ) : (
                <button
                  type="button"
                  className={styles.vetoBtn}
                  disabled={busyId === card.id}
                  onClick={() => act(card.id, { veto: true })}
                >
                  {busyId === card.id ? "…" : "Veto"}
                </button>
              )}
            </div>
          ) : null}
          {card.state === "review" &&
          (card.proposer_id === managerId || card.receiver_id === managerId) ? (
            <p className={`${styles.opRowMeta} ${styles.hubTradeNote}`}>
              You are in this trade. The league reviews it.
            </p>
          ) : null}
        </div>
      ))}
      {error ? (
        <UltimaStaffMessage subject="The trade desk could not update" body={error} />
      ) : null}
    </UltimaPanel>
  );
}
