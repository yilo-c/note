import type { CustomTheme } from '../types'

/** Apply a custom theme by overriding standard CSS variables on document root */
export function applyCustomTheme(theme: CustomTheme | null) {
  const root = document.documentElement

  if (!theme) {
    // Remove overrides so standard theme/background rules take effect
    clearOverrides(root)
    return
  }

  const { colors } = theme
  root.style.setProperty('--panel-bg', colors.panelBg)
  root.style.setProperty('--panel-bg-solid', colors.panelBgSolid)
  root.style.setProperty('--text-primary', colors.textPrimary)
  root.style.setProperty('--text-secondary', colors.textSecondary)
  root.style.setProperty('--panel-border', colors.borderColor)
  root.style.setProperty('--panel-border-accent', colors.borderColor)
  root.style.setProperty('--body-bg', colors.bodyBg)

  // Derived colors
  root.style.setProperty('--input-bg', colors.borderColor)
  root.style.setProperty('--hover-bg', colors.borderColor)
  root.style.setProperty('--separator', colors.borderColor)
}

function clearOverrides(root: HTMLElement) {
  const vars = [
    '--panel-bg', '--panel-bg-solid', '--text-primary', '--text-secondary',
    '--panel-border', '--panel-border-accent', '--body-bg',
    '--input-bg', '--hover-bg', '--separator',
  ]
  for (const v of vars) {
    root.style.removeProperty(v)
  }
}
