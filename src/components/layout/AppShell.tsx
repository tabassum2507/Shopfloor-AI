'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Toaster } from '@/components/ui/toast'
import { HeaderProvider, useHeaderRight } from '@/lib/header-context'
import AiAssistant from '@/components/AiAssistant'
import { DemoBanner } from '@/components/layout/DemoBanner'
import { useAuth } from '@/lib/auth-context'
import {
  Factory,
  LayoutDashboard,
  Package,
  ClipboardList,
  Columns3,
  Warehouse,
  ArrowLeftRight,
  Bot,
  Menu,
  X,
  LogOut,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────

const NAV = [
  { label: 'Dashboard',       href: '/',                       Icon: LayoutDashboard },
  { label: 'Products',        href: '/products',               Icon: Package },
  { label: 'Work Orders',     href: '/work-orders',            Icon: ClipboardList },
  { label: 'Kanban Board',    href: '/kanban',                 Icon: Columns3 },
  { label: 'Inventory',       href: '/inventory',              Icon: Warehouse },
  { label: 'Transaction Log', href: '/inventory/transactions', Icon: ArrowLeftRight },
]

const ROLE_LABELS: Record<string, string> = {
  admin:      'Administrator',
  manager:    'Plant Manager',
  supervisor: 'Floor Supervisor',
  planner:    'Production Planner',
}

const NAVY = '#1E3A5F'

// ─── Helpers ──────────────────────────────────────────────────

function resolveTitle(pathname: string): string {
  if (pathname === '/')                               return 'Dashboard'
  if (pathname.startsWith('/products'))               return 'Products'
  if (pathname.startsWith('/work-orders'))            return 'Work Orders'
  if (pathname.startsWith('/kanban'))                 return 'Kanban Board'
  if (pathname.startsWith('/inventory/transactions')) return 'Transaction Log'
  if (pathname.startsWith('/inventory'))              return 'Inventory'
  if (pathname.startsWith('/profile'))                return 'My Profile'
  return 'ShopFloor AI'
}

function getInitials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'
}

// ─── Header right slot ────────────────────────────────────────

function HeaderRightSlot() {
  const { headerRight } = useHeaderRight()
  if (!headerRight) return null
  return <div className="flex items-center">{headerRight}</div>
}

// ─── Icon-only sidebar for tablet (md breakpoint) ────────────

function IconSidebar({ onAiClick }: { onAiClick?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full select-none" style={{ backgroundColor: NAVY }}>
      {/* Logo icon */}
      <div className="flex items-center justify-center h-[57px] border-b border-white/10 shrink-0">
        <Factory className="text-amber-400" style={{ width: 20, height: 20 }} strokeWidth={1.75} />
      </div>

      {/* Nav icons */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-1">
        {NAV.map(({ label, href, Icon }) => {
          const dominated = NAV.some(n => n.href !== href && n.href.startsWith(href + '/') && pathname.startsWith(n.href))
          const active = href === '/' ? pathname === '/' : !dominated && pathname.startsWith(href)
          return (
            <div key={href} className="relative group px-2">
              <Link
                href={href}
                title={label}
                style={active ? { backgroundColor: '#2D4F7A' } : undefined}
                className={[
                  'flex items-center justify-center w-10 h-10 rounded-lg mx-auto',
                  'transition-colors duration-100',
                  active
                    ? 'text-white'
                    : 'text-white/55 hover:text-white hover:bg-white/[0.06]',
                ].join(' ')}
              >
                <Icon style={{ width: 18, height: 18 }} strokeWidth={active ? 2 : 1.75} />
              </Link>
              {/* Tooltip */}
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
                <span className="block opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap bg-gray-900 text-white text-[11px] font-medium px-2 py-1 rounded-md shadow-lg">
                  {label}
                </span>
              </div>
            </div>
          )
        })}
      </nav>

      {/* AI button */}
      <div className="shrink-0 px-2 py-4 border-t border-white/10">
        <div className="relative group">
          <button
            type="button"
            onClick={onAiClick}
            title="AI Assistant"
            className="flex items-center justify-center w-10 h-10 rounded-full mx-auto text-amber-400 transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(251,191,36,0.13)',
              border: '1px solid rgba(251,191,36,0.30)',
              boxShadow: '0 0 10px rgba(251,191,36,0.22), 0 0 22px rgba(251,191,36,0.10)',
            }}
          >
            <Bot style={{ width: 17, height: 17 }} strokeWidth={1.9} />
          </button>
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
            <span className="block opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap bg-gray-900 text-white text-[11px] font-medium px-2 py-1 rounded-md shadow-lg">
              AI Assistant
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Full sidebar content (desktop + mobile drawer) ───────────

function SidebarContent({
  onLinkClick,
  onAiClick,
  onSignOut,
}: {
  onLinkClick?: () => void
  onAiClick?:   () => void
  onSignOut?:   () => void
}) {
  const pathname = usePathname()
  const { profile, user } = useAuth()

  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? ''
  const initials    = getInitials(displayName)
  const roleLabel   = ROLE_LABELS[profile?.role ?? ''] ?? 'Member'

  return (
    <div className="flex flex-col h-full select-none" style={{ backgroundColor: NAVY }}>

      {/* ── Logo ── */}
      <div className="px-5 py-[18px] border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <Factory
            className="shrink-0 text-amber-400"
            style={{ width: 18, height: 18 }}
            strokeWidth={1.75}
          />
          <span className="text-[15px] font-semibold tracking-tight text-white leading-none">
            ShopFloor<span className="text-amber-400"> AI</span>
          </span>
        </div>
      </div>

      {/* ── Nav label ── */}
      <div className="px-5 pt-5 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
          Menu
        </span>
      </div>

      {/* ── Nav items ── */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-px">
        {NAV.map(({ label, href, Icon }) => {
          const dominated = NAV.some(n => n.href !== href && n.href.startsWith(href + '/') && pathname.startsWith(n.href))
          const active = href === '/'
            ? pathname === '/'
            : !dominated && pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              style={active ? { backgroundColor: '#2D4F7A' } : undefined}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-[3px]',
                'text-[13.5px] transition-colors duration-100',
                'border-l-[3px]',
                active
                  ? 'border-l-amber-400 text-white font-medium'
                  : 'border-l-transparent text-white/55 hover:text-white hover:bg-white/[0.06]',
              ].join(' ')}
            >
              <Icon
                className="shrink-0"
                style={{ width: 16, height: 16 }}
                strokeWidth={active ? 2 : 1.75}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* ── Bottom section ── */}
      <div className="shrink-0 border-t border-white/10">

        {/* AI Assistant */}
        <div className="px-3 pt-3 pb-2">
          <button
            type="button"
            onClick={onAiClick}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-amber-400 transition-all duration-200 hover:scale-[1.01] hover:brightness-110"
            style={{
              background: 'rgba(251,191,36,0.10)',
              border: '1px solid rgba(251,191,36,0.28)',
              boxShadow: '0 0 12px rgba(251,191,36,0.18), 0 0 28px rgba(251,191,36,0.08)',
            }}
          >
            <Bot className="shrink-0" style={{ width: 16, height: 16 }} strokeWidth={2} />
            AI Assistant
          </button>
        </div>

        {/* User info + sign out */}
        <div className="px-3 pb-4 pt-1 border-t border-white/10 space-y-1">
          {/* User card */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-[3px]">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10.5px] font-bold text-amber-400"
              style={{ backgroundColor: 'rgba(251,191,36,0.12)' }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-white/80 truncate leading-tight">
                {displayName || 'Loading…'}
              </p>
              <span className="inline-block text-[9.5px] font-medium text-white/35 leading-tight">
                {roleLabel}
              </span>
            </div>
          </div>
          {/* Sign out */}
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center gap-3 px-3 py-1.5 rounded-[3px] text-[12.5px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors duration-100"
          >
            <LogOut className="shrink-0" style={{ width: 13, height: 13 }} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AppShell ─────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [aiOpen,     setAiOpen]     = useState(false)
  const pathname         = usePathname()
  const { signOut, user, profile } = useAuth()

  // Auth pages render without the shell chrome
  if (pathname === '/login' || pathname === '/signup') {
    return <>{children}<Toaster /></>
  }

  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? ''
  const firstName   = displayName.split(/[\s@]/)[0]

  return (
    <HeaderProvider>
    <div className="flex h-screen overflow-hidden">

      {/* Desktop full sidebar (lg+) */}
      <div className="hidden lg:flex flex-col shrink-0 overflow-hidden" style={{ width: 240 }}>
        <SidebarContent onAiClick={() => setAiOpen(true)} onSignOut={signOut} />
      </div>

      {/* Tablet icon-only sidebar (md to lg) */}
      <div className="hidden md:flex lg:hidden flex-col shrink-0 overflow-hidden" style={{ width: 64 }}>
        <IconSidebar onAiClick={() => setAiOpen(true)} />
      </div>

      {/* Mobile sidebar overlay (< md) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Scrim */}
          <div
            aria-hidden
            className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="relative shrink-0 shadow-2xl overflow-hidden" style={{ width: 240 }}>
            <SidebarContent
              onLinkClick={() => setMobileOpen(false)}
              onAiClick={() => { setMobileOpen(false); setAiOpen(true) }}
              onSignOut={signOut}
            />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute top-[15px] right-3 p-1 rounded text-white/40 hover:text-white transition-colors"
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Demo banner */}
        <DemoBanner />

        {/* Top bar */}
        <header className="h-14 shrink-0 flex items-center gap-3 px-5 bg-white border-b border-gray-200">
          {/* Hamburger — mobile only */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 -ml-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <Menu style={{ width: 18, height: 18 }} />
          </button>

          {/* Route title */}
          <h1 className="text-[14.5px] font-semibold text-gray-800 tracking-tight">
            {resolveTitle(pathname)}
          </h1>

          {/* Right-side header area: page actions + welcome greeting */}
          <div className="ml-auto flex items-center gap-4">
            <HeaderRightSlot />
            {firstName && (
              <span className="hidden sm:block text-[12.5px] text-gray-500 whitespace-nowrap">
                Welcome,{' '}
                <span className="font-semibold text-gray-700">{firstName}</span>
              </span>
            )}
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F8FAFC' }}>
          <div className="p-6">{children}</div>
        </main>

        {/* Footer */}
        <footer className="shrink-0 px-5 py-2.5 border-t border-gray-100 bg-white flex items-center justify-between gap-4 flex-wrap">
          <span className="text-[11.5px] text-gray-500">
            Built by{' '}
            <a
              href="https://www.linkedin.com/in/tabassum-khanum/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline underline-offset-2"
            >
              Tabassum Khanum
            </a>
            {' '}· Product Manager &amp; Solo Builder ·{' '}
            <a
              href="https://github.com/tabassumk2202"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gray-500 hover:text-primary hover:underline underline-offset-2 transition-colors"
            >
              View on GitHub
            </a>
          </span>
          <span className="hidden sm:block text-[11px] text-gray-300">
            ShopFloor AI v1.0 · MES Portfolio Demo
          </span>
        </footer>
      </div>

      {/* ── Floating AI button ── */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-2">
        {/* Tooltip */}
        <div className={[
          'mb-1 px-3 py-1.5 rounded-lg bg-gray-900/90 backdrop-blur-sm text-white text-[12px] font-medium whitespace-nowrap shadow-lg',
          'pointer-events-none select-none',
          aiOpen ? 'opacity-0' : 'opacity-0 group-hover:opacity-100',
        ].join(' ')}>
          AI Assistant
        </div>

        <div className="relative group">
          {/* Pulse ring */}
          {!aiOpen && (
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: 'rgba(251,191,36,0.35)', animationDuration: '2.4s' }}
            />
          )}

          <button
            type="button"
            aria-label="Open AI Assistant"
            onClick={() => setAiOpen(o => !o)}
            className="relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
            style={{
              background: aiOpen
                ? 'linear-gradient(135deg, #1E3A5F, #2D4F7A)'
                : 'linear-gradient(135deg, #F59E0B, #FBBF24)',
              boxShadow: aiOpen
                ? '0 4px 20px rgba(30,58,95,0.5), 0 2px 8px rgba(0,0,0,0.25)'
                : '0 0 0 4px rgba(251,191,36,0.15), 0 4px 20px rgba(251,191,36,0.55), 0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <Bot
              className="text-white"
              style={{ width: 24, height: 24 }}
              strokeWidth={2}
            />
          </button>

          {/* Hover tooltip */}
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <span className="block opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap bg-gray-900 text-white text-[11.5px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg">
              {aiOpen ? 'Close Assistant' : 'AI Assistant'}
            </span>
          </div>
        </div>
      </div>

      <Toaster />
      <AiAssistant isOpen={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
    </HeaderProvider>
  )
}
