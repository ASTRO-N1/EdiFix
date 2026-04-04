import { createContext, useContext, useState, useEffect } from 'react'
import { lightTokens, darkTokens, type ThemeTokens } from './tokens'

interface ThemeCtx {
  isDark: boolean
  toggle: () => void
  t: ThemeTokens
}

const ThemeContext = createContext<ThemeCtx>({
  isDark: false,
  toggle: () => {},
  t: lightTokens,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('edi-theme') === 'dark'
  })

  const toggle = () => {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem('edi-theme', next ? 'dark' : 'light')
      return next
    })
  }

  const t = isDark ? darkTokens : lightTokens

  useEffect(() => {
    document.body.style.background = t.bg
    document.body.style.color = t.ink
  }, [t])

  return (
    <ThemeContext.Provider value={{ isDark, toggle, t }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
