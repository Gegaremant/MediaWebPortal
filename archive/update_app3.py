import re

with open('C:/Projects/web_portal/frontend_src/App.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

nav_item_dupes = """
            <button onClick={() => setActiveView('duplicates')} className={`flex items-center w-full px-6 py-3 hover:bg-slate-800 transition-colors ${activeView === 'duplicates' ? 'bg-slate-800 border-l-4 border-blue-500 text-blue-400' : 'text-slate-300'}`}>
              <FiXCircle className="mr-3" />
              Дубликаты
            </button>
"""
code = code.replace("Дубликаты\\n            </button>", "") # just in case
code = code.replace("Настройки\\n            </button>", "Настройки\\n            </button>\\n" + nav_item_dupes)

dupes_state = """
  // Duplicates State
  const [duplicates, setDuplicates] = useState([])
  const [loadingDupes, setLoadingDupes] = useState(false)
"""
code = code.replace("// Dashboard Data", dupes_state + "\n  // Dashboard Data")

dupes_effect = """
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
"""
code = code.replace("const fetchProcesses = async () => {", dupes_effect + "\n  const fetchProcesses = async () => {")

dupes_view = """
        {activeView === 'duplicates' && (
          <div className="bg-[#1e293b] rounded-2xl p-6 shadow-xl border border-slate-800" style={{ backgroundColor: `rgba(30, 41, 59, ${cardOpacity})` }}>
            <h2 className="text-2xl font-bold text-slate-100 mb-6 flex items-center"><FiXCircle className="mr-2 text-red-500" />Найденные Дубликаты</h2>
            {loadingDupes && duplicates.length === 0 ? <p className="text-slate-400">Загрузка...</p> : null}
            {duplicates.length === 0 && !loadingDupes ? <p className="text-green-400 font-bold text-xl mt-10 text-center">Дубликатов не найдено!</p> : null}
            <div className="space-y-4">
              {duplicates.map(d => (
                <div key={d.id} className="bg-slate-800 p-4 rounded-xl flex justify-between items-center border border-slate-700">
                  <div className="flex-1">
                    <p className="font-bold text-slate-200 break-all">{d.original_name}</p>
                    <p className="text-sm text-slate-400 mt-1">Оригинал: {d.original_dir}</p>
                    <p className="text-sm text-slate-400">Дубликат: {d.duplicate_path}</p>
                    <p className="text-sm text-blue-400 mt-1">Размер: {formatBytes(d.size)} • Время: {new Date(d.time).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col ml-4 space-y-2">
                    <button onClick={() => resolveDuplicate(d.id, 'delete')} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors shadow-lg">Удалить дубликат</button>
                    <button onClick={() => resolveDuplicate(d.id, 'keep')} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded font-bold transition-colors border border-slate-500">Оставить оба</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
"""

code = code.replace("{activeView === 'settings' && role === 'admin' && (", dupes_view + "\n        {activeView === 'settings' && role === 'admin' && (")

with open('C:/Projects/web_portal/frontend_src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Duplicates UI injected")
