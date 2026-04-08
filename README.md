 Kurulum ve Çalıştırma
Projeyi yerel ortamınızda çalıştırmak için:

Repoyu klonlayın:

git clone https://github.com/wfarukbzk/SubGuard.git
Bağımlılıkları yükleyin:

cd SubGuard
npm install
 Supabase Ayarları: lib/supabase.js dosyası içerisine kendi Supabase URL ve ANON KEY bilgilerinizi girmeniz gerekmektedir.

Hava durumu (OpenWeather): `.env` dosyasına `EXPO_PUBLIC_OPENWEATHER_API_KEY` ekleyin.

Uygulamayı başlatın:

npx expo start
