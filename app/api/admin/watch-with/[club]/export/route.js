import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { clubReport, marketingFans } from "@/lib/watch-with/report";

export const runtime = "nodejs";

function cell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function csv(rows) {
  return rows.map((row) => row.map(cell).join(",")).join("\n");
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function file(name, body) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}

export async function GET(request, context) {
  const gate = await requireAdminApi();
  if (!gate.ok) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { club } = await context.params;
  const kind = new URL(request.url).searchParams.get("file");
  const day = stamp();

  if (kind === "ranking") {
    const report = await clubReport(club);
    if (!report) return NextResponse.json({ error: "That club is not in the game." }, { status: 404 });
    const lines = [[
      "name", "category", "fan_rank", "everyone_rank", "verified_rank",
      "votes", "wins", "win_rate", "elo", "beats", "loses",
    ]];
    for (const row of report.rows) {
      lines.push([
        row.name,
        row.category,
        row.fanRank ?? "",
        row.allRank ?? "",
        row.verifiedRank ?? "",
        row.votes,
        row.wins,
        row.winRate,
        row.elo,
        row.beats.map((item) => `${item.name} ${item.count}`).join("; "),
        row.loses.map((item) => `${item.name} ${item.count}`).join("; "),
      ]);
    }
    return file(`watch-with-${club}-ranking-${day}.csv`, csv(lines));
  }

  if (kind === "fans") {
    const fans = await marketingFans(club);
    const lines = [["email", "first_name", "location", "supporters_club", "consent_save_result", "consent_marketing", "created_at"]];
    for (const row of fans) {
      lines.push([
        row.email,
        row.first_name,
        row.location,
        row.supporters_club,
        row.consent_save_result,
        row.consent_marketing,
        row.created_at,
      ]);
    }
    return file(`watch-with-${club}-fans-${day}.csv`, csv(lines));
  }

  return NextResponse.json({ error: "Choose a file." }, { status: 400 });
}
