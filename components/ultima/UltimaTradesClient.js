"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
} from "@/lib/ultima/constants";
import { ultimaColourHex } from "@/lib/ultima/constants";
import { reviewBlock } from "@/lib/ultima/trades/rules";
import { formatClubLine } from "@/lib/ultima/player-club";
import { expectedUltimaPoints } from "@/lib/ultima/projected-points";
import UltimaActionButton from "./UltimaActionButton";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaLocalTime from "./UltimaLocalTime";
import UltimaPanel from "./UltimaPanel";
import { useUltimaPlayerCard } from "./UltimaPlayerCard";
import UltimaRow from "./UltimaRow";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaStatsStrip from "./UltimaStatsStrip";
import UltimaStatusBar from "./UltimaStatusBar";
import UltimaTradeBlock from "./UltimaTradeBlock";
import UltimaUntouchableChip from "./UltimaUntouchableChip";
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

const CLOSED_COPY = {
  TRADE_DEADLINE: "The trade deadline has passed.",
};

function closedLine(office) {
  return CLOSED_COPY[office.windowReason] ?? "Trades are closed right now.";
}

/** "Executes Fri 00:00. GER is locked this week." Times are Gulf Standard Time. */
function holdLine(offer) {
  if (offer.state !== "awaiting_unlock") return null;
  const when = offer.unlockAt
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: "Asia/Dubai",
      })
        .format(new Date(offer.unlockAt))
        .replace(",", "")
    : "after the gameweek";
  const tags = (offer.heldLeagues ?? []).map((l) => ULTIMA_LEAGUE_SHORT[l]);
  const lock = tags.length
    ? ` ${tags.join(", ")} ${tags.length === 1 ? "is" : "are"} locked this week.`
    : "";
  return `Executes ${when}.${lock}`;
}

function floorLine(broken, prefix) {
  if (!broken.length) return { ok: true, text: `${prefix}Floor holds` };
  const tags = broken.map((l) => ULTIMA_LEAGUE_SHORT[l]).join(", ");
  return {
    ok: false,
    text: `${prefix}Breaks ${tags} floor`,
  };
}

function TradePlayerRow({ player, index, selected, onToggle, onOpen, points, untouchable = false }) {
  const value = pts(player);
  return (
    <div className={`${styles.dPickRow} ${styles.dPickRowMarket}`}>
      <button type="button" className={styles.dPickMain} onClick={() => onOpen(player)}>
        <span className={styles.dPickRank}>{index + 1}</span>
        <span className={styles.dPickCopy}>
          <span className={styles.dPickName}>
            {player.name || "-"}
            {untouchable ? <UltimaUntouchableChip /> : null}
          </span>
          <span className={styles.dPickMeta}>
            {formatClubLine(player)}
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
      {onToggle && !untouchable ? (
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

const GROUPS = [
  { id: "live", label: "Live" },
  { id: "accepted", label: "Accepted" },
  { id: "done", label: "Done" },
  { id: "closed", label: "Closed" },
];

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
        <span className={styles.trOfferSum}>
          {offer.party ? offer.summary : `${offer.proposer?.team_name ?? "A club"} to ${offer.receiver?.team_name ?? "a club"} · ${offer.summary}`}
        </span>
        {offer.expiresIn ? <span className={styles.trOfferMgr}>Expires in {offer.expiresIn}</span> : null}
        {offer.voidLine ? <span className={styles.trOfferMgr}>{offer.voidLine}</span> : null}
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
  onDone,
  onCounter,
  onWithdraw,
  onOpenPlayer,
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
              untouchable={Boolean(office.untouchable?.[player.id])}
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
              untouchable={Boolean(office.untouchable?.[player.id])}
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

      {holdLine(offer) ? <p className={styles.trFloorOk}>{holdLine(offer)}</p> : null}
      <p className={youFloor.ok ? styles.trFloorOk : styles.trFloorBad}>{youFloor.text}</p>
      <p className={themFloor.ok ? styles.trFloorOk : styles.trFloorBad}>{themFloor.text}</p>

      {offer.canAccept && windowOpen ? (
        <div className={styles.trActions}>
          <UltimaActionButton
            url="/api/ultima/trades/respond"
            body={{ trade_id: offer.id, accept: true }}
            label="Accept"
            workingLabel="Accepting…"
            doneLabel="Accepted"
            className={styles.secondaryBtn}
            onDone={onDone}
          />
          <UltimaActionButton
            url="/api/ultima/trades/respond"
            body={{ trade_id: offer.id, accept: false }}
            label="Decline"
            workingLabel="Declining…"
            doneLabel="Declined"
            className={styles.secondaryBtn}
            onDone={onDone}
          />
          <button type="button" className={styles.secondaryBtn} onClick={onCounter}>
            Counter
          </button>
        </div>
      ) : null}

      {offer.canCancel ? (
        <div className={styles.trActions}>
          <button type="button" className={styles.trWithdraw} onClick={onWithdraw}>
            Withdraw
          </button>
        </div>
      ) : null}

      {offer.canVeto ? (
        offer.alreadyVetoed ? (
          <p className={styles.trFloorBad}>You vetoed this.</p>
        ) : (
          <div className={styles.trActions}>
            <UltimaActionButton
              url="/api/ultima/trades/respond"
              body={{ trade_id: offer.id, veto: true }}
              label="Veto"
              workingLabel="Casting veto…"
              doneLabel="Veto cast"
              className={styles.vetoBtn}
              onDone={onDone}
            />
          </div>
        )
      ) : null}
    </UltimaPanel>
  );
}

export default function UltimaTradesClient({ office, selectedId = null, preview = false, initialTab = "received", initialBlockView = "board", prefill = null }) {
  const prefillClub = prefill?.offer && (office?.clubs ?? []).some((c) => c.id === prefill.offer && !c.yours && !c.is_bot) ? prefill.offer : "";
  const [tab, setTab] = useState(prefillClub || prefill?.give ? "compose" : initialTab);
  const [openId, setOpenId] = useState(selectedId);
  const [step, setStep] = useState(prefillClub ? 2 : 1);
  const [receiverId, setReceiverId] = useState(prefillClub);
  const [giveIds, setGiveIds] = useState(prefill?.give ? [prefill.give] : []);
  const [getIds, setGetIds] = useState(prefillClub && prefill?.get ? [prefill.get] : []);
  // A card "Offer in a trade" tap carries my player and waits for a club.
  const [pendingGive, setPendingGive] = useState(!prefillClub ? prefill?.give ?? null : null);
  const { openPlayer: openCard } = useUltimaPlayerCard();
  const setSheet = (player) => player?.id && openCard(player.id);
  const router = useRouter();
  const [counterOf, setCounterOf] = useState(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(null);

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
  const block = reviewBlock({
    myRoster,
    theirRoster,
    giveIds,
    getIds,
    receiverName: receiver?.team_name ?? "They",
    untouchable: office?.untouchable,
    frozen: office?.frozen,
    liveOutgoing: office?.liveOutgoing ?? 0,
    liveCap: office?.liveCap ?? 3,
  });

  if (!office) {
    return (
      <UltimaStaffMessage
        subject="The trade desk did not load"
        body="The office could not read offers. Refresh the page."
      />
    );
  }

  // A confirmed write: refresh the server data, keep the receipt toast on screen.
  function afterWrite() {
    setConfirmWithdraw(null);
    setOpenId(null);
    router.refresh();
  }

  function afterSend() {
    setStep(1);
    setReceiverId("");
    setGiveIds([]);
    setGetIds([]);
    setCounterOf(null);
    setTab("sent");
    router.refresh();
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
    setCounterOf(offer.id);
    setOpenId(null);
  }

  function startFromBlock({ receiverId: toId, getId = null, giveId = null }) {
    setTab("compose");
    setStep(2);
    setReceiverId(toId);
    setGiveIds(giveId ? [giveId] : []);
    setGetIds(getId ? [getId] : []);
    setCounterOf(null);
    setOpenId(null);
  }

  const newInterest = (office?.board?.inbox ?? []).filter((i) => i.state === "new").length;
  const isOffers = tab !== "compose" && tab !== "block";
  const clubs = (office.clubs ?? []).filter((c) => !c.yours && !c.is_bot);

  return (
    <div className={open && isOffers ? `${styles.trPage} ${styles.trPageOpen}` : styles.trPage}>
      <UltimaStatsStrip items={office.stats} />

      <div className={styles.hubTabs} role="tablist" aria-label="Trades">
        {[
          ["received", "Received"],
          ["sent", "Sent"],
          ["league", "All"],
          ["block", newInterest ? `Block · ${newInterest}` : "Block"],
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

      {!office.windowOpen && tab !== "block" ? (
        <>
          <UltimaStaffMessage subject={closedLine(office)} />
          {office.reopenAt ? (
            <p className={styles.mkReopen}>
              Reopens <UltimaLocalTime value={office.reopenAt} />
            </p>
          ) : null}
        </>
      ) : null}

      <div className={tab === "block" ? `${styles.trDesk} ${styles.trDeskSolo}` : styles.trDesk}>
        <div className={styles.trList}>
          {tab === "block" ? (
            <UltimaTradeBlock
              office={office}
              onStartOffer={startFromBlock}
              preview={preview}
              initialView={initialBlockView}
            />
          ) : tab === "compose" ? (
            <UltimaPanel raised title="New offer">
              {!office.windowOpen ? (
                <UltimaStaffMessage subject={closedLine(office)} />
              ) : step === 1 ? (
                clubs.map((club) => (
                  <div key={club.id} style={{ "--team": ultimaColourHex(club.colour) }}>
                    <UltimaRow
                      className={styles.trClubRow}
                      primary={`${club.rank}. ${club.team_name}`}
                      meta={club.manager_name || "-"}
                      onClick={() => {
                        setReceiverId(club.id);
                        setCounterOf(null);
                        setGiveIds(pendingGive ? [pendingGive] : []);
                        setGetIds([]);
                        setPendingGive(null);
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
                      untouchable={Boolean(office.untouchable?.[player.id])}
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
                      untouchable={Boolean(office.untouchable?.[player.id])}
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
                      className={styles.primaryBtn}
                      aria-describedby={block ? "trReviewReason" : undefined}
                      onClick={() => {
                        if (!block) setStep(3);
                      }}
                    >
                      Review
                    </button>
                  </div>
                  {block ? (
                    <p id="trReviewReason" className={styles.trFloorBad} role="status">
                      {block}
                    </p>
                  ) : null}
                </>
              )}
            </UltimaPanel>
          ) : list.length ? (
            <UltimaPanel raised title={tab === "league" ? "All offers" : tab === "sent" ? "Sent" : "Received"}>
              {(tab === "league" ? GROUPS : [null]).map((group) => {
                const rows = group ? list.filter((o) => o.group === group.id) : list;
                if (!rows.length) return null;
                return (
                  <div key={group?.id ?? "rows"}>
                    {group ? <p className={styles.trColHead}>{group.label}</p> : null}
                    {rows.map((offer) => (
                      <OfferRow
                        key={offer.id}
                        offer={offer}
                        selected={offer.id === openId}
                        onSelect={setOpenId}
                      />
                    ))}
                  </div>
                );
              })}
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
          {open ? (
            <div className={styles.trSheetDesk}>
              <Negotiation
                offer={open}
                office={office}
                windowOpen={office.windowOpen}
                onDone={afterWrite}
                onCounter={() => startCounter(open)}
                onWithdraw={() => setConfirmWithdraw(open.id)}
                onOpenPlayer={setSheet}
              />
            </div>
          ) : isOffers ? (
            <p className={styles.mkReopen}>Tap an offer to open the negotiation.</p>
          ) : null}
        </div>
      </div>

      {open && isOffers ? (
        <div className={styles.trSheetMobile}>
          <Negotiation
            offer={open}
            office={office}
            windowOpen={office.windowOpen}
            onDone={afterWrite}
            onCounter={() => startCounter(open)}
            onWithdraw={() => setConfirmWithdraw(open.id)}
            onOpenPlayer={setSheet}
          />
          <button type="button" className={styles.opPanelAction} onClick={() => setOpenId(null)}>
            Back
          </button>
        </div>
      ) : null}

      {tab === "compose" && step === 3 && office.windowOpen ? (
        <div className={styles.trReview} role="dialog" aria-modal="true" aria-label="Review offer">
          <button type="button" className={styles.dSheetBackdrop} aria-label="Back" onClick={() => setStep(2)} />
          <div className={styles.dSheetPanel}>
            <p className={styles.dSheetName}>Review offer</p>
            <p className={styles.trCounter}>
              {giveIds.length} for {getIds.length}
              {receiver ? ` · ${receiver.team_name}` : ""}
            </p>
            <div className={styles.trDeal}>
              <div>
                <p className={styles.trColHead}>You give</p>
                {givePlayers.map((player) => (
                  <p key={player.id} className={styles.dSheetMeta}>
                    {player.name} <UltimaCountryTag league={player.league} />
                  </p>
                ))}
              </div>
              <div>
                <p className={styles.trColHead}>You get</p>
                {getPlayers.map((player) => (
                  <p key={player.id} className={styles.dSheetMeta}>
                    {player.name} <UltimaCountryTag league={player.league} />
                  </p>
                ))}
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
            {block ? <p className={styles.trFloorBad}>{block}</p> : null}
            <div className={styles.dSheetActions}>
              <UltimaActionButton
                url="/api/ultima/trades/propose"
                body={() => ({
                  receiver_id: receiverId,
                  give_player_ids: giveIds,
                  get_player_ids: getIds,
                  counter_of: counterOf,
                })}
                label="Send offer"
                workingLabel="Sending offer…"
                doneLabel="Offer sent"
                disabled={Boolean(block) || !receiverId}
                onDone={afterSend}
              />
              <button type="button" className={styles.secondaryBtn} onClick={() => setStep(2)}>
                Back
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmWithdraw ? (
        <div className={styles.dSheet} role="dialog" aria-modal="true" aria-label="Withdraw this offer">
          <button
            type="button"
            className={styles.dSheetBackdrop}
            aria-label="Close"
            onClick={() => setConfirmWithdraw(null)}
          />
          <div className={styles.dSheetPanel}>
            <p className={styles.dSheetName}>Withdraw this offer?</p>
            <div className={styles.dSheetActions}>
              <UltimaActionButton
                url="/api/ultima/trades/respond"
                body={{ trade_id: confirmWithdraw, cancel: true }}
                label="Withdraw"
                workingLabel="Withdrawing…"
                doneLabel="Withdrawn"
                onDone={afterWrite}
              />
              <button type="button" className={styles.secondaryBtn} onClick={() => setConfirmWithdraw(null)}>
                Keep
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
