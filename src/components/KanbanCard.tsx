'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import type { WOPriority } from '@/lib/wo-config'

// ─── Shared types ─────────────────────────────────────────────

export type KanbanStatus = 'queued' | 'in_progress' | 'qc' | 'done'

export type WOCard = {
  id: string
  order_number: string
  quantity: number
  status: KanbanStatus
  priority: WOPriority
  scheduled_end: string | null
  products: { name: string; unit: string } | null
  atRisk?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function isOverdue(card: WOCard): boolean {
  if (!card.scheduled_end || card.status === 'done') return false
  return new Date(card.scheduled_end) < new Date()
}

const PRIORITY_COLOR: Record<WOPriority, string> = {
  urgent: '#EF4444',
  high:   '#F59E0B',
  medium: '#3B82F6',
  low:    '#9CA3AF',
}

const PRIORITY_LABEL: Record<WOPriority, string> = {
  urgent: 'Urgent',
  high:   'High',
  medium: 'Med',
  low:    'Low',
}

// ─── Shared inner content ─────────────────────────────────────

function CardInner({ card }: { card: WOCard }) {
  const overdue = isOverdue(card)
  const color   = PRIORITY_COLOR[card.priority]

  return (
    <>
      {/* Priority badge + Order# */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span
          className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded text-[10px] font-bold shrink-0"
          style={{ backgroundColor: color + '1a', color }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          {PRIORITY_LABEL[card.priority]}
        </span>
        <span className="font-mono text-[10.5px] font-semibold text-gray-400 tabular-nums truncate">
          {card.order_number}
        </span>
      </div>

      {/* Product name */}
      <p className="text-[13px] font-semibold text-gray-800 leading-snug mb-2 line-clamp-2">
        {card.products?.name ?? '—'}
      </p>

      {/* Quantity + target date */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-gray-400 tabular-nums">
          {+card.quantity.toFixed(4) + ''}&thinsp;{card.products?.unit ?? ''}
        </span>
        {card.scheduled_end && (
          <span className={`flex items-center gap-1 text-[11px] font-medium ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
            {overdue && <AlertTriangle style={{ width: 10, height: 10 }} />}
            {fmtDate(card.scheduled_end)}
          </span>
        )}
      </div>

      {/* At-risk badge — shown when predicted to miss target but not yet overdue */}
      {card.atRisk && !overdue && (
        <div className="mt-2 pt-2 border-t border-amber-100 flex items-center justify-end gap-1">
          <TrendingUp style={{ width: 9, height: 9, color: '#D97706' }} />
          <span className="text-[10px] font-semibold text-amber-600">At Risk</span>
        </div>
      )}
    </>
  )
}

// ─── Overlay card (rendered inside DragOverlay) ───────────────

export function KanbanCardOverlay({ card }: { card: WOCard }) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-2xl select-none"
      style={{ cursor: 'grabbing', transform: 'rotate(1.5deg) scale(1.04)' }}
    >
      <CardInner card={card} />
    </div>
  )
}

// ─── Sortable draggable card ──────────────────────────────────

export function KanbanCard({
  card,
  isJustDropped,
}: {
  card: WOCard
  isJustDropped?: boolean
}) {
  const router = useRouter()
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: card.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
      }}
      {...attributes}
      {...listeners}
      onClick={() => router.push(`/work-orders/${card.id}`)}
      className={[
        'rounded-lg border p-3',
        'cursor-grab active:cursor-grabbing select-none',
        'transition-all duration-500',
        isDragging
          ? 'opacity-25 shadow-none border-gray-100 bg-white'
          : card.atRisk && !isOverdue(card)
            ? 'opacity-100 shadow-sm hover:shadow-md border-amber-200 bg-amber-50/30'
            : 'opacity-100 shadow-sm hover:shadow-md border-gray-100 bg-white',
        isJustDropped
          ? 'ring-2 ring-primary/40 bg-primary/[0.03]'
          : 'ring-0',
      ].join(' ')}
    >
      <CardInner card={card} />
    </div>
  )
}
