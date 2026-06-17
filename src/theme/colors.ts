/**
 * Centralized dark theme palette.
 * Every screen pulls colors from here so the app stays visually consistent
 * and we can tweak the whole look in one place.
 */
export const colors = {
  // Backgrounds (darkest -> elevated surfaces)
  background: '#0E0E14',
  surface: '#1A1A24',
  surfaceElevated: '#22222E',
  border: '#2A2A38',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#9A9AA8',
  textTertiary: '#6E6E7C',

  // Brand / accents
  primary: '#7C5CFF',
  teal: '#00C2A8',
  orange: '#FF7A59',
  amber: '#FFB020',
  red: '#FF4D6D',
  blue: '#4D9BFF',

  // Utility
  transparent: 'transparent',
} as const;

export type ColorName = keyof typeof colors;
