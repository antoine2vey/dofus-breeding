import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Bar, Enclos, EnclosPatch, FocusKey, FuelKey, Meta } from '../types'
import {
  FUEL_MAX,
  barEtaToMaxSec,
  barNeeded,
  clamp,
  enclosDoneCount,
  etaNextStepSec,
  fmtEta,
  focusLabels,
  nextStepLabel,
  rateFor
} from '../util'

const TICKS = [40000, 70000, 90000]

/** Focus-safe number input (keeps typing across polls). */
function NumInput({
  value,
  max,
  onCommit
}: {
  value: number
  max: number
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState(String(value))
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (document.activeElement !== ref.current) setText(String(value))
  }, [value])
  const commit = () => {
    const n = clamp(Math.round(Number(text) || 0), 0, max)
    setText(String(n))
    if (n !== value) onCommit(n)
  }
  return (
    <input
      ref={ref}
      className="num"
      type="number"
      min={0}
      max={max}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

function FuelMeter({
  value,
  color,
  active,
  onSet
}: {
  value: number
  color: string
  active: boolean
  onSet: (n: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const dragging = useRef(false)
  const valueAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    return Math.round((clamp((clientX - r.left) / r.width, 0, 1) * FUEL_MAX) / 100) * 100
  }
  const shown = preview ?? value
  return (
    <div
      ref={ref}
      className={'hmeter fuel' + (active ? '' : ' inactive')}
      title="Click / drag to set"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        dragging.current = true
        setPreview(valueAt(e.clientX))
      }}
      onPointerMove={(e) => {
        if (dragging.current) setPreview(valueAt(e.clientX))
      }}
      onPointerUp={(e) => {
        if (!dragging.current) return
        dragging.current = false
        const n = valueAt(e.clientX)
        setPreview(null)
        if (n !== value) onSet(n)
      }}
    >
      {TICKS.map((t) => (
        <div
          key={t}
          className="htick"
          style={{ left: `${(t / FUEL_MAX) * 100}%` }}
          title={`Set to ${t.toLocaleString('en-US')}`}
          onPointerDown={(e) => {
            e.stopPropagation()
            if (t !== value) onSet(t)
          }}
        />
      ))}
      <div className="hfill" style={{ width: `${(shown / FUEL_MAX) * 100}%`, background: color }} />
    </div>
  )
}

function FuelRow({
  bar,
  enclos,
  meta,
  onFuel,
  onToggleFocus
}: {
  bar: Bar
  enclos: Enclos
  meta: Meta
  onFuel: (key: FuelKey, n: number) => void
  onToggleFocus: (key: FocusKey, on: boolean) => void
}) {
  const checked = enclos.focus.includes(bar.key)
  const ticking = checked && barNeeded(bar, enclos, meta)
  const frozen = checked && !ticking
  const value = enclos.fuel[bar.key]
  const rate = rateFor(value)
  const etaMax = ticking ? barEtaToMaxSec(bar, enclos, meta, meta.tickMs) : null
  const etaStep = ticking ? etaNextStepSec(value, meta.tickMs) : null
  return (
    <div className="fuel-cell">
      <div className="fuel-row">
        <label
          className="chk"
          title={frozen ? 'Frozen — all dragodindes maxed' : 'Check to activate'}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onToggleFocus(bar.key, e.target.checked)}
          />
        </label>
        <span className="fuel-label" style={{ color: bar.color }}>
          {bar.label}
        </span>
        <FuelMeter
          value={value}
          color={bar.color}
          active={ticking}
          onSet={(n) => onFuel(bar.key, n)}
        />
        <NumInput value={value} max={FUEL_MAX} onCommit={(n) => onFuel(bar.key, n)} />
        <span className="fuel-rate">
          {frozen ? '✓max' : ticking && rate > 0 ? (bar.sign < 0 ? '-' : '+') + rate : ''}
        </span>
      </div>
      {ticking && (
        <div className="fuel-eta">
          <span title="Time until the bar passes the next step down">
            ↓ {nextStepLabel(value)} in {fmtEta(etaStep)}
          </span>
          {etaMax != null && (
            <span title="Time until every dragodinde maxes this stat (bar freezes)">
              {' · '}⚑ max in {fmtEta(etaMax)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** One enclos in the list — also a drop target for mounts dragged from the stable. */
function EnclosRow({
  e,
  active,
  meta,
  onSelect
}: {
  e: Enclos
  active: boolean
  meta: Meta
  onSelect: (id: number) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `enclos-${e.id}` })
  const done = enclosDoneCount(e, meta)
  const full = e.dragodindes.length >= meta.maxDragodindes
  return (
    <button
      ref={setNodeRef}
      className={'enclos-row' + (active ? ' active' : '') + (isOver ? ' drop-over' : '')}
      onClick={() => onSelect(e.id)}
    >
      <span className="er-name">{e.name}</span>
      <span className="er-meta">
        <span className={full ? 'er-full' : ''}>
          {e.dragodindes.length}/{meta.maxDragodindes}🐉
        </span>
        {done > 0 && <span className="er-done"> · {done}✓</span>}
      </span>
      <span className="er-focus">{focusLabels(e.focus, meta).join(' + ') || '—'}</span>
    </button>
  )
}

export function EnclosPane({
  enclos,
  activeId,
  meta,
  onSelect,
  onEnclosPatch,
  onEnclosAdd,
  onEnclosDelete
}: {
  enclos: Enclos[]
  activeId: number | null
  meta: Meta
  onSelect: (id: number) => void
  onEnclosPatch: (id: number, body: EnclosPatch) => void
  onEnclosAdd: () => void
  onEnclosDelete: (id: number) => void
}) {
  const active = enclos.find((e) => e.id === activeId)

  const onFuel = (id: number, key: FuelKey, n: number) => onEnclosPatch(id, { fuel: { [key]: n } })
  const onToggleFocus = (e: Enclos, key: FocusKey, on: boolean) => {
    let next = e.focus.filter((f) => f !== key)
    if (on) next = [...next, key].slice(-meta.maxFocus)
    onEnclosPatch(e.id, { focus: next })
  }

  return (
    <section className="pane">
      <div className="pane-head">
        <h2>Enclosures</h2>
        {enclos.length < meta.maxEnclos && (
          <button className="mini" onClick={onEnclosAdd}>
            + enclosure
          </button>
        )}
      </div>

      <div className="enclos-list">
        {enclos.map((e) => (
          <EnclosRow key={e.id} e={e} active={e.id === activeId} meta={meta} onSelect={onSelect} />
        ))}
      </div>

      {active && (
        <div className="carburant">
          <div className="carb-head">
            <input
              className="carb-name"
              defaultValue={active.name}
              key={active.name}
              onBlur={(ev) => {
                if (ev.target.value !== active.name)
                  onEnclosPatch(active.id, { name: ev.target.value })
              }}
            />
            {enclos.length > 1 && (
              <button
                className="ghost mini"
                title="Delete enclosure"
                onClick={() => {
                  if (window.confirm(`Delete ${active.name} and its dragodindes?`))
                    onEnclosDelete(active.id)
                }}
              >
                ✕
              </button>
            )}
          </div>
          <div className="carb-hint">Shared fuel — check up to {meta.maxFocus} bars</div>
          {meta.fuelBars.map((bar) => (
            <FuelRow
              key={bar.key}
              bar={bar}
              enclos={active}
              meta={meta}
              onFuel={(key, n) => onFuel(active.id, key, n)}
              onToggleFocus={(key, on) => onToggleFocus(active, key, on)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
