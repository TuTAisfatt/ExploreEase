import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Dimensions, Platform, Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocation } from '../../hooks/useLocation';
import { getNearbyAttractions } from '../../services/locationService';
import { getEvents } from '../../services/eventService';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

export default function MapScreen({ navigation }) {
  const { region, loading: locationLoading } = useLocation();
  const { userProfile } = useAuth();
  const mapRef = useRef(null);

  const [attractions,  setAttractions]  = useState([]);
  const [events,       setEvents]       = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [routeCoords,  setRouteCoords]  = useState([]);
  const [routeInfo,    setRouteInfo]    = useState(null); // { distance, duration }
  const [activeFilter, setActiveFilter] = useState('all');

  // ── Fetch attractions + events ───────────────────────────
  useEffect(() => {
    if (!region) return;
    (async () => {
      try {
        const [attractionData, eventData] = await Promise.all([
          getNearbyAttractions(region.latitude, region.longitude, 20),
          getEvents({ approved: true }),
        ]);
        setAttractions(attractionData);
        setEvents(eventData.items ?? []);
      } catch (e) {
        console.error('Map fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [region]);

  // ── Filter pins based on user interests ──────────────────
  const userInterests = userProfile?.interests ?? [];

  const filteredAttractions = attractions.filter(a => {
    if (activeFilter === 'events') return false;
    if (activeFilter === 'recommended') {
      return userInterests.length === 0 || userInterests.includes(a.category);
    }
    return true;
  });

  const filteredEvents = events.filter(() => {
    if (activeFilter === 'attractions') return false;
    if (activeFilter === 'recommended') return false;
    return true;
  });

  // ── Re-center map ─────────────────────────────────────────
  function handleRecenter() {
    if (!region || !mapRef.current) return;
    mapRef.current.animateToRegion(region, 800);
    setSelectedItem(null);
    setRouteCoords([]);
  }

  // ── Draw route from user to selected item ─────────────────
  async function handleShowRoute(item) {
    if (!region || !item.location) return;
    const lat = item.location.latitude  ?? item.location._lat;
    const lng = item.location.longitude ?? item.location._long;

    try {
      const apiKey = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijc3Y2Y2OGQwNWEzZDQwN2I4NGEyODA3YjBjMWY2M2Y0IiwiaCI6Im11cm11cjY0In0=';

      const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${region.longitude},${region.latitude}&end=${lng},${lat}`;

      const response = await fetch(url);
      const data     = await response.json();

      if (!data.features || data.features.length === 0) {
        // Fallback to straight line
        setRouteCoords([
          { latitude: region.latitude,  longitude: region.longitude },
          { latitude: lat,              longitude: lng },
        ]);
        return;
      }

      // OpenRouteService returns [lng, lat] pairs — we need to swap to [lat, lng]
      const coords = data.features[0].geometry.coordinates.map(
        ([longitude, latitude]) => ({ latitude, longitude })
      );

      setRouteCoords(coords);

      // Extract distance and duration from response
      const summary     = data.features[0].properties.summary;
      const distanceKm  = (summary.distance / 1000).toFixed(1);
      const durationMin = Math.round(summary.duration / 60);
      setRouteInfo({ distance: distanceKm, duration: durationMin });

      // Fit map to show the full route
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 80, bottom: 220, left: 80 },
        animated: true,
      });
    } catch (e) {
      console.error('Directions error:', e);
      // Fallback to straight line
      setRouteCoords([
        { latitude: region.latitude,  longitude: region.longitude },
        { latitude: lat,              longitude: lng },
      ]);
    }
  }


  // ── Open in Google Maps for turn-by-turn ─────────────────
  function handleDirections(item) {
    if (!item.location) return;
    const lat = item.location.latitude  ?? item.location._lat;
    const lng = item.location.longitude ?? item.location._long;
    const url = Platform.select({
      ios:     `maps://app?daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url);
  }

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

      {/* ── Filter chips ── */}
      <View style={styles.filterRow}>
        {[
          { id: 'all',          label: '🌐 All'         },
          { id: 'attractions',  label: '🏛️ Places'      },
          { id: 'events',       label: '🗓️ Events'      },
          { id: 'recommended',  label: '⭐ For you'     },
        ].map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterChip, activeFilter === f.id && styles.filterChipActive]}
            onPress={() => {
              setActiveFilter(f.id);
              setSelectedItem(null);
              setRouteCoords([]);
              setRouteInfo(null);
            }}
          >
            <Text style={[
              styles.filterChipText,
              activeFilter === f.id && styles.filterChipTextActive,
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Route line */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#1D9E75"
            strokeWidth={4}
            lineJoin="round"
            lineCap="round"
          />
        )}

        {/* Attraction markers */}
        {filteredAttractions.map(item => {
          const lat = item.location?.latitude  ?? item.location?._lat;
          const lng = item.location?.longitude ?? item.location?._long;
          if (!lat || !lng) return null;
          return (
            <Marker
              key={`a-${item.id}`}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => {
                setSelectedItem({ ...item, itemType: 'attraction' });
                setRouteCoords([]);
              }}
            >
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

        {/* Event markers */}
        {filteredEvents.map(item => {
          if (!item.location) return null;
          const lat = item.location.latitude  ?? item.location._lat;
          const lng = item.location.longitude ?? item.location._long;
          if (!lat || !lng) return null;
          return (
            <Marker
              key={`e-${item.id}`}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => {
                setSelectedItem({ ...item, itemType: 'event' });
                setRouteCoords([]);
              }}
            >
              <View style={[
                styles.marker,
                styles.markerEvent,
                selectedItem?.id === item.id && styles.markerSelected,
              ]}>
                <Text style={styles.markerEmoji}>🗓️</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* ── Re-center button ── */}
      <TouchableOpacity style={styles.recenterBtn} onPress={handleRecenter}>
        <Text style={styles.recenterIcon}>◎</Text>
      </TouchableOpacity>

      {/* ── Count badge ── */}
      <View style={styles.countBadge}>
        <Text style={styles.countText}>
          {filteredAttractions.length + filteredEvents.length} nearby
        </Text>
      </View>

      {/* ── Selected item card ── */}
      {selectedItem && (
        <View style={styles.selectedCard}>
          <TouchableOpacity
            style={styles.selectedCardClose}
            onPress={() => {
              setSelectedItem(null);
              setRouteCoords([]);
              setRouteInfo(null);
            }}
          >
            <Text style={styles.selectedCardCloseText}>✕</Text>
          </TouchableOpacity>

          {/* Type badge */}
          <View style={[
            styles.typeBadge,
            selectedItem.itemType === 'event' && styles.typeBadgeEvent,
          ]}>
            <Text style={styles.typeBadgeText}>
              {selectedItem.itemType === 'event' ? '🗓️ Event' : '📍 Place'}
            </Text>
          </View>

          <Text style={styles.selectedName} numberOfLines={1}>
            {selectedItem.name ?? selectedItem.title}
          </Text>
          <Text style={styles.selectedAddress} numberOfLines={1}>
            📍 {selectedItem.address ?? 'No address'}
          </Text>

          {/* Route info */}
          {routeInfo && (
            <View style={styles.routeInfo}>
              <Text style={styles.routeInfoText}>
                🛣️ {routeInfo.distance} km  ·  🕐 {routeInfo.duration} min
              </Text>
            </View>
          )}

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

          {/* Action buttons */}
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.routeBtn}
              onPress={() => handleShowRoute(selectedItem)}
            >
              <Text style={styles.routeBtnText}>📍 Show route</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.directionsBtn}
              onPress={() => handleDirections(selectedItem)}
            >
              <Text style={styles.directionsBtnText}>🧭 Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => {
                setSelectedItem(null);
                setRouteCoords([]);
                navigation.navigate('Detail', {
                  itemId: selectedItem.id,
                  type:   selectedItem.itemType ?? 'attraction',
                });
              }}
            >
              <Text style={styles.detailBtnText}>View →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

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

const styles = StyleSheet.create({
  container:          { flex: 1 },
  map:                { flex: 1 },
  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:        { color: '#888', fontSize: 14 },

  backFloating:       { position: 'absolute', top: 52, left: 20, zIndex: 10, backgroundColor: '#fff', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  backFloatingText:   { fontSize: 20, color: '#1a1a1a' },

  filterRow:          { position: 'absolute', top: 52, left: 76, right: 20, zIndex: 10, flexDirection: 'row', gap: 6 },
  filterChip:         { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, elevation: 3 },
  filterChipActive:   { backgroundColor: '#1D9E75' },
  filterChipText:     { fontSize: 11, color: '#555', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  recenterBtn:        { position: 'absolute', bottom: 220, right: 20, backgroundColor: '#fff', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  recenterIcon:       { fontSize: 22, color: '#1D9E75' },

  marker:             { backgroundColor: '#fff', borderRadius: 20, padding: 6, borderWidth: 2, borderColor: '#1D9E75', elevation: 3 },
  markerEvent:        { borderColor: '#EF9F27' },
  markerSelected:     { borderColor: '#0F6E56', backgroundColor: '#E1F5EE', transform: [{ scale: 1.2 }] },
  markerEmoji:        { fontSize: 18 },

  countBadge:         { position: 'absolute', bottom: 220, left: 20, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, elevation: 3 },
  countText:          { fontSize: 13, color: '#1a1a1a', fontWeight: '600' },

  selectedCard:       { position: 'absolute', bottom: 24, left: 20, right: 20, backgroundColor: '#fff', borderRadius: 20, padding: 18, elevation: 8 },
  selectedCardClose:  { position: 'absolute', top: 14, right: 14, padding: 4 },
  selectedCardCloseText: { fontSize: 16, color: '#aaa' },

  typeBadge:          { backgroundColor: '#E1F5EE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 },
  typeBadgeEvent:     { backgroundColor: '#FAEEDA' },
  typeBadgeText:      { fontSize: 11, color: '#0F6E56', fontWeight: '700' },

  selectedName:       { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 4, paddingRight: 24 },
  selectedAddress:    { fontSize: 13, color: '#888', marginBottom: 10 },
  routeInfo:          { backgroundColor: '#E1F5EE', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  routeInfoText:      { fontSize: 13, color: '#0F6E56', fontWeight: '600', textAlign: 'center' },
  selectedMeta:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  selectedRating:     { fontSize: 13, color: '#444', fontWeight: '500' },
  selectedPrice:      { fontSize: 13, color: '#1D9E75', fontWeight: '700', marginLeft: 'auto' },

  cardActions:        { flexDirection: 'row', gap: 8 },
  routeBtn:           { flex: 1, backgroundColor: '#E1F5EE', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  routeBtnText:       { color: '#0F6E56', fontWeight: '600', fontSize: 12 },
  directionsBtn:      { flex: 1, backgroundColor: '#1D9E75', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  directionsBtnText:  { color: '#fff', fontWeight: '600', fontSize: 12 },
  detailBtn:          { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  detailBtnText:      { color: '#1a1a1a', fontWeight: '600', fontSize: 12 },
});