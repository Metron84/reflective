import { GoogleGenAI } from "@google/genai";

/** Current recommended Flash for agentic / tool-use loops (Jul 2026). */
export const GEMINI_MODEL = "gemini-3.5-flash";

/**
 * Map neutral Concierge tool defs → Gemini functionDeclarations.
 * Neutral shape: { name, description, parameters } (JSON Schema object).
 */
export function toGeminiFunctionDeclarations(tools) {
  return (tools ?? []).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.parameters ?? {
      type: "object",
      properties: {},
    },
  }));
}

export function buildInitialContents(messages) {
  return (messages ?? []).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

function extractModelParts(response) {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts) && parts.length) return parts;

  // Fallback when only functionCalls helper is populated
  const calls = response?.functionCalls ?? [];
  return calls.map((fc) => ({
    functionCall: {
      name: fc.name,
      args: fc.args ?? {},
      id: fc.id,
    },
  }));
}

/**
 * One Gemini generateContent turn. Does not execute tools.
 * @returns {{ text: string, toolCalls: Array<{id?: string, name: string, args: object}>, modelParts: object[] }}
 */
export async function generateTurn({ contents, tools, systemPrompt }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY is not configured.");
    err.status = 503;
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey });
  const functionDeclarations = toGeminiFunctionDeclarations(tools);

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 1024,
      tools: functionDeclarations.length
        ? [{ functionDeclarations }]
        : undefined,
    },
  });

  const functionCalls = response.functionCalls ?? [];
  const toolCalls = functionCalls.map((fc) => ({
    id: fc.id,
    name: fc.name,
    args: fc.args ?? {},
  }));

  return {
    text: (response.text ?? "").trim(),
    toolCalls,
    modelParts: extractModelParts(response),
  };
}

export function appendModelTurn(contents, modelParts) {
  return [
    ...contents,
    {
      role: "model",
      parts: modelParts,
    },
  ];
}

export function appendToolResults(contents, executed) {
  const parts = executed.map(({ call, output }) => ({
    functionResponse: {
      name: call.name,
      ...(call.id ? { id: call.id } : {}),
      response:
        output && typeof output === "object" ? output : { result: output },
    },
  }));
  return [
    ...contents,
    {
      role: "user",
      parts,
    },
  ];
}
