import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
  ScrollView, Image, Platform, Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getEvents, computeStatus, seedSampleEvents } from '../../services/eventService';

const CATEGORIES = [
  { id: null,        label: '🌐 All'       },
  { id: 'food',      label: '🍜 Food'      },
  { id: 'culture',   label: '🏛️ Culture'   },
  { id: 'shopping',  label: '🛍️ Shopping'  },
  { id: 'adventure', label: '⛺ Adventure' },
];

const STATUS_FILTERS = [
  { id: null,        label: 'All'       },
  { id: 'incoming',  label: 'Upcoming'  },
  { id: 'ongoing',   label: 'Ongoing'   },
  { id: 'completed', label: 'Past'      },
];

export default function EventsScreen({ navigation }) {
  const { user } = useAuth();

  const [events,          setEvents]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [seeding,         setSeeding]         = useState(false);
  const [activeCategory,  setActiveCategory]  = useState(null);
  const [activeStatus,    setActiveStatus]    = useState(null);
  const [showFreeOnly,    setShowFreeOnly]    = useState(false);
  const [searchQuery,     setSearchQuery]     = useState('');

  const fetchEvents = useCallback(async () => {
    try {
      const { items } = await getEvents({});
      setEvents(items);
    } catch (e) {
      console.error('fetchEvents error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, []);

  function handleRefresh() {
    setRefreshing(true);
    fetchEvents();
  }

  async function handleSeed() {
    setSeeding(true);
    await seedSampleEvents();
    await fetchEvents();
    setSeeding(false);
  }

  // ── Client-side filtering ────────────────────────────────
  const filtered = events.filter(event => {
    const status = computeStatus(event);
    if (activeStatus   && status !== activeStatus)          return false;
    if (activeCategory && event.category !== activeCategory) return false;
    if (showFreeOnly   && event.price !== 0)                return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        event.title?.toLowerCase().includes(q) ||
        event.category?.toLowerCase().includes(q) ||
        event.address?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Events</Text>
      </View>

      {/* ── Status filter tabs ── */}
      <View style={{ height: 54 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusTabs}
        >
          {STATUS_FILTERS.map(s => (
            <TouchableOpacity
              key={String(s.id)}
              style={[styles.statusTab, activeStatus === s.id && styles.statusTabActive]}
              onPress={() => setActiveStatus(s.id)}
            >
              <Text style={[
                styles.statusTabText,
                activeStatus === s.id && styles.statusTabTextActive,
              ]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Category + free filter ── */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={{ flex: 1 }}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={String(cat.id)}
              style={[styles.chip, activeCategory === cat.id && styles.chipActive]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <Text style={[
                styles.chipText,
                activeCategory === cat.id && styles.chipTextActive,
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Free toggle */}
        <TouchableOpacity
          style={[styles.freeBtn, showFreeOnly && styles.freeBtnActive]}
          onPress={() => setShowFreeOnly(!showFreeOnly)}
        >
          <Text style={[styles.freeBtnText, showFreeOnly && styles.freeBtnTextActive]}>
            Free
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Events list ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1D9E75" />
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
            <EventCard
              item={item}
              onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🗓️</Text>
              <Text style={styles.emptyTitle}>No events found</Text>
              <Text style={styles.emptySub}>
                Try changing filters or add sample events
              </Text>
              <TouchableOpacity
                style={styles.seedBtn}
                onPress={handleSeed}
                disabled={seeding}
              >
                {seeding
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.seedBtnText}>+ Add sample events</Text>
                }
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Event card ─────────────────────────────────────────────
function EventCard({ item, onPress }) {
  const status = computeStatus(item);

  const startDate = item.startDate?.toDate?.() ?? new Date(item.startDate?.seconds * 1000);
  const dateStr   = startDate.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const timeStr = startDate.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  const statusColors = {
    incoming:  { bg: '#E1F5EE', text: '#0F6E56', label: 'Upcoming'  },
    ongoing:   { bg: '#FAEEDA', text: '#633806', label: 'Ongoing'   },
    completed: { bg: '#f0f0f0', text: '#888',    label: 'Past'      },
  };
  const statusStyle = statusColors[status] ?? statusColors.incoming;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Image */}
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={{ fontSize: 40 }}>🗓️</Text>
        </View>
      )}

      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
        <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
          {statusStyle.label}
        </Text>
      </View>

      {/* Price badge */}
      <View style={styles.priceBadge}>
        <Text style={styles.priceBadgeText}>
          {item.price === 0 ? 'Free' : `₫${item.price?.toLocaleString()}`}
        </Text>
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardAddress} numberOfLines={1}>
          📍 {item.address}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardDate}>📅 {dateStr}</Text>
          <Text style={styles.cardTime}>🕐 {timeStr}</Text>
          <View style={styles.attendeesBadge}>
            <Text style={styles.attendeesText}>
              👥 {item.attendees?.length ?? 0}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#f9fafb' },

  header:             { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  headerTitle:        { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },

  statusTabs:         { paddingHorizontal: 20, gap: 8, paddingVertical: 10, alignItems: 'center' },
  statusTab:          { paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', height: 34, justifyContent: 'center', alignItems: 'center' },
  statusTabActive:    { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  statusTabText:      { fontSize: 13, color: '#555', fontWeight: '500' },
  statusTabTextActive: { color: '#fff', fontWeight: '700' },

  filterRow:          { flexDirection: 'row', alignItems: 'center', paddingRight: 16, marginBottom: 8, marginTop: 0 },
  chips:              { paddingHorizontal: 16, gap: 8 },
  chip:               { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', alignSelf: 'flex-start' },
  chipActive:         { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  chipText:           { fontSize: 12, color: '#555' },
  chipTextActive:     { color: '#fff', fontWeight: '600' },

  freeBtn:            { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', marginLeft: 8 },
  freeBtnActive:      { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  freeBtnText:        { fontSize: 12, color: '#555', fontWeight: '500' },
  freeBtnTextActive:  { color: '#fff', fontWeight: '600' },

  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:               { paddingHorizontal: 20, paddingBottom: 32 },

  emptyWrap:          { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji:         { fontSize: 48 },
  emptyTitle:         { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  emptySub:           { fontSize: 13, color: '#aaa', textAlign: 'center', paddingHorizontal: 40 },
  seedBtn:            { backgroundColor: '#1D9E75', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  seedBtnText:        { color: '#fff', fontWeight: '600', fontSize: 14 },

  card:               { backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#f0f0f0' },
  cardImage:          { width: '100%', height: 160 },
  cardImagePlaceholder: { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  statusBadge:        { position: 'absolute', top: 12, left: 12, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText:    { fontSize: 11, fontWeight: '700' },
  priceBadge:         { position: 'absolute', top: 12, right: 12, backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  priceBadgeText:     { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardInfo:           { padding: 14 },
  cardTitle:          { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  cardAddress:        { fontSize: 13, color: '#888', marginBottom: 8 },
  cardMeta:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardDate:           { fontSize: 12, color: '#555', fontWeight: '500' },
  cardTime:           { fontSize: 12, color: '#555' },
  attendeesBadge:     { marginLeft: 'auto', backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  attendeesText:      { fontSize: 12, color: '#555', fontWeight: '500' },
});
