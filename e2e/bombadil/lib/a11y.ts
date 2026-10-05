// Accessible-name and visibility checks run inside the page (no framework, no axe).
export const accessibleName = (el: Element, doc: Document): string => {
  const text = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
  const aria = text(el.getAttribute('aria-label'))
  if (aria !== '') return aria
  const by = el.getAttribute('aria-labelledby')
  if (by !== null) {
    const t = text(
      by
        .split(/\s+/)
        .map((id) => doc.getElementById(id)?.textContent)
        .join(' '),
    )
    if (t !== '') return t
  }
  const labels = (el as HTMLInputElement).labels
  if (labels !== undefined && labels !== null) {
    const t = text(
      Array.from(labels)
        .map((l) => l.textContent)
        .join(' '),
    )
    if (t !== '') return t
  }
  if (el instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(el.type) && text(el.value) !== '') {
    return text(el.value)
  }
  const own = text(el.textContent)
  if (own !== '') return own
  const imgAlt = el.querySelector('img[alt]')?.getAttribute('alt')
  if (text(imgAlt) !== '') return text(imgAlt)
  const svgTitle = el.querySelector('svg title')?.textContent
  if (text(svgTitle) !== '') return text(svgTitle)
  return text(el.getAttribute('title'))
}

export const isVisible = (el: Element): boolean => {
  if (!(el instanceof HTMLElement)) return false
  if (el.closest('[hidden],[aria-hidden="true"],[inert]') !== null) return false
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false
  return el.getClientRects().length > 0
}

export const unnamedControls = (doc: Document): string[] => {
  const sel = 'button, a[href], input, select, textarea, [role=button], [role=link], [role=tab], [role=switch]'
  const out: string[] = []
  for (const el of Array.from(doc.querySelectorAll(sel))) {
    if (!isVisible(el)) continue
    if (accessibleName(el, doc) === '') {
      const t = el.getAttribute('data-testid')
      out.push(
        `${el.tagName.toLowerCase()}${t !== null ? `[${t}]` : ''}${el.className ? `.${String(el.className).split(' ')[0]}` : ''}`,
      )
    }
    if (out.length >= 5) break
  }
  return out
}
