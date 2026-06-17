/**
 * Type definitions that mirror the Google Health API (v4) REST surface.
 * Reference: https://developers.google.com/health/reference/rest/v4
 *
 * The shapes here intentionally match the real API so that when we swap the
 * mock client for a live OAuth-backed client, nothing downstream changes.
 */

/** The six OAuth 2.0 scope bundles the Google Health API consolidates Fitbit's
 *  legacy scopes into. Suffix `.readonly` for read access. */
export enum HealthScope {
  ActivityAndFitness = 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  HealthMetrics = 'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  Sleep = 'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  Nutrition = 'https://www.googleapis.com/auth/googlehealth.nutrition.readonly',
  Ecg = 'https://www.googleapis.com/auth/googlehealth.electrocardiogram.readonly',
  IrregularRhythm = 'https://www.googleapis.com/auth/googlehealth.irregular_rhythm_notifications.readonly',
}

/** How a data type is sampled over time. Determines which time field a
 *  DataPoint carries. */
export type DataTypeKind = 'interval' | 'sample' | 'daily' | 'session';

/** An RFC 3339 timestamp string, e.g. "2026-06-15T08:30:00Z". */
export type Timestamp = string;

/** A calendar date with no timezone, mirroring google.type.Date. */
export interface CivilDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/** Time window for interval/session data types. */
export interface Interval {
  startTime: Timestamp;
  endTime: Timestamp;
}

/** Point-in-time for sample data types. */
export interface SampleTime {
  physicalTime: Timestamp;
  civilTime?: Timestamp;
}

/** Sleep session payload (kind: 'session', scope: Sleep). */
export interface SleepValue {
  durationMinutes: number;
  efficiency: number; // 0-100
  stages: {
    deepMinutes: number;
    lightMinutes: number;
    remMinutes: number;
    awakeMinutes: number;
  };
}

/** Exercise session payload (kind: 'session', scope: ActivityAndFitness). */
export interface ExerciseValue {
  activityType: string; // e.g. "run", "walk", "bike"
  calories: number;
  distanceMeters: number;
  averageHeartRate: number;
  durationMinutes: number;
}

/**
 * A single measurement. Exactly one of `value`'s numeric / session fields is
 * populated, and exactly one of the time fields (interval | sampleTime | date)
 * is set, according to the data type's kind.
 */
export interface DataPoint {
  /** Kebab-case data type identifier, e.g. "heart-rate", "steps". */
  dataTypeName: string;
  /** Device / app the data originated from, e.g. "Fitbit Charge 6". */
  originDataSourceId?: string;

  interval?: Interval;
  sampleTime?: SampleTime;
  date?: CivilDate;

  value: {
    /** Integer values (steps). */
    intVal?: number;
    /** Floating-point values (distance, heart rate, weight, %, kcal, ...). */
    fpVal?: number;
    sleepSession?: SleepValue;
    exerciseSession?: ExerciseValue;
  };
}

/** Response envelope for the dataPoints.list method. */
export interface ListDataPointsResponse {
  dataPoints: DataPoint[];
  nextPageToken?: string;
}

/** Parameters for a dataPoints.list request. */
export interface ListDataPointsParams {
  /** Kebab-case data type id, e.g. "steps". */
  dataType: string;
  /** Inclusive start of the query window. */
  startTime: Timestamp;
  /** Exclusive end of the query window. */
  endTime: Timestamp;
  pageSize?: number;
  pageToken?: string;
}
