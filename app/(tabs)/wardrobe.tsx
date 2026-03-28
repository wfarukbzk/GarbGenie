import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Plus, Image as ImageIcon, Trash2, Save } from 'lucide-react-native';
// @ts-ignore
import { supabase } from '../../supabase'; 

const CATEGORIES = ['Üst Giyim', 'Alt Giyim', 'Ayakkabı', 'Dış Giyim'];
const SEASONS = ['Yazlık', 'Kışlık', 'Bahar'];

export default function WardrobeScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const pickImage = async (useCamera: boolean) => {
    const options: any = { allowsEditing: true, aspect: [3, 4], quality: 0.5 };
    let result: any;
    
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Hata', 'Kamera izni lazım kanka!');
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!selectedImage || !category || !season) {
      return Alert.alert('Eksik Bilgi', 'Hepsini seç kanka!');
    }
    
    setUploading(true);

    try {
      const fileName = `${Date.now()}.jpg`;
      
      const response = await fetch(selectedImage);
      const blob = await response.blob();

      // Supabase Storage Yükleme
      const { error: storageError } = await supabase.storage
        .from('clothes')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (storageError) throw storageError;

      // URL Al ve Database'e Yaz
      const { data: { publicUrl } } = supabase.storage.from('clothes').getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('clothes')
        .insert([{ image_url: publicUrl, category, season }]);

      if (dbError) throw dbError;

      Alert.alert('GarbGenie®', 'Kıyafet başarıyla dolaba eklendi! 🚀');
      setSelectedImage(null);
      setCategory(null);
      setSeason(null);

    } catch (error: any) {
      Alert.alert('Ağ Hatası', 'Kayıt başarısız: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {selectedImage ? (
          <View style={styles.previewContainer}>
            <Text style={styles.header}>Yeni Kıyafet Ekle</Text>
            <View style={styles.imageWrapper}>
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            </View>
            
            <Text style={styles.label}>Kategori Seç</Text>
            <View style={styles.chipContainer}>
              {CATEGORIES.map((item) => (
                <TouchableOpacity 
                  key={item} 
                  style={[styles.chip, category === item && styles.selectedChip]} 
                  onPress={() => setCategory(item)}
                >
                  <Text style={[styles.chipText, category === item && styles.selectedChipText]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Mevsim Seç</Text>
            <View style={styles.chipContainer}>
              {SEASONS.map((item) => (
                <TouchableOpacity 
                  key={item} 
                  style={[styles.chip, season === item && styles.selectedChip]} 
                  onPress={() => setSeason(item)}
                >
                  <Text style={[styles.chipText, season === item && styles.selectedChipText]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={uploading}>
              {uploading ? <ActivityIndicator color="#fff" /> : (
                <View style={styles.buttonContent}>
                  <Save size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Dolaba Kaydet</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.cancelLink}>
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.iconCircle}>
              <ImageIcon size={40} color="#bbb" />
            </View>
            <Text style={styles.emptyText}>Henüz kıyafet eklemedin.</Text>
            <Text style={styles.subText}>Başlamak için + butonuna bas kanka.</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => Alert.alert('Ekle', 'Seç kanka', [
        {text: 'Fotoğraf Çek', onPress: () => pickImage(true)},
        {text: 'Galeriden Seç', onPress: () => pickImage(false)},
        {text: 'İptal', style: 'cancel'}
      ])}>
        <Plus size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: { padding: 20, paddingBottom: 100 },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 150 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyText: { color: '#333', fontSize: 18, fontWeight: 'bold' },
  subText: { color: '#888', marginTop: 5 },
  previewContainer: { width: '100%' },
  imageWrapper: { borderRadius: 20, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, marginBottom: 10 },
  imagePreview: { width: '100%', height: 350, resizeMode: 'cover' },
  label: { fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 25, borderWidth: 1, borderColor: '#eee', backgroundColor: '#f9f9f9' },
  selectedChip: { backgroundColor: '#000', borderColor: '#000' },
  chipText: { color: '#666', fontWeight: '500' },
  selectedChipText: { color: '#fff' },
  saveButton: { backgroundColor: '#000', padding: 18, borderRadius: 15, marginTop: 35, elevation: 4 },
  buttonContent: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cancelLink: { marginTop: 25, alignSelf: 'center', padding: 10 },
  cancelText: { color: '#ff4444', fontWeight: 'bold' },
  fab: { position: 'absolute', right: 25, bottom: 25, backgroundColor: '#000', width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', elevation: 8 }
});