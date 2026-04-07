import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Platform, Linking, Share,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getEvent, computeStatus, joinEvent, leaveEvent, deleteEvent } from '../../services/eventService';
import { addBookmark, removeBookmark, getBookmarks } from '../../services/userService';

export default function EventDetailScreen({ route, navigation }) {
  const { eventId } = route.params;
  const { user, userProfile, isAdmin } = useAuth();

  const [event,      setEvent]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [joining,    setJoining]    = useState(false);

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
        await addBookmark(user.uid, eventId, 'event');
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

  // ── Get Directions ────────────────────────────────────────
  function handleDirections() {
    if (!event?.location) return;
    const { latitude, longitude } = event.location;
    const url = Platform.select({
      ios:     `maps://app?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });
    Linking.openURL(url);
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
  const msLeft     = startDate.getTime() - Date.now();
  const daysLeft   = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  const hoursLeft  = Math.ceil(msLeft / (1000 * 60 * 60));

  const statusColors = {
    incoming:  { bg: '#E1F5EE', text: '#0F6E56', label: 'Upcoming'  },
    ongoing:   { bg: '#FAEEDA', text: '#633806', label: 'Happening now' },
    completed: { bg: '#f0f0f0', text: '#888',    label: 'Past event' },
  };
  const statusStyle = statusColors[status] ?? statusColors.incoming;

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.countdownText}>
              {daysLeft > 1
                ? `Starts in ${daysLeft} days`
                : hoursLeft > 1
                ? `Starts in ${hoursLeft} hours`
                : 'Starting soon!'}
            </Text>
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
                : <Text style={styles.joinBtnText}>
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
  countdownText:    { fontSize: 14, color: '#0F6E56', fontWeight: '600' },

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
  joinBtnLeave:     { backgroundColor: '#f0f0f0' },
  joinBtnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  iconBtn:          { backgroundColor: '#fff', borderRadius: 12, width: 48, height: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  iconBtnText:      { fontSize: 20 },

  organizerActions: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  organizerLabel:   { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 10 },
  organizerRow:     { flexDirection: 'row', gap: 10 },
  editBtn:          { flex: 1, backgroundColor: '#E1F5EE', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  editBtnText:      { color: '#0F6E56', fontWeight: '600', fontSize: 14 },
  deleteBtn:        { flex: 1, backgroundColor: '#FCEBEB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  deleteBtnText:    { color: '#E24B4A', fontWeight: '600', fontSize: 14 },
});