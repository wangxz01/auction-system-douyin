# 拍卖系统 - 前端

基于 **React 19 + TypeScript + Vite** 的拍卖系统前端项目。

---

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```
默认运行在 <http://localhost:5173>，支持热更新（HMR）。

### 构建生产版本
```bash
npm run build
```
产物输出到 `dist/` 目录。

### 本地预览生产构建
```bash
npm run preview
```

---

## 📁 目录结构

```
frontend/
├── .env                  # 环境变量（VITE_API_BASE 指向后端）
├── index.html            # HTML 入口
├── package.json
├── tsconfig.json         # TypeScript 配置
├── vite.config.ts        # Vite 配置
└── src/
    ├── main.tsx          # React 应用入口
    ├── App.tsx           # 根组件（当前用于调用后端 /health）
    ├── App.css
    ├── index.css
    └── assets/           # 静态资源
```

---

## 🔧 环境变量

在项目根目录创建 `.env` 文件：

```env
VITE_API_BASE=http://localhost:8080
```

> ⚠️ **重要**：Vite 规定只有以 `VITE_` 开头的变量才会暴露到浏览器代码中。
> 在代码里通过 `import.meta.env.VITE_API_BASE` 读取。

---

## 🔌 与后端对接

当前 `src/App.tsx` 启动后会立即请求后端 `/health` 接口，并将结果渲染在页面上。

请确保后端服务已启动（默认 <http://localhost:8080>），否则页面会显示错误信息。

启动后端：
```bash
cd ../backend
go run ./cmd/server
```

---

## 🧰 技术栈

| 名称 | 作用 |
|---|---|
| **React 19** | UI 框架 |
| **TypeScript** | 类型系统 |
| **Vite** | 开发服务器 + 构建工具，速度极快 |
| **@vitejs/plugin-react** | React 官方插件，支持 JSX、Fast Refresh |

---

## 📝 开发建议

- **新建组件**：放在 `src/components/` 下，按功能拆分。
- **接口请求**：建议后续在 `src/api/` 下统一封装 fetch / axios 调用。
- **状态管理**：当前仅用 `useState`；如业务变复杂，可引入 Zustand 或 Redux Toolkit。
- **样式方案**：项目目前用普通 CSS，后续可考虑 Tailwind CSS 或 CSS Modules。

---

## 📚 ESLint 配置（可选增强）

如果要做生产应用，建议启用类型感知的 lint 规则：

```js
// eslint.config.js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.recommendedTypeChecked, // 或 strictTypeChecked
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

也可以额外安装 React 专用规则：

```bash
npm install -D eslint-plugin-react-x eslint-plugin-react-dom
```

```js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      reactX.configs['recommended-typescript'],
      reactDom.configs.recommended,
    ],
  },
])
```

---

## 🔗 相关链接

- [Vite 官方文档](https://vite.dev/)
- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- 项目总 README：[../README.md](../README.md)

---

<!--
================================================================================
【本文件作用】frontend/README.md（前端项目说明文档）
================================================================================
作用：专门介绍前端模块的"使用说明书"，与项目根目录的 README.md 形成层级。

为什么前端要有自己的 README：
  1. 单独打开 frontend/ 目录时（比如用 VS Code 只开这一个文件夹），
     还能立刻看到该模块的说明。
  2. 前端有自己独立的命令、目录结构、技术栈，跟后端不一样，
     混在根 README 里会很乱。
  3. 行业惯例：monorepo（多模块项目）每个子模块通常都有自己的 README。

包含内容：
  1. 启动命令（npm install / npm run dev / npm run build / npm run preview）
  2. 目录结构（src/ 下各文件作用）
  3. 环境变量说明（VITE_API_BASE 等）
  4. 与后端对接方式
  5. 技术栈说明
  6. 开发建议（什么时候引入路由、状态管理等）
  7. ESLint 增强配置（可选）

何时更新：
  - 引入新依赖时（如 react-router、tailwind）：更新"技术栈"
  - 新增 npm 脚本时：更新"快速开始"
  - 目录结构变动时：更新"目录结构"
================================================================================
-->

