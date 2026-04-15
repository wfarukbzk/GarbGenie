import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
// @ts-ignore
import { supabase } from '../supabase'; 

export default function LoginScreen() {
  const router = useRouter();
  
  // State'ler
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // Kayıt için 2. şifre
  const [isRegistering, setIsRegistering] = useState(false); 
  const [loading, setLoading] = useState(false);

  // Giriş ve Kayıt Ortak Fonksiyonu
  const handleAction = async () => {
    if (!email || !password) return Alert.alert('Hata', 'Bilgileri eksiksiz gir kanka!');
    
    setLoading(true);

    if (isRegistering) {
      // KAYIT OLMA MANTIĞI
      if (password !== confirmPassword) {
        setLoading(false);
        return Alert.alert('Hata', 'Şifreler uyuşmuyor kanka!');
      }

      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
      });

      if (error) {
        Alert.alert('Kayıt Hatası', error.message);
      } else {
        Alert.alert('Başarılı 📧', 'Onay maili gönderildi. Mailini onayladıktan sonra giriş yapabilirsin kanka!');
        setIsRegistering(false); // Kayıttan sonra giriş moduna alalım
      }
      
    } else {
      // GİRİŞ YAPMA MANTIĞI
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        Alert.alert('Giriş Hatası', error.message);
      } else {
        // AuthProvider otomatik algılayacak ama biz yine de fırlatalım
        router.replace('/(tabs)/wardrobe');
      }
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>GarbGenie 🧞‍♂️</Text>
        <Text style={styles.subtitle}>
          {isRegistering ? 'Yeni bir stil yolculuğuna başla' : 'Akıllı gardırobuna hoş geldin'}
        </Text>
      </View>
      
      <View style={styles.form}>
        <TextInput 
          style={styles.input} 
          placeholder="E-posta" 
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none"
          placeholderTextColor="#999"
          keyboardType="email-address"
        />

        <TextInput 
          style={styles.input} 
          placeholder="Şifre" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry
          placeholderTextColor="#999"
        />

        {/* Kayıt modundaysa ikinci input açılır */}
        {isRegistering && (
          <TextInput 
            style={styles.input} 
            placeholder="Şifreyi Onayla" 
            value={confirmPassword} 
            onChangeText={setConfirmPassword} 
            secureTextEntry
            placeholderTextColor="#999"
          />
        )}

        <TouchableOpacity style={styles.mainBtn} onPress={handleAction} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {isRegistering ? 'Şimdi Kayıt Ol' : 'Giriş Yap'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toggleBtn} 
          onPress={() => {
            setIsRegistering(!isRegistering);
            setConfirmPassword('');
          }}
        >
          <Text style={styles.toggleText}>
            {isRegistering ? 'Zaten hesabım var? Giriş Yap' : 'Hesabın yok mu? Kayıt Ol'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', padding: 30 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 42, fontWeight: 'bold', color: '#000' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 10, textAlign: 'center' },
  form: { width: '100%' },
  input: { 
    backgroundColor: '#f9f9f9', 
    padding: 18, 
    borderRadius: 15, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: '#eee', 
    fontSize: 16, 
    color: '#000' 
  },
  mainBtn: { 
    backgroundColor: '#000', 
    padding: 18, 
    borderRadius: 15, 
    alignItems: 'center', 
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  toggleBtn: { marginTop: 25, alignItems: 'center' },
  toggleText: { color: '#666', fontWeight: '500', fontSize: 14 }
});