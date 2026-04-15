import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, ScrollView, ActivityIndicator, FlatList, Modal, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Plus, Image as ImageIcon, Trash2, Save, X } from 'lucide-react-native';
// @ts-ignore
import { supabase } from '../../supabase'; 

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 2 - 25;

const CATEGORIES = ['Üst Giyim', 'Alt Giyim', 'Ayakkabı', 'Dış Giyim'];
const SEASONS = ['Yazlık', 'Kışlık', 'Bahar'];

export default function WardrobeScreen() {
  // Liste State'leri
  const [clothes, setClothes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Ekleme Formu State'leri (Arkadaşının kodundan)
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchClothes(); }, []);

  const fetchClothes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clothes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClothes(data || []);
    } catch (error: any) {
      console.error(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
    if (!selectedImage || !category || !season) return Alert.alert('Eksik Bilgi', 'Hepsini seç kanka!');
    
    setUploading(true);
    try {
      const fileName = `${Date.now()}.jpg`;
      const response = await fetch(selectedImage);
      const blob = await response.blob();

      const { error: storageError } = await supabase.storage
        .from('clothes')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage.from('clothes').getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('clothes')
        .insert([{ image_url: publicUrl, category, season }]);

      if (dbError) throw dbError;

      Alert.alert('GarbGenie®', 'Kıyafet başarıyla eklendi! 🚀');
      setShowAddModal(false);
      setSelectedImage(null); setCategory(null); setSeason(null);
      fetchClothes();
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Sil', 'Bu kıyafeti siliyoruz kanka?', [
      { text: 'Vazgeç' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        await supabase.from('clothes').delete().eq('id', id);
        fetchClothes();
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>Gardırobum</Text></View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#000" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={clothes}
          numColumns={2}
          keyExtractor={(item) => item.id}
          onRefresh={() => { setRefreshing(true); fetchClothes(); }}
          refreshing={refreshing}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={{ uri: item.image_url }} style={styles.cardImage} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardCategory}>{item.category}</Text>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Trash2 size={18} color="#ff4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Dolabın boş kanka, "+" ile ekle!</Text>}
        />
      )}

      {/* ARKADAŞININ EKLEME FORMU BURADA (MODAL) */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Yeni Kıyafet Ekle</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}><X size={28} color="#000" /></TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(false)}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.fullImage} />
              ) : (
                <View style={styles.placeholder}>
                  <ImageIcon size={40} color="#ccc" />
                  <Text style={{color: '#aaa', marginTop: 10}}>Fotoğraf Seç</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>Kategori</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipSelected]} onPress={() => setCategory(c)}>
                  <Text style={[styles.chipText, category === c && styles.chipTextSelected]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Mevsim</Text>
            <View style={styles.chipRow}>
              {SEASONS.map(s => (
                <TouchableOpacity key={s} style={[styles.chip, season === s && styles.chipSelected]} onPress={() => setSeason(s)}>
                  <Text style={[styles.chipText, season === s && styles.chipTextSelected]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={uploading}>
              {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Dolaba Kaydet</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Plus size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  listContent: { padding: 15, paddingBottom: 100 },
  card: { width: COLUMN_WIDTH, marginBottom: 20, marginRight: 15, borderRadius: 15, backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, overflow: 'hidden' },
  cardImage: { width: '100%', height: 200 },
  cardInfo: { padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCategory: { fontSize: 13, fontWeight: 'bold', color: '#444' },
  emptyText: { textAlign: 'center', marginTop: 100, color: '#999' },
  fab: { position: 'absolute', bottom: 30, right: 30, backgroundColor: '#000', width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  imagePicker: { width: '100%', height: 300, backgroundColor: '#f9f9f9', borderRadius: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  fullImage: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center' },
  label: { fontSize: 16, fontWeight: 'bold', marginTop: 25, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#eee' },
  chipSelected: { backgroundColor: '#000', borderColor: '#000' },
  chipText: { color: '#666' },
  chipTextSelected: { color: '#fff' },
  saveBtn: { backgroundColor: '#000', padding: 18, borderRadius: 15, marginTop: 40, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});