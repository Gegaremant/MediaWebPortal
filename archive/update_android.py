import re

with open('C:/Projects/web_portal/android_src/App.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update Dashboard Screen
dashboard_old = """          <View style={styles.card}>
            <Text style={styles.cardTitle}>Debian Сервер</Text>
            <Text style={styles.text}>CPU: {metrics.debian?.cpu}%</Text>
            <Text style={styles.text}>RAM: {metrics.debian?.ram}%</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Windows ПК</Text>
            <Text style={styles.text}>CPU: {metrics.windows?.cpu}%</Text>
            <Text style={styles.text}>RAM: {metrics.windows?.ram}%</Text>
          </View>"""
          
dashboard_new = """          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔥 TrueNAS</Text>
            <Text style={styles.text}>CPU: {metrics.truenas?.cpu || 0}%</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Debian Сервер</Text>
            <Text style={styles.text}>CPU: {metrics.debian?.cpu}% | RAM: {metrics.debian?.ram}%</Text>
            <Text style={styles.text}>Диск (MB/s): {(((metrics.debian?.disk_read || 0) + (metrics.debian?.disk_write || 0)) / 1024 / 1024).toFixed(1)}</Text>
            <Text style={styles.text}>Сеть (MB/s): {(((metrics.debian?.net_tx || 0) + (metrics.debian?.net_rx || 0)) / 1024 / 1024).toFixed(1)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Windows ПК</Text>
            <Text style={styles.text}>CPU: {metrics.windows?.cpu}% | RAM: {metrics.windows?.ram}%</Text>
            <Text style={styles.text}>Диск (MB/s): {(((metrics.windows?.disk_read || 0) + (metrics.windows?.disk_write || 0)) / 1024 / 1024).toFixed(1)}</Text>
            <Text style={styles.text}>Сеть (MB/s): {(((metrics.windows?.net_tx || 0) + (metrics.windows?.net_rx || 0)) / 1024 / 1024).toFixed(1)}</Text>
          </View>"""

code = code.replace(dashboard_old, dashboard_new)

# 2. Add Gallery Screens
gallery_screens = """
const GalleryScreen = ({ type }) => {
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadItems = async (reset = false) => {
    if (loading || (!hasMore && !reset)) return;
    setLoading(true);
    const limit = type === 'photos' ? 50 : 20;
    const currentOffset = reset ? 0 : offset;
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/media/${type}?offset=${currentOffset}&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(reset ? data.items : [...items, ...data.items]);
        setOffset(currentOffset + limit);
        setHasMore(data.items.length === limit);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadItems(true);
  }, []);

  const renderItem = ({ item }) => {
    const fileUrl = `${API_URL}/api/file/download?path=${encodeURIComponent(item)}`;
    if (type === 'photos') {
      return (
        <TouchableOpacity style={{ flex: 1, margin: 2, height: 120, backgroundColor: '#1e293b' }} onPress={() => Alert.alert('Фото', item)}>
          <Image source={{ uri: fileUrl }} style={{ flex: 1, resizeMode: 'cover' }} />
        </TouchableOpacity>
      );
    } else {
      return (
        <View style={{ flex: 1, margin: 8, height: 200, backgroundColor: '#1e293b', borderRadius: 8, overflow: 'hidden' }}>
          <Video source={{ uri: fileUrl }} style={{ flex: 1 }} controls={true} resizeMode="cover" />
          <Text style={{ color: '#94a3b8', padding: 8, fontSize: 12 }} numberOfLines={1}>{item.split('/').pop()}</Text>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{type === 'photos' ? 'Галерея Фото' : 'Галерея Видео'}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        numColumns={type === 'photos' ? 3 : 1}
        onEndReached={() => loadItems(false)}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading && <ActivityIndicator size="small" color="#3b82f6" style={{ margin: 20 }} />}
      />
    </View>
  );
};

const PhotosScreen = () => <GalleryScreen type="photos" />;
const VideosScreen = () => <GalleryScreen type="videos" />;
"""

code = code.replace("const MainTabs = () => (", gallery_screens + "\nconst MainTabs = () => (")

# 3. Update MainTabs
tabs_old = """    <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Статистика' }} />
    <Tab.Screen name="Files" component={FilesScreen} options={{ title: 'Файлы' }} />
  </Tab.Navigator>"""
  
tabs_new = """    <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Стат.' }} />
    <Tab.Screen name="Files" component={FilesScreen} options={{ title: 'Файлы' }} />
    <Tab.Screen name="Photos" component={PhotosScreen} options={{ title: 'Фото', tabBarIcon: ({color, size}) => <Icon name="image" size={size} color={color} /> }} />
    <Tab.Screen name="Videos" component={VideosScreen} options={{ title: 'Видео', tabBarIcon: ({color, size}) => <Icon name="video" size={size} color={color} /> }} />
  </Tab.Navigator>"""

code = code.replace(tabs_old, tabs_new)

with open('C:/Projects/web_portal/android_src/App.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Android App.js updated!")
