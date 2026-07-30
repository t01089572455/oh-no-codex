import type { ReadModel } from "./read-model.js";

export function serializeNext(model: ReadModel): string {
  return `${model.next_action}\n`;
}
