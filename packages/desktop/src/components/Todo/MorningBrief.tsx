import React, { useState, useEffect, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n'
import { getHuangli, calculateBazi, getDailyGuidance, generateSummaryQuote } from '../../utils/astrology'
import { fetchWeather, getWeatherEmoji } from '../../utils/astrology/weather'
import type { WeatherData } from '../../utils/astrology/weather'
import { getFengshuiAdvice } from '../../utils/astrology/fengshui'
import { getAIGuidance } from '../../utils/astrology/ai-guidance'

const MorningBrief: React.FC = () => {
  const { t } = useTranslation()
  const todos = useStore(s => s.todos)
  const userProfile = useStore(s => s.userProfile)
  const aiConfig = useStore(s => s.aiConfig)
  const activeCat = useStore(s => s.activeCat)

  const [collapsed, setCollapsed] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [aiAdvice, setAiAdvice] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const today = useMemo(() => new Date(), [])

  // 黄历
  const huangli = useMemo(() => getHuangli(today), [today])

  // 八字
  const baziProfile = useMemo(() => {
    if (!userProfile?.birthDate) return null
    return calculateBazi(
      new Date(userProfile.birthDate),
      userProfile.birthHour ?? null,
      userProfile.gender ?? null,
    )
  }, [userProfile?.birthDate, userProfile?.birthHour, userProfile?.gender])

  // 每日指导
  const dailyGuidance = useMemo(() => {
    const list = activeCat === 'all' ? todos : todos.filter(t => t.category === activeCat)
    return getDailyGuidance(today, baziProfile, list)
  }, [today, baziProfile, todos, activeCat])

  // 天气：优先 GPS 定位 → 城市设置 → IP 自动
  useEffect(() => {
    let cancelled = false

    const doFetch = (location?: string) => {
      fetchWeather(location).then(w => { if (!cancelled) setWeather(w) }).catch((err: unknown) => {
        console.error('[weather] fetch failed:', err instanceof Error ? err.message : err)
      })
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!cancelled) doFetch(`${pos.coords.latitude},${pos.coords.longitude}`)
        },
        () => {
          // GPS 失败 → 用城市设置
          if (!cancelled) doFetch(userProfile?.city || undefined)
        },
        { timeout: 5000, enableHighAccuracy: false },
      )
    } else {
      doFetch(userProfile?.city || undefined)
    }

    return () => { cancelled = true }
  }, [userProfile?.city])

  // AI 建议（仅在生日信息已填时）
  useEffect(() => {
    if (!aiConfig.enabled || !huangli || !baziProfile) return
    let cancelled = false
    setAiLoading(true)
    getAIGuidance(today, huangli, baziProfile, todos.filter(t => !t.done), (chunk) => {
      if (!cancelled) setAiAdvice(chunk)
    }, aiConfig, weather).then(result => {
      if (!cancelled) setAiAdvice(result.text)
    }).catch((err: unknown) => {
      console.error('[astro] AI guidance failed:', err instanceof Error ? err.message : err)
    }).finally(() => {
      if (!cancelled) setAiLoading(false)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, huangli?.ganzhi?.day, weather?.temp, aiConfig?.enabled])

  const luckyDir = dailyGuidance?.advice?.luckyDirection ?? null
  const advice = dailyGuidance?.advice

  // 风水建议（基于今日吉方）
  const fengshuiTip = useMemo(() => {
    if (!luckyDir || !advice) return null
    return getFengshuiAdvice('life', luckyDir)
  }, [luckyDir, advice])

  const strength = baziProfile?.strength
  const missingElement = baziProfile?.missingElement

  // 天气 emoji
  const weatherEmoji = weather ? getWeatherEmoji(weather.iconCode) : null

  return (
    <div
      className="mb-2 rounded-lg border"
      style={{
        borderColor: 'var(--border-color, rgba(255,255,255,0.06))',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center gap-1.5 w-full text-left px-2.5 py-1.5"
      >
        <i className={`fa-solid fa-chevron-${collapsed ? 'right' : 'down'} text-[10px] transition-transform`}
          style={{ color: 'var(--text-muted)' }} />
        <i className="fa-solid fa-sun text-xs" style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {t('calendar.morningBrief')}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
          {today.getMonth() + 1}/{today.getDate()}
        </span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {/* 行1：农历 + 天气 */}
          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-dim)' }}>
            {huangli && (
              <span>
                {huangli.lunar.month}{huangli.lunar.day} · {huangli.ganzhi.year}年 {huangli.ganzhi.month}月 {huangli.ganzhi.day}日
                {huangli.shengxiao.year && ` · ${huangli.shengxiao.year}年`}
              </span>
            )}
            {weather && (
              <span className="flex items-center gap-0.5">
                <span>{weatherEmoji}</span>
                <span>{userProfile?.city || weather.city}</span>
                <span> · {weather.temp}°C {weather.condition}</span>
              </span>
            )}
          </div>

          {/* 行2：宜忌 + 冲煞 */}
          {huangli && (
            <div className="flex items-center gap-2 text-[11px] flex-wrap">
              {huangli.yiJi.yi.length > 0 && (
                <span><span style={{ color: '#4ade80' }}>宜</span> {huangli.yiJi.yi.slice(0, 4).join(' ')}</span>
              )}
              {huangli.yiJi.ji.length > 0 && (
                <span><span style={{ color: '#f87171' }}>忌</span> {huangli.yiJi.ji.slice(0, 4).join(' ')}</span>
              )}
              {huangli.chongSha && (
                <span style={{ color: 'var(--text-dim)' }}>冲{huangli.chongSha.chong} 煞{huangli.chongSha.sha}</span>
              )}
            </div>
          )}

          {/* 行3：八字 + 穿衣建议（含幸运色信息） */}
          {baziProfile && (
            <div className="flex items-center gap-2 text-[11px] flex-wrap" style={{ color: 'var(--text-dim)' }}>
              <span>{baziProfile.fourPillars.year} | {baziProfile.fourPillars.month} | {baziProfile.fourPillars.day}</span>
              {baziProfile.fourPillars.hour && <span>| {baziProfile.fourPillars.hour}</span>}
              <span>· 身{strength}</span>
              {missingElement && <span>· 缺{missingElement}</span>}
              {advice?.clothingAdvice && (
                <span>· {advice.clothingAdvice}</span>
              )}
            </div>
          )}

          {/* 行4：吉方 + 风水催旺 */}
          {luckyDir && fengshuiTip && (
            <div className="flex items-center gap-2 text-[11px] flex-wrap">
              <span className="flex items-center gap-0.5" style={{ color: '#c4b5fd' }}>
                <i className="fa-solid fa-location-arrow text-[7px]" />
                吉方 {luckyDir}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>{fengshuiTip.enhancement}</span>
            </div>
          )}

          {/* 行5：每日签语 */}
          {dailyGuidance && (() => {
            const quote = generateSummaryQuote(dailyGuidance, today.toDateString())
            return (
              <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-quote-left text-[7px] mr-0.5" style={{ opacity: 0.4 }} />
                {quote}
              </div>
            )
          })()}

          {/* 行6：AI 建议 */}
          {aiLoading && (
            <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-spinner animate-spin" />
              AI 分析中…
            </div>
          )}
          {aiAdvice && (
            <div
              className="rounded-lg px-3 py-2 text-[11px] leading-relaxed"
              style={{ background: 'rgba(96,165,250,0.08)', color: 'var(--text-muted)' }}
            >
              <span className="block text-[9px] font-medium mb-0.5" style={{ color: '#60a5fa' }}>
                <i className="fa-solid fa-robot mr-0.5" />AI 建议
              </span>
              {aiAdvice}
            </div>
          )}

          {/* 行7：待办统计 */}
          {dailyGuidance && dailyGuidance.todoStats.total > 0 && (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-dim)' }}>
              <span>{dailyGuidance.todoStats.total} 项 | {dailyGuidance.todoStats.done} 完成 | {dailyGuidance.todoStats.pending} 待办</span>
              {dailyGuidance.todoStats.overdue > 0 && <span style={{ color: '#f87171' }}>{dailyGuidance.todoStats.overdue} 过期</span>}
              {dailyGuidance.todoStats.highPriority > 0 && <span style={{ color: '#fbbf24' }}>{dailyGuidance.todoStats.highPriority} 高优先</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MorningBrief
