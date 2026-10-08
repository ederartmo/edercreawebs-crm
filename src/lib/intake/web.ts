import { BOOLEAN_FIELDS, TEXT_FIELDS, captureAttribution, normalizeIntakeData, record, type IntakeField } from "./domain";

export function parseWebIntakeInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("invalid_input");
  const value = record(input);
  if (Object.keys(value).some(key => !["action", "answers", "attribution", "mode", "field", "value", "meta_marketing"].includes(key))) throw Error("invalid_input");
  if (value.meta_marketing !== undefined && (value.action !== "finalize" || typeof value.meta_marketing !== "boolean")) throw Error("invalid_input");
  if (!["create", "save", "continue", "finalize"].includes(String(value.action))) throw Error("invalid_action");

  if (value.action === "save" && value.mode === "edit") {
    if (value.answers !== undefined || value.attribution !== undefined) throw Error("invalid_edit");
    const fieldName = typeof value.field === "string" ? value.field : "";
    const field = fieldName as IntakeField;
    const isTextField = (TEXT_FIELDS as readonly string[]).includes(fieldName);
    const isBooleanField = (BOOLEAN_FIELDS as readonly string[]).includes(fieldName);
    if (!isTextField && !isBooleanField) throw Error("invalid_edit_field");
    if (isTextField && typeof value.value !== "string") throw Error("invalid_edit_value");
    if (isBooleanField && typeof value.value !== "boolean") throw Error("invalid_edit_value");
    if (typeof value.value === "string" && value.value.length > 1200) throw Error("invalid_edit_value");
    const clear = typeof value.value === "string" && value.value.trim() === "";
    const normalized = normalizeIntakeData({ [field]: value.value });
    if (!clear && !(field in normalized)) throw Error("invalid_edit_value");
    return { action: "save" as const, mode: "edit" as const, field, value: clear ? "" : normalized[field] as string | boolean };
  }

  if (value.mode !== undefined || value.field !== undefined || value.value !== undefined) throw Error("invalid_input");
  for (const field of ["answers", "attribution"]) {
    if (value[field] !== undefined && (!value[field] || typeof value[field] !== "object" || Array.isArray(value[field]))) throw Error("invalid_input");
  }
  const answers = record(value.answers);
  if (Object.keys(answers).length > 8 || Object.keys(answers).some(key => ![...TEXT_FIELDS, ...BOOLEAN_FIELDS].includes(key as never))) throw Error("invalid_answers");
  const normalized = normalizeIntakeData(answers);
  if (Object.keys(normalized).length !== Object.keys(answers).length || Object.values(answers).some(v => typeof v === "string" && v.length > 1200)) throw Error("invalid_answers");
  if (value.action !== "save" && value.answers !== undefined) throw Error("invalid_answers");
  if (value.action !== "create" && value.attribution !== undefined) throw Error("immutable_attribution");
  return { action: value.action as "create" | "save" | "continue" | "finalize", answers: normalized, attribution: captureAttribution(value.attribution), meta_marketing: value.meta_marketing === true };
}
