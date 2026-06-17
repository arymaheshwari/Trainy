/**
 * Normalized USDA FoodData Central types — what the rest of the app codes
 * against. Raw API shapes (which differ between the search and detail
 * endpoints) are mapped into these in `index.ts`, so UI never touches the
 * USDA wire format directly.
 */

/**
 * Where a food came from:
 *  - usda: USDA FoodData Central
 *  - custom: user-added food
 *  - barcode: scanned product (Open Food Facts)
 *  - ai: AI-generated from a description
 *  - label: scanned Nutrition Facts label
 */
export type FoodSource = 'usda' | 'custom' | 'barcode' | 'ai' | 'label';

/** Points the detail sheet at a specific food to resolve and display. */
export type FoodTarget =
  | { source: 'usda'; fdcId: number }
  | { source: 'custom'; customId: string };

/** A lightweight search hit, enough to render a results row. */
export interface FoodSearchResult {
  /** Stable list key, unique across both sources (e.g. "usda:123", "custom:abc"). */
  id: string;
  source: FoodSource;
  /** Present when `source === 'usda'`. */
  fdcId?: number;
  /** Present when `source === 'custom'`. */
  customId?: string;
  /** Food name, e.g. "Greek Yogurt, Plain". */
  description: string;
  /** Brand owner / manufacturer, if a branded item. */
  brand?: string;
  /** USDA dataset the item came from, or "Custom" for user-added foods. */
  dataType: string;
  /** Energy for the food's basis (per serving for branded, per 100 g otherwise). */
  calories?: number;
}

/** A single non-macro nutrient (fiber, sodium, vitamin C, …). */
export interface FoodMicro {
  label: string;
  amount: number;
  unit: string;
}

/** Full nutrition for one food, normalized to grams + a stated basis. */
export interface FoodDetail {
  fdcId: number;
  description: string;
  brand?: string;
  /** Human-readable basis these numbers are for, e.g. "per 1 serving (240 ml)" or "per 100 g". */
  basis: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros: FoodMicro[];
  /** Grams in one serving, if known — enables g/oz/cup portions. */
  servingGrams?: number;
  /** Grams in one cup, if known — enables cup portions. */
  cupGrams?: number;
  /** True when the user has saved a label correction for this food. */
  isEdited?: boolean;
}

/**
 * Everything the detail sheet needs to display + log a food, from any origin.
 * `usda`/`custom` are resolved by id (and support persisted edits); `resolved`
 * carries an already-built food (barcode/AI) that has no persistence store, so
 * its `source`+`refId` are used directly when logging.
 */
export type FoodDetailSource =
  | { kind: 'usda'; fdcId: number }
  | { kind: 'custom'; customId: string }
  | { kind: 'resolved'; food: FoodDetail; source: FoodSource; refId: string };
