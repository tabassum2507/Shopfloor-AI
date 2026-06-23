-- =====================================================
-- ShopFloor AI – Complete Supabase Database Setup
-- Paste into Supabase Dashboard → SQL Editor → Run All
-- =====================================================

-- ──────────────────────────────────────────────────
-- ENUMS
-- ──────────────────────────────────────────────────

CREATE TYPE work_order_status AS ENUM (
  'queued',
  'in_progress',
  'qc',
  'done',
  'cancelled'
);

CREATE TYPE work_order_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE transaction_type AS ENUM (
  'consumption',
  'restock'
);

-- ──────────────────────────────────────────────────
-- TABLES
-- ──────────────────────────────────────────────────

CREATE TABLE products (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT         NOT NULL,
  sku         TEXT         NOT NULL UNIQUE,
  category    TEXT         NOT NULL DEFAULT 'Finished Goods',
  description TEXT,
  unit        TEXT         NOT NULL DEFAULT 'tonnes',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- If you already ran seed.sql, add the column manually:
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Finished Goods';

CREATE TABLE raw_materials (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT          NOT NULL,
  sku            TEXT          NOT NULL UNIQUE,
  description    TEXT,
  unit           TEXT          NOT NULL DEFAULT 'tonnes',
  stock_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_point  NUMERIC(12,3) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE bom_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID          NOT NULL REFERENCES products(id)      ON DELETE CASCADE,
  raw_material_id UUID          NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  quantity        NUMERIC(12,4) NOT NULL,
  unit            TEXT          NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (product_id, raw_material_id)
);

-- Sequence: first nextval() = 35 → generates WO-2026-0035
CREATE SEQUENCE work_order_seq START WITH 35;

CREATE TABLE work_orders (
  id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    TEXT                NOT NULL UNIQUE,
  product_id      UUID                NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity        NUMERIC(12,3)       NOT NULL,
  status          work_order_status   NOT NULL DEFAULT 'queued',
  priority        work_order_priority NOT NULL DEFAULT 'medium',
  scheduled_start TIMESTAMPTZ,
  scheduled_end   TIMESTAMPTZ,
  actual_start    TIMESTAMPTZ,
  actual_end      TIMESTAMPTZ,
  notes           TEXT,
  assigned_to     TEXT,
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE TABLE status_history (
  id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID              NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  from_status   work_order_status,
  to_status     work_order_status NOT NULL,
  changed_by    TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE TABLE inventory_transactions (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id UUID             NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  work_order_id   UUID             REFERENCES work_orders(id) ON DELETE SET NULL,
  type            transaction_type NOT NULL,
  quantity        NUMERIC(12,3)    NOT NULL,
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────────

CREATE INDEX idx_work_orders_status      ON work_orders            (status);
CREATE INDEX idx_work_orders_product     ON work_orders            (product_id);
CREATE INDEX idx_work_orders_priority    ON work_orders            (priority);
CREATE INDEX idx_status_history_wo       ON status_history         (work_order_id);
CREATE INDEX idx_inv_tx_raw_material     ON inventory_transactions  (raw_material_id);
CREATE INDEX idx_inv_tx_work_order       ON inventory_transactions  (work_order_id);

-- ──────────────────────────────────────────────────
-- TRIGGERS
-- ──────────────────────────────────────────────────

-- Auto-generate order_number (WO-YYYY-XXXX) when not explicitly supplied
CREATE OR REPLACE FUNCTION fn_set_work_order_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number :=
      'WO-' || TO_CHAR(now(), 'YYYY') || '-' ||
      LPAD(nextval('work_order_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_work_order_number
  BEFORE INSERT ON work_orders
  FOR EACH ROW EXECUTE FUNCTION fn_set_work_order_number();

-- Maintain updated_at automatically on every UPDATE
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_raw_materials_updated_at
  BEFORE UPDATE ON raw_materials
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_bom_items_updated_at
  BEFORE UPDATE ON bom_items
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ──────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Portfolio demo: allow all operations for the anon role.
-- Replace with auth.uid()-scoped policies before going to production.
-- ──────────────────────────────────────────────────

ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_materials          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON products               FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON raw_materials          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON bom_items              FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON work_orders            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON status_history         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON inventory_transactions FOR ALL TO anon USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────
-- SEED: Products
-- ──────────────────────────────────────────────────

INSERT INTO products (id, name, sku, category, description, unit) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'TMT Bar 12mm',     'TMT-12',  'Finished Goods',
   'Thermo-mechanically treated reinforcement bar, 12 mm diameter', 'tonnes'),
  ('a0000001-0000-0000-0000-000000000002', 'TMT Bar 16mm',     'TMT-16',  'Finished Goods',
   'Thermo-mechanically treated reinforcement bar, 16 mm diameter', 'tonnes'),
  ('a0000001-0000-0000-0000-000000000003', 'Wire Rod 6mm',     'WR-06',   'Intermediate',
   'Cold-drawn wire rod, 6 mm diameter',                            'tonnes'),
  ('a0000001-0000-0000-0000-000000000004', 'Angle Iron 50x50', 'ANG-50',  'Finished Goods',
   'Equal-leg angle iron, 50×50 mm cross-section',                  'tonnes');

-- ──────────────────────────────────────────────────
-- SEED: Raw Materials
-- ──────────────────────────────────────────────────

INSERT INTO raw_materials (id, name, sku, unit, stock_quantity, reorder_point) VALUES
  ('b0000002-0000-0000-0000-000000000001', 'Steel Billet',    'RM-BILLET', 'tonnes', 1200,  200),
  ('b0000002-0000-0000-0000-000000000002', 'Iron Ore',        'RM-IRORE',  'tonnes', 3000,  500),
  ('b0000002-0000-0000-0000-000000000003', 'Ferro Manganese', 'RM-FEMN',   'tonnes',   80,   15),
  ('b0000002-0000-0000-0000-000000000004', 'Zinc',            'RM-ZINC',   'tonnes',   25,    5);

-- ──────────────────────────────────────────────────
-- SEED: BOM Items
-- ──────────────────────────────────────────────────

INSERT INTO bom_items (id, product_id, raw_material_id, quantity, unit) VALUES
  -- TMT-12: 1.08 t billet + 0.015 t ferro manganese per tonne of output
  ('c0000003-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000001', 1.0800, 'tonnes'),
  ('c0000003-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000003', 0.0150, 'tonnes'),

  -- TMT-16: 1.10 t billet + 0.018 t ferro manganese
  ('c0000003-0000-0000-0000-000000000003',
   'a0000001-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000001', 1.1000, 'tonnes'),
  ('c0000003-0000-0000-0000-000000000004',
   'a0000001-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000003', 0.0180, 'tonnes'),

  -- WR-06: 1.05 t billet + 0.01 t ferro manganese
  ('c0000003-0000-0000-0000-000000000005',
   'a0000001-0000-0000-0000-000000000003', 'b0000002-0000-0000-0000-000000000001', 1.0500, 'tonnes'),
  ('c0000003-0000-0000-0000-000000000006',
   'a0000001-0000-0000-0000-000000000003', 'b0000002-0000-0000-0000-000000000003', 0.0100, 'tonnes'),

  -- ANG-50: 1.12 t billet + 0.02 t ferro manganese + 0.005 t zinc
  ('c0000003-0000-0000-0000-000000000007',
   'a0000001-0000-0000-0000-000000000004', 'b0000002-0000-0000-0000-000000000001', 1.1200, 'tonnes'),
  ('c0000003-0000-0000-0000-000000000008',
   'a0000001-0000-0000-0000-000000000004', 'b0000002-0000-0000-0000-000000000003', 0.0200, 'tonnes'),
  ('c0000003-0000-0000-0000-000000000009',
   'a0000001-0000-0000-0000-000000000004', 'b0000002-0000-0000-0000-000000000004', 0.0050, 'tonnes');

-- ──────────────────────────────────────────────────
-- SEED: Work Orders
-- Explicit order_number values bypass the trigger (trigger only fires
-- when order_number IS NULL). After this block, setval advances the
-- sequence so the next app-generated order becomes WO-YYYY-0043.
--
-- Layout:
--   0035–0036  done      (completed, historical)
--   0037–0039  overdue   (0037 in_progress, 0038 in_progress, 0039 qc)
--   0040–0041  queued    (future scheduled dates)
--   0042       queued    (urgent, same-day rush)
-- ──────────────────────────────────────────────────

INSERT INTO work_orders (
  id, order_number, product_id,
  quantity, status, priority,
  scheduled_start, scheduled_end,
  actual_start, actual_end,
  assigned_to, notes
) VALUES

  -- ── DONE ─────────────────────────────────────────────────────────────────

  ('d0000004-0000-0000-0000-000000000001', 'WO-2026-0035',
   'a0000001-0000-0000-0000-000000000001',          -- TMT-12
   50, 'done', 'medium',
   '2026-06-01 06:00:00+00', '2026-06-03 18:00:00+00',
   '2026-06-01 06:15:00+00', '2026-06-03 16:45:00+00',
   'Ramesh Kumar', 'Delivered to warehouse B2'),

  ('d0000004-0000-0000-0000-000000000002', 'WO-2026-0036',
   'a0000001-0000-0000-0000-000000000003',          -- WR-06
   30, 'done', 'low',
   '2026-06-05 06:00:00+00', '2026-06-07 18:00:00+00',
   '2026-06-05 07:00:00+00', '2026-06-07 15:30:00+00',
   'Suresh Patel', 'Export batch — quality cert attached'),

  -- ── OVERDUE / IN_PROGRESS ────────────────────────────────────────────────

  ('d0000004-0000-0000-0000-000000000003', 'WO-2026-0037',
   'a0000001-0000-0000-0000-000000000002',          -- TMT-16
   75, 'in_progress', 'high',
   '2026-06-10 06:00:00+00', '2026-06-14 18:00:00+00',   -- due 14 Jun, now overdue
   '2026-06-10 06:30:00+00', NULL,
   'Arjun Singh', 'Delayed due to billet shortage — expedite'),

  ('d0000004-0000-0000-0000-000000000004', 'WO-2026-0038',
   'a0000001-0000-0000-0000-000000000004',          -- ANG-50
   20, 'in_progress', 'medium',
   '2026-06-12 06:00:00+00', '2026-06-15 18:00:00+00',   -- due 15 Jun, now overdue
   '2026-06-12 08:00:00+00', NULL,
   'Vikram Nair', NULL),

  -- ── OVERDUE / QC ─────────────────────────────────────────────────────────

  ('d0000004-0000-0000-0000-000000000005', 'WO-2026-0039',
   'a0000001-0000-0000-0000-000000000001',          -- TMT-12
   100, 'qc', 'high',
   '2026-06-08 06:00:00+00', '2026-06-12 18:00:00+00',   -- due 12 Jun, now overdue
   '2026-06-08 06:00:00+00', NULL,
   'Ramesh Kumar', 'Awaiting QC lab results — sample batch held'),

  -- ── QUEUED / FUTURE ──────────────────────────────────────────────────────

  ('d0000004-0000-0000-0000-000000000006', 'WO-2026-0040',
   'a0000001-0000-0000-0000-000000000002',          -- TMT-16
   60, 'queued', 'medium',
   '2026-06-25 06:00:00+00', '2026-06-28 18:00:00+00',
   NULL, NULL,
   NULL, NULL),

  ('d0000004-0000-0000-0000-000000000007', 'WO-2026-0041',
   'a0000001-0000-0000-0000-000000000003',          -- WR-06
   45, 'queued', 'low',
   '2026-06-27 06:00:00+00', '2026-06-30 18:00:00+00',
   NULL, NULL,
   NULL, NULL),

  -- ── QUEUED / URGENT ──────────────────────────────────────────────────────

  ('d0000004-0000-0000-0000-000000000008', 'WO-2026-0042',
   'a0000001-0000-0000-0000-000000000004',          -- ANG-50
   15, 'queued', 'urgent',
   '2026-06-24 06:00:00+00', '2026-06-24 18:00:00+00',
   NULL, NULL,
   NULL, 'Rush order — customer escalation');

-- Advance sequence: setval(seq, 42) means next nextval() = 43 → WO-YYYY-0043
SELECT setval('work_order_seq', 42);

-- ──────────────────────────────────────────────────
-- SEED: Status History
-- ──────────────────────────────────────────────────

INSERT INTO status_history
  (id, work_order_id, from_status, to_status, changed_by, created_at)
VALUES

  -- WO-2026-0035 (done): created → queued → in_progress → qc → done
  ('e0000005-0000-0000-0000-000000000001',
   'd0000004-0000-0000-0000-000000000001', NULL,          'queued',      'system',       '2026-05-30 10:00:00+00'),
  ('e0000005-0000-0000-0000-000000000002',
   'd0000004-0000-0000-0000-000000000001', 'queued',      'in_progress', 'Ramesh Kumar', '2026-06-01 06:15:00+00'),
  ('e0000005-0000-0000-0000-000000000003',
   'd0000004-0000-0000-0000-000000000001', 'in_progress', 'qc',          'Ramesh Kumar', '2026-06-03 14:00:00+00'),
  ('e0000005-0000-0000-0000-000000000004',
   'd0000004-0000-0000-0000-000000000001', 'qc',          'done',        'QC Team',      '2026-06-03 16:45:00+00'),

  -- WO-2026-0036 (done): queued → in_progress → qc → done
  ('e0000005-0000-0000-0000-000000000005',
   'd0000004-0000-0000-0000-000000000002', NULL,          'queued',      'system',       '2026-06-03 09:00:00+00'),
  ('e0000005-0000-0000-0000-000000000006',
   'd0000004-0000-0000-0000-000000000002', 'queued',      'in_progress', 'Suresh Patel', '2026-06-05 07:00:00+00'),
  ('e0000005-0000-0000-0000-000000000007',
   'd0000004-0000-0000-0000-000000000002', 'in_progress', 'qc',          'Suresh Patel', '2026-06-07 13:00:00+00'),
  ('e0000005-0000-0000-0000-000000000008',
   'd0000004-0000-0000-0000-000000000002', 'qc',          'done',        'QC Team',      '2026-06-07 15:30:00+00'),

  -- WO-2026-0037 (overdue in_progress): queued → in_progress
  ('e0000005-0000-0000-0000-000000000009',
   'd0000004-0000-0000-0000-000000000003', NULL,    'queued',      'system',      '2026-06-08 11:00:00+00'),
  ('e0000005-0000-0000-0000-000000000010',
   'd0000004-0000-0000-0000-000000000003', 'queued', 'in_progress', 'Arjun Singh', '2026-06-10 06:30:00+00'),

  -- WO-2026-0038 (overdue in_progress): queued → in_progress
  ('e0000005-0000-0000-0000-000000000011',
   'd0000004-0000-0000-0000-000000000004', NULL,    'queued',      'system',      '2026-06-09 14:00:00+00'),
  ('e0000005-0000-0000-0000-000000000012',
   'd0000004-0000-0000-0000-000000000004', 'queued', 'in_progress', 'Vikram Nair', '2026-06-12 08:00:00+00'),

  -- WO-2026-0039 (overdue qc): queued → in_progress → qc
  ('e0000005-0000-0000-0000-000000000013',
   'd0000004-0000-0000-0000-000000000005', NULL,          'queued',      'system',       '2026-06-06 09:00:00+00'),
  ('e0000005-0000-0000-0000-000000000014',
   'd0000004-0000-0000-0000-000000000005', 'queued',      'in_progress', 'Ramesh Kumar', '2026-06-08 06:00:00+00'),
  ('e0000005-0000-0000-0000-000000000015',
   'd0000004-0000-0000-0000-000000000005', 'in_progress', 'qc',          'Ramesh Kumar', '2026-06-12 10:00:00+00');

-- ──────────────────────────────────────────────────
-- SEED: Inventory Transactions
-- ──────────────────────────────────────────────────

INSERT INTO inventory_transactions
  (id, raw_material_id, work_order_id, type, quantity, notes, created_by, created_at)
VALUES

  -- WO-2026-0035 consumed: 50t TMT-12 × (1.08t billet + 0.015t FeMn)
  ('f0000006-0000-0000-0000-000000000001',
   'b0000002-0000-0000-0000-000000000001',   -- Steel Billet
   'd0000004-0000-0000-0000-000000000001',
   'consumption', 54.000,
   'WO-2026-0035 — 50 t TMT-12 production run', 'Ramesh Kumar',
   '2026-06-01 06:30:00+00'),

  ('f0000006-0000-0000-0000-000000000002',
   'b0000002-0000-0000-0000-000000000003',   -- Ferro Manganese
   'd0000004-0000-0000-0000-000000000001',
   'consumption', 0.750,
   'WO-2026-0035 — 50 t TMT-12 production run', 'Ramesh Kumar',
   '2026-06-01 06:30:00+00'),

  -- WO-2026-0036 consumed: 30t WR-06 × (1.05t billet + 0.01t FeMn)
  ('f0000006-0000-0000-0000-000000000003',
   'b0000002-0000-0000-0000-000000000001',   -- Steel Billet
   'd0000004-0000-0000-0000-000000000002',
   'consumption', 31.500,
   'WO-2026-0036 — 30 t WR-06 production run', 'Suresh Patel',
   '2026-06-05 07:30:00+00'),

  ('f0000006-0000-0000-0000-000000000004',
   'b0000002-0000-0000-0000-000000000003',   -- Ferro Manganese
   'd0000004-0000-0000-0000-000000000002',
   'consumption', 0.300,
   'WO-2026-0036 — 30 t WR-06 production run', 'Suresh Patel',
   '2026-06-05 07:30:00+00'),

  -- Mid-month Iron Ore restock (not tied to a work order)
  ('f0000006-0000-0000-0000-000000000005',
   'b0000002-0000-0000-0000-000000000002',   -- Iron Ore
   NULL,
   'restock', 500.000,
   'Routine monthly delivery — PO #4821', 'Procurement',
   '2026-06-15 10:00:00+00');
