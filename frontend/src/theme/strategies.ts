/**
 * The one place a strategy's presentation is declared.
 *
 * Eleven components used to carry their own colour map, under four different
 * shapes, and they had already drifted: the rebalancer painted CVaR blue and
 * MVO amber while every other card painted them yellow and purple, so the same
 * strategy changed colour between two cards on the same tab.
 *
 * Identity and display names come from the API (backend/strategies.py); only
 * the palette lives here, because a colour is a presentation concern. The two
 * lists are kept in step by a backend test.
 */

export interface StrategyStyle {
    /** Primary colour: lines, bars, labels. */
    color: string;
    /** Lighter variant: gradients, hover states, histogram edges. */
    light: string;
    /** Halo behind a highlighted point. */
    glow: string;
    /** Short label for tight spaces (chips, table headers). */
    short: string;
}

export const STRATEGY_STYLES: Record<string, StrategyStyle> = {
    hrp: { color: '#00D4AA', light: '#00FFD4', glow: 'rgba(0, 212, 170, 0.5)', short: 'HRP' },
    cvar: { color: '#FFE66D', light: '#FFF094', glow: 'rgba(255, 230, 109, 0.5)', short: 'CVaR' },
    mvo: { color: '#A78BFA', light: '#C4B5FD', glow: 'rgba(167, 139, 250, 0.5)', short: 'MVO' },
};

/** Neutral, for the benchmark, the "average" pseudo-strategy and the unknown. */
export const NEUTRAL_STYLE: StrategyStyle = {
    color: '#A78BFA', light: '#DDD6FE', glow: 'rgba(167, 139, 250, 0.5)', short: '—',
};

/** Never returns undefined: a new strategy renders neutral instead of blank. */
export const styleOf = (id: string | undefined): StrategyStyle =>
    (id && STRATEGY_STYLES[id]) || NEUTRAL_STYLE;

export const colorOf = (id: string | undefined): string => styleOf(id).color;

// Ready-made views for the shapes the charts already expect, so a component
// imports one line instead of re-declaring the palette. All derived from
// STRATEGY_STYLES above — there is still exactly one place to edit.
const ids = Object.keys(STRATEGY_STYLES);
const derive = <T>(pick: (s: StrategyStyle) => T): Record<string, T> =>
    Object.fromEntries(ids.map(id => [id, pick(STRATEGY_STYLES[id])]));

/** id -> '#RRGGBB' */
export const STRATEGY_COLORS = derive(s => s.color);
/** id -> { color, glow } */
export const STRATEGY_GLOWS = derive(s => ({ color: s.color, glow: s.glow }));
/** id -> { main, light } */
export const STRATEGY_TONES = derive(s => ({ main: s.color, light: s.light }));
/** id -> { main, light, gradient } */
export const STRATEGY_GRADIENTS = derive(s => ({
    main: s.color, light: s.light, gradient: [s.color, s.light] as [string, string],
}));
