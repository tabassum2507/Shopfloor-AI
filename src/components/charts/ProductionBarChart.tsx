'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export type BarDay = { day: string; output: number; date?: string }

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-gray-600">{label}</p>
      <p className="font-mono font-semibold text-[#1E3A5F] mt-0.5 tabular-nums">
        {payload[0].value} t
      </p>
    </div>
  )
}

interface Props { data: BarDay[] }

export default function ProductionBarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={232}>
      <BarChart
        data={data}
        barSize={30}
        margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
      >
        <CartesianGrid
          vertical={false}
          strokeDasharray="4 4"
          stroke="#f0f0f0"
        />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: '#9ca3af' }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: '#9ca3af' }}
          tickFormatter={(v) => `${v}t`}
        />
        <Tooltip
          content={<BarTooltip />}
          cursor={{ fill: '#f9fafb', radius: 4 }}
        />
        <Bar dataKey="output" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
