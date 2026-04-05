export const COLORS = {
  primary: '#2E86AB',
  secondary: '#F18F01',
  background: '#F5F5F5',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#9E9E9E',
  lightGray: '#E0E0E0',
  error: '#D32F2F',
  success: '#388E3C',
  text: '#212121',
  textSecondary: '#757575',
};

export const FONTS = {
  regular: 'System',
  bold: 'System',
};

export const SIZES = {
  xsmall: 10,
  small: 12,
  medium: 14,
  large: 16,
  xlarge: 18,
  xxlarge: 24,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const ATTRACTION_CATEGORIES = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'restaurant', label: 'Restaurants', icon: 'restaurant' },
  { id: 'hotel', label: 'Hotels', icon: 'hotel' },
  { id: 'museum', label: 'Museums', icon: 'museum' },
  { id: 'park', label: 'Parks', icon: 'park' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping-bag' },
  { id: 'entertainment', label: 'Entertainment', icon: 'local-movies' },
];

export const DEFAULT_LOCATION = {
  latitude: 10.8231,
  longitude: 106.6297,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

export const INTEREST_TAGS = [
  { id: 'food',      label: '🍜 Food'      },
  { id: 'culture',   label: '🏛️ Culture'   },
  { id: 'shopping',  label: '🛍️ Shopping'  },
  { id: 'nature',    label: '🌿 Nature'    },
  { id: 'adventure', label: '⛺ Adventure' },
];

export const TRAVEL_STYLES = [
  { id: 'solo',   label: 'Solo traveler' },
  { id: 'couple', label: 'Couple'        },
  { id: 'family', label: 'Family'        },
  { id: 'group',  label: 'Group'         },
];

export const PAGINATION_LIMIT = 10;
