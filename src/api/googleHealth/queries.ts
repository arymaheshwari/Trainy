/**
 * High-level, UI-friendly queries built on top of the raw `healthClient`.
 *
 * Screens call these (e.g. `getTodaySummary()`) instead of dealing with
 * DataPoint envelopes directly. Because they go through the `HealthClient`
 * interface, they work identically against mock data now and the live Google
 * Health API later.
 */
import { healthClient } from './client';
import { DATA_TYPES } from './dataTypes';
import { DataPoint, SleepValue } from './types';

function startOfDay(d = new Date()): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** Sum the numeric values (int or fp) of a set of points. */
function sumValues(points: DataPoint[]): number {
  return points.reduce((acc, p) => acc + (p.value.intVal ?? p.value.fpVal ?? 0), 0);
}

/** Average the numeric values of a set of points (0 if empty). */
function avgValues(points: DataPoint[]): number {
  if (points.length === 0) return 0;
  return sumValues(points) / points.length;
}

export interface DailySummary {
  date: Date;
  steps: number;
  distanceMeters: number;
  activeMinutes: number;
  activeCalories: number;
  restingHeartRate: number;
  averageHeartRate: number;
  spo2: number;
  weightKg: number;
  sleep?: SleepValue;
}

/** A complete snapshot of one day — what the home dashboard renders. */
export async function getDaySummary(day = new Date()): Promise<DailySummary> {
  const start = startOfDay(day);
  const end = addDays(start, 1);
  const window = { startTime: start.toISOString(), endTime: end.toISOString() };

  const [steps, distance, activeMin, activeCal, restingHr, hr, spo2, weight, sleep] =
    await Promise.all([
      healthClient.listDataPoints({ dataType: DATA_TYPES.STEPS.id, ...window }),
      healthClient.listDataPoints({ dataType: DATA_TYPES.DISTANCE.id, ...window }),
      healthClient.listDataPoints({ dataType: DATA_TYPES.ACTIVE_MINUTES.id, ...window }),
      healthClient.listDataPoints({ dataType: DATA_TYPES.ACTIVE_ENERGY_BURNED.id, ...window }),
      healthClient.listDataPoints({ dataType: DATA_TYPES.DAILY_RESTING_HEART_RATE.id, ...window }),
      healthClient.listDataPoints({ dataType: DATA_TYPES.HEART_RATE.id, ...window }),
      healthClient.listDataPoints({ dataType: DATA_TYPES.OXYGEN_SATURATION.id, ...window }),
      healthClient.listDataPoints({ dataType: DATA_TYPES.WEIGHT.id, ...window }),
      healthClient.listDataPoints({ dataType: DATA_TYPES.SLEEP.id, ...window }),
    ]);

  return {
    date: start,
    steps: Math.round(sumValues(steps.dataPoints)),
    distanceMeters: Math.round(sumValues(distance.dataPoints)),
    activeMinutes: Math.round(sumValues(activeMin.dataPoints)),
    activeCalories: Math.round(sumValues(activeCal.dataPoints)),
    restingHeartRate: Math.round(avgValues(restingHr.dataPoints)),
    averageHeartRate: Math.round(avgValues(hr.dataPoints)),
    spo2: Math.round(avgValues(spo2.dataPoints) * 10) / 10,
    weightKg: Math.round(avgValues(weight.dataPoints) * 10) / 10,
    sleep: sleep.dataPoints[0]?.value.sleepSession,
  };
}

/** Today's summary. */
export function getTodaySummary(): Promise<DailySummary> {
  return getDaySummary(new Date());
}

/** Daily step totals for the last `days` days, oldest first. */
export async function getDailySteps(days = 7): Promise<{ date: Date; steps: number }[]> {
  const end = addDays(startOfDay(), 1);
  const start = addDays(end, -days);
  const res = await healthClient.listDataPoints({
    dataType: DATA_TYPES.STEPS.id,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  });

  const byDay = new Map<string, number>();
  for (const p of res.dataPoints) {
    if (!p.interval) continue;
    const key = startOfDay(new Date(p.interval.startTime)).toISOString();
    byDay.set(key, (byDay.get(key) ?? 0) + (p.value.intVal ?? 0));
  }

  return Array.from(byDay.entries())
    .map(([iso, steps]) => ({ date: new Date(iso), steps: Math.round(steps) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export interface SleepSummary {
  durationMinutes: number;
  efficiency: number; // 0-100
  /**
   * PLACEHOLDER sleep score (0-100). The Google Health API does not expose a
   * sleep score, so this is a stand-in derived from efficiency until we build
   * our own scoring algorithm. Do not treat as real product data.
   */
  score: number;
  isScorePlaceholder: true;
}

/** Today's sleep session, or null if none recorded. */
export async function getTodaySleep(): Promise<SleepSummary | null> {
  const start = startOfDay();
  const end = addDays(start, 1);
  const res = await healthClient.listDataPoints({
    dataType: DATA_TYPES.SLEEP.id,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  });

  const sleep = res.dataPoints[0]?.value.sleepSession;
  if (!sleep) return null;

  // Placeholder score: nudge efficiency into a believable 60-99 band.
  const score = Math.round(Math.min(99, Math.max(60, sleep.efficiency)));

  return {
    durationMinutes: sleep.durationMinutes,
    efficiency: sleep.efficiency,
    score,
    isScorePlaceholder: true,
  };
}

export interface HeartRateSummary {
  /** Most recent heart-rate sample today, in bpm. */
  latest: number;
  average: number;
  min: number;
  max: number;
  /** Daily resting heart rate, in bpm. */
  resting: number;
}

/** Today's heart-rate stats, or null if no samples recorded. */
export async function getTodayHeartRate(): Promise<HeartRateSummary | null> {
  const start = startOfDay();
  const end = addDays(start, 1);
  const window = { startTime: start.toISOString(), endTime: end.toISOString() };

  const [hr, resting] = await Promise.all([
    healthClient.listDataPoints({ dataType: DATA_TYPES.HEART_RATE.id, ...window }),
    healthClient.listDataPoints({ dataType: DATA_TYPES.DAILY_RESTING_HEART_RATE.id, ...window }),
  ]);

  const samples = hr.dataPoints
    .filter((p) => p.sampleTime)
    .sort(
      (a, b) =>
        new Date(a.sampleTime!.physicalTime).getTime() -
        new Date(b.sampleTime!.physicalTime).getTime()
    );
  if (samples.length === 0) return null;

  const values = samples.map((p) => p.value.fpVal ?? 0);

  return {
    latest: Math.round(values[values.length - 1]),
    average: Math.round(avgValues(samples)),
    min: Math.round(Math.min(...values)),
    max: Math.round(Math.max(...values)),
    resting: Math.round(avgValues(resting.dataPoints)),
  };
}

export interface Workout {
  activityType: string;
  durationMinutes: number;
  calories: number;
  distanceMeters: number;
  averageHeartRate: number;
  startTime: Date;
}

/** Today's workout sessions, earliest first. */
export async function getTodayWorkouts(): Promise<Workout[]> {
  const start = startOfDay();
  const end = addDays(start, 1);
  const res = await healthClient.listDataPoints({
    dataType: DATA_TYPES.EXERCISE.id,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  });

  return res.dataPoints
    .filter((p) => p.value.exerciseSession && p.interval)
    .map((p) => {
      const ex = p.value.exerciseSession!;
      return {
        activityType: ex.activityType,
        durationMinutes: ex.durationMinutes,
        calories: ex.calories,
        distanceMeters: ex.distanceMeters,
        averageHeartRate: ex.averageHeartRate,
        startTime: new Date(p.interval!.startTime),
      };
    })
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/** Total step count for today. */
export async function getTodaySteps(): Promise<number> {
  const start = startOfDay();
  const end = addDays(start, 1);
  const res = await healthClient.listDataPoints({
    dataType: DATA_TYPES.STEPS.id,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  });
  return Math.round(sumValues(res.dataPoints));
}
