import { createContext, useContext } from 'react';
import type { HeatMetric } from '../utils/heatmap';

// Active heatmap metric + the max metric value across the current map's
// systems. Computed once in MapCanvas and shared so each node only divides its
// own value by `max` (O(N) total instead of every node scanning every system).
export interface HeatmapState {
  metric:    HeatMetric;
  max:       number;
  /** User intensity multiplier on the glow strength (1 = default). */
  intensity: number;
}

export const HeatmapContext = createContext<HeatmapState>({ metric: 'none', max: 0, intensity: 1 });

export const useHeatmap = (): HeatmapState => useContext(HeatmapContext);
