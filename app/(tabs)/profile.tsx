import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator } from 'react-native';
import { LogOut, User, Mail, ShieldCheck, Lock, X, Save } from 'lucide-react-native';
// @ts-ignore
import { supabase } from '../../supabase'; 
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Çıkış Yap', 'Emin misin kanka?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Evet', style: 'destructive', onPress: () => signOut() }
    ]);
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      return Alert.alert('Hata', 'Şifre en az 6 karakter olmalı kanka!');
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      Alert.alert('Hata', error.message);
    } else {
      Alert.alert('Başarılı 🛡️', 'Şifren güncellendi kanka!');
      setShowPasswordModal(false);
      setNewPassword('');
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <User size={50} color="#000" />
        </View>
        <Text style={styles.userName}>GarbGenie Kullanıcısı</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      <View style={styles.menuContainer}>
        <View style={styles.menuItem}>
          <Mail size={22} color="#666" />
          <Text style={styles.menuText}>{user?.email}</Text>
        </View>

        {/* ŞİFRE DEĞİŞTİRME BUTONU */}
        <TouchableOpacity style={styles.menuItem} onPress={() => setShowPasswordModal(true)}>
          <Lock size={22} color="#666" />
          <Text style={styles.menuText}>Şifreyi Değiştir</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, styles.signOutItem]} onPress={handleSignOut}>
          <LogOut size={22} color="#ff4444" />
          <Text style={[styles.menuText, styles.signOutText]}>Güvenli Çıkış Yap</Text>
        </TouchableOpacity>
      </View>

      {/* ŞİFRE DEĞİŞTİRME MODALI */}
      <Modal visible={showPasswordModal} animationType="slide" transparent={true}>
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

            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleUpdatePassword}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Save size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>Şifreyi Kaydet</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Text style={styles.versionText}>GarbGenie v1.0.5 - İzmir</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  header: { alignItems: 'center', marginTop: 80, marginBottom: 40 },
  avatarContainer: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  userName: { fontSize: 22, fontWeight: 'bold' },
  userEmail: { fontSize: 14, color: '#888', marginTop: 5 },
  menuContainer: { backgroundColor: '#f9f9f9', borderRadius: 20, padding: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#eee' },
  menuText: { marginLeft: 15, fontSize: 16, color: '#333', fontWeight: '500' },
  signOutItem: { borderBottomWidth: 0 },
  signOutText: { color: '#ff4444', fontWeight: 'bold' },
  versionText: { textAlign: 'center', marginTop: 30, color: '#ccc', fontSize: 12 },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  input: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 12, marginBottom: 20, fontSize: 16 },
  saveBtn: { backgroundColor: '#000', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});