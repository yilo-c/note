import React, { useEffect, useState } from 'react'
import { onSaveStatusChange } from '../../store/saveTracker'
import type { SaveState } from '../../store/saveTracker'

const SaveIndicator: React.FC = () => {
  const [status, setStatus] = useState<SaveState>('idle')

  useEffect(() => onSaveStatusChange(setStatus), [])

  if (status === 'idle') return null

  return (
    <span className="flex items-center gap-1 text-[10px] transition-opacity">
      {status === 'saving' ? (
        <>
          <i className="fa-solid fa-circle-notch fa-spin text-fluent-blue/50" />
          <span className="text-white/30">保存中</span>
        </>
      ) : (
        <>
          <i className="fa-solid fa-check-circle text-green-400/60" />
          <span className="text-green-400/60">已保存</span>
        </>
      )}
    </span>
  )
}

export default SaveIndicator
