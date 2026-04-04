import type { SeparatorProps as PanelResizeHandleProps } from 'react-resizable-panels'
import { Separator as PanelResizeHandle } from 'react-resizable-panels'

interface DoodleResizeHandleProps extends PanelResizeHandleProps {
  direction?: 'horizontal' | 'vertical'
}

export default function DoodleResizeHandle({
  direction = 'horizontal',
  ...props
}: DoodleResizeHandleProps) {
  const isHorizontal = direction === 'horizontal'

  return (
    <PanelResizeHandle
      {...props}
      style={{
        position: 'relative',
        flexShrink: 0,
        ...(isHorizontal
          ? { width: 6, cursor: 'col-resize' }
          : { height: 6, cursor: 'row-resize' }),
      }}
    >
      <div
        className="doodle-resize-handle"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          transition: 'background 0.15s ease',
        }}
      >
        <div
          style={{
            ...(isHorizontal
              ? { width: 2, height: '60%', borderLeft: '2px dashed rgba(26,26,46,0.2)' }
              : { height: 2, width: '60%', borderTop: '2px dashed rgba(26,26,46,0.2)' }),
            transition: 'border-color 0.15s ease',
          }}
        />
      </div>
    </PanelResizeHandle>
  )
}