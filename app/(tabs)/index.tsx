import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { CloudSun } from 'lucide-react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.weatherCard}>
        <CloudSun size={32} color="#555" />
        <Text style={styles.weatherText}>Bugün Hava: 18°C - Parçalı Bulutlu</Text>
      </View>

      <Text style={styles.heroText}>GarbGenie Sizin İçin Hazır!</Text>
      
      <TouchableOpacity style={styles.mainButton}>
        <Text style={styles.buttonText}>Bugün Ne Giymeliyim?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  weatherCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 15, borderRadius: 15, marginBottom: 40, width: '100%' },
  weatherText: { marginLeft: 10, fontSize: 16, color: '#333' },
  heroText: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 30 },
  mainButton: { backgroundColor: '#000', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 30, elevation: 5 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});