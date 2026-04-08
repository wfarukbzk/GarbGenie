export type CurrentWeather = {
  city?: string;
  description: string;
  tempC: number;
};

type OpenWeatherResponse = {
  name?: string;
  weather?: Array<{
    description?: string;
  }>;
  main?: {
    temp?: number;
  };
};

type OpenWeatherErrorResponse = {
  message?: string;
};

function assertNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${label} değeri alınamadı.`);
  }
  return value;
}

export async function fetchCurrentWeatherByCoords(params: {
  lat: number;
  lon: number;
  signal?: AbortSignal;
}): Promise<CurrentWeather> {
  const apiKey = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Hava durumu API anahtarı tanımlı değil. `.env` içine `EXPO_PUBLIC_OPENWEATHER_API_KEY` ekleyin.'
    );
  }

  const url = new URL('https://api.openweathermap.org/data/2.5/weather');
  url.searchParams.set('lat', String(params.lat));
  url.searchParams.set('lon', String(params.lon));
  url.searchParams.set('appid', apiKey);
  url.searchParams.set('units', 'metric');
  url.searchParams.set('lang', 'tr');

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) {
    let details = '';
    try {
      const maybeJson = (await res.json()) as OpenWeatherErrorResponse;
      details = typeof maybeJson?.message === 'string' ? maybeJson.message : '';
    } catch {
      try {
        details = await res.text();
      } catch {
        // ignore
      }
    }
    const suffix = details ? `: ${details}` : '';
    throw new Error(`Hava durumu alınamadı (HTTP ${res.status})${suffix}.`);
  }

  const json = (await res.json()) as OpenWeatherResponse;
  const tempC = assertNumber(json.main?.temp, 'Sıcaklık');
  const description = json.weather?.[0]?.description?.trim() || 'Bilinmiyor';

  return {
    city: json.name?.trim() || undefined,
    description,
    tempC,
  };
}
