import { useTheme } from '../../../theme/ThemeContext'
import useAppStore from '../../../store/useAppStore'

export default function ValidationBadge() {
  const { parseResult } = useAppStore()
  const { t, isDark } = useTheme()

  if (!parseResult) return null

  const root = parseResult as Record<string, any>
  const nested = root.data || {}

  const e = root.validation_errors ?? root.errors ?? nested.validation_errors ?? nested.errors ?? []
  const w = root.warnings ?? nested.warnings ?? []
  const rawErrors = [...(e as any[]), ...(w as any[])]

  let errCount = 0
  let warnCount = 0
  rawErrors.forEach((err: any) => {
    if (err.type === 'warning' || err.type === 'SituationalWarning') {
      warnCount++
    } else {
      errCount++
    }
  })

  // Strict logic: 0 errors AND 0 warnings = valid.
  const isValid = errCount === 0 && warnCount === 0

  return (
    <div style={{
      background: isValid ? (isDark ? 'rgba(149,225,211,0.2)' : t.mint) : (errCount > 0 ? t.coral : t.yellow),
      border: `2px solid ${t.ink}`,
      color: isValid || errCount === 0 ? t.ink : 'white',
      fontFamily: 'Nunito, sans-serif',
      fontWeight: 700,
      fontSize: 12,
      padding: '4px 12px',
      borderRadius: 999,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      boxShadow: `2px 2px 0px ${t.shadow}`,
    }}>
      {isValid ? '✓ Valid' : (errCount > 0 ? `✗ ${errCount} Errors` : `⚠️ ${warnCount} Warnings`)}
    </div>
  )
}