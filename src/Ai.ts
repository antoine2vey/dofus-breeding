import { createOpenAI } from "@ai-sdk/openai";
import type { InvMount } from "@dd/core";
import * as Core from "@dd/core";
import { stepCountIs, streamText, tool } from "ai";
import { Config, Effect } from "effect";
import { z } from "zod";

export interface ChatMessage {
	readonly role: "user" | "assistant";
	readonly content: string;
}

export interface ReplyOpts {
	readonly targetGen: number;
	readonly level: number;
	readonly optimakina: boolean;
	readonly clonage: boolean;
	readonly freeSlots: number;
}

const SYSTEM = `Tu es l'assistant d'élevage de dragodindes (Dofus). Objectif : aider à atteindre la
génération cible le plus vite. RÈGLE ABSOLUE : ne calcule JAMAIS toi-même les probabilités, les
quantités ou le plan — appelle les outils, qui sont la source de vérité.
- recommend : le plan déterministe (quels croisements faire, quoi capturer, quoi recycler).
- crossOdds : probabilités exactes d'un croisement précis (couleurs + grands-parents + niveau).
- simulate : estimation Monte Carlo du nombre de montures pour atteindre une génération.
- getInventory : le cheptel actuel.
- suggestName : un nom de monture conforme à la convention.
Explique les recommandations en français clair et concis, et réponds aux questions « et si… » en
appelant les outils. Ne fabrique pas de chiffres.`;

export class Ai extends Effect.Service<Ai>()("app/Ai", {
	effect: Effect.gen(function* () {
		const apiKey = yield* Config.string("OPENAI_API_KEY").pipe(
			Config.withDefault(""),
		);
		const modelId = yield* Config.string("OPENAI_MODEL").pipe(
			Config.withDefault("gpt-4o-mini"),
		);
		const isConfigured = apiKey.length > 0;

		/** Returns the assistant's streamed text (AsyncIterable<string>). Tools close over a
		 * snapshot of the inventory so their execute() stays plain-async (no Effect at call time). */
		const reply = (
			messages: ReadonlyArray<ChatMessage>,
			inventory: InvMount[],
			opts: ReplyOpts,
		) => {
			const openai = createOpenAI({ apiKey });
			const tools = {
				getInventory: tool({
					description:
						"Le cheptel actuel : montures avec couleur, sexe, fécondité, keeper.",
					inputSchema: z.object({}),
					execute: async () => ({
						count: inventory.length,
						mounts: inventory.map((m) => ({
							id: m.id,
							color: m.color,
							sex: m.sex,
							status: m.status,
							keeper: m.keeper,
							grandparents: m.grandparents,
						})),
					}),
				}),
				recommend: tool({
					description:
						"Le plan déterministe (croisements / captures / recyclages) depuis le cheptel.",
					inputSchema: z.object({
						targetGen: z.number().int().min(2).max(10).optional(),
					}),
					execute: async ({ targetGen }) =>
						Core.recommend({
							mounts: inventory,
							targetGen: targetGen ?? opts.targetGen,
							freeSlots: opts.freeSlots,
							level: opts.level,
							optimakina: opts.optimakina,
							clonage: opts.clonage,
						}),
				}),
				crossOdds: tool({
					description:
						"Probabilités exactes d'un croisement (couleurs + grands-parents + niveaux).",
					inputSchema: z.object({
						colorA: z.string(),
						grandparentsA: z.array(z.string()).optional(),
						colorB: z.string(),
						grandparentsB: z.array(z.string()).optional(),
						sumParentLevels: z.number().default(120),
						optimakina: z.boolean().default(false),
					}),
					execute: async (a) =>
						Core.crossOdds(
							{ race: a.colorA, grandparents: a.grandparentsA ?? [] },
							{ race: a.colorB, grandparents: a.grandparentsB ?? [] },
							a.sumParentLevels,
							a.optimakina,
						),
				}),
				simulate: tool({
					description:
						"Estimation Monte Carlo du nombre de montures pour atteindre une génération.",
					inputSchema: z.object({
						targetGen: z.number().int().min(2).max(10),
						level: z.number().default(60),
						optimakina: z.boolean().default(false),
						clonage: z.boolean().default(true),
					}),
					execute: async (a) => {
						// Seed from the real cheptel (grandparents included) so the estimate reflects
						// the actual stock — including lineage pollution — not a from-scratch ideal.
						const simInventory = inventory
							.filter((m) => m.color && !m.keeper)
							.map((m) => ({
								race: m.color,
								sex: (m.sex === "M" ? 0 : 1) as 0 | 1,
								gp: m.grandparents,
								fertile: m.status !== "sterile",
							}));
						const s = Core.monteCarlo(
							{
								targetGen: a.targetGen,
								level: a.level,
								optimakina: a.optimakina,
								clonage: a.clonage,
								maxSteps: 0,
								inventory: simInventory,
							},
							200,
							Core.makeRng(1),
						);
						return {
							capturesMedian: s.captures.p50,
							capturesByRace: s.captures.byRace,
							breedingsMean: Math.round(s.breedings.mean),
							clonagesMean: Math.round(s.clonages.mean),
							topBred: s.topBred.slice(0, 8),
						};
					},
				}),
				suggestName: tool({
					description:
						"Génère un nom de monture conforme à la convention (code couleur + sexe + n°).",
					inputSchema: z.object({
						color: z.string(),
						sex: z.enum(["M", "F"]),
						index: z.number().int().min(1).default(1),
						keeper: z.boolean().default(false),
					}),
					execute: async (a) => ({
						name: Core.buildName({
							color: a.color,
							sex: a.sex,
							index: a.index,
							keeper: a.keeper,
						}),
					}),
				}),
			};

			const result = streamText({
				model: openai(modelId),
				system: SYSTEM,
				messages: messages.map((m) => ({ role: m.role, content: m.content })),
				tools,
				stopWhen: stepCountIs(8),
			});
			return result.textStream;
		};

		return { isConfigured, reply } as const;
	}),
}) {}
