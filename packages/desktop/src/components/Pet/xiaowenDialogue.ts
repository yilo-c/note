export type XiaoWenAction =
  | 'idle'
  | 'clickDefend'
  | 'shy'
  | 'dragFly'
  | 'land'
  | 'combo3'
  | 'combo5'
  | 'chatOpen'
  | 'notice'
  | 'sleepy'
  | 'startup'

export const XIAOWEN_DIALOGUES: Record<XiaoWenAction, string[]> = {
  idle: [
    '剑在人在……呼……',
    '此剑随我八百年……哦不是，八年。',
    '华山剑法第三式……咦，第三式是什么来着？',
  ],
  clickDefend: ['干嘛！——哦，是你啊。'],
  shy: ['戳一下两下的……当心我用剑气挠你痒痒哦！'],
  dragFly: ['喂喂，我自己会走……', '华山轻功都被你浪费了。'],
  land: ['到了——唔，落地有点歪。'],
  combo3: ['再三挑衅——华山剑法第一式·疏狂剑意！……看招！'],
  combo5: ['千山冷落凌云道——！一生疏狂——！剑并箫！……哼！'],
  chatOpen: ['你聊你的，我练我的。——诶等等，你说的那个我也有兴趣。'],
  notice: ['嗯？有风声。'],
  sleepy: ['亥时了……华山弟子也是要睡觉的……哈啊~~'],
  startup: ['小问报到——今天也是剑意满满的一天！'],
}

export function pickXiaoWenLine(action: XiaoWenAction): string {
  const lines = XIAOWEN_DIALOGUES[action]
  return lines[Math.floor(Math.random() * lines.length)] ?? ''
}
