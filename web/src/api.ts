import type { Recommendation, AssistantPlan } from "@dd/core";
import type {
  AppState,
  CloneInput,
  CrossInput,
  Dragodinde,
  DragoPatch,
  Enclos,
  EnclosPatch,
  ImportRow,
  ReproStatus,
  SeedInput,
} from "./types";

export interface RecommendBody {
  targetGen?: number;
  level?: number;
  optimakina?: boolean;
  clonage?: boolean;
  freeSlots?: number;
}

// A 401 from any API call means the session is gone — let the app flip to the login wall.
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void): void => {
  onUnauthorized = fn;
};

async function json<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    onUnauthorized();
    throw new Error("unauthenticated");
  }
  if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export interface Me {
  id: string;
  name?: string;
  image?: string | null;
}

export const api = {
  getState: () => fetch("/api/state").then((r) => json<AppState>(r)),

  // ── auth (Better Auth) ──────────────────────────────────────────────
  /** The current user, or null when signed out (200/401 — never throws to the global handler). */
  me: (): Promise<Me | null> =>
    fetch("/api/me").then((r) => (r.ok ? (r.json() as Promise<Me>) : null)),
  signInDiscord: (): Promise<void> =>
    fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "discord", callbackURL: window.location.origin }),
    })
      .then((r) => r.json() as Promise<{ url?: string }>)
      .then((d) => {
        if (d.url) window.location.href = d.url;
      }),
  signOut: (): Promise<void> =>
    fetch("/api/auth/sign-out", { method: "POST" }).then(() => {
      window.location.reload();
    }),

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

  addDragodinde: (seed?: SeedInput) =>
    fetch(`/api/dragodinde`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seed ?? {}),
    }).then((r) => json<Dragodinde | { error: string }>(r)),
  moveDragodinde: (id: number, enclosId: number | null) =>
    fetch(`/api/dragodinde/${id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enclosId }),
    }).then((r) => json<Dragodinde | { error: string }>(r)),
  bulkMove: (ids: number[], enclosId: number | null) =>
    fetch("/api/dragodinde/bulk-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, enclosId }),
    }).then((r) => json<{ moved: number; movedIds: number[]; skipped: number }>(r)),
  bulkPatch: (ids: number[], patch: { status?: ReproStatus; keeper?: boolean }) =>
    fetch("/api/dragodinde/bulk-patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, patch }),
    }).then((r) => json<{ patched: number }>(r)),
  bulkDelete: (ids: number[]) =>
    fetch("/api/dragodinde/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).then((r) => json<{ removed: number }>(r)),
  breed: (input: CrossInput) =>
    fetch("/api/breed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<Dragodinde | { error: string }>(r)),
  importMounts: (mounts: ImportRow[], enclosId: number | null) =>
    fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mounts, enclosId }),
    }).then((r) =>
      json<{ created: number; skipped: number; toEnclos: number; mounts: Dragodinde[] } | { error: string }>(r),
    ),
  clone: (input: CloneInput) =>
    fetch("/api/clone", {
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
  assistantPlan: (body: { targetGen: number; level: number; optimakina: boolean; clonage: boolean }) =>
    fetch("/api/assistant/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<AssistantPlan>(r)),

  setAchievements: (colors: string[]) =>
    fetch("/api/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colors }),
    }).then((r) => json<{ achievements: string[] }>(r)),
  setWebhook: (webhookUrl: string) =>
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl }),
    }).then((r) => json<{ webhookConfigured: boolean; aiConfigured: boolean }>(r)),
  // BYOK: save ("" clears) the current user's OpenAI key. Never returns the key.
  setAiKey: (aiKey: string) =>
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiKey }),
    }).then((r) => json<{ webhookConfigured: boolean; aiConfigured: boolean }>(r)),
  testNotify: () =>
    fetch("/api/test-notify", { method: "POST" }).then((r) =>
      json<{ ok: boolean; reason?: string }>(r),
    ),
};
