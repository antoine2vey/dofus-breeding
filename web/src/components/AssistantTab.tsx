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

      <p className="plan-note muted">
        Calcul <b>déterministe</b> à partir de ton Cheptel : les meilleures paires (vraies
        probabilités × potentiel vers la cible), ce qu'il faut capturer, et quoi recycler. Fais les
        croisements en jeu puis enregistre-les dans Cheptel, et relance — c'est un plan tour par tour.
        Le chat IA (à venir) expliquera et répondra aux questions « et si… ».
      </p>
    </div>
  );
}
