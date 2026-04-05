import { useState, useEffect } from 'react';
import { getCurrentLocation, DEFAULT_REGION } from '../services/locationService';

export function useLocation() {
  const [region,       setRegion]       = useState(null);
  const [granted,      setGranted]      = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [errorMsg,     setErrorMsg]     = useState(null);

  // Manual override — lets user set a custom location
  // for future trip planning (requirement 2.1)
  const [manualRegion, setManualRegion] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await getCurrentLocation();
        setGranted(result.granted);
        setRegion(result.region);

        if (!result.granted) {
          setErrorMsg('Location permission denied. Showing default area.');
        }
      } catch (e) {
        setErrorMsg('Could not get location. Showing default area.');
        setRegion(DEFAULT_REGION);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Override location manually (for future planning feature)
  function overrideLocation(newRegion) {
    setManualRegion(newRegion);
  }

  function clearOverride() {
    setManualRegion(null);
  }

  // If user set a manual override, use that — otherwise use GPS
  const activeRegion = manualRegion ?? region ?? DEFAULT_REGION;

  return {
    region:          activeRegion,
    granted,
    loading,
    errorMsg,
    isManual:        !!manualRegion,
    overrideLocation,
    clearOverride,
  };
}