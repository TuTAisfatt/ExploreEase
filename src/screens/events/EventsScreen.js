import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import EventCard from '../../components/EventCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getEvents } from '../../services/eventService';
import { COLORS, SIZES, SPACING } from '../../utils/constants';
import useAuth from '../../hooks/useAuth';

const EventsScreen = ({ navigation }) => {
  const { userProfile } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    const { items } = await getEvents();
    setEvents(items);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Events</Text>
        {userProfile?.role === 'admin' && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('CreateEvent')}
          >
            <MaterialIcons name="add" size={22} color={COLORS.white} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              item={item}
              onPress={() => navigation.navigate('EventDetail', { event: item })}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={fetchEvents}
          refreshing={loading}
          ListEmptyComponent={<Text style={styles.empty}>No upcoming events.</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  title: { fontSize: SIZES.xxlarge, fontWeight: '700', color: COLORS.text },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 6,
  },
  list: { padding: SPACING.md },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xl },
});

export default EventsScreen;
