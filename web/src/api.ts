import type { Recommendation } from "@dd/core";
import type {
  AppState,
  CrossInput,
  Dragodinde,
  DragoPatch,
  Enclos,
  EnclosPatch,
  SeedInput,
} from "./types";

export interface RecommendBody {
  targetGen?: number;
  level?: number;
  optimakina?: boolean;
  clonage?: boolean;
  freeSlots?: number;
}

async function json<T>(res: Response): Promise<T> {
  if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  getState: () => fetch("/api/state").then((r) => json<AppState>(r)),

  addEnclos: () =>
    fetch("/api/enclos", { method: "POST" }).then((r) => json<Enclos | { error: string }>(r)),
  removeEnclos: (id: number) =>
    fetch(`/api/enclos/${id}`, { method: "DELETE" }).then((r) => json<{ ok?: boolean; error?: string }>(r)),
  patchEnclos: (id: number, body: EnclosPatch) =>
    fetch(`/api/enclos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<{ ok?: boolean; error?: string }>(r)),

  addDragodinde: (enclosId: number, seed?: SeedInput) =>
    fetch(`/api/enclos/${enclosId}/dragodinde`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seed ?? {}),
    }).then((r) => json<Dragodinde | { error: string }>(r)),
  breed: (input: CrossInput) =>
    fetch("/api/breed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<Dragodinde | { error: string }>(r)),
  removeDragodinde: (id: number) =>
    fetch(`/api/dragodinde/${id}`, { method: "DELETE" }).then((r) =>
      json<{ ok?: boolean; error?: string }>(r),
    ),
  patchDragodinde: (id: number, body: DragoPatch) =>
    fetch(`/api/dragodinde/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<Dragodinde | { error: string }>(r)),

  recommend: (body: RecommendBody) =>
    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<Recommendation>(r)),

  setWebhook: (webhookUrl: string) =>
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl }),
    }).then((r) => json<{ webhookConfigured: boolean }>(r)),
  testNotify: () =>
    fetch("/api/test-notify", { method: "POST" }).then((r) =>
      json<{ ok: boolean; reason?: string }>(r),
    ),
};
