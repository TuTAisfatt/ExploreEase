import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getAttractions, deleteAttraction, createAttraction } from '../../services/attractionService';
import { getAllUsers } from '../../services/userService';
import { COLORS, SIZES, SPACING } from '../../utils/constants';

const TABS = ['Attractions', 'Users'];

const AdminDashboard = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('Attractions');
  const [attractions, setAttractions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === 'Attractions') {
      const { items } = await getAttractions(null, 50);
      setAttractions(items);
    } else {
      const data = await getAllUsers();
      setUsers(data);
    }
    setLoading(false);
  };

  const handleDeleteAttraction = (id) => {
    Alert.alert('Delete', 'Delete this attraction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAttraction(id);
          setAttractions((prev) => prev.filter((a) => a.id !== id));
        },
      },
    ]);
  };

  const renderAttraction = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowSub}>{item.category} · ★ {item.rating?.toFixed(1)}</Text>
      </View>
      <TouchableOpacity onPress={() => handleDeleteAttraction(item.id)} style={styles.deleteBtn}>
        <MaterialIcons name="delete" size={20} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );

  const renderUser = ({ item }) => (
    <View style={styles.row}>
      <MaterialIcons name="person" size={20} color={COLORS.primary} style={{ marginRight: SPACING.sm }} />
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{item.displayName}</Text>
        <Text style={styles.rowSub}>{item.email} · {item.role}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={activeTab === 'Attractions' ? attractions : users}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === 'Attractions' ? renderAttraction : renderUser}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No data found.</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  title: { fontSize: SIZES.xxlarge, fontWeight: '700', color: COLORS.text, padding: SPACING.md },
  tabs: { flexDirection: 'row', paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    marginRight: SPACING.sm,
    elevation: 1,
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: SIZES.medium, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white, fontWeight: '700' },
  list: { padding: SPACING.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    elevation: 1,
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: SIZES.medium, fontWeight: '600', color: COLORS.text },
  rowSub: { fontSize: SIZES.small, color: COLORS.textSecondary, marginTop: 2 },
  deleteBtn: { padding: 4 },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xl },
});

export default AdminDashboard;
