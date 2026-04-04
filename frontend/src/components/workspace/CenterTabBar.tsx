import { Reorder, motion } from 'framer-motion'
import useAppStore, { type WorkspaceTab } from '../../store/useAppStore'

const TAB_TYPE_ICONS: Record<string, string> = {
  form: '📝',
  raw: '< >',
  summary: '📊',
  remittance: '💵',
  roster: '👥',
  audit: '⚖️',
}

export default function CenterTabBar() {
  const openTabs = useAppStore((s) => s.openTabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const setOpenTabs = useAppStore((s) => s.setOpenTabs)
  const setActiveTabId = useAppStore((s) => s.setActiveTabId)
  const closeTab = useAppStore((s) => s.closeTab)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 0,
        height: 38,
        flexShrink: 0,
        borderBottom: '2.5px solid #1A1A2E',
        background: '#FDFAF4',
        padding: '0 8px',
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
      className="custom-scrollbar-x"
    >
      <Reorder.Group
        as="div"
        axis="x"
        values={openTabs}
        onReorder={setOpenTabs}
        style={{ display: 'flex', alignItems: 'flex-end', gap: 2, listStyle: 'none', margin: 0, padding: 0 }}
      >
        {openTabs.map((tab: WorkspaceTab) => {
          const isActive = tab.id === activeTabId
          return (
            <Reorder.Item
              key={tab.id}
              value={tab}
              as="div"
              style={{ cursor: 'grab' }}
            >
              <motion.div
                onClick={() => setActiveTabId(tab.id)}
                layout
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px 6px 12px',
                  background: isActive ? '#FFFFFF' : 'transparent',
                  border: isActive ? '2px solid #1A1A2E' : '2px solid transparent',
                  borderBottom: isActive ? '2px solid #FFFFFF' : '2px solid transparent',
                  borderRadius: '8px 8px 0 0',
                  cursor: 'pointer',
                  position: 'relative',
                  bottom: isActive ? -2 : 0,
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: 13,
                  color: isActive ? '#1A1A2E' : 'rgba(26,26,46,0.5)',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <span style={{ fontSize: 11, opacity: 0.7 }}>
                  {typeof TAB_TYPE_ICONS[tab.type] === 'string' && TAB_TYPE_ICONS[tab.type].length <= 3
                    ? <code style={{ fontSize: 10 }}>{TAB_TYPE_ICONS[tab.type]}</code>
                    : TAB_TYPE_ICONS[tab.type]}
                </span>
                {tab.label}
                {/* Close button */}
                {tab.closable && (
                  <span
                    role="button"
                    aria-label={`Close ${tab.label}`}
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                    style={{
                      marginLeft: 2,
                      width: 16,
                      height: 16,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      fontSize: 11,
                      color: 'rgba(26,26,46,0.45)',
                      transition: 'background 0.1s, color 0.1s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      const t = e.currentTarget
                      t.style.background = 'rgba(255,107,107,0.15)'
                      t.style.color = '#FF6B6B'
                    }}
                    onMouseLeave={(e) => {
                      const t = e.currentTarget
                      t.style.background = 'transparent'
                      t.style.color = 'rgba(26,26,46,0.45)'
                    }}
                  >
                    ✕
                  </span>
                )}
              </motion.div>
            </Reorder.Item>
          )
        })}
      </Reorder.Group>

      {/* Spacer fill */}
      <div style={{ flex: 1 }} />
    </div>
  )
}