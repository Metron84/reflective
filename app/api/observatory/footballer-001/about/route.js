import { NextResponse } from "next/server";
import { AGE_BRACKETS, PERCEPTION, TED_LASSO } from "@/lib/observatory/footballer-001";
import { observatoryLimited } from "@/lib/observatory/rate-limit";

export const runtime = "nodejs";

export async function GET(request) {
  const blocked = observatoryLimited(request);
  if (blocked) return blocked;
  return NextResponse.json({
    perception: {
      text: PERCEPTION.text,
      options: PERCEPTION.options.map((option) => ({ id: option.id, text: option.text })),
    },
    ageBrackets: AGE_BRACKETS,
    tedLasso: TED_LASSO,
  });
}
