import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocation } from '../../hooks/useLocation';
import { getNearbyAttractions } from '../../services/locationService';

const { width } = Dimensions.get('window');

export default function MapScreen({ navigation }) {
  const { region, loading: locationLoading } = useLocation();
  const mapRef = useRef(null);

  const [attractions,    setAttractions]    = useState([]);
  const [selectedItem,   setSelectedItem]   = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [manualRegion,   setManualRegion]   = useState(null);

  // ── Fetch attractions when location is ready ─────────────
  useEffect(() => {
    if (!region) return;
    (async () => {
      try {
        const data = await getNearbyAttractions(
          region.latitude,
          region.longitude,
          20
        );
        setAttractions(data);
      } catch (e) {
        console.error('Map fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [region]);

  // ── Re-center map to user location ───────────────────────
  function handleRecenter() {
    if (!region || !mapRef.current) return;
    mapRef.current.animateToRegion(region, 800);
    setManualRegion(null);
    setSelectedItem(null);
  }

  // ── Web fallback ─────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webFallback}>
        <Text style={styles.webFallbackEmoji}>🗺️</Text>
        <Text style={styles.webFallbackTitle}>Map view</Text>
        <Text style={styles.webFallbackSub}>
          Map is available on the mobile app only.
        </Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Loading state ────────────────────────────────────────
  if (locationLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1D9E75" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Back button ── */}
      <TouchableOpacity
        style={styles.backFloating}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backFloatingText}>←</Text>
      </TouchableOpacity>

      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={manualRegion ?? region}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={setManualRegion}
      >
        {attractions.map(item => {
          const lat = item.location?.latitude  ?? item.location?._lat;
          const lng = item.location?.longitude ?? item.location?._long;
          if (!lat || !lng) return null;

          return (
            <Marker
              key={item.id}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => setSelectedItem(item)}
            >
              {/* Custom marker */}
              <View style={[
                styles.marker,
                selectedItem?.id === item.id && styles.markerSelected,
              ]}>
                <Text style={styles.markerEmoji}>
                  {categoryEmoji(item.category)}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* ── Re-center button ── */}
      <TouchableOpacity
        style={styles.recenterBtn}
        onPress={handleRecenter}
      >
        <Text style={styles.recenterIcon}>◎</Text>
      </TouchableOpacity>

      {/* ── Selected item card ── */}
      {selectedItem && (
        <View style={styles.selectedCard}>
          <TouchableOpacity
            style={styles.selectedCardClose}
            onPress={() => setSelectedItem(null)}
          >
            <Text style={styles.selectedCardCloseText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.selectedName} numberOfLines={1}>
            {selectedItem.name}
          </Text>
          <Text style={styles.selectedAddress} numberOfLines={1}>
            📍 {selectedItem.address ?? 'No address'}
          </Text>

          <View style={styles.selectedMeta}>
            {selectedItem.reviewCount > 0 && (
              <Text style={styles.selectedRating}>
                ⭐ {(selectedItem.ratingSum / selectedItem.reviewCount).toFixed(1)}
                {'  '}({selectedItem.reviewCount})
              </Text>
            )}
            {selectedItem.priceLevel !== undefined && (
              <Text style={styles.selectedPrice}>
                {selectedItem.priceLevel === 0
                  ? 'Free'
                  : '$'.repeat(selectedItem.priceLevel)}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.selectedBtn}
            onPress={() => {
              setSelectedItem(null);
              navigation.navigate('Detail', {
                itemId: selectedItem.id,
                type:   'attraction',
              });
            }}
          >
            <Text style={styles.selectedBtnText}>View details →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Attractions count badge ── */}
      <View style={styles.countBadge}>
        <Text style={styles.countText}>
          {attractions.length} place{attractions.length !== 1 ? 's' : ''} nearby
        </Text>
      </View>
    </View>
  );
}

// ── Map category to emoji ──────────────────────────────────
function categoryEmoji(category) {
  const map = {
    food:      '🍜',
    culture:   '🏛️',
    shopping:  '🛍️',
    nature:    '🌿',
    adventure: '⛺',
  };
  return map[category] ?? '📍';
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:         { flex: 1 },
  map:               { flex: 1 },

  centered:          { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:       { color: '#888', fontSize: 14 },

  backFloating:      { position: 'absolute', top: 52, left: 20, zIndex: 10, backgroundColor: '#fff', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  backFloatingText:  { fontSize: 20, color: '#1a1a1a' },

  recenterBtn:       { position: 'absolute', bottom: 180, right: 20, backgroundColor: '#fff', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  recenterIcon:      { fontSize: 22, color: '#1D9E75' },

  marker:            { backgroundColor: '#fff', borderRadius: 20, padding: 6, borderWidth: 2, borderColor: '#1D9E75', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 },
  markerSelected:    { borderColor: '#0F6E56', backgroundColor: '#E1F5EE', transform: [{ scale: 1.2 }] },
  markerEmoji:       { fontSize: 18 },

  selectedCard:      { position: 'absolute', bottom: 24, left: 20, right: 20, backgroundColor: '#fff', borderRadius: 20, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  selectedCardClose: { position: 'absolute', top: 14, right: 14, padding: 4 },
  selectedCardCloseText: { fontSize: 16, color: '#aaa' },
  selectedName:      { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 4, paddingRight: 24 },
  selectedAddress:   { fontSize: 13, color: '#888', marginBottom: 10 },
  selectedMeta:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  selectedRating:    { fontSize: 13, color: '#444', fontWeight: '500' },
  selectedPrice:     { fontSize: 13, color: '#1D9E75', fontWeight: '700', marginLeft: 'auto' },
  selectedBtn:       { backgroundColor: '#1D9E75', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  selectedBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },

  countBadge:        { position: 'absolute', top: 52, right: 20, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  countText:         { fontSize: 13, color: '#1a1a1a', fontWeight: '600' },

  webFallback:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', gap: 12 },
  webFallbackEmoji:  { fontSize: 64 },
  webFallbackTitle:  { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  webFallbackSub:    { fontSize: 14, color: '#888' },
  backBtn:           { marginTop: 16, backgroundColor: '#1D9E75', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText:       { color: '#fff', fontWeight: '600', fontSize: 14 },
});