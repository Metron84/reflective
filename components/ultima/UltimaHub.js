import Link from "next/link";
import UltimaCountryTag from "./UltimaCountryTag";
import UltimaHubForm from "./UltimaHubForm";
import UltimaHubInbox from "./UltimaHubInbox";
import UltimaHubRadio from "./UltimaHubRadio";
import UltimaHubTrades from "./UltimaHubTrades";
import UltimaInstallHint from "./UltimaInstallHint";
import UltimaLocalTime from "./UltimaLocalTime";
import UltimaPanel from "./UltimaPanel";
import UltimaRow from "./UltimaRow";
import UltimaStaffMessage from "./UltimaStaffMessage";
import UltimaStatsStrip from "./UltimaStatsStrip";
import styles from "./ultima.module.css";

function scoreNumber(row) {
  if (row?.homeScore == null || row?.awayScore == null) return null;
  return `${row.homeScore}-${row.awayScore}`;
}

function NextMatchPanel({ match, hasRoster }) {
  if (!hasRoster) {
    return (
      <UltimaPanel title="Next match">
        <UltimaStaffMessage
          subject="No fixture involving your players"
          body="Your squad is empty. Draft or market fills this window."
        />
      </UltimaPanel>
    );
  }

  if (!match) {
    return (
      <UltimaPanel title="Next match">
        <UltimaStaffMessage
          subject="No fixture involving your players"
          body="No fixture involving your players is on the slate yet. The scouts report when Sportmonks does."
        />
      </UltimaPanel>
    );
  }

  return (
    <UltimaPanel title="Next match" live={match.live}>
      <UltimaRow
        primary={`${match.home} v ${match.away}`}
        number={scoreNumber(match)}
        yours
      >
        <p className={styles.opRowMeta}>
          <UltimaCountryTag league={match.league} />
          {match.live ? " LIVE · " : " "}
          <UltimaLocalTime value={match.kickoff} />
        </p>
      </UltimaRow>
    </UltimaPanel>
  );
}

function ScoutingPanel({ groups }) {
  if (!groups?.length) {
    return (
      <UltimaPanel title="Scouting window">
        <UltimaStaffMessage
          subject="No fixtures synced yet"
          body="No fixtures synced yet. The scouts report when Sportmonks does."
        />
      </UltimaPanel>
    );
  }

  return (
    <UltimaPanel title="Scouting window">
      {groups.map((group) => (
        <div key={group.key}>
          <p className={styles.hubDateHead}>{group.label}</p>
          {group.rows.map((row) => (
            <UltimaRow
              key={row.id}
              primary={`${row.home} v ${row.away}`}
              number={scoreNumber(row)}
              yours={row.yours}
            >
              <p className={styles.opRowMeta}>
                <UltimaCountryTag league={row.league} />{" "}
                {row.live ? "LIVE" : <UltimaLocalTime value={row.kickoff} />}
              </p>
            </UltimaRow>
          ))}
        </div>
      ))}
    </UltimaPanel>
  );
}

function MoversPanel({ movers }) {
  const rising = movers?.rising ?? [];
  const falling = movers?.falling ?? [];
  if (!rising.length && !falling.length) {
    return (
      <UltimaPanel title="Movers">
        <UltimaStaffMessage
          subject="No rating movers yet"
          body="No rating movers yet. The scouts report when Sportmonks does."
        />
      </UltimaPanel>
    );
  }

  return (
    <UltimaPanel title="Movers">
      {rising.map((row) => (
        <UltimaRow
          key={`up-${row.playerId}`}
          primary={row.name}
          meta={[row.club, row.leagueCode].filter(Boolean).join(" · ")}
          number={
            <span className={styles.opStatDeltaUp}>
              {`+${row.delta.toFixed(2)}`}
            </span>
          }
        />
      ))}
      {falling.map((row) => (
        <UltimaRow
          key={`down-${row.playerId}`}
          primary={row.name}
          meta={[row.club, row.leagueCode].filter(Boolean).join(" · ")}
          number={
            <span className={styles.opStatDeltaMuted}>
              {row.delta.toFixed(2)}
            </span>
          }
        />
      ))}
    </UltimaPanel>
  );
}

function TablePanel({ table }) {
  const top4 = table?.top4 ?? [];
  if (!top4.length) {
    return (
      <UltimaPanel title="Table" actionLabel="Full table" actionHref="/ultima/standings">
        <UltimaStaffMessage
          subject="The Ultima table is empty"
          body="The Ultima table is empty. Season points land after the first scored gameweek."
        />
      </UltimaPanel>
    );
  }

  return (
    <UltimaPanel title="Table" actionLabel="Full table" actionHref="/ultima/standings">
      {top4.map((row) => (
        <UltimaRow
          key={row.id}
          yours={row.yours}
          primary={`${row.rank}. ${row.team_name}`}
          number={
            <span className={styles.opValueMid}>
              {row.seasonPoints}
            </span>
          }
        />
      ))}
      {table.youOutside ? (
        <UltimaRow
          yours
          primary={`${table.youOutside.rank}. ${table.youOutside.team_name}`}
          number={
            <span className={styles.opValueMid}>
              {table.youOutside.seasonPoints}
            </span>
          }
        />
      ) : null}
    </UltimaPanel>
  );
}

export default function UltimaHub({ isSignedIn, manager, office = null }) {
  if (!manager) {
    return (
      <div className={styles.hub}>
        {!isSignedIn ? (
          <p className={styles.hubNote}>
            Invite only.{" "}
            <Link href="/signin?next=/ultima/join" className={styles.quietLink}>
              Sign in to join
            </Link>
          </p>
        ) : (
          <p className={styles.hubNote}>
            <Link href="/ultima/join" className={styles.quietLink}>
              Enter your invite password
            </Link>
            {" · "}
            <Link href="/ultima/rules" className={styles.quietLink}>
              Read the rules
            </Link>
          </p>
        )}
      </div>
    );
  }

  if (!office) {
    return (
      <div className={styles.hub}>
        <UltimaStaffMessage
          subject="The hub did not load"
          body="The office could not read league state. Refresh the page."
        />
      </div>
    );
  }

  const hasTrades = Boolean(office.trades?.length);
  const inboxEmpty = !office.inbox?.preview?.length && !office.inbox?.rest?.length;

  return (
    <div className={styles.hub}>
      <div className={hasTrades ? styles.hubOffice : styles.hubOfficeNoTrade}>
        <div className={styles.hubStats}>
          <UltimaPanel title="This week">
            <UltimaStatsStrip items={office.stats} />
          </UltimaPanel>
        </div>

        {hasTrades ? (
          <div className={styles.hubTrade}>
            <UltimaHubTrades initialCards={office.trades} managerId={office.managerId} />
          </div>
        ) : null}

        <div className={styles.hubInbox}>
          <UltimaPanel title="Inbox">
            {inboxEmpty ? (
              <UltimaStaffMessage
                subject="The inbox is quiet"
                body="League mail lands when seats, picks, and results move."
              />
            ) : (
              <UltimaHubInbox preview={office.inbox.preview} rest={office.inbox.rest} />
            )}
          </UltimaPanel>
        </div>

        <div className={styles.hubNext}>
          <NextMatchPanel match={office.nextMatch} hasRoster={office.hasRoster} />
        </div>

        <div className={styles.hubScout}>
          <ScoutingPanel groups={office.scouting} />
        </div>

        <div className={styles.hubForm}>
          <UltimaPanel title="Form">
            <UltimaHubForm teams={office.form.teams} players={office.form.players} />
          </UltimaPanel>
        </div>

        <div className={styles.hubMovers}>
          <MoversPanel movers={office.movers} />
        </div>

        <div className={styles.hubTable}>
          <TablePanel table={office.table} />
        </div>

        <div className={styles.hubRadio}>
          <UltimaHubRadio
            initialMessages={office.chat}
            managerId={office.managerId}
          />
        </div>
      </div>

      <UltimaInstallHint />
    </div>
  );
}
