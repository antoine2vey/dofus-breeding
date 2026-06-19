import { buildName, COLOR_CODES, GEN_COLOR, genOf, type Sex } from '@dd/core'
import { useEffect, useMemo, useState } from 'react'

interface Row {
  color: string
  sex: Sex
  keeper: boolean
  gp: [string, string] // 0..2 grandparent colour names ('' = none)
  qty: number
  showGp: boolean
}

const newRow = (): Row => ({
  color: 'Amande',
  sex: 'F',
  keeper: false,
  gp: ['', ''],
  qty: 1,
  showGp: false
})

/** Colour <select> options grouped by generation (name — code), shared by the colour and the
 *  grandparent pickers. */
function ColorOptions({ withNone }: { withNone?: boolean }) {
  const byGen = useMemo(() => {
    const m = new Map<number, typeof COLOR_CODES>()
    for (const c of COLOR_CODES) (m.get(c.gen) ?? m.set(c.gen, []).get(c.gen)!).push(c)
    return m
  }, [])
  return (
    <>
      {withNone && <option value="">— aucun —</option>}
      {[...byGen.keys()]
        .sort((a, b) => a - b)
        .map((g) => (
          <optgroup key={g} label={`Génération ${g}`}>
            {(byGen.get(g) ?? []).map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} — {c.code}
              </option>
            ))}
          </optgroup>
        ))}
    </>
  )
}

/** Build a roster as rows of colour · sex · keeper · (optional) grandparents · quantity, and emit
 *  the expanded block of in-game names (one line per mount, quantity-expanded; mounts sharing
 *  colour/sex/grandparents intentionally share a name). Reused in the Nommage tab and the
 *  onboarding wizard; `onNamesChange` exposes the generated block to the caller. */
export function RosterBuilder({ onNamesChange }: { onNamesChange?: (names: string) => void }) {
  const [rows, setRows] = useState<Row[]>([newRow()])
  const [copied, setCopied] = useState(false)

  const patch = (i: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const addRow = () => setRows((rs) => [...rs, newRow()])
  const removeRow = (i: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))

  const names = useMemo(
    () =>
      rows
        .flatMap((r) =>
          Array.from({ length: Math.max(1, r.qty) }, () =>
            buildName({
              color: r.color,
              sex: r.sex,
              keeper: r.keeper,
              grandparents: r.gp.filter(Boolean)
            })
          )
        )
        .join('\n'),
    [rows]
  )
  const count = names ? names.split('\n').length : 0

  useEffect(() => onNamesChange?.(names), [names, onNamesChange])

  const copy = () => {
    navigator.clipboard?.writeText(names).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  return (
    <div className="roster-builder">
      <div className="roster-rows">
        {rows.map((r, i) => (
          <div className="roster-row" key={i}>
            <select
              className="roster-color"
              style={{ color: GEN_COLOR[genOf(r.color)] }}
              value={r.color}
              onChange={(e) => patch(i, { color: e.target.value })}
            >
              <ColorOptions />
            </select>
            <select value={r.sex} onChange={(e) => patch(i, { sex: e.target.value as Sex })}>
              <option value="F">♀</option>
              <option value="M">♂</option>
            </select>
            <label className="chk" title="keeper (exemplaire à garder)">
              <input
                type="checkbox"
                checked={r.keeper}
                onChange={(e) => patch(i, { keeper: e.target.checked })}
              />
              K
            </label>
            <button
              type="button"
              className="mini ghost"
              title="grands-parents"
              onClick={() => patch(i, { showGp: !r.showGp })}
            >
              {r.showGp ? 'GP ▾' : '+ GP'}
            </button>
            {r.showGp && (
              <>
                <select
                  value={r.gp[0]}
                  onChange={(e) => patch(i, { gp: [e.target.value, r.gp[1]] })}
                >
                  <ColorOptions withNone />
                </select>
                <select
                  value={r.gp[1]}
                  onChange={(e) => patch(i, { gp: [r.gp[0], e.target.value] })}
                >
                  <ColorOptions withNone />
                </select>
              </>
            )}
            <input
              type="number"
              className="roster-qty"
              min={1}
              max={99}
              value={r.qty}
              title="quantité"
              onChange={(e) =>
                patch(i, {
                  qty: Math.max(1, Math.min(99, Math.floor(Number(e.target.value) || 1)))
                })
              }
            />
            <button
              type="button"
              className="mini ghost"
              title="retirer la ligne"
              onClick={() => removeRow(i)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="ghost" onClick={addRow}>
        + ligne
      </button>

      <div className="roster-output">
        <div className="policy-head">
          <span>Noms générés</span>
          <span className="muted">
            {count} nom(s) · à coller en jeu, puis à importer
            <button type="button" className="mini" style={{ marginLeft: 8 }} onClick={copy}>
              {copied ? 'copié ✓' : 'copier'}
            </button>
          </span>
        </div>
        <textarea className="import-area" readOnly value={names} rows={Math.min(8, count || 1)} />
      </div>
    </div>
  )
}
