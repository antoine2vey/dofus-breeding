import type { NameParts } from '@dd/core'
import { GEN_COLOR, genOf, parseName } from '@dd/core'
import { useState } from 'react'
import { api } from '../api'
import type { Enclos, ImportRow, ReproStatus } from '../types'
import { useMutation } from '../useMutation'

const STATUS: { value: ReproStatus; label: string }[] = [
  { value: 'feconde', label: 'Féconde' },
  { value: 'fertile', label: 'Fertile' },
  { value: 'sterile', label: 'Stérile' }
]

/** Paste in-game names → decode (colour/sex/keeper/grandparents) → preview → import to a
 *  destination. Self-contained: owns its own paste/preview state and mutation. Reused by the
 *  Stock tab and the onboarding wizard. `initialText` pre-fills the paste box (e.g. from the
 *  roster builder). `onImported` fires after a successful import (refresh / advance the wizard). */
export function ImportByName({
  enclos,
  onImported,
  initialText
}: {
  enclos: Enclos[]
  onImported: () => void
  initialText?: string
}) {
  const [importText, setImportText] = useState(initialText ?? '')
  const [parsed, setParsed] = useState<
    { line: string; parts: NameParts | null; status: ReproStatus }[]
  >([])
  const [importMsg, setImportMsg] = useState('')
  const [importEnclos, setImportEnclos] = useState<number | ''>('') // "" = stable

  const { busy, run } = useMutation(onImported)

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
    <>
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
        <div className="herd-table-wrap">
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
        </div>
      )}
    </>
  )
}
