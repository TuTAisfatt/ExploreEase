import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { getNotifications } from '../services/notificationService';
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
import CreateEventScreen from '../screens/events/CreateEventScreen';

// ── Notifications screen ──
import NotificationsScreen from '../screens/notifications/NotificationsScreen';

// ── Auth & Profile screens (fully built) ──
import ProfileScreen     from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import GDPRScreen        from '../screens/profile/GDPRScreen';
import AdminDashboard    from '../screens/admin/AdminDashboard';

// ── Placeholder for screens not built yet ──
function Placeholder({ route }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' }}>
      <Text style={{ fontSize: 32, marginBottom: 12 }}>🚧</Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a1a' }}>
        {route.name}
      </Text>
      <Text style={{ fontSize: 14, color: '#aaa', marginTop: 6 }}>
        Coming soon
      </Text>
    </View>
  );
}

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

function DiscoverStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home"   component={HomeScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Map"    component={MapScreen} />
      <Stack.Screen name="Detail" component={DetailScreen} />
    </Stack.Navigator>
  );
}

function EventsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EventsHome"  component={EventsScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
    </Stack.Navigator>
  );
}

function SocialStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SocialFeed" component={Placeholder} />
      <Stack.Screen name="SocialChat" component={Placeholder} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome"     component={ProfileScreen} />
      <Stack.Screen name="EditProfile"     component={EditProfileScreen} />
      <Stack.Screen name="GDPR"            component={GDPRScreen} />
      <Stack.Screen name="AdminDashboard"  component={AdminDashboard} />
    </Stack.Navigator>
  );
}

export default function MainTabNavigator() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    // Fetch immediately
    getNotifications(user.uid).then(notifs => {
      setUnreadCount(notifs.filter(n => !n.read).length);
    });
    // Then poll every 5 seconds
    const interval = setInterval(() => {
      getNotifications(user.uid).then(notifs => {
        setUnreadCount(notifs.filter(n => !n.read).length);
      });
    }, 5000);
    return () => clearInterval(interval);
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
          : undefined,
      })}
    >
      <Tab.Screen name="Discover"      component={DiscoverStack} />
      <Tab.Screen name="Events"        component={EventsStack} />
      <Tab.Screen name="Social"        component={SocialStack} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile"       component={ProfileStack} />
    </Tab.Navigator>
  );
}