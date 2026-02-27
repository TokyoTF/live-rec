export function tooltip(node, options = {}) {
  let tooltipElement
  let text = typeof options === 'string' ? options : options.text
  let position = options.position || 'top'

  function positionTooltip() {
    if (!tooltipElement) return
    const rect = node.getBoundingClientRect()
    
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = document.documentElement.clientHeight
    const vw = viewportWidth - 8
    const vh = viewportHeight - 8

    let top = 0
    let left = 0

    if (position === 'top') {
      top = rect.top - tooltipElement.offsetHeight - 8
      left = rect.left + (rect.width / 2) - (tooltipElement.offsetWidth / 2)
      if (top < 8) {
        top = rect.bottom + 8
      }
    } else if (position === 'bottom') {
      top = rect.bottom + 8
      left = rect.left + (rect.width / 2) - (tooltipElement.offsetWidth / 2)
      if (top + tooltipElement.offsetHeight > vh) {
        top = rect.top - tooltipElement.offsetHeight - 8
      }
    } else if (position === 'left') {
      top = rect.top + (rect.height / 2) - (tooltipElement.offsetHeight / 2)
      left = rect.left - tooltipElement.offsetWidth - 8
      if (left < 8) {
        left = rect.right + 8
      }
    } else if (position === 'right') {
      top = rect.top + (rect.height / 2) - (tooltipElement.offsetHeight / 2)
      left = rect.right + 8
      if (left + tooltipElement.offsetWidth > vw) {
        left = rect.left - tooltipElement.offsetWidth - 8
      }
    }

    // Keep remaining bounds within viewport
    if (left < 8) left = 8
    if (left + tooltipElement.offsetWidth > vw) left = vw - tooltipElement.offsetWidth
    if (top < 8) top = 8
    if (top + tooltipElement.offsetHeight > vh) top = vh - tooltipElement.offsetHeight

    tooltipElement.style.top = `${top}px`
    tooltipElement.style.left = `${left}px`
  }

  function handleMouseEnter() {
    if (!text) return
    tooltipElement = document.createElement('div')
    tooltipElement.textContent = text
    
    // Tailwind + Base styling
    tooltipElement.className = 'fixed z-[9999] px-2.5 py-1.5 text-xs font-semibold text-white bg-surface-700 border border-white/20 rounded-md shadow-xl pointer-events-none opacity-0 transition-opacity duration-200 whitespace-nowrap'
    
    document.body.appendChild(tooltipElement)
    
    // Force reflow
    void tooltipElement.offsetWidth
    tooltipElement.classList.remove('opacity-0')
    tooltipElement.classList.add('opacity-100')
    
    positionTooltip()
  }

  function handleMouseLeave() {
    if (tooltipElement) {
      const el = tooltipElement
      el.classList.remove('opacity-100')
      el.classList.add('opacity-0')
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el)
      }, 200)
      tooltipElement = null
    }
  }

  node.addEventListener('mouseenter', handleMouseEnter)
  node.addEventListener('mouseleave', handleMouseLeave)

  // Ensure title attribute is removed to avoid native tooltips overlapping
  const originalTitle = node.getAttribute('title')
  if (originalTitle) {
    node.removeAttribute('title')
    if (!text) text = originalTitle
  }

  return {
    update(newOptions) {
      text = typeof newOptions === 'string' ? newOptions : newOptions?.text
      position = typeof newOptions === 'string' ? 'top' : (newOptions?.position || 'top')
      
      if (tooltipElement) {
        tooltipElement.textContent = text
        positionTooltip()
      }
    },
    destroy() {
      node.removeEventListener('mouseenter', handleMouseEnter)
      node.removeEventListener('mouseleave', handleMouseLeave)
      handleMouseLeave()
    }
  }
}
