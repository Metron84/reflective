import fs from "fs";
import path from "path";

const PERSONAS_PATH = path.join(process.cwd(), "data/ultima/personas.json");

export function getBotPersonas() {
  const raw = JSON.parse(fs.readFileSync(PERSONAS_PATH, "utf8"));
  return Array.isArray(raw) ? raw : [];
}

export function getBotPersonaById(id) {
  return getBotPersonas().find((p) => p.id === id) ?? null;
}
