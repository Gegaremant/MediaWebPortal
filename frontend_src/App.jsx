import { useState, useEffect, useRef } from 'react'
import { FiFolder, FiFile, FiVideo, FiImage, FiCheckCircle, FiUsers, FiLogOut, FiSettings, FiActivity, FiTerminal, FiXCircle, FiPower } from 'react-icons/fi'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { WidthProvider, Responsive } from "react-grid-layout/legacy";
const ResponsiveReactGridLayout = WidthProvider(Responsive);

const PREDEFINED_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#000000', '#ffffff'];

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [role, setRole] = useState(localStorage.getItem('role'))
  const [authMode, setAuthMode] = useState('login')
  const [allowedTabs, setAllowedTabs] = useState(localStorage.getItem('allowedTabs') || 'files,photos,videos')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [previewFile, setPreviewFile] = useState(null)
  
  // Views
  const [activeView, setActiveView] = useState('dashboard') // 'files', 'users', 'settings', 'dashboard', 'tasks'
  const [users, setUsers] = useState([])

  
  // Duplicates State
  const [duplicates, setDuplicates] = useState([])
  const [loadingDupes, setLoadingDupes] = useState(false)
  const [galleryPhotos, setGalleryPhotos] = useState([])
  const [galleryVideos, setGalleryVideos] = useState([])
  const [galleryOffset, setGalleryOffset] = useState(0)
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const [hasMoreGallery, setHasMoreGallery] = useState(true)
  const [loadingGallery, setLoadingGallery] = useState(false)
  const observerTarget = useRef(null)
  
  const [fullscreenImage, setFullscreenImage] = useState(null)

  const [touchStartX, setTouchStartX] = useState(null)
  const [touchEndX, setTouchEndX] = useState(null)

  const handleSwipeStart = (clientX) => {
    setTouchEndX(null)
    setTouchStartX(clientX)
  }

  const handleSwipeMove = (clientX) => {
    if (touchStartX !== null) {
      setTouchEndX(clientX)
    }
  }

  const handleSwipeEnd = (items) => {
    if (touchStartX === null || touchEndX === null) {
      setTouchStartX(null)
      return
    }
    const distance = touchStartX - touchEndX
    if (distance > 50 && currentMediaIndex < items.length - 1) {
      setCurrentMediaIndex(prev => prev + 1)
    }
    if (distance < -50 && currentMediaIndex > 0) {
      setCurrentMediaIndex(prev => prev - 1)
    }
    setTouchStartX(null)
    setTouchEndX(null)
  }

  const loadGallery = async (type, reset = false) => {
    if (loadingGallery) return;
    setLoadingGallery(true);
    const limit = type === 'photos' ? 50 : 20;
    const currentOffset = reset ? 0 : galleryOffset;
    try {
      const res = await fetch(`/api/media/${type}?offset=${currentOffset}&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (reset) {
        if (type === 'photos') setGalleryPhotos(data.items);
        else setGalleryVideos(data.items);
      } else {
        if (type === 'photos') setGalleryPhotos(prev => [...prev, ...data.items]);
        else setGalleryVideos(prev => [...prev, ...data.items]);
      }
      setGalleryOffset(currentOffset + limit);
      setHasMoreGallery(data.items.length === limit);
    } catch (e) {
      console.error('Gallery load error:', e);
    }
    setLoadingGallery(false);
  }

  useEffect(() => {
    if (activeView === 'photos' || activeView === 'videos') {
      setCurrentMediaIndex(0);
      loadGallery(activeView, true);
    }
  }, [activeView]);

  useEffect(() => {
    const itemsList = activeView === 'photos' ? galleryPhotos : galleryVideos;
    if (itemsList.length > 0 && currentMediaIndex >= itemsList.length - 5 && hasMoreGallery && !loadingGallery) {
      loadGallery(activeView);
    }
  }, [currentMediaIndex, hasMoreGallery, loadingGallery, activeView, galleryPhotos, galleryVideos]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMoreGallery) {
          loadGallery(activeView);
        }
      },
      { threshold: 1.0 }
    );
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => {
      if (observerTarget.current) observer.unobserve(observerTarget.current);
    };
  }, [observerTarget.current, hasMoreGallery, loadingGallery, activeView]);


  const defaultLayout = [
    { i: 'cpu', x: 0, y: 0, w: 6, h: 3 },
    { i: 'net', x: 6, y: 0, w: 6, h: 3 },
    { i: 'ram', x: 0, y: 3, w: 4, h: 3 },
    { i: 'disk_io', x: 4, y: 3, w: 4, h: 3 },
    { i: 'sorter', x: 8, y: 3, w: 4, h: 3 },
    { i: 'disk_space', x: 0, y: 6, w: 12, h: 3 }
  ];

  const [layouts, setLayouts] = useState(() => {
    const saved = localStorage.getItem('dashboardLayouts');
    if (saved) return JSON.parse(saved);
    return { lg: defaultLayout };
  });

  const onLayoutChange = (layout, allLayouts) => {
    setLayouts(allLayouts);
    localStorage.setItem('dashboardLayouts', JSON.stringify(allLayouts));
  };

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
  
  // Sorter State
  const [sorterState, setSorterState] = useState({status: 'running', delay_ms: 0})
  
  const handleSorterControl = async (action, delay_ms = null) => {
    const payload = { action }
    if (delay_ms !== null) payload.delay_ms = delay_ms
    const res = await fetch('/api/admin/sorter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getHeaders() },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      setSorterState(await res.json())
    }
  }

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
                debDiskIO: ((data.debian?.disk_read || 0) + (data.debian?.disk_write || 0)) / 1024 / 1024,
                winCpu: data.windows?.cpu || 0,
                winRam: data.windows?.ram || 0,
                winNet: ((data.windows?.net_tx || 0) + (data.windows?.net_rx || 0)) / 1024 / 1024,
                winDiskIO: ((data.windows?.disk_read || 0) + (data.windows?.disk_write || 0)) / 1024 / 1024,
                tnCpu: data.truenas?.cpu || 0,
                tnRam: data.truenas?.ram || 0,
                tnNet: ((data.truenas?.net_tx || 0) + (data.truenas?.net_rx || 0)) / 1024 / 1024,
                tnDiskIO: ((data.truenas?.disk_read || 0) + (data.truenas?.disk_write || 0)) / 1024 / 1024,
                sortSpeed: data.sorting?.speed || 0,
              }
              const updated = [...prev, newRecord]
              if (updated.length > 20) return updated.slice(updated.length - 20)
              return updated
            })
            
            // Also fetch current sorter status if we don't have it
            fetch('/api/admin/sorter', { method: 'POST', headers: {'Content-Type': 'application/json', ...getHeaders()}, body: JSON.stringify({action: 'get'}) })
              .then(r => r.json())
              .then(s => setSorterState(s))
              .catch(() => {})
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
    let interval;
    if (activeView === 'tasks') {
      fetchProcesses()
      interval = setInterval(fetchProcesses, 5000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [activeView, processEnv])

  
  useEffect(() => {
    let interval;
    if (activeView === 'duplicates') {
      fetchDuplicates()
      interval = setInterval(fetchDuplicates, 5000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [activeView])

  const fetchDuplicates = async () => {
    setLoadingDupes(true)
    try {
      const res = await fetch('/api/admin/duplicates', { headers: getHeaders() })
      if (res.ok) {
        setDuplicates(await res.json())
      }
    } catch(e) {}
    finally {
      setLoadingDupes(false)
    }
  }

  const resolveDuplicate = async (id, action) => {
    try {
      await fetch('/api/admin/duplicates/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({id, action})
      })
      fetchDuplicates()
    } catch(e) {}
  }

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
        localStorage.setItem('allowedTabs', data.allowed_tabs || 'files,photos,videos')
        setToken(data.access_token)
        setRole(data.role)
        setAllowedTabs(data.allowed_tabs || 'files,photos,videos')
        setActiveView('dashboard')
      }
    } catch (err) {
      setAuthError(err.message)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('allowedTabs')
    setToken(null)
    setRole(null)
    setAllowedTabs('files,photos,videos')
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

  const updateUserPermissions = async (id, currentTabs, toggleTab) => {
    let tabsArray = currentTabs ? currentTabs.split(',').filter(Boolean) : [];
    if (tabsArray.includes(toggleTab)) {
      tabsArray = tabsArray.filter(t => t !== toggleTab);
    } else {
      tabsArray.push(toggleTab);
    }
    const newTabs = tabsArray.join(',');
    try {
      await fetch(`/api/admin/users/${id}/permissions`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ allowed_tabs: newTabs })
      })
      fetchUsers()
    } catch(e) {}
  }

  const approveFile = async (itemPath) => {
    const response = await fetch('/api/file/approve', {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: itemPath })
    })
    if (response.ok) {
      fetchFiles(currentPath)
      return true;
    }
    return false;
  }

  const deleteFile = async (itemPath) => {
    if (!window.confirm('Точно удалить этот файл?')) return false;
    const response = await fetch('/api/file/delete', {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: itemPath })
    })
    if (response.ok) {
      fetchFiles(currentPath)
      return true;
    }
    return false;
  }

  const handleGalleryApprove = async (itemPath, type) => {
    const success = await approveFile(itemPath);
    if (success) {
      if (type === 'photos') setGalleryPhotos(prev => prev.filter(p => p !== itemPath));
      else setGalleryVideos(prev => prev.filter(p => p !== itemPath));
    }
  }

  const handleGalleryDelete = async (itemPath, type) => {
    const success = await deleteFile(itemPath);
    if (success) {
      if (type === 'photos') setGalleryPhotos(prev => prev.filter(p => p !== itemPath));
      else setGalleryVideos(prev => prev.filter(p => p !== itemPath));
    }
  }

  const renderGalleryFullscreen = (items, type) => {
    if (items.length === 0) {
      return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>{type === 'photos' ? '📸 Галерея Фотографий' : '🎬 Галерея Видео'}</h2>
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Нет медиафайлов</div>
          {loadingGallery && <div style={{ textAlign: 'center', padding: '2rem' }}>Загрузка...</div>}
        </div>
      );
    }
    const index = Math.min(currentMediaIndex, items.length - 1);
    const currentItem = items[index];
    const isAutoSorted = currentItem.toLowerCase().includes('auto_sorted');

    return (
      <div 
        style={{ width: '100%', height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', userSelect: 'none' }}
        onTouchStart={e => handleSwipeStart(e.touches[0].clientX)}
        onTouchMove={e => handleSwipeMove(e.touches[0].clientX)}
        onTouchEnd={() => handleSwipeEnd(items)}
        onMouseDown={e => handleSwipeStart(e.clientX)}
        onMouseMove={e => handleSwipeMove(e.clientX)}
        onMouseUp={() => handleSwipeEnd(items)}
        onMouseLeave={() => {setTouchStartX(null); setTouchEndX(null)}}
      >
        <div style={{ position: 'absolute', top: '10px', right: '20px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '5px' }}>
          {index + 1} из {items.length}
        </div>
        
        {/* Navigation */}
        {index > 0 && (
          <button 
            onClick={() => setCurrentMediaIndex(index - 1)}
            style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: '2rem', padding: '1rem', borderRadius: '50%', cursor: 'pointer', zIndex: 10 }}
          >
            &#10094;
          </button>
        )}
        {index < items.length - 1 && (
          <button 
            onClick={() => setCurrentMediaIndex(index + 1)}
            style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: '2rem', padding: '1rem', borderRadius: '50%', cursor: 'pointer', zIndex: 10 }}
          >
            &#10095;
          </button>
        )}

        {/* Media Container */}
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', overflow: 'hidden', paddingBottom: '80px' }}>
          {type === 'photos' ? (
            <img src={`/api/file/download?path=${encodeURIComponent(currentItem)}&access_token=${token}`} alt="photo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }} loading="lazy" />
          ) : (
            <video key={currentItem} src={`/api/file/stream?path=${encodeURIComponent(currentItem)}&access_token=${token}`} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
          )}
        </div>
        
        {/* Actions Container */}
        <div style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '1rem', padding: '1rem', zIndex: 20 }}>
          {role === 'admin' && (
            <>
              {isAutoSorted && (
                <button className="path-btn" style={{ background: '#10b981', color: 'white', padding: '1rem 2rem', fontSize: '1.2rem', borderRadius: '30px', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)' }} onClick={() => handleGalleryApprove(currentItem, type)}>
                  Одобрить
                </button>
              )}
              <button className="path-btn" style={{ background: '#ef4444', color: 'white', padding: '1rem 2rem', fontSize: '1.2rem', borderRadius: '30px', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }} onClick={() => handleGalleryDelete(currentItem, type)}>
                Удалить
              </button>
            </>
          )}
        </div>
        {loadingGallery && <div style={{ position: 'absolute', bottom: '10px', right: '20px', color: '#94a3b8' }}>Загрузка новых...</div>}
      </div>
    );
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
      const mediaItems = items.filter(i => {
        const iExt = i.name.split('.').pop().toLowerCase();
        return ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(iExt);
      });
      const currentIndex = mediaItems.findIndex(i => i.name === fileName);
      setPreviewFile({ items: mediaItems, currentIndex, currentPath });
    } else {
      window.open(`/api/file/download?path=${encodeURIComponent(fullPath)}&access_token=${token}`, '_blank')
    }
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
          {(role === 'admin' || allowedTabs.includes('files')) && (
            <button className={`path-btn ${activeView === 'files' ? 'active' : ''}`} onClick={() => setActiveView('files')}>
              <FiFolder /> Файлы
            </button>
          )}
          {(role === 'admin' || allowedTabs.includes('photos')) && (
            <button className={`path-btn ${activeView === 'photos' ? 'active' : ''}`} onClick={() => setActiveView('photos')}>
              <FiImage /> Фото
            </button>
          )}
          {(role === 'admin' || allowedTabs.includes('videos')) && (
            <button className={`path-btn ${activeView === 'videos' ? 'active' : ''}`} onClick={() => setActiveView('videos')}>
              <FiVideo /> Видео
            </button>
          )}
          {(role === 'admin' || allowedTabs.includes('dashboard')) && (
            <button className={`path-btn ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>
              <FiActivity /> Дашборд
            </button>
          )}
          {(role === 'admin' || allowedTabs.includes('tasks')) && (
            <button className={`path-btn ${activeView === 'tasks' ? 'active' : ''}`} onClick={() => setActiveView('tasks')}>
              <FiTerminal /> Диспетчер
            </button>
          )}
          {role === 'admin' && (
            <>
              <button className={`path-btn ${activeView === 'users' ? 'active' : ''}`} onClick={() => { setActiveView('users'); fetchUsers(); }}>
                <FiUsers /> Пользователи
              </button>
              <button className={`path-btn ${activeView === 'settings' ? 'active' : ''}`} onClick={() => setActiveView('settings')}>
                <FiSettings /> Настройки
              </button>
            </>
          )}
          <button className="path-btn" style={{ color: '#ef4444' }} onClick={logout}>
            <FiLogOut /> Выйти
          </button>
        </div>
      </header>

      {activeView === 'photos' ? renderGalleryFullscreen(galleryPhotos, 'photos') : activeView === 'videos' ? renderGalleryFullscreen(galleryVideos, 'videos') : activeView === 'dashboard' ? (
        <div style={{ width: '100%', marginBottom: '2rem' }}>
          <ResponsiveReactGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={{lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0}}
            cols={{lg: 12, md: 10, sm: 6, xs: 4, xxs: 2}}
            rowHeight={100}
            onLayoutChange={onLayoutChange}
            draggableHandle=".drag-handle"
          >
            <div key="cpu" className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '1rem', height: '100%' }}>
              <h3 className="drag-handle" style={{ cursor: 'move', userSelect: 'none', marginBottom: '1rem' }}>🔥 Загрузка CPU</h3>
              <div style={{ flexGrow: 1, minHeight: 0 }}>
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
                    <Area type="monotone" dataKey="tnCpu" name="TrueNAS CPU %" stroke="#f43f5e" fillOpacity={1} fill="rgba(244,63,94,0.1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div key="net" className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '1rem', height: '100%' }}>
              <h3 className="drag-handle" style={{ cursor: 'move', userSelect: 'none', marginBottom: '1rem' }}>🌐 Нагрузка на Сеть (MB/s)</h3>
              <div style={{ flexGrow: 1, minHeight: 0 }}>
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
                    <Area type="monotone" dataKey="debNet" name="Debian MB/s" stroke="#f59e0b" fillOpacity={1} fill="url(#colorDebNet)" />
                    <Area type="monotone" dataKey="winNet" name="Windows MB/s" stroke="#ec4899" fillOpacity={1} fill="url(#colorWinNet)" />
                    <Area type="monotone" dataKey="tnNet" name="TrueNAS MB/s" stroke="#8b5cf6" fillOpacity={1} fill="rgba(139,92,246,0.1)" />
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div key="ram" className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '1rem', height: '100%' }}>
              <h3 className="drag-handle" style={{ cursor: 'move', userSelect: 'none', marginBottom: '1rem' }}>🧠 Использование ОЗУ (%)</h3>
              <div style={{ flexGrow: 1, minHeight: 0 }}>
                <ResponsiveContainer>
                  <AreaChart data={metricsHistory}>
                    <defs>
                      <linearGradient id="colorDebRam" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorWinRam" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                    <Legend />
                    <Area type="monotone" dataKey="debRam" name="Debian RAM %" stroke="#14b8a6" fillOpacity={1} fill="url(#colorDebRam)" />
                    <Area type="monotone" dataKey="winRam" name="Windows RAM %" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorWinRam)" />
                    <Area type="monotone" dataKey="tnRam" name="TrueNAS RAM %" stroke="#f59e0b" fillOpacity={1} fill="rgba(245,158,11,0.1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div key="disk_io" className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '1rem', height: '100%' }}>
              <h3 className="drag-handle" style={{ cursor: 'move', userSelect: 'none', marginBottom: '1rem' }}>💿 Активность Дисков (MB/s)</h3>
              <div style={{ flexGrow: 1, minHeight: 0 }}>
                <ResponsiveContainer>
                  <AreaChart data={metricsHistory}>
                    <defs>
                      <linearGradient id="colorDebDisk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorWinDisk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                    <Legend />
                    <Area type="monotone" dataKey="debDiskIO" name="Debian Disk IO" stroke="#eab308" fillOpacity={1} fill="url(#colorDebDisk)" />
                    <Area type="monotone" dataKey="winDiskIO" name="Windows Disk IO" stroke="#f43f5e" fillOpacity={1} fill="url(#colorWinDisk)" />
                    <Area type="monotone" dataKey="tnDiskIO" name="TrueNAS Disk IO" stroke="#10b981" fillOpacity={1} fill="rgba(16,185,129,0.1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div key="sorter" className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '1rem', height: '100%' }}>
              <div className="drag-handle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', userSelect: 'none', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>⚡ Сортировщик</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} onMouseDown={e => e.stopPropagation()}>
                  <button onClick={() => handleSorterControl(sorterState?.status === 'paused' ? 'running' : 'paused')} style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: sorterState?.status === 'paused' ? '#10b981' : '#f59e0b', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>
                    {sorterState?.status === 'paused' ? 'Возобновить' : 'Пауза'}
                  </button>
                  <button onClick={() => handleSorterControl('stopped')} style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Остановить
                  </button>
                </div>
              </div>
              <div style={{ flexGrow: 1, minHeight: 0 }}>
                <ResponsiveContainer>
                  <AreaChart data={metricsHistory}>
                    <defs>
                      <linearGradient id="colorSortSpeed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                    <Legend />
                    <Area type="step" dataKey="sortSpeed" name="Файлов/сек" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorSortSpeed)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                <span>Скорость: {latestMetrics?.sorting?.speed || 0} ф/с • Задержка: {sorterState?.delay_ms || 0}</span>
                <span>Всего: {latestMetrics?.sorting?.total_moved || 0} • {sorterState?.status || 'неизвестно'}</span>
              </div>
            </div>

            <div key="disk_space" className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '1rem', overflowY: 'auto' }}>
              <h3 className="drag-handle" style={{ cursor: 'move', userSelect: 'none', marginBottom: '1rem' }}>💾 Состояние Дисков</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
                <div>
                  <h4 style={{ color: '#10b981', marginBottom: '0.5rem' }}>Debian Server</h4>
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
                </div>
                <div>
                  <h4 style={{ color: '#3b82f6', marginBottom: '0.5rem' }}>Windows Host</h4>
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
                <div>
                  <h4 style={{ color: '#8b5cf6', marginBottom: '0.5rem' }}>TrueNAS Server</h4>
                  {!latestMetrics?.truenas || !latestMetrics.truenas.disks || latestMetrics.truenas.disks.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Нет данных дисков TrueNAS...</p>
                  ) : (
                    latestMetrics.truenas.disks.map((d, i) => (
                      <div key={'t'+i} style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span>{d.device || d.name}</span>
                          <span>{formatBytes(d.total - d.free)} / {formatBytes(d.total)} ({d.percent || 0}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '4px' }}>
                          <div style={{ width: `${d.percent || 0}%`, height: '100%', background: (d.percent || 0) > 85 ? '#ef4444' : '#8b5cf6', borderRadius: '4px' }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </ResponsiveReactGridLayout>
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
              <div key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong style={{fontSize: '1.2rem'}}>{u.username}</strong> ({u.role})</span>
                  {u.is_approved ? <span style={{color: '#10b981'}}>Одобрен</span> : (
                    <button className="path-btn" style={{color: '#10b981'}} onClick={() => approveUser(u.id)}>Одобрить</button>
                  )}
                </div>
                {u.role !== 'admin' && (
                  <div>
                    <h5 style={{ marginBottom: '0.5rem' }}>Разрешенные вкладки:</h5>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {['files', 'photos', 'videos', 'dashboard', 'tasks'].map(tabName => {
                        const hasAccess = (u.allowed_tabs || '').includes(tabName);
                        const names = {files: 'Файлы', photos: 'Фото', videos: 'Видео', dashboard: 'Дашборд', tasks: 'Диспетчер'};
                        return (
                          <label key={tabName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={hasAccess} 
                              onChange={() => updateUserPermissions(u.id, u.allowed_tabs || '', tabName)}
                            />
                            {names[tabName]}
                          </label>
                        )
                      })}
                    </div>
                  </div>
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
                  {!item.is_dir && role === 'admin' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {isAutoSorted && (
                        <button 
                          className="path-btn" 
                          style={{ color: '#10b981', padding: '0.25rem 0.5rem' }} 
                          onClick={(e) => { e.stopPropagation(); approveFile(fullPath); }}
                          title="Одобрить файл"
                        >
                          <FiCheckCircle size={20} />
                        </button>
                      )}
                      <button 
                        className="path-btn" 
                        style={{ color: '#ef4444', padding: '0.25rem 0.5rem' }} 
                        onClick={(e) => { e.stopPropagation(); deleteFile(fullPath); }}
                        title="Удалить файл"
                      >
                        <FiFile size={20} /> {/* We can use FiFile as a fallback or just use simple text if FiTrash is not imported, let's use a red X */}
                        <span style={{ fontWeight: 'bold' }}>X</span>
                      </button>
                    </div>
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
          
          {/* Top Bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(rgba(0,0,0,0.8), transparent)' }}>
            <div style={{ color: 'white', fontWeight: 'bold' }}>
              {previewFile.items[previewFile.currentIndex]?.name} ({previewFile.currentIndex + 1} / {previewFile.items.length})
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {role === 'admin' && (
                <>
                  <button className="path-btn" style={{ background: '#ef4444', color: 'white', padding: '0.5rem 1rem' }} onClick={async (e) => {
                    e.stopPropagation();
                    const currentItem = previewFile.items[previewFile.currentIndex];
                    const fullPath = previewFile.currentPath ? `${previewFile.currentPath}/${currentItem.name}` : currentItem.name;
                    const success = await deleteFile(fullPath);
                    if (success) setPreviewFile(null);
                  }}>Удалить</button>
                  
                  {previewFile.currentPath && previewFile.currentPath.toLowerCase().includes('auto_sorted') && (
                    <button className="path-btn" style={{ background: '#10b981', color: 'white', padding: '0.5rem 1rem' }} onClick={async (e) => {
                      e.stopPropagation();
                      const currentItem = previewFile.items[previewFile.currentIndex];
                      const fullPath = previewFile.currentPath ? `${previewFile.currentPath}/${currentItem.name}` : currentItem.name;
                      const success = await approveFile(fullPath);
                      if (success) setPreviewFile(null);
                    }}>Одобрить</button>
                  )}
                </>
              )}
              <button className="path-btn" style={{ color: 'white', background: 'rgba(255,255,255,0.2)', padding: '0.5rem 1rem' }} onClick={() => setPreviewFile(null)}>Закрыть</button>
            </div>
          </div>

          {/* Navigation Controls */}
          {previewFile.currentIndex > 0 && (
            <div 
              style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', padding: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', color: 'white', fontSize: '24px' }}
              onClick={(e) => { e.stopPropagation(); setPreviewFile(prev => ({ ...prev, currentIndex: prev.currentIndex - 1 })); }}
            >
              &#10094;
            </div>
          )}
          {previewFile.currentIndex < previewFile.items.length - 1 && (
            <div 
              style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', padding: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', color: 'white', fontSize: '24px' }}
              onClick={(e) => { e.stopPropagation(); setPreviewFile(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 })); }}
            >
              &#10095;
            </div>
          )}

          {/* Media Content */}
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(() => {
              const currentItem = previewFile.items[previewFile.currentIndex];
              if (!currentItem) return null;
              const fullPath = previewFile.currentPath ? `${previewFile.currentPath}/${currentItem.name}` : currentItem.name;
              const ext = currentItem.name.split('.').pop().toLowerCase();
              const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext);
              const srcUrl = `/api/file/stream?path=${encodeURIComponent(fullPath)}&access_token=${token}`;
              
              return isVideo ? (
                <video 
                  key={srcUrl}
                  controls 
                  autoPlay 
                  style={{ maxWidth: '100%', maxHeight: '90vh' }}
                  src={srcUrl}
                />
              ) : (
                <img 
                  key={srcUrl}
                  src={srcUrl} 
                  style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
                  alt="Просмотр"
                />
              );
            })()}
          </div>
        </div>
      )}
      {fullscreenImage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.9)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setFullscreenImage(null)}>
          <button className="path-btn" style={{ position: 'absolute', top: '20px', right: '20px', color: 'white', background: 'rgba(255,255,255,0.2)' }} onClick={() => setFullscreenImage(null)}>Закрыть</button>
          <img src={fullscreenImage} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} alt="Fullscreen" />
        </div>
      )}
    </div>
  )
}

export default App
