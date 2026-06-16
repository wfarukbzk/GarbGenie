import type { CurrentWeather } from '@/lib/weather';

export type WardrobeItemForAI = {
  id: string;
  category: string;
  season: string;
};

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
  shoesId?: string | null;
  outerwearId?: string | null;
  accessoryId?: string | null;
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
  const temp = Math.round(params.weather.tempC);
  const preferOuter = temp < 18; // 18 derecenin altındaysa dış giyim öncelikli

  const allTops = params.clothes.filter((item) => item.category === 'Üst Giyim');
  const allBottoms = params.clothes.filter((item) => item.category === 'Alt Giyim');
  const allShoes = params.clothes.filter((item) => item.category === 'Ayakkabı');
  const allOuterwears = params.clothes.filter((item) => item.category === 'Dış Giyim');
  const allAccessories = params.clothes.filter((item) => item.category === 'Takı & Aksesuar');

  if (allTops.length === 0 || allBottoms.length === 0) {
    throw new Error('Kombin için yeterli üst ve alt giyim bulunamadı.');
  }

  const tops = filterBySeason(allTops, seasons);
  const bottoms = filterBySeason(allBottoms, seasons);
  const shoesList = filterBySeason(allShoes, seasons);
  
  const { top, bottom } = pickVariedPair(tops.length > 0 ? tops : allTops, bottoms.length > 0 ? bottoms : allBottoms, excludeCombinations);
  
  // Ayakkabı seçimi (Zorunlu)
  const shoes = shoesList.length > 0 ? pickRandom(shoesList) : (allShoes.length > 0 ? pickRandom(allShoes) : null);
  
  // Dış Giyim seçimi (Hava soğuksa)
  let outerwear = null;
  if (preferOuter && allOuterwears.length > 0) {
      const validOuters = filterBySeason(allOuterwears, seasons);
      outerwear = validOuters.length > 0 ? pickRandom(validOuters) : pickRandom(allOuterwears);
  }

  // Takı & Aksesuar seçimi (Rastgele bir şıklık katmak için)
  const accessory = allAccessories.length > 0 && Math.random() > 0.3 ? pickRandom(allAccessories) : null;

  const reason =
    temp < 10 ? `${temp}°C oldukça soğuk, sıcak tutacak tam bir kombin hazırladım.`
      : temp < 15 ? `${temp}°C serin, katmanlı giyinebileceğin şık bir kombin.`
        : temp < 22 ? `${temp}°C ılık, rahat ve tarz bir bahar kombini.`
          : `${temp}°C sıcak, hafif ve ferah parçalar seçtim.`;

  return { 
    topId: top.id, 
    bottomId: bottom.id, 
    shoesId: shoes?.id,
    outerwearId: outerwear?.id,
    accessoryId: accessory?.id,
    reason, 
    source: 'local' 
  };
}

function buildPrompt(
  clothes: WardrobeItemForAI[],
  weather: CurrentWeather,
  excludeCombinations: OutfitCombinationKey[],
  userProfile?: UserProfileForAI
): string {
  const wardrobeJson = JSON.stringify(clothes);
  const excludeText = excludeCombinations.length > 0
      ? `Tekrar etme, bu üst/alt kombinleri önerme: ${JSON.stringify(excludeCombinations)}. ` : '';

  const profileText = userProfile 
    ? `Kullanıcı Profili - Yaş: ${userProfile.age || 'Belirtilmemiş'}, Cinsiyet: ${userProfile.gender || 'Belirtilmemiş'}, Meslek/Tarz: ${userProfile.profession || 'Belirtilmemiş'}. Lütfen kombin önerisini bu kişisel bilgilere uygun tarzda yap. ` 
    : '';

  return `Gardıroptan hava durumuna uygun TAM BİR KOMBİN (Full Outfit) seç. ${excludeText}Her seferinde farklı bir tarz yarat.
${profileText}
Hava: ${Math.round(weather.tempC)}°C, ${weather.description}
Kıyafetler: ${wardrobeJson}

KURALLAR:
1. "topId" (Üst Giyim) ve "bottomId" (Alt Giyim) zorunludur.
2. "shoesId" (Ayakkabı) varsa zorunludur, yoksa null bırak.
3. Hava serinse veya kombine şıklık katacaksa "outerwearId" (Dış Giyim) ekle, yoksa null bırak.
4. Kombini tamamlayacak "accessoryId" (Takı & Aksesuar) ekle, dolapta yoksa veya gerekmiyorsa null bırak.
5. JSON çıktısı KESİNLİKLE şu yapıda olmalıdır:

{"topId":"...","bottomId":"...","shoesId":"...","outerwearId":"...","accessoryId":"...","reason":"Türkçe 1 samimi cümle"}`;
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
    shoesId: parsed.shoesId || null,
    outerwearId: parsed.outerwearId || null,
    accessoryId: parsed.accessoryId || null,
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
    } catch { }

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

async function suggestOutfitWithGemini(params: {
  clothes: WardrobeItemForAI[];
  weather: CurrentWeather;
  userProfile?: UserProfileForAI;
  excludeCombinations?: OutfitCombinationKey[];
  signal?: AbortSignal;
}): Promise<Omit<OutfitSuggestionResult, 'source'>> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API anahtarı tanımlı değil.');
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
          ...local,
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
      reason: `${local.reason} (Gemini kapalı, hava durumuna göre yerel seçim.)`,
    };
  }

  try {
    const gemini = await suggestOutfitWithGemini(params);
    return { ...gemini, source: 'gemini' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = (error as Error & { status?: number }).status ?? 0;

    if (isInvalidApiKeyError(status, message)) {
      throw new Error('Gemini API anahtarı geçersiz.');
    }

    const local = suggestOutfitLocally(params);
    const hint = isQuotaOrRateLimitError(status, message) ? 'Gemini kotası doluydu' : 'Gemini kullanılamıyor';

    return {
      ...local,
      reason: `${local.reason} (${hint}, yerel seçim.)`,
    };
  }
}