import React, { useEffect, useState } from 'react';
import {
  Alert, FlatList, StyleSheet, Text,
  TouchableOpacity, View, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAttractions, deleteAttraction } from '../../services/attractionService';
import { getAllUsers } from '../../services/userService';
import { getFlaggedReviews, deleteReview, approveFlaggedReview } from '../../services/reviewService';
import { getEvents, setEventApproval } from '../../services/eventService';

const TABS = ['Events', 'Reviews', 'Attractions', 'Users'];

const AdminDashboard = ({ navigation }) => {
  const [activeTab,   setActiveTab]   = useState('Events');
  const [attractions, setAttractions] = useState([]);
  const [users,       setUsers]       = useState([]);
  const [reviews,     setReviews]     = useState([]);
  const [events,      setEvents]      = useState([]);
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
        const { items } = await getEvents({});
        setEvents(items);
      }
    } catch (e) {
      console.error('AdminDashboard fetchData error:', e);
    } finally {
      setLoading(false);
    }
  };

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
    try {
      await deleteReview(review.id, review.targetId, review.targetType, review.rating);
      setReviews(prev => prev.filter(r => r.id !== review.id));
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  // ── Approve flagged review (remove flag) ──────────────────
  async function handleApproveReview(reviewId) {
    try {
      await approveFlaggedReview(reviewId);
      setReviews(prev => prev.filter(r => r.id !== reviewId));
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
          onPress={() => handleApproveReview(item.id)}
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
        <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowSub}>{item.category}</Text>
      </View>
      <TouchableOpacity
        onPress={() => handleDeleteAttraction(item.id)}
        style={styles.rejectBtn}
      >
        <Text style={styles.rejectBtnText}>🗑</Text>
      </TouchableOpacity>
    </View>
  );

  const renderUser = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{item.name ?? item.displayName ?? 'No name'}</Text>
        <Text style={styles.rowSub}>{item.email} · {item.role ?? 'user'}</Text>
      </View>
    </View>
  );

  const getData = () => {
    if (activeTab === 'Events')      return events;
    if (activeTab === 'Reviews')     return reviews;
    if (activeTab === 'Attractions') return attractions;
    if (activeTab === 'Users')       return users;
    return [];
  };

  const getRenderer = () => {
    if (activeTab === 'Events')      return renderEvent;
    if (activeTab === 'Reviews')     return renderReview;
    if (activeTab === 'Attractions') return renderAttraction;
    if (activeTab === 'Users')       return renderUser;
  };

  const getEmptyMsg = () => {
    if (activeTab === 'Reviews') return 'No flagged reviews 🎉';
    if (activeTab === 'Events')  return 'No events found.';
    return 'No data found.';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <Text style={styles.title}>Admin Dashboard</Text>

      {/* ── Tabs ── */}
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

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1D9E75" />
        </View>
      ) : (
        <FlatList
          data={getData()}
          keyExtractor={item => item.id}
          renderItem={getRenderer()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{getEmptyMsg()}</Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f9fafb' },
  title:          { fontSize: 22, fontWeight: '700', color: '#1a1a1a', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  centered:       { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabs:           { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab:            { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' },
  tabActive:      { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  tabText:        { fontSize: 13, color: '#555', fontWeight: '500' },
  tabTextActive:  { color: '#fff', fontWeight: '700' },

  list:           { padding: 16 },
  empty:          { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 14 },

  row:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', gap: 10 },
  rowContent:     { flex: 1 },
  rowTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  rowTitle:       { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  rowSub:         { fontSize: 12, color: '#888', marginTop: 2 },

  statusBadge:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusApproved: { backgroundColor: '#E1F5EE' },
  statusPending:  { backgroundColor: '#FFF3E0' },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#0F6E56' },

  actionBtns:     { flexDirection: 'row', gap: 8 },
  approveBtn:     { backgroundColor: '#E1F5EE', borderRadius: 8, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  approveBtnText: { fontSize: 16, color: '#0F6E56', fontWeight: '700' },
  rejectBtn:      { backgroundColor: '#FCEBEB', borderRadius: 8, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  rejectBtnText:  { fontSize: 16, color: '#E24B4A' },
});

export default AdminDashboard;
