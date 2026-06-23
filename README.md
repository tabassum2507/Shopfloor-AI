# ShopFloor AI

**A full-stack Manufacturing Execution System (MES) demo with real-time Kanban, AI production assistant, and live Supabase backend.**

> **Live demo:** [shopfloor-ai.vercel.app](https://shopfloor-ai.vercel.app) &nbsp;·&nbsp; [LinkedIn](https://www.linkedin.com/in/tabassum-k)

---

<!-- Replace with an actual screenshot after deployment -->
![ShopFloor AI Dashboard](./public/screenshot-placeholder.png)

---

## What is this?

ShopFloor AI is a manufacturing operations dashboard built as a portfolio project. It simulates the core workflow of a real **Manufacturing Execution System** — the software steel mills, assembly lines, and production facilities use to track work orders from scheduling through quality control to completion.

The app manages the full lifecycle:

- A **product catalogue** with Bill of Materials (raw material requirements per unit produced)
- **Work orders** that move through a Queued → In Progress → QC Review → Done pipeline
- An **inventory system** that automatically deducts raw material stock when production starts, with a shortfall check before deduction
- A **Kanban board** for drag-and-drop status management
- An **AI assistant** with live shop-floor context (current WO status, inventory levels, overdue orders) powered by Groq

Everything runs against a live Supabase database — changes you make persist. The "Reset Demo Data" banner lets anyone restore the original dataset in one click.

---

## Features

- **Dashboard** — Live production metrics (queued, in-progress, QC, completed today), weekly output bar chart, priority donut chart, overdue orders table. Auto-refreshes every 30 seconds.
- **Work Orders** — Filterable list by status, priority, and date range. Inline overdue detection with days-over indicator.
- **Kanban Board** — Drag-and-drop cards across columns with forward-only transition enforcement. Snap-scroll on mobile.
- **Work Order Detail** — Full status history timeline, BOM shortfall modal when stock is insufficient for production start.
- **Products & BOM** — Add/edit/delete products with their Bill of Materials. CRUD with confirmation dialogs for destructive actions.
- **Inventory** — Raw material stock levels with reorder alerts, transaction log (consumptions + restocks), restock modal.
- **AI Assistant** — Streaming chat panel powered by Groq (llama-3.3-70b-versatile). Receives live shop-floor context in every prompt — answers questions about specific order numbers, stock levels, and bottlenecks.
- **Responsive layout** — Icon-only sidebar on tablet, hamburger drawer on mobile, snap-scroll Kanban, horizontal-scroll tables.
- **UX polish** — Skeleton loaders on all tables/charts, empty states, red toasts for API errors, inline form validation, page fade-in transitions, priority dot badges.
- **Demo reset** — One-click "Reset Demo Data" restores the full seed dataset via a server-side API route.

---

## Tech Stack

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-llama--3.3-F55036?logo=meta&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel&logoColor=white)

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router (Server + Client Components) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Database | Supabase (PostgreSQL + RLS) |
| AI inference | Groq API (streaming, llama-3.3-70b-versatile) |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable |
| Charts | Recharts |
| Icons | Lucide React |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Groq](https://console.groq.com) API key (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/yourusername/shopfloor-ai.git
cd shopfloor-ai
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Open `src/lib/seed.sql` from this repo and paste the entire contents into the editor
4. Click **Run** — this creates all tables, enums, RLS policies, triggers, and inserts sample data

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
GROQ_API_KEY=gsk_...
```

- **Supabase URL & Anon Key**: Project Settings → API in your Supabase dashboard
- **Groq API Key**: [console.groq.com/keys](https://console.groq.com/keys)

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Add the three environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY`) in the Vercel project settings under **Environment Variables**.

---

## Architecture Decisions

### Why context-stuffing instead of RAG for the AI assistant

The AI assistant fetches the full current shop-floor state — active work orders, raw material inventory, recent completions — and includes it in every prompt as a JSON context block (~2–3 KB). No vector embeddings, no retrieval pipeline.

This works because the dataset is small and bounded (≤ 40 active WOs, ≤ 20 materials), responses are always fresh with no staleness risk, and it eliminates the operational complexity of an embedding pipeline. For a dataset this size, context-stuffing is simpler, cheaper, and gives better results than RAG.

### Why Kanban as a primary view

Traditional MES dashboards are table-heavy: rows of orders with status filters. The Kanban board provides spatial intuition — you see the entire pipeline at once and spot bottlenecks visually. The column constraint (cards move forward only: Queued → In Progress → QC → Done) is enforced both in the UI (invalid drop targets are dimmed) and in the API, matching how real shop floors operate.

### BOM data model design

Bill of Materials lives in a dedicated `bom_items` join table (`product_id`, `raw_material_id`, `quantity`, `unit`) rather than in a JSON column on `products`. This matters for three reasons:

1. **Inventory validation** is a simple JOIN query rather than JSON parsing in application code
2. **Two-phase deduction** — validate all materials have sufficient stock first, then deduct all — is expressed as two clean passes over `bom_items`, preventing partial deductions on multi-material products
3. **Querying from the material side** ("which work orders need Steel Billet?") is a standard JOIN, not a JSON path scan

---

## Project Structure

```
src/
├── app/
│   ├── api/              # Route handlers (products, work-orders, inventory, ai, dashboard, demo)
│   ├── (pages)/          # Dashboard, Products, Work Orders, Kanban, Inventory
│   └── layout.tsx        # Root layout with fonts and AppShell
├── components/
│   ├── layout/           # AppShell (sidebar + header + footer), DemoBanner
│   ├── charts/           # ProductionBarChart, PriorityDonutChart (Recharts)
│   ├── ui/               # Modal, Toast
│   ├── KanbanBoard.tsx   # DnD context + column state management
│   ├── KanbanColumn.tsx  # Droppable column
│   └── KanbanCard.tsx    # Draggable card + overlay
└── lib/
    ├── supabase-server.ts # Server-side Supabase client factory
    ├── wo-config.ts       # Status/priority config, valid transitions
    ├── header-context.tsx # Per-page header slot (React context)
    └── seed.sql           # Full database schema + sample data
```

---

## Built by

**Tee (Tabassum K)** — [LinkedIn](https://www.linkedin.com/in/tabassum-k)

Built as a portfolio project demonstrating full-stack Next.js, real-time data, AI integration, and production-quality UX patterns.
"# Shopfloor-AI" 
