import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
  Image, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../hooks/useLocation';
import { getNearbyAttractions, seedSampleAttractions } from '../../services/locationService';
import { getDistance, formatDistance } from '../../services/locationService';
import { INTEREST_TAGS } from '../../utils/constants';

export default function HomeScreen({ navigation }) {
  const { userProfile } = useAuth();
  const { region, loading: locationLoading } = useLocation();

  const [attractions,      setAttractions]      = useState([]);
  const [filtered,         setFiltered]          = useState([]);
  const [activeCategory,   setActiveCategory]    = useState(null);
  const [loading,          setLoading]           = useState(true);
  const [refreshing,       setRefreshing]        = useState(false);
  const [seeding,          setSeeding]           = useState(false);

  // ── Fetch nearby attractions ─────────────────────────────
  const fetchAttractions = useCallback(async () => {
    if (!region) return;
    try {
      const data = await getNearbyAttractions(
        region.latitude,
        region.longitude,
        20 // 20km radius
      );
      setAttractions(data);
      setFiltered(data);
    } catch (e) {
      console.error('Failed to fetch attractions:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [region]);

  useEffect(() => {
    if (region) fetchAttractions();
  }, [region]);

  // ── Filter by category ───────────────────────────────────
  useEffect(() => {
    if (!activeCategory) {
      setFiltered(attractions);
    } else {
      setFiltered(attractions.filter(a => a.category === activeCategory));
    }
  }, [activeCategory, attractions]);

  // ── Pull to refresh ──────────────────────────────────────
  function handleRefresh() {
    setRefreshing(true);
    fetchAttractions();
  }

  // ── Seed sample data (dev helper) ────────────────────────
  async function handleSeed() {
    setSeeding(true);
    await seedSampleAttractions();
    await fetchAttractions();
    setSeeding(false);
  }

  const greeting = userProfile?.name
    ? `Hello, ${userProfile.name.split(' ')[0]} 👋`
    : 'Hello, Explorer 👋';

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.subGreeting}>Where do you want to go today?</Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Text style={styles.notifIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search bar (tappable — goes to SearchScreen) ── */}
      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => navigation.navigate('Search')}
        activeOpacity={0.8}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPlaceholder}>
          Search attractions, cuisines...
        </Text>
      </TouchableOpacity>

      {/* ── Category chips ── */}
      <View style={{ height: 50 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {/* "All" chip */}
          <TouchableOpacity
            style={[styles.chip, !activeCategory && styles.chipActive]}
            onPress={() => setActiveCategory(null)}
          >
            <Text style={[styles.chipText, !activeCategory && styles.chipTextActive]}>
              🌐 All
            </Text>
          </TouchableOpacity>

          {INTEREST_TAGS.map(tag => (
            <TouchableOpacity
              key={tag.id}
              style={[styles.chip, activeCategory === tag.id && styles.chipActive]}
              onPress={() => setActiveCategory(tag.id)}
            >
              <Text style={[
                styles.chipText,
                activeCategory === tag.id && styles.chipTextActive,
              ]}>
                {tag.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Section title ── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          {activeCategory
            ? `${INTEREST_TAGS.find(t => t.id === activeCategory)?.label ?? ''}`
            : 'Nearby Places'}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Map')}>
          <Text style={styles.mapLink}>🗺️ Map view</Text>
        </TouchableOpacity>
      </View>

      {/* ── Attractions list ── */}
      {loading || locationLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1D9E75" />
          <Text style={styles.loadingText}>Finding places near you...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#1D9E75"
            />
          }
          renderItem={({ item }) => (
            <AttractionCard
              item={item}
              userLat={region?.latitude}
              userLng={region?.longitude}
              onPress={() => navigation.navigate('Detail', {
                itemId: item.id,
                type:   'attraction',
              })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🏙️</Text>
              <Text style={styles.emptyTitle}>No places found nearby</Text>
              <Text style={styles.emptySubtitle}>
                Try expanding the search radius or adding sample data
              </Text>
              {/* Dev seed button — remove in production */}
              <TouchableOpacity
                style={styles.seedBtn}
                onPress={handleSeed}
                disabled={seeding}
              >
                {seeding
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.seedBtnText}>
                      + Add sample attractions
                    </Text>
                }
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Attraction card component ──────────────────────────────
function AttractionCard({ item, userLat, userLng, onPress }) {
  const avgRating = item.reviewCount
    ? (item.ratingSum / item.reviewCount).toFixed(1)
    : null;

  const distanceText = (userLat && userLng && item.location)
    ? formatDistance(getDistance(
        userLat, userLng,
        item.location.latitude  ?? item.location._lat,
        item.location.longitude ?? item.location._long,
      ))
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Image */}
      {item.images?.[0] ? (
        <Image
          source={{ uri: item.images[0] }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={{ fontSize: 40 }}>🏙️</Text>
        </View>
      )}

      {/* Category badge */}
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryBadgeText}>
          {item.category ?? 'Place'}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.cardAddress} numberOfLines={1}>
          📍 {item.address ?? 'Address not listed'}
        </Text>

        <View style={styles.cardMeta}>
          {avgRating && (
            <View style={styles.metaItem}>
              <Text style={styles.metaStar}>⭐</Text>
              <Text style={styles.metaText}>{avgRating}</Text>
              <Text style={styles.metaCount}>
                ({item.reviewCount})
              </Text>
            </View>
          )}

          {distanceText && (
            <View style={styles.metaItem}>
              <Text style={styles.metaText}>📏 {distanceText}</Text>
            </View>
          )}

          {item.priceLevel !== undefined && (
            <View style={[styles.metaItem, styles.metaRight]}>
              <Text style={styles.metaPrice}>
                {item.priceLevel === 0
                  ? 'Free'
                  : '$'.repeat(item.priceLevel)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f9fafb' },

  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  greeting:        { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  subGreeting:     { fontSize: 13, color: '#888', marginTop: 2 },
  notifBtn:        { padding: 8 },
  notifIcon:       { fontSize: 22 },

  searchBar:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 14 },
  searchIcon:      { fontSize: 16, marginRight: 8 },
  searchPlaceholder: { color: '#aaa', fontSize: 14 },

  chips:           { paddingHorizontal: 20, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip:            { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', alignSelf: 'flex-start' },
  chipActive:      { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  chipText:        { fontSize: 13, color: '#555' },
  chipTextActive:  { color: '#fff', fontWeight: '600' },

  sectionRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12, marginTop: 4 },
  sectionTitle:    { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  mapLink:         { fontSize: 13, color: '#1D9E75', fontWeight: '600' },

  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:     { color: '#888', fontSize: 14 },

  list:            { paddingHorizontal: 20, paddingBottom: 32 },

  emptyWrap:       { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji:      { fontSize: 48 },
  emptyTitle:      { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  emptySubtitle:   { fontSize: 13, color: '#aaa', textAlign: 'center', paddingHorizontal: 40 },
  seedBtn:         { backgroundColor: '#1D9E75', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 16 },
  seedBtnText:     { color: '#fff', fontWeight: '600', fontSize: 14 },

  card:            { backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#f0f0f0' },
  cardImage:       { width: '100%', height: 180 },
  cardImagePlaceholder: { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  categoryBadge:   { position: 'absolute', top: 12, left: 12, backgroundColor: '#1D9E75', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  categoryBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardInfo:        { padding: 14 },
  cardName:        { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  cardAddress:     { fontSize: 13, color: '#888', marginBottom: 10 },
  cardMeta:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaItem:        { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaRight:       { marginLeft: 'auto' },
  metaStar:        { fontSize: 12 },
  metaText:        { fontSize: 13, color: '#444', fontWeight: '500' },
  metaCount:       { fontSize: 12, color: '#aaa' },
  metaPrice:       { fontSize: 13, color: '#1D9E75', fontWeight: '700' },
});