# 思忆便签 (desk-notes)

轻量级浮动便签 + 待办管理桌面应用。Electron + React + TypeScript 构建，支持深色/浅色主题、毛玻璃效果、黄历八字奇门择日等传统历法功能。

## 截图

![screenshot](packages/desktop/public/icon.png)

## 功能特色

- **待办管理** — 创建、分类、排序、筛选、优先级标记、子任务、日历视图
- **浮动便签** — 独立窗口，可随意拖动、缩放、置顶、锁定、调透明度
- **晨间简报** — 每日自动展示农历、黄历宜忌、天气、八字、穿衣建议
- **传统历法** — 黄历、八字排盘、奇门遁甲、择日建议、风水催旺
- **AI 建议** — 对接 AI 接口，基于八字和当日运势生成个性化建议
- **番茄钟** — 内置 Pomodoro 专注计时器
- **全局搜索** — 快速搜索待办和笔记内容
- **毛玻璃效果** — Windows 亚克力/云母背景效果
- **深色/浅色主题** — 自由切换，支持自定义色调
- **中英文双语** — 内置国际化支持
- **数据本地存储** — 所有数据保存在本地，无需注册账号
- **自动备份** — 定期自动备份数据

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（浏览器）
npm run dev

# 完整 Electron 开发模式
npm run electron:dev

# 生产构建
npm run build

# 构建 + electron-builder 打包
npm run electron:build

# 运行测试
npm run test

# 类型检查
npm run typecheck
```

## 技术栈

| 层 | 技术 |
|------|--------|
| 框架 | Electron 33 + React 18 + TypeScript 5 |
| 构建 | Vite 5 + electron-builder |
| 状态管理 | Zustand + persist 中间件 |
| 样式 | TailwindCSS |
| 测试 | Vitest + Testing Library + Playwright |
| PWA | vite-plugin-pwa |
| 国际化 | 自建 i18n（zh-CN / en） |

## 项目结构

```
desk-notes/
├── package.json                     # npm workspaces 根
├── packages/
│   ├── shared/                      # 纯逻辑包 — 两端共用
│   │   ├── src/
│   │   │   ├── types/               # 数据模型
│   │   │   ├── store/               # Zustand 状态
│   │   │   ├── utils/               # 工具（AI、命理引擎等）
│   │   │   │   ├── ai/              # AI Provider 接口
│   │   │   │   └── astrology/       # 命理引擎（黄历/八字/奇门）
│   │   │   ├── hooks/               # 通用 hooks
│   │   │   └── i18n/                # 国际化
│   │   └── index.ts                 # 统一导出
│   │
│   ├── desktop/                     # 桌面端（Electron + React）
│   │   ├── electron/
│   │   │   ├── main.cjs             # Electron 主进程
│   │   │   └── preload.cjs          # contextBridge
│   │   ├── src/
│   │   │   ├── App.tsx              # 桌面入口
│   │   │   ├── components/
│   │   │   │   ├── Todo/            # 待办组件
│   │   │   │   ├── FloatingNote/    # 浮动便签
│   │   │   │   ├── Common/          # 通用组件
│   │   │   │   └── Search/          # 全局搜索
│   │   │   └── ...
│   │   ├── vite.config.ts
│   │   └── tailwind.config.js
│   │
│   └── mobile/                      [已废弃]
```

## 数据存储

```
UI 组件 → Zustand store → persist 中间件
  ├── 浏览器模式 → localStorage
  └── Electron 模式
        ├── store.json          ← 待办、分类、设置
        ├── notes/{id}.md       ← 每条便签独立文件
        ├── trash.json          ← 回收站
        └── assets/*            ← 嵌入图片
```

## 详细使用说明

参见 [`使用说明.md`](使用说明.md)

## 许可证

MIT
