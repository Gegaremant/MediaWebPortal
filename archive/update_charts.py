import re

with open('C:/Projects/web_portal/frontend_src/App.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update fetchMetrics history push
history_old = """              const newRecord = {
                time: timeStr,
                debCpu: data.debian?.cpu || 0,
                debRam: data.debian?.ram || 0,
                debNet: ((data.debian?.net_tx || 0) + (data.debian?.net_rx || 0)) / 1024 / 1024,
                winCpu: data.windows?.cpu || 0,
                winRam: data.windows?.ram || 0,
                winNet: ((data.windows?.net_tx || 0) + (data.windows?.net_rx || 0)) / 1024 / 1024,
                sortSpeed: data.sorting?.speed || 0,
              }"""

history_new = """              const newRecord = {
                time: timeStr,
                debCpu: data.debian?.cpu || 0,
                debRam: data.debian?.ram || 0,
                debNet: ((data.debian?.net_tx || 0) + (data.debian?.net_rx || 0)) / 1024 / 1024,
                debDiskIO: ((data.debian?.disk_read || 0) + (data.debian?.disk_write || 0)) / 1024 / 1024,
                winCpu: data.windows?.cpu || 0,
                winRam: data.windows?.ram || 0,
                winNet: ((data.windows?.net_tx || 0) + (data.windows?.net_rx || 0)) / 1024 / 1024,
                winDiskIO: ((data.windows?.disk_read || 0) + (data.windows?.disk_write || 0)) / 1024 / 1024,
                sortSpeed: data.sorting?.speed || 0,
              }"""

code = code.replace(history_old, history_new)

# 2. Fix Network Chart Axes
net_chart_old = """                    <Area type="monotone" dataKey="winNet" name="Windows MB/s" stroke="#ec4899" fillOpacity={1} fill="url(#colorWinNet)" />
                  </AreaChart>"""

net_chart_new = """                    <Area type="monotone" dataKey="debNet" name="Debian MB/s" stroke="#f59e0b" fillOpacity={1} fill="url(#colorDebNet)" />
                    <Area type="monotone" dataKey="winNet" name="Windows MB/s" stroke="#ec4899" fillOpacity={1} fill="url(#colorWinNet)" />
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                    <Legend />
                  </AreaChart>"""

code = code.replace(net_chart_old, net_chart_new)

# 3. Add RAM and Disk IO Charts
new_charts = """
            <div className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <h3>🧠 Использование ОЗУ (%)</h3>
              <div style={{ height: '200px', width: '100%', marginTop: '1rem' }}>
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

            <div className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <h3>💿 Активность Дисков (MB/s)</h3>
              <div style={{ height: '200px', width: '100%', marginTop: '1rem' }}>
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
"""

code = code.replace("          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>\n             <div className=\"file-card\"", "          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>\n" + new_charts + "\n             <div className=\"file-card\"")


with open('C:/Projects/web_portal/frontend_src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Charts successfully updated.")
