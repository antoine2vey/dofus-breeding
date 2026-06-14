// Node 18 lacks a global `File`, which undici (used by @effect/platform-node's
// HTTP client) references at import time. Must be imported before anything else.
import { Blob, File } from "node:buffer";

const g = globalThis as unknown as Record<string, unknown>;
if (g["File"] === undefined) g["File"] = File;
if (g["Blob"] === undefined) g["Blob"] = Blob;
