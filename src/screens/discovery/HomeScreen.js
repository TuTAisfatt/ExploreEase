import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
  ScrollView, Image,
} from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../hooks/useLocation';
import { useRecommendations } from '../../hooks/useRecommendations';
import { getNearbyAttractions, seedSampleAttractions, formatDistance, getDistance } from '../../services/locationService';
import { cacheAttractions, getCachedAttractions } from '../../utils/offlineCache';
import { trackActivity } from '../../services/recommendationService';
import { INTEREST_TAGS } from '../../utils/constants';

export default function HomeScreen({ navigation }) {
  const { user, userProfile, isAdmin } = useAuth();
  const isOrganizer = userProfile?.role === 'organizer' || isAdmin;
  const { region, loading: locationLoading } = useLocation();
  const { recommendations, allAttractions, loading: recsLoading, seasonalContext } = useRecommendations();

  const [attractions,    setAttractions]    = useState([]);
  const [filtered,       setFiltered]       = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [seeding,        setSeeding]        = useState(false);
  const [page,           setPage]           = useState(0);
  const [hasMore,        setHasMore]        = useState(true);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [bookmarks,      setBookmarks]      = useState([]);
  const [showBookmarks,  setShowBookmarks]  = useState(false);

  // ── Fetch nearby attractions ─────────────────────────────
  const PAGE_SIZE = 10;

  const fetchAttractions = useCallback(async (reset = false) => {
    if (!region) return;
    try {
      const data = await getNearbyAttractions(
        region.latitude, region.longitude, 50
      );
      const sorted = data.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
      setAttractions(sorted);
      // Cache for offline
      await cacheAttractions(sorted);

      const currentPage = reset ? 0 : page;
      const slice = sorted.slice(0, (currentPage + 1) * PAGE_SIZE);
      setFiltered(slice);
      setPage(reset ? 1 : currentPage + 1);
      setHasMore(sorted.length > (currentPage + 1) * PAGE_SIZE);
    } catch (e) {
      console.error('Failed to fetch attractions:', e);
      // Load from cache if offline
      const cached = await getCachedAttractions();
      if (cached) {
        setAttractions(cached);
        setFiltered(cached.slice(0, PAGE_SIZE));
        setPage(1);
        setHasMore(cached.length > PAGE_SIZE);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [region, page]);

  useEffect(() => {
    if (region) fetchAttractions();
  }, [region]);

  // ── Filter by category ────────────────────────────────────
  useEffect(() => {
    const source = activeCategory
      ? attractions.filter(a => a.category === activeCategory)
      : attractions;
    const sorted = [...source].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
    setPage(1);
    setHasMore(sorted.length > PAGE_SIZE);
    setFiltered(sorted.slice(0, PAGE_SIZE));
  }, [activeCategory, attractions]);

  function handleRefresh() {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    fetchAttractions(true);
  }

  function handleLoadMore() {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const slice = attractions.slice(0, nextPage * PAGE_SIZE);
    setFiltered(slice);
    setPage(nextPage);
    setHasMore(attractions.length > nextPage * PAGE_SIZE);
    setLoadingMore(false);
  }

  async function handleSeed() {
    setSeeding(true);
    await seedSampleAttractions();
    await fetchAttractions();
    setSeeding(false);
  }

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'bookmarks'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBookmarks(items);
    } catch (e) {
      console.error('fetchBookmarks error:', e);
    }
  }, [user]);

  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  // ── Navigate to detail + track activity ──────────────────
  function handleAttractionPress(item) {
    if (user) trackActivity(user.uid, item.id, 'view');
    navigation.navigate('Detail', { itemId: item.id, type: 'attraction' });
  }

  const greeting = userProfile?.name
    ? `Hello, ${userProfile.name.split(' ')[0]} 👋`
    : 'Hello, Explorer 👋';

  const hasInterests = (userProfile?.interests ?? []).length > 0;

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.subGreeting}>Where do you want to go today?</Text>
        </View>
        <View style={styles.headerIcons}>
          {isOrganizer && (
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => navigation.navigate('CreateAttraction')}
            >
              <Text style={styles.createBtnText}>+ Create</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              fetchBookmarks();
              setShowBookmarks(true);
            }}
          >
            <Text style={styles.notifIcon}>🔖</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.notifIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1D9E75"
          />
        }
      >
        {/* ── Search bar ── */}
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

        {/* ── Seasonal context banner ── */}
        {seasonalContext && (
          <View style={styles.seasonBanner}>
            <Text style={styles.seasonEmoji}>
              {seasonalContext.season === 'dry' ? '☀️' : '🌧️'}
            </Text>
            <View>
              <Text style={styles.seasonLabel}>{seasonalContext.label}</Text>
              <Text style={styles.seasonSuggestion}>
                {seasonalContext.suggestion}
              </Text>
            </View>
          </View>
        )}

        {/* ── Personalized recommendations ── */}
        {hasInterests && recommendations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>⭐ Recommended for you</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Search')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={recommendations.slice(0, 5)}
              keyExtractor={item => `rec-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => (
                <HorizontalCard
                  item={item}
                  userLat={region?.latitude}
                  userLng={region?.longitude}
                  onPress={() => handleAttractionPress(item)}
                />
              )}
            />
          </View>
        )}

        {/* ── No interests prompt ── */}
        {!hasInterests && (
          <TouchableOpacity
            style={styles.interestPrompt}
            onPress={() => navigation.navigate('Profile', {
              screen: 'EditProfile'
            })}
          >
            <Text style={styles.interestPromptEmoji}>🎯</Text>
            <View style={styles.interestPromptText}>
              <Text style={styles.interestPromptTitle}>
                Get personalized recommendations
              </Text>
              <Text style={styles.interestPromptSub}>
                Tap to set your interests →
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Category chips ── */}
        <View style={{ height: 50 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
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
              ? INTEREST_TAGS.find(t => t.id === activeCategory)?.label ?? ''
              : 'Nearby Places'}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Map')}>
            <Text style={styles.mapLink}>🗺️ Map view</Text>
          </TouchableOpacity>
        </View>

        {/* ── Nearby attractions list ── */}
        {loading || locationLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#1D9E75" />
            <Text style={styles.loadingText}>Finding places near you...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🏙️</Text>
            <Text style={styles.emptyTitle}>No places found nearby</Text>
            <Text style={styles.emptySubtitle}>
              Try expanding the search radius or adding sample data
            </Text>
            <TouchableOpacity
              style={styles.seedBtn}
              onPress={handleSeed}
              disabled={seeding}
            >
              {seeding
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.seedBtnText}>+ Add sample attractions</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {filtered.map(item => (
              <AttractionCard
                key={item.id}
                item={item}
                userLat={region?.latitude}
                userLng={region?.longitude}
                onPress={() => handleAttractionPress(item)}
              />
            ))}
            {loadingMore && (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#1D9E75" />
              </View>
            )}
            {hasMore && !loadingMore && filtered.length > 0 && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={handleLoadMore}
              >
                <Text style={styles.loadMoreBtnText}>Load more places</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Bookmarks modal ── */}
      {showBookmarks && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔖 My Bookmarks</Text>
              <TouchableOpacity onPress={() => setShowBookmarks(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {bookmarks.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.emptyEmoji}>🔖</Text>
                <Text style={styles.emptyTitle}>No bookmarks yet</Text>
                <Text style={styles.emptySubtitle}>
                  Save places and events to see them here
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {bookmarks.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.bookmarkItem}
                    onPress={() => {
                      setShowBookmarks(false);
                      navigation.navigate('Detail', {
                        itemId: item.itemId ?? item.id,
                        type: item.type ?? 'attraction',
                      });
                    }}
                  >
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.bookmarkImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.bookmarkImage, styles.bookmarkImagePlaceholder]}>
                        <Text style={{ fontSize: 20 }}>🏙️</Text>
                      </View>
                    )}
                    <View style={styles.bookmarkInfo}>
                      <Text style={styles.bookmarkName} numberOfLines={1}>
                        {item.name ?? 'Unknown place'}
                      </Text>
                      <Text style={styles.bookmarkAddress} numberOfLines={1}>
                        📍 {item.address ?? 'No address'}
                      </Text>
                      <View style={[
                        styles.bookmarkBadge,
                        item.type === 'event' && styles.bookmarkBadgeEvent
                      ]}>
                        <Text style={styles.bookmarkBadgeText}>
                          {item.type === 'event' ? '📅 Event' : '📍 Place'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Horizontal card (for recommendations) ─────────────────
function HorizontalCard({ item, userLat, userLng, onPress }) {
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
    <TouchableOpacity style={hStyles.card} onPress={onPress} activeOpacity={0.85}>
      {item.images?.[0] ? (
        <Image source={{ uri: item.images[0] }} style={hStyles.image} resizeMode="cover" />
      ) : (
        <View style={[hStyles.image, hStyles.imagePlaceholder]}>
          <Text style={{ fontSize: 28 }}>🏙️</Text>
        </View>
      )}
      <View style={hStyles.badge}>
        <Text style={hStyles.badgeText}>{item.category ?? 'place'}</Text>
      </View>
      <View style={hStyles.info}>
        <Text style={hStyles.name} numberOfLines={1}>{item.name}</Text>
        <View style={hStyles.meta}>
          {avgRating && <Text style={hStyles.rating}>⭐ {avgRating}</Text>}
          {distanceText && <Text style={hStyles.distance}>· {distanceText}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Vertical attraction card ───────────────────────────────
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
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {item.images?.[0] ? (
        <Image source={{ uri: item.images[0] }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={{ fontSize: 40 }}>🏙️</Text>
        </View>
      )}
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryBadgeText}>{item.category ?? 'Place'}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardAddress} numberOfLines={1}>
          📍 {item.address ?? 'Address not listed'}
        </Text>
        <View style={styles.cardMeta}>
          {avgRating && (
            <View style={styles.metaItem}>
              <Text style={styles.metaStar}>⭐</Text>
              <Text style={styles.metaText}>{avgRating}</Text>
              <Text style={styles.metaCount}>({item.reviewCount})</Text>
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
                {item.priceLevel === 0 ? 'Free' : '$'.repeat(item.priceLevel)}
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
  container:          { flex: 1, backgroundColor: '#f9fafb' },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  greeting:           { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  subGreeting:        { fontSize: 13, color: '#888', marginTop: 2 },
  notifBtn:           { padding: 8 },
  notifIcon:          { fontSize: 22 },
  searchBar:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 14 },
  searchIcon:         { fontSize: 16, marginRight: 8 },
  searchPlaceholder:  { color: '#aaa', fontSize: 14 },

  seasonBanner:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E1F5EE', marginHorizontal: 20, borderRadius: 12, padding: 12, marginBottom: 16, gap: 10 },
  seasonEmoji:        { fontSize: 28 },
  seasonLabel:        { fontSize: 13, fontWeight: '700', color: '#085041' },
  seasonSuggestion:   { fontSize: 12, color: '#0F6E56', marginTop: 2 },

  section:            { marginBottom: 8 },
  sectionRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12, marginTop: 4 },
  sectionTitle:       { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  seeAll:             { fontSize: 13, color: '#1D9E75', fontWeight: '600' },
  mapLink:            { fontSize: 13, color: '#1D9E75', fontWeight: '600' },

  horizontalList:     { paddingHorizontal: 20, gap: 12, paddingBottom: 8 },

  interestPrompt:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e0e0e0', gap: 12 },
  interestPromptEmoji: { fontSize: 32 },
  interestPromptText: { flex: 1 },
  interestPromptTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  interestPromptSub:  { fontSize: 12, color: '#1D9E75', marginTop: 2 },

  chips:              { paddingHorizontal: 20, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip:               { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', alignSelf: 'flex-start' },
  chipActive:         { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  chipText:           { fontSize: 13, color: '#555' },
  chipTextActive:     { color: '#fff', fontWeight: '600' },

  centered:           { paddingVertical: 40, alignItems: 'center', gap: 12 },
  loadingText:        { color: '#888', fontSize: 14 },

  emptyWrap:          { alignItems: 'center', paddingTop: 40, gap: 8, paddingHorizontal: 40 },
  emptyEmoji:         { fontSize: 48 },
  emptyTitle:         { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  emptySubtitle:      { fontSize: 13, color: '#aaa', textAlign: 'center' },
  seedBtn:            { backgroundColor: '#1D9E75', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  seedBtnText:        { color: '#fff', fontWeight: '600', fontSize: 14 },

  card:               { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 20, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#f0f0f0' },
  cardImage:          { width: '100%', height: 180 },
  cardImagePlaceholder: { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  categoryBadge:      { position: 'absolute', top: 12, left: 12, backgroundColor: '#1D9E75', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  categoryBadgeText:  { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardInfo:           { padding: 14 },
  cardName:           { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  cardAddress:        { fontSize: 13, color: '#888', marginBottom: 10 },
  cardMeta:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaItem:           { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaRight:          { marginLeft: 'auto' },
  metaStar:           { fontSize: 12 },
  metaText:           { fontSize: 13, color: '#444', fontWeight: '500' },
  metaCount:          { fontSize: 12, color: '#aaa' },
  metaPrice:          { fontSize: 13, color: '#1D9E75', fontWeight: '700' },

  headerIcons:            { flexDirection: 'row', alignItems: 'center', gap: 4 },
  createBtn:              { backgroundColor: '#1D9E75', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  createBtnText:          { color: '#fff', fontWeight: '700', fontSize: 13 },
  iconBtn:                { padding: 8 },

  modalOverlay:           { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 100 },
  modalSheet:             { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 40, maxHeight: '80%' },
  modalHeader:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  modalTitle:             { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  modalClose:             { fontSize: 18, color: '#aaa', padding: 4 },
  modalEmpty:             { alignItems: 'center', paddingVertical: 40, gap: 8 },

  bookmarkItem:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 12 },
  bookmarkImage:          { width: 64, height: 64, borderRadius: 10 },
  bookmarkImagePlaceholder: { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  bookmarkInfo:           { flex: 1 },
  bookmarkName:           { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
  bookmarkAddress:        { fontSize: 12, color: '#888', marginBottom: 6 },
  bookmarkBadge:          { alignSelf: 'flex-start', backgroundColor: '#E1F5EE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  bookmarkBadgeEvent:     { backgroundColor: '#FFF3E0' },
  bookmarkBadgeText:      { fontSize: 11, color: '#0F6E56', fontWeight: '600' },

  loadingMore:     { paddingVertical: 16, alignItems: 'center' },
  loadMoreBtn:     { marginHorizontal: 20, marginBottom: 16, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  loadMoreBtnText: { fontSize: 14, color: '#1D9E75', fontWeight: '600' },
});

const hStyles = StyleSheet.create({
  card:             { width: 180, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#f0f0f0' },
  image:            { width: '100%', height: 120 },
  imagePlaceholder: { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  badge:            { position: 'absolute', top: 8, left: 8, backgroundColor: '#1D9E75', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:        { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  info:             { padding: 10 },
  name:             { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  meta:             { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating:           { fontSize: 12, color: '#444' },
  distance:         { fontSize: 12, color: '#aaa' },
});