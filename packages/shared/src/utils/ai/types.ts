import type { AIConfig } from '../../types'

export type { AIConfig }

export type AIAction = 'continue' | 'summarize' | 'translate_zh' | 'translate_en' | 'polish' | 'organize'

export const AI_ACTION_LABELS: Record<AIAction, string> = {
  continue: '续写',
  summarize: '总结',
  translate_zh: '译中',
  translate_en: '译英',
  polish: '润色',
  organize: '整理',
}

export const AI_ACTION_ICONS: Record<AIAction, string> = {
  continue: 'fa-pen',
  summarize: 'fa-compress',
  translate_zh: 'fa-language',
  translate_en: 'fa-language',
  polish: 'fa-wand-magic-sparkles',
  organize: 'fa-broom',
}

export const AI_PROMPTS: Record<string, string> = {
  continue: '请继续续写以下内容，保持风格一致：\n\n',
  summarize: '请用简洁的语言总结以下内容（50字以内）：\n\n',
  translate_zh: '请将以下内容翻译成中文：\n\n',
  translate_en: '请将以下内容翻译成英文：\n\n',
  polish: '请润色以下内容，使其更流畅自然：\n\n',
  organize: '请整理以下笔记内容，要求：\n1. 重新组织段落顺序，使其逻辑清晰\n2. 修正语病和错别字\n3. 适当分段，添加空行分隔\n4. 保持所有原始信息，不要删减\n5. 不要添加原文没有的新内容\n\n笔记内容：\n\n',
}

export interface AIProvider {
  /** Process text with AI (continue, summarize, translate, polish) */
  processText(
    action: AIAction,
    text: string,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<string>

  /** Suggest tags based on note content */
  suggestTags(content: string, existingTags: string[]): Promise<string[]>

  /** Parse natural language into a structured action */
  parseIntent(input: string): Promise<{
    type: 'create_note' | 'create_todo' | 'query' | 'unknown'
    title?: string
    content?: string
    tags?: string[]
    dueDate?: number
  }>

  /** Answer a question based on note context */
  ask(question: string, context: string[], signal?: AbortSignal): Promise<string>

  /** Get a copy of current config */
  getConfig(): AIConfig

  /** Update config with partial values */
  updateConfig(config: Partial<AIConfig>): void
}
