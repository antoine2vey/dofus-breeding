import { useEffect, useMemo, useState } from "react";
import { COLORS, COLOR_BY_NAME, GEN_COLOR, buildName, crossOdds, parseName } from "@dd/core";
import type { NameParts } from "@dd/core";
import { api } from "../api";
import type { Dragodinde, Enclos, ImportRow, ReproStatus, Sex } from "../types";

const RACES = COLORS.map((c) => c.name);
const genOf = (color: string) => COLOR_BY_NAME.get(color)?.gen ?? 0;

// In-game reproduction states, ordered most→least useful for breeding.
const STATUS: { value: ReproStatus; label: string }[] = [
  { value: "feconde", label: "Féconde" },
  { value: "fertile", label: "Fertile" },
  { value: "sterile", label: "Stérile" },
];

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
  const [seedEnclos, setSeedEnclos] = useState<number | "">(enclos[0]?.id ?? "");
  const [seedColor, setSeedColor] = useState("Amande");
  const [seedSex, setSeedSex] = useState<Sex>("F");
  const [seedStatus, setSeedStatus] = useState<ReproStatus>("fertile");

  // Record-cross form
  const [aId, setAId] = useState<number | "">("");
  const [bId, setBId] = useState<number | "">("");
  const [level, setLevel] = useState(60);
  const [optima, setOptima] = useState(false);
  const [babyColor, setBabyColor] = useState("");
  const [babySex, setBabySex] = useState<Sex>("F");
  const [busy, setBusy] = useState(false);

  // Clonage form
  const [cloneAId, setCloneAId] = useState<number | "">("");
  const [cloneBId, setCloneBId] = useState<number | "">("");
  const [cloneSex, setCloneSex] = useState<Sex>("F");

  // Import (paste in-game names) form
  const [importEnclos, setImportEnclos] = useState<number | "">(enclos[0]?.id ?? "");
  const [importText, setImportText] = useState("");
  const [parsed, setParsed] = useState<{ line: string; parts: NameParts | null; status: ReproStatus }[]>([]);
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => {
    if (enclos[0]) {
      if (seedEnclos === "") setSeedEnclos(enclos[0].id);
      if (importEnclos === "") setImportEnclos(enclos[0].id);
    }
  }, [enclos, seedEnclos, importEnclos]);

  const a = aId !== "" ? byId.get(aId) : undefined;
  const b = bId !== "" ? byId.get(bId) : undefined;
  const odds =
    a && b && a.color && b.color
      ? crossOdds(
          { race: a.color, grandparents: [...a.grandparents] },
          { race: b.color, grandparents: [...b.grandparents] },
          2 * level,
          optima,
        )
      : null;

  const run = async (p: Promise<unknown>) => {
    setBusy(true);
    try {
      await p;
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const patch = (id: number, body: Partial<Dragodinde>) => run(api.patchDragodinde(id, body));

  // Next index for a (colour, sex, keeper) bucket, for the naming convention.
  const nextIndex = (color: string, sex: Sex, keeper: boolean) =>
    mounts.filter((m) => m.color === color && m.sex === sex && m.keeper === keeper).length + 1;
  const suggestName = (m: Mount) =>
    m.color
      ? buildName({
          color: m.color,
          sex: m.sex,
          index: nextIndex(m.color, m.sex, m.keeper),
          keeper: m.keeper,
          grandparents: m.grandparents,
        })
      : "";

  // Only FÉCONDE mounts can breed now; FERTILE ones still need their gauges raised.
  const fecondeMounts = mounts.filter((m) => m.status === "feconde");
  const labelOf = (m: Mount) => `${m.name} · ${m.color || "(sans couleur)"} · ${m.sex === "F" ? "♀" : "♂"}`;

  // Import: decode each pasted line via the naming convention.
  const analyze = () => {
    setImportMsg("");
    setParsed(
      importText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => ({ line, parts: parseName(line), status: "fertile" as ReproStatus })),
    );
  };
  const validParsed = parsed.filter((p) => p.parts);
  const doImport = () => {
    if (importEnclos === "" || validParsed.length === 0) return;
    const rows: ImportRow[] = validParsed.map((p) => ({
      name: p.line,
      color: p.parts!.color,
      sex: p.parts!.sex,
      keeper: p.parts!.keeper,
      status: p.status,
      grandparents: p.parts!.grandparents ? [...p.parts!.grandparents] : [],
    }));
    run(
      api.importMounts(Number(importEnclos), rows).then((res) => {
        if ("error" in res) {
          setImportMsg("✗ " + res.error);
          return;
        }
        setImportMsg(`✓ ${res.created} importée(s)` + (res.skipped ? ` · ${res.skipped} ignorée(s) (enclos plein)` : ""));
        setImportText("");
        setParsed([]);
      }),
    );
  };

  // Clonage: two same-colour steriles -> one fresh fertile of that colour.
  const steriles = mounts.filter((m) => m.status === "sterile" && m.color);
  const cloneA = cloneAId !== "" ? byId.get(cloneAId) : undefined;
  const cloneB = cloneBId !== "" ? byId.get(cloneBId) : undefined;
  // Colours that have at least two steriles (so a clone is possible).
  const clonableColors = [...new Set(steriles.map((m) => m.color))].filter(
    (c) => steriles.filter((m) => m.color === c).length >= 2,
  );

  return (
    <div className="pane planner">
      <div className="pane-head">
        <h2>🐴 Cheptel</h2>
        <span className="muted">{mounts.length} dragodindes · {fecondeMounts.length} fécondes</span>
      </div>

      {/* Import from in-game names */}
      <div className="policy-head"><span>📥 Importer depuis le jeu</span><span className="muted">colle les noms de tes montures (1 par ligne)</span></div>
      <div className="muted small" style={{ marginBottom: 6 }}>
        Renomme tes montures avec la convention <code>couleur-[K]sexe·n°-gp1-gp2</code> (ex.{" "}
        <code>i-fa-e-ei</code>), puis colle la liste ici : couleur, sexe, keeper <b>et</b> les deux
        grands-parents sont décodés du nom. L'état (féconde / fertile / stérile) se règle par ligne ci-dessous.
      </div>
      <div className="plan-controls">
        <label>Enclos cible
          <select value={importEnclos} onChange={(e) => setImportEnclos(Number(e.target.value))}>
            {enclos.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
          </select>
        </label>
        <button className="ghost" disabled={!importText.trim()} onClick={analyze}>Analyser</button>
        {parsed.length > 0 && (
          <button disabled={busy || validParsed.length === 0} onClick={doImport}>
            📥 Importer {validParsed.length} monture(s)
          </button>
        )}
      </div>
      <textarea
        className="import-area"
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder={"i-fa-e-ei\nei-Kma-a-d\nt-fa"}
        rows={4}
      />
      {importMsg && <div className={importMsg.startsWith("✗") ? "decode-err" : "decode-ok"}>{importMsg}</div>}
      {parsed.length > 0 && (
        <table className="herd-table">
          <thead>
            <tr><th>Nom</th><th>Couleur</th><th>Sexe</th><th>Keeper</th><th>Grands-parents</th><th>État</th></tr>
          </thead>
          <tbody>
            {parsed.map((p, i) => (
              <tr key={i} className={p.parts ? "" : "sterile"}>
                <td className="herd-name"><code>{p.line}</code></td>
                {p.parts ? (
                  <>
                    <td style={{ color: GEN_COLOR[genOf(p.parts.color)] }}>{p.parts.color}</td>
                    <td className="ctr">{p.parts.sex === "F" ? "♀" : "♂"}</td>
                    <td className="ctr">{p.parts.keeper ? "★" : ""}</td>
                    <td className="muted small">{p.parts.grandparents?.join(" + ") || "—"}</td>
                    <td>
                      <select value={p.status}
                        onChange={(e) => setParsed(parsed.map((q, j) => (j === i ? { ...q, status: e.target.value as ReproStatus } : q)))}>
                        {STATUS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                      </select>
                    </td>
                  </>
                ) : (
                  <td colSpan={5} className="decode-err">nom non reconnu</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Seed entry */}
      <div className="policy-head" style={{ marginTop: 16 }}><span>Ajouter une monture</span><span className="muted">Gen 1 capturée ou stock existant</span></div>
      <div className="plan-controls">
        <label>Enclos
          <select value={seedEnclos} onChange={(e) => setSeedEnclos(Number(e.target.value))}>
            {enclos.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
          </select>
        </label>
        <label>Couleur
          <select value={seedColor} onChange={(e) => setSeedColor(e.target.value)}>
            {RACES.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>
        <label>Sexe
          <select value={seedSex} onChange={(e) => setSeedSex(e.target.value as Sex)}>
            <option value="F">♀ femelle</option><option value="M">♂ mâle</option>
          </select>
        </label>
        <label>État
          <select value={seedStatus} onChange={(e) => setSeedStatus(e.target.value as ReproStatus)}>
            {STATUS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
        </label>
        <button disabled={busy || seedEnclos === ""}
          onClick={() => run(api.addDragodinde(Number(seedEnclos), {
            color: seedColor, sex: seedSex, status: seedStatus,
            name: buildName({ color: seedColor, sex: seedSex, index: nextIndex(seedColor, seedSex, false), keeper: false }),
          }))}>
          + Ajouter
        </button>
      </div>

      {/* Record cross */}
      <div className="policy-head" style={{ marginTop: 16 }}><span>Enregistrer un croisement</span><span className="muted">parents <b>féconds</b> uniquement · ils deviennent stériles · généalogie tracée</span></div>
      <div className="plan-controls">
        <label>Parent A
          <select value={aId} onChange={(e) => { setAId(Number(e.target.value)); setBId(""); }}>
            <option value="">—</option>
            {fecondeMounts.map((m) => (<option key={m.id} value={m.id}>{labelOf(m)}</option>))}
          </select>
        </label>
        <label>Parent B (sexe opposé)
          <select value={bId} onChange={(e) => setBId(Number(e.target.value))} disabled={aId === ""}>
            <option value="">—</option>
            {fecondeMounts.filter((m) => m.id !== aId && (!a || m.sex !== a.sex)).map((m) => (
              <option key={m.id} value={m.id}>{labelOf(m)}</option>
            ))}
          </select>
        </label>
        <label>Niveau parents : <b>{level}</b>
          <input type="number" min={1} max={200} value={level}
            onChange={(e) => setLevel(Math.min(200, Math.max(1, Math.floor(Number(e.target.value) || 1))))} />
        </label>
        <label className="chk"><input type="checkbox" checked={optima} onChange={(e) => setOptima(e.target.checked)} /> Optimakina</label>
      </div>

      {a && b && (
        <div className="decode-panel">
          {odds ? (
            <>
              <div className="muted small">Probabilités (cible gen {odds.targetGen}, p {Math.round(odds.pTarget * 100)}%) — choisis ce que tu as <b>réellement</b> obtenu :</div>
              <div className="map-chips">
                {odds.outcomes.filter((o) => o.prob > 0.005).map((o) => (
                  <button key={o.race} className={"map-chip" + (babyColor === o.race ? " target" : "")} onClick={() => setBabyColor(o.race)}>
                    <b style={{ color: GEN_COLOR[o.gen] }}>{(o.prob * 100).toFixed(0)}%</b> {o.race}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="muted small">Renseigne la couleur des deux parents pour voir les probabilités. Tu peux quand même enregistrer le bébé ci-dessous.</div>
          )}
          <div className="plan-controls" style={{ marginTop: 6 }}>
            <label>Bébé obtenu
              <select value={babyColor} onChange={(e) => setBabyColor(e.target.value)}>
                <option value="">— couleur —</option>
                {RACES.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </label>
            <label>Sexe du bébé
              <select value={babySex} onChange={(e) => setBabySex(e.target.value as Sex)}>
                <option value="F">♀ femelle</option><option value="M">♂ mâle</option>
              </select>
            </label>
            <button disabled={busy || !babyColor}
              onClick={() => run(api.breed({
                parentAId: Number(aId), parentBId: Number(bId), color: babyColor, sex: babySex,
                enclosId: a.enclosId,
                name: buildName({
                  color: babyColor, sex: babySex, index: nextIndex(babyColor, babySex, false), keeper: false,
                  grandparents: [a.color, b.color].filter(Boolean),
                }),
              })).then(() => { setBabyColor(""); setAId(""); setBId(""); })}>
              ✓ Enregistrer le bébé
            </button>
          </div>
        </div>
      )}

      {/* Clonage */}
      <div className="policy-head" style={{ marginTop: 16 }}><span>♻ Clonage</span><span className="muted">2 stériles de même couleur → 1 féconde (jauges remises à 0)</span></div>
      {clonableColors.length === 0 ? (
        <div className="muted small">
          Aucune paire clonable. Le clonage recycle <b>deux stériles de la même couleur</b> en une
          nouvelle féconde de cette couleur — marque des montures stériles ci-dessous pour débloquer.
        </div>
      ) : (
        <div className="plan-controls">
          <label>Stérile A
            <select value={cloneAId} onChange={(e) => { setCloneAId(Number(e.target.value)); setCloneBId(""); }}>
              <option value="">—</option>
              {steriles.filter((m) => clonableColors.includes(m.color)).map((m) => (
                <option key={m.id} value={m.id}>{labelOf(m)}</option>
              ))}
            </select>
          </label>
          <label>Stérile B (même couleur)
            <select value={cloneBId} onChange={(e) => setCloneBId(Number(e.target.value))} disabled={cloneAId === ""}>
              <option value="">—</option>
              {steriles.filter((m) => m.id !== cloneAId && cloneA && m.color === cloneA.color).map((m) => (
                <option key={m.id} value={m.id}>{labelOf(m)}</option>
              ))}
            </select>
          </label>
          <label>Sexe obtenu
            <select value={cloneSex} onChange={(e) => setCloneSex(e.target.value as Sex)}>
              <option value="F">♀ femelle</option><option value="M">♂ mâle</option>
            </select>
          </label>
          <button disabled={busy || !cloneA || !cloneB}
            onClick={() => cloneA && cloneB && run(api.clone({
              aId: Number(cloneAId), bId: Number(cloneBId), sex: cloneSex, enclosId: cloneA.enclosId,
              name: buildName({ color: cloneA.color, sex: cloneSex, index: nextIndex(cloneA.color, cloneSex, false), keeper: false }),
            })).then(() => { setCloneAId(""); setCloneBId(""); })}>
            ♻ Cloner
          </button>
        </div>
      )}

      {/* Herd list */}
      <div className="policy-head" style={{ marginTop: 16 }}><span>Toutes les montures</span></div>
      {mounts.length === 0 ? (
        <div className="muted small">Aucune monture — ajoute ton stock ci-dessus.</div>
      ) : (
        <table className="herd-table">
          <thead>
            <tr><th>Nom</th><th>Couleur</th><th>Gén</th><th>Sexe</th><th>État</th><th>Keeper</th><th>Enclos</th><th></th></tr>
          </thead>
          <tbody>
            {mounts.map((m) => (
              <tr key={m.id} className={m.status === "sterile" ? "sterile" : ""}>
                <td className="herd-name">
                  <input type="text" value={m.name} onChange={(e) => patch(m.id, { name: e.target.value })} />
                  <button className="mini ghost" title="Nom auto" disabled={!m.color}
                    onClick={() => patch(m.id, { name: suggestName(m) })}>✨</button>
                </td>
                <td>
                  <select value={m.color} onChange={(e) => patch(m.id, { color: e.target.value })}>
                    <option value="">—</option>
                    {RACES.map((r) => (<option key={r} value={r}>{r}</option>))}
                  </select>
                </td>
                <td className="ctr" style={{ color: GEN_COLOR[genOf(m.color)], fontWeight: 700 }}>{m.color ? genOf(m.color) : "—"}</td>
                <td>
                  <select value={m.sex} onChange={(e) => patch(m.id, { sex: e.target.value as Sex })}>
                    <option value="F">♀</option><option value="M">♂</option>
                  </select>
                </td>
                <td>
                  <select value={m.status} onChange={(e) => patch(m.id, { status: e.target.value as ReproStatus })}>
                    {STATUS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                  </select>
                </td>
                <td className="ctr"><input type="checkbox" checked={m.keeper} onChange={(e) => patch(m.id, { keeper: e.target.checked })} /></td>
                <td className="muted">{m.enclosName}</td>
                <td className="ctr"><button className="mini ghost" disabled={busy} onClick={() => run(api.removeDragodinde(m.id))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="plan-note muted">
        Saisis ton stock (couleur + sexe), puis enregistre chaque croisement réel : le bébé est créé
        avec ses parents (donc ses grands-parents pour les probabilités) et les deux parents passent
        stériles. ✨ génère un nom conforme à la convention. Marque <b>keeper</b> l'exemplaire de
        chaque couleur à ne jamais reproduire.
      </p>
    </div>
  );
}
