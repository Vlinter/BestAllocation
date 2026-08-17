import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

/**
 * Recharts measures its container before drawing, and jsdom reports 0x0 for
 * everything — every chart would render empty and every assertion about one
 * would pass vacuously. Replace ResponsiveContainer with a fixed-size box so
 * the real chart, axes, tooltip and all, actually renders.
 */
vi.mock('recharts', async () => {
    const actual = await vi.importActual<typeof import('recharts')>('recharts');
    const Sized = ({ children }: { children: React.ReactNode }) => (
        <div style={{ width: 800, height: 400 }}>
            {React.isValidElement(children)
                ? React.cloneElement(children as React.ReactElement<{ width?: number; height?: number }>,
                    { width: 800, height: 400 })
                : children}
        </div>
    );
    return { ...actual, ResponsiveContainer: Sized };
});

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as never);

for (const [prop, value] of [
    ['offsetWidth', 800],
    ['offsetHeight', 400],
    ['clientWidth', 800],
    ['clientHeight', 400],
] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, value });
}
