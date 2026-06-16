import { GoogleGenerativeAI } from "@google/generative-ai";
import { decode } from 'base64-arraybuffer';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Footprints, Image as ImageIcon, Layers, Plus, Shirt, ShoppingBag, Sparkles, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, ImageBackground, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// @ts-ignore
import { supabase } from '../../supabase';

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || "");
const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLUMN_WIDTH = width / 2 - 25;

const CATEGORY_DATA = [
  { id: 'Üst Giyim', label: 'Üst Giyim', icon: <Shirt size={28} color="#fff" />, img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400' },
  { id: 'Alt Giyim', label: 'Alt Giyim', icon: <Layers size={28} color="#fff" />, img: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400' },
  { id: 'Ayakkabı', label: 'Ayakkabı', icon: <Footprints size={28} color="#fff" />, img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400' },
  { id: 'Dış Giyim', label: 'Dış Giyim', icon: <ShoppingBag size={28} color="#fff" />, img: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400' },
  { id: 'Takı & Aksesuar', label: 'Takı & Aksesuar', icon: <Sparkles size={28} color="#fff" />, img: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400' },
];

export default function WardrobeScreen() {
  const [clothes, setClothes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [closetStep, setClosetStep] = useState<0 | 1 | 2>(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedImageForView, setSelectedImageForView] = useState<string | null>(null);

  const doorOpenValue = useSharedValue(0);

  const fetchClothes = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('clothes').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setClothes(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClothes(); }, [fetchClothes]);

  const removeBackground = async (imageUri: string) => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_REMOVE_BG_API_KEY;
      if (!apiKey) throw new Error("API Key bulunamadı kanka.");

      const formData = new FormData();
      formData.append('image_file', { uri: imageUri, type: 'image/jpeg', name: 'kombin.jpg' } as any);
      formData.append('size', 'auto');

      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' },
        body: formData,
      });

      if (!response.ok) throw new Error('Yapay Zeka arka planı silemedi.');

      const data = await response.json();
      return data.data.result_b64;
    } catch (error) {
      console.error("RemoveBG Hatası:", error);
      throw error;
    }
  };

  // --- GARANTİLİ SAF JSON VEREN AI ANALİZ FONKSİYONU ---
  const analyzeImageWithAI = async (base64Image: string) => {
    try {
      // KANKA BAKIŞI: Burada responseMimeType ekleyerek Gemini'ı sadece saf JSON dönmeye zorluyoruz.
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      
      const prompt = `Analyze this clothing or accessory image and output a valid JSON object matching this schema exactly:
      {
        "category": "Must be exactly one of: 'Üst Giyim', 'Alt Giyim', 'Ayakkabı', 'Dış Giyim', 'Takı & Aksesuar'",
        "season": "Must be exactly one of: 'Bahar', 'Yazlık', 'Kışlık'",
        "sub_category": "The specific type of clothing in Turkish (e.g., Tişört, Kot Pantolon, Sneaker, Kolye, Güneş Gözlüğü)",
        "color": "The dominant color in Turkish (e.g., Siyah, Beyaz, Kırmızı, Mavi, Altın)",
        "style_tag": "The fashion style in Turkish (e.g., Spor, Casual, Şık, Minimalist)"
      }
      Do not include any markdown formatting, code blocks, or extra text. Output ONLY the raw JSON string.`;
  
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Image, mimeType: "image/png" } }
      ]);
  
      const text = result.response.text();
      console.log("Gemini Temiz Çıktı kanka:", text); // Test ederken terminalden doğruluğuna bakarsın
      
      return JSON.parse(text.trim());
    } catch (error) {
      console.error("AI Analiz Döngü Hatası:", error);
      // Eğer yine de bir hata olursa en azından patlamasın ama hatayı terminale bassın
      throw new Error("Yapay zeka görseli okurken bir hata oluştu kanka, tekrar dene.");
    }
  };

  const openCloset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    doorOpenValue.value = withSpring(1, { damping: 15, stiffness: 100 });
    setTimeout(() => setClosetStep(1), 200);
  };

  const closeCloset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setClosetStep(0);
    doorOpenValue.value = withSpring(0, { damping: 15, stiffness: 100 });
  };

  const leftDoorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(doorOpenValue.value, [0, 1], [0, -width / 2 - 10]) }]
  }));
  const rightDoorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(doorOpenValue.value, [0, 1], [0, width / 2 + 10]) }]
  }));

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [3, 4], quality: 0.5 });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleSaveModal = async () => {
    if (!selectedImage) return Alert.alert('Eksik', 'Lütfen bir fotoğraf seç kanka.');
    
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum açman lazım.");
      
      // 1. Arka Planı Sil
      const transparentBase64 = await removeBackground(selectedImage);
      
      // 2. Akıllı Yapay Zeka Analizi
      const aiAnalysis = await analyzeImageWithAI(transparentBase64);
      
      // 3. Dosya İsmi Belirle ve Supabase Storage'a Yükle
      const fileName = `${user.id}/${Date.now()}_ai_cleaned.png`;
      const fileData = decode(transparentBase64);
      
      const { error: storageError } = await supabase.storage
        .from('clothes')
        .upload(fileName, fileData, { contentType: 'image/png' });

      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage.from('clothes').getPublicUrl(fileName);
      
      // 4. Veritabanına Ekleme
      const insertData: any = { 
        user_id: user.id, 
        image_url: publicUrl, 
        category: aiAnalysis.category, 
        season: aiAnalysis.season,     
        sub_category: aiAnalysis.sub_category,
        color: aiAnalysis.color,
        style_tag: aiAnalysis.style_tag
      };

      const { error: dbError } = await supabase.from('clothes').insert([insertData]);
      if (dbError) throw dbError;
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddModal(false); 
      setSelectedImage(null); 
      fetchClothes();
      Alert.alert('GarbGenie Vision 👁️', `${aiAnalysis.color} renkli ${aiAnalysis.sub_category} başarıyla ${aiAnalysis.category} dolabına eklendi!`);
    } catch (e: any) { 
      Alert.alert('Analiz Hatası', e.message);
    } finally { 
      setUploading(false); 
    }
  };

  const renderSeasonGroup = (seasonName: string) => {
    const seasonClothes = clothes.filter(c => c.category === selectedCategory && c.season === seasonName);
    if (seasonClothes.length === 0) return null;

    return (
      <View key={seasonName} style={styles.seasonSection}>
        <LinearGradient colors={['rgba(255,255,255,0.1)', 'transparent']} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.seasonHeader}>
            <Text style={styles.seasonTitle}>{seasonName}</Text>
        </LinearGradient>
        <View style={styles.clothesGrid}>
          {seasonClothes.map(item => (
            <View key={item.id} style={styles.itemCard}>
              <TouchableOpacity onPress={() => setSelectedImageForView(item.image_url)} activeOpacity={0.9}>
                  <Image source={{ uri: item.image_url }} style={styles.itemImg} resizeMode="cover" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => {
                  Alert.alert('Sil', 'Bu kıyafeti siliyoruz kanka?', [
                    {text: 'Vazgeç'},
                    {text: 'Sil', onPress: async () => {
                        await supabase.from('clothes').delete().eq('id', item.id);
                        fetchClothes();
                    }}
                  ]);
              }}>
                <Trash2 size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ÜST KISIM */}
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.avatarArea}>
        <View style={styles.avatarCircle}>
          <Image source={{ uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=Faruk&backgroundColor=transparent' }} style={styles.avatarImg} />
        </View>
        <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)']} style={styles.namePlate}>
          <Text style={styles.avatarName}>FARUK</Text>
        </LinearGradient>
      </LinearGradient>

      {/* ALT KISIM */}
      <View style={styles.closetContainer}>
        <View style={styles.closetInterior}>
          {closetStep === 1 && (
            <Animated.View style={styles.interiorContent}>
              <View style={styles.interiorHeader}>
                <Text style={styles.interiorHeaderText}>Dijital Gardırop</Text>
                <TouchableOpacity onPress={closeCloset}><X size={24} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
              </View>
              <View style={styles.categoryGrid}>
                {CATEGORY_DATA.map(cat => (
                  <TouchableOpacity key={cat.id} style={styles.categoryCard} onPress={() => { 
                      Haptics.selectionAsync();
                      setSelectedCategory(cat.id); 
                      setClosetStep(2); 
                  }}>
                    <ImageBackground source={{ uri: cat.img }} style={styles.catImage} imageStyle={{borderRadius: 20}}>
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.catOverlay}>
                            {cat.icon}
                            <Text style={styles.catLabel}>{cat.label}</Text>
                        </LinearGradient>
                    </ImageBackground>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

          {closetStep === 2 && (
            <View style={styles.interiorContent}>
              <TouchableOpacity onPress={() => setClosetStep(1)} style={styles.backButton}>
                <ArrowLeft size={24} color="#fff" />
                <Text style={styles.backButtonText}>{selectedCategory}</Text>
              </TouchableOpacity>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 100}}>
                {['Bahar', 'Yazlık', 'Kışlık'].map(s => renderSeasonGroup(s))}
                {clothes.filter(c => c.category === selectedCategory).length === 0 && (
                   <View style={styles.emptyWrap}>
                       <Shirt size={48} color="rgba(255,255,255,0.1)" />
                       <Text style={styles.emptyText}>Henüz bu kategoride eşya yok kanka.</Text>
                   </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* DOLAP KAPAKLARI */}
        <Animated.View style={[styles.door, styles.leftDoor, leftDoorStyle]} pointerEvents={closetStep === 0 ? 'auto' : 'none'}>
          <TouchableOpacity style={styles.doorSurface} activeOpacity={1} onPress={openCloset}>
            <LinearGradient colors={['#2c3e50', '#000000']} style={styles.doorGradient}>
                <View style={styles.handleStrip} />
                <View style={styles.doorKnob} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View style={[styles.door, styles.rightDoor, rightDoorStyle]} pointerEvents={closetStep === 0 ? 'auto' : 'none'}>
          <TouchableOpacity style={styles.doorSurface} activeOpacity={1} onPress={openCloset}>
            <LinearGradient colors={['#2c3e50', '#000000']} style={styles.doorGradient}>
                <View style={[styles.handleStrip, {left: 0, right: undefined}]} />
                <View style={[styles.doorKnob, {left: 10, right: undefined}]} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <LinearGradient colors={['#00f2fe', '#4facfe']} style={styles.fabGradient}>
            <Plus size={30} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* FULL VIEW MODAL */}
      <Modal visible={!!selectedImageForView} transparent={true} animationType="fade">
        <TouchableOpacity style={styles.fullViewOverlay} activeOpacity={1} onPress={() => setSelectedImageForView(null)}>
          <View style={styles.fullViewContainer}>
            <Image source={{ uri: selectedImageForView ?? '' }} style={styles.fullViewImage} resizeMode="contain" />
            <TouchableOpacity style={styles.closeFullViewBtn} onPress={() => setSelectedImageForView(null)}>
              <X size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* SIFIR TIKLAMA MODALI */}
      <Modal visible={showAddModal} animationType="slide">
          <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Akıllı Dolap</Text>
                  <TouchableOpacity onPress={() => setShowAddModal(false)}><X size={28} color="#000" /></TouchableOpacity>
              </View>
              <ScrollView style={{padding: 20}}>
                <Text style={{color: '#666', marginBottom: 15, fontSize: 16}}>
                  Kanka sadece fotoğrafı seç, gerisini yapay zeka halledecek! ✨
                </Text>

                <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
                    {selectedImage ? <Image source={{uri: selectedImage}} style={{flex:1, borderRadius: 15}} /> : <ImageIcon size={50} color="#ccc" />}
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveModal} disabled={uploading || !selectedImage}>
                    <LinearGradient colors={selectedImage ? ['#000', '#333'] : ['#ccc', '#aaa']} style={styles.saveBtnGradient}>
                        {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Sihri Başlat & Kaydet</Text>}
                    </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
          </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  avatarArea: { height: SCREEN_HEIGHT * 0.35, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  avatarCircle: { width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: '90%', height: '90%' },
  namePlate: { marginTop: 15, paddingHorizontal: 35, paddingVertical: 10, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  avatarName: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 4 },
  closetContainer: { flex: 1, position: 'relative', overflow: 'hidden' },
  door: { position: 'absolute', width: '50%', height: '100%', zIndex: 10 },
  leftDoor: { left: 0 },
  rightDoor: { right: 0 },
  doorSurface: { flex: 1 },
  doorGradient: { flex: 1, borderWidth: 0.5, borderColor: '#34495e' },
  handleStrip: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, backgroundColor: 'rgba(255,255,255,0.05)' },
  doorKnob: { position: 'absolute', right: 10, top: '45%', width: 8, height: 100, backgroundColor: '#bdc3c7', borderRadius: 4, borderWidth: 1, borderColor: '#7f8c8d' },
  closetInterior: { flex: 1, backgroundColor: '#0a0a0a', padding: 20 },
  interiorContent: { flex: 1 },
  interiorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  interiorHeaderText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 15 },
  categoryCard: { width: '47%', aspectRatio: 0.9 },
  catImage: { flex: 1 },
  catOverlay: { flex: 1, justifyContent: 'flex-end', padding: 15, borderRadius: 20 },
  catLabel: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 25 },
  backButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  seasonSection: { marginBottom: 30 },
  seasonHeader: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 15 },
  seasonTitle: { color: '#4facfe', fontSize: 18, fontWeight: 'bold' },
  clothesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  itemCard: { width: COLUMN_WIDTH, height: 200, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1a1a1a', position: 'relative' },
  itemImg: { width: '100%', height: '100%' },
  deleteBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,0,0,0.7)', padding: 8, borderRadius: 12 },
  emptyWrap: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: 'rgba(255,255,255,0.3)', marginTop: 15, fontSize: 16 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 65, height: 65, borderRadius: 32.5, elevation: 10, zIndex: 100 },
  fabGradient: { flex: 1, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center' },
  fullViewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullViewContainer: { width: width * 0.9, height: SCREEN_HEIGHT * 0.8, justifyContent: 'center', alignItems: 'center' },
  fullViewImage: { width: '100%', height: '100%' },
  closeFullViewBtn: { position: 'absolute', top: -40, right: 0, backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 25 },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  imagePicker: { width: '100%', height: 400, backgroundColor: '#f0f2f5', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  saveBtn: { marginTop: 20, height: 60, borderRadius: 15, overflow: 'hidden' },
  saveBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});