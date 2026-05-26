import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { getAIProvider } from '../../utils/ai'
import { useTranslation } from '../../i18n'

interface Props {
  onClose: () => void
}

const AISettingsPanel: React.FC<Props> = ({ onClose }) => {
  const aiConfig = useStore(s => s.aiConfig)
  const setAIConfig = useStore(s => s.setAIConfig)
  const { t } = useTranslation()

  const [enabled, setEnabled] = useState(aiConfig.enabled)
  const [protocol, setProtocol] = useState(aiConfig.protocol || 'ollama')
  const [apiUrl, setApiUrl] = useState(aiConfig.apiUrl)
  const [apiKey, setApiKey] = useState(aiConfig.apiKey || '')
  const [model, setModel] = useState(aiConfig.model)
  const [autoTagging, setAutoTagging] = useState(aiConfig.autoTagging || false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null)

  const handleSave = useCallback(() => {
    setAIConfig({
      enabled,
      protocol: protocol as 'ollama' | 'openai',
      apiUrl,
      apiKey: apiKey || undefined,
      model,
      autoTagging,
    })
    // Sync provider singleton
    getAIProvider({
      enabled,
      protocol: protocol as 'ollama' | 'openai',
      apiUrl,
      apiKey: apiKey || undefined,
      model,
      autoTagging,
    })
    onClose()
  }, [enabled, protocol, apiUrl, apiKey, model, autoTagging, setAIConfig, onClose])

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const provider = getAIProvider({
        enabled: true,
        protocol: protocol as 'ollama' | 'openai',
        apiUrl,
        apiKey: apiKey || undefined,
        model,
        autoTagging: false,
      })
      await provider.processText('continue', 'Hello', () => {})
      setTestResult('success')
    } catch {
      setTestResult('failed')
    } finally {
      setTesting(false)
    }
  }, [protocol, apiUrl, apiKey, model])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10002] flex items-center justify-center"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        className="relative w-[420px] max-w-[90vw] flex flex-col rounded-2xl shadow-2xl overflow-hidden border"
        style={{
          background: 'var(--panel-bg-solid)',
          borderColor: 'var(--panel-border-accent)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--separator)' }}>
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-robot text-xs" style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('ai.settings.title')}</span>
          </div>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg transition-all text-xs"
            style={{ color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3 p-4 overflow-y-auto" style={{ maxHeight: '65vh' }}>
          {/* AI Enable Toggle */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'var(--hover-bg)' }}>
            <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{t('ai.settings.enable')}</span>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-9 h-5 rounded-full transition-all ${enabled ? 'bg-fluent-blue' : 'bg-white/[0.10]'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-4' : 'left-0.5'}`} />
            </button>
          </div>

          {enabled && (
            <>
              {/* Protocol Selector */}
              <div className="flex flex-col gap-1.5 px-3 py-2 rounded-xl" style={{ background: 'var(--hover-bg)' }}>
                <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{t('ai.settings.protocol')}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setProtocol('ollama')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] transition-all ${
                      protocol === 'ollama'
                        ? 'bg-fluent-blue/15 text-fluent-blue'
                        : 'text-white/52 hover:text-white/72 hover:bg-white/[0.04]'
                    }`}
                  >
                    {t('ai.settings.ollama')}
                  </button>
                  <button
                    onClick={() => setProtocol('openai')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] transition-all ${
                      protocol === 'openai'
                        ? 'bg-fluent-blue/15 text-fluent-blue'
                        : 'text-white/52 hover:text-white/72 hover:bg-white/[0.04]'
                    }`}
                  >
                    {t('ai.settings.openai')}
                  </button>
                </div>
              </div>

              {/* API URL */}
              <div className="flex flex-col gap-1 px-3 py-2 rounded-xl" style={{ background: 'var(--hover-bg)' }}>
                <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{t('ai.settings.apiUrl')}</span>
                <input
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  className="w-full bg-transparent border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs outline-none transition-all focus:border-fluent-blue/40"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder={protocol === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1'}
                />
              </div>

              {/* API Key (OpenAI only) */}
              {protocol === 'openai' && (
                <div className="flex flex-col gap-1 px-3 py-2 rounded-xl" style={{ background: 'var(--hover-bg)' }}>
                  <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{t('ai.settings.apiKey')}</span>
                  <input
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    type="password"
                    className="w-full bg-transparent border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs outline-none transition-all focus:border-fluent-blue/40"
                    style={{ color: 'var(--text-primary)' }}
                    placeholder="sk-..."
                  />
                </div>
              )}

              {/* Model */}
              <div className="flex flex-col gap-1 px-3 py-2 rounded-xl" style={{ background: 'var(--hover-bg)' }}>
                <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{t('ai.settings.model')}</span>
                <input
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full bg-transparent border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs outline-none transition-all focus:border-fluent-blue/40"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder={protocol === 'ollama' ? 'qwen2.5-coder:3b' : 'gpt-4o-mini'}
                />
              </div>

              {/* Auto Tagging Toggle */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'var(--hover-bg)' }}>
                <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{t('ai.settings.autoTagging')}</span>
                <button
                  onClick={() => setAutoTagging(!autoTagging)}
                  className={`relative w-9 h-5 rounded-full transition-all ${autoTagging ? 'bg-fluent-blue' : 'bg-white/[0.10]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${autoTagging ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Test Connection */}
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] transition-all border border-white/[0.06] hover:bg-white/[0.04] disabled:opacity-40"
                style={{ color: 'var(--text-secondary)' }}
              >
                {testing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-fluent-blue/30 border-t-fluent-blue rounded-full animate-spin" />
                    {t('ai.settings.testing')}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plug text-[10px]" />
                    {t('ai.settings.testConnection')}
                  </>
                )}
              </button>

              {/* Test Result */}
              {testResult === 'success' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-400/10 border border-green-400/20">
                  <i className="fa-solid fa-circle-check text-[10px] text-green-400" />
                  <span className="text-[10px] text-green-400/80">{t('ai.settings.testSuccess')}</span>
                </div>
              )}
              {testResult === 'failed' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-400/10 border border-red-400/20">
                  <i className="fa-solid fa-circle-exclamation text-[10px] text-red-400" />
                  <span className="text-[10px] text-red-400/80">{t('ai.settings.testFailed')}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: 'var(--separator)' }}>
          <button onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[10px] transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            {t('common.cancel')}
          </button>
          <button onClick={handleSave}
            className="px-3 py-1.5 rounded-lg text-[10px] bg-fluent-blue/15 text-fluent-blue hover:bg-fluent-blue/20 transition-colors">
            {t('common.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default AISettingsPanel
