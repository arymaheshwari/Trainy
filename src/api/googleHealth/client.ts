/**
 * Health data client.
 *
 * `HealthClient` is the contract the rest of the app codes against. Today it's
 * backed by `MockHealthClient` (deterministic dummy data, no tokens). When we
 * add OAuth, we implement `GoogleHealthClient` against health.googleapis.com/v4
 * with the same interface — a one-line swap in `healthClient` below, and zero
 * changes anywhere else.
 */
import { generateDataPoints } from './mockData';
import { ListDataPointsParams, ListDataPointsResponse } from './types';

/** Base URL of the real Google Health API (used by the future live client). */
export const GOOGLE_HEALTH_BASE_URL = 'https://health.googleapis.com/v4';

export interface HealthClient {
  /**
   * Mirrors GET /users/me/dataTypes/{type}/dataPoints.
   * Returns every DataPoint of `dataType` within [startTime, endTime).
   */
  listDataPoints(params: ListDataPointsParams): Promise<ListDataPointsResponse>;
}

/** Simulated network latency for the mock client, in ms. */
const MOCK_LATENCY_MS = 120;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockHealthClient implements HealthClient {
  async listDataPoints(params: ListDataPointsParams): Promise<ListDataPointsResponse> {
    await delay(MOCK_LATENCY_MS);
    const start = new Date(params.startTime);
    const end = new Date(params.endTime);
    const dataPoints = generateDataPoints(params.dataType, start, end);
    return { dataPoints };
  }
}

/**
 * The live client — to be implemented when OAuth is wired up. Kept here as the
 * explicit target shape so the migration path is obvious.
 *
 * export class GoogleHealthClient implements HealthClient {
 *   constructor(private getAccessToken: () => Promise<string>) {}
 *   async listDataPoints(params) {
 *     const token = await this.getAccessToken();
 *     const url = `${GOOGLE_HEALTH_BASE_URL}/users/me/dataTypes/${params.dataType}/dataPoints`
 *       + `?interval.startTime=${params.startTime}&interval.endTime=${params.endTime}`;
 *     const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
 *     return res.json();
 *   }
 * }
 */

/** App-wide singleton. Swap to GoogleHealthClient once auth exists. */
export const healthClient: HealthClient = new MockHealthClient();
