import { useEffect, useState } from 'react';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// ── Discovery screens ──
import HomeScreen   from '../screens/discovery/HomeScreen';
import MapScreen    from '../screens/discovery/MapScreen';
import SearchScreen from '../screens/discovery/SearchScreen';
import DetailScreen from '../screens/discovery/DetailScreen';

// ── Events screens ──
import EventsScreen      from '../screens/events/EventsScreen';
import EventDetailScreen from '../screens/events/EventDetailScreen';
import CreateEventScreen      from '../screens/events/CreateEventScreen';
import CreateAttractionScreen from '../screens/discovery/CreateAttractionScreen';

// ── Notifications screen ──
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ItineraryScreen     from '../screens/travel/ItineraryScreen';

// ── Social screens ──
import FeedScreen        from '../screens/social/FeedScreen';
import ChatScreen        from '../screens/social/ChatScreen';
import MessagesScreen    from '../screens/social/MessagesScreen';
import GroupChatScreen   from '../screens/social/GroupChatScreen';
import FollowListScreen  from '../screens/social/FollowListScreen';
import PrivateChatScreen from '../screens/social/PrivateChatScreen';
import EventChatScreen   from '../screens/social/EventChatScreen';

// ── Auth & Profile screens (fully built) ──
import ProfileScreen     from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import GDPRScreen        from '../screens/profile/GDPRScreen';
import AdminDashboard           from '../screens/admin/AdminDashboard';
import OrganizerRequestScreen   from '../screens/profile/OrganizerRequestScreen';


const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

function DiscoverStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home"             component={HomeScreen} />
      <Stack.Screen name="Search"           component={SearchScreen} />
      <Stack.Screen name="Map"              component={MapScreen} />
      <Stack.Screen name="Detail"           component={DetailScreen} />
      <Stack.Screen name="CreateAttraction" component={CreateAttractionScreen} />
    </Stack.Navigator>
  );
}

function EventsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EventsHome"  component={EventsScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="EventChat"   component={EventChatScreen} />
    </Stack.Navigator>
  );
}


function SocialStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SocialFeed"   component={FeedScreen} />
      <Stack.Screen name="SocialChat"   component={ChatScreen} />
      <Stack.Screen name="Messages"     component={MessagesScreen} />
      <Stack.Screen name="GroupChat"    component={GroupChatScreen} />
      <Stack.Screen name="FollowList"   component={FollowListScreen} />
      <Stack.Screen name="PrivateChat"  component={PrivateChatScreen} />
    </Stack.Navigator>
  );
}

function TravelStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Itinerary" component={ItineraryScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome"     component={ProfileScreen} />
      <Stack.Screen name="EditProfile"     component={EditProfileScreen} />
      <Stack.Screen name="GDPR"            component={GDPRScreen} />
      <Stack.Screen name="AdminDashboard"    component={AdminDashboard} />
      <Stack.Screen name="OrganizerRequest"  component={OrganizerRequestScreen} />
      <Stack.Screen name="FollowList"        component={FollowListScreen} />
    </Stack.Navigator>
  );
}

export default function MainTabNavigator() {
  const { user } = useAuth();
  const [unreadCount,    setUnreadCount]    = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );
    return onSnapshot(q, snap => setUnreadCount(snap.size));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'privateChats'),
      where('participants', 'array-contains', user.uid)
    );
    return onSnapshot(q, snap => {
      const total = snap.docs.reduce(
        (sum, d) => sum + (d.data().unreadCount?.[user.uid] ?? 0), 0
      );
      setUnreadMsgCount(total);
    });
  }, [user]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   '#1D9E75',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0.5,
          borderTopColor: '#e0e0e0',
          height: 60,
          paddingBottom: 8,
        },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Discover:      'compass-outline',
            Events:        'calendar-outline',
            Social:        'people-outline',
            Travel:        'map-outline',
            Notifications: 'notifications-outline',
            Profile:       'person-outline',
          };
          return (
            <Ionicons
              name={icons[route.name] ?? 'ellipse-outline'}
              size={size}
              color={color}
            />
          );
        },
        tabBarBadge: route.name === 'Notifications' && unreadCount > 0
          ? unreadCount
          : route.name === 'Social' && unreadMsgCount > 0
          ? unreadMsgCount
          : undefined,
      })}
    >
      <Tab.Screen name="Discover"      component={DiscoverStack} />
      <Tab.Screen name="Events"        component={EventsStack} />
      <Tab.Screen name="Social"        component={SocialStack} />
      <Tab.Screen name="Travel"        component={TravelStack} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile"       component={ProfileStack} />
    </Tab.Navigator>
  );
}