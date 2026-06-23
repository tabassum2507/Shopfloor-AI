export type WorkOrderStatus = "queued" | "in_progress" | "qc" | "done" | "cancelled";
export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";
export type TransactionType = "consumption" | "restock";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string;
  description?: string;
  unit: string;
  created_at: string;
  updated_at: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  sku: string;
  description?: string;
  unit: string;
  stock_quantity: number;
  reorder_point: number;
  created_at: string;
  updated_at: string;
}

export interface BomItem {
  id: string;
  product_id: string;
  raw_material_id: string;
  quantity: number;
  unit: string;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: string;
  order_number: string;
  product_id: string;
  quantity: number;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  notes?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface StatusHistory {
  id: string;
  work_order_id: string;
  from_status?: WorkOrderStatus;
  to_status: WorkOrderStatus;
  changed_by?: string;
  notes?: string;
  created_at: string;
}

export interface InventoryTransaction {
  id: string;
  raw_material_id: string;
  work_order_id?: string;
  type: TransactionType;
  quantity: number;
  notes?: string;
  created_by?: string;
  created_at: string;
}
