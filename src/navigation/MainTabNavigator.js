import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// ── Discovery screens ──
import HomeScreen   from '../screens/discovery/HomeScreen';
import MapScreen    from '../screens/discovery/MapScreen';
import SearchScreen from '../screens/discovery/SearchScreen';
import DetailScreen from '../screens/discovery/DetailScreen';

// ── Auth & Profile screens (fully built) ──
import ProfileScreen     from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import GDPRScreen        from '../screens/profile/GDPRScreen';

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
      <Stack.Screen name="Events"      component={Placeholder} />
      <Stack.Screen name="EventDetail" component={Placeholder} />
      <Stack.Screen name="CreateEvent" component={Placeholder} />
    </Stack.Navigator>
  );
}

function SocialStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Feed" component={Placeholder} />
      <Stack.Screen name="Chat" component={Placeholder} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome"  component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="GDPR"        component={GDPRScreen} />
    </Stack.Navigator>
  );
}

export default function MainTabNavigator() {
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
      })}
    >
      <Tab.Screen name="Discover"      component={DiscoverStack} />
      <Tab.Screen name="Events"        component={EventsStack} />
      <Tab.Screen name="Social"        component={SocialStack} />
      <Tab.Screen name="Notifications" component={Placeholder} />
      <Tab.Screen name="Profile"       component={ProfileStack} />
    </Tab.Navigator>
  );
}