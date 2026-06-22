import { genColorOf, genOf, SPECIES } from '@dd/core'
import type { DragoPatch, Enclos, Meta, Mount, StatKey } from '../types'
import { focusedStats, isDone, moodFace } from '../util'

// Short labels live here; colors are derived from meta.fuelBars (single source of truth).
const STATS: { key: StatKey; label: string }[] = [
  { key: 'endurance', label: 'End' },
  { key: 'maturite', label: 'Mat' },
  { key: 'amour', label: 'Love' },
  { key: 'serenity', label: 'Ser' }
]

function StatMini({
  drago,
  stat,
  meta,
  focused,
  onStat
}: {
  drago: Mount
  stat: { key: StatKey; label: string }
  meta: Meta
  focused: boolean
  onStat: (key: StatKey, n: number) => void
}) {
  const value = drago.stats[stat.key]
  const isSer = stat.key === 'serenity'
  const lo = isSer ? meta.serenityMin : 0
  const hi = isSer ? meta.serenityMax : meta.statMax
  const frac = Math.max(0, Math.min(1, (value - lo) / (hi - lo)))
  const maxed = !isSer && value >= meta.statMax
  const color = meta.fuelBars.find((b) => b.target === stat.key)?.color ?? '#888'
  const edit = () => {
    const next = window.prompt(`${stat.label} (${lo}–${hi})`, String(value))
    if (next != null) onStat(stat.key, Math.max(lo, Math.min(hi, Number(next) || 0)))
  }
  return (
    <div className={'stat-mini' + (focused ? ' focused' : '')}>
      <span className="sm-label" style={{ color }} onClick={edit}>
        {stat.label}
      </span>
      <div className="hmeter stat" onClick={edit} title="Click to set">
        <div
          className={'hfill' + (maxed ? ' maxed' : '')}
          style={{ width: `${frac * 100}%`, background: color }}
        />
      </div>
      <span className={'sm-val' + (maxed ? ' maxed' : '')} onClick={edit}>
        {isSer ? `${moodFace(value)} ${value}` : `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k`}
      </span>
      <span className="quick">
        {isSer ? (
          <>
            <button
              className="q"
              title="Serenity −1"
              onClick={() => onStat('serenity', Math.max(lo, value - 1))}
            >
              −1
            </button>
            <button
              className="q"
              title="Serenity +1"
              onClick={() => onStat('serenity', Math.min(hi, value + 1))}
            >
              +1
            </button>
          </>
        ) : (
          <>
            <button className="q" title="Set to 0" onClick={() => onStat(stat.key, 0)}>
              0
            </button>
            <button
              className="q"
              title={`Set to ${meta.statMax / 1000}k`}
              onClick={() => onStat(stat.key, meta.statMax)}
            >
              {meta.statMax / 1000}k
            </button>
          </>
        )}
      </span>
    </div>
  )
}

function DragoRow({
  drago,
  focus,
  meta,
  onPatch,
  onMove,
  onDelete
}: {
  drago: Mount
  focus: Enclos['focus']
  meta: Meta
  onPatch: (id: number, body: DragoPatch) => void
  onMove: (id: number) => void
  onDelete: (id: number) => void
}) {
  const done = isDone(focus, drago.stats, meta)
  const focusedSet = focusedStats(focus, meta)
  const onStat = (key: StatKey, n: number) => onPatch(drago.id, { stats: { [key]: n } })
  const reset = () => {
    if (window.confirm(`Reset ${drago.name} to 0?`))
      onPatch(drago.id, { stats: { endurance: 0, maturite: 0, amour: 0, serenity: 0 } })
  }
  return (
    <div className={'drago-row' + (done ? ' done' : '')}>
      <div className="dr-head">
        <span className="dr-species" title={SPECIES[drago.species].label}>
          {SPECIES[drago.species].icon}
        </span>
        <input
          className="dr-name"
          defaultValue={drago.name}
          key={drago.name}
          style={{ color: genColorOf(drago.species)[genOf(drago.species, drago.color)] }}
          onBlur={(e) => {
            if (e.target.value !== drago.name) onPatch(drago.id, { name: e.target.value })
          }}
        />
        {done && <span className="done-badge">✓</span>}
        <button className="ghost mini" title="Reset stats" onClick={reset}>
          ↺
        </button>
        <button className="ghost mini" title="Renvoyer à l'étable" onClick={() => onMove(drago.id)}>
          → étable
        </button>
        <button
          className="ghost mini"
          title="Delete"
          onClick={() => {
            if (window.confirm(`Delete ${drago.name}?`)) onDelete(drago.id)
          }}
        >
          ✕
        </button>
      </div>
      <div className="dr-stats">
        {STATS.map((s) => (
          <StatMini
            key={s.key}
            drago={drago}
            stat={s}
            meta={meta}
            focused={focusedSet.has(s.key)}
            onStat={onStat}
          />
        ))}
      </div>
    </div>
  )
}

export function MountPane({
  enclos,
  meta,
  onDragoPatch,
  onDragoMove,
  onDragoDelete
}: {
  enclos: Enclos | undefined
  meta: Meta
  onDragoPatch: (id: number, body: DragoPatch) => void
  onDragoMove: (id: number, enclosId: number | null) => void
  onDragoDelete: (id: number) => void
}) {
  if (!enclos)
    return (
      <section className="pane">
        <div className="empty">Sélectionne un enclos.</div>
      </section>
    )
  return (
    <section className="pane">
      <div className="pane-head">
        <h2>
          {enclos.name} · Montures{' '}
          <span className="muted">
            ({enclos.mounts.length}/{meta.maxMounts})
          </span>
        </h2>
      </div>
      <div className="drago-list">
        {enclos.mounts.length === 0 && (
          <div className="empty">
            Vide — glisse une monture de l'étable ici pour monter ses jauges.
          </div>
        )}
        {enclos.mounts.map((d) => (
          <DragoRow
            key={d.id}
            drago={d}
            focus={enclos.focus}
            meta={meta}
            onPatch={onDragoPatch}
            onMove={(id) => onDragoMove(id, null)}
            onDelete={onDragoDelete}
          />
        ))}
      </div>
    </section>
  )
}
