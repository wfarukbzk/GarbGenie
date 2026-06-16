import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { CalendarDays, Shirt, Sparkles, Star, TrendingUp, Wind, X, RefreshCw } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

// @ts-ignore
import { suggestOutfit, type OutfitCombinationKey } from '@/lib/gemini-outfit';
import { fetchCurrentWeatherByCoords, type CurrentWeather } from '@/lib/weather';
import { supabase } from '../../supabase';

type WeatherUiState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; weather: CurrentWeather }
  | { status: 'permission_denied' }
  | { status: 'error'; message: string };

type ClothingItem = {
  id: string;
  image_url: string;
  category: string;
  season: string;
};

// KANKA BAKIŞI: Full Outfit için yeni parçalar
type SuggestedOutfit = {
  top: ClothingItem;
  bottom: ClothingItem;
  shoes?: ClothingItem;
  outerwear?: ClothingItem;
  accessory?: ClothingItem;
  reason?: string;
};

type SavedOutfit = SuggestedOutfit & {
  id: string;
  dayIndex: number;
  createdAt: string;
};

const DAYS = ['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTHS = ['Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran', 'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'];
const SAVED_OUTFITS_KEY = 'garbgenie:saved-outfits';
const CARD_WIDTH = Dimensions.get('window').width * 0.65;

const OUTFITS = [
  { id: '1', label: 'Gunluk Kombin', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400' },
  { id: '2', label: 'Ofis Kombini', image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4e5b?w=400' },
  { id: '3', label: 'Spor Kombin', image: 'https://images.unsplash.com/photo-1483721310020-03333e577078?w=400' },
  { id: '4', label: 'Gece Kombini', image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400' },
];

function getTodayIndex() {
  const today = new Date().getDay();
  return today === 0 ? 6 : today - 1;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: Date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function getMonthMatrix(baseDate: Date) {
  const firstDayOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(firstDayOfMonth.getDate() - startOffset);

  return Array.from({ length: 35 }, (_, index) => {
    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate() + index);
    return cellDate;
  });
}

function WeeklyOutfitSummary({
  savedOutfits,
  onSelectDay,
  onOpenCalendar,
}: {
  savedOutfits: SavedOutfit[];
  onSelectDay: (dayIndex: number) => void;
  onOpenCalendar: () => void;
}) {
  const todayIndex = getTodayIndex();

  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bu Hafta Ne Giymeliyim?</Text>
        <TouchableOpacity style={styles.calendarButton} onPress={onOpenCalendar} activeOpacity={0.8}>
          <CalendarDays size={18} color="#666" />
        </TouchableOpacity>
      </View>
      <View style={styles.weekRow}>
        {DAYS.map((day, i) => {
          const isToday = i === todayIndex;
          const dayOutfits = savedOutfits.filter((outfit) => outfit.dayIndex === i);
          const hasOutfit = dayOutfits.length > 0;

          return (
            <TouchableOpacity key={day} style={styles.dayCol} activeOpacity={0.8} onPress={() => onSelectDay(i)}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{day}</Text>
              <View style={[styles.dayDot, hasOutfit ? styles.dayDotFilled : styles.dayDotEmpty, isToday && styles.dayDotToday]}>
                {hasOutfit ? <Text style={styles.dayDotCount}>{dayOutfits.length}</Text> : <Shirt size={12} color="#9a9a9a" />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.weekHint}>Bir gune dokun, o gun icin begendigin kombinleri gorelim.</Text>
    </View>
  );
}

function WardrobeStats({ clothesCount, outfitCount }: { clothesCount: number; outfitCount: number }) {
  const statCards = [
    { icon: <Shirt size={20} color="#fff" />, value: clothesCount.toString(), label: 'Kiyafet', bg: ['#667eea', '#764ba2'] as const },
    { icon: <Star size={20} color="#fff" />, value: outfitCount.toString(), label: 'Kombin', bg: ['#f093fb', '#f5576c'] as const },
    { icon: <TrendingUp size={20} color="#fff" />, value: outfitCount > 9 ? '9+' : outfitCount.toString(), label: 'Bu Hafta', bg: ['#4facfe', '#00f2fe'] as const },
  ];

  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>Dolap Istatistikleri</Text>
      <View style={styles.statsRow}>
        {statCards.map((card, index) => (
          <LinearGradient key={index} colors={card.bg} style={styles.statCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {card.icon}
            <Text style={styles.statValue}>{card.value}</Text>
            <Text style={styles.statLabel}>{card.label}</Text>
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
      <Text style={styles.sectionTitle}>Kombin Turleri</Text>
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
  const router = useRouter();
  const { user } = useAuth();
  const [weatherState, setWeatherState] = useState<WeatherUiState>({ status: 'idle' });
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedOutfit, setSuggestedOutfit] = useState<SuggestedOutfit | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [selectedWeekDay, setSelectedWeekDay] = useState<number | null>(null);
  const [showDayOutfitsModal, setShowDayOutfitsModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState(() => formatDateKey(new Date()));
  const [dbStats, setDbStats] = useState({ clothes: 0, outfits: 0 });
  const [recentCombinations, setRecentCombinations] = useState<OutfitCombinationKey[]>([]);
  const [showProfileReminderModal, setShowProfileReminderModal] = useState(false);

  // YENİ: Dolabı ve Değişim Ekranını Yönetmek İçin Eklenen State'ler
  const [wardrobeItems, setWardrobeItems] = useState<ClothingItem[]>([]);
  const [changingPart, setChangingPart] = useState<'top' | 'bottom' | 'shoes' | 'outerwear' | 'accessory' | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSet = useCallback((next: WeatherUiState) => {
    if (isMountedRef.current) {
      setWeatherState(next);
    }
  }, []);

  const checkProfileCompletion = useCallback((currentUser: any) => {
    const age = currentUser?.user_metadata?.age;
    const gender = currentUser?.user_metadata?.gender;
    const profession = currentUser?.user_metadata?.profession;
    return Boolean(age && gender && profession);
  }, []);

  // YENİ: Dolaptaki tüm kıyafetleri arka planda hafızaya alan fonksiyon
  const fetchAllClothes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('clothes').select('*').eq('user_id', user.id);
    if (data) {
      setWardrobeItems(data);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setShowProfileReminderModal(false);
      setWardrobeItems([]);
      return;
    }

    const completed = checkProfileCompletion(user);
    setShowProfileReminderModal(!completed);
    fetchAllClothes(); // Oturum açılınca dolabı doldur
  }, [user, checkProfileCompletion, fetchAllClothes]);

  const getSavedOutfitsKey = useCallback(() => {
    return user ? `${SAVED_OUTFITS_KEY}:${user.id}` : SAVED_OUTFITS_KEY;
  }, [user]);

  const loadSavedOutfits = useCallback(async () => {
    if (!user) {
      setSavedOutfits([]);
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(getSavedOutfitsKey());
      const parsed = stored ? (JSON.parse(stored) as SavedOutfit[]) : [];
      setSavedOutfits(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.log('Kayitli kombinler okunamadi:', error);
      setSavedOutfits([]);
    }
  }, [getSavedOutfitsKey, user]);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setDbStats({ clothes: 0, outfits: 0 });
      return;
    }

    try {
      const { count, error } = await supabase.from('clothes').select('*', { count: 'exact', head: true }).eq('user_id', user.id);

      if (!error) {
        setDbStats({
          clothes: count || 0,
          outfits: savedOutfits.length,
        });
      }
    } catch (error) {
      console.log('Istatistikler alinamadi:', error);
      setDbStats({ clothes: 0, outfits: savedOutfits.length });
    }
  }, [savedOutfits.length, user]);

  const loadWeather = useCallback(async () => {
    safeSet({ status: 'loading' });
    const permission = await Location.requestForegroundPermissionsAsync();
    
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      safeSet({ status: 'permission_denied' });
      return;
    }
    
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const weather = await fetchCurrentWeatherByCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
    safeSet({ status: 'ready', weather });
  }, [safeSet]);

  useEffect(() => {
    (async () => {
      try {
        await loadSavedOutfits();
        await loadWeather();
      } catch (error) {
        console.log('Yukleme sirasinda hata:', error);
        safeSet({ status: 'error', message: error instanceof Error ? error.message : 'Bilinmeyen hata' });
      }
    })();
  }, [loadSavedOutfits, loadWeather, safeSet]);

  useEffect(() => {
    if (!user) {
      setSavedOutfits([]);
      setDbStats({ clothes: 0, outfits: 0 });
      return;
    }

    loadSavedOutfits();
    fetchStats();
  }, [user, loadSavedOutfits, fetchStats]);

  const generateSuggestion = async () => {
    // KANKA BAKIŞI: iOS çift tıklamasını ve kilitlenmesini engellemek için kontrol
    if (isSuggesting) return;
    setIsSuggesting(true);
    
    try {
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        Alert.alert('Oturum', 'Kombin olusturmak icin giris yapman lazim kanka.');
        return;
      }

      // Hafızadaki dolabı kullan, yoksa yeniden çek
      let clothes = wardrobeItems;
      if (clothes.length === 0) {
        const { data, error } = await supabase.from('clothes').select('*').eq('user_id', currentUser.id);
        if (error) throw error;
        clothes = data;
        setWardrobeItems(data);
      }

      if (!clothes || clothes.length < 2) {
        Alert.alert('Dolap Bos Kanka', 'Once dolaba en az bir ust ve bir alt giyim ekle kanka!');
        return;
      }

      const tops = clothes.filter((item: ClothingItem) => ['Üst Giyim', 'Dış Giyim'].includes(item.category));
      const bottoms = clothes.filter((item: ClothingItem) => item.category === 'Alt Giyim');

      if (tops.length === 0 || bottoms.length === 0) {
        Alert.alert('Eksik Parca', 'Dolabinda en az bir ust (veya dis giyim) ve bir alt giyim olmali kanka!');
        return;
      }

      const weather: CurrentWeather =
        weatherState.status === 'ready'
          ? weatherState.weather
          : { tempC: 20, description: 'bilinmiyor', city: undefined };

      const userProfile = {
        age: currentUser.user_metadata?.age ? Number(currentUser.user_metadata.age) : undefined,
        gender: currentUser.user_metadata?.gender || undefined,
        profession: currentUser.user_metadata?.profession || undefined,
      };

      const suggestion = await suggestOutfit({
        clothes: clothes.map((item: ClothingItem) => ({
          id: item.id,
          category: item.category,
          season: item.season,
        })),
        weather,
        excludeCombinations: recentCombinations,
        userProfile,
      });

      const top = clothes.find((item: ClothingItem) => item.id === suggestion.topId);
      const bottom = clothes.find((item: ClothingItem) => item.id === suggestion.bottomId);
      const shoes = clothes.find((item: ClothingItem) => item.id === suggestion.shoesId);
      const outerwear = clothes.find((item: ClothingItem) => item.id === suggestion.outerwearId);
      const accessory = clothes.find((item: ClothingItem) => item.id === suggestion.accessoryId);

      if (!top || !bottom) {
        Alert.alert('Hata', 'Gemini kombin secimi gecersiz geldi, tekrar dene kanka.');
        return;
      }

      setRecentCombinations((prev) => {
        const next = [
          { topId: suggestion.topId, bottomId: suggestion.bottomId },
          ...prev.filter(
            (combo) => !(combo.topId === suggestion.topId && combo.bottomId === suggestion.bottomId)
          ),
        ];
        return next.slice(0, 10);
      });
      
      setSuggestedOutfit({ top, bottom, shoes, outerwear, accessory, reason: suggestion.reason });
      setShowResultModal(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kombin olusturulamadi kanka.';
      Alert.alert('Hata', message);
    } finally {
      setIsSuggesting(false);
    }
  };

  const saveLikedOutfit = useCallback(async () => {
    if (!suggestedOutfit) return;
    
    if (!user) {
      Alert.alert('Oturum', 'Kombini kaydetmek icin giris yapman lazim kanka.');
      return;
    }

    const nextOutfits: SavedOutfit[] = [
      {
        id: `${Date.now()}`,
        dayIndex: getTodayIndex(),
        createdAt: new Date().toISOString(),
        ...suggestedOutfit
      },
      ...savedOutfits,
    ];

    try {
      await AsyncStorage.setItem(getSavedOutfitsKey(), JSON.stringify(nextOutfits));
      setSavedOutfits(nextOutfits);
      setShowResultModal(false);
      setSelectedWeekDay(getTodayIndex());
      setShowDayOutfitsModal(true);
      setSelectedCalendarDateKey(formatDateKey(new Date()));
      Alert.alert('Kaydedildi', `${DAYS[getTodayIndex()]} gunu icin kombin kaydedildi.`);
    } catch (error) {
      Alert.alert('Hata', 'Kombin kaydedilemedi.');
    }
  }, [getSavedOutfitsKey, savedOutfits, suggestedOutfit, user]);

  const openDayOutfits = useCallback((dayIndex: number) => {
    setSelectedWeekDay(dayIndex);
    setShowDayOutfitsModal(true);
  }, []);

  // YENİ: Parça değiştirme işlemi (Panelden bir ürün seçildiğinde çalışır)
  const handleReplaceItem = (newItem: ClothingItem) => {
    if (!suggestedOutfit || !changingPart) return;
    
    setSuggestedOutfit({
      ...suggestedOutfit,
      [changingPart]: newItem
    });
    setChangingPart(null); // Seçimden sonra paneli kapat
  };

  // YENİ: Değiştirme panelinde gösterilecek kıyafetleri dinamik filtrele
  const replacementOptions = useMemo(() => {
    if (!changingPart) return [];
    
    const currentId = suggestedOutfit?.[changingPart]?.id;
    
    switch(changingPart) {
        case 'top': 
          return wardrobeItems.filter(item => ['Üst Giyim', 'Dış Giyim'].includes(item.category) && item.id !== currentId);
        case 'bottom': 
          return wardrobeItems.filter(item => item.category === 'Alt Giyim' && item.id !== currentId);
        case 'shoes': 
          return wardrobeItems.filter(item => item.category === 'Ayakkabı' && item.id !== currentId);
        case 'outerwear': 
          return wardrobeItems.filter(item => item.category === 'Dış Giyim' && item.id !== currentId);
        case 'accessory': 
          return wardrobeItems.filter(item => item.category === 'Takı & Aksesuar' && item.id !== currentId);
        default: 
          return [];
    }
  }, [changingPart, wardrobeItems, suggestedOutfit]);

  const weatherData = useMemo(() => {
    if (weatherState.status === 'ready') {
      const { tempC, description, city } = weatherState.weather;
      return { city: city ?? '-', temp: `${Math.round(tempC)}°C`, desc: description };
    }
    return null;
  }, [weatherState]);

  const selectedDayOutfits = useMemo(() => {
    if (selectedWeekDay === null) return [];
    return savedOutfits.filter((outfit) => outfit.dayIndex === selectedWeekDay);
  }, [savedOutfits, selectedWeekDay]);

  const outfitsByDate = useMemo(() => {
    return savedOutfits.reduce<Record<string, SavedOutfit[]>>((acc, outfit) => {
      const key = formatDateKey(new Date(outfit.createdAt));
      if (!acc[key]) acc[key] = [];
      acc[key].push(outfit);
      return acc;
    }, {});
  }, [savedOutfits]);

  const calendarDays = useMemo(() => getMonthMatrix(calendarMonth), [calendarMonth]);
  
  const selectedCalendarOutfits = useMemo(() => outfitsByDate[selectedCalendarDateKey] ?? [], [outfitsByDate, selectedCalendarDateKey]);
  
  const selectedCalendarDate = useMemo(() => {
    const [year, month, day] = selectedCalendarDateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [selectedCalendarDateKey]);

  return (
    <ScrollView 
      style={styles.scroll} 
      contentContainerStyle={styles.container} 
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" 
    >
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.weatherCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.weatherTop}>
          <View>
            <Text style={styles.weatherCity}>{weatherData?.city ?? 'Konum aliniyor...'}</Text>
            <Text style={styles.weatherDesc}>{weatherData?.desc ?? (weatherState.status === 'permission_denied' ? 'Konum izni yok' : 'Yukleniyor...')}</Text>
          </View>
          <View style={styles.weatherTempWrap}>
            {weatherState.status === 'loading' ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <Text style={styles.weatherTemp}>{weatherData?.temp ?? '-'}</Text>
            )}
          </View>
        </View>
        <View style={styles.weatherBottom}>
          <Wind size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.weatherHint}>Hava durumuna gore en iyi kombini senin icin sececegim kanka.</Text>
        </View>
      </LinearGradient>

      <Text style={styles.heroText}>GarbGenie Sizin Icin Hazir!</Text>

      <Modal visible={showProfileReminderModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.reminderBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profilini tamamla</Text>
              <TouchableOpacity onPress={() => setShowProfileReminderModal(false)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <Text style={styles.reminderText}>
              Dolabını daha iyi anlamam için yaş, cinsiyet ve meslek bilgilerini profil sayfanda tamamla.
            </Text>
            <TouchableOpacity style={styles.reminderButton} onPress={() => router.push('/profile')}>
              <Text style={styles.reminderButtonText}>Profil sayfasına git</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TouchableOpacity 
        style={styles.mainButton} 
        onPress={generateSuggestion} 
        activeOpacity={0.85}
      >
        {isSuggesting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Sparkles size={20} color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.buttonText}>Bugun Ne Giymeliyim?</Text>
          </>
        )}
      </TouchableOpacity>

      <OutfitCarousel />
      <WeeklyOutfitSummary savedOutfits={savedOutfits} onSelectDay={openDayOutfits} onOpenCalendar={() => setShowCalendarModal(true)} />
      <WardrobeStats clothesCount={dbStats.clothes} outfitCount={dbStats.outfits} />

      {/* İNTERAKTİF KOMBİN SONUÇ MODALI */}
      <Modal visible={showResultModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.suggestionBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>GarbGenie Onerisi</Text>
              <TouchableOpacity onPress={() => setShowResultModal(false)}>
                <X size={26} color="#000" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.suggestionDesc}>
              {suggestedOutfit?.reason ?? 'Bu havada harika goruneceksin kanka:'}
            </Text>

            <ScrollView contentContainerStyle={styles.outfitGrid} showsVerticalScrollIndicator={false}>
              
              {suggestedOutfit?.outerwear && (
                 <TouchableOpacity style={styles.suggestedCard} activeOpacity={0.8} onPress={() => setChangingPart('outerwear')}>
                   <View style={styles.imageWrapper}>
                     <Image source={{ uri: suggestedOutfit.outerwear.image_url }} style={styles.suggestedImg} />
                     <View style={styles.swapBadge}><RefreshCw size={14} color="#fff" /></View>
                   </View>
                   <Text style={styles.suggestedLabel}>Dış Giyim (Değiştir)</Text>
                 </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.suggestedCard} activeOpacity={0.8} onPress={() => setChangingPart('top')}>
                <View style={styles.imageWrapper}>
                  <Image source={{ uri: suggestedOutfit?.top.image_url }} style={styles.suggestedImg} />
                  <View style={styles.swapBadge}><RefreshCw size={14} color="#fff" /></View>
                </View>
                <Text style={styles.suggestedLabel}>
                  {suggestedOutfit?.top.category === 'Dış Giyim' ? 'Dis Giyim (Değiştir)' : 'Ust Giyim (Değiştir)'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.suggestedCard} activeOpacity={0.8} onPress={() => setChangingPart('bottom')}>
                <View style={styles.imageWrapper}>
                  <Image source={{ uri: suggestedOutfit?.bottom.image_url }} style={styles.suggestedImg} />
                  <View style={styles.swapBadge}><RefreshCw size={14} color="#fff" /></View>
                </View>
                <Text style={styles.suggestedLabel}>Alt Giyim (Değiştir)</Text>
              </TouchableOpacity>

              {suggestedOutfit?.shoes && (
                 <TouchableOpacity style={styles.suggestedCard} activeOpacity={0.8} onPress={() => setChangingPart('shoes')}>
                   <View style={styles.imageWrapper}>
                     <Image source={{ uri: suggestedOutfit.shoes.image_url }} style={styles.suggestedImg} />
                     <View style={styles.swapBadge}><RefreshCw size={14} color="#fff" /></View>
                   </View>
                   <Text style={styles.suggestedLabel}>Ayakkabı (Değiştir)</Text>
                 </TouchableOpacity>
              )}

              {suggestedOutfit?.accessory && (
                 <TouchableOpacity style={styles.suggestedCard} activeOpacity={0.8} onPress={() => setChangingPart('accessory')}>
                   <View style={styles.imageWrapper}>
                     <Image source={{ uri: suggestedOutfit.accessory.image_url }} style={styles.suggestedImg} />
                     <View style={styles.swapBadge}><RefreshCw size={14} color="#fff" /></View>
                   </View>
                   <Text style={styles.suggestedLabel}>Takı (Değiştir)</Text>
                 </TouchableOpacity>
              )}

            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={saveLikedOutfit}>
              <Text style={styles.closeBtnText}>Kombini Begendim!</Text>
            </TouchableOpacity>
          </View>

          {/* KANKA BAKIŞI: iOS Çift Modal Hatasını Çözen Katman */}
          {!!changingPart && (
            <TouchableOpacity style={styles.bottomSheetOverlay} activeOpacity={1} onPress={() => setChangingPart(null)}>
              <TouchableOpacity activeOpacity={1} style={styles.bottomSheet}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>
                  {changingPart === 'top' ? 'Üst Giyim Seçeneklerin' 
                    : changingPart === 'bottom' ? 'Alt Giyim Seçeneklerin'
                    : changingPart === 'shoes' ? 'Ayakkabı Seçeneklerin'
                    : changingPart === 'outerwear' ? 'Dış Giyim Seçeneklerin'
                    : 'Aksesuar Seçeneklerin'}
                </Text>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.replacementScroll}>
                  {replacementOptions.length === 0 ? (
                    <Text style={styles.emptyDayText}>Dolabında bu kategoride başka eşya yok kanka.</Text>
                  ) : (
                    replacementOptions.map(item => (
                      <TouchableOpacity key={item.id} style={styles.replacementCard} onPress={() => handleReplaceItem(item)}>
                        <Image source={{ uri: item.image_url }} style={styles.replacementImg} />
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </TouchableOpacity>
            </TouchableOpacity>
          )}

        </View>
      </Modal>

      <Modal visible={showDayOutfitsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.daySuggestionBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedWeekDay !== null ? `${DAYS[selectedWeekDay]} Icin Kombinlerin` : 'Kayitli Kombinler'}</Text>
              <TouchableOpacity onPress={() => setShowDayOutfitsModal(false)}>
                <X size={26} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.dayOutfitsScroll} showsVerticalScrollIndicator={false}>
              {selectedDayOutfits.length === 0 ? (
                <Text style={styles.emptyDayText}>Bu gun icin henuz begendigin bir kombin yok.</Text>
              ) : (
                selectedDayOutfits.map((outfit) => (
                  <View key={outfit.id} style={styles.savedOutfitCard}>
                    <Text style={styles.savedOutfitTitle}>Kaydedilen Kombin</Text>
                    <View style={styles.outfitGridSmall}>
                      {outfit.outerwear && (
                        <View style={styles.suggestedCardSmall}>
                          <Image source={{ uri: outfit.outerwear.image_url }} style={styles.savedOutfitImgSmall} />
                          <Text style={styles.suggestedLabelSmall}>Dış Giyim</Text>
                        </View>
                      )}
                      <View style={styles.suggestedCardSmall}>
                        <Image source={{ uri: outfit.top.image_url }} style={styles.savedOutfitImgSmall} />
                        <Text style={styles.suggestedLabelSmall}>Ust Giyim</Text>
                      </View>
                      <View style={styles.suggestedCardSmall}>
                        <Image source={{ uri: outfit.bottom.image_url }} style={styles.savedOutfitImgSmall} />
                        <Text style={styles.suggestedLabelSmall}>Alt Giyim</Text>
                      </View>
                      {outfit.shoes && (
                        <View style={styles.suggestedCardSmall}>
                          <Image source={{ uri: outfit.shoes.image_url }} style={styles.savedOutfitImgSmall} />
                          <Text style={styles.suggestedLabelSmall}>Ayakkabı</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showCalendarModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kombin Takvimi</Text>
              <TouchableOpacity onPress={() => setShowCalendarModal(false)}>
                <X size={26} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarNav}>
              <TouchableOpacity style={styles.calendarNavButton} onPress={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                <Text style={styles.calendarNavText}>Onceki</Text>
              </TouchableOpacity>
              <Text style={styles.calendarMonthTitle}>{MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</Text>
              <TouchableOpacity style={styles.calendarNavButton} onPress={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                <Text style={styles.calendarNavText}>Sonraki</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calendarWeekHeader}>
              {DAYS.map((day) => (
                <Text key={day} style={styles.calendarWeekHeaderText}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((date) => {
                const dateKey = formatDateKey(date);
                const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                const isSelected = dateKey === selectedCalendarDateKey;
                const isToday = dateKey === formatDateKey(new Date());
                const count = outfitsByDate[dateKey]?.length ?? 0;

                return (
                  <TouchableOpacity
                    key={dateKey}
                    style={[
                      styles.calendarCell, 
                      isSelected && styles.calendarCellSelected, 
                      isToday && styles.calendarCellToday
                    ]}
                    onPress={() => setSelectedCalendarDateKey(dateKey)}
                    activeOpacity={0.85}
                  >
                    <Text 
                      style={[
                        styles.calendarCellText, 
                        !isCurrentMonth && styles.calendarCellTextMuted, 
                        isSelected && styles.calendarCellTextSelected
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {count > 0 && (
                      <View style={styles.calendarBadge}>
                        <Text style={styles.calendarBadgeText}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.calendarDetailHeader}>
              <Text style={styles.calendarDetailTitle}>{formatDateLabel(selectedCalendarDate)}</Text>
              <Text style={styles.calendarDetailCount}>{selectedCalendarOutfits.length} kombin</Text>
            </View>

            <ScrollView style={styles.calendarDetailScroll} showsVerticalScrollIndicator={false}>
              {selectedCalendarOutfits.length === 0 ? (
                <Text style={styles.emptyDayText}>Bu tarihte kaydedilmis kombin yok.</Text>
              ) : (
                selectedCalendarOutfits.map((outfit) => (
                  <View key={outfit.id} style={styles.savedOutfitCard}>
                    <Text style={styles.savedOutfitTitle}>
                      {new Date(outfit.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <View style={styles.outfitGridSmall}>
                      {outfit.outerwear && (
                        <View style={styles.suggestedCardSmall}>
                          <Image source={{ uri: outfit.outerwear.image_url }} style={styles.savedOutfitImgSmall} />
                          <Text style={styles.suggestedLabelSmall}>Dış Giyim</Text>
                        </View>
                      )}
                      <View style={styles.suggestedCardSmall}>
                        <Image source={{ uri: outfit.top.image_url }} style={styles.savedOutfitImgSmall} />
                        <Text style={styles.suggestedLabelSmall}>Ust Giyim</Text>
                      </View>
                      <View style={styles.suggestedCardSmall}>
                        <Image source={{ uri: outfit.bottom.image_url }} style={styles.savedOutfitImgSmall} />
                        <Text style={styles.suggestedLabelSmall}>Alt Giyim</Text>
                      </View>
                      {outfit.shoes && (
                        <View style={styles.suggestedCardSmall}>
                          <Image source={{ uri: outfit.shoes.image_url }} style={styles.savedOutfitImgSmall} />
                          <Text style={styles.suggestedLabelSmall}>Ayakkabı</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  container: { 
    padding: 20, 
    paddingTop: 55, 
    paddingBottom: 40, 
    alignItems: 'center' 
  },
  weatherCard: { 
    width: '100%', 
    borderRadius: 24, 
    padding: 22, 
    marginBottom: 28, 
    elevation: 8 
  },
  weatherTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  weatherCity: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#fff' 
  },
  weatherDesc: { 
    fontSize: 13, 
    color: 'rgba(255,255,255,0.7)', 
    textTransform: 'capitalize' 
  },
  weatherTempWrap: { 
    alignItems: 'flex-end' 
  },
  weatherTemp: { 
    fontSize: 48, 
    fontWeight: '200', 
    color: '#fff' 
  },
  weatherBottom: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.15)', 
    paddingTop: 12 
  },
  weatherHint: { 
    fontSize: 11, 
    color: 'rgba(255,255,255,0.55)', 
    flex: 1 
  },
  heroText: { 
    fontSize: 22, 
    fontWeight: '800', 
    textAlign: 'center', 
    marginBottom: 20, 
    color: '#111' 
  },
  mainButton: { 
    backgroundColor: '#000', 
    paddingVertical: 18, 
    borderRadius: 30, 
    marginBottom: 32, 
    width: '100%', 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center' 
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 17, 
    fontWeight: 'bold' 
  },
  sectionWrap: { 
    width: '100%', 
    marginBottom: 28 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 14 
  },
  calendarButton: { 
    padding: 6, 
    borderRadius: 999, 
    backgroundColor: '#f3f3f3' 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111', 
    marginBottom: 14 
  },
  outfitCard: { 
    width: CARD_WIDTH, 
    marginRight: 12, 
    borderRadius: 16, 
    overflow: 'hidden', 
    backgroundColor: '#f0f0f0' 
  },
  outfitImage: { 
    width: '100%', 
    height: 180 
  },
  outfitLabel: { 
    padding: 10, 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#333' 
  },
  weekRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    backgroundColor: '#f9f9f9', 
    borderRadius: 16, 
    padding: 16 
  },
  dayCol: { 
    alignItems: 'center', 
    gap: 8 
  },
  dayLabel: { 
    fontSize: 11, 
    color: '#999', 
    fontWeight: '600' 
  },
  dayLabelToday: { 
    color: '#000', 
    fontWeight: '800' 
  },
  dayDot: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  dayDotFilled: { 
    backgroundColor: '#000' 
  },
  dayDotEmpty: { 
    backgroundColor: '#e5e5e5' 
  },
  dayDotToday: { 
    borderWidth: 2, 
    borderColor: '#000' 
  },
  dayDotCount: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: '800' 
  },
  weekHint: { 
    marginTop: 10, 
    color: '#666', 
    fontSize: 12 
  },
  statsRow: { 
    flexDirection: 'row', 
    gap: 10 
  },
  statCard: { 
    flex: 1, 
    borderRadius: 16, 
    padding: 16, 
    alignItems: 'center', 
    gap: 6 
  },
  statValue: { 
    fontSize: 26, 
    fontWeight: '800', 
    color: '#fff' 
  },
  statLabel: { 
    fontSize: 11, 
    color: 'rgba(255,255,255,0.85)', 
    fontWeight: '600' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  
  // MODAL VE GRID GÜNCELLEMESİ (Full Kombin İçin)
  suggestionBox: { 
    backgroundColor: '#fff', 
    borderRadius: 30, 
    padding: 25, 
    width: '100%', 
    maxHeight: '90%', 
    alignItems: 'center',
    position: 'relative', 
    overflow: 'hidden'
  },
  outfitGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'center', 
    gap: 15, 
    paddingBottom: 20 
  },
  suggestedCard: { 
    width: '45%', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  imageWrapper: { 
    width: '100%', 
    position: 'relative', 
    marginBottom: 8 
  },
  suggestedImg: { 
    width: '100%', 
    height: 180, 
    borderRadius: 15, 
    backgroundColor: '#f5f5f5' 
  },
  swapBadge: { 
    position: 'absolute', 
    bottom: 10, 
    right: 10, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  suggestedLabel: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: '#888', 
    textAlign: 'center' 
  },
  
  // KÜÇÜK GÖSTERİM STİLLERİ (Kayıtlı kombinler ekranı için)
  outfitGridSmall: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10, 
    justifyContent: 'center' 
  },
  suggestedCardSmall: { 
    width: '45%', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  savedOutfitImgSmall: { 
    width: '100%', 
    height: 140, 
    borderRadius: 12, 
    backgroundColor: '#eee', 
    marginBottom: 6 
  },
  suggestedLabelSmall: { 
    fontSize: 11, 
    fontWeight: 'bold', 
    color: '#888' 
  },

  daySuggestionBox: { 
    backgroundColor: '#fff', 
    borderRadius: 30, 
    padding: 25, 
    width: '100%', 
    maxHeight: '85%' 
  },
  calendarModalBox: { 
    backgroundColor: '#fff', 
    borderRadius: 30, 
    padding: 25, 
    width: '100%', 
    maxHeight: '92%' 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    width: '100%', 
    marginBottom: 15, 
    alignItems: 'center' 
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  calendarNav: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 16 
  },
  calendarNavButton: { 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    borderRadius: 999, 
    backgroundColor: '#f3f3f3' 
  },
  calendarNavText: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#222' 
  },
  calendarMonthTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: '#111' 
  },
  calendarWeekHeader: { 
    flexDirection: 'row', 
    marginBottom: 8 
  },
  calendarWeekHeaderText: { 
    flex: 1, 
    textAlign: 'center', 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#777' 
  },
  calendarGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8, 
    marginBottom: 18 
  },
  calendarCell: { 
    width: '13.1%', 
    aspectRatio: 1, 
    borderRadius: 16, 
    backgroundColor: '#f6f6f6', 
    justifyContent: 'center', 
    alignItems: 'center', 
    position: 'relative' 
  },
  calendarCellSelected: { 
    backgroundColor: '#111' 
  },
  calendarCellToday: { 
    borderWidth: 2, 
    borderColor: '#111' 
  },
  calendarCellText: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#111' 
  },
  calendarCellTextMuted: { 
    color: '#bbb' 
  },
  calendarCellTextSelected: { 
    color: '#fff' 
  },
  calendarBadge: { 
    position: 'absolute', 
    bottom: 6, 
    minWidth: 18, 
    height: 18, 
    borderRadius: 9, 
    backgroundColor: '#ff5a5f', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 4 
  },
  calendarBadgeText: { 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: '800' 
  },
  calendarDetailHeader: { 
    marginBottom: 12 
  },
  calendarDetailTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: '#111' 
  },
  calendarDetailCount: { 
    fontSize: 12, 
    color: '#666', 
    marginTop: 2 
  },
  calendarDetailScroll: { 
    width: '100%' 
  },
  suggestionDesc: { 
    fontSize: 14, 
    color: '#666', 
    marginBottom: 20, 
    textAlign: 'center' 
  },
  closeBtn: { 
    backgroundColor: '#000', 
    paddingVertical: 16, 
    borderRadius: 20, 
    width: '100%', 
    alignItems: 'center', 
    marginTop: 10 
  },
  closeBtnText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  dayOutfitsScroll: { 
    width: '100%' 
  },
  emptyDayText: { 
    fontSize: 14, 
    color: '#666', 
    textAlign: 'center', 
    paddingVertical: 24 
  },
  savedOutfitCard: { 
    padding: 16, 
    borderRadius: 18, 
    backgroundColor: '#f8f8f8', 
    marginBottom: 14 
  },
  savedOutfitTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: '#111', 
    marginBottom: 12 
  },
  reminderBox: { 
    width: '90%', 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    padding: 22, 
    alignItems: 'center' 
  },
  reminderText: { 
    fontSize: 14, 
    color: '#444', 
    lineHeight: 20, 
    marginBottom: 22 
  },
  reminderButton: { 
    backgroundColor: '#000', 
    borderRadius: 20, 
    paddingVertical: 14, 
    paddingHorizontal: 22 
  },
  reminderButtonText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 14 
  },

  // EKLENEN STİLLER: Bottom Sheet Stilleri
  bottomSheetOverlay: { 
    position: 'absolute', 
    top: 0, 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'flex-end', 
    zIndex: 999 
  },
  bottomSheet: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    padding: 20, 
    paddingBottom: 40, 
    minHeight: 250 
  },
  sheetHandle: { 
    width: 40, 
    height: 5, 
    backgroundColor: '#ddd', 
    borderRadius: 3, 
    alignSelf: 'center', 
    marginBottom: 15 
  },
  sheetTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 15, 
    textAlign: 'center' 
  },
  replacementScroll: { 
    gap: 15, 
    paddingHorizontal: 5 
  },
  replacementCard: { 
    width: 120, 
    height: 150, 
    borderRadius: 15, 
    overflow: 'hidden', 
    backgroundColor: '#f0f0f0', 
    borderWidth: 2, 
    borderColor: 'transparent' 
  },
  replacementImg: { 
    width: '100%', 
    height: '100%', 
    resizeMode: 'cover' 
  }
});