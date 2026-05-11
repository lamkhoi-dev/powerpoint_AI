import { useRef, useCallback } from 'react'

const CLICK_THRESHOLD = 5

interface UseDragWindowReturn {
  onMouseDown: (e: React.MouseEvent) => void
}

export function useDragWindow(onClick?: () => void): UseDragWindowReturn {
  const isDragging = useRef(false)
  const startMouse = useRef({ x: 0, y: 0 })
  const hasMoved = useRef(false)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const dx = Math.abs(e.screenX - startMouse.current.x)
    const dy = Math.abs(e.screenY - startMouse.current.y)

    if (!isDragging.current && (dx > CLICK_THRESHOLD || dy > CLICK_THRESHOLD)) {
      isDragging.current = true
      hasMoved.current = true
      window.electronAPI.dragStart({ x: startMouse.current.x, y: startMouse.current.y })
    }

    if (isDragging.current) {
      window.electronAPI.dragMove({ x: e.screenX, y: e.screenY })
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)

    if (isDragging.current) {
      window.electronAPI.dragEnd()
    } else if (!hasMoved.current && onClick) {
      onClick()
    }

    isDragging.current = false
    hasMoved.current = false
  }, [handleMouseMove, onClick])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    startMouse.current = { x: e.screenX, y: e.screenY }
    isDragging.current = false
    hasMoved.current = false

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [handleMouseMove, handleMouseUp])

  return { onMouseDown }
}
