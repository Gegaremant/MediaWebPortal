import re

with open('C:/Projects/web_portal/frontend_src/App.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Update CPU Chart to include TrueNAS
cpu_old = """                    <Area type="monotone" dataKey="debCpu" name="Debian CPU %" stroke="#10b981" fillOpacity={1} fill="url(#colorDebCpu)" />
                    <Area type="monotone" dataKey="winCpu" name="Windows CPU %" stroke="#3b82f6" fillOpacity={1} fill="url(#colorWinCpu)" />"""
cpu_new = """                    <Area type="monotone" dataKey="debCpu" name="Debian CPU %" stroke="#10b981" fillOpacity={1} fill="url(#colorDebCpu)" />
                    <Area type="monotone" dataKey="winCpu" name="Windows CPU %" stroke="#3b82f6" fillOpacity={1} fill="url(#colorWinCpu)" />
                    <Area type="monotone" dataKey="tnCpu" name="TrueNAS CPU %" stroke="#f43f5e" fillOpacity={1} fill="rgba(244,63,94,0.1)" />"""
code = code.replace(cpu_old, cpu_new)

# Update metrics history push to include TrueNAS
history_old = """                winNet: ((data.windows?.net_tx || 0) + (data.windows?.net_rx || 0)) / 1024 / 1024,
                winDiskIO: ((data.windows?.disk_read || 0) + (data.windows?.disk_write || 0)) / 1024 / 1024,"""
history_new = """                winNet: ((data.windows?.net_tx || 0) + (data.windows?.net_rx || 0)) / 1024 / 1024,
                winDiskIO: ((data.windows?.disk_read || 0) + (data.windows?.disk_write || 0)) / 1024 / 1024,
                tnCpu: data.truenas?.cpu || 0,"""
code = code.replace(history_old, history_new)

with open('C:/Projects/web_portal/frontend_src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("App.jsx updated with TrueNAS frontend code.")
