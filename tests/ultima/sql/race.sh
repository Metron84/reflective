#!/usr/bin/env bash
# Two sessions race for the same rows. Usage: race.sh <bin dir> <socket dir>
# Session A holds its transaction open for 2 seconds. Session B starts half a
# second later and must queue behind A, then see A's committed result.
set -euo pipefail
BIN="$1"; D="$2"
Q() { "$BIN/psql" -h "$D" -p 5547 -v ON_ERROR_STOP=1 -qAt postgres "$@"; }

Q -c "create temp table pc_comp (id uuid); select pc.setup();" >/dev/null

SQL_IDS="
  with c as (select id from public.ultima_competition where season_label = 'pc'),
  m as (select team_name, id from public.ultima_managers where competition_id = (select id from c))
"
ids() { Q -c "$SQL_IDS select id from m where team_name = '$1'"; }
player() { Q -c "select id from public.ultima_players where name = '$1'"; }
M1=$(ids Team1); M2=$(ids Team2); M3=$(ids Team3)
COMP=$(Q -c "select id from public.ultima_competition where season_label = 'pc'")
GW=$(Q -c "select id from public.ultima_gameweeks where competition_id = '$COMP'")

# --- Race 1: two accepts for one player ------------------------------------
P1=$(player M1-pl-1); G2=$(player M2-pl-1); G3=$(player M2-pl-2)
A=$(Q -c "insert into public.ultima_trades (competition_id, proposer_id, receiver_id, state) values ('$COMP', '$M1', '$M2', 'proposed') returning id")
B=$(Q -c "insert into public.ultima_trades (competition_id, proposer_id, receiver_id, state) values ('$COMP', '$M1', '$M3', 'proposed') returning id")
Q -c "insert into public.ultima_trade_players values ('$A', '$P1', '$M1', '$M2'), ('$A', '$G2', '$M2', '$M1'), ('$B', '$P1', '$M1', '$M3')" >/dev/null

Q -c "begin; select public.ultima_accept_trade('$A', '$M2'); select pg_sleep(2); commit;" > /tmp/race_a.out &
PA=$!
sleep 0.5
Q -c "select public.ultima_accept_trade('$B', '$M3')" > /tmp/race_b.out
wait $PA
SA=$(Q -c "select state from public.ultima_trades where id = '$A'")
SB=$(Q -c "select state from public.ultima_trades where id = '$B'")
RB=$(Q -c "select void_reason from public.ultima_trades where id = '$B'")
echo "race 1: A=$SA B=$SB ($RB)"
[ "$SA" = "review" ] && [ "$SB" = "void" ] && [ "$RB" = "player_in_accepted_deal" ] \
  || { echo "FAIL: two accepts both survived or the wrong one won"; exit 1; }
[ "$(Q -c "select count(*) from public.ultima_trades where competition_id = '$COMP' and state = 'review'")" = "1" ] \
  || { echo "FAIL: more than one accepted deal holds the player"; exit 1; }

# --- Race 2: two managers sign one free agent ------------------------------
FA=$(player FA-pl-1); D1=$(player M1-pl-2); D2=$(player M2-pl-3)
Q -c "begin; select public.ultima_sign_player('$M1', '$FA', '$D1', '$GW', 20, 3); select pg_sleep(2); commit;" > /tmp/race_c.out &
PC=$!
sleep 0.5
RES=$(Q -c "select public.ultima_sign_player('$M2', '$FA', '$D2', '$GW', 20, 3)")
wait $PC
OWNER=$(Q -c "select manager_id from public.ultima_rosters where player_id = '$FA'")
echo "race 2: owner is Team1: $([ "$OWNER" = "$M1" ] && echo yes || echo no); loser got $RES"
[ "$OWNER" = "$M1" ] || { echo "FAIL: the first signing did not win"; exit 1; }
echo "$RES" | grep -q '"code": "PICK_TAKEN"' || { echo "FAIL: loser did not get PICK_TAKEN"; exit 1; }
echo "$RES" | grep -q '"taken_by": "Team1"' || { echo "FAIL: loser was not told who signed him"; exit 1; }
[ "$(Q -c "select count(*) from public.ultima_rosters where manager_id = '$M2'")" = "20" ] \
  || { echo "FAIL: loser's squad changed"; exit 1; }
echo "races: all passed"
