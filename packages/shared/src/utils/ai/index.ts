import type { AIConfig } from '../../types'
import type { AIProvider } from './types'
import { LocalAIProvider } from './local'
import { RuleAIProvider } from './rule'
import { HybridAIProvider } from './hybrid'

export type { AIProvider, AIAction } from './types'
export { AI_ACTION_LABELS, AI_ACTION_ICONS, AI_PROMPTS } from './types'
export { LocalAIProvider } from './local'
export { RuleAIProvider } from './rule'
export { HybridAIProvider } from './hybrid'

/** Create a new AI provider instance with the given config */
export function getAIProvider(config?: AIConfig): AIProvider {
  const cfg = config ?? { enabled: false, apiUrl: 'http://localhost:11434', model: 'qwen2.5-coder:3b', protocol: 'ollama', autoTagging: false }
  if (cfg.strategy === 'hybrid') {
    return new HybridAIProvider(cfg)
  }
  if (cfg.strategy === 'offline') {
    return new RuleAIProvider(cfg)
  }
  return new LocalAIProvider(cfg)
}

/** Reset for testing (no-op, kept for compat) */
export function resetAIProvider(): void {}

/** Process text with AI using given config */
export async function streamAI(
  config: AIConfig,
  action: import('./types').AIAction,
  text: string,
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: string) => void,
): Promise<void> {
  if (!config.enabled) {
    onError('AI not enabled')
    return
  }
  const provider = getAIProvider(config)
  try {
    const fullText = await provider.processText(action, text, onChunk)
    onDone(fullText)
  } catch (err: unknown) {
    onError(err instanceof Error ? err.message : String(err))
  }
}
