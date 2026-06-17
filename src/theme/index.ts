/**
 * Design tokens for the app: colors, spacing, radii, and typography.
 * Import from here (`import { colors, spacing } from './src/theme'`) rather
 * than hard-coding values in components.
 */
export { colors } from './colors';
export type { ColorName } from './colors';

/** 4-point spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Corner radii — generous rounding for a soft, modern feel. */
export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/** Font sizes. */
export const fontSize = {
  caption: 12,
  body: 14,
  subtitle: 16,
  title: 20,
  heading: 28,
  display: 34,
} as const;
