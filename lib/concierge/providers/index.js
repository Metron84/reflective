/**
 * Active LLM provider for The Concierge.
 * Swap this re-export when adding Anthropic (or another) provider file.
 */
export {
  appendModelTurn,
  appendToolResults,
  buildInitialContents,
  generateTurn,
  GEMINI_MODEL,
} from "@/lib/concierge/providers/gemini";
