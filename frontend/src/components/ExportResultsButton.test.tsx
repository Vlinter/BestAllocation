import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportResultsButton from './ExportResultsButton';
import { response } from '../test/fixtures';

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('ExportResultsButton', () => {
    it('copies the whole report in one click', async () => {
        render(<ExportResultsButton results={response()} />);

        await userEvent.click(screen.getByRole('button', { name: /copy for ai/i }));

        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
        const copied = writeText.mock.calls[0][0];
        expect(copied).toContain('# BestAllocation — walk-forward backtest report');
        expect(copied).toContain('## 4. Performance metrics');
        expect(await screen.findByText(/Report copied/)).toBeInTheDocument();
    });

    it('points at the download when the browser refuses the clipboard', async () => {
        writeText.mockRejectedValue(new Error('not allowed'));
        // The legacy fallback: jsdom has no execCommand at all.
        Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: vi.fn().mockReturnValue(false),
        });

        render(<ExportResultsButton results={response()} />);
        await userEvent.click(screen.getByRole('button', { name: /copy for ai/i }));

        expect(await screen.findByText(/refused clipboard access/)).toBeInTheDocument();
    });

    it('offers both files, and names them after the run', async () => {
        const createObjectURL = vi.fn().mockReturnValue('blob:report');
        const revokeObjectURL = vi.fn();
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        render(<ExportResultsButton results={response()} />);
        await userEvent.click(screen.getByRole('button', { name: /more export options/i }));
        await userEvent.click(screen.getByText('Download raw data (.json)'));

        expect(click).toHaveBeenCalledTimes(1);
        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(await screen.findByText(/Saved bestallocation-aaa-bbb-.*\.json/)).toBeInTheDocument();
    });
});
