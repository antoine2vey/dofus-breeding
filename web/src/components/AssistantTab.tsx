import { useCallback, useEffect, useState } from "react";
import { COLOR_BY_NAME, COLORS, GEN_COLOR } from "@dd/core";
import type { AssistantPlan, BreedAction, CaptureNeed, CloneAction, RaiseAction } from "@dd/core";
import { api } from "../api";
import type { Dragodinde, Enclos, ReproStatus, Sex } from "../types";

const RACES = COLORS.map((c) => c.name);
const genOf = (c: string) => COLOR_BY_NAME.get(c)?.gen ?? 0;
const STATUS_LABEL: Record<ReproStatus, string> = { feconde: "féconde", fertile: "fertile", sterile: "stérile" };

// ── Next-step rows (each owns its local pickers) ───────────────────────────
function BreedRow({ a, busy, onApply }: { a: BreedAction; busy: boolean; onApply: (color: string, sex: Sex) => void }) {
  const [color, setColor] = useState(a.top[0]?.race ?? "");
  const [sex, setSex] = useState<Sex>("F");
  return (
    <div className="step-row">
      <span className="sr-main">{a.aLabel} × {a.bLabel}</span>
      <span className="sr-odds">
        {a.top.map((o) => (
          <span key={o.race} style={{ marginRight: 8 }}>
            <b style={{ color: GEN_COLOR[o.gen] }}>{Math.round(o.prob * 100)}%</b> {o.race}
          </span>
        ))}
      </span>
      <span className="sr-act">
        <select value={color} onChange={(e) => setColor(e.target.value)} title="couleur obtenue">
          {RACES.map((r) => (<option key={r} value={r}>{r}</option>))}
        </select>
        <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}><option value="F">♀</option><option value="M">♂</option></select>
        <button className="mini" disabled={busy || !color} onClick={() => onApply(color, sex)}>✓ enregistrer</button>
      </span>
    </div>
  );
}

function CloneRow({ a, names, busy, onApply }: { a: CloneAction; names: [string, string]; busy: boolean; onApply: (survivorId: number) => void }) {
  // Two same-gen steriles, one survives (refreshed to fertile, keeps its own attributes); the user
  // picks which one stays — the other is consumed.
  const [survivorId, setSurvivorId] = useState<number>(a.aId);
  return (
    <div className="step-row">
      <span className="sr-main">♻ <span className="muted small">{names[0]}, {names[1]}</span></span>
      <span className="sr-odds muted small">{a.reason}</span>
      <span className="sr-act">
        <select title="survivante" value={survivorId} onChange={(e) => setSurvivorId(Number(e.target.value))}>
          <option value={a.aId}>{names[0]}</option>
          <option value={a.bId}>{names[1]}</option>
        </select>
        <button className="mini" disabled={busy} onClick={() => onApply(survivorId)}>♻ cloner</button>
      </span>
    </div>
  );
}

function CaptureRow({ need, busy, onApply }: { need: CaptureNeed; busy: boolean; onApply: (count: number, sex: Sex) => void }) {
  const [count, setCount] = useState(need.count);
  const [sex, setSex] = useState<Sex>("F");
  // Re-seed when the planner's remaining count changes (e.g. after a partial capture).
  useEffect(() => setCount(need.count), [need.count]);
  return (
    <div className="step-row">
      <span className="sr-main" style={{ color: GEN_COLOR[genOf(need.color)] }}>{need.color}</span>
      <span className="sr-odds muted small">à capturer en jeu, puis enregistrer ici</span>
      <span className="sr-act">
        <input type="number" min={1} max={50} value={count} style={{ width: 56 }}
          onChange={(e) => setCount(Math.max(1, Math.min(50, Math.floor(Number(e.target.value) || 1))))} />
        <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}><option value="F">♀</option><option value="M">♂</option></select>
        <button className="mini" disabled={busy} onClick={() => onApply(count, sex)}>+ enregistrer</button>
      </span>
    </div>
  );
}

export function AssistantTab({ enclos, stable, onChanged }: { enclos: Enclos[]; stable: Dragodinde[]; onChanged: () => void }) {
  const [targetGen, setTargetGen] = useState(10);
  const [level, setLevel] = useState(60);
  const [optimakina, setOptimakina] = useState(false);
  const [clonage, setClonage] = useState(true);
  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openGens, setOpenGens] = useState<Set<number>>(new Set());

  // Chat (SSE streaming)
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const refetchPlan = useCallback(async () => {
    setBusy(true);
    try {
      setPlan(await api.assistantPlan({ targetGen, level, optimakina, clonage }));
      setPlanErr(null);
    } catch {
      setPlanErr("Échec du calcul du plan — le serveur tourne-t-il ?");
    } finally {
      setBusy(false);
    }
  }, [targetGen, level, optimakina, clonage]);

  // Debounced so dragging the level input doesn't POST a plan on every keystroke.
  useEffect(() => {
    const t = setTimeout(refetchPlan, 350);
    return () => clearTimeout(t);
  }, [refetchPlan]);

  const act = async (p: Promise<{ error?: string } | unknown>) => {
    setBusy(true);
    try {
      const r = await p;
      onChanged();
      await refetchPlan();
      // refetchPlan clears planErr on success — surface any action error AFTER it so it sticks.
      if (r && typeof r === "object" && "error" in r && (r as { error?: string }).error) {
        setPlanErr((r as { error: string }).error);
      }
    } finally {
      setBusy(false);
    }
  };
  const applyRaise = (a: RaiseAction) => act(api.bulkMove([...a.mountIds], a.enclosId));
  const applyBreed = (a: BreedAction, color: string, sex: Sex) =>
    act(api.breed({ parentAId: a.aId, parentBId: a.bId, color, sex }));
  const applyClone = (a: CloneAction, survivorId: number) =>
    act(api.clone({ survivorId, consumedId: survivorId === a.aId ? a.bId : a.aId }));
  const applyCapture = (need: CaptureNeed, count: number, sex: Sex) =>
    act(api.importMounts(Array.from({ length: count }, () => ({ color: need.color, sex, status: "fertile" as ReproStatus })), null));

  const sendChat = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const history = [...chat, { role: "user" as const, content: text }];
    setChat([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, targetGen, level, optimakina, clonage }),
      });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({ error: "Erreur réseau" }));
        setChat([...history, { role: "assistant", content: `⚠️ ${e.error ?? "Erreur"}` }]);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload) as { text?: string; error?: string };
            if (obj.text) acc += obj.text;
            if (obj.error) acc += `\n⚠️ ${obj.error}`;
            setChat([...history, { role: "assistant", content: acc }]);
          } catch { /* partial */ }
        }
      }
    } catch {
      setChat([...history, { role: "assistant", content: "⚠️ Connexion interrompue" }]);
    } finally {
      setStreaming(false);
      onChanged();       // the AI may have mutated state via tools
      await refetchPlan();
    }
  };

  const toggleGen = (g: number) =>
    setOpenGens((s) => { const n = new Set(s); n.has(g) ? n.delete(g) : n.add(g); return n; });

  // Live context (from props — always fresh via the 3s poll)
  const stableByStatus = (st: ReproStatus) => stable.filter((m) => m.status === st).length;
  const ns = plan?.nextStep;
  // Resolve mount ids to their in-game (convention) names so steps are findable in the game.
  const nameById = new Map([...stable, ...enclos.flatMap((e) => e.dragodindes)].map((m) => [m.id, m.name]));
  const nm = (id: number) => nameById.get(id) ?? `#${id}`;

  return (
    <div className="pane planner assistant-v2">
      <div className="pane-head">
        <h2>🤖 Assistant</h2>
        <span className="muted">plan déterministe + contremaître IA</span>
      </div>

      {/* Controls */}
      <div className="plan-controls">
        <label>Objectif
          <select value={targetGen} onChange={(e) => setTargetGen(Number(e.target.value))}>
            {[2,3,4,5,6,7,8,9,10].map((g) => (<option key={g} value={g}>Atteindre Gen {g}</option>))}
          </select>
        </label>
        <label>Niveau : <b>{level}</b>
          <input type="number" min={1} max={200} value={level}
            onChange={(e) => setLevel(Math.min(200, Math.max(1, Math.floor(Number(e.target.value) || 1))))} />
        </label>
        <label className="chk"><input type="checkbox" checked={optimakina} onChange={(e) => setOptimakina(e.target.checked)} /> Optimakina</label>
        <label className="chk"><input type="checkbox" checked={clonage} onChange={(e) => setClonage(e.target.checked)} /> Clonage</label>
        <button className="ghost" disabled={busy} onClick={refetchPlan}>{busy ? "calcul…" : "↻ Recalculer"}</button>
      </div>

      {planErr && <div className="decode-err">✗ {planErr}</div>}

      {/* Live context bar */}
      <div className="ctx-bar">
        <div className="ctx-block">
          <div className="ctx-label">🏠 Étable <span className="muted">({stable.length})</span></div>
          <div className="ctx-pills">
            <span className="pill ok">{stableByStatus("feconde")} féconde</span>
            <span className="pill">{stableByStatus("fertile")} fertile</span>
            <span className="pill bad">{stableByStatus("sterile")} stérile</span>
          </div>
        </div>
        <div className="ctx-block">
          <div className="ctx-label">Enclos</div>
          <div className="ctx-pills">
            {enclos.map((e) => (
              <span key={e.id} className={"pill" + (e.dragodindes.length >= 10 ? " bad" : e.dragodindes.length === 0 ? " ok" : "")}
                title={e.dragodindes.map((d) => `${d.name} (${STATUS_LABEL[d.status]})`).join(", ") || "vide"}>
                {e.name}: {e.dragodindes.length}/10
              </span>
            ))}
          </div>
        </div>
      </div>

      {plan && (
        <>
          {/* Progress cards */}
          <div className="plan-cards">
            <div className="card big">
              <div className="card-label">Couleurs obtenues (gen {plan.roadmap.targetGen})</div>
              <div className="card-value">{plan.roadmap.obtainedColors}/{plan.roadmap.totalColors}</div>
              <div className="card-sub"><span>{plan.roadmap.reached ? "objectif atteint 🎉" : ns?.summary}</span></div>
            </div>
            <div className="card">
              <div className="card-label">Captures restantes</div>
              <div className="card-value">{Object.values(plan.roadmap.baseCaptures).reduce((a, b) => a + b, 0)}</div>
            </div>
            <div className="card">
              <div className="card-label">Croisements restants</div>
              <div className="card-value">{plan.roadmap.totalCrosses}</div>
            </div>
          </div>

          {/* ── Layer B: next step ── */}
          <div className="policy-head"><span>▶ Prochaine étape</span><span className="muted">{ns?.summary}</span></div>
          {ns && !ns.done && (ns.raise.length + ns.breed.length + ns.clone.length + ns.capture.length === 0) && (
            <div className="muted small">Rien à appliquer directement — capture des bases ou monte des montures.</div>
          )}

          {ns && ns.raise.length > 0 && (
            <div className="step-group">
              <div className="step-title">⬆ Élever vers féconde <span className="muted small">déplacement auto</span></div>
              {ns.raise.map((a) => (
                <div className="step-row" key={a.enclosId}>
                  <span className="sr-main">{a.enclosName} <span className="muted small">({a.mountIds.length})</span></span>
                  <span className="sr-odds small">{a.mountIds.map(nm).join(", ")}</span>
                  <span className="sr-act"><button className="mini" disabled={busy} onClick={() => applyRaise(a)}>→ déplacer</button></span>
                </div>
              ))}
            </div>
          )}

          {ns && ns.breed.length > 0 && (
            <div className="step-group">
              <div className="step-title">⚥ Croiser (féconde) <span className="muted small">choisis la couleur réellement obtenue</span></div>
              {ns.breed.map((a) => (
                <BreedRow key={`${a.aId}-${a.bId}`} a={a} busy={busy} onApply={(c, s) => applyBreed(a, c, s)} />
              ))}
            </div>
          )}

          {ns && ns.clone.length > 0 && (
            <div className="step-group">
              <div className="step-title">♻ Cloner (stériles)</div>
              {ns.clone.map((a) => (
                <CloneRow key={`${a.aId}-${a.bId}`} a={a} names={[nm(a.aId), nm(a.bId)]} busy={busy} onApply={(s) => applyClone(a, s)} />
              ))}
            </div>
          )}

          {ns && ns.capture.length > 0 && (
            <div className="step-group">
              <div className="step-title">🎯 Capturer (Gen 1)</div>
              {ns.capture.map((need) => (
                <CaptureRow key={need.color} need={need} busy={busy} onApply={(c, s) => applyCapture(need, c, s)} />
              ))}
            </div>
          )}

          {/* ── Layer A: roadmap ── */}
          <div className="policy-head" style={{ marginTop: 16 }}><span>🗺 Feuille de route</span><span className="muted">besoins restants, du bas vers la gen {plan.roadmap.targetGen}</span></div>
          {plan.roadmap.gens.map((g) => {
            const open = openGens.has(g.gen);
            const remaining = g.rows.reduce((n, r) => n + r.need, 0);
            return (
              <div className="roadmap-gen" key={g.gen}>
                <button className="rg-head" onClick={() => toggleGen(g.gen)}>
                  <span style={{ color: GEN_COLOR[g.gen], fontWeight: 700 }}>{open ? "▾" : "▸"} Gen {g.gen}</span>
                  <span className="muted small">{g.rows.length} couleur(s) · {remaining} à produire</span>
                </button>
                {open && (
                  <table className="roadmap-table">
                    <tbody>
                      {g.rows.map((r) => {
                        const total = r.owned + r.need;
                        const frac = total > 0 ? r.owned / total : 1;
                        return (
                          <tr key={r.color}>
                            <td style={{ color: GEN_COLOR[r.gen] }}>{r.done ? "🏆 " : ""}{r.color}</td>
                            <td className="rm-recipe muted small">{r.recipe ? r.recipe.join(" + ") : "capture"}{r.done && r.need > 0 ? " · succès, mais parent requis" : ""}</td>
                            <td className="rm-prog">
                              {r.done && r.need === 0
                                ? <span className="muted small">succès ✓</span>
                                : <div className="hmeter"><div className="hfill" style={{ width: `${frac * 100}%`, background: GEN_COLOR[r.gen] }} /></div>}
                            </td>
                            <td className="rm-count">{r.done && r.need === 0 ? "—" : `${r.owned}/${total}`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Chat side-channel */}
      <div className="policy-head" style={{ marginTop: 18 }}>
        <span>💬 Contremaître IA</span>
        <span className="muted">demande, ajuste, ou laisse-le agir (« croise 3 et 4 », « j'ai capturé 5 Amande »)</span>
      </div>
      <div className="chat-log">
        {chat.length === 0 && (
          <div className="muted small">Ex. « Que faire en priorité ? », « Mets mes Amande fertiles en enclos 2 », « J'ai capturé 4 Rousse ».</div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={"chat-msg " + m.role}>
            <span className="chat-who">{m.role === "user" ? "toi" : "🤖"}</span>
            <span className="chat-text">{m.content || (streaming && i === chat.length - 1 ? "…" : "")}</span>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input type="text" value={input} placeholder="Pose ta question ou donne un ordre…"
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }} disabled={streaming} />
        <button onClick={sendChat} disabled={streaming || !input.trim()}>{streaming ? "…" : "Envoyer"}</button>
      </div>

      <p className="plan-note muted">
        Le plan est <b>déterministe</b> (feuille de route + prochaine étape calculées depuis ton cheptel réel) ;
        les déplacements s'appliquent direct, les croisements/clonages se confirment. Le <b>contremaître IA</b>
        lit le même plan, répond aux questions et peut agir sur ta demande.
      </p>
    </div>
  );
}
