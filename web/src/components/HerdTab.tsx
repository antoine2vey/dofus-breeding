import type { NameParts } from '@dd/core'
import { COLOR_BY_NAME, COLORS, GEN_COLOR, parseName } from '@dd/core'
import { useMemo, useState } from 'react'
import { api } from '../api'
import type { Dragodinde, Enclos, ImportRow, ReproStatus, Sex } from '../types'
import { useMutation } from '../useMutation'

const RACES = COLORS.map((c) => c.name)
const genOf = (color: string) => COLOR_BY_NAME.get(color)?.gen ?? 0

// In-game reproduction states, ordered most→least useful for breeding.
const STATUS: { value: ReproStatus; label: string }[] = [
  { value: 'feconde', label: 'Féconde' },
  { value: 'fertile', label: 'Fertile' },
  { value: 'sterile', label: 'Stérile' }
]

interface Mount extends Dragodinde {
  enclosName: string // "Étable" or the enclos name (location label)
}

export function HerdTab({
  enclos,
  stable,
  onChanged
}: {
  enclos: Enclos[]
  stable: Dragodinde[]
  onChanged: () => void
}) {
  const mounts: Mount[] = useMemo(() => {
    const inEnclos = enclos.flatMap((e) => e.dragodindes.map((d) => ({ ...d, enclosName: e.name })))
    const inStable = stable.map((d) => ({ ...d, enclosName: 'Étable' }))
    return [...inStable, ...inEnclos]
  }, [enclos, stable])

  // Import (paste in-game names) form
  const [importText, setImportText] = useState('')
  const [parsed, setParsed] = useState<
    { line: string; parts: NameParts | null; status: ReproStatus }[]
  >([])
  const [importMsg, setImportMsg] = useState('')
  const [importEnclos, setImportEnclos] = useState<number | ''>('') // "" = stable

  // Filters + bulk selection (the "Toutes les montures" table)
  const [fText, setFText] = useState('')
  const [fColor, setFColor] = useState('')
  const [fGen, setFGen] = useState<number | ''>('')
  const [fSex, setFSex] = useState<Sex | ''>('')
  const [fStatus, setFStatus] = useState<ReproStatus | ''>('')
  const [fKeeper, setFKeeper] = useState<'' | 'yes' | 'no'>('')
  const [fLieu, setFLieu] = useState<number | 'stable' | ''>('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkMsg, setBulkMsg] = useState('')
  const [bulkDest, setBulkDest] = useState<number | 'stable'>('stable')

  const { busy, run } = useMutation(onChanged)
  const patch = (id: number, body: Partial<Dragodinde>) => run(api.patchDragodinde(id, body))
  const move = (id: number, enclosId: number | null) => run(api.moveDragodinde(id, enclosId))

  // Only FÉCONDE mounts can breed now; FERTILE ones still need their gauges raised.
  const fecondeMounts = mounts.filter((m) => m.status === 'feconde')

  // ── Filtering + selection ──────────────────────────────────────────────
  const needle = fText.trim().toLowerCase()
  const filtered = mounts.filter((m) => {
    if (needle && !m.name.toLowerCase().includes(needle)) return false
    if (fColor && m.color !== fColor) return false
    if (fGen !== '' && genOf(m.color) !== fGen) return false
    if (fSex && m.sex !== fSex) return false
    if (fStatus && m.status !== fStatus) return false
    if (fKeeper === 'yes' && !m.keeper) return false
    if (fKeeper === 'no' && m.keeper) return false
    if (fLieu === 'stable' && m.enclosId !== null) return false
    if (typeof fLieu === 'number' && m.enclosId !== fLieu) return false
    return true
  })
  const clearFilters = () => {
    setFText('')
    setFColor('')
    setFGen('')
    setFSex('')
    setFStatus('')
    setFKeeper('')
    setFLieu('')
  }

  const selectedIds = [...selected]
  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id))
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach((m) => next.delete(m.id))
      else filtered.forEach((m) => next.add(m.id))
      return next
    })
  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // ── Bulk actions ───────────────────────────────────────────────────────
  const bulkMove = (dest: number | null) =>
    run(
      api.bulkMove(selectedIds, dest).then((res) => {
        setBulkMsg(
          `✓ ${res.moved} déplacée(s)` +
            (res.skipped ? ` · ${res.skipped} ignorée(s) (enclos plein)` : '')
        )
        setSelected((prev) => {
          const n = new Set(prev)
          res.movedIds.forEach((id) => n.delete(id))
          return n
        })
      })
    )
  const bulkPatch = (patch: { status?: ReproStatus; keeper?: boolean }, label: string) =>
    run(api.bulkPatch(selectedIds, patch).then((res) => setBulkMsg(`✓ ${res.patched} ${label}`)))
  const bulkDelete = () => {
    if (!window.confirm(`Supprimer ${selected.size} monture(s) ? Action irréversible.`)) return
    run(
      api.bulkDelete(selectedIds).then((res) => {
        setBulkMsg(`✓ ${res.removed} supprimée(s)`)
        setSelected(new Set())
      })
    )
  }

  // Import: decode each pasted line via the naming convention.
  const analyze = () => {
    setImportMsg('')
    setParsed(
      importText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => ({ line, parts: parseName(line), status: 'fertile' as ReproStatus }))
    )
  }
  const validParsed = parsed.filter((p) => p.parts)
  const doImport = () => {
    if (validParsed.length === 0) return
    const rows: ImportRow[] = validParsed.map((p) => ({
      name: p.line,
      color: p.parts!.color,
      sex: p.parts!.sex,
      keeper: p.parts!.keeper,
      status: p.status,
      grandparents: p.parts!.grandparents ? [...p.parts!.grandparents] : []
    }))
    const enclosId = importEnclos === '' ? null : Number(importEnclos)
    run(
      api.importMounts(rows, enclosId).then((res) => {
        if ('error' in res) {
          setImportMsg('✗ ' + res.error)
          return
        }
        const toStable = res.created - res.toEnclos
        const enclosName = enclos.find((e) => e.id === enclosId)?.name
        const placed =
          enclosId === null
            ? `${res.created} importée(s) dans l'étable`
            : `${res.toEnclos} dans « ${enclosName ?? 'enclos'} »` +
              (toStable > 0 ? `, ${toStable} dans l'étable (enclos plein)` : '')
        setImportMsg(`✓ ${placed}` + (res.skipped ? ` · ${res.skipped} ignorée(s) (plein)` : ''))
        setImportText('')
        setParsed([])
      })
    )
  }

  return (
    <div className="pane planner">
      <div className="pane-head">
        <h2>🐴 Cheptel</h2>
        <span className="muted">
          {mounts.length} dragodindes · {fecondeMounts.length} fécondes
        </span>
      </div>

      {/* Import from in-game names */}
      <div className="policy-head">
        <span>📥 Importer depuis le jeu</span>
        <span className="muted">colle les noms de tes montures (1 par ligne)</span>
      </div>
      <div className="muted small" style={{ marginBottom: 6 }}>
        Renomme tes montures avec la convention <code>couleur-[K]-sexe-gp1-gp2</code> (ex.{' '}
        <code>i-f-e-ei</code>), puis colle la liste ici : couleur, sexe, keeper <b>et</b> les deux
        grands-parents sont décodés du nom. Choisis la destination ci-dessous ; l'état (féconde /
        fertile / stérile) se règle par ligne.
      </div>
      <div className="plan-controls">
        <label>
          Destination
          <select
            value={importEnclos}
            onChange={(e) => setImportEnclos(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Étable</option>
            {enclos.map((e) => (
              <option key={e.id} value={e.id} disabled={e.dragodindes.length >= 10}>
                {e.name} ({e.dragodindes.length}/10)
              </option>
            ))}
          </select>
        </label>
        <button className="ghost" disabled={!importText.trim()} onClick={analyze}>
          Analyser
        </button>
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
        placeholder={'i-f-e-ei\nei-K-m-a-d\nt-f'}
        rows={4}
      />
      {importMsg && (
        <div className={importMsg.startsWith('✗') ? 'decode-err' : 'decode-ok'}>{importMsg}</div>
      )}
      {parsed.length > 0 && (
        <table className="herd-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Couleur</th>
              <th>Sexe</th>
              <th>Keeper</th>
              <th>Grands-parents</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            {parsed.map((p, i) => (
              <tr key={i} className={p.parts ? '' : 'sterile'}>
                <td className="herd-name">
                  <code>{p.line}</code>
                </td>
                {p.parts ? (
                  <>
                    <td style={{ color: GEN_COLOR[genOf(p.parts.color)] }}>{p.parts.color}</td>
                    <td className="ctr">{p.parts.sex === 'F' ? '♀' : '♂'}</td>
                    <td className="ctr">{p.parts.keeper ? '★' : ''}</td>
                    <td className="muted small">{p.parts.grandparents?.join(' + ') || '—'}</td>
                    <td>
                      <select
                        value={p.status}
                        onChange={(e) =>
                          setParsed(
                            parsed.map((q, j) =>
                              j === i ? { ...q, status: e.target.value as ReproStatus } : q
                            )
                          )
                        }
                      >
                        {STATUS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </>
                ) : (
                  <td colSpan={5} className="decode-err">
                    nom non reconnu
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Herd list */}
      <div className="policy-head" style={{ marginTop: 16 }}>
        <span>Toutes les montures</span>
        <span className="muted">
          {filtered.length}/{mounts.length}
          {selected.size > 0 ? ` · ${selected.size} sélectionnée(s)` : ''}
        </span>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <input
          type="text"
          placeholder="nom…"
          value={fText}
          onChange={(e) => setFText(e.target.value)}
        />
        <select value={fColor} onChange={(e) => setFColor(e.target.value)}>
          <option value="">couleur : toutes</option>
          {RACES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={fGen}
          onChange={(e) => setFGen(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">gén : toutes</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((g) => (
            <option key={g} value={g}>
              gén {g}
            </option>
          ))}
        </select>
        <select value={fSex} onChange={(e) => setFSex(e.target.value as Sex | '')}>
          <option value="">sexe : tous</option>
          <option value="F">♀</option>
          <option value="M">♂</option>
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value as ReproStatus | '')}>
          <option value="">état : tous</option>
          {STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={fKeeper} onChange={(e) => setFKeeper(e.target.value as '' | 'yes' | 'no')}>
          <option value="">keeper : tous</option>
          <option value="yes">keeper ★</option>
          <option value="no">non‑keeper</option>
        </select>
        <select
          value={fLieu === '' ? '' : String(fLieu)}
          onChange={(e) =>
            setFLieu(
              e.target.value === ''
                ? ''
                : e.target.value === 'stable'
                  ? 'stable'
                  : Number(e.target.value)
            )
          }
        >
          <option value="">lieu : tous</option>
          <option value="stable">🏠 Étable</option>
          {enclos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <button className="mini ghost" onClick={clearFilters}>
          réinitialiser
        </button>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} sélectionnée(s)</span>
          <button className="mini ghost" onClick={() => setSelected(new Set())}>
            effacer
          </button>
          <span className="bulk-sep" />
          <label>
            Déplacer →
            <select
              value={String(bulkDest)}
              onChange={(e) =>
                setBulkDest(e.target.value === 'stable' ? 'stable' : Number(e.target.value))
              }
            >
              <option value="stable">🏠 Étable</option>
              {enclos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.dragodindes.length}/10)
                </option>
              ))}
            </select>
          </label>
          <button
            className="mini"
            disabled={busy}
            onClick={() => bulkMove(bulkDest === 'stable' ? null : bulkDest)}
          >
            OK
          </button>
          <span className="bulk-sep" />
          <span className="muted small">État :</span>
          {STATUS.map((s) => (
            <button
              key={s.value}
              className="mini ghost"
              disabled={busy}
              onClick={() => bulkPatch({ status: s.value }, 'mises à jour')}
            >
              {s.label}
            </button>
          ))}
          <span className="bulk-sep" />
          <button
            className="mini ghost"
            disabled={busy}
            onClick={() => bulkPatch({ keeper: true }, 'keepers')}
          >
            ★ keeper
          </button>
          <button
            className="mini ghost"
            disabled={busy}
            onClick={() => bulkPatch({ keeper: false }, 'non‑keepers')}
          >
            ☆ non
          </button>
          <span className="bulk-sep" />
          <button className="mini ghost danger" disabled={busy} onClick={bulkDelete}>
            ✕ supprimer
          </button>
        </div>
      )}
      {bulkMsg && <div className="decode-ok small">{bulkMsg}</div>}

      {mounts.length === 0 ? (
        <div className="muted small">Aucune monture — ajoute ton stock ci-dessus.</div>
      ) : filtered.length === 0 ? (
        <div className="muted small">Aucune monture ne correspond aux filtres.</div>
      ) : (
        <table className="herd-table">
          <thead>
            <tr>
              <th className="ctr">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  title="Tout sélectionner (filtré)"
                />
              </th>
              <th>Nom</th>
              <th>Couleur</th>
              <th>Gén</th>
              <th>Sexe</th>
              <th>État</th>
              <th>Keeper</th>
              <th>Lieu</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={m.id}
                className={
                  (m.status === 'sterile' ? 'sterile' : '') +
                  (selected.has(m.id) ? ' row-selected' : '')
                }
              >
                <td className="ctr">
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggleOne(m.id)}
                  />
                </td>
                <td className="herd-name">
                  <input
                    type="text"
                    value={m.name}
                    onChange={(e) => patch(m.id, { name: e.target.value })}
                  />
                </td>
                <td>
                  <select value={m.color} onChange={(e) => patch(m.id, { color: e.target.value })}>
                    <option value="">—</option>
                    {RACES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="ctr" style={{ color: GEN_COLOR[genOf(m.color)], fontWeight: 700 }}>
                  {m.color ? genOf(m.color) : '—'}
                </td>
                <td>
                  <select
                    value={m.sex}
                    onChange={(e) => patch(m.id, { sex: e.target.value as Sex })}
                  >
                    <option value="F">♀</option>
                    <option value="M">♂</option>
                  </select>
                </td>
                <td>
                  <select
                    value={m.status}
                    onChange={(e) => patch(m.id, { status: e.target.value as ReproStatus })}
                  >
                    {STATUS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="ctr">
                  <input
                    type="checkbox"
                    checked={m.keeper}
                    onChange={(e) => patch(m.id, { keeper: e.target.checked })}
                  />
                </td>
                <td>
                  <select
                    value={m.enclosId ?? ''}
                    onChange={(e) =>
                      move(m.id, e.target.value === '' ? null : Number(e.target.value))
                    }
                  >
                    <option value="">🏠 Étable</option>
                    {enclos.map((e) => (
                      <option
                        key={e.id}
                        value={e.id}
                        disabled={m.enclosId !== e.id && e.dragodindes.length >= 10}
                      >
                        {e.name}
                        {e.dragodindes.length >= 10 ? ' (plein)' : ''}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="ctr">
                  <button
                    className="mini ghost"
                    disabled={busy}
                    onClick={() => run(api.removeDragodinde(m.id))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="plan-note muted">
        L'<b>étable</b> stocke toute ta collection. Importe tes montures par leur nom, puis
        envoie-les dans un <b>enclos</b> (colonne Lieu, ou onglet Enclos en glisser-déposer) pour
        monter leurs jauges jusqu'à <b>féconde</b>. Marque <b>keeper</b> l'exemplaire à ne jamais
        reproduire.
      </p>
    </div>
  )
}
