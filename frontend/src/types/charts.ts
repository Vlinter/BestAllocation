/**
 * Shared chart types.
 *
 * Recharts does not export stable prop types for custom tooltip and shape
 * renderers across minor versions, so we declare the narrow surface this app
 * actually reads. Widening one of these is a deliberate act; reaching for
 * `any` is not.
 */

/**
 * One series entry inside a Recharts tooltip payload.
 * `T` is the shape of the data row the point was built from — pass it so the
 * tooltip body reads real fields instead of `unknown`.
 */
export interface ChartTooltipEntry<T = Record<string, unknown>> {
    name?: string;
    value?: number;
    color?: string;
    fill?: string;
    stroke?: string;
    dataKey?: string | number;
    /** The full data row the point was built from. */
    payload?: T;
}

/** Props Recharts passes to a custom tooltip component. */
export interface ChartTooltipProps<T = Record<string, unknown>> {
    active?: boolean;
    payload?: ChartTooltipEntry<T>[];
    label?: string | number;
}

/** Props Recharts passes to a custom shape renderer (Scatter dots, stars…). */
export interface ChartShapeProps<T = Record<string, unknown>> {
    cx?: number;
    cy?: number;
    payload?: T;
}

/**
 * SciPy dendrogram structure produced by the HRP optimizer
 * (`scipy.cluster.hierarchy.dendrogram`, no_plot=True).
 */
export interface DendrogramData {
    /** x coordinates of each link, 4 per link. */
    icoord: number[][];
    /** y coordinates (merge distances) of each link, 4 per link. */
    dcoord: number[][];
    /** Leaf labels, left to right. */
    ivl: string[];
    /** Leaf indices, left to right. */
    leaves: number[];
}
