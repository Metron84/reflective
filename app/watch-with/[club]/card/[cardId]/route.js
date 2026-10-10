import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { presentClub } from "@/lib/watch-with/access";
import { cardById } from "@/lib/watch-with/clubs";
import { COUNTING_VOTES } from "@/lib/watch-with/engine";
import { WATCHWITH_APP_HOST } from "@/lib/watch-with/host";
import { db } from "@/lib/watch-with/store";

export const runtime = "nodejs";

export async function GET(_request, context) {
  const { club: slug, cardId } = await context.params;
  const club = await presentClub(slug);
  const card = cardById(club, cardId);
  if (!club || !card) return new Response("Not found", { status: 404 });

  const client = db();
  if (!client) return new Response("Not found", { status: 404 });
  const { data, error } = await client
    .from("watch_with_ratings")
    .select("votes, wins")
    .eq("club_slug", slug)
    .eq("card_id", cardId)
    .eq("segment", "fan")
    .maybeSingle();
  if (error || !data || Number(data.votes) < COUNTING_VOTES) {
    return new Response("Not found", { status: 404 });
  }

  const votes = Number(data.votes);
  const rate = Math.round((Number(data.wins) / votes) * 100);
  const { data: peers } = await client
    .from("watch_with_ratings")
    .select("card_id, elo, votes")
    .eq("club_slug", slug)
    .eq("segment", "fan");
  const ranked = (peers ?? [])
    .filter((row) => Number(row.votes) >= COUNTING_VOTES)
    .sort((a, b) => Number(b.elo) - Number(a.elo));
  const place = ranked.findIndex((row) => row.card_id === cardId) + 1;
  if (!place) return new Response("Not found", { status: 404 });

  const [font, logo] = await Promise.all([
    readFile(path.join(process.cwd(), "public/crest/fonts/archivo-latin-700-normal.woff2")),
    readFile(path.join(process.cwd(), "public/brand/trf-crest-transparent.png")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: club.primaryColor,
          color: "#F2EDE4",
          padding: "80px 72px",
          fontFamily: "Archivo",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {club.shortName}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 700, lineHeight: 1 }}>{`Ranked #${place}`}</div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>{card.name}</div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 32 }}>{`Matchday companion ranking by ${club.fanLabel}`}</div>
          <div style={{ display: "flex", marginTop: 36, fontSize: 30 }}>{`${votes} votes · ${rate}% win rate`}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <img src={logoSrc} width="120" height="120" alt="" />
          <div style={{ display: "flex", fontSize: 26 }}>{`${WATCHWITH_APP_HOST}/${club.slug}`}</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [{ name: "Archivo", data: font, weight: 700, style: "normal" }],
    },
  );
}
