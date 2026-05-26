import React from 'react'
import type { HuangliData } from '../../utils/astrology'

interface HuangliPanelProps {
  huangli: HuangliData
  collapsed: boolean
  onToggle: () => void
}

const HuangliPanel: React.FC<HuangliPanelProps> = ({ huangli, collapsed, onToggle }) => {
  return (
    <div className="mt-2 pt-2 border-t border-white/[0.04]">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 w-full text-left"
      >
        <i className={`fa-solid fa-chevron-${collapsed ? 'right' : 'down'} text-[8px]`}
          style={{ color: 'var(--text-muted)' }} />
        <span className="text-[9px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          黄历
        </span>
        {huangli.jieQi && (
          <span className="text-[9px] text-amber-400 ml-1">
            · {huangli.jieQi}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="mt-1.5 space-y-1 text-[9px] leading-relaxed">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: 'var(--text-secondary)' }}>
            <span>{huangli.lunar.fullDate}</span>
            <span>{huangli.ganzhi.year}年【{huangli.shengxiao.year}年】</span>
            <span>{huangli.ganzhi.month}月{huangli.ganzhi.day}日</span>
            <span>纳音 {huangli.naYin}</span>
          </div>

          <div style={{ color: 'var(--text-secondary)' }}>
            {huangli.weekDay} · 冲{huangli.chongSha.chong} 煞{huangli.chongSha.sha}
          </div>

          <div className="flex flex-wrap gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span>{huangli.xiu.name}（{huangli.xiu.animal}）{huangli.xiu.luck}</span>
            {huangli.jianChu && (
              <span>建除: {huangli.jianChu}（{huangli.jianChuLuck}）</span>
            )}
          </div>

          {huangli.festivals.length + huangli.otherFestivals.length > 0 && (
            <div className="flex flex-wrap gap-x-3" style={{ color: 'var(--text-secondary)' }}>
              <span>节日: {[...huangli.festivals, ...huangli.otherFestivals].join('、')}</span>
            </div>
          )}

          <div className="italic" style={{ color: 'var(--text-muted)' }}>
            {huangli.pengZu}
          </div>

          <div className="flex flex-wrap gap-x-3" style={{ color: 'var(--text-secondary)' }}>
            <span>喜神: {huangli.fangwei.xi}</span>
            <span>财神: {huangli.fangwei.cai}</span>
            <span>福神: {huangli.fangwei.fu}</span>
          </div>

          <div className="flex flex-wrap items-start gap-1">
            <span className="text-green-400/80 font-medium shrink-0">宜</span>
            <div className="flex flex-wrap gap-1">
              {huangli.yiJi.yi.map((item, i) => (
                <span key={i}
                  className="px-1.5 py-0.5 rounded text-[8px] leading-tight"
                  style={{ background: 'rgba(34,197,94,0.1)', color: 'rgba(34,197,94,0.8)' }}
                >{item}</span>
              ))}
              {huangli.yiJi.yi.length === 0 && (
                <span className="text-white/30 text-[8px]">无</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-1">
            <span className="text-red-400/80 font-medium shrink-0">忌</span>
            <div className="flex flex-wrap gap-1">
              {huangli.yiJi.ji.map((item, i) => (
                <span key={i}
                  className="px-1.5 py-0.5 rounded text-[8px] leading-tight"
                  style={{ background: 'rgba(239,68,68,0.1)', color: 'rgba(239,68,68,0.8)' }}
                >{item}</span>
              ))}
              {huangli.yiJi.ji.length === 0 && (
                <span className="text-white/30 text-[8px]">无</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HuangliPanel
