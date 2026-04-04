import { useTheme } from '../../../theme/ThemeContext'
import useAppStore from '../../../store/useAppStore'

export default function ValidationBadge() {
  const { parseResult } = useAppStore()
  const { t, isDark } = useTheme()

  const data = parseResult?.data as Record<string, unknown> | undefined
  const validation = data?.validation as Record<string, unknown> | undefined

  if (!validation && !parseResult) return null

  const errCount = (validation?.error_count as number) ?? 0
  const warnCount = (validation?.warning_count as number) ?? 0
  
  // Strict logic: 0 errors AND 0 warnings = valid.
  const isValid = errCount === 0 && warnCount === 0

  return (
    <div style={{
      background: isValid ? (isDark ? 'rgba(149,225,211,0.2)' : t.mint) : t.coral,
      border: `2px solid ${t.ink}`,
      color: isValid ? t.ink : 'white',
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
      {isValid ? '✓ Valid' : `✗ ${errCount} Errors`}
    </div>
  )
}
