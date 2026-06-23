// Shared constants for work-order status / priority across pages and API routes.

export type WOStatus   = 'queued' | 'in_progress' | 'qc' | 'done' | 'cancelled'
export type WOPriority = 'low' | 'medium' | 'high' | 'urgent'

export const STATUS_CFG: Record<WOStatus, { label: string; dot: string; cls: string }> = {
  queued:      { label: 'Queued',      dot: '#F59E0B', cls: 'bg-amber-100  text-amber-700'  },
  in_progress: { label: 'In Progress', dot: '#3B82F6', cls: 'bg-blue-100   text-blue-700'   },
  qc:          { label: 'QC Review',   dot: '#8B5CF6', cls: 'bg-purple-100 text-purple-700' },
  done:        { label: 'Done',        dot: '#10B981', cls: 'bg-green-100  text-green-700'  },
  cancelled:   { label: 'Cancelled',   dot: '#9CA3AF', cls: 'bg-gray-100   text-gray-500'   },
}

export const PRIORITY_CFG: Record<WOPriority, { label: string; dot: string; cls: string; btn: string }> = {
  low:    { label: 'Low',    dot: '#9CA3AF', cls: 'bg-gray-100   text-gray-500',  btn: 'border-gray-300  bg-gray-100   text-gray-600'  },
  medium: { label: 'Medium', dot: '#3B82F6', cls: 'bg-blue-100   text-blue-700',  btn: 'border-blue-500  bg-blue-500   text-white'     },
  high:   { label: 'High',   dot: '#F59E0B', cls: 'bg-amber-100  text-amber-700', btn: 'border-amber-500 bg-amber-500  text-white'     },
  urgent: { label: 'Urgent', dot: '#EF4444', cls: 'bg-red-100    text-red-700',   btn: 'border-red-500   bg-red-500    text-white'     },
}

export const VALID_TRANSITIONS: Record<WOStatus, WOStatus[]> = {
  queued:      ['in_progress', 'cancelled'],
  in_progress: ['qc',          'cancelled'],
  qc:          ['done',        'cancelled'],
  done:        [],
  cancelled:   [],
}

export const TRANSITION_LABELS: Partial<Record<WOStatus, string>> = {
  in_progress: 'Start Production',
  qc:          'Send to QC',
  done:        'Mark as Done',
  cancelled:   'Cancel Order',
}
