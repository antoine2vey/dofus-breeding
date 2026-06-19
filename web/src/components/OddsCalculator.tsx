import { useMemo, useState } from 'react'
import { COLORS, GEN_COLOR } from '@dd/core'
import { crossOdds, type Mount } from '@dd/core'

const RACES = COLORS.map((c) => c.name)

function MountEditor({
  title,
  mount,
  level,
  onMount,
  onLevel
}: {
  title: string
  mount: Mount
  level: number
  onMount: (m: Mount) => void
  onLevel: (n: number) => void
}) {
  const gps = mount.grandparents ?? ['', '']
  const setGp = (i: number, v: string) => {
    const next = [gps[0] ?? '', gps[1] ?? '']
    next[i] = v
    onMount({ ...mount, grandparents: next })
  }
  return (
    <div className="mount-editor">
      <div className="mount-title">{title}</div>
      <label>
        Race
        <select value={mount.race} onChange={(e) => onMount({ ...mount, race: e.target.value })}>
          {RACES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label>
        Niveau
        <input
          type="number"
          min={1}
          max={200}
          value={level}
          onChange={(e) =>
            onLevel(Math.min(200, Math.max(1, Math.floor(Number(e.target.value) || 1))))
          }
        />
      </label>
      <label>
        Grand-parent 1 (parent de cette monture)
        <select value={gps[0] ?? ''} onChange={(e) => setGp(0, e.target.value)}>
          <option value="">— aucun (capturée) —</option>
          {RACES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label>
        Grand-parent 2
        <select value={gps[1] ?? ''} onChange={(e) => setGp(1, e.target.value)}>
          <option value="">— aucun (capturée) —</option>
          {RACES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export function OddsCalculator() {
  const [a, setA] = useState<Mount>({
    race: 'Amande et Dorée',
    grandparents: ['Amande et Rousse', 'Amande et Dorée']
  })
  const [b, setB] = useState<Mount>({ race: 'Ebène', grandparents: ['Ebène', 'Indigo'] })
  const [lvlA, setLvlA] = useState(43)
  const [lvlB, setLvlB] = useState(44)
  const [optima, setOptima] = useState(false)

  const result = useMemo(() => crossOdds(a, b, lvlA + lvlB, optima), [a, b, lvlA, lvlB, optima])

  return (
    <div className="pane planner">
      <div className="pane-head">
        <h2>🎲 Calculateur de probabilités</h2>
        <span className="muted">
          génération cible {result.targetGen} · p = {(result.pTarget * 100).toFixed(2)}%
        </span>
      </div>

      <p className="muted small" style={{ margin: '0 0 12px' }}>
        Renseignez la race et les <b>deux parents</b> (= grands-parents du bébé) de chaque monture.
        Les probabilités doivent correspondre à celles affichées en jeu dans l'enclos.
      </p>

      <div className="mount-grid">
        <MountEditor title="Monture A" mount={a} level={lvlA} onMount={setA} onLevel={setLvlA} />
        <MountEditor title="Monture B" mount={b} level={lvlB} onMount={setB} onLevel={setLvlB} />
      </div>

      <label className="chk" style={{ margin: '12px 0' }}>
        <input type="checkbox" checked={optima} onChange={(e) => setOptima(e.target.checked)} />
        Optimakina (+10% génération cible)
      </label>

      <div className="odds-formula muted small">
        p(cible) = 0,30 + 0,0015 × ({lvlA} + {lvlB}) {optima ? '+ 0,10 (optima) ' : ''}={' '}
        <b>{(result.pTarget * 100).toFixed(2)}%</b>
      </div>

      <table className="gen-table odds-table">
        <thead>
          <tr>
            <th>%</th>
            <th>Couleur obtenue</th>
            <th>Gén.</th>
          </tr>
        </thead>
        <tbody>
          {result.outcomes
            .filter((o) => o.prob > 0.0005)
            .map((o) => (
              <tr key={o.race} className={o.isTarget ? 'target-row' : ''}>
                <td className="cnt" style={{ color: GEN_COLOR[o.gen] }}>
                  {(o.prob * 100).toFixed(2)}%
                </td>
                <td className="nm">
                  {o.race}
                  {o.isTarget && <span className="clone-tag">cible</span>}
                </td>
                <td className="rcp muted">gen {o.gen}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <p className="plan-note muted">
        Moteur validé : reproduit à &lt; 0,01 % l'exemple de recherche communautaire <i>et</i> des
        probabilités réelles en jeu. Le résultat d'un croisement est une <b>distribution</b>{' '}
        pondérée par la <b>généalogie</b> (chaque monture = elle-même ×5 + ses 2 parents ×3 ;
        monocolore = 9, Dorée = 2, bicolore = 2). La génération la plus haute atteignable est la «
        cible » et reçoit p ; le reste se partage (1−p) au prorata des poids.
      </p>
    </div>
  )
}
