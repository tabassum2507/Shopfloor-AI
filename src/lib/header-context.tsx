'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type Ctx = {
  headerRight: ReactNode | null
  setHeaderRight: (node: ReactNode | null) => void
}

const HeaderCtx = createContext<Ctx>({ headerRight: null, setHeaderRight: () => {} })

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [headerRight, setHeaderRight] = useState<ReactNode | null>(null)
  return (
    <HeaderCtx.Provider value={{ headerRight, setHeaderRight }}>
      {children}
    </HeaderCtx.Provider>
  )
}

export function useHeaderRight() {
  return useContext(HeaderCtx)
}
