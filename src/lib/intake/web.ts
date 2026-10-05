import { BOOLEAN_FIELDS, TEXT_FIELDS, captureAttribution, normalizeIntakeData, record } from "./domain";

export function parseWebIntakeInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("invalid_input");
  const value = record(input);
  if (Object.keys(value).some(key => !["action", "answers", "attribution"].includes(key))) throw Error("invalid_input");
  if (!["create", "save", "continue"].includes(String(value.action))) throw Error("invalid_action");
  for (const field of ["answers", "attribution"]) {
    if (value[field] !== undefined && (!value[field] || typeof value[field] !== "object" || Array.isArray(value[field]))) throw Error("invalid_input");
  }
  const answers = record(value.answers);
  if (Object.keys(answers).length > 8 || Object.keys(answers).some(key => ![...TEXT_FIELDS, ...BOOLEAN_FIELDS].includes(key as never))) throw Error("invalid_answers");
  const normalized = normalizeIntakeData(answers);
  if (Object.keys(normalized).length !== Object.keys(answers).length || Object.values(answers).some(v => typeof v === "string" && v.length > 1200)) throw Error("invalid_answers");
  if (value.action !== "save" && value.answers !== undefined) throw Error("invalid_answers");
  if (value.action !== "create" && value.attribution !== undefined) throw Error("immutable_attribution");
  return { action: value.action as "create" | "save" | "continue", answers: normalized, attribution: captureAttribution(value.attribution) };
}
