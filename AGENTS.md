# 思忆便签 (desk-notes)

思忆便签 = 轻量级浮动便签 + 待办管理。Monorepo 结构（shared + desktop）。

> **交互语言：中文** — 与本项目的所有交流默认使用中文，除非用户明确要求英文。
>
> **手机端独立项目**：`D:\h\3.25\便签应用\思忆便签手机端app\`（Capacitor 原生壳，独立 git 仓库）

## 快速命令

```bash
npm run dev              # 桌面端 Vite 开发服务器（端口 5175）
npm run electron:dev     # 完整 Electron 开发（Vite + Electron）
npm run build            # 桌面端生产构建
npm run electron:build   # 构建 + electron-builder 打包
npm run test             # 运行所有测试
npm run test:watch       # 测试监听模式
npm run typecheck        # 全部包类型检查
```

## 启动流程

1. `npm run dev` 启动桌面端 Vite（纯浏览器模式，无 Electron 功能）
2. `npm run electron:dev` 启动完整桌面应用（先启动 Vite，再启动 Electron）
3. Electron 启动后通过 `packages/desktop/electron/main.cjs` 初始化

## 项目结构

```
desk-notes/
├── package.json                     # npm workspaces root
├── tsconfig.base.json               # 共享 TS 配置
├── packages/
│   ├── shared/                      # 纯逻辑包 — 两端共用
│   │   ├── src/
│   │   │   ├── types/               # 数据模型
│   │   │   ├── store/               # Zustand 核心状态（无平台依赖）
│   │   │   ├── utils/               # 工具函数（ai/, astrology/, helpers 等）
│   │   │   ├── hooks/               # 通用 hooks（useCompass）
│   │   │   └── i18n/                # 国际化
│   │   └── index.ts                 # 统一导出
│   │
│   ├── desktop/                     # 桌面端（Electron + React）
│   │   ├── electron/
│   │   │   ├── main.cjs             # Electron 主进程（IPC, 提醒调度, 图片协议）
│   │   │   └── preload.cjs          # contextBridge
│   │   ├── src/
│   │   │   ├── App.tsx              # 桌面入口
│   │   │   ├── components/
│   │   │   │   ├── Todo/            # 待办（CalendarView, TodoList, QimenPanel 等）
│   │   │   │   ├── FloatingNote/    # 浮动便签
│   │   │   │   ├── Common/          # 通用组件（编辑器、搜索、设置面板等）
│   │   │   │   └── Search/          # 全局搜索
│   │   │   └── ...
│   │   ├── vite.config.ts
│   │   └── tailwind.config.js
│   │
│   └── mobile/                      [已废弃] 新手机端为独立 Capacitor 项目
│                                    → D:\h\3.25\便签应用\思忆便签手机端app\
```

### 手机端项目（独立）

手机端已从 monorepo 中移出，作为独立 Capacitor 项目存在。它依赖 `@desk-notes/shared` 通过 `file:` 引用。

## 数据架构

```
UI 组件 → Zustand store → persist 中间件
  ├── 浏览器模式 → localStorage
  └── Electron 模式
        ├── store.json          ← todos, categories, 设置
        ├── notes/{id}.md       ← 每条便签独立文件
        ├── trash.json          ← 回收站
        └── assets/*            ← 嵌入图片
```

### Platform Adapter 模式

跨平台状态持久化通过注入模式实现：

```typescript
// shared/store/storage.ts  — 默认 localStorage，各端可覆盖
setPlatformStorage(customAdapter)

// shared/store/useStore.ts  — 可注入的 trash 处理
setTrashHandler((item) => { /* 桌面端写入 trash.json */ })
```

## 开发守则

1. **先看再改**：修改前先读目标文件，理解上下文
2. **纯逻辑放 shared**：types, utils, store 尽量放入 `packages/shared/`
3. **UI 层不跨端复用**：desktop 和 mobile 各自维护组件；shared 只放纯逻辑
4. **CSS**：桌面端 TailwindCSS，手机端 CSS 变量 + 内联样式
5. **国际化**：`packages/shared/src/i18n/`
6. **图标**：修改 `packages/desktop/public/icon.svg` 后 `npm run generate-icons`
