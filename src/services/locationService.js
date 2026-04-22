import * as Location from 'expo-location';
import { collection, addDoc, getDocs, query, where, orderBy, limit, GeoPoint } from 'firebase/firestore';
import { db } from '../config/firebase';

// Default location — Ho Chi Minh City
export const DEFAULT_REGION = {
  latitude:       10.8231,
  longitude:      106.6297,
  latitudeDelta:  0.05,
  longitudeDelta: 0.05,
};

// ─────────────────────────────────────────────
// 1. REQUEST LOCATION PERMISSION & GET LOCATION
// ─────────────────────────────────────────────
export async function getCurrentLocation() {
  // Request foreground permission (handles Android 12+ properly)
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    // Permission denied — return default location silently
    return {
      granted: false,
      region:  DEFAULT_REGION,
    };
  }

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    granted: true,
    region: {
      latitude:       loc.coords.latitude,
      longitude:      loc.coords.longitude,
      latitudeDelta:  0.05,
      longitudeDelta: 0.05,
    },
  };
}

// ─────────────────────────────────────────────
// 2. CALCULATE DISTANCE BETWEEN TWO POINTS
// Uses Haversine formula — returns distance in km
// ─────────────────────────────────────────────
export function getDistance(lat1, lon1, lat2, lon2) {
  const R    = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a    =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Format distance nicely: "0.3 km" or "1.2 km"
export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// ─────────────────────────────────────────────
// 3. GET NEARBY ATTRACTIONS FROM FIRESTORE
// ─────────────────────────────────────────────
export async function getNearbyAttractions(latitude, longitude, radiusKm = 50) {
  // Firestore doesn't support geo queries natively
  // We use a bounding box then filter by exact distance
  const delta = radiusKm / 111; // ~111 km per degree of latitude

  const latMin = latitude  - delta;
  const latMax = latitude  + delta;

  // Fetch all attractions (for small datasets this is fine)
  // For large datasets you would use GeoFirestore or Algolia
  const snap = await getDocs(collection(db, 'attractions'));

  const nearby = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => {
      if (a.approved === false && a.createdBy) return false;
      if (!a.location) return true;
      const lat = a.location.latitude  ?? a.location._lat;
      const lng = a.location.longitude ?? a.location._long;
      const dist = getDistance(latitude, longitude, lat, lng);
      return dist <= radiusKm;
    })
    .map(a => {
      if (!a.location) return { ...a, distance: 999 };
      const lat = a.location.latitude  ?? a.location._lat;
      const lng = a.location.longitude ?? a.location._long;
      return {
        ...a,
        distance: getDistance(latitude, longitude, lat, lng),
      };
    })
    .sort((a, b) => a.distance - b.distance);

  return nearby;
}

// ─────────────────────────────────────────────
// 4. SEED SAMPLE ATTRACTIONS (run once to populate Firestore)
// Call this from a dev screen or the console to add test data
// ─────────────────────────────────────────────
export async function seedSampleAttractions() {
  // Check if already seeded — if attractions exist, don't add again
  const existing = await getDocs(collection(db, 'attractions'));
  if (existing.docs.length > 0) {
    console.log('⚠️ Attractions already seeded, skipping.');
    return;
  }

  const samples = [
    {
      name:        'Ben Thanh Market',
      nameLower:   'ben thanh market',
      category:    'shopping',
      description: 'Iconic market in the heart of Ho Chi Minh City with food, clothing and souvenirs.',
      address:     'Le Loi, Ben Thanh, District 1, Ho Chi Minh City',
      location:    new GeoPoint(10.7725, 106.6980),
      images:      ['https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775397615/Ben-Thanh-Market-Ho-Chi-Minh-2472437527_jzmhgf.jpg'],
      ratingSum:   42,
      reviewCount: 9,
      priceLevel:  1,
      hours:       '6:00 AM – 6:00 PM',
      tags:        ['market', 'food', 'shopping'],
    },
    {
      name:        'Notre-Dame Cathedral',
      nameLower:   'notre-dame cathedral',
      category:    'culture',
      description: 'Beautiful French colonial cathedral built in the 19th century.',
      address:     '01 Công xã Paris, Bến Nghé, District 1',
      location:    new GeoPoint(10.7797, 106.6990),
      images:      ['https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775397614/shutterstock_372885541-369418311_bxtzye.jpg'],
      ratingSum:   44,
      reviewCount: 10,
      priceLevel:  0,
      hours:       '8:00 AM – 5:00 PM',
      tags:        ['church', 'history', 'culture'],
    },
    {
      name:        'War Remnants Museum',
      nameLower:   'war remnants museum',
      category:    'culture',
      description: 'Powerful museum documenting the Vietnam War with photos and artifacts.',
      address:     '28 Vo Van Tan, Ward 6, District 3',
      location:    new GeoPoint(10.7793, 106.6920),
      images:      ['https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775397614/WarRemnantsMuseumHoChiMinhCityVietFunTravel-3057137227_kk77rh.jpg'],
      ratingSum:   48,
      reviewCount: 10,
      priceLevel:  1,
      hours:       '7:30 AM – 6:00 PM',
      tags:        ['museum', 'history', 'culture'],
    },
    {
      name:        'Bui Vien Walking Street',
      nameLower:   'bui vien walking street',
      category:    'food',
      description: 'Vibrant street famous for nightlife, street food and backpacker culture.',
      address:     'Bui Vien, Pham Ngu Lao, District 1',
      location:    new GeoPoint(10.7672, 106.6930),
      images:      ['https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775397615/bui-vien-walking-street-1-529757429_lahjle.jpg'],
      ratingSum:   36,
      reviewCount: 8,
      priceLevel:  1,
      hours:       '5:00 PM – 2:00 AM',
      tags:        ['nightlife', 'food', 'street'],
    },
    {
      name:        'Reunification Palace',
      nameLower:   'reunification palace',
      category:    'culture',
      description: 'Historic government palace that played a key role in the fall of Saigon.',
      address:     '135 Nam Ky Khoi Nghia, Ben Thanh, District 1',
      location:    new GeoPoint(10.7769, 106.6956),
      images:      ['https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775397614/maxresdefault-1591885410_eh50zn.jpg'],
      ratingSum:   45,
      reviewCount: 10,
      priceLevel:  1,
      hours:       '8:00 AM – 4:00 PM',
      tags:        ['history', 'culture', 'palace'],
    },
    {
      name:        'Jade Emperor Pagoda',
      nameLower:   'jade emperor pagoda',
      category:    'culture',
      description: 'Taoist temple built in 1909, one of the most beautiful pagodas in Ho Chi Minh City.',
      address:     '73 Mai Thi Luu, Da Kao, District 1',
      location:    new GeoPoint(10.7880, 106.6950),
      images:      ['https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775556267/Jade-Emperor-Pagoda-in-Ho-Chi-Minh-3066241032_erdgfi.jpg'],
      ratingSum:   44,
      reviewCount: 10,
      priceLevel:  0,
      hours:       '7:00 AM – 6:00 PM',
      tags:        ['temple', 'culture', 'religion'],
    },
    {
      name:        'Bitexco Financial Tower',
      nameLower:   'bitexco financial tower',
      category:    'culture',
      description: 'Iconic 68-floor skyscraper with a helipad and observation deck overlooking the city.',
      address:     '2 Hai Trieu, Ben Nghe, District 1',
      location:    new GeoPoint(10.7715, 106.7048),
      images:      ['https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775556268/bitexco_es1ndp.jpg'],
      ratingSum:   40,
      reviewCount: 9,
      priceLevel:  2,
      hours:       '9:30 AM – 9:30 PM',
      tags:        ['skyscraper', 'views', 'landmark'],
    },
    {
      name:        'Saigon Central Post Office',
      nameLower:   'saigon central post office',
      category:    'culture',
      description: 'Stunning French colonial post office designed by Gustave Eiffel, still in operation today.',
      address:     '2 Cong xa Paris, Ben Nghe, District 1',
      location:    new GeoPoint(10.7800, 106.6990),
      images:      ['https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775556269/saigon-central-post-office-_a3grkw.jpg'],
      ratingSum:   43,
      reviewCount: 10,
      priceLevel:  0,
      hours:       '7:00 AM – 7:00 PM',
      tags:        ['colonial', 'architecture', 'culture'],
    },
    {
      name:        'Thu Duc Market',
      nameLower:   'thu duc market',
      category:    'shopping',
      description: 'Bustling local market in Thu Duc offering fresh produce, street food and everyday goods.',
      address:     'Le Van Viet, Thu Duc City',
      location:    new GeoPoint(10.8500, 106.7700),
      images:      ['https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775556269/Thu-Duc-Market-910040268_r2etmy.jpg'],
      ratingSum:   34,
      reviewCount: 8,
      priceLevel:  1,
      hours:       '5:00 AM – 6:00 PM',
      tags:        ['market', 'local', 'shopping'],
    },
    {
      name:        'Tao Dan Park',
      nameLower:   'tao dan park',
      category:    'nature',
      description: 'Beautiful urban park in District 1, popular for morning exercise and relaxation.',
      address:     '55C Nguyen Thi Minh Khai, District 1',
      location:    new GeoPoint(10.7760, 106.6889),
      images:      ['https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775556268/tao-dan-park-1-1918998171_kbgwa3.jpg'],
      ratingSum:   38,
      reviewCount: 9,
      priceLevel:  0,
      hours:       '6:00 AM – 9:00 PM',
      tags:        ['park', 'nature', 'relax'],
    },
    {
      name:        'Ho Chi Minh City Museum',
      nameLower:   'ho chi minh city museum',
      category:    'culture',
      description: 'Former Gia Long Palace housing exhibits on the history and culture of Ho Chi Minh City.',
      address:     '65 Ly Tu Trong, Ben Nghe, District 1',
      location:    new GeoPoint(10.7743, 106.6988),
      images:      ['https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775556268/ho-chi-minh-city-museum-gia-long-palace-2-1024x684-2046343735_nhooeo.jpg'],
      ratingSum:   41,
      reviewCount: 10,
      priceLevel:  1,
      hours:       '8:00 AM – 5:00 PM',
      tags:        ['museum', 'history', 'culture'],
    },
  ];

  for (const attraction of samples) {
    await addDoc(collection(db, 'attractions'), attraction);
  }

  console.log('✅ Sample attractions seeded!');
}