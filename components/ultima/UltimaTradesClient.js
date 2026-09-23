"use client";

import { useMemo, useState } from "react";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
} from "@/lib/ultima/constants";
import { ultimaColourHex } from "@/lib/ultima/constants";
import { expectedUltimaPoints } from "@/lib/ultima/projected-points";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaLocalTime from "./UltimaLocalTime";
import UltimaPanel from "./UltimaPanel";
import UltimaPlayerSheet from "./UltimaPlayerSheet";
import UltimaRow from "./UltimaRow";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaStatsStrip from "./UltimaStatsStrip";
import UltimaStatusBar from "./UltimaStatusBar";
import UltimaValueNumber, { percentileInList } from "./UltimaValueNumber";
import styles from "./ultima.module.css";

function pts(player) {
  return expectedUltimaPoints(player);
}

function sumPts(list) {
  return (list ?? []).reduce((n, player) => n + (Number.isFinite(pts(player)) ? pts(player) : 0), 0);
}

function fairness(give, get) {
  const a = sumPts(give);
  const b = sumPts(get);
  const avg = (a + b) / 2 || 1;
  const gap = Math.abs(a - b) / avg;
  if (gap <= 0.1) return { label: "Even", tone: "teal", ratio: 1, diff: b - a };
  return {
    label: b > a ? "Leans your way" : "Leans their way",
    tone: "muted",
    ratio: Math.min(a, b) / Math.max(a, b || 1),
    diff: b - a,
  };
}

function floorBreaks(roster, giveIds, incoming) {
  const next = (roster ?? []).filter((p) => !giveIds.includes(p.id)).concat(incoming ?? []);
  const counts = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));
  for (const player of next) {
    if (player.league in counts) counts[player.league] += 1;
  }
  return ULTIMA_LEAGUES.filter((l) => counts[l] < ULTIMA_SQUAD_FLOOR_PER_LEAGUE);
}

function floorLine(broken, prefix) {
  if (!broken.length) return { ok: true, text: `${prefix}Floor holds` };
  const tags = broken.map((l) => ULTIMA_LEAGUE_SHORT[l]).join(", ");
  return {
    ok: false,
    text: `${prefix}Breaks ${tags} floor`,
  };
}

function TradePlayerRow({ player, index, selected, onToggle, onOpen, points }) {
  const value = pts(player);
  return (
    <div className={`${styles.dPickRow} ${styles.dPickRowMarket}`}>
      <button type="button" className={styles.dPickMain} onClick={() => onOpen(player)}>
        <span className={styles.dPickRank}>{index + 1}</span>
        <span className={styles.dPickCopy}>
          <span className={styles.dPickName}>{player.name || "-"}</span>
          <span className={styles.dPickMeta}>
            {player.club || "-"}
            {" · "}
            {player.position || "-"}{" "}
            <UltimaCountryTag league={player.league} />
          </span>
        </span>
        <span className={styles.dPickVals}>
          <span className={styles.dPickPts}>
            <UltimaValueNumber
              value={Number.isFinite(value) ? value : null}
              percentile={percentileInList(value, points)}
              digits={1}
            />
          </span>
        </span>
      </button>
      {onToggle ? (
        <button
          type="button"
          className={selected ? styles.dPickPlusOn : styles.dPickPlus}
          onClick={() => onToggle(player.id)}
          aria-pressed={selected}
          aria-label={selected ? `Remove ${player.name}` : `Add ${player.name}`}
        >
          {selected ? "✓" : "+"}
        </button>
      ) : (
        <span className={styles.dPickSignOff} />
      )}
    </div>
  );
}

function OfferRow({ offer, selected, onSelect }) {
  return (
    <button
      type="button"
      className={selected ? `${styles.trOffer} ${styles.trOfferOn}` : styles.trOffer}
      style={{ "--team": ultimaColourHex(offer.other.colour) }}
      onClick={() => onSelect(offer.id)}
    >
      <span className={styles.trOfferCopy}>
        <span className={styles.trOfferName}>
          {offer.unread ? <span className={styles.opInboxDot} aria-hidden /> : null}
          {offer.other.team_name}
        </span>
        <span className={styles.trOfferMgr}>{offer.other.manager_name || "-"}</span>
        <span className={styles.trOfferSum}>{offer.summary}</span>
      </span>
      <span
        className={offer.chip === "In veto" ? styles.trChipVeto : styles.trChip}
      >
        {offer.chip}
        {offer.chip === "In veto" && offer.vetoCountdown ? ` ${offer.vetoCountdown}` : ""}
      </span>
    </button>
  );
}

function Negotiation({
  offer,
  office,
  windowOpen,
  busy,
  error,
  onAccept,
  onDecline,
  onCounter,
  onVeto,
  onOpenPlayer,
  onRetry,
}) {
  const fair = fairness(offer.youGive, offer.youGet);
  const givePts = sumPts(offer.youGive);
  const getPts = sumPts(offer.youGet);
  const points = [...offer.youGive, ...offer.youGet].map(pts);
  const leftId = offer.party ? office.myId : offer.proposerId;
  const rightId = offer.party ? offer.other.id : offer.receiverId;
  const youRoster = office.rosters[leftId] ?? [];
  const themRoster = office.rosters[rightId] ?? [];
  const youBreak = floorBreaks(
    youRoster,
    offer.youGive.map((p) => p.id),
    offer.youGet,
  );
  const themBreak = floorBreaks(
    themRoster,
    offer.youGet.map((p) => p.id),
    offer.youGive,
  );
  const youFloor = floorLine(youBreak, offer.party ? "" : `${offer.proposer?.team_name ?? "Club"} `);
  const themFloor = floorLine(themBreak, offer.party ? "" : `${offer.receiver?.team_name ?? "Club"} `);
  const leftTitle = offer.party ? "You give" : offer.proposer?.team_name ?? "Give";
  const rightTitle = offer.party ? "You get" : offer.receiver?.team_name ?? "Get";

  return (
    <UltimaPanel
      raised
      live={offer.chip === "In veto"}
      title={offer.other.team_name}
      action={<span className={offer.chip === "In veto" ? styles.trChipVeto : styles.trChip}>{offer.chip}</span>}
    >
      <div className={styles.trDeal}>
        <div>
          <p className={styles.trColHead}>{leftTitle}</p>
          {offer.youGive.map((player, index) => (
            <TradePlayerRow
              key={player.id}
              player={player}
              index={index}
              onOpen={onOpenPlayer}
              points={points}
            />
          ))}
          <p className={styles.trTotal}>
            <UltimaValueNumber value={givePts} digits={1} />
          </p>
        </div>
        <div>
          <p className={styles.trColHead}>{rightTitle}</p>
          {offer.youGet.map((player, index) => (
            <TradePlayerRow
              key={player.id}
              player={player}
              index={index}
              onOpen={onOpenPlayer}
              points={points}
            />
          ))}
          <p className={styles.trTotal}>
            <UltimaValueNumber value={getPts} digits={1} />
            <span className={styles.trDiff}>
              {fair.diff === 0 ? "Even" : fair.diff > 0 ? `+${fair.diff.toFixed(1)}` : fair.diff.toFixed(1)}
            </span>
          </p>
        </div>
      </div>

      <UltimaStatusBar
        label={fair.label}
        value={fair.label}
        ratio={fair.ratio}
        tone={fair.tone === "teal" ? undefined : "muted"}
      />

      <p className={youFloor.ok ? styles.trFloorOk : styles.trFloorBad}>{youFloor.text}</p>
      <p className={themFloor.ok ? styles.trFloorOk : styles.trFloorBad}>{themFloor.text}</p>

      {offer.canAccept && windowOpen ? (
        <div className={styles.trActions}>
          <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={onAccept}>
            Accept
          </button>
          <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={onDecline}>
            Decline
          </button>
          <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={onCounter}>
            Counter
          </button>
        </div>
      ) : null}

      {offer.canVeto ? (
        offer.alreadyVetoed ? (
          <p className={styles.trFloorBad}>You vetoed this.</p>
        ) : (
          <div className={styles.trActions}>
            <button type="button" className={styles.vetoBtn} disabled={busy} onClick={onVeto}>
              Veto
            </button>
          </div>
        )
      ) : null}

      {error ? (
        <UltimaStaffMessage subject={error} actionLabel="Retry" onAction={onRetry} />
      ) : null}
    </UltimaPanel>
  );
}

export default function UltimaTradesClient({ office, selectedId = null }) {
  const [tab, setTab] = useState("received");
  const [openId, setOpenId] = useState(selectedId);
  const [step, setStep] = useState(1);
  const [receiverId, setReceiverId] = useState("");
  const [giveIds, setGiveIds] = useState([]);
  const [getIds, setGetIds] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAct, setLastAct] = useState(null);

  const offers = office?.offers ?? [];
  const open = offers.find((o) => o.id === openId) ?? null;
  const list =
    tab === "sent" ? office?.sent ?? [] : tab === "league" ? office?.league ?? [] : office?.received ?? [];

  const receiver = (office?.clubs ?? []).find((c) => c.id === receiverId) ?? null;
  const myRoster = office?.myRoster ?? [];
  const theirRoster = receiverId ? office?.rosters?.[receiverId] ?? [] : [];
  const givePlayers = myRoster.filter((p) => giveIds.includes(p.id));
  const getPlayers = theirRoster.filter((p) => getIds.includes(p.id));
  const composeFair = fairness(givePlayers, getPlayers);
  const composePoints = [...givePlayers, ...getPlayers].map(pts);
  const youBreak = floorBreaks(myRoster, giveIds, getPlayers);
  const themBreak = floorBreaks(theirRoster, getIds, givePlayers);
  const even = giveIds.length === getIds.length && giveIds.length > 0;
  const floorOk = !youBreak.length && !themBreak.length;
  const sheetPoints = useMemo(
    () => (sheet ? [pts(sheet)] : []),
    [sheet],
  );

  if (!office) {
    return (
      <UltimaStaffMessage
        subject="The trade desk did not load"
        body="The office could not read offers. Refresh the page."
      />
    );
  }

  async function act(body) {
    setLoading(true);
    setError("");
    setLastAct(body);
    try {
      const res = await fetch("/api/ultima/trades/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? "The trade desk could not update.");
      else window.location.reload();
    } catch {
      setError("Connection lost.");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!even || !floorOk || !receiverId) return;
    setLoading(true);
    setError("");
    setLastAct("send");
    try {
      const res = await fetch("/api/ultima/trades/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiver_id: receiverId,
          give_player_ids: giveIds,
          get_player_ids: getIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message ?? "That trade did not land.");
      else window.location.reload();
    } catch {
      setError("Connection lost.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(listIds, setList, id) {
    setList((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function startCounter(offer) {
    setTab("compose");
    setStep(2);
    setReceiverId(offer.other.id);
    setGiveIds(offer.youGive.map((p) => p.id));
    setGetIds(offer.youGet.map((p) => p.id));
    setOpenId(null);
    setError("");
  }

  const clubs = (office.clubs ?? []).filter((c) => !c.yours && !c.is_bot);

  return (
    <div className={open && tab !== "compose" ? `${styles.trPage} ${styles.trPageOpen}` : styles.trPage}>
      <UltimaStatsStrip items={office.stats} />

      <div className={styles.hubTabs} role="tablist" aria-label="Trades">
        {[
          ["received", "Received"],
          ["sent", "Sent"],
          ["league", "League"],
          ["compose", "New offer"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? styles.deskTabOn : styles.deskTab}
            onClick={() => {
              setTab(id);
              if (id !== "compose") setStep(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {!office.windowOpen ? (
        <>
          <UltimaStaffMessage subject="The trade window opens after the gameweek." />
          {office.reopenAt ? (
            <p className={styles.mkReopen}>
              Reopens <UltimaLocalTime value={office.reopenAt} />
            </p>
          ) : null}
        </>
      ) : null}

      <div className={styles.trDesk}>
        <div className={styles.trList}>
          {tab === "compose" ? (
            <UltimaPanel raised title="New offer">
              {!office.windowOpen ? (
                <UltimaStaffMessage subject="The trade window opens after the gameweek." />
              ) : step === 1 ? (
                clubs.map((club) => (
                  <div key={club.id} style={{ "--team": ultimaColourHex(club.colour) }}>
                    <UltimaRow
                      className={styles.trClubRow}
                      primary={`${club.rank}. ${club.team_name}`}
                      meta={club.manager_name || "-"}
                      onClick={() => {
                        setReceiverId(club.id);
                        setGiveIds([]);
                        setGetIds([]);
                        setStep(2);
                      }}
                    />
                  </div>
                ))
              ) : (
                <>
                  <p className={styles.trCounter}>
                    {giveIds.length} for {getIds.length}
                    {receiver ? ` · ${receiver.team_name}` : ""}
                  </p>
                  <p className={styles.trColHead}>Your squad</p>
                  {myRoster.map((player, index) => (
                    <TradePlayerRow
                      key={player.id}
                      player={player}
                      index={index}
                      selected={giveIds.includes(player.id)}
                      onToggle={(id) => toggle(giveIds, setGiveIds, id)}
                      onOpen={setSheet}
                      points={myRoster.map(pts)}
                    />
                  ))}
                  <p className={styles.trColHead}>{receiver?.team_name ?? "Their squad"}</p>
                  {theirRoster.map((player, index) => (
                    <TradePlayerRow
                      key={player.id}
                      player={player}
                      index={index}
                      selected={getIds.includes(player.id)}
                      onToggle={(id) => toggle(getIds, setGetIds, id)}
                      onOpen={setSheet}
                      points={theirRoster.map(pts)}
                    />
                  ))}
                  <div className={styles.trActions}>
                    <button type="button" className={styles.secondaryBtn} onClick={() => setStep(1)}>
                      Club
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={!even}
                      onClick={() => setStep(3)}
                    >
                      Review
                    </button>
                  </div>
                </>
              )}
            </UltimaPanel>
          ) : list.length ? (
            <UltimaPanel raised title={tab === "league" ? "League" : tab === "sent" ? "Sent" : "Received"}>
              {list.map((offer) => (
                <OfferRow
                  key={offer.id}
                  offer={offer}
                  selected={offer.id === openId}
                  onSelect={setOpenId}
                />
              ))}
            </UltimaPanel>
          ) : (
            <UltimaStaffMessage
              subject="No offers yet. Make the first move."
              actionLabel={office.windowOpen ? "New offer" : undefined}
              onAction={office.windowOpen ? () => setTab("compose") : undefined}
            />
          )}
        </div>

        <div className={styles.trSide}>
          {tab === "compose" && step === 3 && office.windowOpen ? (
            <UltimaPanel raised title="Review">
              <p className={styles.trCounter}>
                {giveIds.length} for {getIds.length}
                {receiver ? ` · ${receiver.team_name}` : ""}
              </p>
              <div className={styles.trDeal}>
                <div>
                  <p className={styles.trColHead}>You give</p>
                  {givePlayers.map((player, index) => (
                    <TradePlayerRow
                      key={player.id}
                      player={player}
                      index={index}
                      onOpen={setSheet}
                      points={composePoints}
                    />
                  ))}
                  <p className={styles.trTotal}>
                    <UltimaValueNumber value={sumPts(givePlayers)} digits={1} />
                  </p>
                </div>
                <div>
                  <p className={styles.trColHead}>You get</p>
                  {getPlayers.map((player, index) => (
                    <TradePlayerRow
                      key={player.id}
                      player={player}
                      index={index}
                      onOpen={setSheet}
                      points={composePoints}
                    />
                  ))}
                  <p className={styles.trTotal}>
                    <UltimaValueNumber value={sumPts(getPlayers)} digits={1} />
                  </p>
                </div>
              </div>
              <UltimaStatusBar
                label={composeFair.label}
                value={composeFair.label}
                ratio={composeFair.ratio}
                tone={composeFair.tone === "teal" ? undefined : "muted"}
              />
              <p className={!youBreak.length ? styles.trFloorOk : styles.trFloorBad}>
                {floorLine(youBreak, "").text}
              </p>
              <p className={!themBreak.length ? styles.trFloorOk : styles.trFloorBad}>
                {floorLine(themBreak, "").text}
              </p>
              <div className={styles.trActions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setStep(2)}>
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={loading || !even || !floorOk}
                  onClick={send}
                >
                  Send
                </button>
              </div>
              {error ? (
                <UltimaStaffMessage
                  subject={error}
                  actionLabel="Retry"
                  onAction={send}
                />
              ) : null}
            </UltimaPanel>
          ) : open ? (
            <div className={styles.trSheetDesk}>
              <Negotiation
                offer={open}
                office={office}
                windowOpen={office.windowOpen}
                busy={loading}
                error={error}
                onAccept={() => act({ trade_id: open.id, accept: true })}
                onDecline={() => act({ trade_id: open.id, accept: false })}
                onCounter={() => startCounter(open)}
                onVeto={() => act({ trade_id: open.id, veto: true })}
                onOpenPlayer={setSheet}
                onRetry={() => lastAct && lastAct !== "send" && act(lastAct)}
              />
            </div>
          ) : tab !== "compose" ? (
            <p className={styles.mkReopen}>Tap an offer to open the negotiation.</p>
          ) : null}
        </div>
      </div>

      {open && tab !== "compose" ? (
        <div className={styles.trSheetMobile}>
          <Negotiation
            offer={open}
            office={office}
            windowOpen={office.windowOpen}
            busy={loading}
            error={error}
            onAccept={() => act({ trade_id: open.id, accept: true })}
            onDecline={() => act({ trade_id: open.id, accept: false })}
            onCounter={() => startCounter(open)}
            onVeto={() => act({ trade_id: open.id, veto: true })}
            onOpenPlayer={setSheet}
            onRetry={() => lastAct && lastAct !== "send" && act(lastAct)}
          />
          <button type="button" className={styles.opPanelAction} onClick={() => setOpenId(null)}>
            Back
          </button>
        </div>
      ) : null}

      {sheet ? (
        <UltimaPlayerSheet
          player={sheet}
          points={sheetPoints}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </div>
  );
}
