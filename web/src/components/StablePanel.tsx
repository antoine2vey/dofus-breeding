import { genColorOf, genOf, SPECIES } from '@dd/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import type { Dragodinde, ReproStatus } from '../types'

const STATUS_LABEL: Record<ReproStatus, string> = {
  feconde: 'Féconde',
  fertile: 'Fertile',
  sterile: 'Stérile'
}

/** A stable mount, draggable onto an enclos. Cross-species: colour/gen lookups are scoped to
 *  the mount's own species and a species badge prefixes the name. */
function StableChip({ m }: { m: Dragodinde }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `mount-${m.id}` })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={'stable-chip' + (isDragging ? ' dragging' : '') + (m.keeper ? ' keeper' : '')}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      title="Glisse vers un enclos"
    >
      <b className="sc-name" style={{ color: genColorOf(m.species)[genOf(m.species, m.color)] }}>
        <span className="sc-species" title={SPECIES[m.species].label}>
          {SPECIES[m.species].icon}
        </span>{' '}
        {m.name}
      </b>
      <span className="sc-meta muted">
        {m.color || '?'} · {m.sex === 'F' ? '♀' : '♂'} · {STATUS_LABEL[m.status]}
        {m.keeper ? ' · ★' : ''}
      </span>
    </div>
  )
}

export function StablePanel({ stable }: { stable: Dragodinde[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'stable' })
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const filtered = needle
    ? stable.filter(
        (m) =>
          m.name.toLowerCase().includes(needle) ||
          m.color.toLowerCase().includes(needle) ||
          STATUS_LABEL[m.status].toLowerCase().includes(needle)
      )
    : stable
  const feconde = stable.filter((m) => m.status === 'feconde').length
  return (
    <section ref={setNodeRef} className={'pane stable-pane' + (isOver ? ' drop-over' : '')}>
      <div className="pane-head">
        <h2>🏠 Étable</h2>
        <span className="muted">
          {stable.length} · {feconde} fécondes
        </span>
      </div>
      <input
        className="stable-search"
        placeholder="filtrer (nom, couleur, état)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="stable-chips">
        {filtered.length === 0 ? (
          <div className="empty">
            {stable.length === 0 ? 'Étable vide.' : 'Aucune correspondance.'}
          </div>
        ) : (
          filtered.map((m) => <StableChip key={m.id} m={m} />)
        )}
      </div>
      {isOver && <div className="stable-drophint">Relâcher pour renvoyer à l'étable</div>}
    </section>
  )
}
