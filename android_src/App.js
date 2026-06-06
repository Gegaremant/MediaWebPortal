import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Image, Alert, ScrollView, PanResponder } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Feather';
import Video from 'react-native-video';

const API_URL = 'https://portal.gegaremant.ru';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('token').then(t => {
      if (t) navigation.replace('Main');
    });
  }, []);

  const login = async () => {
    setLoading(true);
    try {
      const formBody = [];
      formBody.push(encodeURIComponent('username') + '=' + encodeURIComponent(username));
      formBody.push(encodeURIComponent('password') + '=' + encodeURIComponent(password));
      
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.join('&')
      });
      const data = await res.json();
      if (res.ok) {
        await AsyncStorage.setItem('token', data.access_token);
        navigation.replace('Main');
      } else {
        Alert.alert('Ошибка', data.detail || 'Неверные данные');
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Медиа Архив</Text>
      <TextInput
        style={styles.input}
        placeholder="Имя пользователя"
        placeholderTextColor="#94a3b8"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        placeholderTextColor="#94a3b8"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={login} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Войти</Text>}
      </TouchableOpacity>
    </View>
  );
};

const DashboardScreen = ({ navigation }) => {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      const token = await AsyncStorage.getItem('token');
      try {
        const res = await fetch(`${API_URL}/api/admin/metrics`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setMetrics(await res.json());
        }
      } catch (e) {}
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    navigation.replace('Login');
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderDisks = (disks) => {
    if (!disks || disks.length === 0) return <Text style={{ color: '#94a3b8', fontSize: 12 }}>Нет данных о дисках</Text>;
    return disks.map((d, i) => (
      <View key={i} style={{ marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ color: '#e2e8f0', fontSize: 12 }}>{d.mountpoint || d.device || d.name}</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>{formatBytes(d.total - d.free)} / {formatBytes(d.total)} ({(d.percent || 0).toFixed(1)}%)</Text>
        </View>
        <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
          <View style={{ width: `${d.percent || 0}%`, height: '100%', backgroundColor: (d.percent || 0) > 85 ? '#ef4444' : '#3b82f6', borderRadius: 3 }} />
        </View>
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Дэшборд</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Icon name="log-out" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>
      {metrics ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={{ marginTop: 20 }}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🔥 TrueNAS Server</Text>
              <Text style={styles.text}>CPU: {metrics.truenas?.cpu || 0}% | RAM: {metrics.truenas?.ram || 0}%</Text>
              <Text style={styles.text}>Диск (MB/s): {(((metrics.truenas?.disk_read || 0) + (metrics.truenas?.disk_write || 0)) / 1024 / 1024).toFixed(1)}</Text>
              <Text style={styles.text}>Сеть (MB/s): {(((metrics.truenas?.net_tx || 0) + (metrics.truenas?.net_rx || 0)) / 1024 / 1024).toFixed(1)}</Text>
              <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10 }}>
                {renderDisks(metrics.truenas?.disks)}
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Debian Сервер</Text>
              <Text style={styles.text}>CPU: {metrics.debian?.cpu}% | RAM: {metrics.debian?.ram}%</Text>
              <Text style={styles.text}>Диск (MB/s): {(((metrics.debian?.disk_read || 0) + (metrics.debian?.disk_write || 0)) / 1024 / 1024).toFixed(1)}</Text>
              <Text style={styles.text}>Сеть (MB/s): {(((metrics.debian?.net_tx || 0) + (metrics.debian?.net_rx || 0)) / 1024 / 1024).toFixed(1)}</Text>
              <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10 }}>
                {renderDisks(metrics.debian?.disks)}
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Windows ПК</Text>
              {!metrics.windows ? (
                <Text style={{ color: '#94a3b8', fontSize: 12 }}>Агент недоступен</Text>
              ) : (
                <>
                  <Text style={styles.text}>CPU: {metrics.windows?.cpu}% | RAM: {metrics.windows?.ram}%</Text>
                  <Text style={styles.text}>Диск (MB/s): {(((metrics.windows?.disk_read || 0) + (metrics.windows?.disk_write || 0)) / 1024 / 1024).toFixed(1)}</Text>
                  <Text style={styles.text}>Сеть (MB/s): {(((metrics.windows?.net_tx || 0) + (metrics.windows?.net_rx || 0)) / 1024 / 1024).toFixed(1)}</Text>
                  <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10 }}>
                    {renderDisks(metrics.windows?.disks)}
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      ) : (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      )}
    </View>
  );
};

const FilesScreen = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState('');

  const fetchFiles = async (reqPath = '') => {
    setLoading(true);
    const token = await AsyncStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/files?path=${encodeURIComponent(reqPath)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setFiles(await res.json());
        setPath(reqPath);
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить файлы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles('');
  }, []);

  const handleItemPress = (item) => {
    if (item.is_dir) {
      fetchFiles(path ? `${path}/${item.name}` : item.name);
    } else {
      // Preview logic can be added here
      Alert.alert('Файл', item.name);
    }
  };

  const handleBack = () => {
    if (!path) return;
    const parts = path.split('/');
    parts.pop();
    fetchFiles(parts.join('/'));
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.fileItem} onPress={() => handleItemPress(item)}>
      <Icon
        name={item.is_dir ? "folder" : (item.name.match(/\.(mp4|avi|mov|mkv)$/i) ? "video" : (item.name.match(/\.(jpg|jpeg|png|gif)$/i) ? "image" : "file"))}
        size={24}
        color={item.is_dir ? "#f59e0b" : "#3b82f6"}
      />
      <Text style={styles.fileName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Медиа Архив</Text>
      </View>
      {path !== '' && (
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-left" size={20} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 8 }}>Назад</Text>
        </TouchableOpacity>
      )}
      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.name}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
};


const GalleryScreen = ({ type }) => {
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  useEffect(() => {
    if (items.length > 0 && currentIndex >= items.length - 3 && hasMore) {
      loadItems(false);
    }
  }, [currentIndex, items]);

  const handleApprove = async (itemPath) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/file/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ path: itemPath })
      });
      if (res.ok) {
        setItems(prev => prev.filter(p => p !== itemPath));
      } else {
        Alert.alert('Ошибка', 'Не удалось одобрить файл');
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Проверьте подключение к сети');
    }
  };

  const handleDelete = async (itemPath) => {
    Alert.alert('Удаление', 'Точно удалить этот файл?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/file/delete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ path: itemPath })
            });
            if (res.ok) {
              setItems(prev => prev.filter(p => p !== itemPath));
            } else {
              Alert.alert('Ошибка', 'Не удалось удалить файл');
            }
          } catch (e) {
            Alert.alert('Ошибка', 'Проверьте подключение к сети');
          }
      }}
    ]);
  };

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderRelease: (evt, gestureState) => {
      if (gestureState.dx > 50) {
        // Swipe Right (Previous)
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
      } else if (gestureState.dx < -50) {
        // Swipe Left (Next)
        if (currentIndex < items.length - 1) setCurrentIndex(currentIndex + 1);
      }
    }
  }), [currentIndex, items.length]);

  const renderFullscreenMedia = () => {
    if (items.length === 0) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {loading ? <ActivityIndicator size="large" color="#3b82f6" /> : <Text style={{ color: '#94a3b8' }}>Нет медиафайлов</Text>}
        </View>
      );
    }

    const index = Math.min(currentIndex, items.length - 1);
    const currentItem = items[index];
    const isAutoSorted = currentItem.toLowerCase().includes('auto_sorted');
    const fileUrl = `${API_URL}/api/file/download?path=${encodeURIComponent(currentItem)}`;
    const streamUrl = `${API_URL}/api/file/stream?path=${encodeURIComponent(currentItem)}`;

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }} {...panResponder.panHandlers}>
        <View style={{ position: 'absolute', top: 10, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5, zIndex: 20 }}>
          <Text style={{ color: '#fff' }}>{index + 1} из {items.length}</Text>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {type === 'photos' ? (
            <Image source={{ uri: fileUrl }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
          ) : (
            <Video source={{ uri: streamUrl }} style={{ width: '100%', height: '100%' }} controls={true} resizeMode="contain" />
          )}
        </View>

        {/* Navigation Buttons Overlay */}
        {index > 0 && (
          <TouchableOpacity 
            style={{ position: 'absolute', left: 10, top: '45%', backgroundColor: 'rgba(255,255,255,0.2)', padding: 15, borderRadius: 30, zIndex: 10 }}
            onPress={() => setCurrentIndex(index - 1)}
          >
            <Icon name="chevron-left" size={30} color="#fff" />
          </TouchableOpacity>
        )}
        {index < items.length - 1 && (
          <TouchableOpacity 
            style={{ position: 'absolute', right: 10, top: '45%', backgroundColor: 'rgba(255,255,255,0.2)', padding: 15, borderRadius: 30, zIndex: 10 }}
            onPress={() => setCurrentIndex(index + 1)}
          >
            <Icon name="chevron-right" size={30} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Actions Container */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', padding: 20, gap: 15, backgroundColor: 'rgba(0,0,0,0.8)' }}>
          {isAutoSorted && (
            <TouchableOpacity style={{ backgroundColor: '#10b981', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 }} onPress={() => handleApprove(currentItem)}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Одобрить</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={{ backgroundColor: '#ef4444', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 }} onPress={() => handleDelete(currentItem)}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Удалить</Text>
          </TouchableOpacity>
        </View>
        {loading && <ActivityIndicator size="small" color="#3b82f6" style={{ position: 'absolute', bottom: 80, right: 20 }} />}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{type === 'photos' ? 'Галерея Фото' : 'Галерея Видео'}</Text>
      </View>
      {renderFullscreenMedia()}
    </View>
  );
};

const PhotosScreen = () => <GalleryScreen type="photos" />;
const VideosScreen = () => <GalleryScreen type="videos" />;

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ color, size }) => {
        let iconName = route.name === 'Dashboard' ? 'activity' : 'folder';
        return <Icon name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#3b82f6',
      tabBarInactiveTintColor: '#94a3b8',
      tabBarStyle: { backgroundColor: '#1e293b', borderTopColor: '#334155' }
    })}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Стат.' }} />
    <Tab.Screen name="Files" component={FilesScreen} options={{ title: 'Файлы' }} />
    <Tab.Screen name="Photos" component={PhotosScreen} options={{ title: 'Фото', tabBarIcon: ({color, size}) => <Icon name="image" size={size} color={color} /> }} />
    <Tab.Screen name="Videos" component={VideosScreen} options={{ title: 'Видео', tabBarIcon: ({color, size}) => <Icon name="video" size={size} color={color} /> }} />
  </Tab.Navigator>
);

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 100,
    marginBottom: 40,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#3b82f6',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 18,
    color: '#3b82f6',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  text: {
    color: '#cbd5e1',
    fontSize: 16,
    marginBottom: 4,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e293b',
    marginBottom: 8,
    borderRadius: 8,
  },
  fileName: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#334155',
  }
});
