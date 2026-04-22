import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEYS = {
  PROFILE:         'cache_profile',
  BOOKMARKS:       'cache_bookmarks',
  RECENT_SEARCHES: 'cache_recent_searches',
  ATTRACTIONS:     'cache_attractions',
  EVENTS:          'cache_events',
};

// ─────────────────────────────────────────────
// ENCRYPTION HELPERS
// ─────────────────────────────────────────────
const ENCRYPTION_KEY = 'ExploreEase_2025_SecureKey';

async function encrypt(data) {
  try {
    const jsonStr = JSON.stringify(data);
    const keyHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      ENCRYPTION_KEY
    );
    // XOR-based obfuscation using key hash
    const encoded = jsonStr.split('').map((char, i) => {
      const keyChar = keyHash[i % keyHash.length];
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
    }).join('');
    return btoa(unescape(encodeURIComponent(encoded)));
  } catch (e) {
    // Fallback to plain JSON if encryption fails
    return JSON.stringify(data);
  }
}

async function decrypt(encrypted) {
  try {
    const keyHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      ENCRYPTION_KEY
    );
    const encoded = decodeURIComponent(escape(atob(encrypted)));
    const decoded = encoded.split('').map((char, i) => {
      const keyChar = keyHash[i % keyHash.length];
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
    }).join('');
    return JSON.parse(decoded);
  } catch (e) {
    // Fallback — try plain JSON parse
    try { return JSON.parse(encrypted); } catch { return null; }
  }
}

// ─────────────────────────────────────────────
// GENERIC HELPERS
// ─────────────────────────────────────────────
async function saveCache(key, data) {
  try {
    const encrypted = await encrypt({
      data,
      savedAt: Date.now(),
    });
    await AsyncStorage.setItem(key, encrypted);
  } catch (e) {
    console.warn('Cache save error:', e.message);
  }
}

async function loadCache(key, maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const decrypted = await decrypt(raw);
    if (!decrypted) return null;
    const { data, savedAt } = decrypted;
    if (Date.now() - savedAt > maxAgeMs) return null;
    return data;
  } catch (e) {
    console.warn('Cache load error:', e.message);
    return null;
  }
}

async function clearCache(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn('Cache clear error:', e.message);
  }
}

// ─────────────────────────────────────────────
// PROFILE CACHE
// ─────────────────────────────────────────────
export async function cacheProfile(profile) {
  await saveCache(KEYS.PROFILE, profile);
}

export async function getCachedProfile() {
  return loadCache(KEYS.PROFILE);
}

export async function clearCachedProfile() {
  await clearCache(KEYS.PROFILE);
}

// ─────────────────────────────────────────────
// BOOKMARKS CACHE
// ─────────────────────────────────────────────
export async function cacheBookmarks(bookmarks) {
  await saveCache(KEYS.BOOKMARKS, bookmarks);
}

export async function getCachedBookmarks() {
  return loadCache(KEYS.BOOKMARKS);
}

// ─────────────────────────────────────────────
// RECENT SEARCHES CACHE
// ─────────────────────────────────────────────
export async function saveRecentSearch(query) {
  try {
    const existing = await getCachedRecentSearches() ?? [];
    const updated  = [
      query,
      ...existing.filter(q => q !== query),
    ].slice(0, 10);
    await saveCache(KEYS.RECENT_SEARCHES, updated);
  } catch (e) {
    console.warn('Recent search save error:', e.message);
  }
}

export async function getCachedRecentSearches() {
  return loadCache(KEYS.RECENT_SEARCHES, 7 * 24 * 60 * 60 * 1000);
}

export async function clearRecentSearches() {
  await clearCache(KEYS.RECENT_SEARCHES);
}

// ─────────────────────────────────────────────
// ATTRACTIONS CACHE
// ─────────────────────────────────────────────
export async function cacheAttractions(attractions) {
  await saveCache(KEYS.ATTRACTIONS, attractions);
}

export async function getCachedAttractions() {
  return loadCache(KEYS.ATTRACTIONS, 60 * 60 * 1000);
}

// ─────────────────────────────────────────────
// EVENTS CACHE
// ─────────────────────────────────────────────
export async function cacheEvents(events) {
  await saveCache(KEYS.EVENTS, events);
}

export async function getCachedEvents() {
  return loadCache(KEYS.EVENTS, 60 * 60 * 1000);
}

// ─────────────────────────────────────────────
// CLEAR ALL CACHE (on logout)
// ─────────────────────────────────────────────
export async function clearAllCache() {
  await Promise.all(Object.values(KEYS).map(k => clearCache(k)));
}
