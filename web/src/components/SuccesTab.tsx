import { colorsOf, genColorOf, type Species } from '@dd/core'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useMutation } from '../useMutation'

/** Succès — mark the colours whose in-game achievement you've already unlocked. They satisfy the
 *  goal (so the planner stops counting them) but never breeding supply, so a done colour that's a
 *  parent of your target is still produced. Scoped to a single species. */
export function SuccesTab({
  species,
  achievements,
  onChanged
}: {
  species: Species
  achievements: string[]
  onChanged: () => void
}) {
  const [done, setDone] = useState<Set<string>>(() => new Set(achievements))
  const { busy, run } = useMutation(onChanged)

  const colors = useMemo(() => colorsOf(species), [species])
  const genColor = useMemo(() => genColorOf(species), [species])

  // Keep in sync with the server (the 3s poll) — but never while a save is in flight, so an
  // optimistic edit isn't clobbered by a stale poll mid-save. Resetting on `species` change too
  // (the parent already swaps in the new species' achievements).
  const sig = achievements.join(',')
  useEffect(() => {
    if (!busy) setDone(new Set(achievements))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, busy, species])

  const byGen = useMemo(() => {
    const m = new Map<number, { name: string }[]>()
    for (const c of colors) (m.get(c.gen) ?? m.set(c.gen, []).get(c.gen)!).push({ name: c.name })
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [colors])

  const save = (next: Set<string>) => {
    setDone(next) // optimistic
    run(api.setAchievements(species, [...next])) // the seam adds the re-entrancy latch this copy was missing
  }
  const toggle = (color: string) => {
    const next = new Set(done)
    next.has(color) ? next.delete(color) : next.add(color)
    save(next)
  }
  const setGen = (cols: string[], on: boolean) => {
    const next = new Set(done)
    cols.forEach((c) => (on ? next.add(c) : next.delete(c)))
    save(next)
  }

  return (
    <div className="pane planner">
      <div className="pane-head">
        <h2>🏆 Succès</h2>
        <span className="muted">
          {done.size}/{colors.length} couleurs validées
        </span>
      </div>
      <p className="plan-note muted" style={{ marginTop: 0 }}>
        Coche les couleurs dont tu as <b>déjà débloqué le succès</b> en jeu. Le planificateur ne les
        recomptera plus dans l'objectif — <b>sauf</b> si elles servent de parent pour atteindre une
        génération supérieure (là, il te dira quand même de les reproduire).
      </p>

      {byGen.map(([gen, cols]) => {
        const all = cols.every((c) => done.has(c.name))
        return (
          <div className="succ-gen" key={gen}>
            <div className="succ-head">
              <span style={{ color: genColor[gen], fontWeight: 700 }}>Gen {gen}</span>
              <span className="muted small">
                {cols.filter((c) => done.has(c.name)).length}/{cols.length}
              </span>
              <button
                className="mini ghost"
                disabled={busy}
                onClick={() =>
                  setGen(
                    cols.map((c) => c.name),
                    !all
                  )
                }
              >
                {all ? 'tout décocher' : 'tout cocher'}
              </button>
            </div>
            <div className="succ-grid">
              {cols.map((c) => (
                <label key={c.name} className={'succ-cell' + (done.has(c.name) ? ' on' : '')}>
                  <input
                    type="checkbox"
                    checked={done.has(c.name)}
                    disabled={busy}
                    onChange={() => toggle(c.name)}
                  />
                  <span style={{ color: done.has(c.name) ? genColor[gen] : undefined }}>
                    {c.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
