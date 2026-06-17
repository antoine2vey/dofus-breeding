import { useMemo, useState } from "react";
import { COLORS, COLOR_BY_NAME, GEN_COLOR, crossOdds } from "@dd/core";
import { api } from "../api";
import type { Dragodinde, Enclos, Sex } from "../types";

const RACES = COLORS.map((c) => c.name);
const genOf = (color: string) => COLOR_BY_NAME.get(color)?.gen ?? 0;

interface Mount extends Dragodinde {
  enclosId: number;
  enclosName: string;
}

export function HerdTab({ enclos, onChanged }: { enclos: Enclos[]; onChanged: () => void }) {
  const mounts: Mount[] = useMemo(
    () => enclos.flatMap((e) => e.dragodindes.map((d) => ({ ...d, enclosId: e.id, enclosName: e.name }))),
    [enclos],
  );
  const byId = useMemo(() => new Map(mounts.map((m) => [m.id, m])), [mounts]);

  // Seed-entry form
  const [seedEnclos, setSeedEnclos] = useState<number | "">("");
  const [seedColor, setSeedColor] = useState("Amande");
  const [seedSex, setSeedSex] = useState<Sex>("F");

  // Record-cross form
  const [aId, setAId] = useState<number | "">("");
  const [bId, setBId] = useState<number | "">("");
  const [level, setLevel] = useState(60);
  const [optima, setOptima] = useState(false);
  const [babyColor, setBabyColor] = useState("");
  const [babySex, setBabySex] = useState<Sex>("F");
  const [busy, setBusy] = useState(false);

  const enclosId0 = enclos[0]?.id;
  const grandparents = (m: Mount): string[] =>
    [m.parentA, m.parentB]
      .map((pid) => (pid != null ? byId.get(pid)?.color : undefined))
      .filter((c): c is string => !!c);

  const a = aId !== "" ? byId.get(aId) : undefined;
  const b = bId !== "" ? byId.get(bId) : undefined;
  const odds = useMemo(() => {
    if (!a || !b || !a.color || !b.color) return null;
    return crossOdds(
      { race: a.color, grandparents: grandparents(a) },
      { race: b.color, grandparents: grandparents(b) },
      2 * level,
      optima,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b, level, optima]);

  const refresh = async (p: Promise<unknown>) => {
    setBusy(true);
    await p;
    onChanged();
    setBusy(false);
  };

  const patch = (id: number, body: Partial<Dragodinde>) => refresh(api.patchDragodinde(id, body));

  const fertileMounts = mounts.filter((m) => m.fertile && m.color);

  return (
    <div className="pane planner">
      <div className="pane-head">
        <h2>🐴 Cheptel</h2>
        <span className="muted">{mounts.length} dragodindes · {fertileMounts.length} fécondes</span>
      </div>

      {/* Seed entry */}
      <div className="policy-head">
        <span>Ajouter une monture (stock initial)</span>
        <span className="muted">Gen 1 capturée ou monture existante</span>
      </div>
      <div className="plan-controls">
        <label>
          Enclos
          <select value={seedEnclos} onChange={(e) => setSeedEnclos(Number(e.target.value))}>
            <option value="">— choisir —</option>
            {enclos.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <label>
          Couleur
          <select value={seedColor} onChange={(e) => setSeedColor(e.target.value)}>
            {RACES.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>
        <label>
          Sexe
          <select value={seedSex} onChange={(e) => setSeedSex(e.target.value as Sex)}>
            <option value="F">♀ femelle</option>
            <option value="M">♂ mâle</option>
          </select>
        </label>
        <button
          disabled={busy || seedEnclos === ""}
          onClick={() =>
            refresh(api.addDragodinde(Number(seedEnclos), { color: seedColor, sex: seedSex, fertile: true }))
          }
        >
          + Ajouter
        </button>
      </div>

      {/* Record cross */}
      <div className="policy-head" style={{ marginTop: 16 }}>
        <span>Enregistrer un croisement</span>
        <span className="muted">les parents deviennent stériles · la généalogie est tracée</span>
      </div>
      <div className="plan-controls">
        <label>
          Parent A (♂/♀)
          <select value={aId} onChange={(e) => setAId(Number(e.target.value))}>
            <option value="">—</option>
            {fertileMounts.map((m) => (
              <option key={m.id} value={m.id}>{m.name} · {m.color} · {m.sex}</option>
            ))}
          </select>
        </label>
        <label>
          Parent B
          <select value={bId} onChange={(e) => setBId(Number(e.target.value))}>
            <option value="">—</option>
            {fertileMounts.filter((m) => m.id !== aId && m.sex !== a?.sex).map((m) => (
              <option key={m.id} value={m.id}>{m.name} · {m.color} · {m.sex}</option>
            ))}
          </select>
        </label>
        <label>
          Niveau parents : <b>{level}</b>
          <input type="number" min={1} max={200} value={level}
            onChange={(e) => setLevel(Math.min(200, Math.max(1, Math.floor(Number(e.target.value) || 1))))} />
        </label>
        <label className="chk">
          <input type="checkbox" checked={optima} onChange={(e) => setOptima(e.target.checked)} /> Optimakina
        </label>
      </div>

      {odds && (
        <div className="decode-panel">
          <div className="muted small">
            Probabilités du croisement (cible gen {odds.targetGen}, p {Math.round(odds.pTarget * 100)}%) — choisis ce que tu as <b>réellement</b> obtenu :
          </div>
          <div className="map-chips">
            {odds.outcomes.filter((o) => o.prob > 0.005).map((o) => (
              <button
                key={o.race}
                className={"map-chip" + (babyColor === o.race ? " target" : "")}
                onClick={() => setBabyColor(o.race)}
              >
                <span className="spine-mark" style={{ color: GEN_COLOR[o.gen] }}>◆</span>
                {o.race} <b>{(o.prob * 100).toFixed(0)}%</b>
              </button>
            ))}
          </div>
          <div className="plan-controls" style={{ marginTop: 6 }}>
            <label>
              Bébé obtenu
              <select value={babyColor} onChange={(e) => setBabyColor(e.target.value)}>
                <option value="">— couleur —</option>
                {RACES.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </label>
            <label>
              Sexe du bébé
              <select value={babySex} onChange={(e) => setBabySex(e.target.value as Sex)}>
                <option value="F">♀ femelle</option>
                <option value="M">♂ mâle</option>
              </select>
            </label>
            <button
              disabled={busy || !babyColor || aId === "" || bId === ""}
              onClick={() =>
                refresh(
                  api.breed({
                    parentAId: Number(aId),
                    parentBId: Number(bId),
                    color: babyColor,
                    sex: babySex,
                    enclosId: a?.enclosId ?? enclosId0,
                  }),
                ).then(() => { setBabyColor(""); setAId(""); setBId(""); })
              }
            >
              ✓ Enregistrer le bébé
            </button>
          </div>
        </div>
      )}

      {/* Herd list */}
      <div className="policy-head" style={{ marginTop: 16 }}>
        <span>Toutes les montures</span>
      </div>
      <table className="gen-table">
        <thead>
          <tr>
            <th>Couleur</th><th>Gén.</th><th>Sexe</th><th>Féconde</th><th>Keeper</th><th>Enclos</th><th></th>
          </tr>
        </thead>
        <tbody>
          {mounts.map((m) => (
            <tr key={m.id} className={m.fertile ? "" : "done"}>
              <td className="nm">
                <select value={m.color} onChange={(e) => patch(m.id, { color: e.target.value })}>
                  <option value="">—</option>
                  {RACES.map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </td>
              <td className="cnt" style={{ color: GEN_COLOR[genOf(m.color)] }}>{m.color ? genOf(m.color) : "—"}</td>
              <td>
                <button className="mini ghost" onClick={() => patch(m.id, { sex: m.sex === "F" ? "M" : "F" })}>
                  {m.sex === "F" ? "♀" : "♂"}
                </button>
              </td>
              <td className="ctr"><input type="checkbox" checked={m.fertile} onChange={(e) => patch(m.id, { fertile: e.target.checked })} /></td>
              <td className="ctr"><input type="checkbox" checked={m.keeper} onChange={(e) => patch(m.id, { keeper: e.target.checked })} /></td>
              <td className="rcp muted">{m.enclosName}</td>
              <td><button className="mini ghost" disabled={busy} onClick={() => refresh(api.removeDragodinde(m.id))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="plan-note muted">
        Saisis ton stock (couleur + sexe), puis enregistre chaque croisement réel : le bébé est créé
        avec ses parents (donc ses grands-parents pour le calcul des probabilités) et les deux parents
        passent stériles. Marque <b>keeper</b> l'exemplaire de chaque couleur à ne jamais reproduire.
      </p>
    </div>
  );
}
