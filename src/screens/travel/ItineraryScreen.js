import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING } from '../../utils/constants';
import { generateId } from '../../utils/helpers';

const ItineraryScreen = () => {
  const [days, setDays] = useState([{ id: generateId(), label: 'Day 1', stops: [] }]);
  const [newStop, setNewStop] = useState('');
  const [activeDayId, setActiveDayId] = useState(days[0].id);

  const addDay = () => {
    const newDay = { id: generateId(), label: `Day ${days.length + 1}`, stops: [] };
    setDays((prev) => [...prev, newDay]);
    setActiveDayId(newDay.id);
  };

  const addStop = () => {
    if (!newStop.trim()) return;
    setDays((prev) =>
      prev.map((d) =>
        d.id === activeDayId
          ? { ...d, stops: [...d.stops, { id: generateId(), name: newStop.trim() }] }
          : d
      )
    );
    setNewStop('');
  };

  const removeStop = (stopId) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === activeDayId ? { ...d, stops: d.stops.filter((s) => s.id !== stopId) } : d
      )
    );
  };

  const removeDay = (dayId) => {
    if (days.length === 1) { Alert.alert('Cannot remove the only day.'); return; }
    const remaining = days.filter((d) => d.id !== dayId);
    setDays(remaining);
    if (activeDayId === dayId) setActiveDayId(remaining[0].id);
  };

  const activeDay = days.find((d) => d.id === activeDayId);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Itinerary</Text>

      <View style={styles.dayTabs}>
        <FlatList
          data={days}
          horizontal
          keyExtractor={(d) => d.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.dayTab, item.id === activeDayId && styles.dayTabActive]}
              onPress={() => setActiveDayId(item.id)}
              onLongPress={() => removeDay(item.id)}
            >
              <Text style={[styles.dayTabText, item.id === activeDayId && styles.dayTabTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <TouchableOpacity style={styles.addDayBtn} onPress={addDay}>
              <MaterialIcons name="add" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          }
        />
      </View>

      <FlatList
        data={activeDay?.stops ?? []}
        keyExtractor={(s) => s.id}
        renderItem={({ item, index }) => (
          <View style={styles.stopRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>{index + 1}</Text>
            </View>
            <Text style={styles.stopName}>{item.name}</Text>
            <TouchableOpacity onPress={() => removeStop(item.id)}>
              <MaterialIcons name="close" size={20} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.stopList}
        ListEmptyComponent={<Text style={styles.empty}>No stops added yet.</Text>}
      />

      <View style={styles.addStopRow}>
        <TextInput
          style={styles.stopInput}
          placeholder="Add a stop..."
          value={newStop}
          onChangeText={setNewStop}
          onSubmitEditing={addStop}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addStopBtn} onPress={addStop}>
          <MaterialIcons name="add" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  title: { fontSize: SIZES.xxlarge, fontWeight: '700', color: COLORS.text, padding: SPACING.md },
  dayTabs: { paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  dayTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    marginRight: SPACING.sm,
    elevation: 1,
  },
  dayTabActive: { backgroundColor: COLORS.primary },
  dayTabText: { fontSize: SIZES.small, color: COLORS.textSecondary },
  dayTabTextActive: { color: COLORS.white, fontWeight: '600' },
  addDayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  stopList: { padding: SPACING.md, flexGrow: 1 },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    elevation: 1,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  stepNum: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.small },
  stopName: { flex: 1, fontSize: SIZES.medium, color: COLORS.text },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xl },
  addStopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderColor: COLORS.lightGray,
  },
  stopInput: {
    flex: 1,
    fontSize: SIZES.medium,
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
  },
  addStopBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 8,
    marginLeft: SPACING.sm,
  },
});

export default ItineraryScreen;
