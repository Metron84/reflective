"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UltimaActionButton from "./UltimaActionButton";
import UltimaPanel from "./UltimaPanel";
import UltimaRow from "./UltimaRow";
import styles from "./ultima.module.css";

const RESPOND_URL = "/api/ultima/trades/respond";

function hoursLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "Window closing";
  const hours = Math.max(1, Math.ceil(ms / 3_600_000));
  return `${hours}h left`;
}

export default function UltimaHubTrades({ initialCards = [], managerId }) {
  const [cards, setCards] = useState(initialCards);

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  if (!cards.length) return null;

  const vetoLive = cards.some((card) => card.state === "review");

  // Runs after the server confirmed. The card changes only now.
  function applyResult(tradeId, body, data) {
    if (body.veto && !data.vetoed) {
      setCards((current) =>
        current.map((card) =>
          card.id === tradeId
            ? { ...card, already_vetoed: true, veto_count: card.veto_count + 1 }
            : card,
        ),
      );
      return;
    }
    if (body.accept) {
      setCards((current) =>
        current.map((card) =>
          card.id === tradeId
            ? { ...card, state: "review", can_accept: false, can_veto: false }
            : card,
        ),
      );
      return;
    }
    setCards((current) => current.filter((card) => card.id !== tradeId));
  }

  const respond = (tradeId, body) => ({ url: RESPOND_URL, body: { trade_id: tradeId, ...body } });

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
              <UltimaActionButton
                variant="primary"
                request={respond(card.id, { accept: true })}
                label="Accept"
                workingLabel="Accepting…"
                doneLabel="Accepted"
                onDone={(data) => applyResult(card.id, { accept: true }, data)}
              />
              <UltimaActionButton
                request={respond(card.id, { accept: false })}
                label="Decline"
                workingLabel="Declining…"
                doneLabel="Declined"
                onDone={(data) => applyResult(card.id, { accept: false }, data)}
              />
            </div>
          ) : null}
          {card.can_veto ? (
            <div className={styles.hubTradeActions}>
              {card.already_vetoed ? (
                <p className={styles.opRowMeta}>You vetoed this.</p>
              ) : (
                <UltimaActionButton
                  request={respond(card.id, { veto: true })}
                  label="Veto"
                  workingLabel="Casting veto…"
                  doneLabel="Veto cast"
                  onDone={(data) => applyResult(card.id, { veto: true }, data)}
                />
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
    </UltimaPanel>
  );
}
