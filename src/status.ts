import type { ReadModel } from "./read-model.js";
import { serializeResume } from "./resume.js";

export function serializeStatus(
  model: ReadModel,
  json: boolean,
): string {
  return json
    ? `${JSON.stringify(model)}\n`
    : serializeResume(model);
}
