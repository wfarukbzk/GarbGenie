import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { MapPinOff, Shirt, Star, TrendingUp, Wind } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, Image, Linking,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { fetchCurrentWeatherByCoords, type CurrentWeather } from '@/lib/weather';

type WeatherUiState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; weather: CurrentWeather }
  | { status: 'permission_denied' }
  | { status: 'error'; message: string };

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const WEEK_DATA = [true, true, false, true, true, false, false]; // mock: kombin yapıldı mı

const STATS = [
  { icon: <Shirt size={20} color="#fff" />, value: '24', label: 'Kıyafet', bg: ['#667eea', '#764ba2'] as const },
  { icon: <Star size={20} color="#fff" />, value: '8', label: 'Kombin', bg: ['#f093fb', '#f5576c'] as const },
  { icon: <TrendingUp size={20} color="#fff" />, value: '5', label: 'Bu Hafta', bg: ['#4facfe', '#00f2fe'] as const },
];

const CARD_WIDTH = Dimensions.get('window').width * 0.65;

const OUTFITS = [
  { id: '1', label: 'Günlük Kombin', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400' },
  { id: '2', label: 'Ofis Kombini', image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4e5b?w=400' },
  { id: '3', label: 'Spor Kombin', image: 'https://images.unsplash.com/photo-1483721310020-03333e577078?w=400' },
  { id: '4', label: 'Gece Kombini', image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400' },
];

function WeeklyOutfitSummary() {
  const today = new Date().getDay(); // 0=Pazar
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
      <View style={styles.weekLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#000' }]} />
          <Text style={styles.legendText}>Kombin yapıldı</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#e5e5e5' }]} />
          <Text style={styles.legendText}>Boş gün</Text>
        </View>
      </View>
    </View>
  );
}

function WardrobeStats() {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>Dolap İstatistikleri</Text>
      <View style={styles.statsRow}>
        {STATS.map((s, i) => (
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
      <Text style={styles.sectionTitle}>Kombin Türleleri</Text>
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

export default function HomeScreen() {
  const [weatherState, setWeatherState] = useState<WeatherUiState>({ status: 'idle' });
  const isMountedRef = useRef(true);

  useEffect(() => { return () => { isMountedRef.current = false; }; }, []);

  const safeSet = useCallback((next: WeatherUiState) => {
    if (isMountedRef.current) setWeatherState(next);
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
      try { await loadWeather(); }
      catch (err) { safeSet({ status: 'error', message: err instanceof Error ? err.message : 'Bilinmeyen hata' }); }
    })();
  }, [loadWeather]);

  const openSettings = useCallback(async () => { try { await Linking.openSettings(); } catch {} }, []);

  const weatherData = useMemo(() => {
    if (weatherState.status === 'ready') {
      const { tempC, description, city } = weatherState.weather;
      return { city: city ?? '—', temp: `${Math.round(tempC)}°C`, desc: description };
    }
    return null;
  }, [weatherState]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      {/* WEATHER CARD — yeni tasarım */}
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.weatherCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.weatherTop}>
          <View>
            <Text style={styles.weatherCity}>{weatherData?.city ?? 'Konum alınıyor…'}</Text>
            <Text style={styles.weatherDesc}>{weatherData?.desc ?? (weatherState.status === 'permission_denied' ? 'Konum izni yok' : 'Yükleniyor…')}</Text>
          </View>
          <View style={styles.weatherTempWrap}>
            {weatherState.status === 'loading'
              ? <ActivityIndicator color="#fff" size="large" />
              : weatherState.status === 'permission_denied'
                ? <MapPinOff size={36} color="#fff" />
                : <Text style={styles.weatherTemp}>{weatherData?.temp ?? '—'}</Text>
            }
          </View>
        </View>
        <View style={styles.weatherBottom}>
          <Wind size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.weatherHint}>Hava durumuna göre kombin önerisi için aşağıdaki butona bas</Text>
        </View>
        {weatherState.status === 'permission_denied' && (
          <View style={styles.weatherActions}>
            <TouchableOpacity style={styles.weatherBtn} onPress={loadWeather}>
              <Text style={styles.weatherBtnText}>Tekrar Dene</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.weatherBtn} onPress={openSettings}>
              <Text style={styles.weatherBtnText}>Ayarları Aç</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      <Text style={styles.heroText}>GarbGenie Sizin İçin Hazır!</Text>

      <TouchableOpacity style={styles.mainButton}>
        <Text style={styles.buttonText}>Bugün Ne Giymeliyim?</Text>
      </TouchableOpacity>

      <OutfitCarousel />
      <WeeklyOutfitSummary />
      <WardrobeStats />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, paddingTop: 55, paddingBottom: 40, alignItems: 'center' },

  // Weather
  weatherCard: { width: '100%', borderRadius: 24, padding: 22, marginBottom: 28, elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  weatherTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  weatherCity: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  weatherDesc: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' },
  weatherTempWrap: { alignItems: 'flex-end' },
  weatherTemp: { fontSize: 48, fontWeight: '200', color: '#fff', lineHeight: 52 },
  weatherBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12 },
  weatherHint: { fontSize: 11, color: 'rgba(255,255,255,0.55)', flex: 1 },
  weatherActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  weatherBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999 },
  weatherBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Hero
  heroText: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 20, color: '#111' },
  mainButton: { backgroundColor: '#000', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 30, elevation: 5, marginBottom: 32, width: '100%', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  // Section
  sectionWrap: { width: '100%', marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 14 },

  // Outfit Carousel
  outfitCard: { width: CARD_WIDTH, marginRight: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f0f0f0', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  outfitImage: { width: '100%', height: 180 },
  outfitLabel: { padding: 10, fontSize: 13, fontWeight: '600', color: '#333' },

  // Weekly Summary
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f9f9f9', borderRadius: 16, padding: 16 },
  dayCol: { alignItems: 'center', gap: 8 },
  dayLabel: { fontSize: 11, color: '#999', fontWeight: '600' },
  dayLabelToday: { color: '#000', fontWeight: '800' },
  dayDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dayDotFilled: { backgroundColor: '#000' },
  dayDotEmpty: { backgroundColor: '#e5e5e5' },
  dayDotToday: { borderWidth: 2, borderColor: '#000' },
  weekLegend: { flexDirection: 'row', gap: 16, marginTop: 12, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#888' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  statValue: { fontSize: 26, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
});
