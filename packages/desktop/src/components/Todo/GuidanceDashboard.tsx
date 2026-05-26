import React, { useState } from 'react'
import { getWeatherEmoji } from '../../utils/astrology/weather'
import type { BaziProfile, DailyGuidance } from '../../utils/astrology'
import type { WeatherData } from '../../utils/astrology/weather'
import type { QimenEvent, TodoItem } from '../../types'
import GuidanceCard from './GuidanceCard'
import BaziPanel from './BaziPanel'
import QimenPanel from './QimenPanel'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}小时前`
  return `${Math.floor(h / 24)}天前`
}

interface GuidanceDashboardProps {
  dailyGuidance: DailyGuidance | null
  adviceView: 'advice' | 'bazi' | 'qimen'
  onAdviceViewChange: (view: 'advice' | 'bazi' | 'qimen') => void
  baziProfile: BaziProfile | null
  onOpenBaziSettings: () => void
  weather: WeatherData | null
  t: (key: string, params?: Record<string, string | number>) => string
  aiAdvice: string | null
  aiLoading: boolean
  aiError: string | null
  onAIAnalysis: () => void
  qimenEventId: string | null
  qimenContext: QimenEvent | null
  selectedTodos: TodoItem[]
  onCreateTodo: (event: QimenEvent) => void
  userProfile?: { city?: string }
  onSetCity?: (city: string) => void
}

const GuidanceDashboard: React.FC<GuidanceDashboardProps> = ({
  dailyGuidance, adviceView, onAdviceViewChange,
  baziProfile, onOpenBaziSettings,
  weather, t,
  aiAdvice, aiLoading, aiError, onAIAnalysis,
  qimenEventId, qimenContext, selectedTodos, onCreateTodo,
  userProfile, onSetCity,
}) => {
  const [editingCity, setEditingCity] = useState(false)
  const [cityInput, setCityInput] = useState('')
  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
      {/* 标题 + 视图切换 */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {t('guidance.title')}
        </span>
        <div className="flex rounded-lg overflow-hidden text-[9px] leading-none"
          style={{ background: 'var(--hover-bg)', border: '1px solid var(--panel-border)' }}
        >
          <button
            onClick={() => onAdviceViewChange('advice')}
            className="px-2 py-[3px] transition-all"
            style={{
              background: adviceView === 'advice' ? '#60a5fa' : 'transparent',
              color: adviceView === 'advice' ? '#fff' : 'var(--text-muted)',
            }}
          >
            {t('guidance.viewAdvice')}
          </button>
          <button
            onClick={() => baziProfile && onAdviceViewChange('bazi')}
            className="px-2 py-[3px] transition-all"
            style={{
              background: adviceView === 'bazi' ? '#60a5fa' : 'transparent',
              color: adviceView === 'bazi' ? '#fff' : 'var(--text-muted)',
              opacity: baziProfile ? 1 : 0.35,
            }}
          >
            {t('guidance.viewBazi')}
          </button>
          <button
            onClick={() => onAdviceViewChange('qimen')}
            className="px-2 py-[3px] transition-all"
            style={{
              background: adviceView === 'qimen' ? '#8b5cf6' : 'transparent',
              color: adviceView === 'qimen' ? '#fff' : 'var(--text-muted)',
            }}
          >
            <i className="fa-solid fa-compass mr-0.5" />
            {t('guidance.viewQimen')}
          </button>
        </div>
      </div>

      {/* 建议视图 */}
      {adviceView === 'advice' && dailyGuidance && (
        <>
          <GuidanceCard guidance={dailyGuidance} t={t} />

          {/* 天气 */}
          {weather && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[9px]"
              style={{ background: 'var(--hover-bg)', border: '1px solid var(--panel-border)' }}
            >
              <span className="text-[14px]">{getWeatherEmoji(weather.iconCode)}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{weather.temp}°C</span>
              <span style={{ color: 'var(--text-muted)' }}>{weather.condition}</span>
              <span style={{ color: 'var(--text-dim)' }}>{timeAgo(weather.fetchedAt)}</span>
              <span className="ml-auto flex items-center gap-1" style={{ color: 'var(--text-dim)' }}>
                <i className="fa-solid fa-location-dot mr-0.5" />
                {editingCity ? (
                  <>
                    <input
                      value={cityInput}
                      onChange={e => setCityInput(e.target.value)}
                      onBlur={() => {
                        if (cityInput.trim()) onSetCity?.(cityInput.trim())
                        setEditingCity(false)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (cityInput.trim()) onSetCity?.(cityInput.trim())
                          setEditingCity(false)
                        }
                        if (e.key === 'Escape') setEditingCity(false)
                      }}
                      placeholder={t('guidance.cityPlaceholder')}
                      className="w-16 px-1 py-0.5 rounded text-[9px] outline-none"
                      style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)', border: '1px solid var(--panel-border)' }}
                      autoFocus
                    />
                    <button onClick={() => setEditingCity(false)} className="text-[8px] opacity-60 hover:opacity-100 transition-opacity">
                      <i className="fa-solid fa-check" />
                    </button>
                  </>
                ) : (
                  <>
                    <span>{userProfile?.city || weather.city}</span>
                    <button
                      onClick={() => { setCityInput(userProfile?.city || weather.city || ''); setEditingCity(true) }}
                      className="text-[8px] opacity-40 hover:opacity-80 transition-opacity"
                      title={t('common.edit')}
                    >
                      <i className="fa-solid fa-pen" />
                    </button>
                  </>
                )}
              </span>
            </div>
          )}

          {/* AI 综合分析 */}
          <div className="space-y-1">
            {!aiAdvice && !aiLoading && !aiError && (
              <button
                onClick={onAIAnalysis}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] transition-all"
                style={{
                  background: 'var(--hover-bg)',
                  color: 'var(--text-muted)',
                  border: '1px dashed var(--panel-border)',
                }}
              >
                <i className="fa-solid fa-wand-magic-sparkles text-[10px]" />
                {t('guidance.aiAnalysis')}
              </button>
            )}

            {aiLoading && (
              <div className="flex items-center gap-2 px-2 py-2 rounded-lg text-[9px]"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}
              >
                <i className="fa-solid fa-spinner animate-spin text-[10px]" />
                {t('guidance.aiLoading')}
              </div>
            )}

            {aiAdvice && (
              <div className="px-2.5 py-2 rounded-lg text-[9px] leading-relaxed space-y-1"
                style={{
                  background: 'rgba(96,165,250,0.06)',
                  border: '1px solid rgba(96,165,250,0.15)',
                  color: 'var(--text-secondary)',
                }}
              >
                <div className="flex items-center gap-1 text-[8px] mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <i className="fa-solid fa-wand-magic-sparkles" />
                  <span>AI</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{aiAdvice}</div>
              </div>
            )}

            {aiError && (
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg text-[9px]"
                style={{ background: 'rgba(239,68,68,0.08)', color: 'rgb(239,68,68)' }}
              >
                <span>{t('guidance.aiError')}</span>
                <button
                  onClick={onAIAnalysis}
                  className="px-1.5 py-0.5 rounded text-[8px]"
                  style={{ background: 'rgba(239,68,68,0.15)' }}
                >
                  {t('guidance.aiRetry')}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* 命理视图 */}
      {adviceView === 'bazi' && baziProfile && (
        <BaziPanel bazi={baziProfile} onEdit={onOpenBaziSettings} t={t} />
      )}

      {/* 奇门遁甲视图 — 用 display:none 保持组件状态 */}
      <div style={{ display: adviceView === 'qimen' ? 'block' : 'none' }}>
        <QimenPanel
          key={qimenEventId ?? 'quick'}
          initialEvent={qimenContext ?? (qimenEventId ? selectedTodos.find(t => t.id === qimenEventId)?.qimenEvent : null)}
          t={t}
          onCreateTodo={onCreateTodo}
        />
      </div>

      {/* 未设置八字：提示行（非奇门视图时隐藏）*/}
      {!baziProfile && adviceView !== 'qimen' && (
        <div className="flex items-center justify-between px-2 py-2 rounded-lg"
          style={{ background: 'var(--hover-bg)' }}
        >
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {t('guidance.noBazi')}
          </span>
          <button
            onClick={onOpenBaziSettings}
            className="text-[9px] px-2 py-1 rounded-lg transition-all"
            style={{ background: '#60a5fa', color: '#fff' }}
          >
            {t('guidance.setBazi')}
          </button>
        </div>
      )}
    </div>
  )
}

export default GuidanceDashboard
