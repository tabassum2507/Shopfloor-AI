'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export type DonutSlice = { name: string; value: number; color: string }

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { color: string } }>
}) {
  if (!active || !payload?.length) return null
  const { name, value, payload: { color } } = payload[0]
  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-sm px-3 py-2 text-xs flex items-center gap-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="font-medium text-gray-600">{name}</span>
      <span className="font-mono font-semibold text-gray-800 tabular-nums">{value}</span>
    </div>
  )
}

interface Props { data: DonutSlice[] }

export default function PriorityDonutChart({ data }: Props) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="h-[188px] flex items-center justify-center">
        <p className="text-[13px] text-gray-400">No active orders</p>
      </div>
    )
  }
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div className="flex flex-col gap-5">
      {/* Donut with center label */}
      <div className="relative" style={{ height: 188 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label — absolute overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[28px] font-semibold font-mono tabular-nums text-gray-800 leading-none">
            {total}
          </span>
          <span className="text-[11px] text-gray-400 font-medium mt-1 uppercase tracking-wide">
            orders
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-[12px] text-gray-500 flex-1">{d.name}</span>
            <span className="text-[12px] font-mono font-semibold text-gray-700 tabular-nums">
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
