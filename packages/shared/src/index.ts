// ── Store ──
export { useStore, setTrashHandler, setPlatformMobile } from './store/useStore'
export { setPlatformStorage, getPlatformStorage, platformJSONStorage } from './store/storage'
export { errorStore } from './store/errorStore'
export type { ErrorMessage, ErrorLevel, ErrorEvent } from './store/errorStore'
export { getSaveStatus, setSaveStatus, onSaveStatusChange } from './store/saveTracker'
export type { SaveState } from './store/saveTracker'
export { undoManager } from './store/undoManager'
export type { UndoEvent } from './store/undoManager'
export { onContentEdit, flushPendingEdit } from './store/contentEditTracker'
export { getDescendantIds, getDescendantFolderIds, getAncestorFolderIds } from './store/helpers'

// ── Types ──
export type {
  TodoItem, FloatingNote, Category, CanvasState, AIConfig, AIConfigProfile, ViewMode,
  CustomTheme, Folder, UserProfile, QimenEvent, QimenDomain, QimenDomainKey,
} from './types'
export { QIMEN_DOMAINS } from './types'

// ── i18n ──
export { useTranslation, getCurrentLocale, getTranslations, locales } from './i18n'
export type { SupportedLocale } from './i18n'

// ── Utils ──
export { uid, formatRelativeTime, stripHtml, defaultTodos, defaultCategories, countText, hexToRgb, COLOR_PRESETS } from './utils/helpers'
export { parseWikiLinks, buildFuseIndex, resolveWikiLink, replaceWikiLinks, updateWikiLinksOnRename, buildBacklinkIndex, WIKI_LINK_REGEX, PROTOCOL_LINK_REGEX } from './utils/wikiLinks'
export type { WikiLinkMatch, NoteStub, NoteWithContent } from './utils/wikiLinks'
export { addSnapshot, addAutoSnapshot, getHistory, computeDiff } from './utils/noteHistory'
export type { VersionEntry, DiffLine } from './utils/noteHistory'
export { builtinTemplates, getAllTemplates, getTemplateById, isBuiltin, createCustomTemplate, updateCustomTemplate, deleteCustomTemplate } from './utils/templates'
export type { NoteTemplate } from './utils/templates'
export { applyCustomTheme } from './utils/customTheme'
export { pluginManager } from './utils/pluginSystem'
export type { Plugin } from './utils/pluginSystem'
export { extractContext, highlightInHtml } from './utils/searchContext'

// ── AI ──
export { getAIProvider, resetAIProvider, streamAI, LocalAIProvider, RuleAIProvider, HybridAIProvider } from './utils/ai'
export type { AIProvider, AIAction } from './utils/ai'
export { AI_ACTION_LABELS, AI_ACTION_ICONS, AI_PROMPTS } from './utils/ai'

// ── Astrology ──
export { getHuangli, getDayCellLunarInfo } from './utils/astrology'
export { calculateBazi, generateDailyAdvice, getWuxingColor, getWuxingLabel } from './utils/astrology'
export type { BaziProfile, GuidanceAdvice } from './utils/astrology'
export { getDailyGuidance, generateSummaryQuote } from './utils/astrology'
export { getFengshuiAdvice, getAdditionalTips } from './utils/astrology'
export type { FengshuiAdvice } from './utils/astrology'
export type { DailyGuidance, HuangliData, GanZhiInfo, ShenXiaoInfo, YiJiInfo, ChongShaInfo, FangWeiInfo, XiuInfo, LunarDayInfo } from './utils/astrology'
export { fetchWeather, getWeatherEmoji, getCachedWeather, clearWeatherCache } from './utils/astrology/weather'
export type { WeatherData } from './utils/astrology/weather'

// ── Hooks ──
export { useCompass, labelToDegrees, angleDiff } from './hooks/useCompass'
export type { CompassState } from './hooks/useCompass'

