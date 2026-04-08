import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CloudSun, MapPinOff } from 'lucide-react-native';
import * as Location from 'expo-location';

import { fetchCurrentWeatherByCoords, type CurrentWeather } from '@/lib/weather';

type WeatherUiState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; weather: CurrentWeather }
  | { status: 'permission_denied' }
  | { status: 'error'; message: string };

export default function HomeScreen() {
  const [weatherState, setWeatherState] = useState<WeatherUiState>({ status: 'idle' });
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetWeatherState = useCallback((next: WeatherUiState) => {
    if (!isMountedRef.current) return;
    setWeatherState(next);
  }, []);

  const weatherText = useMemo(() => {
    if (weatherState.status === 'ready') {
      const { tempC, description, city } = weatherState.weather;
      const cityPrefix = city ? `${city} • ` : '';
      return `${cityPrefix}${Math.round(tempC)}°C • ${description}`;
    }

    if (weatherState.status === 'permission_denied') {
      return 'Konum izni verilmedi • Hava durumu gösterilemiyor';
    }

    if (weatherState.status === 'error') {
      return weatherState.message;
    }

    return 'Hava durumu yükleniyor…';
  }, [weatherState]);

  const loadWeather = useCallback(async () => {
    safeSetWeatherState({ status: 'loading' });

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      safeSetWeatherState({ status: 'permission_denied' });
      return;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const weather = await fetchCurrentWeatherByCoords({
      lat: position.coords.latitude,
      lon: position.coords.longitude,
    });

    safeSetWeatherState({ status: 'ready', weather });
  }, [safeSetWeatherState]);

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadWeather();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
        safeSetWeatherState({ status: 'error', message });
      }
    })();
  }, [loadWeather, safeSetWeatherState]);

  const weatherIcon = useMemo(() => {
    if (weatherState.status === 'permission_denied') {
      return <MapPinOff size={32} color="#555" />;
    }
    return <CloudSun size={32} color="#555" />;
  }, [weatherState.status]);

  return (
    <View style={styles.container}>
      <View style={styles.weatherCard}>
        {weatherIcon}
        <View style={styles.weatherTextWrap}>
          <Text style={styles.weatherLabel}>Bugün Hava</Text>
          <Text style={styles.weatherText}>{weatherText}</Text>
        </View>
        {weatherState.status === 'loading' ? (
          <ActivityIndicator />
        ) : null}
      </View>

      <Text style={styles.heroText}>GarbGenie Sizin İçin Hazır!</Text>
      
      <TouchableOpacity style={styles.mainButton}>
        <Text style={styles.buttonText}>Bugün Ne Giymeliyim?</Text>
      </TouchableOpacity>

      {weatherState.status === 'permission_denied' ? (
        <View style={styles.permissionActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={loadWeather}>
            <Text style={styles.secondaryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={openSettings}>
            <Text style={styles.secondaryButtonText}>Ayarları Aç</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  weatherCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 15, borderRadius: 15, marginBottom: 40, width: '100%', gap: 10 },
  weatherTextWrap: { flex: 1 },
  weatherLabel: { fontSize: 12, color: '#666', marginBottom: 2 },
  weatherText: { fontSize: 16, color: '#333' },
  heroText: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 30 },
  mainButton: { backgroundColor: '#000', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 30, elevation: 5 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  permissionActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  secondaryButton: { borderWidth: 1, borderColor: '#000', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999 },
  secondaryButtonText: { color: '#000', fontWeight: '700' },
});
