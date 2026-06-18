import { createOpenAI } from "@ai-sdk/openai";
import type { AssistEnclos, AssistMount, ReproStatus } from "@dd/core";
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
}

/** Side-effecting bridge the HTTP layer provides: reads live state + mutates the tracker.
 * Keeps Ai.ts free of Effect/Repo — every method is plain-async (the AI SDK calls them). */
export interface AiActions {
	getState(): Promise<{ mounts: AssistMount[]; enclos: AssistEnclos[] }>;
	moveMounts(ids: number[], enclosId: number | null): Promise<{ moved: number; skipped: number }>;
	setStatus(ids: number[], status: ReproStatus): Promise<{ updated: number }>;
	setKeeper(ids: number[], keeper: boolean): Promise<{ updated: number }>;
	recordCross(p: {
		parentAId: number;
		parentBId: number;
		color: string;
		sex: "M" | "F";
	}): Promise<{ ok: boolean; babyId?: number; error?: string }>;
	recordClone(p: { aId: number; bId: number; sex: "M" | "F" }): Promise<{ ok: boolean; cloneId?: number; error?: string }>;
	addMounts(p: { color: string; sex: "M" | "F"; status: ReproStatus; count: number }): Promise<{ created: number }>;
	addEnclos(): Promise<{ ok: boolean; id?: number }>;
	removeEnclos(id: number): Promise<{ ok: boolean }>;
	deleteMounts(ids: number[]): Promise<{ removed: number }>;
}

const SYSTEM = `Tu es le contremaître d'élevage de dragodindes (Dofus). Tu pilotes, pas à pas, le
plan pour atteindre la génération cible le plus vite, et tu AGIS sur le suiveur via les outils.

RÈGLES :
- Ne calcule JAMAIS toi-même un nombre, une probabilité, une paire ou un plan. Appelle « getPlan »
  (feuille de route complète + prochaines actions déterministes) — c'est la source de vérité.
- L'app est un SUIVEUR, pas le jeu : tes outils modifient le modèle de l'app ; l'utilisateur
  reproduit en jeu. Donc agis sur ce que l'utilisateur te demande ou confirme.
- Les déplacements (« moveMounts ») sont sûrs et réversibles : applique-les directement quand c'est
  utile (ex. mettre des montures fertiles en enclos pour les monter féconde).
- Les actions destructrices (recordCross stérilise les parents, recordClone en consomme deux,
  deleteMounts) : ne les exécute QUE si l'utilisateur le demande/confirme explicitement.
- féconde = prête à reproduire (jauges à 20K) ; fertile = pas encore prête (à monter en enclos) ;
  stérile = a déjà reproduit (à cloner). Seules les féconde se croisent.

Outils lecture : getState (cheptel + enclos en direct), getPlan (feuille de route + prochaine
étape), crossOdds, simulate, suggestName.
Outils action : moveMounts (auto), setStatus, setKeeper, recordCross, recordClone, addMounts
(enregistre des captures), addEnclos, removeEnclos, deleteMounts.

Réponds en français, concis. Propose la prochaine étape claire, agis, puis dis ce qui suit.`;

export class Ai extends Effect.Service<Ai>()("app/Ai", {
	effect: Effect.gen(function* () {
		const apiKey = yield* Config.string("OPENAI_API_KEY").pipe(Config.withDefault(""));
		// Agent loop needs solid tool-use — default off the mini tier (still OPENAI_MODEL-overridable).
		const modelId = yield* Config.string("OPENAI_MODEL").pipe(Config.withDefault("gpt-4o"));
		const isConfigured = apiKey.length > 0;

		const reply = (messages: ReadonlyArray<ChatMessage>, opts: ReplyOpts, actions: AiActions) => {
			const openai = createOpenAI({ apiKey });
			const num = z.number().int();
			// Cap batch size so one mis-fired/injected tool call can't mass-mutate or wipe the herd.
			const ids = z.array(num).min(1).max(50);
			const status = z.enum(["sterile", "fertile", "feconde"]);

			const tools = {
				getState: tool({
					description: "Le cheptel + les enclos EN DIRECT : montures (couleur, sexe, état, keeper, enclos, grands-parents) et occupation des enclos.",
					inputSchema: z.object({}),
					execute: async () => actions.getState(),
				}),
				getPlan: tool({
					description: "La source de vérité : feuille de route complète (besoins par génération, captures restantes) + la prochaine étape (élever / croiser / cloner / capturer) calculée depuis l'état réel.",
					inputSchema: z.object({ targetGen: z.number().int().min(2).max(10).optional() }),
					execute: async ({ targetGen }) => {
						const st = await actions.getState();
						return Core.assistantPlan({
							mounts: st.mounts,
							enclos: st.enclos,
							targetGen: targetGen ?? opts.targetGen,
							level: opts.level,
							optimakina: opts.optimakina,
							clonage: opts.clonage,
						});
					},
				}),
				crossOdds: tool({
					description: "Probabilités exactes d'un croisement (couleurs + grands-parents + niveaux).",
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
					description: "Estimation Monte Carlo (depuis ton cheptel réel, grands-parents inclus) du nombre de montures pour atteindre une génération.",
					inputSchema: z.object({
						targetGen: z.number().int().min(2).max(10),
						level: z.number().default(60),
						optimakina: z.boolean().default(false),
						clonage: z.boolean().default(true),
					}),
					execute: async (a) => {
						const st = await actions.getState();
						const simInventory = st.mounts
							.filter((m) => m.color && !m.keeper)
							.map((m) => ({
								race: m.color,
								sex: (m.sex === "M" ? 0 : 1) as 0 | 1,
								gp: [...m.grandparents],
								fertile: m.status !== "sterile",
							}));
						const s = Core.monteCarlo(
							{ targetGen: a.targetGen, level: a.level, optimakina: a.optimakina, clonage: a.clonage, maxSteps: 0, inventory: simInventory },
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
					description: "Génère un nom de monture conforme à la convention.",
					inputSchema: z.object({ color: z.string(), sex: z.enum(["M", "F"]), keeper: z.boolean().default(false) }),
					execute: async (a) => ({ name: Core.buildName({ color: a.color, sex: a.sex, keeper: a.keeper }) }),
				}),

				// ── Mutating tools ──
				moveMounts: tool({
					description: "Déplace des montures vers un enclos (pour les monter féconde) ou vers l'étable (enclosId null). Sûr/réversible.",
					inputSchema: z.object({ ids, enclosId: num.nullable() }),
					execute: async ({ ids: mIds, enclosId }) => actions.moveMounts(mIds, enclosId),
				}),
				setStatus: tool({
					description: "Change l'état repro de montures (sterile / fertile / feconde).",
					inputSchema: z.object({ ids, status }),
					execute: async ({ ids: mIds, status: s }) => actions.setStatus(mIds, s),
				}),
				setKeeper: tool({
					description: "Marque/démarque des montures comme keeper (l'exemplaire à protéger).",
					inputSchema: z.object({ ids, keeper: z.boolean() }),
					execute: async ({ ids: mIds, keeper }) => actions.setKeeper(mIds, keeper),
				}),
				recordCross: tool({
					description: "Enregistre un croisement réel : crée le bébé (couleur/sexe obtenus) ; les deux parents deviennent stériles. À confirmer par l'utilisateur.",
					inputSchema: z.object({ parentAId: num, parentBId: num, color: z.string(), sex: z.enum(["M", "F"]) }),
					execute: async (p) => actions.recordCross(p),
				}),
				recordClone: tool({
					description: "Enregistre un clonage : deux stériles de même couleur consommés → une féconde. À confirmer.",
					inputSchema: z.object({ aId: num, bId: num, sex: z.enum(["M", "F"]) }),
					execute: async (p) => actions.recordClone(p),
				}),
				addMounts: tool({
					description: "Enregistre des captures/ajouts : N montures d'une couleur/sexe dans l'étable.",
					inputSchema: z.object({ color: z.string(), sex: z.enum(["M", "F"]), status: status.default("fertile"), count: z.number().int().min(1).max(50) }),
					execute: async (p) => actions.addMounts(p),
				}),
				addEnclos: tool({
					description: "Crée un nouvel enclos.",
					inputSchema: z.object({}),
					execute: async () => actions.addEnclos(),
				}),
				removeEnclos: tool({
					description: "Supprime un enclos (ses montures retournent à l'étable). À confirmer.",
					inputSchema: z.object({ id: num }),
					execute: async ({ id }) => actions.removeEnclos(id),
				}),
				deleteMounts: tool({
					description: "Supprime définitivement des montures. À confirmer.",
					inputSchema: z.object({ ids }),
					execute: async ({ ids: mIds }) => actions.deleteMounts(mIds),
				}),
			};

			const result = streamText({
				model: openai(modelId),
				system: SYSTEM,
				messages: messages.map((m) => ({ role: m.role, content: m.content })),
				tools,
				stopWhen: stepCountIs(12),
			});
			return result.textStream;
		};

		return { isConfigured, reply } as const;
	}),
}) {}
