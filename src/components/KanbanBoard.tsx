'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCardOverlay, type WOCard, type KanbanStatus } from './KanbanCard'
import { toast } from '@/components/ui/toast'
import { RefreshCcw } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────

const COLUMN_ORDER: KanbanStatus[] = ['queued', 'in_progress', 'qc', 'done']

const COLUMN_CONFIG: Record<KanbanStatus, { label: string; borderColor: string }> = {
  queued:      { label: 'Queued',      borderColor: '#F59E0B' },
  in_progress: { label: 'In Progress', borderColor: '#3B82F6' },
  qc:          { label: 'QC Review',   borderColor: '#8B5CF6' },
  done:        { label: 'Done',        borderColor: '#10B981' },
}

const PRIORITY_ORDER: Record<WOCard['priority'], number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
}

type ColumnsState = Record<KanbanStatus, WOCard[]>

const EMPTY_COLUMNS: ColumnsState = { queued: [], in_progress: [], qc: [], done: [] }

function sortByPriority(cards: WOCard[]): WOCard[] {
  return [...cards].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

// ─── Skeleton ─────────────────────────────────────────────────

function KanbanSkeleton() {
  const SKELS = [
    { label: 'Queued',      color: '#F59E0B' },
    { label: 'In Progress', color: '#3B82F6' },
    { label: 'QC Review',   color: '#8B5CF6' },
    { label: 'Done',        color: '#10B981' },
  ]
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {SKELS.map(col => (
        <div key={col.label} className="flex flex-col min-w-[268px] max-w-[300px] flex-1">
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-t-lg"
            style={{ borderLeft: `4px solid ${col.color}`, backgroundColor: col.color + '12' }}
          >
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: col.color }}>
              {col.label}
            </span>
          </div>
          <div className="flex-1 rounded-b-lg p-2 space-y-2 border-2 border-transparent" style={{ minHeight: 440 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-100 p-3 space-y-2 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-2.5 bg-gray-100 rounded" style={{ width: 64 }} />
                  <div className="h-4 bg-gray-100 rounded" style={{ width: 48 }} />
                </div>
                <div className="h-3 bg-gray-100 rounded" style={{ width: 120 }} />
                <div className="h-2.5 bg-gray-100 rounded" style={{ width: 80 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Board ────────────────────────────────────────────────────

export function KanbanBoard() {
  const [columns,    setColumns]    = useState<ColumnsState>(EMPTY_COLUMNS)
  const [loading,    setLoading]    = useState(true)
  const [activeCard, setActiveCard] = useState<WOCard | null>(null)
  const [droppedId,  setDroppedId]  = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<KanbanStatus | null>(null)

  // ── Refs that event handlers read synchronously ────────────
  //
  // React state updates are async. The refs below always hold the
  // *latest committed* value so onDragOver / onDragEnd never see
  // stale data even when they fire before the next render.

  // workingRef mirrors columns state but updated synchronously.
  const workingRef       = useRef<ColumnsState>(EMPTY_COLUMNS)
  // snapshotRef holds the pre-drag state for reverts on failure.
  const snapshotRef      = useRef<ColumnsState>(EMPTY_COLUMNS)
  // srcColumnRef holds which column the drag started from.
  const srcColumnRef     = useRef<KanbanStatus | null>(null)
  // curColumnRef tracks which column the active card is currently in
  // (updated on each valid onDragOver move, avoids searching state).
  const curColumnRef     = useRef<KanbanStatus | null>(null)

  // ── Helpers ───────────────────────────────────────────────

  /** Find which column a card or column-id belongs to. */
  function findContainer(id: string): KanbanStatus | null {
    // Is it a column ID directly?
    if (COLUMN_ORDER.includes(id as KanbanStatus)) return id as KanbanStatus
    // Search cards in working state
    for (const [col, cards] of Object.entries(workingRef.current) as [KanbanStatus, WOCard[]][]) {
      if (cards.some(c => c.id === id)) return col
    }
    return null
  }

  /** Update both state and the working ref atomically. */
  function applyColumns(cols: ColumnsState) {
    workingRef.current = cols
    setColumns(cols)
  }

  // ── Load data ─────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [res, riskRes] = await Promise.all([
        fetch('/api/work-orders'),
        fetch('/api/dashboard/at-risk'),
      ])
      const rows    = (await res.json())     as Array<Record<string, unknown>>
      const riskArr = (await riskRes.json()) as Array<{ id: string }>
      const atRiskIds = new Set(Array.isArray(riskArr) ? riskArr.map(r => r.id) : [])

      const cols: ColumnsState = { queued: [], in_progress: [], qc: [], done: [] }
      for (const row of rows) {
        const status = row.status as string
        if (!(status in cols)) continue
        cols[status as KanbanStatus].push({
          id:            row.id            as string,
          order_number:  row.order_number  as string,
          quantity:      row.quantity      as number,
          status:        status            as KanbanStatus,
          priority:      row.priority      as WOCard['priority'],
          scheduled_end: row.scheduled_end as string | null,
          products:      row.products      as WOCard['products'],
          atRisk:        atRiskIds.has(row.id as string),
        })
      }

      for (const col of COLUMN_ORDER) {
        cols[col] = sortByPriority(cols[col])
      }

      applyColumns(cols)
    } catch {
      toast.error('Failed to load work orders')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  // ── DnD sensors ──────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 8px movement before activating drag so card clicks still work.
      activationConstraint: { distance: 8 },
    })
  )

  // ── Drag handlers ─────────────────────────────────────────

  function onDragStart({ active }: DragStartEvent) {
    const sourceCol = findContainer(active.id as string)

    snapshotRef.current = { ...workingRef.current }
    srcColumnRef.current = sourceCol
    curColumnRef.current = sourceCol

    // Locate the active card object for the overlay
    const card = Object.values(workingRef.current)
      .flat()
      .find(c => c.id === active.id)
    setActiveCard(card ?? null)
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) { setOverColumn(null); return }

    const activeId = active.id as string
    const overId   = over.id   as string

    const activeContainer = curColumnRef.current         // where the card currently is
    const overContainer   = findContainer(overId)        // where pointer is hovering

    setOverColumn(overContainer)

    if (!activeContainer || !overContainer)                return
    if (activeContainer === overContainer)                 return

    // Enforce forward-only adjacency (queued→in_progress, etc.)
    const srcIdx = COLUMN_ORDER.indexOf(activeContainer)
    const dstIdx = COLUMN_ORDER.indexOf(overContainer)
    if (dstIdx !== srcIdx + 1) return

    // Optimistically move card into the new column, maintaining priority sort.
    const movedCard = workingRef.current[activeContainer].find(c => c.id === activeId)
    if (!movedCard) return

    const newCols: ColumnsState = {
      ...workingRef.current,
      [activeContainer]: workingRef.current[activeContainer].filter(c => c.id !== activeId),
      [overContainer]:   sortByPriority([...workingRef.current[overContainer], movedCard]),
    }

    curColumnRef.current = overContainer  // track new position synchronously
    applyColumns(newCols)
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveCard(null)
    setOverColumn(null)

    const activeId          = active.id as string
    const currentContainer  = curColumnRef.current
    const originalContainer = srcColumnRef.current

    // Dropped outside all droppables → revert
    if (!over) {
      applyColumns(snapshotRef.current)
      return
    }

    // No column change → nothing to do
    if (!currentContainer || !originalContainer || currentContainer === originalContainer) {
      return
    }

    // Find card for toast (it's already in currentContainer in working state)
    const card = workingRef.current[currentContainer].find(c => c.id === activeId)

    try {
      const res  = await fetch(`/api/work-orders/${activeId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_status: currentContainer }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status')

      toast.success(
        `${card?.order_number ?? 'Order'} moved to ${COLUMN_CONFIG[currentContainer].label}`
      )

      // Brief ring highlight on the landed card
      setDroppedId(activeId)
      setTimeout(() => setDroppedId(null), 800)
    } catch (err: unknown) {
      applyColumns(snapshotRef.current)
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  // ── Derived: which columns are valid drop targets right now ─

  function isValidTarget(targetStatus: KanbanStatus): boolean {
    const src = srcColumnRef.current
    if (!src || !activeCard) return false
    return COLUMN_ORDER.indexOf(targetStatus) === COLUMN_ORDER.indexOf(src) + 1
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return <KanbanSkeleton />
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex justify-end mb-3">
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCcw style={{ width: 12, height: 12 }} />
          Refresh
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
          {COLUMN_ORDER.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              label={COLUMN_CONFIG[status].label}
              borderColor={COLUMN_CONFIG[status].borderColor}
              cards={columns[status]}
              droppedId={droppedId}
              isHovered={overColumn === status}
              isValidDrop={isValidTarget(status)}
              isDragging={!!activeCard}
            />
          ))}
        </div>

        {/* Floating overlay card shown while dragging */}
        <DragOverlay>
          {activeCard && <KanbanCardOverlay card={activeCard} />}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
