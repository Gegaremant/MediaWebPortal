import re

with open('C:/Projects/web_portal/frontend_src/App.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update Sidebar
sidebar_old = """          <nav className="flex-1 mt-6">
            <button onClick={() => setActiveView('dashboard')} className={`flex items-center w-full px-6 py-3 text-left transition-colors duration-200 ${activeView === 'dashboard' ? 'bg-primary/20 text-primary border-r-4 border-primary' : 'text-gray-400 hover:bg-surface-light hover:text-white'}`}>
              <FiActivity className="mr-3 text-lg" />
              Дашборд
            </button>
            <button onClick={() => setActiveView('files')} className={`flex items-center w-full px-6 py-3 text-left transition-colors duration-200 ${activeView === 'files' ? 'bg-primary/20 text-primary border-r-4 border-primary' : 'text-gray-400 hover:bg-surface-light hover:text-white'}`}>
              <FiFolder className="mr-3 text-lg" />
              Браузер файлов
            </button>"""

sidebar_new = """          <nav className="flex-1 mt-6">
            <button onClick={() => setActiveView('dashboard')} className={`flex items-center w-full px-6 py-3 text-left transition-colors duration-200 ${activeView === 'dashboard' ? 'bg-primary/20 text-primary border-r-4 border-primary' : 'text-gray-400 hover:bg-surface-light hover:text-white'}`}>
              <FiActivity className="mr-3 text-lg" />
              Дашборд
            </button>
            <button onClick={() => setActiveView('files')} className={`flex items-center w-full px-6 py-3 text-left transition-colors duration-200 ${activeView === 'files' ? 'bg-primary/20 text-primary border-r-4 border-primary' : 'text-gray-400 hover:bg-surface-light hover:text-white'}`}>
              <FiFolder className="mr-3 text-lg" />
              Файлы
            </button>
            <button onClick={() => setActiveView('photos')} className={`flex items-center w-full px-6 py-3 text-left transition-colors duration-200 ${activeView === 'photos' ? 'bg-primary/20 text-primary border-r-4 border-primary' : 'text-gray-400 hover:bg-surface-light hover:text-white'}`}>
              <FiImage className="mr-3 text-lg" />
              Фото
            </button>
            <button onClick={() => setActiveView('videos')} className={`flex items-center w-full px-6 py-3 text-left transition-colors duration-200 ${activeView === 'videos' ? 'bg-primary/20 text-primary border-r-4 border-primary' : 'text-gray-400 hover:bg-surface-light hover:text-white'}`}>
              <FiVideo className="mr-3 text-lg" />
              Видео
            </button>"""
code = code.replace(sidebar_old, sidebar_new)

# Add FiImage and FiVideo to imports
imports_old = "import { FiFolder, FiFile, FiUpload, FiDownload, FiTrash2, FiActivity, FiSettings, FiCheckCircle, FiCopy, FiCheck, FiX, FiLink, FiLayers } from 'react-icons/fi'"
imports_new = "import { FiFolder, FiFile, FiUpload, FiDownload, FiTrash2, FiActivity, FiSettings, FiCheckCircle, FiCopy, FiCheck, FiX, FiLink, FiLayers, FiImage, FiVideo } from 'react-icons/fi'"
code = code.replace(imports_old, imports_new)

# Add state for galleries
state_old = "  const [loadingDupes, setLoadingDupes] = useState(false)"
state_new = """  const [loadingDupes, setLoadingDupes] = useState(false)
  const [galleryPhotos, setGalleryPhotos] = useState([])
  const [galleryVideos, setGalleryVideos] = useState([])
  const [galleryOffset, setGalleryOffset] = useState(0)
  const [hasMoreGallery, setHasMoreGallery] = useState(true)
  const [loadingGallery, setLoadingGallery] = useState(false)
  const observerTarget = useRef(null)

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
      loadGallery(activeView, true);
    }
  }, [activeView]);

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
"""
code = code.replace(state_old, state_new)

# Add Views
views_old = "{activeView === 'dashboard' ? ("
views_new = """{activeView === 'photos' ? (
        <div style={{ width: '100%' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>📸 Галерея Фотографий</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {galleryPhotos.map((p, i) => (
              <div key={i} onClick={() => setFullscreenImage(`/api/file/download?path=${encodeURIComponent(p)}`)} style={{ cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', height: '200px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                <img src={`/api/file/download?path=${encodeURIComponent(p)}`} alt="photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
              </div>
            ))}
          </div>
          {loadingGallery && <div style={{ textAlign: 'center', padding: '2rem' }}>Загрузка...</div>}
          <div ref={observerTarget} style={{ height: '20px' }}></div>
        </div>
      ) : activeView === 'videos' ? (
        <div style={{ width: '100%' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>🎬 Галерея Видео</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {galleryVideos.map((v, i) => (
              <div key={i} style={{ borderRadius: '8px', overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                <video src={`/api/file/download?path=${encodeURIComponent(v)}`} controls preload="metadata" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                <div style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.split('/').pop()}
                </div>
              </div>
            ))}
          </div>
          {loadingGallery && <div style={{ textAlign: 'center', padding: '2rem' }}>Загрузка...</div>}
          <div ref={observerTarget} style={{ height: '20px' }}></div>
        </div>
      ) : activeView === 'dashboard' ? ("""
code = code.replace(views_old, views_new)

with open('C:/Projects/web_portal/frontend_src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Frontend updated with media galleries!")
