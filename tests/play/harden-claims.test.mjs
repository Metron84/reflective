import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

mock.module("@supabase/ssr", {
  namedExports: {
    createServerClient() {
      return {
        auth: {
          getClaims: async () => {
            throw new Error("Invalid Refresh Token: Already Used");
          },
        },
      };
    },
  },
});

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://testproj.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

const { middleware } = await import("../../middleware.js");

test("getClaims throwing is treated as signed out and does not throw", async () => {
  const req = new NextRequest("https://www.thereflectivefootball.com/api/play/answer", {
    headers: { host: "www.thereflectivefootball.com", accept: "application/json" },
  });
  const res = await middleware(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("location"), null);
});
