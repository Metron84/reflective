import { runTool } from "@/lib/concierge/tools";
import {
  appendModelTurn,
  appendToolResults,
  buildInitialContents,
  generateTurn,
} from "@/lib/concierge/providers";

const MAX_TOOL_ROUNDS = 3;

/**
 * Provider-agnostic Concierge brain.
 * Tool loop lives here; the Gemini (or future) provider only does one model turn.
 *
 * @param {{ messages: Array<{role: string, content: string}>, tools: Array<object>, systemPrompt: string }} opts
 * @returns {Promise<{ text: string, toolResultsUsed: Array<{ name: string, args: object, output: object }> }>}
 */
export async function runConcierge({ messages, tools, systemPrompt }) {
  let contents = buildInitialContents(messages);
  /** @type {Array<{ name: string, args: object, output: object }>} */
  const toolResultsUsed = [];
  let text = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const turn = await generateTurn({ contents, tools, systemPrompt });

    if (!turn.toolCalls.length) {
      text = turn.text;
      break;
    }

    contents = appendModelTurn(contents, turn.modelParts);

    const executed = [];
    for (const call of turn.toolCalls) {
      const output = await runTool(call.name, call.args ?? {});
      toolResultsUsed.push({
        name: call.name,
        args: call.args ?? {},
        output,
      });
      executed.push({ call, output });
    }

    contents = appendToolResults(contents, executed);

    // Last allowed tool round: ask once more for a final text answer.
    if (round === MAX_TOOL_ROUNDS - 1) {
      const finalTurn = await generateTurn({ contents, tools, systemPrompt });
      text = finalTurn.text;
      // If the model still wants tools, stop — we already hit the cap.
      break;
    }
  }

  return { text, toolResultsUsed };
}
