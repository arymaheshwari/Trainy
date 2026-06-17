/**
 * Registry of Google Health API data types we surface in the app.
 * Each entry maps the kebab-case identifier the API uses to its kind, the
 * OAuth scope bundle that gates it, and display metadata for the UI.
 *
 * Identifiers and scope groupings per:
 * https://developers.google.com/health/data-types
 */
import { DataTypeKind, HealthScope } from './types';

export interface DataTypeMeta {
  /** Kebab-case API identifier (used in the request path). */
  id: string;
  /** Human-friendly label for the UI. */
  label: string;
  kind: DataTypeKind;
  scope: HealthScope;
  /** Canonical unit of the value we store in mock data. */
  unit: string;
}

export const DATA_TYPES = {
  STEPS: {
    id: 'steps',
    label: 'Steps',
    kind: 'interval',
    scope: HealthScope.ActivityAndFitness,
    unit: 'count',
  },
  DISTANCE: {
    id: 'distance',
    label: 'Distance',
    kind: 'interval',
    scope: HealthScope.ActivityAndFitness,
    unit: 'm',
  },
  ACTIVE_MINUTES: {
    id: 'active-minutes',
    label: 'Active Minutes',
    kind: 'interval',
    scope: HealthScope.ActivityAndFitness,
    unit: 'min',
  },
  ACTIVE_ENERGY_BURNED: {
    id: 'active-energy-burned',
    label: 'Active Calories',
    kind: 'interval',
    scope: HealthScope.ActivityAndFitness,
    unit: 'kcal',
  },
  EXERCISE: {
    id: 'exercise',
    label: 'Workouts',
    kind: 'session',
    scope: HealthScope.ActivityAndFitness,
    unit: 'session',
  },
  HEART_RATE: {
    id: 'heart-rate',
    label: 'Heart Rate',
    kind: 'sample',
    scope: HealthScope.HealthMetrics,
    unit: 'bpm',
  },
  DAILY_RESTING_HEART_RATE: {
    id: 'daily-resting-heart-rate',
    label: 'Resting Heart Rate',
    kind: 'daily',
    scope: HealthScope.HealthMetrics,
    unit: 'bpm',
  },
  OXYGEN_SATURATION: {
    id: 'oxygen-saturation',
    label: 'Blood Oxygen',
    kind: 'sample',
    scope: HealthScope.HealthMetrics,
    unit: '%',
  },
  WEIGHT: {
    id: 'weight',
    label: 'Weight',
    kind: 'sample',
    scope: HealthScope.HealthMetrics,
    unit: 'kg',
  },
  SLEEP: {
    id: 'sleep',
    label: 'Sleep',
    kind: 'session',
    scope: HealthScope.Sleep,
    unit: 'min',
  },
} as const satisfies Record<string, DataTypeMeta>;

export type DataTypeKey = keyof typeof DATA_TYPES;

/** Look up metadata by the API's kebab-case id. */
export function dataTypeById(id: string): DataTypeMeta | undefined {
  return Object.values(DATA_TYPES).find((d) => d.id === id);
}
