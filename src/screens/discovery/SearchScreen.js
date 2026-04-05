import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Keyboard,
} from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useLocation } from '../../hooks/useLocation';
import { getDistance, formatDistance } from '../../services/locationService';
import { INTEREST_TAGS } from '../../utils/constants';

const SORT_OPTIONS = [
  { id: 'distance',  label: '📏 Nearest'    },
  { id: 'rating',    label: '⭐ Top rated'  },
  { id: 'name',      label: '🔤 A–Z'        },
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
  const inputRef = useRef(null);

  const [query,          setQuery]          = useState('');
  const [allAttractions, setAllAttractions] = useState([]);
  const [results,        setResults]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [sortBy,         setSortBy]         = useState('distance');
  const [priceFilter,    setPriceFilter]    = useState(null);
  const [showFilters,    setShowFilters]    = useState(false);

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
      if (sortBy === 'name') {
        return (a.name ?? '').localeCompare(b.name ?? '');
      }
      return 0;
    });

    setResults(data);
  }, [query, activeCategory, sortBy, priceFilter, allAttractions]);

  return (
    <View style={styles.container}>
      {/* ── Search bar ── */}
      <View style={styles.searchHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
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
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter toggle */}
        <TouchableOpacity
          style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterBtnText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* ── Category chips ── */}
      <FlatList
        data={[{ id: null, label: '🌐 All' }, ...INTEREST_TAGS]}
        keyExtractor={item => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={{ flexGrow: 0 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.chip,
              activeCategory === item.id && styles.chipActive,
            ]}
            onPress={() => setActiveCategory(item.id)}
          >
            <Text style={[
              styles.chipText,
              activeCategory === item.id && styles.chipTextActive,
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Filters panel ── */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          {/* Sort */}
          <Text style={styles.filterLabel}>Sort by</Text>
          <View style={styles.filterRow}>
            {SORT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.filterChip,
                  sortBy === opt.id && styles.filterChipActive,
                ]}
                onPress={() => setSortBy(opt.id)}
              >
                <Text style={[
                  styles.filterChipText,
                  sortBy === opt.id && styles.filterChipTextActive,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Price */}
          <Text style={styles.filterLabel}>Price</Text>
          <View style={styles.filterRow}>
            {PRICE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={String(opt.id)}
                style={[
                  styles.filterChip,
                  priceFilter === opt.id && styles.filterChipActive,
                ]}
                onPress={() => setPriceFilter(opt.id)}
              >
                <Text style={[
                  styles.filterChipText,
                  priceFilter === opt.id && styles.filterChipTextActive,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Results count ── */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsCount}>
          {results.length} result{results.length !== 1 ? 's' : ''}
          {query ? ` for "${query}"` : ''}
        </Text>
      </View>

      {/* ── Results list ── */}
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
                navigation.navigate('Detail', {
                  itemId: item.id,
                  type:   'attraction',
                });
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySub}>
                Try a different search term or adjust the filters
              </Text>
            </View>
          }
        />
      )}
    </View>
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

  searchHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, gap: 8 },
  backBtn:         { padding: 8 },
  backText:        { fontSize: 22, color: '#1a1a1a' },
  inputWrap:       { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e0e0e0', gap: 8 },
  searchIcon:      { fontSize: 15 },
  input:           { flex: 1, fontSize: 15, color: '#1a1a1a' },
  clearIcon:       { fontSize: 14, color: '#aaa', padding: 2 },
  filterBtn:       { backgroundColor: '#fff', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e0e0e0' },
  filterBtnActive: { backgroundColor: '#E1F5EE', borderColor: '#1D9E75' },
  filterBtnText:   { fontSize: 18 },

  chips:           { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip:            { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', alignSelf: 'flex-start', height: 36, justifyContent: 'center' },
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

  resultsRow:      { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
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