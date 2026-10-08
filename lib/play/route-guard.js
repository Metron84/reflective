import { NextResponse } from "next/server";

/** Turns a thrown play handler into JSON so the client never sees an HTML error page. */
export function playRoute(name, handler) {
  return Promise.resolve()
    .then(() => handler())
    .catch((error) => {
      console.error(name, error);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    });
}
