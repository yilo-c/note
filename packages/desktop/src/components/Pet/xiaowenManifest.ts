import type { XiaoWenAction } from './xiaowenDialogue'

export interface XiaoWenClip {
  image: string
  fps: number
  loop: boolean
  fallbackMotion:
    | 'idle'
    | 'defend'
    | 'shy'
    | 'fly'
    | 'land'
    | 'combo'
    | 'notice'
}

export const XIAOWEN_MANIFEST: Record<XiaoWenAction, XiaoWenClip> = {
  idle: {
    image: '/pet/xiaowen/xiaowen_fullbody.png',
    fps: 6,
    loop: true,
    fallbackMotion: 'idle',
  },
  clickDefend: {
    image: '/pet/xiaowen/xiaowen_fullbody.png',
    fps: 10,
    loop: false,
    fallbackMotion: 'defend',
  },
  shy: {
    image: '/pet/xiaowen/xiaowen_fullbody.png',
    fps: 8,
    loop: false,
    fallbackMotion: 'shy',
  },
  dragFly: {
    image: '/pet/xiaowen/xiaowen_fullbody.png',
    fps: 12,
    loop: true,
    fallbackMotion: 'fly',
  },
  land: {
    image: '/pet/xiaowen/xiaowen_fullbody.png',
    fps: 10,
    loop: false,
    fallbackMotion: 'land',
  },
  combo3: {
    image: '/pet/xiaowen/xiaowen_fullbody.png',
    fps: 14,
    loop: false,
    fallbackMotion: 'combo',
  },
  combo5: {
    image: '/pet/xiaowen/xiaowen_fullbody.png',
    fps: 16,
    loop: false,
    fallbackMotion: 'combo',
  },
  chatOpen: {
    image: '/pet/xiaowen/xiaowen_fullbody.png',
    fps: 6,
    loop: false,
    fallbackMotion: 'notice',
  },
  notice: {
    image: '/pet/xiaowen/xiaowen_fullbody.png',
    fps: 8,
    loop: false,
    fallbackMotion: 'notice',
  },
  sleepy: {
    image: '/pet/xiaowen/xiaowen_fullbody.png',
    fps: 5,
    loop: false,
    fallbackMotion: 'shy',
  },
  startup: {
    image: '/pet/xiaowen/xiaowen_fullbody.png',
    fps: 10,
    loop: false,
    fallbackMotion: 'land',
  },
}
