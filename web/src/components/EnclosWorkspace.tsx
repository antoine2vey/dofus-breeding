import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import type { Dragodinde, DragoPatch, Enclos, EnclosPatch, Meta } from '../types'
import { DragodindePane } from './DragodindePane'
import { EnclosPane } from './EnclosPane'
import { StablePanel } from './StablePanel'

const mountIdOf = (raw: string | number) => Number(String(raw).replace('mount-', ''))

export function EnclosWorkspace({
  enclos,
  stable,
  activeId,
  meta,
  onSelect,
  onEnclosPatch,
  onEnclosAdd,
  onEnclosDelete,
  onDragoPatch,
  onDragoMove,
  onDragoDelete
}: {
  enclos: Enclos[]
  stable: Dragodinde[]
  activeId: number | null
  meta: Meta
  onSelect: (id: number) => void
  onEnclosPatch: (id: number, body: EnclosPatch) => void
  onEnclosAdd: () => void
  onEnclosDelete: (id: number) => void
  onDragoPatch: (id: number, body: DragoPatch) => void
  onDragoMove: (id: number, enclosId: number | null) => void
  onDragoDelete: (id: number) => void
}) {
  const active = enclos.find((e) => e.id === activeId) ?? enclos[0]
  const [dragId, setDragId] = useState<number | null>(null)
  // Drag only kicks in after a small move so clicks still work.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const byId = useMemo(
    () => new Map([...stable, ...enclos.flatMap((e) => e.dragodindes)].map((m) => [m.id, m])),
    [stable, enclos]
  )

  const onDragStart = (ev: DragStartEvent) => setDragId(mountIdOf(ev.active.id))
  const onDragEnd = (ev: DragEndEvent) => {
    setDragId(null)
    const overId = ev.over?.id
    if (overId == null) return
    const mountId = mountIdOf(ev.active.id)
    const over = String(overId)
    if (over.startsWith('enclos-')) onDragoMove(mountId, Number(over.replace('enclos-', '')))
    else if (over === 'stable') onDragoMove(mountId, null)
  }

  const dragged = dragId != null ? byId.get(dragId) : undefined

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragId(null)}
    >
      <div className="enclos-workspace">
        <EnclosPane
          enclos={enclos}
          activeId={active?.id ?? null}
          meta={meta}
          onSelect={onSelect}
          onEnclosPatch={onEnclosPatch}
          onEnclosAdd={onEnclosAdd}
          onEnclosDelete={onEnclosDelete}
        />
        <DragodindePane
          enclos={active}
          meta={meta}
          onDragoPatch={onDragoPatch}
          onDragoMove={onDragoMove}
          onDragoDelete={onDragoDelete}
        />
        <StablePanel stable={stable} />
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged ? (
          <div className="stable-chip dragging-overlay">
            <b>{dragged.name}</b>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
