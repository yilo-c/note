export interface NoteTemplate {
  id: string
  label: string
  icon: string
  title: string
  content: string
}

export const templates: NoteTemplate[] = [
  {
    id: 'meeting',
    label: '会议记录',
    icon: 'fa-people-group',
    title: '📅 会议记录',
    content: `<h1>会议主题</h1><p><b>时间：</b><br><b>参与人：</b></p><h2>议程</h2><ol><li></li><li></li></ol><h2>决议</h2><ul><li></li></ul>`,
  },
  {
    id: 'weekly',
    label: '周报',
    icon: 'fa-calendar-week',
    title: '📊 本周工作',
    content: `<h1>本周工作</h1><h2>完成</h2><ul><li></li></ul><h2>进行中</h2><ul><li></li></ul><h2>问题</h2><ul><li></li></ul>`,
  },
  {
    id: 'idea',
    label: '灵感捕捉',
    icon: 'fa-lightbulb',
    title: '💡 灵感',
    content: `<h1>灵感</h1><h2>想法</h2><p><br></p><h2>为什么重要</h2><p><br></p><h2>下一步</h2><ul><li></li></ul>`,
  },
  {
    id: 'reading',
    label: '读书笔记',
    icon: 'fa-book-open',
    title: '📖 读书笔记',
    content: `<h1>书名</h1><p><b>作者：</b></p><h2>核心观点</h2><ul><li></li></ul><h2>摘录</h2><p><br></p><h2>感想</h2><p><br></p>`,
  },
  {
    id: 'todo-list',
    label: '待办清单',
    icon: 'fa-list-check',
    title: '📋 待办清单',
    content: `<h1>待办清单</h1><ul><li><input type="checkbox"> </li><li><input type="checkbox"> </li><li><input type="checkbox"> </li></ul>`,
  },
]
