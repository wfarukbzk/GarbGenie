import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Send, Bot, User as UserIcon } from 'lucide-react-native';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as Location from 'expo-location';

// @ts-ignore
import { supabase } from '../../supabase';
import { fetchCurrentWeatherByCoords } from '@/lib/weather';
import { useAuth } from '../../context/AuthContext';

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || "");
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  suggestedImages?: string[]; // KANKA BAKIŞI: Yapay zekanın seçtiği resimler buraya gelecek
};

export default function DoctorScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]); // Dolabı hafızada tutacağız
  
  const chatSession = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    initializeDoctor();
  }, [user]);

  const initializeDoctor = async () => {
    if (!user) return;
    setIsInitializing(true);

    try {
      const age = user.user_metadata?.age || 'Belirtilmemiş';
      const gender = user.user_metadata?.gender || 'Belirtilmemiş';
      const profession = user.user_metadata?.profession || 'Belirtilmemiş';

      // Dolaptaki Kıyafetleri Çek ve Hafızaya Al
      const { data: clothes, error } = await supabase.from('clothes').select('*').eq('user_id', user.id);
      if (error) throw error;
      setWardrobeItems(clothes || []); // Resimleri eşleştirmek için state'e kaydettik

      // Hava Durumunu Çek
      let weatherDesc = "Hava durumu alınamadı";
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const weather = await fetchCurrentWeatherByCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
        weatherDesc = `${Math.round(weather.tempC)}°C, ${weather.description}, Şehir: ${weather.city || 'Bilinmiyor'}`;
      }

      // Dolap Verisine ID'leri de Ekleyerek JSON'a Çevir
      const wardrobeContext = clothes?.map(c => ({
        id: c.id, // CRITICAL: YZ artık bu ID'leri kullanarak bize cevap verecek
        kategori: c.category,
        alt_kategori: c.sub_category,
        renk: c.color,
        mevsim: c.season,
        tarz: c.style_tag
      })) || [];

      // KANKA BAKIŞI: JSON Çıktısı İçin Katı Kurallar
      const systemInstruction = `Sen GarbGenie uygulamasının baş stilisti ve kullanıcının yakın arkadaşı olan "Kombin Doktoru"sun. 
      KULLANICI PROFİLİ: Yaş: ${age}, Cinsiyet: ${gender}, Meslek/Tarz: ${profession}.
      ŞU ANKİ HAVA: ${weatherDesc}.
      KULLANICININ DOLABI: ${JSON.stringify(wardrobeContext)}.
      
      KURALLAR:
      1. Sadece dolaptaki kıyafetlerden öneri yap. Olmayan bir şeyi önerme.
      2. Kısa, samimi ve kanka ağzıyla konuş.
      3. YANITINI KESİNLİKLE SADECE ŞU JSON FORMATINDA VER (Başına sonuna markdown veya düz metin ekleme):
      {
        "text": "Kullanıcıya vereceğin samimi cevap metni buraya",
        "suggested_item_ids": [id1, id2] // Önerdiğin kıyafetlerin ID numaralarını buraya yaz. Kombin önermiyorsan boş dizi [] bırak.
      }`;

      // Gemini'ı JSON dönmeye zorluyoruz (application/json)
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3.5-flash",
        systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" }
      });

      chatSession.current = model.startChat({ history: [] });

      setMessages([{
        id: Date.now().toString(),
        role: 'model',
        text: 'Selam kanka! Ben Kombin Doktoru 👨‍⚕️ Dolabının röntgenini çektim, hava durumunu kontrol ettim. Bugün nasıl bir tarz arıyorsun, nereye gidiyoruz?'
      }]);

    } catch (err) {
      console.error(err);
      Alert.alert("Bağlantı Hatası", "Doktor şu an ameliyatta, verilerine ulaşamadı kanka.");
    } finally {
      setIsInitializing(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !chatSession.current) return;

    const userText = inputText.trim();
    setInputText(''); 
    
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userText }]);
    setLoading(true);

    try {
      // Mesajı gönder ve JSON formatındaki yanıtı al
      const result = await chatSession.current.sendMessage(userText);
      const responseText = result.response.text();
      
      // Gelen JSON verisini parse et (Ayrıştır)
      const parsedData = JSON.parse(responseText.trim());
      
      // YZ'nin döndüğü ID'leri alıp, bizim dolabımızdaki resim URL'leriyle eşleştir
      const suggestedImages = parsedData.suggested_item_ids 
        ? wardrobeItems.filter(item => parsedData.suggested_item_ids.includes(item.id)).map(item => item.image_url)
        : [];

      // Ekrana YZ'nin mesajını ve bulduğumuz resimleri bas
      const newModelMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: parsedData.text || "Tamamdır kanka, not aldım.",
        suggestedImages: suggestedImages
      };
      
      setMessages(prev => [...prev, newModelMsg]);
      
    } catch (error) {
      console.error("Doktor JSON Hatası:", error);
      Alert.alert("Hata", "Doktor bir hata yaptı kanka, tekrar dener misin?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 25}
    >
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.avatarWrap}>
            <Bot size={28} color="#4facfe" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Kombin Doktoru</Text>
            <Text style={styles.headerSubtitle}>
              {isInitializing ? 'Dolabın inceleniyor...' : 'Çevrimiçi • Sana özel stilist'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {isInitializing ? (
          <ActivityIndicator size="large" color="#4facfe" style={{ marginTop: 50 }} />
        ) : (
          messages.map((msg) => (
            <View key={msg.id} style={[styles.messageBubbleWrap, msg.role === 'user' ? styles.messageUserWrap : styles.messageModelWrap]}>
              {msg.role === 'model' && <View style={styles.msgAvatar}><Bot size={18} color="#fff" /></View>}
              
              <View style={[styles.messageBubble, msg.role === 'user' ? styles.messageUser : styles.messageModel]}>
                <Text style={[styles.messageText, msg.role === 'user' ? styles.messageTextUser : styles.messageTextModel]}>
                  {msg.text}
                </Text>
                
                {/* KANKA BAKIŞI: EĞER YZ RESİM ÖNERDİYSE BURADA ŞIK BİR ŞEKİLDE GÖSTERİYORUZ */}
                {msg.suggestedImages && msg.suggestedImages.length > 0 && (
                  <View style={styles.suggestedImagesRow}>
                    {msg.suggestedImages.map((imgUrl, idx) => (
                      <View key={idx} style={styles.imageCard}>
                        <Image source={{ uri: imgUrl }} style={styles.suggestionImg} resizeMode="cover" />
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {msg.role === 'user' && <View style={[styles.msgAvatar, { backgroundColor: '#4facfe' }]}><UserIcon size={18} color="#fff" /></View>}
            </View>
          ))
        )}
        
        {loading && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color="#666" />
            <Text style={styles.typingText}>Doktor kombin seçiyor...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={isInitializing ? "Bağlanıyor..." : "Kombin tavsiyesi iste..."}
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={200}
          editable={!isInitializing && !loading}
        />
        <TouchableOpacity 
          style={[styles.sendButton, (!inputText.trim() || isInitializing) && styles.sendButtonDisabled]} 
          onPress={sendMessage}
          disabled={!inputText.trim() || isInitializing || loading}
        >
          <LinearGradient colors={inputText.trim() ? ['#00f2fe', '#4facfe'] : ['#e0e0e0', '#e0e0e0']} style={styles.sendButtonGradient}>
            <Send size={20} color={inputText.trim() ? "#fff" : "#999"} style={{ marginLeft: 3 }} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 5 },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatarWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  chatArea: { flex: 1, paddingHorizontal: 15 },
  chatScrollContent: { paddingVertical: 20, paddingBottom: 10, gap: 15, flexGrow: 1 },
  messageBubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10, maxWidth: '90%' },
  messageUserWrap: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  messageModelWrap: { alignSelf: 'flex-start', justifyContent: 'flex-start' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#16213e', justifyContent: 'center', alignItems: 'center' },
  messageBubble: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 20, maxWidth: '100%' },
  messageUser: { backgroundColor: '#4facfe', borderBottomRightRadius: 5 },
  messageModel: { backgroundColor: '#fff', borderBottomLeftRadius: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTextUser: { color: '#fff' },
  messageTextModel: { color: '#333' },
  
  // YENİ: Önerilen resimlerin stilleri
  suggestedImagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  imageCard: { backgroundColor: '#f0f2f5', borderRadius: 12, padding: 5, overflow: 'hidden' },
  suggestionImg: { width: 75, height: 95, borderRadius: 8 },

  typingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 45, marginTop: -5 },
  typingText: { fontSize: 12, color: '#666', fontStyle: 'italic' },
  inputContainer: { flexDirection: 'row', padding: 15, paddingBottom: Platform.OS === 'ios' ? 30 : 15, backgroundColor: '#fff', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  input: { flex: 1, backgroundColor: '#f0f2f5', borderRadius: 25, paddingHorizontal: 20, paddingTop: 15, paddingBottom: 15, fontSize: 15, maxHeight: 100, color: '#333' },
  sendButton: { width: 50, height: 50, borderRadius: 25, marginLeft: 10, overflow: 'hidden' },
  sendButtonDisabled: { opacity: 0.7 },
  sendButtonGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});