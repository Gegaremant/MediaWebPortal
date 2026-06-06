import re
import os

with open('C:/Projects/web_portal/frontend_src/App.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Add File Upload UI
upload_func = """
  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', currentPath)
    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: getHeaders(),
        body: formData
      })
      if (res.ok) {
        fetchFiles(currentPath)
      } else {
        alert("Upload failed")
      }
    } catch (err) {
      alert("Error")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (fileName) => {
    window.location.href = `/api/file/download?path=${encodeURIComponent(currentPath + '/' + fileName)}`
  }

  const handleShare = async () => {
    const res = await fetch('/api/files/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getHeaders() },
      body: JSON.stringify({path: currentPath})
    })
    if (res.ok) {
      const {token} = await res.json()
      alert(`Папка расшарена! Публичная ссылка: ${window.location.origin}/public/${token}`)
    }
  }
"""

code = code.replace("const handleBack = () => {", upload_func + "\n  const handleBack = () => {")

buttons_ui = """
          <div className="flex space-x-2">
            <button onClick={handleShare} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm text-white font-semibold">Поделиться папкой</button>
            <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded cursor-pointer text-sm text-white font-semibold">
              Загрузить файл
              <input type="file" className="hidden" onChange={handleUpload} />
            </label>
          </div>
        </div>
"""

code = code.replace('</h1>\n        </div>', '</h1>\n' + buttons_ui)

download_btn = """
                        <button onClick={() => handleDownload(item.name)} className="text-blue-400 hover:text-blue-300 mr-4">Скачать</button>
"""
code = code.replace('</button>\n                      <button onClick={() => deleteFile(item.name)}', download_btn + '</button>\n                      <button onClick={() => deleteFile(item.name)}')


# Fix AreaChart closing tag
code = code.replace('<AreaChart data={metricsHistory}>\n                  <AreaChart data={metricsHistory}', '<AreaChart data={metricsHistory}')

with open('C:/Projects/web_portal/frontend_src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated App.jsx successfully.")
