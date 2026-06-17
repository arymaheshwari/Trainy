/**
 * Deterministic dummy data generator.
 *
 * Produces DataPoints in the exact shape the Google Health API returns, so the
 * UI can be built and demoed without OAuth/token management. Values are seeded
 * by calendar date, so the same day always yields the same numbers — handy for
 * predictable development and screenshots.
 */
import { DATA_TYPES } from './dataTypes';
import { CivilDate, DataPoint, Timestamp } from './types';

const DEVICE = 'Fitbit Charge 6';

/** Small seeded PRNG (mulberry32) for stable pseudo-random values. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn a date into a stable integer seed (YYYYMMDD). */
function daySeed(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function toCivilDate(d: Date): CivilDate {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function iso(d: Date): Timestamp {
  return d.toISOString();
}

/** All midnights in [start, end), oldest first. */
function daysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Generate DataPoints for a single data type within [start, end).
 * Each branch builds points appropriate to the type's kind.
 */
export function generateDataPoints(
  dataTypeId: string,
  start: Date,
  end: Date
): DataPoint[] {
  const points: DataPoint[] = [];

  for (const day of daysInRange(start, end)) {
    const rng = seeded(daySeed(day) + hash(dataTypeId));
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

    switch (dataTypeId) {
      case DATA_TYPES.STEPS.id: {
        // Hourly interval buckets across waking hours.
        const target = 6000 + Math.floor(rng() * 7000) + (isWeekend ? -1500 : 0);
        const perHour = spread(target, 7, 22, rng);
        perHour.forEach(({ hour, value }) => {
          points.push({
            dataTypeName: dataTypeId,
            originDataSourceId: DEVICE,
            interval: hourInterval(day, hour),
            value: { intVal: Math.round(value) },
          });
        });
        break;
      }

      case DATA_TYPES.DISTANCE.id: {
        const meters = 4000 + rng() * 5000;
        points.push(dailyInterval(dataTypeId, day, { fpVal: round(meters, 1) }));
        break;
      }

      case DATA_TYPES.ACTIVE_MINUTES.id: {
        const mins = 25 + rng() * 70;
        points.push(dailyInterval(dataTypeId, day, { fpVal: round(mins) }));
        break;
      }

      case DATA_TYPES.ACTIVE_ENERGY_BURNED.id: {
        const kcal = 350 + rng() * 500;
        points.push(dailyInterval(dataTypeId, day, { fpVal: round(kcal) }));
        break;
      }

      case DATA_TYPES.HEART_RATE.id: {
        // A sample every 30 minutes through the day.
        for (let h = 0; h < 24; h++) {
          for (const m of [0, 30]) {
            const base = h >= 0 && h < 6 ? 56 : isWeekend ? 70 : 76;
            const bpm = base + Math.round(rng() * 34);
            const t = new Date(day);
            t.setHours(h, m, 0, 0);
            points.push({
              dataTypeName: dataTypeId,
              originDataSourceId: DEVICE,
              sampleTime: { physicalTime: iso(t) },
              value: { fpVal: bpm },
            });
          }
        }
        break;
      }

      case DATA_TYPES.DAILY_RESTING_HEART_RATE.id: {
        const bpm = 54 + Math.round(rng() * 12);
        points.push({
          dataTypeName: dataTypeId,
          originDataSourceId: DEVICE,
          date: toCivilDate(day),
          value: { fpVal: bpm },
        });
        break;
      }

      case DATA_TYPES.OXYGEN_SATURATION.id: {
        // A few overnight readings.
        for (const h of [1, 3, 5]) {
          const spo2 = 95 + round(rng() * 4, 1);
          const t = new Date(day);
          t.setHours(h, 0, 0, 0);
          points.push({
            dataTypeName: dataTypeId,
            originDataSourceId: DEVICE,
            sampleTime: { physicalTime: iso(t) },
            value: { fpVal: Math.min(100, spo2) },
          });
        }
        break;
      }

      case DATA_TYPES.WEIGHT.id: {
        const kg = 72 + (rng() - 0.5) * 1.5;
        const t = new Date(day);
        t.setHours(7, 30, 0, 0);
        points.push({
          dataTypeName: dataTypeId,
          originDataSourceId: DEVICE,
          sampleTime: { physicalTime: iso(t) },
          value: { fpVal: round(kg, 1) },
        });
        break;
      }

      case DATA_TYPES.SLEEP.id: {
        const duration = 360 + Math.round(rng() * 150); // 6h–8.5h
        const deep = Math.round(duration * (0.13 + rng() * 0.05));
        const rem = Math.round(duration * (0.2 + rng() * 0.05));
        const awake = Math.round(duration * (0.05 + rng() * 0.04));
        const light = duration - deep - rem - awake;
        const sleepStart = new Date(day);
        sleepStart.setDate(sleepStart.getDate() - 1);
        sleepStart.setHours(23, Math.round(rng() * 40), 0, 0);
        const sleepEnd = new Date(sleepStart.getTime() + (duration + awake) * 60000);
        points.push({
          dataTypeName: dataTypeId,
          originDataSourceId: DEVICE,
          interval: { startTime: iso(sleepStart), endTime: iso(sleepEnd) },
          value: {
            sleepSession: {
              durationMinutes: duration,
              efficiency: round(((duration - awake) / duration) * 100),
              stages: {
                deepMinutes: deep,
                lightMinutes: light,
                remMinutes: rem,
                awakeMinutes: awake,
              },
            },
          },
        });
        break;
      }

      case DATA_TYPES.EXERCISE.id: {
        // ~60% of days have a workout.
        if (rng() > 0.4) {
          const activities = ['run', 'walk', 'bike', 'strength', 'yoga'];
          const activityType = activities[Math.floor(rng() * activities.length)];
          const durationMinutes = 25 + Math.round(rng() * 65);
          const t = new Date(day);
          t.setHours(17, 0, 0, 0);
          const exEnd = new Date(t.getTime() + durationMinutes * 60000);
          points.push({
            dataTypeName: dataTypeId,
            originDataSourceId: DEVICE,
            interval: { startTime: iso(t), endTime: iso(exEnd) },
            value: {
              exerciseSession: {
                activityType,
                durationMinutes,
                calories: 150 + Math.round(rng() * 450),
                distanceMeters: round(2000 + rng() * 8000, 1),
                averageHeartRate: 110 + Math.round(rng() * 50),
              },
            },
          });
        }
        break;
      }

      default:
        break;
    }
  }

  return points;
}

// ---- helpers -------------------------------------------------------------

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function hourInterval(day: Date, hour: number): { startTime: Timestamp; endTime: Timestamp } {
  const s = new Date(day);
  s.setHours(hour, 0, 0, 0);
  const e = new Date(s);
  e.setHours(hour + 1, 0, 0, 0);
  return { startTime: iso(s), endTime: iso(e) };
}

function dailyInterval(
  dataTypeId: string,
  day: Date,
  value: DataPoint['value']
): DataPoint {
  const s = startOfDay(day);
  const e = new Date(s);
  e.setDate(e.getDate() + 1);
  return {
    dataTypeName: dataTypeId,
    originDataSourceId: DEVICE,
    interval: { startTime: iso(s), endTime: iso(e) },
    value,
  };
}

/** Distribute a daily total across [fromHour, toHour) with some randomness. */
function spread(
  total: number,
  fromHour: number,
  toHour: number,
  rng: () => number
): { hour: number; value: number }[] {
  const hours = toHour - fromHour;
  const weights = Array.from({ length: hours }, () => 0.3 + rng());
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w, i) => ({ hour: fromHour + i, value: (w / sum) * total }));
}
