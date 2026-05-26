import { describe, it, expect, beforeEach } from 'vitest'
import { applyCustomTheme } from '../customTheme'
import type { CustomTheme } from '../../types'

describe('applyCustomTheme', () => {
  const mockTheme: CustomTheme = {
    id: 'test-1',
    name: '测试主题',
    createdAt: Date.now(),
    colors: {
      panelBg: '#1e1e2e',
      panelBgSolid: '#2a2a3e',
      textPrimary: '#ffffff',
      textSecondary: '#a0a0b0',
      accent: '#7c3aed',
      borderColor: '#3a3a4e',
      bodyBg: '#0f0f1a',
    },
  }

  beforeEach(() => {
    document.documentElement.style.cssText = ''
  })

  it('sets CSS variables on document root when theme is provided', () => {
    applyCustomTheme(mockTheme)

    const root = document.documentElement
    expect(root.style.getPropertyValue('--panel-bg')).toBe('#1e1e2e')
    expect(root.style.getPropertyValue('--panel-bg-solid')).toBe('#2a2a3e')
    expect(root.style.getPropertyValue('--text-primary')).toBe('#ffffff')
    expect(root.style.getPropertyValue('--text-secondary')).toBe('#a0a0b0')
    expect(root.style.getPropertyValue('--panel-border')).toBe('#3a3a4e')
    expect(root.style.getPropertyValue('--panel-border-accent')).toBe('#3a3a4e')
    expect(root.style.getPropertyValue('--body-bg')).toBe('#0f0f1a')
  })

  it('sets derived CSS variables', () => {
    applyCustomTheme(mockTheme)

    const root = document.documentElement
    expect(root.style.getPropertyValue('--input-bg')).toBe('#3a3a4e')
    expect(root.style.getPropertyValue('--hover-bg')).toBe('#3a3a4e')
    expect(root.style.getPropertyValue('--separator')).toBe('#3a3a4e')
  })

  it('clears all overrides when theme is null', () => {
    // Set some variables first
    const root = document.documentElement
    root.style.setProperty('--panel-bg', '#ff0000')
    root.style.setProperty('--text-primary', '#ff0000')
    root.style.setProperty('--body-bg', '#ff0000')

    applyCustomTheme(null)

    expect(root.style.getPropertyValue('--panel-bg')).toBe('')
    expect(root.style.getPropertyValue('--text-primary')).toBe('')
    expect(root.style.getPropertyValue('--text-secondary')).toBe('')
    expect(root.style.getPropertyValue('--panel-border')).toBe('')
    expect(root.style.getPropertyValue('--panel-border-accent')).toBe('')
    expect(root.style.getPropertyValue('--body-bg')).toBe('')
    expect(root.style.getPropertyValue('--input-bg')).toBe('')
    expect(root.style.getPropertyValue('--hover-bg')).toBe('')
    expect(root.style.getPropertyValue('--separator')).toBe('')
  })

  it('does not throw when called with null on clean root', () => {
    expect(() => applyCustomTheme(null)).not.toThrow()
  })

  it('handles theme with empty color strings', () => {
    const emptyTheme: CustomTheme = {
      id: 'empty',
      name: '空主题',
      createdAt: Date.now(),
      colors: {
        panelBg: '',
        panelBgSolid: '',
        textPrimary: '',
        textSecondary: '',
        accent: '',
        borderColor: '',
        bodyBg: '',
      },
    }

    expect(() => applyCustomTheme(emptyTheme)).not.toThrow()
    const root = document.documentElement
    expect(root.style.getPropertyValue('--panel-bg')).toBe('')
  })
})
