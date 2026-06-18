import { useEffect, useMemo, useState } from "react";
import { COLORS, GEN_COLOR } from "@dd/core";
import { api } from "../api";
import { useMutation } from "../useMutation";

/** Succès — mark the colours whose in-game achievement you've already unlocked. They satisfy the
 *  goal (so the planner stops counting them) but never breeding supply, so a done colour that's a
 *  parent of your target is still produced. */
export function SuccesTab({ achievements, onChanged }: { achievements: string[]; onChanged: () => void }) {
  const [done, setDone] = useState<Set<string>>(() => new Set(achievements));
  const { busy, run } = useMutation(onChanged);

  // Keep in sync with the server (the 3s poll) — but never while a save is in flight, so an
  // optimistic edit isn't clobbered by a stale poll mid-save.
  const sig = achievements.join(",");
  useEffect(() => {
    if (!busy) setDone(new Set(achievements));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, busy]);

  const byGen = useMemo(() => {
    const m = new Map<number, { name: string }[]>();
    for (const c of COLORS) (m.get(c.gen) ?? m.set(c.gen, []).get(c.gen)!).push({ name: c.name });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, []);

  const save = (next: Set<string>) => {
    setDone(next); // optimistic
    run(api.setAchievements([...next])); // the seam adds the re-entrancy latch this copy was missing
  };
  const toggle = (color: string) => {
    const next = new Set(done);
    next.has(color) ? next.delete(color) : next.add(color);
    save(next);
  };
  const setGen = (colors: string[], on: boolean) => {
    const next = new Set(done);
    colors.forEach((c) => (on ? next.add(c) : next.delete(c)));
    save(next);
  };

  return (
    <div className="pane planner">
      <div className="pane-head">
        <h2>🏆 Succès</h2>
        <span className="muted">{done.size}/{COLORS.length} couleurs validées</span>
      </div>
      <p className="plan-note muted" style={{ marginTop: 0 }}>
        Coche les couleurs dont tu as <b>déjà débloqué le succès</b> en jeu. Le planificateur ne les
        recomptera plus dans l'objectif — <b>sauf</b> si elles servent de parent pour atteindre une
        génération supérieure (là, il te dira quand même de les reproduire).
      </p>

      {byGen.map(([gen, colors]) => {
        const all = colors.every((c) => done.has(c.name));
        return (
          <div className="succ-gen" key={gen}>
            <div className="succ-head">
              <span style={{ color: GEN_COLOR[gen], fontWeight: 700 }}>Gen {gen}</span>
              <span className="muted small">{colors.filter((c) => done.has(c.name)).length}/{colors.length}</span>
              <button className="mini ghost" disabled={busy} onClick={() => setGen(colors.map((c) => c.name), !all)}>
                {all ? "tout décocher" : "tout cocher"}
              </button>
            </div>
            <div className="succ-grid">
              {colors.map((c) => (
                <label key={c.name} className={"succ-cell" + (done.has(c.name) ? " on" : "")}>
                  <input type="checkbox" checked={done.has(c.name)} disabled={busy} onChange={() => toggle(c.name)} />
                  <span style={{ color: done.has(c.name) ? GEN_COLOR[gen] : undefined }}>{c.name}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
