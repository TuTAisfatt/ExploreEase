import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveRecentSearch, getCachedRecentSearches, clearRecentSearches } from '../../utils/offlineCache';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Keyboard, ScrollView,
} from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useLocation } from '../../hooks/useLocation';
import { useAuth } from '../../context/AuthContext';
import { getDistance, formatDistance } from '../../services/locationService';
import { suggestDayItinerary } from '../../services/recommendationService';
import { INTEREST_TAGS } from '../../utils/constants';

const SORT_OPTIONS = [
  { id: 'distance',   label: '📏 Nearest'    },
  { id: 'rating',     label: '⭐ Top rated'  },
  { id: 'popularity', label: '🔥 Popular'    },
  { id: 'name',       label: '🔤 A–Z'        },
];

const PRICE_OPTIONS = [
  { id: null, label: 'Any'  },
  { id: 0,    label: 'Free' },
  { id: 1,    label: '$'    },
  { id: 2,    label: '$$'   },
  { id: 3,    label: '$$$'  },
];

export default function SearchScreen({ navigation }) {
  const { region } = useLocation();
  const { userProfile } = useAuth();
  const inputRef = useRef(null);

  const [query,          setQuery]          = useState('');
  const [allAttractions, setAllAttractions] = useState([]);
  const [results,        setResults]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [sortBy,         setSortBy]         = useState('distance');
  const [priceFilter,    setPriceFilter]    = useState(null);
  const [showFilters,    setShowFilters]    = useState(false);
  const [suggestions,    setSuggestions]    = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches,  setRecentSearches]  = useState([]);
  const [isListening,     setIsListening]     = useState(false);
  const [voiceText,       setVoiceText]       = useState('');
  const [showSmartSearch, setShowSmartSearch] = useState(false);
  const [mood,                setMood]                = useState('explore');
  const [availableHours,      setAvailableHours]      = useState(4);
  const [maxBudget,           setMaxBudget]           = useState(null);
  const [itinerarySuggestion, setItinerarySuggestion] = useState(null);
  const [loadingSuggestion,   setLoadingSuggestion]   = useState(false);
  const [activeTab,           setActiveTab]           = useState('search');

  // ── Load recent searches ──────────────────────────────────
  useEffect(() => {
    getCachedRecentSearches().then(searches => {
      if (searches) setRecentSearches(searches);
    });
  }, []);

  // ── Load all attractions once ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'attractions'));
        const data = snap.docs.map(d => {
          const item = { id: d.id, ...d.data() };
          // Attach distance if we have location
          if (region && item.location) {
            const lat = item.location.latitude  ?? item.location._lat;
            const lng = item.location.longitude ?? item.location._long;
            item.distance = getDistance(
              region.latitude, region.longitude, lat, lng
            );
          }
          return item;
        });
        setAllAttractions(data);
        setResults(data);
      } catch (e) {
        console.error('Search load error:', e);
      } finally {
        setLoading(false);
      }
    })();
    // Auto-focus search input
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Voice search ─────────────────────────────────────────
  async function handleVoiceSearch() {
    if (isListening) {
      setIsListening(false);
      return;
    }
    setIsListening(true);
    // Simulate voice recognition with a 2-second delay
    // On a real device this would use expo-av or @react-native-voice/voice
    setTimeout(() => {
      const voicePhrases = [
        'food near me',
        'culture museum',
        'shopping market',
        'outdoor adventure',
        'nature park',
      ];
      const randomPhrase = voicePhrases[Math.floor(Math.random() * voicePhrases.length)];
      setQuery(randomPhrase);
      setIsListening(false);
      setVoiceText(randomPhrase);
    }, 2000);
  }

  // ── Smart itinerary search ────────────────────────────────
  async function handleSmartSearch() {
    setLoadingSuggestion(true);
    try {
      const timeOfDay = (() => {
        const h = new Date().getHours();
        if (h >= 6  && h < 12) return 'morning';
        if (h >= 12 && h < 17) return 'afternoon';
        if (h >= 17 && h < 21) return 'evening';
        return 'night';
      })();

      const { itinerary, totalHours } = suggestDayItinerary({
        attractions:    allAttractions,
        availableHours,
        timeOfDay,
        mood,
        maxDistance:    9999,
        userLat:        region?.latitude,
        userLng:        region?.longitude,
        userInterests:  userProfile?.interests ?? [],
      });

      // Filter by budget if set
      const filtered = maxBudget !== null
        ? itinerary.filter(a => (a.priceLevel ?? 0) <= maxBudget)
        : itinerary;

      setItinerarySuggestion({ itinerary: filtered, totalHours });
    } catch (e) {
      console.error('handleSmartSearch error:', e);
    } finally {
      setLoadingSuggestion(false);
    }
  }

  // ── Filter + sort whenever anything changes ──────────────
  useEffect(() => {
    let data = [...allAttractions];

    // Text search — matches name or category
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      data = data.filter(
        a =>
          a.name?.toLowerCase().includes(q) ||
          a.category?.toLowerCase().includes(q) ||
          a.address?.toLowerCase().includes(q) ||
          a.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (activeCategory) {
      data = data.filter(a => a.category === activeCategory);
    }

    // Price filter
    if (priceFilter !== null) {
      data = data.filter(a => a.priceLevel === priceFilter);
    }

    // Sort
    data.sort((a, b) => {
      if (sortBy === 'distance') {
        return (a.distance ?? 999) - (b.distance ?? 999);
      }
      if (sortBy === 'rating') {
        const rA = a.reviewCount ? a.ratingSum / a.reviewCount : 0;
        const rB = b.reviewCount ? b.ratingSum / b.reviewCount : 0;
        return rB - rA;
      }
      if (sortBy === 'popularity') {
        return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      }
      if (sortBy === 'name') {
        return (a.name ?? '').localeCompare(b.name ?? '');
      }
      return 0;
    });

    setResults(data);
  }, [query, activeCategory, sortBy, priceFilter, allAttractions]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Search bar ── */}
      <View style={styles.searchHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.inputWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search attractions, food, culture..."
            placeholderTextColor="#aaa"
            value={query}
            onChangeText={text => {
              setQuery(text);
              if (text.trim().length > 0) {
                const q = text.trim().toLowerCase();
                const matches = allAttractions
                  .filter(a => a.name?.toLowerCase().startsWith(q))
                  .slice(0, 4)
                  .map(a => a.name);
                setSuggestions(matches);
                setShowSuggestions(matches.length > 0);
              } else {
                setSuggestions([]);
                setShowSuggestions(false);
              }
            }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              setShowSuggestions(false);
              if (query.trim()) saveRecentSearch(query.trim());
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => {
              setQuery('');
              setSuggestions([]);
              setShowSuggestions(false);
            }}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleVoiceSearch}>
            <Text style={[styles.micIcon, isListening && styles.micIconActive]}>
              {isListening ? '🔴' : '🎤'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.filterBtn, showSmartSearch && styles.filterBtnActive]}
          onPress={() => setShowSmartSearch(!showSmartSearch)}
        >
          <Text style={styles.filterBtnText}>✨</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterBtnText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* ── Dropdowns (outside searchHeader) ── */}
      {query.length === 0 && recentSearches.length > 0 && (
        <View style={styles.recentBox}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent searches</Text>
            <TouchableOpacity onPress={() => {
              clearRecentSearches();
              setRecentSearches([]);
            }}>
              <Text style={styles.recentClear}>Clear</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map((search, index) => (
            <TouchableOpacity
              key={index}
              style={styles.recentItem}
              onPress={() => {
                setQuery(search);
                Keyboard.dismiss();
              }}
            >
              <Text style={styles.recentIcon}>🕐</Text>
              <Text style={styles.recentText}>{search}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showSuggestions && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.suggestionItem,
                index < suggestions.length - 1 && styles.suggestionBorder,
              ]}
              onPress={() => {
                setQuery(suggestion);
                setSuggestions([]);
                setShowSuggestions(false);
                Keyboard.dismiss();
              }}
            >
              <Text style={styles.suggestionIcon}>🔍</Text>
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Voice listening indicator ── */}
      {isListening && (
        <View style={styles.listeningBanner}>
          <ActivityIndicator size="small" color="#1D9E75" />
          <Text style={styles.listeningText}>Listening... speak now</Text>
          <TouchableOpacity onPress={() => setIsListening(false)}>
            <Text style={styles.listeningCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Tab switcher ── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'search' && styles.tabBtnActive]}
          onPress={() => setActiveTab('search')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'search' && styles.tabBtnTextActive]}>
            🔍 Search
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'smart' && styles.tabBtnActive]}
          onPress={() => setActiveTab('smart')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'smart' && styles.tabBtnTextActive]}>
            ✨ Smart Discovery
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Smart Discovery Panel ── */}
      {activeTab === 'smart' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.smartPanel} showsVerticalScrollIndicator={false}>
          <Text style={styles.smartLabel}>What's your mood?</Text>
          <View style={styles.smartRow}>
            {[
              { id: 'explore', label: '🧭 Explore' },
              { id: 'relax',   label: '😌 Relax'   },
              { id: 'foodie',  label: '🍜 Foodie'  },
              { id: 'shop',    label: '🛍️ Shop'    },
              { id: 'culture', label: '🏛️ Culture' },
              { id: 'active',  label: '⚡ Active'  },
            ].map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.smartChip, mood === m.id && styles.smartChipActive]}
                onPress={() => setMood(m.id)}
              >
                <Text style={[styles.smartChipText, mood === m.id && styles.smartChipTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.smartLabel}>Available time</Text>
          <View style={styles.smartRow}>
            {[1, 2, 3, 4, 6, 8].map(h => (
              <TouchableOpacity
                key={h}
                style={[styles.smartChip, availableHours === h && styles.smartChipActive]}
                onPress={() => setAvailableHours(h)}
              >
                <Text style={[styles.smartChipText, availableHours === h && styles.smartChipTextActive]}>
                  {h}h
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.smartLabel}>Budget</Text>
          <View style={styles.smartRow}>
            {[
              { id: null, label: 'Any'  },
              { id: 0,    label: 'Free' },
              { id: 1,    label: '$'    },
              { id: 2,    label: '$$'   },
              { id: 3,    label: '$$$'  },
            ].map(b => (
              <TouchableOpacity
                key={String(b.id)}
                style={[styles.smartChip, maxBudget === b.id && styles.smartChipActive]}
                onPress={() => setMaxBudget(b.id)}
              >
                <Text style={[styles.smartChipText, maxBudget === b.id && styles.smartChipTextActive]}>
                  {b.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.suggestBtn}
            onPress={handleSmartSearch}
            disabled={loadingSuggestion}
          >
            {loadingSuggestion
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.suggestBtnText}>✨ Suggest {availableHours}-hour itinerary</Text>
            }
          </TouchableOpacity>

          {itinerarySuggestion && (
            <View style={styles.suggestionResult}>
              <Text style={styles.suggestionTitle}>
                🗺️ Your {itinerarySuggestion.totalHours.toFixed(1)}-hour itinerary
              </Text>
              {itinerarySuggestion.itinerary.length === 0 ? (
                <Text style={styles.suggestionEmpty}>
                  No places found matching your criteria. Try adjusting filters.
                </Text>
              ) : (
                itinerarySuggestion.itinerary.map((place, index) => (
                  <TouchableOpacity
                    key={place.id}
                    style={styles.smartResultItem}
                    onPress={() => navigation.navigate('Detail', { itemId: place.id, type: 'attraction' })}
                  >
                    <View style={styles.suggestionBadge}>
                      <Text style={styles.suggestionBadgeText}>{index + 1}</Text>
                    </View>
                    <View style={styles.suggestionInfo}>
                      <Text style={styles.suggestionName} numberOfLines={1}>{place.name}</Text>
                      <Text style={styles.suggestionMeta}>
                        {place.category} · ⏱️ ~{place.estimatedDuration}h
                        {place.priceLevel === 0 ? ' · Free' : ''}
                      </Text>
                    </View>
                    <Text style={styles.suggestionArrow}>›</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Normal search content ── */}
      {activeTab === 'search' && (
        <View style={{ flex: 1 }}>
          {/* Category chips */}
          <View style={{ backgroundColor: '#f9fafb' }}>
            <FlatList
              data={[{ id: null, label: '🌐 All' }, ...INTEREST_TAGS]}
              keyExtractor={item => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.chip, activeCategory === item.id && styles.chipActive]}
                  onPress={() => setActiveCategory(item.id)}
                >
                  <Text style={[styles.chipText, activeCategory === item.id && styles.chipTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Filters panel */}
          {showFilters && (
            <View style={styles.filtersPanel}>
              <Text style={styles.filterLabel}>Sort by</Text>
              <View style={styles.filterRow}>
                {SORT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.filterChip, sortBy === opt.id && styles.filterChipActive]}
                    onPress={() => setSortBy(opt.id)}
                  >
                    <Text style={[styles.filterChipText, sortBy === opt.id && styles.filterChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.filterLabel}>Price</Text>
              <View style={styles.filterRow}>
                {PRICE_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={String(opt.id)}
                    style={[styles.filterChip, priceFilter === opt.id && styles.filterChipActive]}
                    onPress={() => setPriceFilter(opt.id)}
                  >
                    <Text style={[styles.filterChipText, priceFilter === opt.id && styles.filterChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Results count */}
          <View style={styles.resultsRow}>
            <Text style={styles.resultsCount}>
              {results.length} result{results.length !== 1 ? 's' : ''}
              {query ? ` for "${query}"` : ''}
            </Text>
          </View>

          {/* Results list */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#1D9E75" />
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <SearchResultItem
                  item={item}
                  onPress={() => {
                    Keyboard.dismiss();
                    navigation.navigate('Detail', { itemId: item.id, type: 'attraction' });
                  }}
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>🔍</Text>
                  <Text style={styles.emptyTitle}>No results found</Text>
                  <Text style={styles.emptySub}>Try a different search term or adjust the filters</Text>
                </View>
              }
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Search result row ──────────────────────────────────────
function SearchResultItem({ item, onPress }) {
  const avgRating = item.reviewCount
    ? (item.ratingSum / item.reviewCount).toFixed(1)
    : null;

  return (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {item.images?.[0] ? (
        <Image
          source={{ uri: item.images[0] }}
          style={styles.resultImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.resultImage, styles.resultImagePlaceholder]}>
          <Text style={{ fontSize: 24 }}>🏙️</Text>
        </View>
      )}

      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.resultAddress} numberOfLines={1}>
          📍 {item.address ?? 'No address'}
        </Text>
        <View style={styles.resultMeta}>
          {avgRating && (
            <Text style={styles.resultRating}>⭐ {avgRating}</Text>
          )}
          {item.distance !== undefined && (
            <Text style={styles.resultDistance}>
              📏 {formatDistance(item.distance)}
            </Text>
          )}
          <View style={styles.resultCategoryBadge}>
            <Text style={styles.resultCategoryText}>
              {item.category ?? 'place'}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.resultArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f9fafb' },

  searchHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 8 },
  backBtn:         { padding: 8 },
  backText:        { fontSize: 22, color: '#1a1a1a' },
  inputWrap:       { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e0e0e0', gap: 8 },
  searchIcon:      { fontSize: 15 },
  input:           { flex: 1, fontSize: 15, color: '#1a1a1a' },
  clearIcon:       { fontSize: 14, color: '#aaa', padding: 2 },
  recentBox:    { position: 'absolute', top: 70, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', overflow: 'hidden', zIndex: 999, elevation: 5 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  recentTitle:  { fontSize: 13, fontWeight: '700', color: '#555' },
  recentClear:  { fontSize: 12, color: '#1D9E75', fontWeight: '600' },
  recentItem:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  recentIcon:   { fontSize: 14 },
  recentText:   { fontSize: 14, color: '#1a1a1a' },
  suggestionsBox:   { position: 'absolute', top: 70, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', overflow: 'hidden', zIndex: 999, elevation: 5 },
  suggestionItem:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  suggestionIcon:   { fontSize: 14 },
  suggestionText:   { fontSize: 15, color: '#1a1a1a' },
  filterBtn:       { backgroundColor: '#fff', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e0e0e0' },
  filterBtnActive: { backgroundColor: '#E1F5EE', borderColor: '#1D9E75' },
  filterBtnText:   { fontSize: 18 },
  micIcon:         { fontSize: 18, padding: 2 },
  micIconActive:   { opacity: 0.5 },
  listeningBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E1F5EE', marginHorizontal: 16, borderRadius: 10, padding: 10, gap: 8, marginBottom: 4 },
  listeningText:   { flex: 1, fontSize: 13, color: '#0F6E56', fontWeight: '500' },
  listeningCancel: { fontSize: 12, color: '#E24B4A', fontWeight: '600' },

  tabRow:              { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#f0f0f0', borderRadius: 12, padding: 4 },
  tabBtn:              { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabBtnActive:        { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabBtnText:          { fontSize: 13, color: '#888', fontWeight: '500' },
  tabBtnTextActive:    { color: '#1a1a1a', fontWeight: '700' },

  smartPanel:          { paddingHorizontal: 16, paddingBottom: 16 },
  smartLabel:          { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  smartRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smartChip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' },
  smartChipActive:     { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  smartChipText:       { fontSize: 13, color: '#555' },
  smartChipTextActive: { color: '#fff', fontWeight: '600' },

  suggestBtn:          { backgroundColor: '#1D9E75', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  suggestBtnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },

  suggestionResult:    { marginTop: 16, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  suggestionTitle:     { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  suggestionEmpty:     { fontSize: 13, color: '#aaa', textAlign: 'center', paddingVertical: 16 },
  smartResultItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 12 },
  suggestionBadge:     { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  suggestionBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  suggestionInfo:      { flex: 1 },
  suggestionName:      { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  suggestionMeta:      { fontSize: 12, color: '#888', marginTop: 2 },
  suggestionArrow:     { fontSize: 20, color: '#ccc' },

  chips:           { paddingHorizontal: 16, paddingVertical: 8, paddingTop: 10, gap: 8, backgroundColor: '#f9fafb' },
  chip:            { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', alignSelf: 'flex-start', justifyContent: 'center' },
  chipActive:      { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  chipText:        { fontSize: 12, color: '#555' },
  chipTextActive:  { color: '#fff', fontWeight: '600' },

  filtersPanel:    { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, padding: 12, marginTop: 4, marginBottom: 4, borderWidth: 1, borderColor: '#f0f0f0' },
  filterLabel:     { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  filterChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e8e8e8', alignSelf: 'flex-start' },
  filterChipActive:     { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  filterChipText:       { fontSize: 12, color: '#555', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },

  resultsRow:      { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4, backgroundColor: '#f9fafb' },
  resultsCount:    { fontSize: 13, color: '#888' },

  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:            { paddingHorizontal: 16, paddingBottom: 32 },

  emptyWrap:       { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji:      { fontSize: 48 },
  emptyTitle:      { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  emptySub:        { fontSize: 13, color: '#aaa', textAlign: 'center', paddingHorizontal: 40 },

  resultItem:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, padding: 12, borderWidth: 1, borderColor: '#f0f0f0', gap: 12 },
  resultImage:          { width: 70, height: 70, borderRadius: 10 },
  resultImagePlaceholder: { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  resultInfo:           { flex: 1 },
  resultName:           { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
  resultAddress:        { fontSize: 12, color: '#888', marginBottom: 6 },
  resultMeta:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultRating:         { fontSize: 12, color: '#444', fontWeight: '500' },
  resultDistance:       { fontSize: 12, color: '#444' },
  resultCategoryBadge:  { backgroundColor: '#E1F5EE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  resultCategoryText:   { fontSize: 11, color: '#0F6E56', fontWeight: '600', textTransform: 'capitalize' },
  resultArrow:          { fontSize: 20, color: '#ccc' },
});