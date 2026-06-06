import { useState, useEffect, useRef } from 'react'
import { FiFolder, FiFile, FiVideo, FiImage, FiCheckCircle, FiUsers, FiLogOut, FiSettings, FiActivity, FiTerminal, FiXCircle, FiPower } from 'react-icons/fi'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';

const PREDEFINED_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#000000', '#ffffff'];

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatUptime(bootTime) {
    if (!bootTime) return 'Неизвестно';
    const diff = Math.floor(Date.now() / 1000) - bootTime;
    if (diff < 0) return 'Неизвестно';
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    return `${days}д ${hours}ч ${mins}м`;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [role, setRole] = useState(localStorage.getItem('role'))
  const [authMode, setAuthMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [previewFile, setPreviewFile] = useState(null)
  
  // Views
  const [activeView, setActiveView] = useState('files') // 'files', 'users', 'settings', 'dashboard', 'tasks'
  const [users, setUsers] = useState([])

  // Dashboard Data
  const [metricsHistory, setMetricsHistory] = useState([])
  const [latestMetrics, setLatestMetrics] = useState(null)
  const dashboardInterval = useRef(null)

  // Task Manager Data
  const [processes, setProcesses] = useState([])
  const [processEnv, setProcessEnv] = useState('debian') // 'debian' or 'windows'
  const [procLoading, setProcLoading] = useState(false)

  // Settings
  const [siteTitle, setSiteTitle] = useState('Медиа Архив')
  const [accentColor, setAccentColor] = useState('#3b82f6')
  const [bgColor, setBgColor] = useState('#0f172a')
  const [bgImage, setBgImage] = useState('')
  const [cardOpacity, setCardOpacity] = useState('0.7')

  const getHeaders = () => ({
    'Authorization': `Bearer ${token}`
  })

  // Load Settings on Mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.site_title) setSiteTitle(data.site_title)
        if (data.accent_color) {
          setAccentColor(data.accent_color)
          document.documentElement.style.setProperty('--accent-primary', data.accent_color)
        }
        if (data.bg_color) {
          setBgColor(data.bg_color)
          document.documentElement.style.setProperty('--bg-color', data.bg_color)
        }
        if (data.bg_image) {
          setBgImage(data.bg_image)
          document.documentElement.style.setProperty('--bg-image', `url(${data.bg_image})`)
        }
        if (data.card_opacity) {
          setCardOpacity(data.card_opacity)
          document.documentElement.style.setProperty('--card-opacity', data.card_opacity)
        }
      })
      .catch(e => console.error("Could not load settings", e))
  }, [])

  useEffect(() => {
    if (token && activeView === 'files') {
      fetchFiles(currentPath)
    }
  }, [token, activeView])

  // Dashboard Polling
  useEffect(() => {
    if (activeView === 'dashboard') {
      const fetchMetrics = async () => {
        try {
          const res = await fetch('/api/admin/metrics', { headers: getHeaders() })
          if (res.ok) {
            const data = await res.json()
            setLatestMetrics(data)
            
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second:'2-digit' })
            
            setMetricsHistory(prev => {
              const newRecord = {
                time: timeStr,
                debCpu: data.debian?.cpu || 0,
                debRam: data.debian?.ram || 0,
                debNet: ((data.debian?.net_tx || 0) + (data.debian?.net_rx || 0)) / 1024 / 1024,
                winCpu: data.windows?.cpu || 0,
                winRam: data.windows?.ram || 0,
                winNet: ((data.windows?.net_tx || 0) + (data.windows?.net_rx || 0)) / 1024 / 1024,
                debDisk: ((data.debian?.disk_read || 0) + (data.debian?.disk_write || 0)) / 1024 / 1024,
                winDisk: ((data.windows?.disk_read || 0) + (data.windows?.disk_write || 0)) / 1024 / 1024,
              }
              const updated = [...prev, newRecord]
              if (updated.length > 20) return updated.slice(updated.length - 20)
              return updated
            })
          }
        } catch (e) {
          console.error("Dashboard error", e)
        }
      }
      fetchMetrics()
      dashboardInterval.current = setInterval(fetchMetrics, 3000)
    } else {
      if (dashboardInterval.current) clearInterval(dashboardInterval.current)
    }
    return () => clearInterval(dashboardInterval.current)
  }, [activeView])

  // Process Fetching
  useEffect(() => {
    if (activeView === 'tasks') {
      fetchProcesses()
      const interval = setInterval(fetchProcesses, 5000)
      return () => clearInterval(interval)
    }
  }, [activeView, processEnv])

  const fetchProcesses = async () => {
    setProcLoading(true)
    try {
      const res = await fetch(`/api/admin/${processEnv}/processes`, { headers: getHeaders() })
      if (res.ok) {
        const data = await res.json()
        setProcesses(data.sort((a,b) => b.cpu - a.cpu)) // Sort by CPU desc
      }
    } catch(e) {
      console.error(e)
    } finally {
      setProcLoading(false)
    }
  }

  const killProcess = async (pid) => {
    if(!window.confirm(`Вы уверены, что хотите убить процесс PID ${pid}?`)) return
    const res = await fetch(`/api/admin/${processEnv}/kill/${pid}`, { method: 'POST', headers: getHeaders() })
    if(res.ok) {
        alert("Процесс завершен")
        fetchProcesses()
    } else {
        alert("Ошибка при завершении процесса")
    }
  }

  const rebootSystem = async (env) => {
    if(!window.confirm(`ВНИМАНИЕ! Вы собираетесь принудительно перезагрузить ${env === 'debian' ? 'Debian Сервер' : 'Windows ПК'}. Соединение будет потеряно. Продолжить?`)) return
    try {
        await fetch(`/api/admin/${env}/reboot`, { method: 'POST', headers: getHeaders() })
        alert("Команда на перезагрузку отправлена. Сервер скоро отключится.")
    } catch(e) {
        alert("Команда отправлена.")
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError('')
    try {
      if (authMode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
        if (!res.ok) throw new Error((await res.json()).detail)
        setAuthMode('login')
        setAuthError('Регистрация успешна! Ожидайте одобрения и войдите.')
      } else {
        const formData = new URLSearchParams()
        formData.append('username', username)
        formData.append('password', password)
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData
        })
        if (!res.ok) {
            const detail = (await res.json()).detail;
            if (detail === 'Account pending admin approval') throw new Error('Ваш аккаунт еще не одобрен Администратором.')
            throw new Error('Неверное имя пользователя или пароль')
        }
        const data = await res.json()
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('role', data.role)
        setToken(data.access_token)
        setRole(data.role)
      }
    } catch (err) {
      setAuthError(err.message)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    setToken(null)
    setRole(null)
  }

  const fetchFiles = async (path) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`, { headers: getHeaders() })
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) logout()
        throw new Error('Не удалось загрузить директорию')
      }
      const data = await response.json()
      setItems(data.items)
      setCurrentPath(data.current_path)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', { headers: getHeaders() })
      if (response.ok) setUsers(await response.json())
    } catch (e) {}
  }

  const approveUser = async (id) => {
    await fetch(`/api/admin/users/${id}/approve`, { method: 'POST', headers: getHeaders() })
    fetchUsers()
  }

  const approveFile = async (itemPath) => {
    const response = await fetch('/api/file/approve', {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: itemPath })
    })
    if (response.ok) {
      fetchFiles(currentPath)
    }
  }

  const saveSettings = async () => {
    const response = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_title: siteTitle,
        accent_color: accentColor,
        bg_color: bgColor,
        bg_image: bgImage,
        card_opacity: cardOpacity
      })
    })
    if (response.ok) {
      document.documentElement.style.setProperty('--accent-primary', accentColor)
      document.documentElement.style.setProperty('--bg-color', bgColor)
      if (bgImage) {
        document.documentElement.style.setProperty('--bg-image', `url(${bgImage})`)
      } else {
        document.documentElement.style.setProperty('--bg-image', 'radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.15) 0px, transparent 50%)')
      }
      document.documentElement.style.setProperty('--card-opacity', cardOpacity)
      alert("Настройки успешно сохранены!")
    }
  }

  const handleNavigate = (folderName) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName
    fetchFiles(newPath)
  }

  const handleNavigateUp = () => {
    if (!currentPath) return
    const parts = currentPath.split('/')
    parts.pop()
    fetchFiles(parts.join('/'))
  }

  const openFile = (fileName) => {
    const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName
    const ext = fileName.split('.').pop().toLowerCase()
    const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext)
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)

    if (isVideo || isImage) {
      setPreviewFile({ path: fullPath, type: isVideo ? 'video' : 'image' })
    } else {
      window.location.href = `/api/file/download?path=${encodeURIComponent(fullPath)}&token=${token}`
    }
  }

  // Generate Sort Data for BarChart
  const sortData = []
  if (latestMetrics && latestMetrics.sorting) {
    const keys = Object.keys(latestMetrics.sorting).sort()
    keys.slice(-20).forEach(ts => {
      const d = new Date(parseInt(ts) * 1000)
      sortData.push({
        time: `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`,
        files: latestMetrics.sorting[ts]
      })
    })
  }

  // --- RENDERING ---

  if (!token) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="file-card" style={{ flexDirection: 'column', width: '100%', maxWidth: '400px', padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>{siteTitle}</h2>
          <h3 style={{ marginBottom: '1.5rem', textAlign: 'center', fontWeight: 'normal' }}>{authMode === 'login' ? 'Вход' : 'Регистрация'}</h3>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            <input 
              type="text" 
              placeholder="Имя пользователя" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              required 
            />
            <input 
              type="password" 
              placeholder="Пароль" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              required 
            />
            {authError && <p style={{ color: authError.includes('успешна') ? '#10b981' : '#ef4444', fontSize: '0.9rem' }}>{authError}</p>}
            <button className="path-btn" style={{ background: 'var(--accent-primary)', color: 'white', padding: '0.75rem' }}>
              {authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>
            <button type="button" className="path-btn" onClick={() => setAuthMode(m => m === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0' }}>{siteTitle}</h1>
          <p className="subtitle" style={{ fontSize: '0.9rem' }}>Безопасный доступ к архиву</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {role === 'admin' && (
            <>
              <button className={`path-btn ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView(activeView === 'dashboard' ? 'files' : 'dashboard')}>
                <FiActivity /> Дашборд
              </button>
              <button className={`path-btn ${activeView === 'tasks' ? 'active' : ''}`} onClick={() => setActiveView(activeView === 'tasks' ? 'files' : 'tasks')}>
                <FiTerminal /> Диспетчер
              </button>
              <button className={`path-btn ${activeView === 'users' ? 'active' : ''}`} onClick={() => { setActiveView(activeView === 'users' ? 'files' : 'users'); fetchUsers(); }}>
                <FiUsers /> Пользователи
              </button>
              <button className={`path-btn ${activeView === 'settings' ? 'active' : ''}`} onClick={() => setActiveView(activeView === 'settings' ? 'files' : 'settings')}>
                <FiSettings /> Настройки
              </button>
            </>
          )}
          <button className="path-btn" style={{ color: '#ef4444' }} onClick={logout}>
            <FiLogOut /> Выйти
          </button>
        </div>
      </header>

      {activeView === 'dashboard' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <div className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <h3>🔥 Загрузка CPU</h3>
              <div style={{ height: '200px', width: '100%', marginTop: '1rem' }}>
                <ResponsiveContainer>
                  <AreaChart data={metricsHistory}>
                    <defs>
                      <linearGradient id="colorDebCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorWinCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                    <Legend />
                    <Area type="monotone" dataKey="debCpu" name="Debian CPU %" stroke="#10b981" fillOpacity={1} fill="url(#colorDebCpu)" />
                    <Area type="monotone" dataKey="winCpu" name="Windows CPU %" stroke="#3b82f6" fillOpacity={1} fill="url(#colorWinCpu)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <h3>🌐 Нагрузка на Сеть (MB/s)</h3>
              <div style={{ height: '200px', width: '100%', marginTop: '1rem' }}>
                <ResponsiveContainer>
                  <AreaChart data={metricsHistory}>
                    <defs>
                      <linearGradient id="colorDebNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorWinNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                    <Legend />
                    <Area type="monotone" dataKey="debNet" name="Debian MB/s" stroke="#f59e0b" fillOpacity={1} fill="url(#colorDebNet)" />
                    <Area type="monotone" dataKey="winNet" name="Windows MB/s" stroke="#ec4899" fillOpacity={1} fill="url(#colorWinNet)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <h3>💾 Нагрузка на Диски (MB/s)</h3>
              <div style={{ height: '200px', width: '100%', marginTop: '1rem' }}>
                <ResponsiveContainer>
                  <AreaChart data={metricsHistory}>
                    <defs>
                      <linearGradient id="colorDebDisk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorWinDisk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                    <Legend />
                    <Area type="monotone" dataKey="debDisk" name="Debian MB/s" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorDebDisk)" />
                    <Area type="monotone" dataKey="winDisk" name="Windows MB/s" stroke="#14b8a6" fillOpacity={1} fill="url(#colorWinDisk)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
             <div className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <h3>⚡ Скорость Сортировщика (Файлов в мин)</h3>
              <div style={{ height: '200px', width: '100%', marginTop: '1rem' }}>
                {sortData.length > 0 ? (
                <ResponsiveContainer>
                  <BarChart data={sortData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                    <Bar dataKey="files" name="Обработано файлов" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                ) : <p style={{color: '#94a3b8', textAlign: 'center', marginTop: '3rem'}}>Нет данных для сортировщика</p>}
              </div>
            </div>

            <div className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1rem' }}>
              <h3>💾 Состояние Дисков</h3>
              <div style={{ overflowY: 'auto', maxHeight: '200px', paddingRight: '1rem' }}>
                <h4 style={{ color: '#10b981', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Debian Server</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#94a3b8' }}>
                    Аптайм: {formatUptime(latestMetrics?.debian?.boot_time)}
                  </span>
                </h4>
                {latestMetrics?.debian?.disks.map((d, i) => (
                  <div key={'d'+i} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>{d.mountpoint}</span>
                      <span>{formatBytes(d.total - d.free)} / {formatBytes(d.total)} ({d.percent}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '4px' }}>
                      <div style={{ width: `${d.percent}%`, height: '100%', background: d.percent > 85 ? '#ef4444' : '#10b981', borderRadius: '4px' }} />
                    </div>
                  </div>
                ))}

                <h4 style={{ color: '#3b82f6', margin: '1rem 0 0.5rem 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Windows Host</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#94a3b8' }}>
                    Аптайм: {formatUptime(latestMetrics?.windows?.boot_time)}
                  </span>
                </h4>
                {!latestMetrics?.windows ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Агент Windows не отвечает...</p>
                ) : (
                  latestMetrics.windows.disks.map((d, i) => (
                    <div key={'w'+i} style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span>Диск {d.device}</span>
                        <span>{formatBytes(d.total - d.free)} / {formatBytes(d.total)} ({d.percent}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '4px' }}>
                        <div style={{ width: `${d.percent}%`, height: '100%', background: d.percent > 85 ? '#ef4444' : '#3b82f6', borderRadius: '4px' }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
        </div>
      ) : activeView === 'tasks' ? (
        <div className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Управление Системой</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="path-btn" style={{ background: processEnv === 'debian' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', color: 'white' }} onClick={() => setProcessEnv('debian')}>
                        Debian
                    </button>
                    <button className="path-btn" style={{ background: processEnv === 'windows' ? '#3b82f6' : 'rgba(255,255,255,0.1)', color: 'white' }} onClick={() => setProcessEnv('windows')}>
                        Windows
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <button className="path-btn" style={{ background: '#ef4444', color: 'white', flex: 1 }} onClick={() => rebootSystem(processEnv)}>
                   <FiPower/> Принудительная перезагрузка {processEnv === 'debian' ? 'Debian' : 'Windows'}
                </button>
                <button className="path-btn" style={{ flex: 1 }} onClick={fetchProcesses}>
                   🔄 Обновить список
                </button>
            </div>

            {procLoading ? <p style={{textAlign: 'center', color: '#94a3b8'}}>Загрузка...</p> : (
                <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#0f172a' }}>
                            <tr>
                                <th style={{ padding: '0.75rem', borderBottom: '1px solid #334155' }}>PID</th>
                                <th style={{ padding: '0.75rem', borderBottom: '1px solid #334155' }}>Имя процесса</th>
                                <th style={{ padding: '0.75rem', borderBottom: '1px solid #334155' }}>CPU %</th>
                                <th style={{ padding: '0.75rem', borderBottom: '1px solid #334155' }}>ОЗУ</th>
                                <th style={{ padding: '0.75rem', borderBottom: '1px solid #334155' }}>Убить</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processes.map(p => (
                                <tr key={p.pid} style={{ borderBottom: '1px solid #1e293b' }}>
                                    <td style={{ padding: '0.5rem 0.75rem', color: '#94a3b8' }}>{p.pid}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', color: '#e2e8f0', wordBreak: 'break-all' }}>{p.name}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', color: p.cpu > 10 ? '#ef4444' : '#10b981' }}>{p.cpu.toFixed(1)}%</td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>{formatBytes(p.ram)}</td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                        <button className="path-btn" style={{ color: '#ef4444', padding: '0.25rem 0.5rem' }} onClick={() => killProcess(p.pid)}>
                                            <FiXCircle size={18}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {processes.length === 0 && <p style={{textAlign: 'center', padding: '2rem', color: '#94a3b8'}}>Агент недоступен или процессов нет</p>}
                </div>
            )}
        </div>
      ) : activeView === 'users' ? (
        <div className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <h3>Управление пользователями</h3>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {users.map(u => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem' }}>
                <span>{u.username} ({u.role})</span>
                {u.is_approved ? <span style={{color: '#10b981'}}>Одобрен</span> : (
                  <button className="path-btn" style={{color: '#10b981'}} onClick={() => approveUser(u.id)}>Одобрить</button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : activeView === 'settings' ? (
        <div className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1.5rem' }}>
          <h3>Настройки интерфейса</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>Название сайта</label>
              <input 
                type="text" 
                value={siteTitle} 
                onChange={e => setSiteTitle(e.target.value)} 
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>Цвет кнопок (Акцентный)</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {PREDEFINED_COLORS.map(c => (
                  <div 
                    key={c}
                    onClick={() => setAccentColor(c)}
                    style={{
                      width: '30px', height: '30px', borderRadius: '50%', backgroundColor: c,
                      cursor: 'pointer', border: accentColor === c ? '3px solid white' : '1px solid var(--border-color)'
                    }}
                  />
                ))}
              </div>
              <input 
                type="text" 
                value={accentColor} 
                onChange={e => setAccentColor(e.target.value)} 
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white', marginTop: '0.5rem' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>URL Картинки на фон (пусто для стандартного градиента)</label>
              <input 
                type="text" 
                value={bgImage} 
                placeholder="https://example.com/image.jpg"
                onChange={e => setBgImage(e.target.value)} 
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>Прозрачность карточек и меню ({cardOpacity})</label>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={cardOpacity} 
                onChange={e => setCardOpacity(e.target.value)} 
                style={{ width: '100%' }}
              />
            </div>

            <button className="path-btn" style={{ background: 'var(--accent-primary)', color: 'white', marginTop: '1rem', padding: '0.75rem' }} onClick={saveSettings}>
              Сохранить настройки
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="nav-path">
            <button className="path-btn" onClick={() => fetchFiles('')}>Корень</button>
            {currentPath && currentPath.split('/').map((part, index, arr) => (
              <span key={index} style={{ display: 'flex', alignItems: 'center' }}>
                <span className="path-separator">/</span>
                <button className="path-btn" onClick={() => fetchFiles(arr.slice(0, index + 1).join('/'))}>
                  {part}
                </button>
              </span>
            ))}
          </div>

          {error && (
            <div className="file-card" style={{ flexDirection: 'column', color: '#ef4444', textAlign: 'center', padding: '2rem' }}>
              <p>{error}</p>
              <button className="path-btn" style={{ marginTop: '1rem' }} onClick={() => fetchFiles(currentPath)}>Повторить</button>
            </div>
          )}

          {!error && (
          <div className="file-grid">
            {currentPath && (
              <div className="file-card" onClick={handleNavigateUp}>
                <div className="icon-wrapper dir-icon"><FiFolder /></div>
                <div className="file-info"><div className="file-name">..</div><div className="file-meta">Назад</div></div>
              </div>
            )}
            
            {items.map((item, idx) => {
              const ext = item.name.split('.').pop().toLowerCase()
              const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext)
              const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
              const isAutoSorted = currentPath.includes('auto_sorted')
              const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name

              return (
                <div key={idx} className="file-card" onClick={(e) => {
                  if (e.target.closest('button')) return;
                  item.is_dir ? handleNavigate(item.name) : openFile(item.name)
                }}>
                  <div className={`icon-wrapper ${item.is_dir ? 'dir-icon' : 'file-icon'}`}>
                    {item.is_dir ? <FiFolder /> : (isVideo ? <FiVideo /> : (isImage ? <FiImage /> : <FiFile />))}
                  </div>
                  <div className="file-info">
                    <div className="file-name" title={item.name}>{item.name}</div>
                  </div>
                  {!item.is_dir && isAutoSorted && role === 'admin' && (
                    <button 
                      className="path-btn" 
                      style={{ color: '#10b981' }} 
                      onClick={(e) => { e.stopPropagation(); approveFile(fullPath); }}
                      title="Одобрить файл"
                    >
                      <FiCheckCircle size={20} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          )}
        </>
      )}

      {/* Media Preview Modal */}
      {previewFile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.9)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setPreviewFile(null)}>
          <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
            <button className="path-btn" style={{ color: 'white', background: 'rgba(255,255,255,0.2)' }} onClick={() => setPreviewFile(null)}>Закрыть</button>
          </div>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
            {previewFile.type === 'video' ? (
              <video 
                controls 
                autoPlay 
                style={{ maxWidth: '100%', maxHeight: '90vh' }}
                src={`/api/file/stream?path=${encodeURIComponent(previewFile.path)}&access_token=${token}`}
              />
            ) : (
              <img 
                src={`/api/file/stream?path=${encodeURIComponent(previewFile.path)}&access_token=${token}`} 
                style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
                alt="Просмотр"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
