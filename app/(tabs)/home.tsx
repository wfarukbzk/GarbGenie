import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { MapPinOff, Shirt, Star, TrendingUp, Wind, X, Sparkles } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, Image, Linking,
  ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, Alert
} from 'react-native';

// @ts-ignore
import { supabase } from '../../supabase'; 
import { fetchCurrentWeatherByCoords, type CurrentWeather } from '@/lib/weather';

type WeatherUiState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; weather: CurrentWeather }
  | { status: 'permission_denied' }
  | { status: 'error'; message: string };

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const WEEK_DATA = [true, true, false, true, true, false, false]; 

const CARD_WIDTH = Dimensions.get('window').width * 0.65;

const OUTFITS = [
  { id: '1', label: 'Günlük Kombin', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400' },
  { id: '2', label: 'Ofis Kombini', image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4e5b?w=400' },
  { id: '3', label: 'Spor Kombin', image: 'https://images.unsplash.com/photo-1483721310020-03333e577078?w=400' },
  { id: '4', label: 'Gece Kombini', image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400' },
];

// --- ALT BİLEŞENLER ---

function WeeklyOutfitSummary() {
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;

  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>Bu Hafta Ne Giydim?</Text>
      <View style={styles.weekRow}>
        {DAYS.map((day, i) => {
          const isToday = i === todayIndex;
          const hasOutfit = WEEK_DATA[i];
          return (
            <View key={day} style={styles.dayCol}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{day}</Text>
              <View style={[
                styles.dayDot,
                hasOutfit ? styles.dayDotFilled : styles.dayDotEmpty,
                isToday && styles.dayDotToday,
              ]}>
                {hasOutfit && <Shirt size={12} color="#fff" />}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function WardrobeStats({ clothesCount, outfitCount }: { clothesCount: number, outfitCount: number }) {
  const STAT_CARDS = [
    { icon: <Shirt size={20} color="#fff" />, value: clothesCount.toString(), label: 'Kıyafet', bg: ['#667eea', '#764ba2'] as const },
    { icon: <Star size={20} color="#fff" />, value: outfitCount.toString(), label: 'Kombin', bg: ['#f093fb', '#f5576c'] as const },
    { icon: <TrendingUp size={20} color="#fff" />, value: '5', label: 'Bu Hafta', bg: ['#4facfe', '#00f2fe'] as const },
  ];

  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>Dolap İstatistikleri</Text>
      <View style={styles.statsRow}>
        {STAT_CARDS.map((s, i) => (
          <LinearGradient key={i} colors={s.bg} style={styles.statCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {s.icon}
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </LinearGradient>
        ))}
      </View>
    </View>
  );
}

function OutfitCarousel() {
  const flatRef = useRef<FlatList>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % OUTFITS.length;
      flatRef.current?.scrollToIndex({ index: indexRef.current, animated: true });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>Kombin Türleri</Text>
      <FlatList
        ref={flatRef}
        data={OUTFITS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 4 }}
        renderItem={({ item }) => (
          <View style={styles.outfitCard}>
            <Image source={{ uri: item.image }} style={styles.outfitImage} />
            <Text style={styles.outfitLabel}>{item.label}</Text>
          </View>
        )}
      />
    </View>
  );
}

// --- ANA EKRAN ---

export default function HomeScreen() {
  const [weatherState, setWeatherState] = useState<WeatherUiState>({ status: 'idle' });
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedOutfit, setSuggestedOutfit] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  
  // İstatistik State'leri
  const [dbStats, setDbStats] = useState({ clothes: 0, outfits: 0 });
  
  const isMountedRef = useRef(true);

  useEffect(() => { return () => { isMountedRef.current = false; }; }, []);

  const safeSet = useCallback((next: WeatherUiState) => {
    if (isMountedRef.current) setWeatherState(next);
  }, []);

  // --- GERÇEK VERİ ÇEKME VE LOGLAMA ---
  const fetchStats = useCallback(async () => {
    try {
      console.log("🔍 LOG: fetchStats çalıştı...");
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log("❌ LOG: Kullanıcı oturumu bulunamadı!", userError);
        return;
      }

      console.log("👤 LOG: Giriş yapan kullanıcı ID:", user.id);

      // Veritabanından sayıyı alıyoruz
      const { count, error } = await supabase
        .from('clothes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) {
        console.log("❌ LOG: Supabase sayım hatası:", error.message);
      } else {
        console.log("✅ LOG: Veritabanından gelen kıyafet sayısı:", count);
        setDbStats({
          clothes: count || 0,
          outfits: Math.floor((count || 0) / 2)
        });
      }
    } catch (err) {
      console.log("❌ LOG: Beklenmedik hata oluştu:", err);
    }
  }, []);

  const loadWeather = useCallback(async () => {
    safeSet({ status: 'loading' });
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      safeSet({ status: 'permission_denied' }); return;
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const weather = await fetchCurrentWeatherByCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
    safeSet({ status: 'ready', weather });
  }, [safeSet]);

  useEffect(() => {
    (async () => {
      try { 
        await loadWeather(); 
        await fetchStats(); // Sayıları çekmek için çağırıyoruz
      }
      catch (err) { 
        console.log("❌ LOG: Yükleme sırasında hata:", err);
        safeSet({ status: 'error', message: err instanceof Error ? err.message : 'Bilinmeyen hata' }); 
      }
    })();
  }, [loadWeather, fetchStats]);

  const generateSuggestion = async () => {
    setIsSuggesting(true);
    try {
      const { data: clothes, error } = await supabase.from('clothes').select('*');
      if (error) throw error;

      if (!clothes || clothes.length < 2) {
        Alert.alert('Dolap Boş Kanka', 'Önce dolaba en az bir üst ve bir alt giyim ekle kanka!');
        return;
      }

      const currentTemp = weatherState.status === 'ready' ? weatherState.weather.tempC : 22;
      const targetSeasons = currentTemp < 18 ? ['Kışlık', 'Bahar'] : ['Yazlık', 'Bahar'];

      const tops = clothes.filter(c => c.category === 'Üst Giyim' && targetSeasons.includes(c.season));
      const bottoms = clothes.filter(c => c.category === 'Alt Giyim' && targetSeasons.includes(c.season));

      if (tops.length === 0 || bottoms.length === 0) {
        Alert.alert('Uygun Kıyafet Yok', 'Bu havaya uygun kombin bulamadım, biraz daha kıyafet ekle kanka!');
      } else {
        const randomTop = tops[Math.floor(Math.random() * tops.length)];
        const randomBottom = bottoms[Math.floor(Math.random() * bottoms.length)];
        setSuggestedOutfit({ top: randomTop, bottom: randomBottom });
        setShowResultModal(true);
      }
    } catch (err) {
      Alert.alert('Hata', 'Kombin oluşturulamadı kanka.');
    } finally {
      setIsSuggesting(false);
    }
  };

  const weatherData = useMemo(() => {
    if (weatherState.status === 'ready') {
      const { tempC, description, city } = weatherState.weather;
      return { city: city ?? '—', temp: `${Math.round(tempC)}°C`, desc: description };
    }
    return null;
  }, [weatherState]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.weatherCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.weatherTop}>
          <View>
            <Text style={styles.weatherCity}>{weatherData?.city ?? 'Konum alınıyor…'}</Text>
            <Text style={styles.weatherDesc}>{weatherData?.desc ?? (weatherState.status === 'permission_denied' ? 'Konum izni yok' : 'Yükleniyor…')}</Text>
          </View>
          <View style={styles.weatherTempWrap}>
            {weatherState.status === 'loading'
              ? <ActivityIndicator color="#fff" size="large" />
              : <Text style={styles.weatherTemp}>{weatherData?.temp ?? '—'}</Text>
            }
          </View>
        </View>
        <View style={styles.weatherBottom}>
          <Wind size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.weatherHint}>Hava durumuna göre en iyi kombini senin için seçeceğim kanka.</Text>
        </View>
      </LinearGradient>

      <Text style={styles.heroText}>GarbGenie Sizin İçin Hazır!</Text>

      <TouchableOpacity 
        style={styles.mainButton} 
        onPress={generateSuggestion}
        disabled={isSuggesting}
      >
        {isSuggesting ? <ActivityIndicator color="#fff" /> : (
          <>
            <Sparkles size={20} color="#fff" style={{marginRight: 10}} />
            <Text style={styles.buttonText}>Bugün Ne Giymeliyim?</Text>
          </>
        )}
      </TouchableOpacity>

      <OutfitCarousel />
      <WeeklyOutfitSummary />
      
      {/* İSTATİSTİKLER - Gerçek Veriler dbStats üzerinden geliyor */}
      <WardrobeStats clothesCount={dbStats.clothes} outfitCount={dbStats.outfits} />

      {/* SONUÇ MODALI */}
      <Modal visible={showResultModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.suggestionBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>GarbGenie Önerisi 🧞‍♂️</Text>
              <TouchableOpacity onPress={() => setShowResultModal(false)}><X size={26} color="#000" /></TouchableOpacity>
            </View>
            <Text style={styles.suggestionDesc}>Bu havada harika görüneceksin kanka:</Text>
            
            <View style={styles.outfitPair}>
              <View style={styles.suggestedCard}>
                <Image source={{ uri: suggestedOutfit?.top?.image_url }} style={styles.suggestedImg} />
                <Text style={styles.suggestedLabel}>Üst Giyim</Text>
              </View>
              <View style={styles.suggestedCard}>
                <Image source={{ uri: suggestedOutfit?.bottom?.image_url }} style={styles.suggestedImg} />
                <Text style={styles.suggestedLabel}>Alt Giyim</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowResultModal(false)}>
              <Text style={styles.closeBtnText}>Kombini Beğendim!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, paddingTop: 55, paddingBottom: 40, alignItems: 'center' },
  weatherCard: { width: '100%', borderRadius: 24, padding: 22, marginBottom: 28, elevation: 8 },
  weatherTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  weatherCity: { fontSize: 20, fontWeight: '800', color: '#fff' },
  weatherDesc: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' },
  weatherTempWrap: { alignItems: 'flex-end' },
  weatherTemp: { fontSize: 48, fontWeight: '200', color: '#fff' },
  weatherBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12 },
  weatherHint: { fontSize: 11, color: 'rgba(255,255,255,0.55)', flex: 1 },
  heroText: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 20, color: '#111' },
  mainButton: { backgroundColor: '#000', paddingVertical: 18, borderRadius: 30, marginBottom: 32, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  sectionWrap: { width: '100%', marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 14 },
  outfitCard: { width: CARD_WIDTH, marginRight: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f0f0f0' },
  outfitImage: { width: '100%', height: 180 },
  outfitLabel: { padding: 10, fontSize: 13, fontWeight: '600', color: '#333' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f9f9f9', borderRadius: 16, padding: 16 },
  dayCol: { alignItems: 'center', gap: 8 },
  dayLabel: { fontSize: 11, color: '#999', fontWeight: '600' },
  dayLabelToday: { color: '#000', fontWeight: '800' },
  dayDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dayDotFilled: { backgroundColor: '#000' },
  dayDotEmpty: { backgroundColor: '#e5e5e5' },
  dayDotToday: { borderWidth: 2, borderColor: '#000' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 },
  statValue: { fontSize: 26, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  suggestionBox: { backgroundColor: '#fff', borderRadius: 30, padding: 25, width: '100%', alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 15, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  suggestionDesc: { fontSize: 14, color: '#666', marginBottom: 20 },
  outfitPair: { flexDirection: 'row', gap: 15, marginBottom: 25 },
  suggestedCard: { flex: 1, alignItems: 'center' },
  suggestedImg: { width: '100%', height: 200, borderRadius: 15, marginBottom: 8 },
  suggestedLabel: { fontSize: 12, fontWeight: 'bold', color: '#888' },
  closeBtn: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 20, width: '100%', alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});