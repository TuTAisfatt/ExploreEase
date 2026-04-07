  import {
    collection, doc, getDocs, getDoc, addDoc,
    updateDoc, deleteDoc, query, orderBy,
    limit, startAfter, serverTimestamp, Timestamp,
    arrayUnion, arrayRemove, increment,
  } from 'firebase/firestore';
  import { db } from '../config/firebase';

  // ─────────────────────────────────────────────
  // 1. GET EVENTS WITH FILTERS
  // ─────────────────────────────────────────────
  export async function getEvents({ status, category, isFree, lastDoc } = {}) {
    try {
      let q = query(
        collection(db, 'events'),
        orderBy('startDate', 'asc'),
        limit(20)
      );

      if (lastDoc) q = query(q, startAfter(lastDoc));

      const snap = await getDocs(q);
      let items  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items = items.filter(e => e.approved === true);

      // Sort: upcoming first, then ongoing, then past
      const statusOrder = { incoming: 0, ongoing: 1, completed: 2 };
      items.sort((a, b) => statusOrder[computeStatus(a)] - statusOrder[computeStatus(b)]);

      // Client-side filters (Firestore doesn't support multiple where easily)
      if (status)               items = items.filter(e => computeStatus(e) === status);
      if (category)             items = items.filter(e => e.category === category);
      if (isFree !== undefined) items = items.filter(e => isFree ? e.price === 0 : e.price > 0);

      return {
        items,
        lastDoc: snap.docs[snap.docs.length - 1] ?? null,
      };
    } catch (e) {
      console.error('getEvents error:', e);
      return { items: [], lastDoc: null };
    }
  }

  // ─────────────────────────────────────────────
  // 2. GET SINGLE EVENT
  // ─────────────────────────────────────────────
  export async function getEvent(id) {
    const snap = await getDoc(doc(db, 'events', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  // ─────────────────────────────────────────────
  // 3. CREATE EVENT
  // ─────────────────────────────────────────────
  export async function createEvent(userId, data) {
    if (data.endDate <= data.startDate) {
      throw new Error('End date must be after start date.');
    }
    return addDoc(collection(db, 'events'), {
      ...data,
      organizerId: userId,
      approved:    false,
      attendees:   [],
      createdAt:   serverTimestamp(),
    });
  }

  // ─────────────────────────────────────────────
  // 4. UPDATE EVENT
  // ─────────────────────────────────────────────
  export async function updateEvent(eventId, userId, data) {
    const ref  = doc(db, 'events', eventId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().organizerId !== userId) {
      throw new Error('Not authorized.');
    }
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  }

  // ─────────────────────────────────────────────
  // 5. DELETE EVENT
  // ─────────────────────────────────────────────
  export async function deleteEvent(eventId, userId) {
    const ref  = doc(db, 'events', eventId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().organizerId !== userId) {
      throw new Error('Not authorized.');
    }
    await deleteDoc(ref);
  }

  // ─────────────────────────────────────────────
  // 6. JOIN / LEAVE EVENT
  // ─────────────────────────────────────────────
  export async function joinEvent(eventId, userId) {
    await updateDoc(doc(db, 'events', eventId), {
      attendees: arrayUnion(userId),
    });
  }

  export async function leaveEvent(eventId, userId) {
    await updateDoc(doc(db, 'events', eventId), {
      attendees: arrayRemove(userId),
    });
  }

  // ─────────────────────────────────────────────
  // 7. ADMIN: APPROVE / REJECT
  // ─────────────────────────────────────────────
  export async function setEventApproval(eventId, approved) {
    await updateDoc(doc(db, 'events', eventId), { approved });
  }

  // ─────────────────────────────────────────────
  // 8. COMPUTE STATUS FROM DATES
  // ─────────────────────────────────────────────
  export function computeStatus(event) {
    const now   = Date.now();
    const start = event.startDate?.toMillis?.() ?? event.startDate?.seconds * 1000 ?? 0;
    const end   = event.endDate?.toMillis?.()   ?? event.endDate?.seconds   * 1000 ?? 0;
    if (now < start) return 'incoming';
    if (now > end)   return 'completed';
    return 'ongoing';
  }

  // ─────────────────────────────────────────────
  // 9. SEED SAMPLE EVENTS
  // ─────────────────────────────────────────────
  export async function seedSampleEvents() {
    const existing = await getDocs(collection(db, 'events'));
    if (existing.docs.length > 0) {
      console.log('Events already seeded.');
      return;
    }

    const now = new Date();
    const h   = 60 * 60 * 1000;
    const d   = 24 * h;

    const samples = [
      // ── UPCOMING (5) ──────────────────────────────────────
      {
        title:       'Saigon Street Food Festival',
        category:    'food',
        description: 'A celebration of Ho Chi Minh City\'s vibrant street food culture. Try over 50 dishes from local vendors.',
        address:     'Nguyen Hue Walking Street, District 1',
        location:    { latitude: 10.7769, longitude: 106.7009 },
        imageUrl:    'https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775538923/saigonstreetfood_ojruua.jpg',
        price:       0,
        startDate:   Timestamp.fromDate(new Date(now.getTime() + 2 * d)),
        endDate:     Timestamp.fromDate(new Date(now.getTime() + 4 * d)),
        approved:    true,
        attendees:   [],
        organizerId: 'admin',
      },
      {
        title:       'Vietnam Cultural Night',
        category:    'culture',
        description: 'Experience traditional Vietnamese music, dance performances and art exhibitions.',
        address:     'Opera House, 7 Lam Son Square, District 1',
        location:    { latitude: 10.7797, longitude: 106.7030 },
        imageUrl:    'https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775538923/culturenight_xud73p.jpg',
        price:       50000,
        startDate:   Timestamp.fromDate(new Date(now.getTime() + 5 * d)),
        endDate:     Timestamp.fromDate(new Date(now.getTime() + 5 * d + 3 * h)),
        approved:    true,
        attendees:   [],
        organizerId: 'admin',
      },
      {
        title:       'Ben Thanh Night Market',
        category:    'shopping',
        description: 'Shop for souvenirs, clothing and local crafts at this famous night market.',
        address:     'Ben Thanh Market Area, District 1',
        location:    { latitude: 10.7725, longitude: 106.6980 },
        imageUrl:    'https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775538923/ben-thanh-night-market-3-1024x410_x8gxsd.jpg',
        price:       0,
        startDate:   Timestamp.fromDate(new Date(now.getTime() + 1 * d)),
        endDate:     Timestamp.fromDate(new Date(now.getTime() + 30 * d)),
        approved:    true,
        attendees:   [],
        organizerId: 'admin',
      },
      {
        title:       'Saigon Running Club',
        category:    'adventure',
        description: 'Join our weekly running group through the streets of District 1. All fitness levels welcome.',
        address:     'Tao Dan Park, District 1',
        location:    { latitude: 10.7751, longitude: 106.6889 },
        imageUrl:    'https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775538924/runclub_lrkfxl.jpg',
        price:       0,
        startDate:   Timestamp.fromDate(new Date(now.getTime() + 3 * d)),
        endDate:     Timestamp.fromDate(new Date(now.getTime() + 3 * d + 2 * h)),
        approved:    true,
        attendees:   [],
        organizerId: 'admin',
      },
      {
        title:       'Photography Walk: Old Saigon',
        category:    'culture',
        description: 'Guided photography walk through the historic streets of old Saigon with a professional photographer.',
        address:     'Dong Khoi Street, District 1',
        location:    { latitude: 10.7780, longitude: 106.7020 },
        imageUrl:    'https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775538923/oldsaigon_qmnbqz.jpg',
        price:       200000,
        startDate:   Timestamp.fromDate(new Date(now.getTime() + 7 * d)),
        endDate:     Timestamp.fromDate(new Date(now.getTime() + 7 * d + 3 * h)),
        approved:    true,
        attendees:   [],
        organizerId: 'admin',
      },

      // ── ONGOING (2) ───────────────────────────────────────
      {
        title:       'Mekong Delta Day Tour',
        category:    'adventure',
        description: 'Explore the stunning Mekong Delta waterways, local villages and floating markets.',
        address:     'Ben Tre Province, Mekong Delta',
        location:    { latitude: 10.2417, longitude: 106.3756 },
        imageUrl:    'https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775538923/MekongDelta_v9ebgq.jpg',
        price:       350000,
        startDate:   Timestamp.fromDate(new Date(now.getTime() - 1 * d)),
        endDate:     Timestamp.fromDate(new Date(now.getTime() + 2 * d)),
        approved:    true,
        attendees:   [],
        organizerId: 'admin',
      },
      {
        title:       'Ao Dai Fashion Exhibition',
        category:    'culture',
        description: 'A stunning showcase of Vietnam\'s iconic Ao Dai dress through the centuries, featuring modern and traditional designs.',
        address:     'Ho Chi Minh City Museum, District 1',
        location:    { latitude: 10.7743, longitude: 106.6988 },
        imageUrl:    'https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775538922/Aodai_asuzzw.jpg',
        price:       80000,
        startDate:   Timestamp.fromDate(new Date(now.getTime() - 3 * d)),
        endDate:     Timestamp.fromDate(new Date(now.getTime() + 4 * d)),
        approved:    true,
        attendees:   [],
        organizerId: 'admin',
      },

      // ── PAST (2) ──────────────────────────────────────────
      {
        title:       'Tet Lantern Festival 2025',
        category:    'culture',
        description: 'Celebrate Vietnamese New Year with thousands of colorful lanterns lighting up the Saigon River.',
        address:     'Saigon River Promenade, District 1',
        location:    { latitude: 10.7800, longitude: 106.7050 },
        imageUrl:    'https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775538924/TetLantern_asi8nf.jpg',
        price:       0,
        startDate:   Timestamp.fromDate(new Date(now.getTime() - 10 * d)),
        endDate:     Timestamp.fromDate(new Date(now.getTime() - 8 * d)),
        approved:    true,
        attendees:   [],
        organizerId: 'admin',
      },
      {
        title:       'Saigon Coffee & Arts Fair',
        category:    'food',
        description: 'A weekend fair celebrating Saigon\'s thriving coffee culture alongside local art, music and craft vendors.',
        address:     '23/9 Park, District 1',
        location:    { latitude: 10.7695, longitude: 106.6955 },
        imageUrl:    'https://res.cloudinary.com/dpmtwyqg6/image/upload/v1775538924/ArtFair_rbljfj.png',
        price:       0,
        startDate:   Timestamp.fromDate(new Date(now.getTime() - 15 * d)),
        endDate:     Timestamp.fromDate(new Date(now.getTime() - 13 * d)),
        approved:    true,
        attendees:   [],
        organizerId: 'admin',
      },
    ];

    for (const event of samples) {
      await addDoc(collection(db, 'events'), event);
    }
    console.log('✅ Sample events seeded!');
  }
