import { useState } from "react";
import { GEN_COLOR } from "../breeding";
import { monteCarlo, makeRng, type SimSummary } from "../breeding-sim";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

export function RushSimulator() {
  const [targetGen, setTargetGen] = useState(10);
  const [level, setLevel] = useState(60);
  const [optimakina, setOptimakina] = useState(false);
  const [clonage, setClonage] = useState(true);
  const [runs, setRuns] = useState(1000);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<SimSummary | null>(null);

  const pTarget = Math.min(1, 0.3 + 0.0015 * 2 * level + (optimakina ? 0.1 : 0));

  const run = () => {
    setBusy(true);
    // Defer so the "calcul…" state paints before the (sync) sim blocks the thread.
    setTimeout(() => {
      const s = monteCarlo({ targetGen, level, optimakina, clonage, maxSteps: 0 }, runs, makeRng(1234));
      setRes(s);
      setBusy(false);
    }, 20);
  };

  return (
    <div className="pane planner">
      <div className="pane-head">
        <h2>🚀 Simulateur — rush Génération {targetGen}</h2>
        <span className="muted">Monte Carlo · moteur de probabilités validé</span>
      </div>

      <div className="plan-controls">
        <label>
          Génération visée
          <select value={targetGen} onChange={(e) => setTargetGen(Number(e.target.value))}>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((g) => (
              <option key={g} value={g}>
                Gen {g}
              </option>
            ))}
          </select>
        </label>
        <label>
          Niveau des parents : <b>{level}</b> (p cible {Math.round(pTarget * 100)}%)
          <input type="range" min={1} max={200} step={1} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
        </label>
        <label className="chk">
          <input type="checkbox" checked={optimakina} onChange={(e) => setOptimakina(e.target.checked)} />
          Optimakina (+10%)
        </label>
        <label className="chk">
          <input type="checkbox" checked={clonage} onChange={(e) => setClonage(e.target.checked)} />
          Clonage
        </label>
        <label>
          Simulations
          <select value={runs} onChange={(e) => setRuns(Number(e.target.value))}>
            {[200, 1000, 3000].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button onClick={run} disabled={busy}>
          {busy ? "calcul…" : "▶ Lancer"}
        </button>
      </div>

      {res && (
        <>
          <div className="plan-cards">
            <div className="card big">
              <div className="card-label">Dragodindes Gen 1 à capturer (médiane)</div>
              <div className="card-value">{fmt(res.captures.p50)}</div>
              <div className="card-sub">
                <span>Amande <b>{fmt(res.captures.byRace.Amande)}</b></span>
                <span>Dorée <b>{fmt(res.captures.byRace.Dorée)}</b></span>
                <span>Rousse <b>{fmt(res.captures.byRace.Rousse)}</b></span>
                <span>plage p10–p90 : {fmt(res.captures.p10)}–{fmt(res.captures.p90)}</span>
              </div>
            </div>
            <div className="card">
              <div className="card-label">Croisements (moyenne)</div>
              <div className="card-value">{fmt(res.breedings.mean)}</div>
            </div>
            <div className="card">
              <div className="card-label">Clonages (moyenne)</div>
              <div className="card-value">{fmt(res.clonages.mean)}</div>
            </div>
            <div className="card">
              <div className="card-label">À élever — total (moyenne)</div>
              <div className="card-value">{fmt(res.raises.mean)}</div>
            </div>
          </div>

          <div className="policy-block">
            <div className="policy-head">
              <span>Priorités d'élevage</span>
              <span className="muted">couleurs produites le plus souvent sur la ligne gagnante</span>
            </div>
            <table className="gen-table">
              <tbody>
                {res.topBred.map((t) => (
                  <tr key={t.race}>
                    <td className="cnt" style={{ color: GEN_COLOR[t.gen] }}>
                      ×{t.mean.toFixed(1)}
                    </td>
                    <td className="nm">{t.race}</td>
                    <td className="rcp muted">gen {t.gen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="plan-note muted">
        Chaque simulation joue une stratégie qui construit récursivement la recette d'une couleur
        Gen {targetGen}, croise avec les <b>vraies probabilités</b> (généalogie incluse), réessaie sur
        échec, réutilise les bébés « ratés » et recycle les stériles par clonage. On rapporte la
        médiane et la plage p10–p90 sur {fmt(runs)} parties. « À élever » = captures + croisements +
        clonages (chaque monture montée jusqu'à féconde). Note : seul le Gen 1 se capture ; le reste
        se croise. Le genre est supposé gérable sans surcoût notable (rôles ♂/♀ assignables).
      </p>
    </div>
  );
}
