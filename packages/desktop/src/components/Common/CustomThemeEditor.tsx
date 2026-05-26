import React, { useState } from 'react'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n'
import type { CustomTheme } from '../../types'

const CustomThemeEditor: React.FC = () => {
  const { t } = useTranslation()
  const savedThemes = useStore(s => s.savedThemes)
  const activeThemeId = useStore(s => s.activeThemeId)
  const saveTheme = useStore(s => s.saveTheme)
  const deleteTheme = useStore(s => s.deleteTheme)
  const setActiveTheme = useStore(s => s.setActiveTheme)
  const panelColor = useStore(s => s.panel.color)

  const [showEditor, setShowEditor] = useState(false)
  const [name, setName] = useState('')
  const [colors, setColors] = useState<CustomTheme['colors']>({
    panelBg: 'rgba(22,22,32,0.7)',
    panelBgSolid: 'rgba(18,18,28,0.96)',
    textPrimary: 'rgba(255,255,255,0.87)',
    textSecondary: 'rgba(255,255,255,0.65)',
    accent: '#60a5fa',
    borderColor: 'rgba(255,255,255,0.05)',
    bodyBg: '#0c0c10',
  })
  const [savedFeedback, setSavedFeedback] = useState(false)

  const handleSave = () => {
    if (!name.trim()) return
    saveTheme(name.trim(), colors)
    setName('')
    setSavedFeedback(true)
    setTimeout(() => setSavedFeedback(false), 2000)
  }

  const startNew = () => {
    setColors({
      panelBg: panelColor ? `${panelColor}40` : 'rgba(22,22,32,0.7)',
      panelBgSolid: panelColor ? `${panelColor}80` : 'rgba(18,18,28,0.96)',
      textPrimary: 'rgba(255,255,255,0.87)',
      textSecondary: 'rgba(255,255,255,0.65)',
      accent: panelColor || '#60a5fa',
      borderColor: panelColor ? `${panelColor}40` : 'rgba(255,255,255,0.05)',
      bodyBg: '#0c0c10',
    })
    setName('')
    setShowEditor(true)
  }

  const loadTheme = (theme: CustomTheme) => {
    setActiveTheme(theme.id)
    setShowEditor(false)
  }

  const colorFields: { key: keyof CustomTheme['colors']; label: string }[] = [
    { key: 'panelBg', label: t('settings.panelBg') },
    { key: 'textPrimary', label: t('settings.textPrimary') },
    { key: 'accent', label: t('settings.accent') },
    { key: 'borderColor', label: t('settings.borderColor') },
    { key: 'bodyBg', label: t('settings.bodyBg') },
  ]

  return (
    <div className="border-t border-white/[0.06] pt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-white/72">{t('settings.customTheme')}</span>
        {!showEditor && (
          <button onClick={startNew}
            className="text-[9px] px-2 py-0.5 rounded-lg text-fluent-blue hover:bg-fluent-blue/[0.08] transition-colors">
            + {t('settings.createCustom')}
          </button>
        )}
      </div>

      {/* Saved themes list */}
      {!showEditor && savedThemes.length > 0 && (
        <div className="flex flex-col gap-1 mb-1.5 max-h-[100px] overflow-y-auto">
          {savedThemes.map(theme => (
            <div key={theme.id}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
                activeThemeId === theme.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
              }`}>
              <button onClick={() => loadTheme(theme)}
                className="flex-1 text-[10px] text-left text-white/80 truncate">
                {theme.name}
              </button>
              <button onClick={() => deleteTheme(theme.id)}
                className="text-[8px] text-white/30 hover:text-red-400/60 transition-colors">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Active theme indicator */}
      {activeThemeId && !showEditor && (
        <button onClick={() => setActiveTheme(null)}
          className="text-[9px] px-2 py-0.5 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors w-full text-left">
          {t('settings.resetTheme')}
        </button>
      )}

      {/* Theme editor */}
      {showEditor && (
        <div className="flex flex-col gap-2">
          <input type="text" value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('settings.themeName')}
            className="w-full text-[10px] px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/80 placeholder-white/30 outline-none focus:border-white/[0.12] transition-colors"
          />
          <div className="flex flex-col gap-1.5">
            {colorFields.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[9px] text-white/50 w-14 flex-shrink-0">{label}</span>
                <input type="color" value={toHex(colors[key])}
                  onChange={e => setColors(c => ({ ...c, [key]: e.target.value }))}
                  className="w-5 h-5 rounded border-0 cursor-pointer flex-shrink-0" style={{ background: 'none' }} />
                <input type="text" value={colors[key]}
                  onChange={e => setColors(c => ({ ...c, [key]: e.target.value }))}
                  className="flex-1 text-[9px] px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.04] text-white/60 font-mono outline-none focus:border-white/[0.1] transition-colors"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave}
              className="flex-1 text-[9px] px-2 py-1 rounded-lg bg-fluent-blue/15 text-fluent-blue hover:bg-fluent-blue/20 transition-colors"
              disabled={!name.trim()}>
              {savedFeedback ? t('settings.themeSaved') : t('settings.saveTheme')}
            </button>
            <button onClick={() => setShowEditor(false)}
              className="text-[9px] px-2 py-1 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function toHex(rgba: string): string {
  // If already hex, return as-is
  if (rgba.startsWith('#')) return rgba
  // Parse rgba(r,g,b,a) or rgb(r,g,b)
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (m) {
    const r = parseInt(m[1]).toString(16).padStart(2, '0')
    const g = parseInt(m[2]).toString(16).padStart(2, '0')
    const b = parseInt(m[3]).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }
  return '#3b82f6'
}

export default CustomThemeEditor
