import React, { useEffect, useState } from 'react';
import {
  Alert, FlatList, StyleSheet, Text,
  TouchableOpacity, View, ActivityIndicator,
  ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection, getDocs, query,
  updateDoc, doc, orderBy,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAttractions, deleteAttraction } from '../../services/attractionService';
import { getAllUsers } from '../../services/userService';
import { getFlaggedReviews, deleteReview } from '../../services/reviewService';
import { setEventApproval } from '../../services/eventService';

const TABS = ['Events', 'Requests', 'Reviews', 'Attractions', 'Users', 'Analytics'];

const AdminDashboard = ({ navigation }) => {
  const [activeTab,   setActiveTab]   = useState('Events');
  const [attractions, setAttractions] = useState([]);
  const [users,       setUsers]       = useState([]);
  const [reviews,     setReviews]     = useState([]);
  const [events,      setEvents]      = useState([]);
  const [requests,    setRequests]    = useState([]);
  const [analytics,   setAnalytics]   = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'Attractions') {
        const { items } = await getAttractions(null, 50);
        setAttractions(items);
      } else if (activeTab === 'Users') {
        const data = await getAllUsers();
        setUsers(data);
      } else if (activeTab === 'Reviews') {
        const data = await getFlaggedReviews();
        setReviews(data);
      } else if (activeTab === 'Events') {
        const snap = await getDocs(query(collection(db, 'events'), orderBy('createdAt', 'desc')));
        setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else if (activeTab === 'Requests') {
        const q    = query(collection(db, 'organizerRequests'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else if (activeTab === 'Analytics') {
        await fetchAnalytics();
      }
    } catch (e) {
      console.error('AdminDashboard fetchData error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Analytics ─────────────────────────────────────────────
  async function fetchAnalytics() {
    try {
      const [usersSnap, eventsSnap, attractionsSnap, reviewsSnap, activitySnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'attractions')),
        getDocs(collection(db, 'reviews')),
        getDocs(collection(db, 'userActivity')),
      ]);

      const allEvents      = eventsSnap.docs.map(d => d.data());
      const allReviews     = reviewsSnap.docs.map(d => d.data());
      const allActivity    = activitySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allUsers       = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allAttractions = attractionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // ── Top places by total views ──
      const viewsByAttraction = {};
      allActivity.forEach(a => {
        if (a.attractionId) {
          viewsByAttraction[a.attractionId] = (viewsByAttraction[a.attractionId] ?? 0) + (a.view ?? 0);
        }
      });
      const topPlaces = allAttractions
        .map(a => ({ ...a, totalViews: viewsByAttraction[a.id] ?? 0 }))
        .sort((a, b) => b.totalViews - a.totalViews)
        .slice(0, 5);

      // ── Most active users ──
      const viewsByUser = {};
      allActivity.forEach(a => {
        if (a.userId) {
          viewsByUser[a.userId] = (viewsByUser[a.userId] ?? 0) + (a.view ?? 0) + (a.bookmark ?? 0);
        }
      });
      const mostActiveUsers = allUsers
        .map(u => ({ ...u, activityScore: viewsByUser[u.id] ?? 0 }))
        .filter(u => u.activityScore > 0)
        .sort((a, b) => b.activityScore - a.activityScore)
        .slice(0, 5);

      // ── Traffic stats ──
      const totalViews      = allActivity.reduce((sum, a) => sum + (a.view       ?? 0), 0);
      const totalBookmarks  = allActivity.reduce((sum, a) => sum + (a.bookmark   ?? 0), 0);
      const totalDirections = allActivity.reduce((sum, a) => sum + (a.directions ?? 0), 0);

      setAnalytics({
        totalUsers:        usersSnap.size,
        totalEvents:       eventsSnap.size,
        pendingEvents:     allEvents.filter(e => !e.approved).length,
        totalAttractions:  attractionsSnap.size,
        totalReviews:      reviewsSnap.size,
        flaggedReviews:    allReviews.filter(r => r.flagged).length,
        totalViews,
        totalBookmarks,
        totalDirections,
        topPlaces,
        mostActiveUsers,
      });
    } catch (e) {
      console.error('Analytics error:', e);
    }
  }

  // ── Event approval ────────────────────────────────────────
  async function handleApproveEvent(eventId, approve) {
    try {
      await setEventApproval(eventId, approve);
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, approved: approve } : e
      ));
      const msg = approve ? 'Event approved!' : 'Event rejected.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Done', msg);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  // ── Organizer request approval ────────────────────────────
  async function handleApproveRequest(request, approve) {
    try {
      await updateDoc(doc(db, 'organizerRequests', request.id), {
        status: approve ? 'approved' : 'rejected',
      });
      if (approve) {
        await updateDoc(doc(db, 'users', request.userId), {
          role: 'organizer',
        });
      }
      setRequests(prev => prev.map(r =>
        r.id === request.id
          ? { ...r, status: approve ? 'approved' : 'rejected' }
          : r
      ));
      const msg = approve
        ? `${request.userName} is now an organizer!`
        : 'Request rejected.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Done', msg);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  // ── Approve attraction ────────────────────────────────────
  async function handleApproveAttraction(id) {
    try {
      await updateDoc(doc(db, 'attractions', id), { approved: true });
      setAttractions(prev => prev.map(a =>
        a.id === id ? { ...a, approved: true } : a
      ));
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  // ── Delete attraction ─────────────────────────────────────
  function handleDeleteAttraction(id) {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this attraction?')) {
        deleteAttraction(id).then(() =>
          setAttractions(prev => prev.filter(a => a.id !== id))
        );
      }
    } else {
      Alert.alert('Delete', 'Delete this attraction?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await deleteAttraction(id);
            setAttractions(prev => prev.filter(a => a.id !== id));
          },
        },
      ]);
    }
  }

  // ── Delete flagged review ─────────────────────────────────
  async function handleDeleteReview(review) {
    const confirm = Platform.OS === 'web'
      ? window.confirm('Delete this flag request?')
      : await new Promise(resolve =>
          Alert.alert('Delete flag request', 'Remove the flag on this review?', [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Delete', onPress: () => resolve(true), style: 'destructive' },
          ])
        );
    if (!confirm) return;
    try {
      console.log('Deleting review:', review.id, review.targetId, review.targetType, review.rating);
      await deleteReview(review.id, review.targetId, review.targetType, review.rating);
      setReviews(prev => prev.filter(r => r.id !== review.id));
      if (Platform.OS === 'web') window.alert('Deleted!');
    } catch (e) {
      console.error('Delete error:', e);
      Alert.alert('Error', e.message);
    }
  }

  // ── Approve flagged review (delete the review) ────────────
  async function handleApproveReview(review) {
    const confirm = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to delete this review?')
      : await new Promise(resolve =>
          Alert.alert('Delete review', 'Are you sure you want to delete this review?', [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Delete', onPress: () => resolve(true), style: 'destructive' },
          ])
        );
    if (!confirm) return;
    try {
      await deleteReview(review.id, review.targetId, review.targetType, review.rating);
      setReviews(prev => prev.filter(r => r.id !== review.id));
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  // ── Renders ───────────────────────────────────────────────
  const renderEvent = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[
            styles.statusBadge,
            item.approved ? styles.statusApproved : styles.statusPending,
          ]}>
            <Text style={styles.statusBadgeText}>
              {item.approved ? 'Approved' : 'Pending'}
            </Text>
          </View>
        </View>
        <Text style={styles.rowSub}>{item.category} · {item.address}</Text>
      </View>
      {!item.approved && (
        <View style={styles.actionBtns}>
          <TouchableOpacity
            style={styles.approveBtn}
            onPress={() => handleApproveEvent(item.id, true)}
          >
            <Text style={styles.approveBtnText}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => handleApproveEvent(item.id, false)}
          >
            <Text style={styles.rejectBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderRequest = ({ item }) => {
    const isPending = item.status === 'pending';
    return (
      <View style={styles.row}>
        <View style={styles.rowContent}>
          <View style={styles.rowTitleRow}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.orgName}
            </Text>
            <View style={[
              styles.statusBadge,
              item.status === 'approved' ? styles.statusApproved :
              item.status === 'rejected' ? styles.statusRejected :
              styles.statusPending,
            ]}>
              <Text style={styles.statusBadgeText}>
                {item.status === 'approved' ? 'Approved' :
                 item.status === 'rejected' ? 'Rejected' : 'Pending'}
              </Text>
            </View>
          </View>
          <Text style={styles.rowSub}>
            {item.userName} · {item.userEmail}
          </Text>
          <Text style={styles.rowSub}>{item.orgType} · {item.description?.slice(0, 60)}...</Text>
        </View>
        {isPending && (
          <View style={styles.actionBtns}>
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => handleApproveRequest(item, true)}
            >
              <Text style={styles.approveBtnText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => handleApproveRequest(item, false)}
            >
              <Text style={styles.rejectBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderReview = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.userName} — {'★'.repeat(item.rating)}
        </Text>
        <Text style={styles.rowSub} numberOfLines={2}>{item.text}</Text>
      </View>
      <View style={styles.actionBtns}>
        <TouchableOpacity
          style={styles.approveBtn}
          onPress={() => handleApproveReview(item)}
        >
          <Text style={styles.approveBtnText}>✓</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectBtn}
          onPress={() => handleDeleteReview(item)}
        >
          <Text style={styles.rejectBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAttraction = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
          <View style={[
            styles.statusBadge,
            item.approved ? styles.statusApproved : styles.statusPending,
          ]}>
            <Text style={styles.statusBadgeText}>
              {item.approved ? 'Approved' : 'Pending'}
            </Text>
          </View>
        </View>
        <Text style={styles.rowSub}>{item.category}</Text>
      </View>
      <View style={styles.actionBtns}>
        {!item.approved && (
          <>
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => handleApproveAttraction(item.id)}
            >
              <Text style={styles.approveBtnText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteAttraction(item.id)}
              style={styles.rejectBtn}
            >
              <Text style={styles.rejectBtnText}>🗑</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const renderUser = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{item.name ?? item.displayName ?? 'No name'}</Text>
        <Text style={styles.rowSub}>
          {item.email} · {item.role ?? 'user'}
          {item.isAdmin ? ' · Admin' : ''}
        </Text>
      </View>
    </View>
  );

  const renderAnalytics = () => {
    if (!analytics) return null;
    return (
      <>
        {/* ── Overview stats ── */}
        <Text style={styles.analyticsSection}>📊 Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard emoji="👥" label="Total Users"      value={analytics.totalUsers} />
          <StatCard emoji="📅" label="Total Events"     value={analytics.totalEvents} />
          <StatCard emoji="⏳" label="Pending Events"   value={analytics.pendingEvents}   color="#F18F01" />
          <StatCard emoji="🏙️" label="Attractions"      value={analytics.totalAttractions} />
          <StatCard emoji="⭐" label="Total Reviews"    value={analytics.totalReviews} />
          <StatCard emoji="🚩" label="Flagged Reviews"  value={analytics.flaggedReviews}  color="#E24B4A" />
        </View>

        {/* ── Traffic stats ── */}
        <Text style={styles.analyticsSection}>📈 Traffic Stats</Text>
        <View style={styles.statsGrid}>
          <StatCard emoji="👁️" label="Total Views"      value={analytics.totalViews} />
          <StatCard emoji="🔖" label="Total Bookmarks"  value={analytics.totalBookmarks} />
          <StatCard emoji="🧭" label="Directions Used"  value={analytics.totalDirections} />
        </View>

        {/* ── Top places by views ── */}
        <Text style={styles.analyticsSection}>🏆 Top Places by Views</Text>
        {analytics.topPlaces.length === 0 ? (
          <Text style={styles.empty}>No activity data yet</Text>
        ) : (
          analytics.topPlaces.map((place, index) => (
            <View key={place.id} style={styles.topPlaceRow}>
              <Text style={styles.topPlaceRank}>#{index + 1}</Text>
              <View style={styles.topPlaceInfo}>
                <Text style={styles.topPlaceName} numberOfLines={1}>{place.name}</Text>
                <Text style={styles.topPlaceSub}>
                  {place.category} · 👁️ {place.totalViews} views
                </Text>
              </View>
            </View>
          ))
        )}

        {/* ── Most active users ── */}
        <Text style={styles.analyticsSection}>🔥 Most Active Users</Text>
        {analytics.mostActiveUsers.length === 0 ? (
          <Text style={styles.empty}>No activity data yet</Text>
        ) : (
          analytics.mostActiveUsers.map((u, index) => (
            <View key={u.id} style={styles.topPlaceRow}>
              <Text style={styles.topPlaceRank}>#{index + 1}</Text>
              <View style={styles.topPlaceInfo}>
                <Text style={styles.topPlaceName} numberOfLines={1}>
                  {u.name ?? u.email ?? 'Unknown'}
                </Text>
                <Text style={styles.topPlaceSub}>
                  {u.email} · 🏃 {u.activityScore} actions
                </Text>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </>
    );
  };

  const getData = () => {
    if (activeTab === 'Events')      return events;
    if (activeTab === 'Reviews')     return reviews;
    if (activeTab === 'Attractions') return attractions;
    if (activeTab === 'Users')       return users;
    if (activeTab === 'Requests')    return requests;
    return [];
  };

  const getRenderer = () => {
    if (activeTab === 'Events')      return renderEvent;
    if (activeTab === 'Reviews')     return renderReview;
    if (activeTab === 'Attractions') return renderAttraction;
    if (activeTab === 'Users')       return renderUser;
    if (activeTab === 'Requests')    return renderRequest;
  };

  const getEmptyMsg = () => {
    if (activeTab === 'Reviews')  return 'No flagged reviews 🎉';
    if (activeTab === 'Events')   return 'No events found.';
    if (activeTab === 'Requests') return 'No organizer requests.';
    return 'No data found.';
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#f9fafb' }}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      {/* ── Content ── */}
      {loading ? (
        <ActivityIndicator size="large" color="#1D9E75" style={{ marginTop: 20 }} />
      ) : activeTab === 'Analytics' ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
          {renderAnalytics()}
        </ScrollView>
      ) : (
        <FlatList
          data={getData()}
          keyExtractor={item => item.id}
          renderItem={getRenderer()}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{getEmptyMsg()}</Text>
          }
        />
      )}
    </View>
  );
};

function StatCard({ emoji, label, value, color = '#1D9E75' }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f9fafb' },
  title:            { fontSize: 22, fontWeight: '700', color: '#1a1a1a', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  centered:         { marginTop: 20, alignItems: 'center' },

  tabs:             { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'flex-start' },
  tab:              { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', alignSelf: 'flex-start', height: 36, justifyContent: 'center' },
  tabActive:        { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  tabText:          { fontSize: 13, color: '#555', fontWeight: '500' },
  tabTextActive:    { color: '#fff', fontWeight: '700' },

  list:             { padding: 16, paddingTop: 4, paddingBottom: 32 },
  empty:            { textAlign: 'center', color: '#aaa', marginTop: 20, fontSize: 14 },

  row:              { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', gap: 10 },
  rowContent:       { flex: 1 },
  rowTitleRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  rowTitle:         { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  rowSub:           { fontSize: 12, color: '#888', marginTop: 2 },

  statusBadge:      { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusApproved:   { backgroundColor: '#E1F5EE' },
  statusPending:    { backgroundColor: '#FFF3E0' },
  statusRejected:   { backgroundColor: '#FCEBEB' },
  statusBadgeText:  { fontSize: 11, fontWeight: '700', color: '#0F6E56' },

  actionBtns:       { flexDirection: 'row', gap: 8 },
  approveBtn:       { backgroundColor: '#E1F5EE', borderRadius: 8, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  approveBtnText:   { fontSize: 16, color: '#0F6E56', fontWeight: '700' },
  rejectBtn:        { backgroundColor: '#FCEBEB', borderRadius: 8, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  rejectBtnText:    { fontSize: 16, color: '#E24B4A' },

  analyticsSection: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12, marginTop: 8 },
  statsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard:         { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', width: '47%' },
  statEmoji:        { fontSize: 24, marginBottom: 6 },
  statValue:        { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statLabel:        { fontSize: 12, color: '#888', textAlign: 'center' },

  topPlaceRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#f0f0f0', gap: 12 },
  topPlaceRank:     { fontSize: 18, fontWeight: '800', color: '#1D9E75', width: 32 },
  topPlaceInfo:     { flex: 1 },
  topPlaceName:     { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  topPlaceSub:      { fontSize: 12, color: '#888', marginTop: 2 },
});

export default AdminDashboard;
