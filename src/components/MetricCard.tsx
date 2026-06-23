import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  count: number
  Icon: LucideIcon
  accent: string
}

export default function MetricCard({ title, count, Icon, accent }: Props) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-100 border-l-4 shadow-sm p-5 flex items-center gap-4"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          {title}
        </p>
        <p className="text-[32px] font-semibold leading-none font-mono tabular-nums text-gray-800 mt-2">
          {count}
        </p>
      </div>

      <div
        className="shrink-0 rounded-xl p-2.5"
        style={{ backgroundColor: accent + '18' }}
      >
        <Icon
          style={{ width: 20, height: 20, color: accent }}
          strokeWidth={1.75}
        />
      </div>
    </div>
  )
}
