import { useState, useEffect } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useLocation } from './useLocation';
import {
  getRecommendations,
  getSeasonalContext,
} from '../services/recommendationService';

export function useRecommendations() {
  const { userProfile } = useAuth();
  const { region } = useLocation();

  const [recommendations, setRecommendations] = useState([]);
  const [allAttractions,  setAllAttractions]  = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [seasonalContext, setSeasonalContext] = useState(null);

  // ── Load all attractions once ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'attractions'));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllAttractions(data);
      } catch (e) {
        console.error('Failed to load attractions:', e);
      }
    })();
  }, []);

  // ── Generate recommendations when we have everything ────
  useEffect(() => {
    if (!userProfile || allAttractions.length === 0) return;

    (async () => {
      setLoading(true);
      try {
        const recs = await getRecommendations({
          userProfile,
          userLat:        region?.latitude,
          userLng:        region?.longitude,
          allAttractions,
          limit:          10,
        });
        setRecommendations(recs);
        setSeasonalContext(getSeasonalContext());
      } catch (e) {
        console.error('Recommendation error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile, allAttractions, region]);

  return {
    recommendations,
    allAttractions,
    loading,
    seasonalContext,
  };
}