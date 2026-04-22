import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Platform, Linking, Share,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getEvent, computeStatus, joinEvent, leaveEvent, deleteEvent } from '../../services/eventService';
import { addBookmark, removeBookmark, getBookmarks } from '../../services/userService';
import { notifyJoinedEvent, notifyOrganizerJoin, scheduleEventReminder } from '../../services/notificationService';
import { getTravelPlans, addStopToPlan } from '../../services/travelService';
import { postActivity } from '../../services/socialService';

export default function EventDetailScreen({ route, navigation }) {
  const { eventId } = route.params;
  const { user, userProfile, isAdmin } = useAuth();

  const [event,      setEvent]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [joining,    setJoining]    = useState(false);
  const [now,        setNow]        = useState(Date.now());
  const [showItineraryPicker, setShowItineraryPicker] = useState(false);
  const [travelPlans,         setTravelPlans]         = useState([]);
  const [selectedPlan,        setSelectedPlan]        = useState(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getEvent(eventId);
        setEvent(data);
        if (user) {
          const bookmarks = await getBookmarks(user.uid);
          setBookmarked(bookmarks.some(b => b.itemId === eventId));
        }
      } catch (e) {
        console.error('EventDetail load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  // ── Join / Leave ──────────────────────────────────────────
  async function handleJoinLeave() {
    if (!user) return Alert.alert('Sign in required', 'Please log in to join events.');
    setJoining(true);
    try {
      const isJoined = event.attendees?.includes(user.uid);
      if (isJoined) {
        await leaveEvent(eventId, user.uid);
        setEvent(prev => ({
          ...prev,
          attendees: prev.attendees.filter(id => id !== user.uid),
        }));
      } else {
        await joinEvent(eventId, user.uid);
        await notifyJoinedEvent(user.uid, event.title);
        await postActivity(user.uid, userProfile?.name ?? 'Someone', {
          type:       'joined',
          targetName: event.title,
          targetId:   eventId,
        });
        // Notify the organizer
        if (event.organizerId && event.organizerId !== user.uid) {
          await notifyOrganizerJoin(
            event.organizerId,
            userProfile?.name ?? 'Someone',
            event.title
          );
        }
        // Schedule local reminder 1 hour before
        const startMs = event.startDate?.toMillis?.() ?? event.startDate?.seconds * 1000;
        await scheduleEventReminder(event.title, startMs);
        setEvent(prev => ({
          ...prev,
          attendees: [...(prev.attendees ?? []), user.uid],
        }));
      }
    } catch (e) {
      Alert.alert('Error', 'Could not update attendance.');
    } finally {
      setJoining(false);
    }
  }

  // ── Bookmark ──────────────────────────────────────────────
  async function handleBookmark() {
    if (!user) return;
    try {
      if (bookmarked) {
        await removeBookmark(user.uid, eventId);
      } else {
        await addBookmark(user.uid, eventId, 'event', {
          name:     event.title,
          address:  event.address,
          imageUrl: event.imageUrl,
        });
      }
      setBookmarked(!bookmarked);
    } catch (e) {
      Alert.alert('Error', 'Could not update bookmark.');
    }
  }

  // ── Share ─────────────────────────────────────────────────
  async function handleShare() {
    try {
      await Share.share({
        message: `Check out this event: ${event.title}\n📍 ${event.address}\n\nShared via ExploreEase`,
        title:   event.title,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  }

  // ── Add to itinerary ─────────────────────────────────────
  async function handleAddToItinerary() {
    if (!user) return Alert.alert('Sign in required');
    try {
      const plans = await getTravelPlans(user.uid);
      if (plans.length === 0) {
        Alert.alert('No plans yet', 'Create a travel plan first in the Travel tab.');
        return;
      }
      setTravelPlans(plans);
      setShowItineraryPicker(true);
    } catch (e) {
      console.error('handleAddToItinerary error:', e);
    }
  }

  async function handleSelectPlan(plan) {
    setSelectedPlan(plan);
  }

  async function handleSelectDay(plan, day) {
    setShowItineraryPicker(false);
    setSelectedPlan(null);
    try {
      const stop = {
        id:       event.id,
        name:     event.title,
        type:     'event',
        address:  event.address ?? '',
        location: event.location ?? null,
        note:     null,
      };
      await addStopToPlan(plan.id, day.id, stop);
      Alert.alert('✅ Added!', `${event.title} added to "${plan.title}" - ${day.label}`);
    } catch (e) {
      Alert.alert('Error', 'Could not add to itinerary.');
    }
  }

  // ── Get Directions ────────────────────────────────────────
  function handleDirections() {
    if (event?.location) {
      const { latitude, longitude } = event.location;
      const url = Platform.select({
        ios:     `maps://app?daddr=${latitude},${longitude}`,
        android: `google.navigation:q=${latitude},${longitude}`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
      });
      Linking.openURL(url).catch(() =>
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`)
      );
    } else if (event?.address) {
      const encoded = encodeURIComponent(event.address);
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`).catch(
        () => Alert.alert('Error', 'Could not open maps.')
      );
    } else {
      Alert.alert('No location', 'This event has no location set.');
    }
  }

  // ── Delete event ──────────────────────────────────────────
  async function handleDelete() {
    const confirm = Platform.OS === 'web'
      ? window.confirm('Delete this event? This cannot be undone.')
      : await new Promise(resolve =>
          Alert.alert(
            'Delete event',
            'This cannot be undone.',
            [
              { text: 'Cancel',  onPress: () => resolve(false), style: 'cancel' },
              { text: 'Delete',  onPress: () => resolve(true),  style: 'destructive' },
            ]
          )
        );

    if (!confirm) return;
    try {
      await deleteEvent(eventId, user.uid);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1D9E75" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Event not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status    = computeStatus(event);
  const isJoined  = event.attendees?.includes(user?.uid);
  const isOrganizer = event.organizerId === user?.uid;

  const startDate = event.startDate?.toDate?.() ?? new Date(event.startDate?.seconds * 1000);
  const endDate   = event.endDate?.toDate?.()   ?? new Date(event.endDate?.seconds   * 1000);

  const dateStr  = startDate.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr  = `${startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

  // Countdown for upcoming events
  const msLeft     = startDate.getTime() - now;
  const daysLeft   = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const hoursLeft  = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minsLeft   = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
  const secsLeft   = Math.floor((msLeft % (1000 * 60)) / 1000);

  const statusColors = {
    incoming:  { bg: '#E1F5EE', text: '#0F6E56', label: 'Upcoming'  },
    ongoing:   { bg: '#FAEEDA', text: '#633806', label: 'Happening now' },
    completed: { bg: '#f0f0f0', text: '#888',    label: 'Past event' },
  };
  const statusStyle = statusColors[status] ?? statusColors.incoming;

  return (
    <View style={styles.root}>
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* ── Hero image ── */}
      <View style={styles.heroWrap}>
        {event.imageUrl ? (
          <Image source={{ uri: event.imageUrl }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]}>
            <Text style={{ fontSize: 64 }}>🗓️</Text>
          </View>
        )}

        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>

        {/* Bookmark button */}
        <TouchableOpacity style={styles.bookmarkBtn} onPress={handleBookmark}>
          <Text style={styles.bookmarkIcon}>{bookmarked ? '🔖' : '🏷️'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* ── Status + price ── */}
        <View style={styles.badgeRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {statusStyle.label}
            </Text>
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText}>
              {event.price === 0 ? '🎉 Free' : `₫${event.price?.toLocaleString()}`}
            </Text>
          </View>
        </View>

        {/* ── Title ── */}
        <Text style={styles.title}>{event.title}</Text>

        {/* ── Countdown timer ── */}
        {status === 'incoming' && msLeft > 0 && (
          <View style={styles.countdownBox}>
            <Text style={styles.countdownEmoji}>⏳</Text>
            <View>
              <Text style={styles.countdownLabel}>Event starts in</Text>
              <Text style={styles.countdownText}>
                {daysLeft > 0
                  ? `${daysLeft}d  ${hoursLeft}h  ${minsLeft}m  ${secsLeft}s`
                  : hoursLeft > 0
                  ? `${hoursLeft}h  ${minsLeft}m  ${secsLeft}s`
                  : `${minsLeft}m  ${secsLeft}s`}
              </Text>
            </View>
          </View>
        )}

        {/* ── Info grid ── */}
        <View style={styles.infoGrid}>
          <InfoItem icon="📅" label="Date"     value={dateStr} />
          <InfoItem icon="🕐" label="Time"     value={timeStr} />
          <InfoItem icon="📍" label="Location" value={event.address ?? 'TBA'} />
          <InfoItem icon="👥" label="Attendees" value={`${event.attendees?.length ?? 0} going`} />
        </View>

        {/* ── Description ── */}
        {event.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this event</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}

        {/* ── Action buttons ── */}
        <View style={styles.actionRow}>
          {/* Join / Leave button */}
          {status !== 'completed' && (
            <TouchableOpacity
              style={[styles.joinBtn, isJoined && styles.joinBtnLeave]}
              onPress={handleJoinLeave}
              disabled={joining}
            >
              {joining
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={[styles.joinBtnText, { color: isJoined ? '#1D9E75' : '#fff' }]}>
                    {isJoined ? '✓ Joined' : '+ Join event'}
                  </Text>
              }
            </TouchableOpacity>
          )}

          {/* Directions */}
          <TouchableOpacity style={styles.iconBtn} onPress={handleDirections}>
            <Text style={styles.iconBtnText}>🧭</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
            <Text style={styles.iconBtnText}>↑</Text>
          </TouchableOpacity>

          {/* Add to itinerary */}
          <TouchableOpacity style={styles.iconBtn} onPress={handleAddToItinerary}>
            <Text style={styles.iconBtnText}>🗺️</Text>
          </TouchableOpacity>

          {/* Group Chat */}
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('EventChat', { eventId, eventTitle: event.title })}>
            <Text style={styles.iconBtnText}>💬</Text>
          </TouchableOpacity>
        </View>

        {/* ── Organizer actions ── */}
        {(isOrganizer || isAdmin) && (
          <View style={styles.organizerActions}>
            <Text style={styles.organizerLabel}>Organizer actions</Text>
            <View style={styles.organizerRow}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => navigation.navigate('CreateEvent', { eventId, editMode: true })}
              >
                <Text style={styles.editBtnText}>✏️ Edit event</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>

    </ScrollView>

      {/* ── Itinerary picker modal ── */}
      {showItineraryPicker && (
        <View style={styles.itineraryModal}>
          <View style={styles.itinerarySheet}>
            <View style={styles.itineraryModalHeader}>
              <Text style={styles.itineraryModalTitle}>
                {selectedPlan ? `Select Day — ${selectedPlan.title}` : 'Add to Travel Plan'}
              </Text>
              <TouchableOpacity onPress={() => {
                if (selectedPlan) setSelectedPlan(null);
                else setShowItineraryPicker(false);
              }}>
                <Text style={styles.itineraryModalClose}>{selectedPlan ? '←' : '✕'}</Text>
              </TouchableOpacity>
            </View>
            {!selectedPlan ? (
              travelPlans.map(plan => (
                <TouchableOpacity
                  key={plan.id}
                  style={styles.planItem}
                  onPress={() => handleSelectPlan(plan)}
                >
                  <Text style={{ fontSize: 24 }}>🗺️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planItemTitle}>{plan.title}</Text>
                    <Text style={styles.planItemSub}>
                      {plan.days?.length ?? 0} days · {plan.days?.reduce((sum, d) => sum + (d.stops?.length ?? 0), 0)} stops
                    </Text>
                  </View>
                  <Text style={{ fontSize: 20, color: '#ccc' }}>›</Text>
                </TouchableOpacity>
              ))
            ) : (
              selectedPlan.days.map(day => (
                <TouchableOpacity
                  key={day.id}
                  style={styles.planItem}
                  onPress={() => handleSelectDay(selectedPlan, day)}
                >
                  <Text style={{ fontSize: 24 }}>📅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planItemTitle}>{day.label}</Text>
                    <Text style={styles.planItemSub}>
                      {day.stops?.length ?? 0} stop{(day.stops?.length ?? 0) !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 20, color: '#ccc' }}>›</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: '#f9fafb' },
  centered:         { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  notFound:         { fontSize: 16, color: '#888' },
  backLink:         { color: '#1D9E75', fontSize: 15, fontWeight: '600' },

  heroWrap:         { position: 'relative' },
  hero:             { width: '100%', height: 260 },
  heroPlaceholder:  { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  backBtn:          { position: 'absolute', top: 52, left: 20, backgroundColor: '#fff', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
  backBtnText:      { fontSize: 20, color: '#1a1a1a' },
  bookmarkBtn:      { position: 'absolute', top: 52, right: 20, backgroundColor: '#fff', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
  bookmarkIcon:     { fontSize: 20 },

  body:             { padding: 20 },
  badgeRow:         { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statusBadge:      { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  statusBadgeText:  { fontSize: 12, fontWeight: '700' },
  priceBadge:       { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  priceBadgeText:   { color: '#fff', fontSize: 12, fontWeight: '700' },

  title:            { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },

  countdownBox:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E1F5EE', borderRadius: 10, padding: 12, marginBottom: 16, gap: 8 },
  countdownEmoji:   { fontSize: 20 },
  countdownLabel:   { fontSize: 11, color: '#0F6E56', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  countdownText:    { fontSize: 20, color: '#0F6E56', fontWeight: '800', letterSpacing: 1 },

  infoGrid:         { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#f0f0f0', gap: 14 },
  infoItem:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon:         { fontSize: 20, width: 28 },
  infoText:         { flex: 1 },
  infoLabel:        { fontSize: 11, color: '#aaa', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  infoValue:        { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },

  section:          { marginBottom: 20 },
  sectionTitle:     { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  description:      { fontSize: 14, color: '#555', lineHeight: 22 },

  actionRow:        { flexDirection: 'row', gap: 10, marginBottom: 20 },
  joinBtn:          { flex: 1, backgroundColor: '#1D9E75', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  joinBtnLeave:     { backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#1D9E75' },
  joinBtnText:      { fontWeight: '700', fontSize: 15 },
  iconBtn:          { backgroundColor: '#fff', borderRadius: 12, width: 48, height: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  iconBtnText:      { fontSize: 20 },

  organizerActions: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  organizerLabel:   { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 10 },
  organizerRow:     { flexDirection: 'row', gap: 10 },
  editBtn:          { flex: 1, backgroundColor: '#E1F5EE', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  editBtnText:      { color: '#0F6E56', fontWeight: '600', fontSize: 14 },
  deleteBtn:        { flex: 1, backgroundColor: '#FCEBEB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  deleteBtnText:    { color: '#E24B4A', fontWeight: '600', fontSize: 14 },

  itineraryModal:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 100 },
  itinerarySheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 40 },
  itineraryModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  itineraryModalTitle:  { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  itineraryModalClose:  { fontSize: 18, color: '#aaa', padding: 4 },
  planItem:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 12 },
  planItemTitle:        { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  planItemSub:          { fontSize: 12, color: '#aaa', marginTop: 2 },
});