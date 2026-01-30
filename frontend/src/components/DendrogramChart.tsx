import React, { useMemo, useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';

interface DendrogramData {
    icoord: number[][];
    dcoord: number[][];
    ivl: string[];
    leaves: number[];
}

interface DendrogramChartProps {
    data: DendrogramData;
    height?: number;
}

const DendrogramChart: React.FC<DendrogramChartProps> = ({ data, height = 500 }) => {
    // const theme = useTheme(); // Unused

    const { icoord, dcoord, ivl } = data;
    const [hoveredLink, setHoveredLink] = useState<number | null>(null);
    const [tooltipData, setTooltipData] = useState<{ x: number; y: number; value: number; label?: string } | null>(null);

    // Margins and Dimensions
    // We increase bottom margin for labels
    const margin = { top: 60, right: 40, bottom: 120, left: 60 };

    // Bounds calculation
    const allX = icoord.flat();
    const allY = dcoord.flat();
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);
    // Y starts at 0 (leaves) usually?
    // In Scipy dendrogram, y is the distance. 0 is perfect correlation/same item.
    // So 0 is at the bottom, maxY is at the top.

    // Viewbox Size
    const contentWidth = 1000;
    const contentHeight = 500;

    // Scales
    // X maps [minX, maxX] -> [0, contentWidth]
    const scaleX = (x: number) => ((x - minX) / (maxX - minX)) * contentWidth;

    // Y maps [0, maxY] -> [contentHeight, 0] (Inverted for SVG)
    // 0 distance (leaves) should be at contentHeight (bottom)
    // maxY distance (root) should be at 0 (top) - margin top?
    // Actually let's keep it simple: 0 -> Height, Max -> 0.
    const scaleY = (y: number) => contentHeight - ((y / maxY) * contentHeight);

    // Process Links into Curved Paths
    const links = useMemo(() => {
        return icoord.map((xs, i) => {
            const ys = dcoord[i];

            // Original Points (Scipy standard: U-shape)
            // xs: [x_left, x_left, x_right, x_right] or similar
            // ys: [y_left, y_merge, y_merge, y_right]
            // We want to draw from (x[0], y[0]) to merge point, and (x[3], y[3]) to merge point.

            // Child 1
            const x1 = scaleX(xs[0]);
            const y1 = scaleY(ys[0]);

            // Child 2
            const x2 = scaleX(xs[3]);
            const y2 = scaleY(ys[3]);

            // Merge Height
            const mergeY = scaleY(ys[1]);

            // Merge X (midpoint)
            const mergeX = (x1 + x2) / 2;

            // Generate Bezier Curves
            // Curve 1: From (x1, y1) up to (mergeX, mergeY)
            // Control points: 
            // C1_start: (x1, (y1 + mergeY) / 2) -> Vertical up from start
            // C1_end: (mergeX, (y1 + mergeY) / 2) -> Horizontal to merge??
            // Better organic tree feel: Vertical start, then bend to target.
            // S-curve logic: Move vertically half-way, then horizontally?

            // Let's try simple cubic bezier:
            // Start P0: (x1, y1)
            // Control P1: (x1, (y1 + mergeY) / 2)  -- Go up
            // Control P2: (mergeX, (y1 + mergeY) / 2) -- Align with center
            // End P3: (mergeX, mergeY)

            const path1 = `M ${x1} ${y1} C ${x1} ${(y1 + mergeY) / 2}, ${mergeX} ${(y1 + mergeY) / 2}, ${mergeX} ${mergeY}`;
            const path2 = `M ${x2} ${y2} C ${x2} ${(y2 + mergeY) / 2}, ${mergeX} ${(y2 + mergeY) / 2}, ${mergeX} ${mergeY}`;

            // Full path for this link (both legs)
            const d = `${path1} ${path2}`;

            return {
                id: i,
                d,
                mergeX,
                mergeY,
                dist: ys[1],
                // For subtree highlighting, we might need to know children?
                // Just highlighting the link itself + tooltip is a good start. Be fancy with color.
            };
        });
    }, [icoord, dcoord, minX, maxX, maxY]);

    // Grid lines
    const gridLines = useMemo(() => {
        const count = 5;
        return Array.from({ length: count + 1 }, (_, i) => {
            const val = (maxY / count) * i;
            return {
                value: val,
                y: scaleY(val)
            };
        });
    }, [maxY]);

    // Leaf Labels
    const leafLabels = useMemo(() => {
        return ivl.map((label, i) => {
            // The X position for the i-th leaf is typically derived from the minX + offset logic
            // In scipy, if leaves are evenly spaced:
            // x coord of leaves usually corresponds to x[0] or x[3] where y=0.
            // But we can just space them evenly across standard X range?
            // "icoord" refers to the plot coordinates which are 5, 15, 25 etc.
            // Let's trust the "scaleX" function on the bottom-most points?
            // Actually, we can just place them at scaleX(minX + i*10) as before if we assume 10-step.
            // But let's be more robust. The leaves are at y=0.
            // Let's assume standard 10-unit spacing is correct for Scipy.

            const x = scaleX(minX + i * 10);
            return { label, x, y: contentHeight + 15 };
        });
    }, [ivl, minX, maxX]);

    return (
        <Box sx={{ width: '100%', mt: 4, position: 'relative' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 2, px: 1 }}>
                <Box>
                    <Typography variant="h6" sx={{
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                        background: 'linear-gradient(135deg, #FFF 30%, #94A3B8 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        color: 'transparent',
                    }}>
                        Asset Clustering
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', opacity: 0.7 }}>
                        Hierarchical Risk Structure
                    </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontFamily: 'monospace' }}>
                        MAX DISTANCE
                    </Typography>
                    <Typography variant="h5" sx={{ fontFamily: 'monospace', lineHeight: 1, color: '#F1F5F9' }}>
                        {maxY.toFixed(2)}
                    </Typography>
                </Box>
            </Box>

            {/* Chart Container */}
            <Paper
                elevation={0}
                sx={{
                    p: 4,
                    pt: 6,
                    borderRadius: 6,
                    // Modern Dark Glass Effect
                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                    overflow: 'visible', // allow labels to stick out
                    position: 'relative'
                }}
            >
                <svg
                    viewBox={`-${margin.left} -${margin.top} ${contentWidth + margin.left + margin.right} ${contentHeight + margin.top + margin.bottom}`}
                    style={{ width: '100%', height: 'auto', maxHeight: height, overflow: 'visible' }}
                >
                    <defs>
                        <linearGradient id="linkGradientVertical" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.8" />
                        </linearGradient>
                        <linearGradient id="linkGradientActive" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor="#F472B6" stopOpacity="1" />
                            <stop offset="100%" stopColor="#C084FC" stopOpacity="1" />
                        </linearGradient>

                        <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {/* Grid Lines */}
                    {gridLines.map((grid, i) => (
                        <g key={`grid-${i}`}>
                            <line
                                x1={0} y1={grid.y}
                                x2={contentWidth} y2={grid.y}
                                stroke="rgba(255,255,255,0.03)"
                                strokeWidth="1"
                            />
                            <text
                                x={-20}
                                y={grid.y}
                                fill="rgba(148, 163, 184, 0.5)"
                                fontSize="12"
                                textAnchor="end"
                                dominantBaseline="middle"
                                style={{ fontFamily: '"SF Mono", "Roboto Mono", monospace' }}
                            >
                                {grid.value.toFixed(1)}
                            </text>
                        </g>
                    ))}

                    {/* Y-Axis Label */}
                    <text
                        x={-50}
                        y={contentHeight / 2}
                        transform={`rotate(-90, -50, ${contentHeight / 2})`}
                        fill="rgba(148, 163, 184, 0.4)"
                        fontSize="12"
                        textAnchor="middle"
                        style={{ letterSpacing: '2px', fontWeight: 600 }}
                    >
                        DISSIMILARITY
                    </text>

                    {/* Links */}
                    {links.map((link) => {
                        const isActive = hoveredLink === link.id;
                        const isDimmed = hoveredLink !== null && !isActive;

                        return (
                            <g
                                key={link.id}
                                style={{
                                    opacity: isDimmed ? 0.15 : 1, // Stronger dimming
                                    transition: 'opacity 0.4s ease'
                                }}
                                onMouseEnter={() => {
                                    setHoveredLink(link.id);
                                    setTooltipData({
                                        x: link.mergeX,
                                        y: link.mergeY,
                                        value: link.dist
                                    });
                                }}
                                onMouseLeave={() => {
                                    setHoveredLink(null);
                                    setTooltipData(null);
                                }}
                            >
                                {/* Invisible thick path for easier hovering */}
                                <path
                                    d={link.d}
                                    fill="none"
                                    stroke="transparent"
                                    strokeWidth={15}
                                    style={{ cursor: 'pointer' }}
                                />

                                {/* Visible Path */}
                                <path
                                    d={link.d}
                                    fill="none"
                                    stroke={isActive ? "url(#linkGradientActive)" : "url(#linkGradientVertical)"}
                                    strokeWidth={isActive ? 3 : 1.5}
                                    strokeLinecap="round"
                                    filter={isActive ? "url(#glowEffect)" : ""}
                                    style={{
                                        transition: 'stroke 0.3s, stroke-width 0.3s',
                                        pointerEvents: 'none' // Let the thick path handle events
                                    }}
                                />

                                {/* Merge Node Circle */}
                                <circle
                                    cx={link.mergeX}
                                    cy={link.mergeY}
                                    r={isActive ? 6 : 3}
                                    fill={isActive ? "#FFF" : "#2DD4BF"}
                                    stroke={isActive ? "#F472B6" : "rgba(15, 23, 42, 0.5)"}
                                    strokeWidth={2}
                                    style={{ transition: 'all 0.3s ease', pointerEvents: 'none' }}
                                />
                            </g>
                        );
                    })}

                    {/* Leaf Labels (Assets) */}
                    {leafLabels.map((item, i) => (
                        <g key={i} transform={`translate(${item.x}, ${item.y})`}>
                            {/* Decorative tick */}
                            <line
                                x1={0} y1={-15}
                                x2={0} y2={-5}
                                stroke={hoveredLink !== null ? "rgba(255,255,255,0.1)" : "rgba(45, 212, 191, 0.5)"}
                                strokeWidth={1}
                            />

                            <text
                                transform="rotate(-45)"
                                textAnchor="end"
                                dominantBaseline="middle"
                                fill={hoveredLink !== null ? "rgba(148, 163, 184, 0.4)" : "#E2E8F0"}
                                fontSize="14"
                                style={{
                                    fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                                    fontWeight: 600,
                                    cursor: 'default',
                                    transition: 'fill 0.3s'
                                }}
                            >
                                {item.label}
                            </text>
                        </g>
                    ))}

                    {/* Tooltip Overlay */}
                    {tooltipData && (
                        <g transform={`translate(${tooltipData.x}, ${tooltipData.y - 15})`} style={{ pointerEvents: 'none' }}>
                            <defs>
                                <filter id="tooltipShadow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="black" floodOpacity="0.5" />
                                </filter>
                            </defs>
                            <path
                                d="M -30 -30 H 30 A 4 4 0 0 1 34 -26 V -6 A 4 4 0 0 1 30 -2 L 5 -2 L 0 4 L -5 -2 L -30 -2 A 4 4 0 0 1 -34 -6 V -26 A 4 4 0 0 1 -30 -30 Z"
                                fill="#1E293B"
                                stroke="#F472B6"
                                strokeWidth="1.5"
                                filter="url(#tooltipShadow)"
                            />
                            <text
                                x="0" y="-16"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#FFFFFF"
                                fontSize="12"
                                fontWeight="bold"
                            >
                                {tooltipData.value.toFixed(3)}
                            </text>
                        </g>
                    )}
                </svg>
            </Paper>

            {/* Legend / Info */}
            <Box sx={{ mt: 3, display: 'flex', gap: 3, justifyContent: 'center', opacity: 0.8 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ w: 8, h: 8, borderRadius: '50%', bgcolor: '#2DD4BF', width: 8, height: 8 }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Similar Assets (Low Height)</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ w: 8, h: 8, borderRadius: '50%', bgcolor: '#A78BFA', width: 8, height: 8 }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Dissimilar Groups (High Height)</Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default DendrogramChart;
