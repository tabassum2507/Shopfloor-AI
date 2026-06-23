'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard, type WOCard, type KanbanStatus } from './KanbanCard'

// ─── Props ────────────────────────────────────────────────────

type KanbanColumnProps = {
  status: KanbanStatus
  label: string
  borderColor: string
  cards: WOCard[]
  droppedId: string | null
  /** Whether a card is currently hovering over this column. */
  isHovered: boolean
  /** Whether the currently-dragged card can legally drop here. */
  isValidDrop: boolean
  /** Whether any drag is currently active. */
  isDragging: boolean
}

// ─── Column ───────────────────────────────────────────────────

export function KanbanColumn({
  status, label, borderColor,
  cards, droppedId,
  isHovered, isValidDrop, isDragging,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status })

  const showDropHint = isDragging && isValidDrop && isHovered

  return (
    <div className="flex flex-col min-w-[268px] max-w-[300px] flex-1 snap-start">

      {/* ── Column header ── */}
      <div
        className={[
          'flex items-center gap-2 px-3 py-2.5 rounded-t-lg',
          'transition-all duration-150',
          isHovered && isValidDrop ? 'brightness-95' : '',
        ].join(' ')}
        style={{
          borderLeft:      `4px solid ${borderColor}`,
          backgroundColor: borderColor + '12',
        }}
      >
        <h3
          className="text-[11px] font-black uppercase tracking-widest"
          style={{ color: borderColor }}
        >
          {label}
        </h3>
        <span
          className="ml-auto min-w-[20px] text-center px-1.5 py-0.5 rounded-full font-mono text-[11px] font-bold bg-white/70"
          style={{ color: borderColor }}
        >
          {cards.length}
        </span>
      </div>

      {/* ── Droppable card list ── */}
      <div
        ref={setNodeRef}
        className={[
          'flex-1 rounded-b-lg p-2 space-y-2 overflow-y-auto',
          'transition-colors duration-150',
          showDropHint ? 'bg-primary/[0.03]' : '',
          // Dashed outline on empty columns when a valid drag is active
          isDragging && isValidDrop && cards.length === 0
            ? 'border-2 border-dashed border-gray-200'
            : 'border-2 border-transparent',
        ].join(' ')}
        style={{ minHeight: 440 }}
      >
        <SortableContext
          items={cards.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map(card => (
            <KanbanCard
              key={card.id}
              card={card}
              isJustDropped={card.id === droppedId}
            />
          ))}
        </SortableContext>

        {/* Static empty state */}
        {cards.length === 0 && !isDragging && (
          <div className="flex items-center justify-center h-16 rounded-lg border-2 border-dashed border-gray-200 mx-1">
            <p className="text-[12px] text-gray-300">No orders</p>
          </div>
        )}

        {/* Drop hint while dragging */}
        {cards.length === 0 && isDragging && isValidDrop && (
          <div className="flex items-center justify-center h-16 text-[12px] text-primary/50 font-medium">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}
