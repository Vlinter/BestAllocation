import { describe, it, expect } from 'vitest';
import { describeApiError } from './useOptimization';

/**
 * FastAPI returns request-validation errors as `detail: [{loc, msg, ...}]` — a
 * LIST of objects. Handing that straight to setError put an array of objects
 * into JSX and React refused to render it ("Objects are not valid as a React
 * child"): the whole app blanked out. Whatever the API sends, this must come
 * back as a string.
 */
describe('describeApiError', () => {
    it('flattens a 422 validation list, naming the field', () => {
        const err = {
            response: {
                data: {
                    detail: [{
                        type: 'greater_than_equal',
                        loc: ['body', 'training_window'],
                        msg: 'Input should be greater than or equal to 60',
                    }],
                },
            },
        };
        expect(describeApiError(err)).toBe(
            'training_window — Input should be greater than or equal to 60');
    });

    it('joins several validation issues', () => {
        const err = {
            response: {
                data: {
                    detail: [
                        { loc: ['body', 'training_window'], msg: 'too small' },
                        { loc: ['body', 'tickers', 0], msg: 'invalid ticker' },
                    ],
                },
            },
        };
        expect(describeApiError(err)).toBe(
            'training_window — too small · tickers.0 — invalid ticker');
    });

    it('passes a plain string detail through (429, 400, 502…)', () => {
        const err = { response: { data: { detail: 'Rate limit exceeded.' } } };
        expect(describeApiError(err)).toBe('Rate limit exceeded.');
    });

    it('falls back to the transport message when there is no detail', () => {
        expect(describeApiError({ message: 'Network Error' })).toBe('Network Error');
    });

    it('never returns a non-string, whatever it is handed', () => {
        for (const junk of [null, undefined, 42, { response: {} }, { response: { data: { detail: [] } } },
            { response: { data: { detail: { nested: true } } } }]) {
            expect(typeof describeApiError(junk)).toBe('string');
            expect(describeApiError(junk).length).toBeGreaterThan(0);
        }
    });
});
