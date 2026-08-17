import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ComparisonChart, { CustomTooltip } from './ComparisonChart';
import { CustomTooltip as HistoryTooltip } from './AllocationHistoryChart';
import { method, metrics } from '../test/fixtures';

/**
 * The chart tooltips were moved to module scope — declared inside a component
 * they were a fresh component type on every render — and now take what they
 * used to close over as props. Recharts passes those through because it renders
 * a custom `content` via cloneElement(content, props) (recharts@3.6.0,
 * component/Tooltip.js:36), which merges rather than replaces.
 *
 * Recharts does not open its tooltip under jsdom (its pointer plumbing needs a
 * real layout), so these render the tooltip components directly with the props
 * Recharts would hand them. That covers the arithmetic, which is where a bug
 * would actually live; the pass-through itself is pinned by the source above.
 */

// A curve that does NOT start at 1.0: a strategy is first valued at the close
// of its execution day, after costs and one session of market.
const curve = (base: number, end: number) => [
    { date: 1_600_000_000_000, value: base },
    { date: 1_600_086_400_000, value: (base + end) / 2 },
    { date: 1_600_172_800_000, value: end },
];

const methods = [
    method('hrp', {
        equity_curve: curve(1.05, 4.2),
        performance_metrics: metrics({ total_return: 3.0 }),   // 4.2 / 1.05 - 1
    }),
];
const benchmarkCurve = curve(1.02, 2.04);

describe('ComparisonChart', () => {
    it('measures the headline return from the curve base, not from 1.0', () => {
        render(<ComparisonChart methods={methods} benchmarkCurve={benchmarkCurve} benchmarkName="Equal Weight" />);

        // 4.2 / 1.05 - 1 = +300.0%, which is performance_metrics.total_return.
        expect(screen.getByText('+300.0%')).toBeInTheDocument();
        // The old formula, (lastValue - 1), would have printed +320.0%.
        expect(screen.queryByText('+320.0%')).not.toBeInTheDocument();
    });

    it('renders the chart with one line per strategy plus the benchmark', () => {
        const { container } = render(
            <ComparisonChart methods={methods} benchmarkCurve={benchmarkCurve} benchmarkName="Equal Weight" />);
        expect(container.querySelectorAll('.recharts-line').length).toBe(2);
    });
});

describe('ComparisonChart tooltip', () => {
    const payload = [{ name: 'HRP (test)', dataKey: 'hrp', value: 4.2, color: '#00D4AA' }];

    it('divides each point by its own series base', () => {
        render(<CustomTooltip active payload={payload} label={1_600_172_800_000}
            baseValues={{ hrp: 1.05 }} />);

        expect(screen.getByText('$4.20')).toBeInTheDocument();
        expect(screen.getByText('+300.0%')).toBeInTheDocument();
    });

    it('falls back to a base of 1.0 when the prop is missing, and says so numerically', () => {
        // Guards the failure mode of the refactor: if Recharts ever stopped
        // passing the prop through, the tooltip would silently print this.
        render(<CustomTooltip active payload={payload} label={1_600_172_800_000} />);
        expect(screen.getByText('+320.0%')).toBeInTheDocument();
    });

    it('renders nothing when inactive', () => {
        const { container } = render(<CustomTooltip active={false} payload={payload} label={1} />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('AllocationHistoryChart tooltip', () => {
    const payload = [{ name: 'AAA', dataKey: 'AAA', value: 42.5, color: '#00D4AA' }];

    it('formats as a percentage when the chart is in percentage mode', () => {
        render(<HistoryTooltip active payload={payload} label="2020-01-01" showPercentage />);
        expect(screen.getByText('42.5%')).toBeInTheDocument();
    });

    it('formats as a weight otherwise', () => {
        render(<HistoryTooltip active payload={payload} label="2020-01-01" showPercentage={false} />);
        expect(screen.getByText('42.5000')).toBeInTheDocument();
    });
});
