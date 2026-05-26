import React, { useState, useMemo } from 'react'
import { QIMEN_DOMAINS, QimenDomain } from '../../types'
import type { QimenEvent } from '../../types'
import { getFengshuiAdvice } from '../../utils/astrology/fengshui'
import { useCompass } from '../../hooks/useCompass'
import CompassWidget from './CompassWidget'

const ei = window.electronAPI as ElectronAPI | undefined
const isElectron = !!ei

/* ── 奇门分析结果类型 ── */
interface QimenAnalysis {
  dunType: string
  juNumber: number
  luckyDirection: string
  bestTimes: { label: string; range: string }[]
  luckyColors: string[]
  assessment: string
  strategy: string
  palace: string
}

interface QimenPanelProps {
  initialEvent?: QimenEvent | null
  t: (key: string, params?: Record<string, string | number>) => string
  onCreateTodo?: (event: QimenEvent, analysis: QimenAnalysis) => void
}

type PanelMode = 'select' | 'result'

/* ── 模拟奇门分析（后续替换为真实计算） ── */
function generateAnalysis(domain: QimenDomain, scenario: string | null, _description: string): QimenAnalysis {
  const daySeed = Math.abs(Math.floor(Date.now() / (1000 * 60 * 60 * 24)))

  // 根据 domain + 日期种子生成方位偏移
  const directions = ['正东', '正南', '正西', '正北', '东南', '西南', '西北', '东北']
  const dirIdx = (daySeed + domain.length) % directions.length

  // domain 模板
  const templates: Record<QimenDomain, {
    dun: string; ju: number; palace: string;
    dirOffset: number; timeBlock: number;
    colorSet: string[];
    assessPool: string[];
    strategyPool: string[];
  }> = {
    career: {
      dun: '阳遁', ju: 3 + daySeed % 6, palace: '离宫（火）',
      dirOffset: 0, timeBlock: 3,
      colorSet: ['#1a6bff', '#ffffff', '#e8d5b5'],
      assessPool: [
        '吉 — 开门临宫，朱雀腾飞，主面试顺利，口才出众。',
        '中吉 — 休门到位，贵人运强，适合主动沟通。',
        '大吉 — 生门当值，事业有突破性进展。',
      ],
      strategyPool: [
        '提前到场，面朝吉方就座。沟通时着重展示过往成果。避免背对凶方。',
        '选择吉时出发，携带与吉色相符的配饰。谈判中多用数据说话。',
        '主动出击但留有余地。注意对方在申时后可能提出的附加条件。',
      ],
    },
    wealth: {
      dun: '阳遁', ju: 6 + daySeed % 3, palace: '乾宫（金）',
      dirOffset: 2, timeBlock: 5,
      colorSet: ['#8b5cf6', '#f59e0b', '#ffffff'],
      assessPool: [
        '大吉 — 生门临乾宫，天时地利，求财顺利。',
        '吉 — 休门合财星，正财偏财皆有收获。',
        '中吉 — 开门通畅，但需注意合作方诚信。',
      ],
      strategyPool: [
        '签约安排在吉时，面朝吉方。合同文本用紫色/金色。注意查看金额相关条款。',
        '投资宜谨慎，选择吉方位的项目。避免在煞方进行大额交易。',
        '追债宜在吉时上门，面朝吉方谈判，言辞有力但留余地。',
      ],
    },
    relationship: {
      dun: '阴遁', ju: 2 + daySeed % 7, palace: '震宫（木）',
      dirOffset: 4, timeBlock: 1,
      colorSet: ['#ec4899', '#fef3c7', '#ffffff'],
      assessPool: [
        '吉 — 六合临宫，姻缘和合，沟通顺畅。',
        '中吉 — 太阴相助，宜含蓄表达，不宜急躁。',
        '平和 — 感情之事需顺其自然，今日宜静不宜动。',
      ],
      strategyPool: [
        '选择吉时见面，面朝吉方。穿着柔和色系，避免深色。',
        '约会地点选在吉方位，用餐时坐在有利位置。',
        '沟通中多倾听，少争辩。适合赠送小礼物增进感情。',
      ],
    },
    travel: {
      dun: '阳遁', ju: 9 - daySeed % 3, palace: '坤宫（土）',
      dirOffset: 6, timeBlock: 2,
      colorSet: ['#f59e0b', '#ffffff', '#0ea5e9'],
      assessPool: [
        '吉 — 生门临坤宫，出行顺利，路上有贵人相助。',
        '大吉 — 开门大吉，长途出行平安顺遂。',
        '中吉 — 途中或有小波折，但终将顺利抵达。',
      ],
      strategyPool: [
        '上午出发为佳，向吉方启程。随身携带黄色或白色物品。',
        '检查行李中是否有违禁物品。自驾忌走煞方道路。',
        '预订吉方位的住宿。途中注意保管财物。',
      ],
    },
    study: {
      dun: '阴遁', ju: 4 + daySeed % 5, palace: '坎宫（水）',
      dirOffset: 7, timeBlock: 0,
      colorSet: ['#0ea5e9', '#a78bfa', '#ecfdf5'],
      assessPool: [
        '吉 — 景门临宫，文思泉涌，考试/面试发挥出色。',
        '大吉 — 天辅星当值，学业运势极佳。',
        '中吉 — 虽有压力但能克服，保持平常心。',
      ],
      strategyPool: [
        '考试/面试前在吉方位静心片刻。携带蓝色配饰。',
        '答题时先易后难，把握节奏。面朝吉方就座。',
        '择校/择专业宜咨询吉方方位的意见。',
      ],
    },
    life: {
      dun: '阳遁', ju: 5 + daySeed % 4, palace: '艮宫（土）',
      dirOffset: 5, timeBlock: 4,
      colorSet: ['#059669', '#3b82f6', '#fef3c7'],
      assessPool: [
        '吉 — 休门临宫，平稳顺利，事宜有成。',
        '中吉 — 九地加持，宜守不宜攻。',
        '平和 — 小事可成，大事需再择吉日。',
      ],
      strategyPool: [
        '选择吉时出发，朝吉方行事。穿着绿色或蓝色。',
        '诉讼/维权宜在吉时提交材料，面朝吉方陈述。',
        '求医选择吉时，朝吉方方位前往医院。',
      ],
    },
    other: {
      dun: '阳遁', ju: 1 + daySeed % 8, palace: '中宫（土）',
      dirOffset: 3, timeBlock: 3,
      colorSet: ['#8b5cf6', '#f59e0b', '#ffffff'],
      assessPool: [
        '吉 — 诸事可行，但需注意细节。',
        '中吉 — 顺势而为，不宜强求。',
        '平和 — 今日普通，宜按计划行事。',
      ],
      strategyPool: [
        '选择吉时行事，面朝吉方。穿着吉色衣物。',
        '事宜提前规划，留有缓冲时间。',
        '注意人际关系，避免口舌之争。',
      ],
    },
  }

  const tmpl = templates[domain]
  const luckyDir = directions[(dirIdx + tmpl.dirOffset) % directions.length]

  // 时辰
  const timeSlots = [
    { label: '子时', range: '23:00-01:00' },
    { label: '丑时', range: '01:00-03:00' },
    { label: '寅时', range: '03:00-05:00' },
    { label: '卯时', range: '05:00-07:00' },
    { label: '辰时', range: '07:00-09:00' },
    { label: '巳时', range: '09:00-11:00' },
    { label: '午时', range: '11:00-13:00' },
    { label: '未时', range: '13:00-15:00' },
    { label: '申时', range: '15:00-17:00' },
    { label: '酉时', range: '17:00-19:00' },
    { label: '戌时', range: '19:00-21:00' },
    { label: '亥时', range: '21:00-23:00' },
  ]
  const t1 = timeSlots[tmpl.timeBlock % 12]
  const t2 = timeSlots[(tmpl.timeBlock + 3) % 12]

  const assess = tmpl.assessPool[daySeed % tmpl.assessPool.length]
  const strategy = tmpl.strategyPool[daySeed % tmpl.strategyPool.length] +
    (scenario ? ` 针对「${domainLabels[domain]}·${scenarioLabels[scenario] || scenario}」事项，以上建议请结合实际情况灵活运用。` : '')

  return {
    dunType: tmpl.dun,
    juNumber: tmpl.ju,
    luckyDirection: luckyDir,
    bestTimes: [t1, t2],
    luckyColors: tmpl.colorSet,
    assessment: assess,
    strategy,
    palace: tmpl.palace,
  }
}

const domainLabels: Record<string, string> = {
  career: '事业', wealth: '求财', relationship: '感情',
  travel: '出行', study: '学业', life: '生活', other: '其他',
}
const scenarioLabels: Record<string, string> = {
  jobInterview: '面试', salary: '谈薪', signing: '签约',
  bid: '竞标', promotion: '升职', startup: '创业', team: '团队管理',
  invest: '投资', debt: '追债', cooperate: '合作', stock: '股票', project: '项目',
  date: '约会', matchmake: '相亲', marry: '婚姻', reconcile: '和解',
  travel: '远行', move: '搬家', abroad: '出国', drive: '自驾',
  exam: '考试', schoolInterview: '面试', school: '择校', defense: '答辩',
  find: '寻物', lawsuit: '诉讼', medical: '求医', renovate: '装修', meeting: '重要会面',
}

const QimenPanel: React.FC<QimenPanelProps> = ({ initialEvent, t, onCreateTodo }) => {
  const [mode, setMode] = useState<PanelMode>('select')
  const [domain, setDomain] = useState<QimenDomain | null>(initialEvent?.domain ?? null)
  const [scenario, setScenario] = useState<string | null>(initialEvent?.scenario ?? null)
  const [description, setDescription] = useState(initialEvent?.description ?? '')
  const [result, setResult] = useState<QimenAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFengshui, setShowFengshui] = useState(true)
  const compass = useCompass()

  // 轻量风水建议（基于奇门分析结果，结果未就绪时返回 null）
  const fengshuiAdvice = useMemo(() => {
    if (!result) return null
    return getFengshuiAdvice(domain || 'other', result.luckyDirection)
  }, [result, domain])

  const domainScenarios = useMemo(() => {
    if (!domain) return []
    return QIMEN_DOMAINS[domain]?.scenarios ?? []
  }, [domain])

  const handleAnalyze = async () => {
    if (!domain) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    const analysis = generateAnalysis(domain, scenario, description)
    setResult(analysis)
    setMode('result')
    setLoading(false)
  }

  const handleReset = () => {
    setMode('select')
    setResult(null)
  }

  // 从已有待办进入且有完整场景 → 自动推演（通过 key 保证组件重建）
  React.useEffect(() => {
    if (initialEvent?.scenario) {
      handleAnalyze()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ========== 选择模式 ========== */
  if (mode === 'select') {
    return (
      <div className="rounded-lg px-3 py-2 space-y-2"
        style={{
          background: 'rgba(139,92,246,0.06)',
          border: '1px solid rgba(139,92,246,0.15)',
        }}
      >
        {/* 标题 */}
        <div className="flex items-center gap-1">
          <i className="fa-solid fa-compass text-[10px]" style={{ color: '#c4b5fd' }} />
          <span className="text-[9px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('guidance.qimen')}
          </span>
          <span className="text-[8px]" style={{ color: 'var(--text-dim)' }}>
            · {t('guidance.qimenEntryTitle')}
          </span>
        </div>

        {/* 领域选择 */}
        <div>
          <div className="text-[8px] mb-1" style={{ color: 'var(--text-muted)' }}>
            {t('guidance.qimenSelectDomain')}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(Object.entries(QIMEN_DOMAINS) as [QimenDomain, typeof QIMEN_DOMAINS[QimenDomain]][]).map(([key, def]) => (
              <button
                key={key}
                onClick={() => { setDomain(key); setScenario(null) }}
                className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg transition-all text-[9px]"
                style={{
                  background: domain === key ? '#8b5cf6' : 'var(--hover-bg)',
                  color: domain === key ? '#fff' : 'var(--text-muted)',
                  border: domain === key ? 'none' : '1px solid var(--panel-border)',
                }}
              >
                <i className={`fa-solid ${def.icon} text-[11px]`} />
                <span>{t(`guidance.domain${key.charAt(0).toUpperCase() + key.slice(1)}` as string)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 场景选择 */}
        {domain && domainScenarios.length > 0 && (
          <div>
            <div className="text-[8px] mb-1" style={{ color: 'var(--text-muted)' }}>
              {t('guidance.qimenSelectScenario')}
            </div>
            <div className="flex flex-wrap gap-1">
              {domainScenarios.map(s => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className="px-1.5 py-0.5 rounded text-[8px] transition-all"
                  style={{
                    background: scenario === s ? 'rgba(139,92,246,0.25)' : 'var(--hover-bg)',
                    color: scenario === s ? '#c4b5fd' : 'var(--text-muted)',
                    border: scenario === s ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--panel-border)',
                  }}
                >
                  {t(`guidance.scenario${s.charAt(0).toUpperCase() + s.slice(1)}` as string)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 自由描述 */}
        <div>
          <div className="text-[8px] mb-1" style={{ color: 'var(--text-muted)' }}>
            {t('guidance.qimenDescribe')}
          </div>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('guidance.qimenPlaceholder')}
            className="w-full px-2 py-1 rounded-lg text-[9px] outline-none transition-all"
            style={{
              background: 'var(--hover-bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--panel-border)',
            }}
          />
        </div>

        {/* 开始推演 */}
        <button
          onClick={handleAnalyze}
          disabled={!domain || loading}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] transition-all disabled:opacity-40"
          style={{
            background: '#8b5cf6',
            color: '#fff',
          }}
        >
          {loading ? (
            <><i className="fa-solid fa-spinner animate-spin text-[10px]" />{t('guidance.qimenLoading')}</>
          ) : (
            <><i className="fa-solid fa-compass text-[10px]" />{t('guidance.qimenAnalyze')}</>
          )}
        </button>
      </div>
    )
  }

  /* ========== 结果模式 ========== */
  if (!result) return null

  return (
    <div className="rounded-lg px-3 py-2 space-y-2"
      style={{
        background: 'rgba(139,92,246,0.06)',
        border: '1px solid rgba(139,92,246,0.15)',
      }}
    >
      {/* 标题 + 重新推演 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            <i className="fa-solid fa-compass mr-1" />
            {t('guidance.qimen')}
          </span>
          {domain && (
            <span className="text-[8px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}
            >
              {t(`guidance.domain${domain.charAt(0).toUpperCase() + domain.slice(1)}` as string)}
              {scenario && scenarioLabels[scenario] && ` · ${scenarioLabels[scenario]}`}
            </span>
          )}
        </div>
        <button
          onClick={handleReset}
          className="text-[8px] px-1.5 py-0.5 rounded transition-all"
          style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}
        >
          <i className="fa-solid fa-rotate mr-0.5" />
          {t('guidance.qimenRerun')}
        </button>
      </div>

      {/* 局盘摘要 */}
      <div className="flex items-center gap-2 text-[8px]" style={{ color: 'var(--text-muted)' }}>
        <span>{result.dunType}{result.juNumber}局</span>
        <span>·</span>
        <span>用神落{result.palace}</span>
      </div>

      {/* 吉利方位 - 大字突出 */}
      <div className="rounded-lg px-2.5 py-1.5 text-center"
        style={{ background: 'rgba(139,92,246,0.1)' }}
      >
        <div className="text-[8px]" style={{ color: 'var(--text-muted)' }}>
          {t('guidance.qimenDirection')}
        </div>
        <div className="text-[16px] font-bold mt-0.5" style={{ color: '#c4b5fd' }}>
          <i className="fa-solid fa-location-arrow mr-1" />
          {result.luckyDirection}
        </div>
      </div>

      {/* 罗盘（移动端显示） */}
      {!isElectron && result.luckyDirection && (
        <div className="rounded-lg px-2.5 py-1.5"
          style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.08)' }}
        >
          <CompassWidget
            heading={compass.heading}
            luckyDirection={result.luckyDirection}
            permission={compass.permission}
            onRequestPermission={compass.permission === 'prompt' ? compass.requestPermission : undefined}
          />
        </div>
      )}

      {/* 最佳时辰 */}
      <div>
        <div className="text-[8px] mb-0.5" style={{ color: 'var(--text-muted)' }}>
          {t('guidance.qimenTime')}
        </div>
        <div className="flex gap-1 flex-wrap">
          {result.bestTimes.map((time, i) => (
            <span key={i}
              className="px-2 py-0.5 rounded text-[8px]"
              style={{ background: 'rgba(250,204,21,0.1)', color: '#fbbf24', border: '1px solid rgba(250,204,21,0.15)' }}
            >
              {time.label} {time.range}
            </span>
          ))}
        </div>
      </div>

      {/* 吉色 */}
      <div>
        <div className="text-[8px] mb-0.5" style={{ color: 'var(--text-muted)' }}>
          {t('guidance.qimenColor')}
        </div>
        <div className="flex gap-1 flex-wrap items-center">
          {result.luckyColors.map((c, i) => (
            <span key={i} className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded"
              style={{ background: c + '22', color: c }}
            >
              <span className="inline-block w-3 h-3 rounded-full border border-white/10" style={{ background: c }} />
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* 吉凶评估 */}
      <div className="rounded-lg px-2 py-1.5 text-[9px] leading-relaxed"
        style={{
          background: assessmentBg(result.assessment),
          color: assessmentColor(result.assessment),
        }}
      >
        <span className="block text-[8px] font-medium mb-0.5" style={{ opacity: 0.7 }}>
          {t('guidance.qimenAssessment')}
        </span>
        {result.assessment}
      </div>

      {/* 行动策略 */}
      <div className="rounded-lg px-2 py-1.5 text-[9px] leading-relaxed"
        style={{ background: 'rgba(139,92,246,0.08)', color: 'var(--text-secondary)' }}
      >
        <span className="block text-[8px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
          {t('guidance.qimenStrategy')}
        </span>
        {result.strategy}
      </div>

      {/* ── 阳宅参考（轻量风水） ── */}
      {fengshuiAdvice && (
        <div className="rounded-lg px-2 py-1.5 space-y-1"
          style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)' }}
        >
          <button
            onClick={() => setShowFengshui(v => !v)}
            className="flex items-center gap-1 w-full text-left"
          >
            <i className={`fa-solid fa-chevron-${showFengshui ? 'down' : 'right'} text-[8px] transition-transform`}
              style={{ color: 'var(--text-muted)' }} />
            <i className="fa-solid fa-house-chimney text-[9px]" style={{ color: '#4ade80' }} />
            <span className="text-[8px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              阳宅参考 · 风水布局
            </span>
          </button>
          {showFengshui && (
            <div className="space-y-1 text-[8px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              <div className="flex gap-1.5">
                <span className="shrink-0 w-3 text-center" style={{ color: '#4ade80' }}>→</span>
                <span>{fengshuiAdvice.deskOrientation}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="shrink-0 w-3 text-center" style={{ color: '#4ade80' }}>→</span>
                <span>{fengshuiAdvice.seatPlacement}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="shrink-0 w-3 text-center" style={{ color: '#4ade80' }}>→</span>
                <span>{fengshuiAdvice.enhancement}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="shrink-0 w-3 text-center" style={{ color: '#f87171' }}>✕</span>
                <span>{fengshuiAdvice.avoid}</span>
              </div>
              {fengshuiAdvice.extra && (
                <div className="flex gap-1.5">
                  <span className="shrink-0 w-3 text-center" style={{ color: '#4ade80' }}>→</span>
                  <span>{fengshuiAdvice.extra}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 创建待办 */}
      {onCreateTodo && domain && (
        <button
          onClick={() => onCreateTodo(
            { domain, scenario: scenario ?? undefined, description: description || undefined },
            result,
          )}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[8px] transition-all"
          style={{ background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', border: '1px dashed rgba(139,92,246,0.25)' }}
        >
          <i className="fa-solid fa-plus text-[9px]" />
          {t('guidance.qimenCreateTodo')}
        </button>
      )}

      {/* 底部提示 */}
      <div className="text-[7px] text-center italic" style={{ color: 'var(--text-dim)' }}>
        {t('guidance.qimenNote')}
      </div>
    </div>
  )
}

/* ── 评估颜色工具 ── */
function assessmentBg(text: string): string {
  if (text.includes('大吉')) return 'rgba(34,197,94,0.08)'
  if (text.includes('吉')) return 'rgba(34,197,94,0.05)'
  if (text.includes('中吉')) return 'rgba(250,204,21,0.06)'
  return 'rgba(239,68,68,0.06)'
}

function assessmentColor(text: string): string {
  if (text.includes('大吉')) return 'rgb(34,197,94)'
  if (text.includes('吉')) return 'rgb(74,222,128)'
  if (text.includes('中吉')) return 'rgb(250,204,21)'
  return 'rgb(239,68,68)'
}

export default QimenPanel
