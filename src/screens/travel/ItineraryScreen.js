import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Platform,
  ScrollView, Share, RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  getTravelPlans, createTravelPlan, updateTravelPlan,
  deleteTravelPlan, optimizeRoute,
} from '../../services/travelService';
import { generateId } from '../../utils/helpers';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ItineraryScreen({ navigation }) {
  const { user } = useAuth();

  const [plans,         setPlans]         = useState([]);
  const [activePlan,    setActivePlan]    = useState(null);
  const [activeDayId,   setActiveDayId]   = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [newStopName,   setNewStopName]   = useState('');
  const [newStopNote,   setNewStopNote]   = useState('');
  const [showNewPlan,   setShowNewPlan]   = useState(false);
  const [newPlanTitle,  setNewPlanTitle]  = useState('');
  const [showNoteFor,   setShowNoteFor]   = useState(null);

  // ── Fetch plans on focus ──────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      fetchPlans();
    }, [user])
  );

  async function fetchPlans() {
    if (!user) return;
    try {
      const data = await getTravelPlans(user.uid);
      setPlans(data);
      if (data.length > 0) {
        const currentPlan = activePlan
          ? data.find(p => p.id === activePlan.id) ?? data[0]
          : data[0];
        setActivePlan(currentPlan);
        setActiveDayId(prev => prev ?? currentPlan.days?.[0]?.id ?? null);
      }
    } catch (e) {
      console.error('fetchPlans error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchPlans();
  }

  // ── Create new plan ───────────────────────────────────────
  async function handleCreatePlan() {
    if (!newPlanTitle.trim()) return;
    setSaving(true);
    try {
      const planId = await createTravelPlan(user.uid, {
        title: newPlanTitle.trim(),
      });
      const newPlan = {
        id:    planId,
        title: newPlanTitle.trim(),
        days:  [{ id: '1', label: 'Day 1', stops: [] }],
      };
      setPlans(prev => [newPlan, ...prev]);
      setActivePlan(newPlan);
      setActiveDayId('1');
      setNewPlanTitle('');
      setShowNewPlan(false);
    } catch (e) {
      Alert.alert('Error', 'Could not create plan.');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete plan ───────────────────────────────────────────
  async function handleDeletePlan(planId) {
    const confirm = Platform.OS === 'web'
      ? window.confirm('Delete this travel plan?')
      : await new Promise(resolve =>
          Alert.alert('Delete plan', 'This cannot be undone.', [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Delete', onPress: () => resolve(true),  style: 'destructive' },
          ])
        );
    if (!confirm) return;
    await deleteTravelPlan(planId);
    const remaining = plans.filter(p => p.id !== planId);
    setPlans(remaining);
    if (activePlan?.id === planId) {
      setActivePlan(remaining[0] ?? null);
      setActiveDayId(remaining[0]?.days?.[0]?.id ?? null);
    }
  }

  // ── Save plan to Firestore ────────────────────────────────
  async function savePlan(updatedPlan) {
    try {
      await updateTravelPlan(updatedPlan.id, { days: updatedPlan.days });
      setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    } catch (e) {
      console.error('savePlan error:', e);
    }
  }

  // ── Add day ───────────────────────────────────────────────
  function handleAddDay() {
    if (!activePlan) return;
    const newDay = {
      id:    generateId(),
      label: `Day ${activePlan.days.length + 1}`,
      stops: [],
    };
    const updated = { ...activePlan, days: [...activePlan.days, newDay] };
    setActivePlan(updated);
    setActiveDayId(newDay.id);
    savePlan(updated);
  }

  // ── Remove day ────────────────────────────────────────────
  function handleRemoveDay(dayId) {
    if (activePlan.days.length === 1) {
      Alert.alert('Cannot remove the only day.');
      return;
    }
    const remaining = activePlan.days.filter(d => d.id !== dayId);
    const updated   = { ...activePlan, days: remaining };
    setActivePlan(updated);
    if (activeDayId === dayId) setActiveDayId(remaining[0].id);
    savePlan(updated);
  }

  // ── Add stop ──────────────────────────────────────────────
  function handleAddStop() {
    if (!newStopName.trim() || !activePlan) return;
    const stop = {
      id:   generateId(),
      name: newStopName.trim(),
      note: newStopNote.trim() || null,
      type: 'custom',
    };
    const updatedDays = activePlan.days.map(day =>
      day.id === activeDayId
        ? { ...day, stops: [...(day.stops ?? []), stop] }
        : day
    );
    const updated = { ...activePlan, days: updatedDays };
    setActivePlan(updated);
    setNewStopName('');
    setNewStopNote('');
    savePlan(updated);
  }

  // ── Remove stop ───────────────────────────────────────────
  function handleRemoveStop(stopId) {
    const updatedDays = activePlan.days.map(day =>
      day.id === activeDayId
        ? { ...day, stops: day.stops.filter(s => s.id !== stopId) }
        : day
    );
    const updated = { ...activePlan, days: updatedDays };
    setActivePlan(updated);
    savePlan(updated);
  }

  // ── Update stop note ──────────────────────────────────────
  function handleUpdateNote(stopId, note) {
    const updatedDays = activePlan.days.map(day =>
      day.id === activeDayId
        ? { ...day, stops: day.stops.map(s => s.id === stopId ? { ...s, note } : s) }
        : day
    );
    const updated = { ...activePlan, days: updatedDays };
    setActivePlan(updated);
    savePlan(updated);
  }

  // ── Optimize route ────────────────────────────────────────
  function handleOptimizeRoute() {
    if (!activePlan) return;
    const activeDay = activePlan.days.find(d => d.id === activeDayId);
    if (!activeDay || activeDay.stops.length < 2) {
      Alert.alert('Need at least 2 stops to optimize route.');
      return;
    }
    const optimized   = optimizeRoute(activeDay.stops);
    const updatedDays = activePlan.days.map(day =>
      day.id === activeDayId ? { ...day, stops: optimized } : day
    );
    const updated = { ...activePlan, days: updatedDays };
    setActivePlan(updated);
    savePlan(updated);
    Alert.alert('✅ Route optimized!', 'Stops have been reordered by proximity.');
  }

  // ── Share plan ────────────────────────────────────────────
  async function handleShare() {
    if (!activePlan) return;
    const text = activePlan.days.map(day => {
      const stops = day.stops.map((s, i) =>
        `  ${i + 1}. ${s.name}${s.note ? ` — ${s.note}` : ''}`
      ).join('\n');
      return `📅 ${day.label}:\n${stops || '  No stops'}`;
    }).join('\n\n');

    const shareText = `🗺️ ${activePlan.title}\n\n${text}\n\nShared via ExploreEase`;

    try {
      await Share.share({ message: shareText, title: activePlan.title });
    } catch (e) {
      console.error('Share error:', e);
    }
  }

  const activeDay = activePlan?.days?.find(d => d.id === activeDayId);

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>🗺️</Text>
        <Text style={styles.emptyTitle}>Sign in to plan trips</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1D9E75" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1D9E75" />
        }
      >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Travel Plans</Text>
        <View style={styles.headerBtns}>
          {activePlan && (
            <TouchableOpacity style={styles.headerBtn} onPress={handleShare}>
              <Text style={styles.headerBtnText}>↑ Share</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.headerBtn, styles.headerBtnPrimary]}
            onPress={() => setShowNewPlan(true)}
          >
            <Text style={styles.headerBtnPrimaryText}>+ New Plan</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── New plan form ── */}
      {showNewPlan && (
        <View style={styles.newPlanForm}>
          <TextInput
            style={styles.newPlanInput}
            placeholder="Plan title e.g. Weekend in Saigon"
            placeholderTextColor="#aaa"
            value={newPlanTitle}
            onChangeText={setNewPlanTitle}
            autoFocus
          />
          <View style={styles.newPlanBtns}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setShowNewPlan(false); setNewPlanTitle(''); }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, !newPlanTitle.trim() && styles.createBtnDisabled]}
              onPress={handleCreatePlan}
              disabled={saving || !newPlanTitle.trim()}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.createBtnText}>Create</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Plan selector ── */}
      {plans.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 44 }}
          contentContainerStyle={styles.planTabs}
        >
          {plans.map(plan => (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planTab, activePlan?.id === plan.id && styles.planTabActive]}
              onPress={() => {
                setActivePlan(plan);
                setActiveDayId(plan.days?.[0]?.id ?? null);
              }}
              onLongPress={() => handleDeletePlan(plan.id)}
            >
              <Text
                style={[styles.planTabText, activePlan?.id === plan.id && styles.planTabTextActive]}
                numberOfLines={1}
              >
                {plan.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {plans.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={styles.emptyTitle}>No travel plans yet</Text>
          <Text style={styles.emptySub}>Tap "+ New Plan" to start planning!</Text>
        </View>
      ) : (
        <>
          {/* ── Day tabs ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayTabs}
          >
            {activePlan?.days?.map(day => (
              <TouchableOpacity
                key={day.id}
                style={[styles.dayTab, day.id === activeDayId && styles.dayTabActive]}
                onPress={() => setActiveDayId(day.id)}
                onLongPress={() => handleRemoveDay(day.id)}
              >
                <Text style={[styles.dayTabText, day.id === activeDayId && styles.dayTabTextActive]}>
                  {day.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addDayBtn} onPress={handleAddDay}>
              <Text style={styles.addDayBtnText}>+ Day</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* ── Optimize button ── */}
          {(activeDay?.stops?.length ?? 0) >= 2 && (
            <TouchableOpacity style={styles.optimizeBtn} onPress={handleOptimizeRoute}>
              <Text style={styles.optimizeBtnText}>🧭 Optimize Route</Text>
            </TouchableOpacity>
          )}

          {/* ── Stops list ── */}
          <View>
            {(activeDay?.stops ?? []).length === 0 ? (
              <View style={styles.emptyStops}>
                <Text style={styles.emptyEmoji}>📍</Text>
                <Text style={styles.emptySub}>No stops yet. Add places below!</Text>
              </View>
            ) : (
              <View style={styles.stopList}>
                {(activeDay?.stops ?? []).map((item, index) => (
                  <View key={item.id} style={styles.stopCard}>
                    <View style={styles.stopHeader}>
                      <View style={styles.stopBadge}>
                        <Text style={styles.stopBadgeText}>{index + 1}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.stopInfo}
                        onPress={() => {
                          if (item.type === 'attraction') {
                            navigation.navigate('Discover', {
                              screen: 'Detail',
                              params: { itemId: item.id, type: 'attraction' },
                            });
                          } else if (item.type === 'event') {
                            navigation.navigate('Events', {
                              screen: 'EventDetail',
                              params: { eventId: item.id },
                            });
                          }
                        }}
                        disabled={!item.type || item.type === 'custom'}
                      >
                        <Text style={[
                          styles.stopName,
                          item.type && item.type !== 'custom' && styles.stopNameLink,
                        ]}>
                          {item.name}
                        </Text>
                        {item.type && item.type !== 'custom' && (
                          <Text style={styles.stopType}>
                            {item.type === 'attraction' ? '📍 Place' : '📅 Event'}
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.noteBtn}
                        onPress={() => setShowNoteFor(showNoteFor === item.id ? null : item.id)}
                      >
                        <Text style={styles.noteBtnText}>📝</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemoveStop(item.id)}
                      >
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    {item.note && showNoteFor !== item.id && (
                      <Text style={styles.stopNote}>📝 {item.note}</Text>
                    )}

                    {showNoteFor === item.id && (
                      <View style={styles.noteEditor}>
                        <TextInput
                          style={styles.noteInput}
                          placeholder="Add a note or reminder..."
                          placeholderTextColor="#aaa"
                          value={item.note ?? ''}
                          onChangeText={text => handleUpdateNote(item.id, text)}
                          multiline
                          autoFocus
                        />
                        <TouchableOpacity
                          style={styles.noteSaveBtn}
                          onPress={() => setShowNoteFor(null)}
                        >
                          <Text style={styles.noteSaveBtnText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

        </>
      )}
      </ScrollView>

      {/* ── Add stop form (sticky bottom) ── */}
      {activePlan && (
        <View style={styles.addStopForm}>
          <TextInput
            style={styles.stopInput}
            placeholder="Add a stop..."
            placeholderTextColor="#aaa"
            value={newStopName}
            onChangeText={setNewStopName}
            returnKeyType="next"
          />
          <TextInput
            style={styles.noteInputSmall}
            placeholder="Note (optional)"
            placeholderTextColor="#aaa"
            value={newStopNote}
            onChangeText={setNewStopNote}
            returnKeyType="done"
            onSubmitEditing={handleAddStop}
          />
          <TouchableOpacity
            style={[styles.addStopBtn, !newStopName.trim() && styles.addStopBtnDisabled]}
            onPress={handleAddStop}
            disabled={!newStopName.trim()}
          >
            <Text style={styles.addStopBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: '#f9fafb' },
  centered:             { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },

  header:               { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  title:                { fontSize: 18, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  headerBtns:           { flexDirection: 'row', gap: 6, flexShrink: 0 },
  headerBtn:            { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' },
  headerBtnText:        { fontSize: 12, color: '#555', fontWeight: '600' },
  headerBtnPrimary:     { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  headerBtnPrimaryText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  newPlanForm:          { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0', gap: 10 },
  newPlanInput:         { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1a1a1a' },
  newPlanBtns:          { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelBtn:            { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f5f5f5' },
  cancelBtnText:        { fontSize: 13, color: '#555', fontWeight: '600' },
  createBtn:            { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1D9E75' },
  createBtnDisabled:    { backgroundColor: '#a0d4c0' },
  createBtnText:        { fontSize: 13, color: '#fff', fontWeight: '700' },

  planTabs:             { paddingHorizontal: 20, gap: 8, paddingBottom: 4, paddingTop: 4, alignItems: 'center' },
  planTab:              { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', maxWidth: 160, minWidth: 60, alignItems: 'center', justifyContent: 'center', height: 32 },
  planTabActive:        { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  planTabText:          { fontSize: 13, color: '#555', textAlign: 'center' },
  planTabTextActive:    { color: '#fff', fontWeight: '600' },

  dayTabs:              { paddingHorizontal: 20, gap: 8, paddingTop: 4, paddingBottom: 8 },
  dayTab:               { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', height: 32, justifyContent: 'center' },
  dayTabActive:         { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  dayTabText:           { fontSize: 12, color: '#555' },
  dayTabTextActive:     { color: '#fff', fontWeight: '600' },
  addDayBtn:            { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0', height: 32, justifyContent: 'center' },
  addDayBtnText:        { fontSize: 12, color: '#555' },

  optimizeBtn:          { marginHorizontal: 20, marginBottom: 4, backgroundColor: '#E1F5EE', borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#1D9E75' },
  optimizeBtnText:      { fontSize: 13, color: '#0F6E56', fontWeight: '700' },

  stopList:             { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 0 },
  stopListScroll:       {},
  stopListContent:      {},
  stopCard:             { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  stopHeader:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stopBadge:            { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  stopBadgeText:        { color: '#fff', fontWeight: '700', fontSize: 12 },
  stopInfo:             { flex: 1 },
  stopName:             { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  stopNameLink:         { color: '#1D9E75', textDecorationLine: 'underline' },
  stopType:             { fontSize: 11, color: '#aaa', marginTop: 2 },
  noteBtn:              { padding: 6 },
  noteBtnText:          { fontSize: 16 },
  removeBtn:            { padding: 6 },
  removeBtnText:        { fontSize: 14, color: '#E24B4A' },
  stopNote:             { fontSize: 12, color: '#888', marginTop: 8, paddingLeft: 38 },
  noteEditor:           { marginTop: 10, gap: 8 },
  noteInput:            { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 10, fontSize: 13, color: '#1a1a1a', minHeight: 60 },
  noteSaveBtn:          { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#1D9E75', borderRadius: 8 },
  noteSaveBtnText:      { color: '#fff', fontWeight: '600', fontSize: 13 },

  addStopForm:          { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 8 },
  stopInput:            { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1a1a1a' },
  noteInputSmall:       { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13, color: '#1a1a1a' },
  addStopBtn:           { backgroundColor: '#1D9E75', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addStopBtnDisabled:   { backgroundColor: '#a0d4c0' },
  addStopBtnText:       { color: '#fff', fontWeight: '700', fontSize: 14 },

  emptyEmoji:           { fontSize: 48 },
  emptyTitle:           { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  emptySub:             { fontSize: 13, color: '#aaa', textAlign: 'center' },
  emptyStops:           { alignItems: 'center', paddingTop: 16, gap: 8 },
});
