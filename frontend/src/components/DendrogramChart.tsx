import React, { useMemo, useState, useEffect } from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';

interface DendrogramData {
    icoord: number[][];
    dcoord: number[][];
    ivl: string[];
    leaves: number[];
}

interface DendrogramChartProps {
    data: DendrogramData;
    height?: number;
    weights?: Record<string, number>; // Optional: HRP weights for each ticker
}

// Color interpolation helper
const interpolateColor = (ratio: number): string => {
    // Green (similar) → Yellow → Red (dissimilar)
    // ratio: 0 = green, 0.5 = yellow, 1 = red
    if (ratio < 0.5) {
        // Green to Yellow
        const t = ratio * 2;
        const r = Math.round(16 + (234 - 16) * t);
        const g = Math.round(185 + (179 - 185) * t);
        const b = Math.round(129 + (8 - 129) * t);
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        // Yellow to Red
        const t = (ratio - 0.5) * 2;
        const r = Math.round(234 + (239 - 234) * t);
        const g = Math.round(179 + (68 - 179) * t);
        const b = Math.round(8 + (68 - 8) * t);
        return `rgb(${r}, ${g}, ${b})`;
    }
};

// Get correlation interpretation
const getCorrelationLabel = (dist: number, maxDist: number): string => {
    const ratio = dist / maxDist;
    if (ratio < 0.2) return 'Highly Similar';
    if (ratio < 0.4) return 'Similar';
    if (ratio < 0.6) return 'Moderately Different';
    if (ratio < 0.8) return 'Different';
    return 'Very Different';
};

const DendrogramChart: React.FC<DendrogramChartProps> = ({ data, height = 500, weights = {} }) => {
    const { icoord, dcoord, ivl } = data;
    const [hoveredLink, setHoveredLink] = useState<number | null>(null);
    const [hoveredSubtree, setHoveredSubtree] = useState<Set<number>>(new Set());
    const [isAnimated, setIsAnimated] = useState(false);

    // Trigger animation on mount
    useEffect(() => {
        const timer = setTimeout(() => setIsAnimated(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Margins and Dimensions
    const margin = { top: 60, right: 40, bottom: 140, left: 80 };
    const contentWidth = 1000;
    const contentHeight = 500;

    // Bounds calculation
    const allX = icoord.flat();
    const allY = dcoord.flat();
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);

    // Scales
    const scaleX = (x: number) => ((x - minX) / (maxX - minX)) * contentWidth;
    const scaleY = (y: number) => contentHeight - ((y / maxY) * contentHeight);

    // Process Links with distance-based coloring
    const links = useMemo(() => {
        return icoord.map((xs, i) => {
            const ys = dcoord[i];

            const x1 = scaleX(xs[0]);
            const y1 = scaleY(ys[0]);
            const x2 = scaleX(xs[3]);
            const y2 = scaleY(ys[3]);
            const mergeY = scaleY(ys[1]);
            const mergeX = (x1 + x2) / 2;
            const dist = ys[1];

            // Color based on distance
            const colorRatio = dist / maxY;
            const color = interpolateColor(colorRatio);

            // Bezier paths
            const path1 = `M ${x1} ${y1} C ${x1} ${(y1 + mergeY) / 2}, ${mergeX} ${(y1 + mergeY) / 2}, ${mergeX} ${mergeY}`;
            const path2 = `M ${x2} ${y2} C ${x2} ${(y2 + mergeY) / 2}, ${mergeX} ${(y2 + mergeY) / 2}, ${mergeX} ${mergeY}`;
            const d = `${path1} ${path2}`;

            // Animation delay based on height (lower = earlier)
            const animDelay = (1 - (dist / maxY)) * 0.8; // 0 to 0.8 seconds

            return {
                id: i,
                d,
                x1, y1, x2, y2,
                mergeX,
                mergeY,
                dist,
                color,
                animDelay,
                colorRatio
            };
        });
    }, [icoord, dcoord, minX, maxX, maxY]);

    // Handle hover with subtree
    const handleLinkHover = (linkId: number | null) => {
        setHoveredLink(linkId);
        if (linkId !== null) {
            // Find all child links
            const children = new Set<number>([linkId]);
            const link = links[linkId];

            // Simple child finding based on position
            links.forEach((otherLink, j) => {
                if (j !== linkId && otherLink.dist < link.dist) {
                    const thisMinX = Math.min(link.x1, link.x2);
                    const thisMaxX = Math.max(link.x1, link.x2);
                    if (otherLink.mergeX >= thisMinX - 50 && otherLink.mergeX <= thisMaxX + 50) {
                        children.add(j);
                    }
                }
            });
            setHoveredSubtree(children);
        } else {
            setHoveredSubtree(new Set());
        }
    };

    // Grid lines with interpretation labels
    const gridLines = useMemo(() => {
        const labels = ['Identical', 'Similar', 'Moderate', 'Different', 'Uncorrelated'];
        return [0, 0.25, 0.5, 0.75, 1].map((ratio, i) => ({
            value: maxY * ratio,
            y: scaleY(maxY * ratio),
            label: labels[i],
            color: interpolateColor(ratio)
        }));
    }, [maxY]);

    // Leaf Labels with enhanced styling - evenly spaced at bottom
    const leafLabels = useMemo(() => {
        const numLabels = ivl.length;
        const spacing = contentWidth / (numLabels > 1 ? numLabels - 1 : 1);

        return ivl.map((label, i) => {
            // Calculate X position: evenly spaced across the width
            const x = numLabels === 1 ? contentWidth / 2 : i * spacing;
            const weight = weights[label] || 0;
            return {
                label,
                x,
                y: contentHeight + 25,
                weight,
                size: Math.max(8, Math.min(24, weight * 60))
            };
        });
    }, [ivl, contentWidth, weights]);

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
                        🌳 Asset Clustering
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', opacity: 0.7 }}>
                        Hierarchical structure showing asset similarity • Hover to explore
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
                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                    overflow: 'visible',
                    position: 'relative'
                }}
            >
                {/* CSS for animations */}
                <style>{`
                    @keyframes drawPath {
                        from {
                            stroke-dashoffset: 1000;
                            opacity: 0;
                        }
                        to {
                            stroke-dashoffset: 0;
                            opacity: 1;
                        }
                    }
                    @keyframes fadeInUp {
                        from {
                            opacity: 0;
                            transform: translateY(10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    @keyframes pulseGlow {
                        0%, 100% { filter: drop-shadow(0 0 4px currentColor); }
                        50% { filter: drop-shadow(0 0 12px currentColor); }
                    }
                `}</style>

                <svg
                    viewBox={`-${margin.left} -${margin.top} ${contentWidth + margin.left + margin.right} ${contentHeight + margin.top + margin.bottom}`}
                    style={{ width: '100%', height: 'auto', maxHeight: height, overflow: 'visible' }}
                >
                    <defs>
                        <filter id="glowEffectEnhanced" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="6" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                        <filter id="subtreeGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {/* Grid Lines with Labels */}
                    {gridLines.map((grid, i) => (
                        <g key={`grid-${i}`}>
                            <line
                                x1={0} y1={grid.y}
                                x2={contentWidth} y2={grid.y}
                                stroke="rgba(255,255,255,0.04)"
                                strokeWidth="1"
                                strokeDasharray={i === 0 ? "none" : "4,4"}
                            />
                            {/* Distance value */}
                            <text
                                x={-15}
                                y={grid.y}
                                fill="rgba(148, 163, 184, 0.6)"
                                fontSize="11"
                                textAnchor="end"
                                dominantBaseline="middle"
                                style={{ fontFamily: '"SF Mono", monospace' }}
                            >
                                {grid.value.toFixed(2)}
                            </text>
                            {/* Interpretation label */}
                            <text
                                x={contentWidth + 10}
                                y={grid.y}
                                fill={grid.color}
                                fontSize="10"
                                textAnchor="start"
                                dominantBaseline="middle"
                                style={{ fontFamily: '"Inter", sans-serif', fontWeight: 500 }}
                            >
                                {grid.label}
                            </text>
                        </g>
                    ))}

                    {/* Y-Axis Label */}
                    <text
                        x={-65}
                        y={contentHeight / 2}
                        transform={`rotate(-90, -65, ${contentHeight / 2})`}
                        fill="rgba(148, 163, 184, 0.5)"
                        fontSize="12"
                        textAnchor="middle"
                        style={{ letterSpacing: '2px', fontWeight: 600 }}
                    >
                        DISSIMILARITY →
                    </text>

                    {/* Links with animation and color-coding */}
                    {links.map((link) => {
                        const isActive = hoveredLink === link.id;
                        const isInSubtree = hoveredSubtree.has(link.id);
                        const isDimmed = hoveredLink !== null && !isActive && !isInSubtree;

                        return (
                            <g
                                key={link.id}
                                style={{
                                    opacity: isAnimated ? (isDimmed ? 0.15 : 1) : 0,
                                    transition: 'opacity 0.4s ease',
                                    animation: isAnimated ? `drawPath 0.6s ease-out ${link.animDelay}s forwards` : 'none'
                                }}
                                onMouseEnter={() => handleLinkHover(link.id)}
                                onMouseLeave={() => handleLinkHover(null)}
                            >
                                {/* Invisible thick path for easier hovering */}
                                <path
                                    d={link.d}
                                    fill="none"
                                    stroke="transparent"
                                    strokeWidth={20}
                                    style={{ cursor: 'pointer' }}
                                />

                                {/* Glow layer for active/subtree */}
                                {(isActive || isInSubtree) && (
                                    <path
                                        d={link.d}
                                        fill="none"
                                        stroke={link.color}
                                        strokeWidth={isActive ? 6 : 4}
                                        strokeLinecap="round"
                                        style={{
                                            opacity: 0.4,
                                            filter: 'blur(4px)'
                                        }}
                                    />
                                )}

                                {/* Visible Path with distance-based color */}
                                <path
                                    d={link.d}
                                    fill="none"
                                    stroke={isActive ? '#FFF' : link.color}
                                    strokeWidth={isActive ? 3.5 : isInSubtree ? 2.5 : 2}
                                    strokeLinecap="round"
                                    strokeDasharray="1000"
                                    strokeDashoffset={isAnimated ? 0 : 1000}
                                    style={{
                                        transition: 'stroke 0.3s, stroke-width 0.3s',
                                        pointerEvents: 'none'
                                    }}
                                />

                                {/* Merge Node Circle */}
                                <circle
                                    cx={link.mergeX}
                                    cy={link.mergeY}
                                    r={isActive ? 8 : isInSubtree ? 5 : 4}
                                    fill={isActive ? '#FFF' : link.color}
                                    stroke={isActive ? link.color : 'rgba(15, 23, 42, 0.8)'}
                                    strokeWidth={2}
                                    style={{
                                        transition: 'all 0.3s ease',
                                        pointerEvents: 'none',
                                        filter: isActive ? 'drop-shadow(0 0 8px ' + link.color + ')' : 'none'
                                    }}
                                />
                            </g>
                        );
                    })}

                    {/* Leaf Labels with Badge Style */}
                    {leafLabels.map((item, i) => (
                        <g
                            key={i}
                            transform={`translate(${item.x}, ${item.y})`}
                            style={{
                                opacity: 1,
                                transition: `opacity 0.5s ease-out ${0.5 + i * 0.1}s`
                            }}
                        >
                            {/* Decorative line */}
                            <line
                                x1={0} y1={-20}
                                x2={0} y2={-8}
                                stroke="rgba(45, 212, 191, 0.4)"
                                strokeWidth={2}
                                strokeLinecap="round"
                            />

                            {/* Weight indicator dot */}
                            {item.weight > 0 && (
                                <circle
                                    cx={0}
                                    cy={-25}
                                    r={item.size / 2}
                                    fill="rgba(45, 212, 191, 0.3)"
                                    stroke="#2DD4BF"
                                    strokeWidth={1}
                                >
                                    <title>{`${item.label}: ${(item.weight * 100).toFixed(1)}%`}</title>
                                </circle>
                            )}

                            {/* Ticker badge */}
                            <g transform="translate(0, 10) rotate(-35)">
                                <rect
                                    x={-30}
                                    y={-12}
                                    width={60}
                                    height={24}
                                    rx={12}
                                    fill="rgba(30, 41, 59, 0.9)"
                                    stroke="rgba(255, 255, 255, 0.1)"
                                    strokeWidth={1}
                                />
                                <text
                                    x={0}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="#E2E8F0"
                                    fontSize="13"
                                    style={{
                                        fontFamily: '"SF Mono", "Roboto Mono", monospace',
                                        fontWeight: 700,
                                        letterSpacing: '0.5px'
                                    }}
                                >
                                    {item.label}
                                </text>
                            </g>
                        </g>
                    ))}

                    {/* Enhanced Tooltip */}
                    {hoveredLink !== null && (
                        <g
                            transform={`translate(${links[hoveredLink].mergeX}, ${links[hoveredLink].mergeY - 20})`}
                            style={{ pointerEvents: 'none' }}
                        >
                            {/* Tooltip background */}
                            <rect
                                x={-75}
                                y={-55}
                                width={150}
                                height={50}
                                rx={8}
                                fill="rgba(15, 23, 42, 0.95)"
                                stroke={links[hoveredLink].color}
                                strokeWidth={2}
                                style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
                            />
                            {/* Pointer */}
                            <polygon
                                points="-8,0 8,0 0,10"
                                fill="rgba(15, 23, 42, 0.95)"
                                transform="translate(0, -5)"
                            />

                            {/* Distance value */}
                            <text
                                x={0} y={-38}
                                textAnchor="middle"
                                fill="#FFFFFF"
                                fontSize="16"
                                fontWeight="bold"
                                style={{ fontFamily: '"SF Mono", monospace' }}
                            >
                                {links[hoveredLink].dist.toFixed(3)}
                            </text>

                            {/* Interpretation */}
                            <text
                                x={0} y={-20}
                                textAnchor="middle"
                                fill={links[hoveredLink].color}
                                fontSize="11"
                                fontWeight="600"
                            >
                                {getCorrelationLabel(links[hoveredLink].dist, maxY)}
                            </text>
                        </g>
                    )}
                </svg>
            </Paper>

            {/* Enhanced Legend */}
            <Box sx={{
                mt: 3,
                display: 'flex',
                gap: 2,
                justifyContent: 'center',
                alignItems: 'center',
                flexWrap: 'wrap'
            }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>
                    Distance Scale:
                </Typography>

                {/* Gradient bar */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    background: 'linear-gradient(90deg, #10B981, #EAB308, #EF4444)',
                    borderRadius: 4,
                    px: 2,
                    py: 0.5
                }}>
                    <Typography variant="caption" sx={{ color: '#000', fontWeight: 600 }}>
                        Similar
                    </Typography>
                    <Box sx={{ width: 60 }} />
                    <Typography variant="caption" sx={{ color: '#000', fontWeight: 600 }}>
                        Different
                    </Typography>
                </Box>

                <Chip
                    size="small"
                    label="Hover links to explore subtrees"
                    sx={{
                        bgcolor: 'rgba(255,255,255,0.05)',
                        color: 'text.secondary',
                        fontSize: '0.7rem'
                    }}
                />
            </Box>
        </Box>
    );
};

export default DendrogramChart;
