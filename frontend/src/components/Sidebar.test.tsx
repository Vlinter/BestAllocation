import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';

const setup = () => {
    const onOptimize = vi.fn();
    render(<Sidebar onOptimize={onOptimize} isLoading={false} error={null} />);
    // MUI paints `pointer-events: none` on toggle labels and chip delete icons;
    // jsdom reports it faithfully and user-event then refuses to click. The
    // elements are interactive in a real browser, so skip that guard here.
    return { onOptimize, user: userEvent.setup({ pointerEventsCheck: 0 }) };
};

const submitButton = () => screen.getByRole('button', { name: /Compare All Methods/i });

/** The "Custom" toggle of a given settings group (there is one per group). */
const customToggleFor = (groupLabel: string) => {
    const group = screen.getByText(groupLabel).parentElement!.querySelector('.MuiToggleButtonGroup-root')!;
    return Array.from(group.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Custom')!;
};

/** MUI renders a chip's delete affordance as an icon, not a named button. */
const removeTicker = async (user: ReturnType<typeof userEvent.setup>, ticker: string) => {
    const chip = screen.getByText(ticker).closest('.MuiChip-root')!;
    await user.click(chip.querySelector('.MuiChip-deleteIcon')!);
};

describe('Sidebar parameter guard', () => {
    it('submits the defaults', async () => {
        const { onOptimize, user } = setup();
        expect(submitButton()).toBeEnabled();
        await user.click(submitButton());

        expect(onOptimize).toHaveBeenCalledTimes(1);
        expect(onOptimize.mock.calls[0][0]).toMatchObject({
            trainingWindow: 252, rebalancingWindow: 63, transactionCostBps: 10,
        });
    });

    /**
     * These bounds mirror the Pydantic schema. Sending a value outside them
     * returned a 422 whose `detail` is a list of objects — which used to blank
     * the whole app when React tried to render it. The request must not leave.
     */
    it('blocks a training window below the schema minimum', async () => {
        const { onOptimize, user } = setup();
        await user.click(customToggleFor('Training Window'));

        const field = screen.getByLabelText(/Training Window \(Days\)/i);
        await user.clear(field);
        await user.type(field, '20');

        expect(await screen.findByText(/Training window must be between 60 and 1260 days/i)).toBeInTheDocument();
        expect(submitButton()).toBeDisabled();
        await user.click(submitButton());
        expect(onOptimize).not.toHaveBeenCalled();
    });

    it('blocks an empty numeric field rather than sending Number("") === 0', async () => {
        const { onOptimize, user } = setup();
        const cost = screen.getByLabelText(/Cost per rebalance/i);
        await user.clear(cost);
        await user.type(cost, '500');       // above the le=100 bound

        expect(await screen.findByText(/Transaction cost must be between 0 and 100 bps/i)).toBeInTheDocument();
        expect(submitButton()).toBeDisabled();
        expect(onOptimize).not.toHaveBeenCalled();
    });

    it('blocks fewer than two tickers', async () => {
        const { onOptimize, user } = setup();
        for (const t of ['QQQ', 'VGK', 'VWO', 'GLD', 'SLV']) await removeTicker(user, t);

        expect(screen.getByText('1/30 tickers')).toBeInTheDocument();
        expect(await screen.findByText(/At least 2 tickers required/i)).toBeInTheDocument();
        expect(submitButton()).toBeDisabled();
        await user.click(submitButton());
        expect(onOptimize).not.toHaveBeenCalled();
    });

    it('rejects a malformed ticker before it can reach the Tiingo URL', async () => {
        const { user } = setup();
        const input = screen.getByPlaceholderText('Add ticker...');
        await user.type(input, '../../account{Enter}');

        expect(await screen.findByText(/is not a valid ticker/i)).toBeInTheDocument();
        expect(screen.getByText('6/30 tickers')).toBeInTheDocument();   // nothing added
    });

    it('refuses a duplicate ticker', async () => {
        const { user } = setup();
        await user.type(screen.getByPlaceholderText('Add ticker...'), 'QQQ{Enter}');

        expect(await screen.findByText(/already in the list/i)).toBeInTheDocument();
        expect(screen.getByText('6/30 tickers')).toBeInTheDocument();
    });

    it('recommends a max weight from the ticker count, and stops once you set one', async () => {
        const { user } = setup();
        // 6 tickers -> 1.5 x 1/6 = 25%
        expect(screen.getByText('Diversified (Max 25%)')).toBeInTheDocument();

        const maxField = screen.getByLabelText('Max %');
        await user.clear(maxField);
        await user.type(maxField, '40');

        // Adding a ticker must NOT overwrite the manual choice any more.
        await user.type(screen.getByPlaceholderText('Add ticker...'), 'SPY{Enter}');
        expect(screen.getByText('Diversified (Max 25%)')).toBeInTheDocument();   // 7 tickers -> still 25%
        expect(maxField).toHaveValue(40);
    });
});
