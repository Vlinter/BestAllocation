import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RebalancerCard from './RebalancerCard';
import { method } from '../test/fixtures';

const methods = [
    method('hrp', { current_allocation: { date: 'd', method: 'hrp', risk_contributions: {}, weights: { AAA: 0.6, BBB: 0.4 } } }),
    method('cvar', { current_allocation: { date: 'd', method: 'cvar', risk_contributions: {}, weights: { AAA: 0.5, BBB: 0.5 } } }),
];

const typeHolding = async (user: ReturnType<typeof userEvent.setup>, ticker: string, amount: string) => {
    const field = screen.getByLabelText(ticker);
    await user.clear(field);
    await user.type(field, amount);
};

/** The figure printed under a labelled stat, e.g. "Current Portfolio". */
const statUnder = (label: string) =>
    screen.getByText(label).parentElement!.textContent!.replace(label, '').trim();

/** Whole-card text, for assertions on strings React splits across nodes. */
const cardText = () => screen.getByText('Rebalancer').closest('.MuiPaper-root')!.textContent!;

describe('RebalancerCard', () => {
    it('totals only the tickers it is showing', async () => {
        const user = userEvent.setup();
        render(<RebalancerCard methods={methods} tickers={['AAA', 'BBB']} />);

        await typeHolding(user, 'AAA', '10000');
        await typeHolding(user, 'BBB', '10000');

        expect(statUnder('Current Portfolio')).toBe('$20,000');
    });

    it('drops the amounts of tickers that leave the universe', async () => {
        const user = userEvent.setup();
        const { rerender } = render(
            <RebalancerCard methods={methods} tickers={['AAA', 'BBB', 'CCC']} />);

        for (const t of ['AAA', 'BBB', 'CCC']) await typeHolding(user, t, '10000');
        expect(statUnder('Current Portfolio')).toBe('$30,000');

        // A second comparison on a different universe. The card is NOT remounted
        // — same position in the tree — so its state used to keep CCC's $10,000
        // in the total while no longer showing the field: every trade was then
        // sized against a portfolio that did not exist.
        rerender(<RebalancerCard methods={methods} tickers={['AAA', 'BBB']} />);

        expect(screen.queryByLabelText('CCC')).not.toBeInTheDocument();
        expect(statUnder('Current Portfolio')).toBe('$20,000');
        expect(cardText()).not.toContain('$30,000');
    });

    it('keeps the amounts of tickers that survive', async () => {
        const user = userEvent.setup();
        const { rerender } = render(
            <RebalancerCard methods={methods} tickers={['AAA', 'BBB']} />);

        await typeHolding(user, 'AAA', '7000');
        rerender(<RebalancerCard methods={methods} tickers={['AAA', 'CCC']} />);

        expect(screen.getByLabelText('AAA')).toHaveValue(7000);
        expect(screen.getByLabelText('CCC')).toHaveValue(null);   // empty, not 7000
    });

    it('sizes trades against the target weights of the selected strategy', async () => {
        const user = userEvent.setup();
        render(<RebalancerCard methods={methods} tickers={['AAA', 'BBB']} />);

        // $10k on each, HRP targets 60/40 -> buy $2,000 of AAA, sell $2,000 of BBB
        await typeHolding(user, 'AAA', '10000');
        await typeHolding(user, 'BBB', '10000');

        expect(screen.getByText('+$2,000')).toBeInTheDocument();
        expect(screen.getByText('-$2,000')).toBeInTheDocument();
        expect(screen.getByText('BUY')).toBeInTheDocument();
        expect(screen.getByText('SELL')).toBeInTheDocument();
    });

    it('deploys new cash on top of the current holdings', async () => {
        const user = userEvent.setup();
        render(<RebalancerCard methods={methods} tickers={['AAA', 'BBB']} />);

        await typeHolding(user, 'AAA', '10000');
        await typeHolding(user, 'BBB', '10000');
        const cash = screen.getByRole('spinbutton', { name: '' });
        await user.type(cash, '5000');

        // 25k total, HRP 60/40 -> AAA target 15k (+5k), BBB target 10k (0)
        expect(statUnder('Total After Cash')).toBe('$25,000');
        expect(screen.getByText('+$5,000')).toBeInTheDocument();
    });

    it('shows an explicit CASH line when the strategy is partly risk-off', async () => {
        const user = userEvent.setup();
        const riskOff = [method('mvo', {
            current_allocation: { date: 'd', method: 'mvo', risk_contributions: {}, weights: { AAA: 0.3, BBB: 0.2 } },
        })];
        render(<RebalancerCard methods={riskOff} tickers={['AAA', 'BBB']} />);

        await typeHolding(user, 'AAA', '10000');

        // Weights sum to 0.5: the other half is a cash target, not an unexplained sale.
        expect(cardText()).toContain('CASH — 50.0%');
    });
});
