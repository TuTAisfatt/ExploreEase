import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Linking,
  Platform, FlatList,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { getReviews, addReview, flagReview } from '../../services/reviewService';
import { addBookmark, removeBookmark, getBookmarks } from '../../services/userService';
import { formatDistance, getDistance } from '../../services/locationService';
import { useLocation } from '../../hooks/useLocation';
import StarRating from '../../components/StarRating';

export default function DetailScreen({ route, navigation }) {
  const { itemId, type } = route.params;
  const { user, userProfile } = useAuth();
  const { region } = useLocation();

  const [item,        setItem]        = useState(null);
  const [reviews,     setReviews]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [bookmarked,  setBookmarked]  = useState(false);
  const [myRating,    setMyRating]    = useState(0);
  const [reviewText,  setReviewText]  = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [reviewsSort, setReviewsSort] = useState('newest');

  // ── Load attraction + reviews + bookmark status ──────────
  useEffect(() => {
    (async () => {
      try {
        const collectionName = type === 'attraction' ? 'attractions' : 'events';
        const snap = await getDoc(doc(db, collectionName, itemId));
        if (snap.exists()) setItem({ id: snap.id, ...snap.data() });

        const { items } = await getReviews({ targetId: itemId, sortBy: reviewsSort });
        setReviews(items);

        if (user) {
          const bookmarks = await getBookmarks(user.uid);
          setBookmarked(bookmarks.some(b => b.itemId === itemId));
        }
      } catch (e) {
        console.error('Detail load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [itemId]);

  // ── Reload reviews when sort changes ─────────────────────
  useEffect(() => {
    if (!itemId) return;
    getReviews({ targetId: itemId, sortBy: reviewsSort })
      .then(({ items }) => setReviews(items))
      .catch(console.error);
  }, [reviewsSort]);

  // ── Bookmark toggle ───────────────────────────────────────
  async function handleBookmark() {
    if (!user) return Alert.alert('Sign in required');
    try {
      if (bookmarked) {
        await removeBookmark(user.uid, itemId);
      } else {
        await addBookmark(user.uid, itemId, type);
      }
      setBookmarked(!bookmarked);
    } catch (e) {
      Alert.alert('Error', 'Could not update bookmark.');
    }
  }

  // ── Get directions via Google Maps ────────────────────────
  function handleDirections() {
    if (!item?.location) return;
    const lat = item.location.latitude  ?? item.location._lat;
    const lng = item.location.longitude ?? item.location._long;
    const url = Platform.select({
      ios:     `maps://app?daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url).catch(() =>
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      )
    );
  }

  // ── Submit review ─────────────────────────────────────────
  async function handleSubmitReview() {
    if (myRating === 0) {
      return Alert.alert('Rating required', 'Please select a star rating.');
    }
    if (!reviewText.trim()) {
      return Alert.alert('Review required', 'Please write a short review.');
    }
    setSubmitting(true);
    try {
      await addReview({
        targetId:   itemId,
        targetType: type,
        userId:     user.uid,
        userName:   userProfile?.name ?? 'Anonymous',
        rating:     myRating,
        text:       reviewText.trim(),
      });
      // Refresh reviews
      const { items } = await getReviews({ targetId: itemId, sortBy: reviewsSort });
      setReviews(items);
      // Refresh item to get updated rating
      const collectionName = type === 'attraction' ? 'attractions' : 'events';
      const snap = await getDoc(doc(db, collectionName, itemId));
      if (snap.exists()) setItem({ id: snap.id, ...snap.data() });

      setMyRating(0);
      setReviewText('');
      Alert.alert('Thanks!', 'Your review has been posted.');
    } catch (e) {
      Alert.alert('Error', 'Could not post review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Flag review ───────────────────────────────────────────
  async function handleFlagReview(reviewId) {
    Alert.alert(
      'Report review',
      'Are you sure you want to report this review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            await flagReview(reviewId);
            Alert.alert('Reported', 'Thank you. We will review this.');
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1D9E75" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Place not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const avgRating = item.reviewCount
    ? (item.ratingSum / item.reviewCount)
    : 0;

  const distanceText = region && item.location
    ? formatDistance(getDistance(
        region.latitude, region.longitude,
        item.location.latitude  ?? item.location._lat,
        item.location.longitude ?? item.location._long,
      ))
    : null;

  return (
    <ScrollView
      style={styles.root}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero image ── */}
      <View style={styles.heroWrap}>
        {item.images?.[0] ? (
          <Image
            source={{ uri: item.images[0] }}
            style={styles.hero}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]}>
            <Text style={{ fontSize: 64 }}>🏙️</Text>
          </View>
        )}

        {/* Floating back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>

        {/* Bookmark button */}
        <TouchableOpacity
          style={styles.bookmarkBtn}
          onPress={handleBookmark}
        >
          <Text style={styles.bookmarkIcon}>
            {bookmarked ? '🔖' : '🏷️'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* ── Title + category ── */}
        <View style={styles.titleRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>
              {item.category ?? 'Place'}
            </Text>
          </View>
          {distanceText && (
            <Text style={styles.distanceText}>📏 {distanceText}</Text>
          )}
        </View>

        <Text style={styles.name}>{item.name ?? item.title}</Text>

        {item.address && (
          <Text style={styles.address}>📍 {item.address}</Text>
        )}

        {/* ── Rating summary ── */}
        {item.reviewCount > 0 && (
          <View style={styles.ratingRow}>
            <StarRating rating={avgRating} size={18} />
            <Text style={styles.ratingText}>
              {avgRating.toFixed(1)} · {item.reviewCount} review{item.reviewCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* ── Info grid ── */}
        <View style={styles.infoGrid}>
          {item.hours && (
            <InfoItem icon="🕐" label="Hours" value={item.hours} />
          )}
          {item.priceLevel !== undefined && (
            <InfoItem
              icon="💰"
              label="Price"
              value={item.priceLevel === 0 ? 'Free' : '$'.repeat(item.priceLevel)}
            />
          )}
        </View>

        {/* ── Description ── */}
        {item.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}

        {/* ── Action buttons ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.directionsBtn}
            onPress={handleDirections}
          >
            <Text style={styles.directionsBtnText}>🧭  Get directions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => Alert.alert('Share', 'Share feature coming soon!')}
          >
            <Text style={styles.shareBtnText}>↑ Share</Text>
          </TouchableOpacity>
        </View>

        {/* ── Reviews section ── */}
        <View style={styles.section}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            {/* Sort options */}
            <View style={styles.sortRow}>
              {['newest', 'top-rated'].map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.sortChip,
                    reviewsSort === opt && styles.sortChipActive,
                  ]}
                  onPress={() => setReviewsSort(opt)}
                >
                  <Text style={[
                    styles.sortChipText,
                    reviewsSort === opt && styles.sortChipTextActive,
                  ]}>
                    {opt === 'newest' ? 'Newest' : 'Top rated'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Write a review */}
          {user && (
            <View style={styles.writeReview}>
              <Text style={styles.writeReviewTitle}>Write a review</Text>
              <StarRating
                rating={myRating}
                onRate={setMyRating}
                size={28}
              />
              <View style={styles.reviewInputWrap}>
                <Text
                  style={styles.reviewInput}
                  onPress={() =>
                    Alert.prompt
                      ? Alert.prompt(
                          'Your review',
                          '',
                          text => setReviewText(text),
                          'plain-text',
                          reviewText
                        )
                      : null
                  }
                >
                  {reviewText || (
                    <Text style={{ color: '#aaa' }}>
                      Share your experience...
                    </Text>
                  )}
                </Text>
              </View>
              {/* Simple text input for cross-platform */}
              <ReviewTextInput
                value={reviewText}
                onChange={setReviewText}
              />
              <TouchableOpacity
                style={[
                  styles.submitReviewBtn,
                  (!myRating || !reviewText.trim()) && styles.submitReviewBtnDisabled,
                ]}
                onPress={handleSubmitReview}
                disabled={submitting || !myRating || !reviewText.trim()}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.submitReviewBtnText}>Post review</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Reviews list */}
          {reviews.length === 0 ? (
            <View style={styles.noReviews}>
              <Text style={styles.noReviewsText}>
                No reviews yet. Be the first!
              </Text>
            </View>
          ) : (
            reviews.map(review => (
              <ReviewItem
                key={review.id}
                review={review}
                onFlag={() => handleFlagReview(review.id)}
              />
            ))
          )}
        </View>

      </View>
    </ScrollView>
  );
}

// ── Review text input (cross-platform) ───────────────────
import { TextInput } from 'react-native';

function ReviewTextInput({ value, onChange }) {
  return (
    <TextInput
      style={styles.reviewTextInput}
      placeholder="Share your experience..."
      placeholderTextColor="#aaa"
      multiline
      numberOfLines={3}
      value={value}
      onChangeText={onChange}
      textAlignVertical="top"
    />
  );
}

// ── Info item ─────────────────────────────────────────────
function InfoItem({ icon, label, value }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Review item ───────────────────────────────────────────
function ReviewItem({ review, onFlag }) {
  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAvatar}>
          <Text style={styles.reviewAvatarText}>
            {review.userName?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewName}>{review.userName}</Text>
          <StarRating rating={review.rating} size={13} />
        </View>
        <TouchableOpacity onPress={onFlag} style={styles.flagBtn}>
          <Text style={styles.flagBtnText}>⚑</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.reviewText}>{review.text}</Text>
      {review.reply && (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Reply from owner:</Text>
          <Text style={styles.replyText}>{review.reply}</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: '#f9fafb' },
  centered:         { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  notFoundText:     { fontSize: 16, color: '#888' },
  backLink:         { color: '#1D9E75', fontSize: 15, fontWeight: '600' },

  heroWrap:         { position: 'relative' },
  hero:             { width: '100%', height: 280 },
  heroPlaceholder:  { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  backBtn:          { position: 'absolute', top: 52, left: 20, backgroundColor: '#fff', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  backBtnText:      { fontSize: 20, color: '#1a1a1a' },
  bookmarkBtn:      { position: 'absolute', top: 52, right: 20, backgroundColor: '#fff', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  bookmarkIcon:     { fontSize: 20 },

  body:             { padding: 20 },
  titleRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  categoryBadge:    { backgroundColor: '#E1F5EE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  categoryBadgeText: { color: '#0F6E56', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  distanceText:     { fontSize: 13, color: '#888' },

  name:             { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  address:          { fontSize: 14, color: '#888', marginBottom: 12 },

  ratingRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  ratingText:       { fontSize: 14, color: '#555', fontWeight: '500' },

  infoGrid:         { flexDirection: 'row', gap: 12, marginBottom: 20 },
  infoItem:         { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  infoIcon:         { fontSize: 20 },
  infoLabel:        { fontSize: 11, color: '#aaa', fontWeight: '600' },
  infoValue:        { fontSize: 14, color: '#1a1a1a', fontWeight: '600' },

  section:          { marginBottom: 24 },
  sectionTitle:     { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  description:      { fontSize: 14, color: '#555', lineHeight: 22 },

  actionRow:        { flexDirection: 'row', gap: 10, marginBottom: 24 },
  directionsBtn:    { flex: 1, backgroundColor: '#1D9E75', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  directionsBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  shareBtn:         { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  shareBtnText:     { color: '#1a1a1a', fontWeight: '600', fontSize: 14 },

  reviewsHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sortRow:          { flexDirection: 'row', gap: 6 },
  sortChip:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e8e8e8' },
  sortChipActive:   { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  sortChipText:     { fontSize: 12, color: '#555' },
  sortChipTextActive: { color: '#fff', fontWeight: '600' },

  writeReview:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f0f0f0', gap: 12 },
  writeReviewTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  reviewInputWrap:  { display: 'none' },
  reviewInput:      { display: 'none' },
  reviewTextInput:  { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a1a', minHeight: 80 },
  submitReviewBtn:  { backgroundColor: '#1D9E75', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitReviewBtnDisabled: { backgroundColor: '#a0d4c0' },
  submitReviewBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  noReviews:        { alignItems: 'center', paddingVertical: 24 },
  noReviewsText:    { color: '#aaa', fontSize: 14 },

  reviewItem:       { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  reviewHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  reviewAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  reviewAvatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  reviewMeta:       { flex: 1, gap: 2 },
  reviewName:       { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  flagBtn:          { padding: 4 },
  flagBtnText:      { fontSize: 16, color: '#ccc' },
  reviewText:       { fontSize: 14, color: '#555', lineHeight: 20 },
  replyBox:         { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginTop: 10, borderLeftWidth: 3, borderLeftColor: '#1D9E75', borderRadius: 0 },
  replyLabel:       { fontSize: 12, fontWeight: '700', color: '#1D9E75', marginBottom: 4 },
  replyText:        { fontSize: 13, color: '#555' },
});