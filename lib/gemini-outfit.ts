import type { CurrentWeather } from '@/lib/weather';

export type WardrobeItemForAI = {
  id: string;
  category: string;
  season: string;
};

// KANKA BAKIŞI 1: Kullanıcı profili için yeni bir Tip (Type) ekliyoruz
export type UserProfileForAI = {
  age?: number;
  gender?: string;
  profession?: string;
};

export type OutfitCombinationKey = {
  topId: string;
  bottomId: string;
};

export type OutfitSuggestionResult = {
  topId: string;
  bottomId: string;
  reason: string;
  source: 'gemini' | 'local';
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string; code?: number };
};

const TOP_CATEGORIES = ['Üst Giyim', 'Dış Giyim'];
const BOTTOM_CATEGORY = 'Alt Giyim';

const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.5-flash',
];

function combinationKey(topId: string, bottomId: string): string {
  return `${topId}:${bottomId}`;
}

function isExcluded(topId: string, bottomId: string, excludeCombinations: OutfitCombinationKey[]): boolean {
  const key = combinationKey(topId, bottomId);
  return excludeCombinations.some((combo) => combinationKey(combo.topId, combo.bottomId) === key);
}

function pickVariedPair(
  tops: WardrobeItemForAI[],
  bottoms: WardrobeItemForAI[],
  excludeCombinations: OutfitCombinationKey[]
): { top: WardrobeItemForAI; bottom: WardrobeItemForAI } {
  const availablePairs = tops.flatMap((top) =>
    bottoms
      .filter((bottom) => !isExcluded(top.id, bottom.id, excludeCombinations))
      .map((bottom) => ({ top, bottom }))
  );

  if (availablePairs.length > 0) {
    return pickRandom(availablePairs);
  }

  return { top: pickRandom(tops), bottom: pickRandom(bottoms) };
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function getTargetSeasons(tempC: number): string[] {
  if (tempC < 10) return ['Kışlık'];
  if (tempC < 15) return ['Kışlık', 'Bahar'];
  if (tempC < 22) return ['Bahar'];
  return ['Yazlık', 'Bahar'];
}

function filterBySeason(items: WardrobeItemForAI[], seasons: string[]): WardrobeItemForAI[] {
  const matched = items.filter((item) => seasons.includes(item.season));
  return matched.length > 0 ? matched : items;
}

export function suggestOutfitLocally(params: {
  clothes: WardrobeItemForAI[];
  weather: CurrentWeather;
  excludeCombinations?: OutfitCombinationKey[];
}): OutfitSuggestionResult {
  const excludeCombinations = params.excludeCombinations ?? [];
  const seasons = getTargetSeasons(params.weather.tempC);
  const preferOuter = params.weather.tempC < 12;

  const allTops = params.clothes.filter((item) => TOP_CATEGORIES.includes(item.category));
  const allBottoms = params.clothes.filter((item) => item.category === BOTTOM_CATEGORY);

  if (allTops.length === 0 || allBottoms.length === 0) {
    throw new Error('Kombin için yeterli üst ve alt giyim bulunamadı.');
  }

  let tops = filterBySeason(allTops, seasons);

  if (preferOuter) {
    const outerwear = tops.filter((item) => item.category === 'Dış Giyim');
    if (outerwear.length > 0) {
      tops = outerwear;
    }
  } else {
    const upperTops = tops.filter((item) => item.category === 'Üst Giyim');
    if (upperTops.length > 0) {
      tops = upperTops;
    }
  }

  const bottoms = filterBySeason(allBottoms, seasons);
  const { top, bottom } = pickVariedPair(tops, bottoms, excludeCombinations);

  const temp = Math.round(params.weather.tempC);
  const reason =
    temp < 10
      ? `${temp}°C oldukca soguk, sicak tutacak parcalari sectim.`
      : temp < 15
        ? `${temp}°C serin, katmanli giyinebilecegin bir kombin.`
        : temp < 22
          ? `${temp}°C ilik, rahat bir bahar kombini.`
          : `${temp}°C sicak, hafif ve yazlik parcalar.`;

  return { topId: top.id, bottomId: bottom.id, reason, source: 'local' };
}

// KANKA BAKIŞI 2: buildPrompt fonksiyonuna userProfile parametresini ekliyoruz.
function buildPrompt(
  clothes: WardrobeItemForAI[],
  weather: CurrentWeather,
  excludeCombinations: OutfitCombinationKey[],
  userProfile?: UserProfileForAI
): string {
  const wardrobeJson = JSON.stringify(clothes);
  const excludeText =
    excludeCombinations.length > 0
      ? `Tekrar etme, bu kombinleri önerme: ${JSON.stringify(excludeCombinations)}. `
      : '';

  // KANKA BAKIŞI 3: Profil bilgilerini metin haline getiriyoruz. Eğer bilgi yoksa boş dönecek.
  const profileText = userProfile 
    ? `Kullanıcı Profili - Yaş: ${userProfile.age || 'Belirtilmemiş'}, Cinsiyet: ${userProfile.gender || 'Belirtilmemiş'}, Meslek/Tarz: ${userProfile.profession || 'Belirtilmemiş'}. Lütfen kombin önerisini bu kişisel bilgilere uygun tarzda yap. ` 
    : '';

  return `Gardıroptan hava durumuna uygun üst+alt kombin seç. ${excludeText}Her seferinde farklı bir kombin seç.
${profileText}
Hava: ${Math.round(weather.tempC)}°C, ${weather.description}
Kıyafetler: ${wardrobeJson}
Kurallar: topId=Üst Giyim veya soğukta Dış Giyim, bottomId=Alt Giyim. Soğuk→Kışlık, sıcak→Yazlık.
JSON: {"topId":"...","bottomId":"...","reason":"Türkçe 1 cümle"}`;
}

function parseGeminiJson(text: string): Omit<OutfitSuggestionResult, 'source'> {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini yanıtı okunamadı.');
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<OutfitSuggestionResult>;
  if (typeof parsed.topId !== 'string' || typeof parsed.bottomId !== 'string') {
    throw new Error('Gemini geçerli kombin seçemedi.');
  }

  return {
    topId: parsed.topId,
    bottomId: parsed.bottomId,
    reason: typeof parsed.reason === 'string' ? parsed.reason : 'Hava durumuna uygun bir kombin seçtim.',
  };
}

function validateSuggestion(
  suggestion: Omit<OutfitSuggestionResult, 'source'>,
  clothes: WardrobeItemForAI[]
): Omit<OutfitSuggestionResult, 'source'> {
  const byId = new Map(clothes.map((item) => [item.id, item]));
  const top = byId.get(suggestion.topId);
  const bottom = byId.get(suggestion.bottomId);

  if (!top || !TOP_CATEGORIES.includes(top.category)) {
    throw new Error('Seçilen üst giyim geçersiz.');
  }
  if (!bottom || bottom.category !== BOTTOM_CATEGORY) {
    throw new Error('Seçilen alt giyim geçersiz.');
  }

  return suggestion;
}

function isQuotaOrRateLimitError(status: number, message: string): boolean {
  return status === 429 || /quota|rate.?limit|exceeded/i.test(message);
}

function isRetryableGeminiError(status: number, message: string): boolean {
  return (
    isQuotaOrRateLimitError(status, message) ||
    status === 404 ||
    /not found|not supported|unsupported|deprecated|shutdown/i.test(message)
  );
}

function isInvalidApiKeyError(status: number, message: string): boolean {
  return status === 403 || (status === 400 && /api key|invalid/i.test(message));
}

async function callGeminiModel(
  model: string,
  apiKey: string,
  prompt: string,
  signal?: AbortSignal
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.8,
      },
    }),
  });

  if (!res.ok) {
    let details = '';
    try {
      const errJson = (await res.json()) as GeminiResponse;
      details = errJson.error?.message ?? '';
    } catch {
      // ignore
    }

    const error = new Error(details || `HTTP ${res.status}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  const json = (await res.json()) as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini boş yanıt döndü.');
  }

  return text;
}

// KANKA BAKIŞI 4: Bu fonksiyona userProfile'ı ekleyip buildPrompt'a paslıyoruz.
async function suggestOutfitWithGemini(params: {
  clothes: WardrobeItemForAI[];
  weather: CurrentWeather;
  userProfile?: UserProfileForAI;
  excludeCombinations?: OutfitCombinationKey[];
  signal?: AbortSignal;
}): Promise<Omit<OutfitSuggestionResult, 'source'>> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Gemini API anahtarı tanımlı değil. `.env` içine `EXPO_PUBLIC_GEMINI_API_KEY` ekleyin.'
    );
  }

  const excludeCombinations = params.excludeCombinations ?? [];
  const tops = params.clothes.filter((item) => TOP_CATEGORIES.includes(item.category));
  const bottoms = params.clothes.filter((item) => item.category === BOTTOM_CATEGORY);

  if (tops.length === 0 || bottoms.length === 0) {
    throw new Error('Kombin için yeterli üst ve alt giyim bulunamadı.');
  }

  const prompt = buildPrompt(params.clothes, params.weather, excludeCombinations, params.userProfile);
  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    try {
      const text = await callGeminiModel(model, apiKey, prompt, params.signal);
      const suggestion = validateSuggestion(parseGeminiJson(text), params.clothes);

      if (isExcluded(suggestion.topId, suggestion.bottomId, excludeCombinations)) {
        const local = suggestOutfitLocally({
          clothes: params.clothes,
          weather: params.weather,
          excludeCombinations,
        });
        return {
          topId: local.topId,
          bottomId: local.bottomId,
          reason: local.reason,
        };
      }

      return suggestion;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const status = (error as Error & { status?: number }).status ?? 0;

      if (isInvalidApiKeyError(status, message)) {
        throw error;
      }

      if (isRetryableGeminiError(status, message)) {
        lastError = error instanceof Error ? error : new Error(message);
        continue;
      }

      lastError = error instanceof Error ? error : new Error(message);
    }
  }

  throw lastError ?? new Error('Gemini modelleri şu an kullanılamıyor.');
}

// KANKA BAKIŞI 5: Ana dışa aktarılan fonksiyona userProfile desteğini ekledik.
export async function suggestOutfit(params: {
  clothes: WardrobeItemForAI[];
  weather: CurrentWeather;
  userProfile?: UserProfileForAI;
  excludeCombinations?: OutfitCombinationKey[];
  signal?: AbortSignal;
}): Promise<OutfitSuggestionResult> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    const local = suggestOutfitLocally(params);
    return {
      ...local,
      reason: `${local.reason} (Gemini API anahtarı eklenmedi, hava durumuna göre seçildi.)`,
    };
  }

  try {
    const gemini = await suggestOutfitWithGemini(params);
    return { ...gemini, source: 'gemini' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = (error as Error & { status?: number }).status ?? 0;

    if (isInvalidApiKeyError(status, message)) {
      throw new Error('Gemini API anahtarı geçersiz. AI Studio\'dan yeni bir anahtar al.');
    }

    const local = suggestOutfitLocally(params);
    const hint = isQuotaOrRateLimitError(status, message)
      ? 'Gemini kotası doluydu'
      : 'Gemini şu an kullanılamıyor';

    return {
      ...local,
      reason: `${local.reason} (${hint}, hava durumuna göre seçildi.)`,
    };
  }
}