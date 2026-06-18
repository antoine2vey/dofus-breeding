import { useState } from "react";
import type { Recommendation } from "@dd/core";
import { GEN_COLOR } from "@dd/core";
import { api } from "../api";

export function AssistantTab() {
  const [targetGen, setTargetGen] = useState(10);
  const [level, setLevel] = useState(60);
  const [optimakina, setOptimakina] = useState(false);
  const [clonage, setClonage] = useState(true);
  const [freeSlots, setFreeSlots] = useState(6);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Chat (SSE streaming)
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

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
        body: JSON.stringify({ messages: history, targetGen, level, optimakina, clonage, freeSlots }),
      });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({ error: "Erreur réseau" }));
        setChat([...history, { role: "assistant", content: `⚠️ ${e.error ?? "Erreur"}` }]);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
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
            const a = acc;
            setChat([...history, { role: "assistant", content: a }]);
          } catch {
            /* ignore partial */
          }
        }
      }
    } catch {
      setChat([...history, { role: "assistant", content: "⚠️ Connexion interrompue" }]);
    } finally {
      setStreaming(false);
    }
  };

  const run = () => {
    setBusy(true);
    setErr(null);
    api
      .recommend({ targetGen, level, optimakina, clonage, freeSlots })
      .then((r) => setRec(r))
      .catch(() => setErr("Échec — le serveur a-t-il l'inventaire ?"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="pane planner">
      <div className="pane-head">
        <h2>🤖 Assistant</h2>
        <span className="muted">recommandations déterministes depuis ton cheptel</span>
      </div>

      <div className="plan-controls">
        <label>
          Objectif
          <select value={targetGen} onChange={(e) => setTargetGen(Number(e.target.value))}>
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((g) => (
              <option key={g} value={g}>Atteindre Gen {g}</option>
            ))}
          </select>
        </label>
        <label>
          Niveau parents : <b>{level}</b>
          <input type="number" min={1} max={200} value={level}
            onChange={(e) => setLevel(Math.min(200, Math.max(1, Math.floor(Number(e.target.value) || 1))))} />
        </label>
        <label>
          Enclos libres
          <input type="number" min={1} max={60} value={freeSlots}
            onChange={(e) => setFreeSlots(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
        </label>
        <label className="chk">
          <input type="checkbox" checked={optimakina} onChange={(e) => setOptimakina(e.target.checked)} /> Optimakina
        </label>
        <label className="chk">
          <input type="checkbox" checked={clonage} onChange={(e) => setClonage(e.target.checked)} /> Clonage
        </label>
        <button onClick={run} disabled={busy}>{busy ? "calcul…" : "▶ Recommander"}</button>
      </div>

      {err && <div className="decode-err">✗ {err}</div>}

      {rec && (
        <>
          <div className="plan-cards">
            <div className="card">
              <div className="card-label">Génération atteinte</div>
              <div className="card-value">{rec.highestGen}</div>
            </div>
            <div className="card">
              <div className="card-label">Couleurs possédées</div>
              <div className="card-value">{rec.obtainedColors}</div>
            </div>
            <div className="card big">
              <div className="card-label">Manquantes pour Gen {rec.targetGen}</div>
              <div className="card-value">{rec.missingToTarget.length}</div>
              <div className="card-sub"><span>{rec.missingToTarget.slice(0, 6).join(", ")}{rec.missingToTarget.length > 6 ? "…" : ""}</span></div>
            </div>
          </div>

          <div className="policy-head"><span>① Croisements à faire</span><span className="muted">tes meilleures paires fécondes</span></div>
          {rec.breed.length === 0 ? (
            <div className="muted small">Aucune paire productive — capture d'abord (ci-dessous).</div>
          ) : (
            <table className="gen-table">
              <tbody>
                {rec.breed.map((b, i) => (
                  <tr key={i}>
                    <td className="nm">{b.aLabel} × {b.bLabel}</td>
                    <td className="rcp">
                      {b.top.map((o) => (
                        <span key={o.race} style={{ marginRight: 8 }}>
                          <b style={{ color: GEN_COLOR[o.gen] }}>{Math.round(o.prob * 100)}%</b> {o.race}
                        </span>
                      ))}
                    </td>
                    <td className="muted small">{b.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {rec.capture.length > 0 && (
            <>
              <div className="policy-head" style={{ marginTop: 14 }}><span>② À capturer</span></div>
              <div className="map-chips">
                {rec.capture.map((c) => (
                  <span className="code-chip" key={c.color} title={c.reason}>
                    <b>{c.color}</b> ×{c.count}
                  </span>
                ))}
              </div>
            </>
          )}

          {rec.recycle.length > 0 && (
            <>
              <div className="policy-head" style={{ marginTop: 14 }}><span>③ À recycler</span></div>
              <table className="gen-table">
                <tbody>
                  {rec.recycle.map((x, i) => (
                    <tr key={i}>
                      <td className="cnt">{x.kind === "clone" ? "♻ cloner" : "✂ extraire"}</td>
                      <td className="nm">{x.color} <span className="muted small">#{x.ids.join(", ")}</span></td>
                      <td className="muted small">{x.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {/* Chat */}
      <div className="policy-head" style={{ marginTop: 18 }}>
        <span>💬 Demander à l'assistant</span>
        <span className="muted">explique le plan, répond aux « et si… » (utilise tes réglages ci-dessus)</span>
      </div>
      <div className="chat-log">
        {chat.length === 0 && (
          <div className="muted small">
            Ex. « Que dois-je faire en priorité ? », « Quelles sont mes chances pour un Pourpre ? »,
            « Combien de captures pour atteindre la gen 7 ? »
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={"chat-msg " + m.role}>
            <span className="chat-who">{m.role === "user" ? "toi" : "🤖"}</span>
            <span className="chat-text">{m.content || (streaming && i === chat.length - 1 ? "…" : "")}</span>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={input}
          placeholder="Pose ta question…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
          disabled={streaming}
        />
        <button onClick={sendChat} disabled={streaming || !input.trim()}>
          {streaming ? "…" : "Envoyer"}
        </button>
      </div>

      <p className="plan-note muted">
        Calcul <b>déterministe</b> à partir de ton Cheptel : les meilleures paires (vraies
        probabilités × potentiel vers la cible), ce qu'il faut capturer, et quoi recycler. Fais les
        croisements en jeu puis enregistre-les dans Cheptel, et relance — c'est un plan tour par tour.
        Le chat IA (à venir) expliquera et répondra aux questions « et si… ».
      </p>
    </div>
  );
}
