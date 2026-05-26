import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n'

const InlineAddInput: React.FC = () => {
  const { addTodo, activeCat, setAddingTodo } = useStore()
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = () => {
    const v = value.trim()
    if (v) addTodo(v, activeCat === 'all' ? undefined : activeCat)
    setAddingTodo(false)
  }

  return (
    <div className="px-3 pb-2">
      <div className="flex items-center gap-2 bg-white/[0.06] rounded-xl px-3 py-2 border border-fluent-blue/30 transition-colors">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          onBlur={submit}
          placeholder={t('todo.addPlaceholder')}
          className="flex-1 bg-transparent text-xs text-white/92 placeholder:text-white/60 outline-none"
        />
        <button onClick={submit}
          className="text-[10px] text-white/72 hover:text-white/72 transition-colors">
          <i className="fa-solid fa-plus" />
        </button>
      </div>
    </div>
  )
}

export default InlineAddInput
