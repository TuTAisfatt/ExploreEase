import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { joinEvent, leaveEvent } from '../../services/eventService';
import { COLORS, SIZES, SPACING } from '../../utils/constants';
import { formatDateTime } from '../../utils/helpers';
import useAuth from '../../hooks/useAuth';

const EventDetailScreen = ({ route, navigation }) => {
  const { event: initialEvent } = route.params;
  const { user } = useAuth();
  const [event, setEvent] = useState(initialEvent);
  const [loading, setLoading] = useState(false);

  const isAttending = event.attendees?.includes(user?.uid);

  const handleToggleAttend = async () => {
    setLoading(true);
    try {
      if (isAttending) {
        await leaveEvent(event.id, user.uid);
        setEvent((prev) => ({ ...prev, attendees: prev.attendees.filter((id) => id !== user.uid) }));
      } else {
        await joinEvent(event.id, user.uid);
        setEvent((prev) => ({ ...prev, attendees: [...(prev.attendees ?? []), user.uid] }));
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView>
        <Image
          source={{ uri: event.imageUrl || 'https://via.placeholder.com/400x250' }}
          style={styles.image}
        />
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>

        <View style={styles.body}>
          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.infoRow}>
            <MaterialIcons name="event" size={18} color={COLORS.primary} />
            <Text style={styles.infoText}>{formatDateTime(event.date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="location-on" size={18} color={COLORS.secondary} />
            <Text style={styles.infoText}>{event.location}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="people" size={18} color={COLORS.gray} />
            <Text style={styles.infoText}>{event.attendees?.length ?? 0} people attending</Text>
          </View>

          {event.description ? (
            <Text style={styles.description}>{event.description}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.attendBtn, isAttending && styles.leaveBtn, loading && { opacity: 0.6 }]}
            onPress={handleToggleAttend}
            disabled={loading}
          >
            <MaterialIcons
              name={isAttending ? 'event-busy' : 'event-available'}
              size={20}
              color={COLORS.white}
            />
            <Text style={styles.attendBtnText}>
              {loading ? 'Processing...' : isAttending ? 'Leave Event' : 'Join Event'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  image: { width: '100%', height: 250 },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 6,
  },
  body: { padding: SPACING.md },
  title: { fontSize: SIZES.xxlarge, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  infoText: { marginLeft: SPACING.sm, fontSize: SIZES.medium, color: COLORS.textSecondary },
  description: { color: COLORS.textSecondary, fontSize: SIZES.medium, marginTop: SPACING.sm, lineHeight: 22 },
  attendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  leaveBtn: { backgroundColor: COLORS.error },
  attendBtnText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.medium },
});

export default EventDetailScreen;
