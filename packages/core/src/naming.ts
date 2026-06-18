// Dragodinde in-game naming convention (colour-first letter codes).
//
// Designed + adversarially verified against all 66 colours: every name is ASCII
// letters/space/hyphen only, no digits, no accents, far under 20 chars; all codes unique.
//
// Format:  <code>-[K-]<sex>-<index>[-<gp1>[-<gp2>]]
//   <code>  1 base-letter (pure colour) or 2 base-letters (bicolour, in canonical
//           in-game order: the colour before "et" then the one after).
//   K        literal uppercase K only for KEEPERS (the copy to protect); omitted for stock.
//   <sex>    lowercase f (female) / m (male).
//   <index>  bijective base-26 lowercase copy number (a,b,…,z,aa,…) — every copy gets one.
//   <gp>     0..2 grandparent (parent) colour codes, canonical (sorted by code).
// Every field is its OWN hyphen-delimited segment. We deliberately split the keeper/sex/index
// apart (e.g. `a-m-j-a-d`, not `a-mj-a-d`) because the in-game namer chokes on some 2-letter
// chunks; single-letter segments name reliably. parseName still accepts the old combined
// `<code>-[K]<sex><index>` form so mounts named under the previous scheme keep parsing.
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
  /** The two grandparent (parent) colour NAMES, 0..2. Canonical (sorted by code) in the name. */
  readonly grandparents?: ReadonlyArray<string>;
}

/** Grandparent colour names -> sorted, deduped-to-≤2, valid-only code list (canonical order). */
function grandparentCodes(gps: ReadonlyArray<string> | undefined): string[] {
  return (gps ?? [])
    .map((c) => colorCode(c))
    .filter((code) => code !== "?")
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 2);
}

/** Build a valid in-game name from its parts. Every field is its own hyphen segment and the
 *  grandparent codes are appended when known: `<own>-[K-]<sex>-<index>[-<gp1>[-<gp2>]]`,
 *  e.g. `a-m-j-a-d` or, for a keeper, `i-K-f-a-e-ei`. */
export function buildName(p: NameParts): string {
  const head = [colorCode(p.color)];
  if (p.keeper) head.push("K");
  head.push(p.sex === "F" ? "f" : "m");
  head.push(indexToCode(p.index));
  return [...head, ...grandparentCodes(p.grandparents)].join("-");
}

/** Decode a name written in this convention. Accepts both the current split form
 *  (`<code>-[K-]<sex>-<index>[-gp…]`) and the legacy combined form
 *  (`<code>-[K]<sex><index>[-gp…]`). null if it doesn't match either. */
export function parseName(name: string): NameParts | null {
  const parts = name.trim().split("-");
  if (parts.length < 2) return null;
  const [ownCode, ...rest] = parts;
  if (!/^[a-z]{1,2}$/.test(ownCode)) return null;
  const color = CODE_TO_COLOR[ownCode];
  if (!color) return null;

  let keeper: boolean;
  let sex: Sex;
  let index: number;
  let gpCodes: string[];

  if (rest[0] === "K" || rest[0] === "f" || rest[0] === "m") {
    // Split form: keeper/sex/index are separate single-letter segments.
    let i = 0;
    keeper = rest[i] === "K";
    if (keeper) i++;
    if (rest[i] !== "f" && rest[i] !== "m") return null;
    sex = rest[i] === "f" ? "F" : "M";
    i++;
    const idx = rest[i];
    if (!idx || !/^[a-z]+$/.test(idx)) return null;
    index = codeToIndex(idx);
    gpCodes = rest.slice(i + 1);
  } else {
    // Legacy combined suffix: [K]<sex><index> as one segment.
    const sm = /^(K?)([fm])([a-z]+)$/.exec(rest[0]);
    if (!sm) return null;
    keeper = sm[1] === "K";
    sex = sm[2] === "f" ? "F" : "M";
    index = codeToIndex(sm[3]);
    gpCodes = rest.slice(1);
  }

  if (gpCodes.length > 2) return null;
  const grandparents: string[] = [];
  for (const gc of gpCodes) {
    const gColor = CODE_TO_COLOR[gc];
    if (!gColor) return null; // an unrecognised grandparent code invalidates the whole name
    grandparents.push(gColor);
  }
  return { color, keeper, sex, index, grandparents };
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
