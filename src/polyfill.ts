// Node 18 lacks a global `File`, which undici (used by @effect/platform-node's
// HTTP client) references at import time. Must be imported before anything else.
import { Blob, File } from "node:buffer";
// Node 18 also doesn't expose the Web Crypto API as a global when running an ESM
// file (it's behind --experimental-global-webcrypto until Node 20). Better Auth
// reaches for a bare `crypto` at request time, so install it here. No-op on Node 20+.
import { webcrypto } from "node:crypto";

const g = globalThis as unknown as Record<string, unknown>;
if (g["File"] === undefined) g["File"] = File;
if (g["Blob"] === undefined) g["Blob"] = Blob;
if (g["crypto"] === undefined) g["crypto"] = webcrypto;
