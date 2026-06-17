/**
 * Portion units and conversion.
 *
 * A food's nutrition is stored per ONE serving. To log an arbitrary portion we
 * convert the chosen (amount, unit) into a servings multiplier:
 *
 *   nutrition for the portion = per-serving values × multiplier
 *
 * Mass/volume units need the food's saved "serving stats":
 *   - servingGrams: grams in one serving (enables g and oz)
 *   - cupGrams:     grams in one cup     (enables cup, together with servingGrams)
 *
 * Units without the required stat are unavailable until the user adds it when
 * creating/editing the food.
 */
export type PortionUnit = 'serving' | 'g' | 'oz' | 'cup';

export const PORTION_UNITS: PortionUnit[] = ['serving', 'g', 'oz', 'cup'];

const GRAMS_PER_OZ = 28.3495;

export interface PortionStats {
  servingGrams?: number;
  cupGrams?: number;
}

/** Short display label for a unit (singular/plural handled by callers). */
export function unitLabel(unit: PortionUnit): string {
  switch (unit) {
    case 'serving':
      return 'serving';
    case 'g':
      return 'g';
    case 'oz':
      return 'oz';
    case 'cup':
      return 'cup';
  }
}

/** Whether a unit can be used given the food's known serving stats. */
export function unitAvailable(unit: PortionUnit, stats: PortionStats): boolean {
  switch (unit) {
    case 'serving':
      return true;
    case 'g':
    case 'oz':
      return !!stats.servingGrams && stats.servingGrams > 0;
    case 'cup':
      return !!stats.servingGrams && stats.servingGrams > 0 && !!stats.cupGrams && stats.cupGrams > 0;
  }
}

/**
 * Convert a portion to a servings multiplier, or null if the unit isn't
 * available for this food. Everything routes through grams via servingGrams.
 */
export function portionToServings(
  amount: number,
  unit: PortionUnit,
  stats: PortionStats,
): number | null {
  if (!(amount >= 0) || !unitAvailable(unit, stats)) return null;
  switch (unit) {
    case 'serving':
      return amount;
    case 'g':
      return amount / (stats.servingGrams as number);
    case 'oz':
      return (amount * GRAMS_PER_OZ) / (stats.servingGrams as number);
    case 'cup':
      return (amount * (stats.cupGrams as number)) / (stats.servingGrams as number);
  }
}

/** Human-readable portion, e.g. "1.5 servings", "150 g", "2 cups". */
export function formatPortion(amount: number, unit: PortionUnit): string {
  const n = Math.round(amount * 100) / 100;
  if (unit === 'serving') return `${n} ${n === 1 ? 'serving' : 'servings'}`;
  if (unit === 'cup') return `${n} ${n === 1 ? 'cup' : 'cups'}`;
  return `${n} ${unit}`;
}
