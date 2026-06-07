import { useEffect, useState } from 'react'
import './App.css'

type HealthResponse = {
  status: string
  service: string
  time: string
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<HealthResponse>
      })
      .then(setHealth)
      .catch((err) => setError(String(err)))
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui', padding: 32, maxWidth: 720, margin: '0 auto' }}>
      <h1>Auction System</h1>
      <h2>Backend Health Check</h2>
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      {!error && !health && <p>Loading...</p>}
      {health && (
        <pre
          style={{
            textAlign: 'left',
            background: '#1e1e1e',
            color: '#0f0',
            padding: 16,
            borderRadius: 8,
          }}
        >
{JSON.stringify(health, null, 2)}
        </pre>
      )}
      <p style={{ opacity: 0.6 }}>API base: {API_BASE}</p>
    </div>
  )
}

export default App

/*
================================================================================
【本文件作用】frontend/src/App.tsx（React 根组件）
================================================================================
作用：前端页面的"根组件"，所有 UI 都从这里开始渲染。

当前职责（第一阶段）：
  调用后端 /health 接口，把返回的 JSON 显示在页面上，用于验证前后端联调。

代码逐段解释：

  type HealthResponse = { ... }
    用 TypeScript 描述接口返回的数据结构。这样 IDE 能自动补全、编译时能查错。

  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'
    读取 .env 里的 VITE_API_BASE 作为后端地址，没配就用默认值。
    ⚠️ Vite 规定：环境变量必须以 VITE_ 开头才会暴露给浏览器代码。

  useState<HealthResponse | null>(null)
    React Hook：声明组件状态。health 存接口数据，error 存错误信息。
    state 变化时 React 会自动重新渲染。

  useEffect(() => { fetch(...) }, [])
    React Hook：组件挂载后执行一次副作用（这里是发请求）。
    第二个参数 [] 表示"只跑一次"，否则会无限循环请求。

  return ( <div>...</div> )
    JSX：HTML-like 语法，React 会把它编译成真实 DOM。

后续扩展：
  - 这个文件不应该一直堆业务逻辑。
  - 后续做路由（react-router）时，App.tsx 改成路由配置，
    具体页面（登录、首页、商品详情）放到 src/pages/ 下。
  - 接口请求统一封装到 src/api/，组件不再直接 fetch。
================================================================================
*/

