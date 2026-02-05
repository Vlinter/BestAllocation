
/**
 * Downsamples a large dataset to a target number of points using a simple stepping algorithm.
 * Ideally we would use LTTB, but for simple line charts, picking every Nth point + min/max is often enough.
 * 
 * @param data Array of data points
 * @param targetPoints Maximum number of points to return (default: 500 for performance)
 * @returns Downsampled array
 */
export function downsampleSeries<T>(data: T[], targetPoints: number = 500): T[] {
    if (!data || data.length <= targetPoints) {
        return data;
    }

    const step = Math.ceil(data.length / targetPoints);
    const result: T[] = [];

    for (let i = 0; i < data.length; i += step) {
        result.push(data[i]);
    }

    // Always include the last point
    if (result[result.length - 1] !== data[data.length - 1]) {
        result.push(data[data.length - 1]);
    }

    return result;
}
