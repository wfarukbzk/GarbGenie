import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Modal
} from 'react-native';
import { LogOut, User, Mail, Lock, X, Save, CheckCircle, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react-native';
// @ts-ignore
import { supabase } from '../../supabase';
import { useAuth } from '../../context/AuthContext';

const GENDER_OPTIONS = ['Kadın', 'Erkek', 'Diğer'];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [profession, setProfession] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const isProfileComplete = Boolean(
    user?.user_metadata?.age &&
    user?.user_metadata?.gender &&
    user?.user_metadata?.profession
  );

  useEffect(() => {
    if (user?.user_metadata) {
      setAge(user.user_metadata.age ?? '');
      setGender(user.user_metadata.gender ?? '');
      setProfession(user.user_metadata.profession ?? '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!age || !gender || !profession) {
      return Alert.alert('Eksik Bilgi', 'Tüm alanları doldur kanka!');
    }
    setFormLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: { age, gender, profession },
    });
    if (error) {
      Alert.alert('Hata', error.message);
    } else {
      Alert.alert('Başarılı 🎉', 'Profil bilgilerin kaydedildi!');
      setShowProfileModal(false);
    }
    setFormLoading(false);
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) return Alert.alert('Hata', 'Şifre en az 6 karakter olmalı!');
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      Alert.alert('Hata', error.message);
    } else {
      Alert.alert('Başarılı 🛡️', 'Şifren güncellendi!');
      setShowPasswordModal(false);
      setNewPassword('');
    }
    setPwLoading(false);
  };

  const handleSignOut = () => {
    Alert.alert('Çıkış Yap', 'Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Evet', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      {/* Avatar */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <User size={50} color="#000" />
        </View>
        <Text style={styles.userName}>GarbGenie Kullanıcısı</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Profil Tamamlama Banner — tıklanınca modal açılır */}
      <TouchableOpacity
        style={[styles.banner, isProfileComplete ? styles.bannerDone : styles.bannerPending]}
        onPress={() => setShowProfileModal(true)}
        activeOpacity={0.8}
      >
        {isProfileComplete
          ? <CheckCircle size={20} color="#16a34a" />
          : <AlertCircle size={20} color="#b45309" />
        }
        <Text style={[styles.bannerText, isProfileComplete ? styles.bannerTextDone : styles.bannerTextPending]}>
          {isProfileComplete ? 'Profil bilgilerin tamamlandı ✓' : 'Profil bilgilerini tamamla, daha iyi kombin önerileri alırsın!'}
        </Text>
        <ChevronRight size={18} color={isProfileComplete ? '#16a34a' : '#b45309'} />
      </TouchableOpacity>

      {/* Hesap Menüsü */}
      <View style={styles.menuContainer}>
        <View style={styles.menuItem}>
          <Mail size={22} color="#666" />
          <Text style={styles.menuText}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.menuItem} onPress={() => setShowPasswordModal(true)}>
          <Lock size={22} color="#666" />
          <Text style={styles.menuText}>Şifreyi Değiştir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, styles.signOutItem]} onPress={handleSignOut}>
          <LogOut size={22} color="#ff4444" />
          <Text style={[styles.menuText, styles.signOutText]}>Güvenli Çıkış Yap</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.versionText}>GarbGenie v1.0.5 - İzmir</Text>

      {/* Profil Bilgileri Modal */}
      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kişisel Bilgiler</Text>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Yaş</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              placeholder="Örn. 25"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Cinsiyet</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowGenderPicker(!showGenderPicker)}>
              <Text style={[styles.pickerBtnText, !gender && { color: '#999' }]}>
                {gender || 'Seç...'}
              </Text>
              <ChevronDown size={18} color="#666" />
            </TouchableOpacity>
            {showGenderPicker && (
              <View style={styles.pickerOptions}>
                {GENDER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.pickerOption, gender === opt && styles.pickerOptionSelected]}
                    onPress={() => { setGender(opt); setShowGenderPicker(false); }}
                  >
                    <Text style={[styles.pickerOptionText, gender === opt && styles.pickerOptionTextSelected]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={[styles.label, { marginTop: 14 }]}>Meslek</Text>
            <TextInput
              style={styles.input}
              value={profession}
              onChangeText={setProfession}
              placeholder="Örn. Yazılımcı"
              placeholderTextColor="#999"
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={formLoading}>
              {formLoading ? <ActivityIndicator color="#fff" /> : (
                <View style={styles.btnRow}>
                  <Save size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Kaydet</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Şifre Değiştir Modal */}
      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Şifre Güncelle</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Yeni Şifre"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdatePassword} disabled={pwLoading}>
              {pwLoading ? <ActivityIndicator color="#fff" /> : (
                <View style={styles.btnRow}>
                  <Save size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Şifreyi Kaydet</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, paddingTop: 60, paddingBottom: 40, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 20 },
  avatarContainer: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  userName: { fontSize: 22, fontWeight: 'bold' },
  userEmail: { fontSize: 14, color: '#888', marginTop: 5 },
  banner: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14, marginBottom: 20 },
  bannerDone: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  bannerPending: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  bannerTextDone: { color: '#15803d' },
  bannerTextPending: { color: '#92400e' },
  menuContainer: { width: '100%', backgroundColor: '#f9f9f9', borderRadius: 20, padding: 10, marginBottom: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#eee' },
  menuText: { marginLeft: 15, fontSize: 16, color: '#333', fontWeight: '500' },
  signOutItem: { borderBottomWidth: 0 },
  signOutText: { color: '#ff4444', fontWeight: 'bold' },
  versionText: { color: '#ccc', fontSize: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, alignSelf: 'flex-start' },
  input: { backgroundColor: '#f5f5f5', padding: 14, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#eee', fontSize: 15, color: '#000', width: '100%' },
  pickerBtn: { width: '100%', backgroundColor: '#f5f5f5', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pickerBtnText: { fontSize: 15, color: '#000' },
  pickerOptions: { width: '100%', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 6, overflow: 'hidden' },
  pickerOption: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pickerOptionSelected: { backgroundColor: '#000' },
  pickerOptionText: { fontSize: 15, color: '#333' },
  pickerOptionTextSelected: { color: '#fff', fontWeight: '700' },
  saveBtn: { backgroundColor: '#000', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 8, width: '100%' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
});
