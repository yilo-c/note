import React, { useCallback, useEffect, useRef, useState } from 'react'
import { XIAOWEN_MANIFEST } from './xiaowenManifest'
import { useXiaoWenPetState } from './useXiaoWenPetState'

interface XiaoWenPetAvatarProps {
  size?: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

const XiaoWenPetAvatar: React.FC<XiaoWenPetAvatarProps> = ({ size = 180 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const rafRef = useRef<number>()
  const particlesRef = useRef<Particle[]>([])
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(false)
  const [position, setPosition] = useState({ x: 24, y: 24 })
  const {
    action,
    line,
    dragging,
    handleClick,
    handleDoubleClick,
    handleDragStart,
    handleDragEnd,
  } = useXiaoWenPetState()

  useEffect(() => {
    const img = new Image()
    img.src = XIAOWEN_MANIFEST[action].image
    img.onload = () => {
      imageRef.current = img
    }
  }, [])

  const spawnMist = useCallback(() => {
    particlesRef.current.push({
      x: rand(size * 0.2, size * 0.85),
      y: rand(size * 0.62, size * 0.9),
      vx: rand(-0.35, 0.1),
      vy: rand(-0.45, -0.1),
      life: 0,
      maxLife: rand(600, 1100),
      size: rand(3, 7),
      color: 'rgba(210, 236, 255, 0.55)',
    })
  }, [size])

  const spawnSwordSpark = useCallback(() => {
    for (let i = 0; i < 5; i++) {
      particlesRef.current.push({
        x: rand(size * 0.58, size * 0.8),
        y: rand(size * 0.48, size * 0.7),
        vx: rand(0.4, 1.4),
        vy: rand(-1.1, -0.2),
        life: 0,
        maxLife: rand(300, 700),
        size: rand(1.5, 3.5),
        color: 'rgba(117, 211, 255, 0.86)',
      })
    }
  }, [size])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let last = 0
    const draw = (now: number) => {
      const dt = last ? Math.min(now - last, 50) : 16
      last = now
      const t = now / 1000
      const clip = XIAOWEN_MANIFEST[action]

      if (action === 'dragFly' && Math.random() > 0.56) spawnMist()
      if ((action === 'clickDefend' || action === 'combo3' || action === 'combo5') && Math.random() > 0.78) {
        spawnSwordSpark()
      }

      ctx.clearRect(0, 0, size, size)

      ctx.save()
      const breath = Math.sin(t * 2.4) * 2
      const defendTilt = clip.fallbackMotion === 'defend' ? Math.sin(t * 18) * 0.08 : 0
      const flyTilt = clip.fallbackMotion === 'fly' ? -0.18 : 0
      const shyScale = clip.fallbackMotion === 'shy' ? 0.96 + Math.sin(t * 5) * 0.015 : 1
      const comboShake = clip.fallbackMotion === 'combo' ? Math.sin(t * 32) * 3 : 0
      const landY = clip.fallbackMotion === 'land' ? Math.abs(Math.sin(t * 10)) * 5 : 0

      ctx.translate(size / 2 + comboShake, size / 2 + breath + landY)
      ctx.rotate(defendTilt + flyTilt)
      ctx.scale(shyScale, shyScale)

      const img = imageRef.current
      if (img) {
        const drawSize = size * 1.02
        ctx.shadowColor = 'rgba(4, 16, 24, 0.28)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetY = 3
        ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize)
        ctx.shadowColor = 'transparent'
      }
      ctx.restore()

      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life += dt
        p.x += p.vx * dt * 0.06
        p.y += p.vy * dt * 0.06
        const alpha = Math.max(0, 1 - p.life / p.maxLife)
        if (alpha <= 0) {
          particles.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${alpha})`)
        ctx.arc(p.x, p.y, p.size * (0.7 + alpha * 0.3), 0, Math.PI * 2)
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [action, size, spawnMist, spawnSwordSpark])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOriginRef.current = { x: event.clientX - position.x, y: event.clientY - position.y }
    movedRef.current = false
  }, [position])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const origin = dragOriginRef.current
    if (!origin) return

    const next = {
      x: Math.max(8, Math.min(window.innerWidth - size - 8, event.clientX - origin.x)),
      y: Math.max(8, Math.min(window.innerHeight - size - 8, event.clientY - origin.y)),
    }
    if (!movedRef.current && Math.abs(next.x - position.x) + Math.abs(next.y - position.y) > 8) {
      movedRef.current = true
      handleDragStart()
    }
    setPosition(next)
  }, [handleDragStart, position, size])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId)
    dragOriginRef.current = null
    if (movedRef.current) {
      movedRef.current = false
      handleDragEnd()
      return
    }
    handleClick()
  }, [handleClick, handleDragEnd])

  return (
    <div
      className="fixed z-[80] select-none"
      style={{
        left: position.x,
        top: position.y,
        width: size,
        height: size,
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      role="button"
      aria-label="小问桌宠"
      tabIndex={0}
    >
      {line && (
        <div
          className="absolute left-1/2 bottom-[88%] max-w-[240px] -translate-x-1/2 rounded-lg border px-3 py-2 text-[12px] leading-relaxed shadow-xl backdrop-blur-xl"
          style={{
            width: 220,
            color: 'rgba(239, 248, 255, 0.94)',
            background: 'rgba(10, 20, 30, 0.74)',
            borderColor: 'rgba(121, 207, 255, 0.3)',
            boxShadow: '0 10px 32px rgba(0,0,0,0.26), 0 0 18px rgba(90, 190, 255, 0.12)',
          }}
        >
          {line}
        </div>
      )}
      <canvas ref={canvasRef} className="block" />
    </div>
  )
}

export default XiaoWenPetAvatar
