import React, { useState } from 'react';
import {
    Alert,
    Button,
    ButtonGroup,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Snackbar,
    Tooltip,
} from '@mui/material';
import {
    ArrowDropDown as ArrowDropDownIcon,
    ContentCopy as CopyIcon,
    DataObject as JsonIcon,
    Description as MarkdownIcon,
    IosShare as ExportIcon,
} from '@mui/icons-material';
import type { CompareResponse } from '../api/client';
import type { OptimizationParams } from '../hooks/useOptimization';
import type { GlobalRanking } from '../hooks/useRanking';
import { buildJsonExport, buildMarkdownReport, reportFileStem } from '../utils/exportReport';

interface ExportResultsButtonProps {
    results: CompareResponse;
    /** Parameters of the run on screen, so the report can state them. */
    params?: OptimizationParams | null;
    ranking?: GlobalRanking | null;
}

/**
 * Copy the text to the clipboard, with a fallback.
 *
 * `navigator.clipboard` does not exist outside a secure context, and the dev
 * server is plain http as soon as the app is opened from another machine on
 * the LAN. `execCommand('copy')` is deprecated but it is the only thing that
 * still works there — and an export button that silently does nothing is
 * worse than a deprecated call.
 */
async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // Permission denied or no secure context: try the legacy path below.
    }

    try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        return copied;
    } catch {
        return false;
    }
}

function downloadFile(filename: string, content: string, mime: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking in the same tick cancels the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "48 KB · ~12k tokens" — the two numbers that decide whether a paste fits. */
function describeSize(text: string): string {
    const kb = Math.max(1, Math.round(text.length / 1024));
    const tokens = text.length / 4;
    const budget = tokens >= 1000 ? `~${Math.round(tokens / 1000)}k tokens` : `~${Math.round(tokens)} tokens`;
    return `${kb} KB · ${budget}`;
}

/**
 * Exports the run on screen: the whole dashboard as one Markdown report meant
 * to be pasted into a conversation with an LLM, or either shape as a file.
 */
const ExportResultsButton: React.FC<ExportResultsButtonProps> = ({ results, params, ranking }) => {
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

    const closeMenu = () => setMenuAnchor(null);

    const handleCopy = async () => {
        closeMenu();
        const markdown = buildMarkdownReport({ results, params, ranking });
        const copied = await copyToClipboard(markdown);
        setToast(copied
            ? {
                message: `Report copied (${describeSize(markdown)}) — paste it into Claude, Gemini or any chat.`,
                severity: 'success',
            }
            : {
                message: 'The browser refused clipboard access. Use “Download report (.md)” instead.',
                severity: 'error',
            });
    };

    const handleDownload = (format: 'markdown' | 'json') => () => {
        closeMenu();
        const generatedAt = new Date();
        const stem = reportFileStem(results, generatedAt);
        const [content, filename, mime] = format === 'markdown'
            ? [buildMarkdownReport({ results, params, ranking, generatedAt }), `${stem}.md`, 'text/markdown']
            : [buildJsonExport({ results, params, ranking, generatedAt }), `${stem}.json`, 'application/json'];

        downloadFile(filename, content, mime);
        setToast({ message: `Saved ${filename} (${describeSize(content)}).`, severity: 'success' });
    };

    return (
        <>
            <ButtonGroup
                variant="outlined"
                size="small"
                sx={{
                    '& .MuiButton-root': {
                        borderColor: 'rgba(167, 139, 250, 0.4)',
                        color: '#C4B5FD',
                        textTransform: 'none',
                        fontWeight: 600,
                        '&:hover': { borderColor: '#A78BFA', bgcolor: 'rgba(167, 139, 250, 0.12)' },
                    },
                }}
            >
                {/* `describeChild`: without it MUI turns the tooltip into the
                    button's aria-label, and a screen reader announces a
                    160-character sentence instead of "Copy for AI". */}
                <Tooltip
                    describeChild
                    title="Copies the whole run — configuration, metrics, significance tests and the data behind every chart — as a Markdown report to paste into an AI conversation"
                >
                    <Button startIcon={<CopyIcon fontSize="small" />} onClick={handleCopy}>
                        Copy for AI
                    </Button>
                </Tooltip>
                <Tooltip describeChild title="Other export formats">
                    <Button
                        onClick={event => setMenuAnchor(event.currentTarget)}
                        aria-label="More export options"
                        aria-haspopup="menu"
                        sx={{ px: 0.5, minWidth: 32 }}
                    >
                        <ArrowDropDownIcon fontSize="small" />
                    </Button>
                </Tooltip>
            </ButtonGroup>

            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
                <MenuItem onClick={handleCopy}>
                    <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
                    <ListItemText
                        primary="Copy report for AI"
                        secondary="Markdown, to the clipboard"
                    />
                </MenuItem>
                <MenuItem onClick={handleDownload('markdown')}>
                    <ListItemIcon><MarkdownIcon fontSize="small" /></ListItemIcon>
                    <ListItemText
                        primary="Download report (.md)"
                        secondary="Same report as a file to attach"
                    />
                </MenuItem>
                <MenuItem onClick={handleDownload('json')}>
                    <ListItemIcon><JsonIcon fontSize="small" /></ListItemIcon>
                    <ListItemText
                        primary="Download raw data (.json)"
                        secondary="Full API payload, nothing rounded or sampled"
                    />
                </MenuItem>
            </Menu>

            <Snackbar
                open={Boolean(toast)}
                autoHideDuration={6000}
                onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {toast
                    ? <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled">
                        {toast.message}
                    </Alert>
                    : undefined}
            </Snackbar>
        </>
    );
};

export default ExportResultsButton;
