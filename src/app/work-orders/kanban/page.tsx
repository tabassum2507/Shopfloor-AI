import Link from 'next/link'
import { List } from 'lucide-react'
import { KanbanBoard } from '@/components/KanbanBoard'

export default function KanbanPage() {
  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[13px] text-gray-400">
            Drag cards forward to advance status.
            Cards within each column are sorted by priority.
          </p>
        </div>
        <Link
          href="/work-orders"
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-[12.5px] text-gray-600 hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
        >
          <List style={{ width: 13, height: 13 }} />
          List view
        </Link>
      </div>

      <KanbanBoard />
    </div>
  )
}
