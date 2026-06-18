import { useMemo, useState } from "react";
import { COLORS, COLOR_BY_NAME, GEN_COLOR } from "@dd/core";
import { crossOdds } from "@dd/core";
import { monteCarlo, makeRng } from "@dd/core";
import type { Dragodinde } from "../types";
import { toSimInventory } from "./RushSimulator";

const POTENTIAL: Record<string, number> = (() => {
  const pot: Record<string, number> = {};
  for (const c of COLORS) pot[c.name] = c.gen;
  for (const c of [...COLORS].sort((a, b) => b.gen - a.gen)) {
    if (c.parents) for (const p of c.parents) pot[p] = Math.max(pot[p], pot[c.name]);
  }
  return pot;
})();

const parentsOf = (name: string) => COLOR_BY_NAME.get(name)?.parents ?? null;
const genOf = (name: string) => COLOR_BY_NAME.get(name)?.gen ?? 0;

function ancestry(name: string): Set<string> {
  const seen = new Set<string>();
  const walk = (n: string) => {
    if (seen.has(n)) return;
    seen.add(n);
    parentsOf(n)?.forEach(walk);
  };
  walk(name);
  return seen;
}

/** Per-cross probability of obtaining `child` from its recipe parents (canonical genealogy). */
function crossProb(child: string, level: number, optima: boolean): number {
  const p = parentsOf(child);
  if (!p) return 1;
  const r = crossOdds(
    { race: p[0], grandparents: parentsOf(p[0]) ?? [] },
    { race: p[1], grandparents: parentsOf(p[1]) ?? [] },
    2 * level,
    optima,
  );
  return r.outcomes.find((o) => o.race === child)?.prob ?? 0;
}

interface NodeStat {
  count: number; // expected number of this colour produced (MC)
  prob: number; // per-cross success %
}

function TreeNode({
  name,
  path,
  expanded,
  toggle,
  stat,
}: {
  name: string;
  path: string;
  expanded: Set<string>;
  toggle: (p: string) => void;
  stat: (race: string) => NodeStat;
}) {
  const p = parentsOf(name);
  const open = expanded.has(path);
  const gen = genOf(name);
  const s = stat(name);
  return (
    <li>
      <span className="tree-node">
        {p ? (
          <button className="tree-toggle" onClick={() => toggle(path)}>
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="tree-leaf-dot">●</span>
        )}
        <span className="tree-dot" style={{ background: GEN_COLOR[gen] }} />
        <span className="tree-name">{name}</span>
        <span className="tree-gen muted">gen {gen}</span>
        {s.count > 0 && <span className="tree-count">×{s.count < 10 ? s.count.toFixed(1) : Math.round(s.count)}</span>}
        {p ? (
          <span className="tree-prob" style={{ color: s.prob >= 0.999 ? "var(--accent)" : undefined }}>
            {Math.round(s.prob * 100)}% / croisement
          </span>
        ) : (
          <span className="tree-tag">capture</span>
        )}
      </span>
      {p && open && (
        <ul>
          {p.map((par, i) => (
            <TreeNode key={i} name={par} path={`${path}>${i}:${par}`} expanded={expanded} toggle={toggle} stat={stat} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function BreedingTree({ mounts }: { mounts: Dragodinde[] }) {
  const gen10 = COLORS.filter((c) => c.gen === 10).map((c) => c.name);
  const [target, setTarget] = useState("Emeraude");
  const [level, setLevel] = useState(60);
  const [optima, setOptima] = useState(false);
  const [clonage, setClonage] = useState(true);
  const [useCheptel, setUseCheptel] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["root"]));
  // Stable signature so the (sync) sim only re-runs when stock content actually changes, not on
  // every 3s poll (which hands us a fresh array reference with identical data).
  const usable = toSimInventory(mounts);
  const invSig = JSON.stringify(usable);

  const toggle = (p: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });

  const anc = useMemo(() => ancestry(target), [target]);

  // Monte Carlo for THIS target colour -> expected count of each colour produced.
  // Seeds from your real stock (grandparents included) when "depuis mon cheptel" is on.
  const mc = useMemo(
    () =>
      monteCarlo(
        {
          targetGen: genOf(target),
          targetColor: target,
          level,
          optimakina: optima,
          clonage,
          maxSteps: 0,
          inventory: useCheptel ? (JSON.parse(invSig) as ReturnType<typeof toSimInventory>) : undefined,
        },
        300,
        makeRng(1234),
      ),
    [target, level, optima, clonage, useCheptel, invSig],
  );

  const stat = useMemo(() => {
    const probCache = new Map<string, number>();
    return (race: string): NodeStat => {
      let prob = probCache.get(race);
      if (prob === undefined) {
        prob = crossProb(race, level, optima);
        probCache.set(race, prob);
      }
      return { count: mc.perColor[race] ?? 0, prob };
    };
  }, [mc, level, optima]);

  const byGen = useMemo(() => {
    const m = new Map<number, typeof COLORS[number][]>();
    for (const c of COLORS) (m.get(c.gen) ?? m.set(c.gen, []).get(c.gen)!).push(c);
    return m;
  }, []);

  const expandAll = () => {
    const s = new Set<string>(["root"]);
    const walk = (n: string, path: string) => {
      const p = parentsOf(n);
      if (!p) return;
      s.add(path);
      p.forEach((par, i) => walk(par, `${path}>${i}:${par}`));
    };
    walk(target, "root");
    setExpanded(s);
  };

  const pTarget = Math.min(1, 0.3 + 0.0015 * 2 * level + (optima ? 0.1 : 0));

  return (
    <div className="pane planner">
      <div className="pane-head">
        <h2>🌳 Planificateur — arbre de reproduction</h2>
        <span className="muted">
          {anc.size} couleurs · ~{Math.round(mc.raises.mean)} montures à élever
        </span>
      </div>

      <div className="plan-controls">
        <label>
          Couleur cible
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <optgroup label="Génération 10">
              {gen10.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </optgroup>
            <optgroup label="Toutes">
              {COLORS.filter((c) => c.parents).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} (gen {c.gen})
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label>
          Niveau parents : <b>{level}</b> (p {Math.round(pTarget * 100)}%)
          <input type="number" min={1} max={200} value={level} onChange={(e) => setLevel(Math.min(200, Math.max(1, Math.floor(Number(e.target.value) || 1))))} />
        </label>
        <label className="chk">
          <input type="checkbox" checked={optima} onChange={(e) => setOptima(e.target.checked)} />
          Optimakina (+10%)
        </label>
        <label className="chk">
          <input type="checkbox" checked={clonage} onChange={(e) => setClonage(e.target.checked)} />
          Clonage
        </label>
        <label className="chk" title="Démarre depuis tes montures réelles (grands-parents inclus)">
          <input type="checkbox" checked={useCheptel} onChange={(e) => setUseCheptel(e.target.checked)} disabled={usable.length === 0} />
          Depuis mon cheptel ({usable.length})
        </label>
        <button className="ghost mini" onClick={expandAll}>
          tout déplier
        </button>
        <button className="ghost mini" onClick={() => setExpanded(new Set(["root"]))}>
          replier
        </button>
      </div>

      <div className="plan-cards">
        <div className="card big">
          <div className="card-label">Captures Gen 1 (médiane) pour « {target} »</div>
          <div className="card-value">{Math.round(mc.captures.p50)}</div>
          <div className="card-sub">
            <span>Amande <b>{Math.round(mc.captures.byRace.Amande)}</b></span>
            <span>Dorée <b>{Math.round(mc.captures.byRace.Dorée)}</b></span>
            <span>Rousse <b>{Math.round(mc.captures.byRace.Rousse)}</b></span>
            <span>p10–p90 {mc.captures.p10}–{mc.captures.p90}</span>
          </div>
        </div>
        <div className="card">
          <div className="card-label">Croisements (moy.)</div>
          <div className="card-value">{Math.round(mc.breedings.mean)}</div>
        </div>
        <div className="card">
          <div className="card-label">Clonages (moy.)</div>
          <div className="card-value">{Math.round(mc.clonages.mean)}</div>
        </div>
      </div>

      <div className="tree-wrap">
        <ul className="tree-root">
          <TreeNode name={target} path="root" expanded={expanded} toggle={toggle} stat={stat} />
        </ul>
      </div>

      <div className="policy-head" style={{ marginTop: 16 }}>
        <span>Carte des 66 couleurs</span>
        <span className="muted">surbrillance = lignée de « {target} » · ◆ mène au Gen 10</span>
      </div>
      <div className="map-grid">
        {[...byGen.keys()].sort((a, b) => a - b).map((g) => (
          <div className="map-gen" key={g}>
            <div className="map-gen-label" style={{ color: GEN_COLOR[g] }}>
              Gen {g}
            </div>
            <div className="map-chips">
              {(byGen.get(g) ?? []).map((c) => {
                const inAnc = anc.has(c.name);
                const spine = (POTENTIAL[c.name] ?? c.gen) >= 10;
                const cnt = mc.perColor[c.name] ?? 0;
                return (
                  <button
                    key={c.name}
                    className={"map-chip" + (inAnc ? " on" : "") + (c.name === target ? " target" : "")}
                    style={inAnc ? { borderColor: GEN_COLOR[g] } : undefined}
                    onClick={() => setTarget(c.parents ? c.name : target)}
                    title={c.parents ? `${c.parents[0]} + ${c.parents[1]}` : "capture sauvage"}
                  >
                    {spine && <span className="spine-mark">◆</span>}
                    {c.name}
                    {inAnc && cnt > 0 && <span className="chip-count">×{cnt < 10 ? cnt.toFixed(1) : Math.round(cnt)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="plan-note muted">
        Chaque nœud indique le <b>nombre moyen de montures de cette couleur</b> à produire (Monte
        Carlo, 300 parties) et le <b>taux de réussite par croisement</b> (moteur de probabilités, avec
        généalogie canonique, votre niveau et optimakina). Seul le Gen 1 se capture. Le compteur et les
        % réagissent au niveau / optimakina / clonage. ◆ = couleur « épine dorsale » menant au Gen 10.
        Les probabilités réelles dépendent de la généalogie exacte de vos montures — vérifiez-les dans
        l'onglet Probabilités.
      </p>
    </div>
  );
}
