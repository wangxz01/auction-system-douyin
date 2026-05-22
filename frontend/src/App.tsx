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
