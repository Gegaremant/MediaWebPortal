import re

with open('C:/Projects/web_portal/frontend_src/App.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Imports
imports_old = "import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'"
imports_new = """import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Responsive as ResponsiveGridLayout, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveReactGridLayout = WidthProvider(ResponsiveGridLayout)"""
code = code.replace(imports_old, imports_new)

# 2. State
state_old = "  const [loadingDupes, setLoadingDupes] = useState(false)"
state_new = """  const [loadingDupes, setLoadingDupes] = useState(false)

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
  };"""
code = code.replace(state_old, state_new)

# 3. Replace Dashboard Rendering
# The entire dashboard starts with: <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
# and ends right before: ) : activeView === 'tasks' ? (

# Let's extract the actual content using regex or splitting
parts = code.split("{activeView === 'dashboard' ? (")
if len(parts) > 1:
    dashboard_section_start = parts[1]
    dashboard_parts = dashboard_section_start.split(") : activeView === 'tasks' ? (")
    
    old_dashboard_ui = dashboard_parts[0]
    
    # We will build the new dashboard UI using ResponsiveReactGridLayout
    # The inner content of old_dashboard_ui needs to be wrapped.
    
    new_dashboard_ui = """
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
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
              </div>
            </div>

          </ResponsiveReactGridLayout>
        </div>
        """
        
    code = code.replace(old_dashboard_ui, new_dashboard_ui)

with open('C:/Projects/web_portal/frontend_src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Layout updated!")
