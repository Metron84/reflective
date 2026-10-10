import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/config";
import { WATCHWITH_APP_HOST } from "@/lib/watch-with/host";
import { fanTokenSecret } from "@/lib/watch-with/notify";
import { db } from "@/lib/watch-with/store";
import { readFanToken } from "@/lib/watch-with/token";

export const runtime = "nodejs";

function page(title, body, href) {
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#F2EDE4;color:#0A111F;font-family:Arial,Helvetica,sans-serif;padding:32px;">
    <h1 style="font-size:28px;">${title}</h1>
    <p style="font-size:16px;">${body}</p>
    <p><a href="${href}" style="color:#D8232A;">See the ranking</a></p>
  </body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const data = readFanToken(token, fanTokenSecret());
  if (!data) return page("That link has expired.", "Ask for a new verification email from your result.", SITE_URL);
  const client = db();
  if (!client) return page("The game is warming up.", "Try the link again in a minute.", SITE_URL);
  const { error } = await client
    .from("watch_with_fans")
    .update({ email_verified: true })
    .eq("email", data.email);
  if (error) {
    console.error("watch-with/verify", error);
    return page("Something went wrong.", "Try the link again.", SITE_URL);
  }
  const ranking = `https://${WATCHWITH_APP_HOST}/${data.club}/ranking`;
  return page("Your vote is verified.", "Your runs now count on the verified ranking.", ranking);
}
