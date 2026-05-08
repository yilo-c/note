const AI_PROMPTS: Record<string, string> = {
  continue: '请继续续写以下内容，保持风格一致：\n\n',
  summarize: '请用简洁的语言总结以下内容（50字以内）：\n\n',
  translate_zh: '请将以下内容翻译成中文：\n\n',
  translate_en: '请将以下内容翻译成英文：\n\n',
  polish: '请润色以下内容，使其更流畅自然：\n\n',
}

export type AIAction = 'continue' | 'summarize' | 'translate_zh' | 'translate_en' | 'polish'

export const AI_ACTION_LABELS: Record<AIAction, string> = {
  continue: '续写',
  summarize: '总结',
  translate_zh: '译中',
  translate_en: '译英',
  polish: '润色',
}

export const AI_ACTION_ICONS: Record<AIAction, string> = {
  continue: 'fa-pen',
  summarize: 'fa-compress',
  translate_zh: 'fa-language',
  translate_en: 'fa-language',
  polish: 'fa-wand-magic-sparkles',
}

export async function streamAI(
  apiUrl: string,
  model: string,
  action: AIAction,
  text: string,
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: string) => void,
): Promise<void> {
  const prompt = AI_PROMPTS[action]
  const fullPrompt = `${prompt}${text}`

  try {
    const res = await fetch(`${apiUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: true,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error')
      onError(`API 错误 (${res.status}): ${errText}`)
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      onError('无法读取响应流')
      return
    }

    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          if (parsed.response) {
            fullText += parsed.response
            onChunk(fullText)
          }
          if (parsed.done) {
            onDone(fullText)
            return
          }
        } catch {
          // Partial JSON line, skip
        }
      }
    }

    onDone(fullText)
  } catch (err) {
    onError(`网络错误: ${err instanceof Error ? err.message : String(err)}`)
  }
}
