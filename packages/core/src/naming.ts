// Dragodinde in-game naming convention (colour-first letter codes).
//
// Designed + adversarially verified against all 66 colours: every name is ASCII
// letters/space/hyphen only, no digits, no accents, far under 20 chars; all codes unique.
//
// Format:  <code>-[K]<sex><index>
//   <code>  1 base-letter (pure colour) or 2 base-letters (bicolour, in canonical
//           in-game order: the colour before "et" then the one after).
//   K        literal uppercase K only for KEEPERS (the copy to protect); omitted for stock.
//   <sex>    lowercase f (female) / m (male).
//   <index>  bijective base-26 lowercase copy number (a,b,…,z,aa,…) — every copy gets one.
// One hyphen, between the colour code and the suffix.
//
// Sort (alphabetical, as the in-game list does): colour → keepers (uppercase K floats
// above lowercase) → females before males → index. So a colour's whole pool reads as one
// scannable run with its keeper pinned on top.

import { COLORS, COLOR_BY_NAME } from "./colors.js";

/** The 11 pure colours → unique single ASCII letter. Bicolours concatenate two of these. */
export const BASE_LETTER: Record<string, string> = {
  Amande: "a",
  Dorée: "d",
  Rousse: "r",
  Ebène: "e",
  Indigo: "i",
  Pourpre: "p",
  Orchidée: "o",
  Ivoire: "v", // i taken by Indigo
  Turquoise: "t",
  Emeraude: "m", // e taken by Ebène
  Prune: "u", // p taken by Pourpre
};

export const LETTER_TO_BASE: Record<string, string> = Object.fromEntries(
  Object.entries(BASE_LETTER).map(([name, ltr]) => [ltr, name]),
);

/** Colour name → short code (1 letter pure, 2 letters bicolour, canonical "X et Y" order). */
export function colorCode(color: string): string {
  if (color.includes(" et ")) {
    const [a, b] = color.split(" et ");
    return (BASE_LETTER[a] ?? "?") + (BASE_LETTER[b] ?? "?");
  }
  return BASE_LETTER[color] ?? "?";
}

/** code → colour name (reverse lookup over all 66). */
export const CODE_TO_COLOR: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const c of COLORS) m[colorCode(c.name)] = c.name;
  return m;
})();

/** 1→"a", 26→"z", 27→"aa" (bijective base-26, no digits). */
export function indexToCode(n: number): string {
  let x = Math.max(1, Math.floor(n));
  let s = "";
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(97 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** "a"→1, "aa"→27. 0 if not a lowercase letter string. */
export function codeToIndex(s: string): number {
  if (!/^[a-z]+$/.test(s)) return 0;
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 96);
  return n;
}

export type Sex = "F" | "M";

export interface NameParts {
  readonly color: string;
  readonly sex: Sex;
  readonly index: number; // 1-based copy number
  readonly keeper: boolean;
}

/** Build a valid in-game name from its parts. */
export function buildName(p: NameParts): string {
  const suffix = (p.keeper ? "K" : "") + (p.sex === "F" ? "f" : "m") + indexToCode(p.index);
  return `${colorCode(p.color)}-${suffix}`;
}

/** Decode a name written in this convention. null if it doesn't match the format. */
export function parseName(name: string): NameParts | null {
  const m = /^([a-z]{1,2})-(K?)([fm])([a-z]+)$/.exec(name.trim());
  if (!m) return null;
  const color = CODE_TO_COLOR[m[1]];
  if (!color) return null;
  return { color, keeper: m[2] === "K", sex: m[3] === "f" ? "F" : "M", index: codeToIndex(m[4]) };
}

export const genOf = (color: string) => COLOR_BY_NAME.get(color)?.gen ?? 0;

// ── In-game rule validation (independent of our convention) ─────────────────
export const MAX_LEN = 20;
const ALLOWED = /^[A-Za-z \-]*$/; // Latin letters, space, hyphen only

export interface Validation {
  readonly valid: boolean;
  readonly length: number;
  readonly errors: ReadonlyArray<string>;
}

/** Validate any string against the in-game rules (≤20, letters/space/hyphen, no digit/accent). */
export function validateInGame(name: string): Validation {
  const errors: string[] = [];
  if (name.length > MAX_LEN) errors.push(`Trop long : ${name.length}/${MAX_LEN} caractères.`);
  if (!ALLOWED.test(name)) {
    const bad = [...new Set([...name].filter((ch) => !/[A-Za-z \-]/.test(ch)))];
    const digits = bad.some((c) => /[0-9]/.test(c));
    const accents = bad.some((c) => /[^\x00-\x7F]/.test(c));
    let msg = `Caractères interdits : ${bad.map((c) => `« ${c} »`).join("  ")}`;
    if (digits) msg += " — chiffres interdits";
    if (accents) msg += " — accents interdits";
    errors.push(msg + ".");
  }
  return { valid: errors.length === 0, length: name.length, errors };
}

/** All 66 colours with their code, ordered by generation then name (for the reference table). */
export const COLOR_CODES = COLORS.map((c) => ({
  name: c.name,
  gen: c.gen,
  code: colorCode(c.name),
}));
