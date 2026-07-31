import { describe, it, expect } from 'vitest';
import * as ui from '../ui';

describe('features/global/ui', () => {
    it('formatCurrentDate returns formatted date with Japanese day name (handles timezone)', () => {
        // 時刻なしでパースするとUTCになる問題を解決できているか確認
        expect(ui.formatCurrentDate('2026-05-31')).toBe('2026-05-31 (日)');
        expect(ui.formatCurrentDate('2026-06-01')).toBe('2026-06-01 (月)');
        expect(ui.formatCurrentDate('2026-06-02')).toBe('2026-06-02 (火)');
    });

    it('generateContextMenuHtml returns menu item elements as string', () => {
        const items: ui.ContextMenuItem[] = [
            { label: 'Item 1', action: () => {} },
            { label: 'Item 2', action: () => {} },
            { type: 'priority', currentPriority: 3, onSelectPriority: () => {} }
        ];
        const html = ui.generateContextMenuHtml(items);
        expect(html).toContain('<div class="menu-item" data-menu-type="item">Item 1</div>');
        expect(html).toContain('<div class="menu-item" data-menu-type="item">Item 2</div>');
        expect(html).toContain('menu-item-priority');
        expect(html).toContain('class="btn-priority active" data-priority="3"');
    });

    describe('calculateMenuPosition', () => {
        it('returns original coordinates if within bounds', () => {
            const pos = ui.calculateMenuPosition(100, 100, 200, 150, 1000, 800);
            expect(pos).toEqual({ x: 100, y: 100 });
        });

        it('shifts x if overflowing horizontally', () => {
            const pos = ui.calculateMenuPosition(900, 100, 200, 150, 1000, 800);
            expect(pos).toEqual({ x: 700, y: 100 });
        });

        it('shifts y if overflowing vertically', () => {
            const pos = ui.calculateMenuPosition(100, 700, 200, 150, 1000, 800);
            expect(pos).toEqual({ x: 100, y: 550 });
        });

        it('ensures coordinates are not negative', () => {
            ui.calculateMenuPosition(50, 50, 200, 150, 1000, 800);
            // xがはみ出しても0以上に制限される（このテストケースでは本来はみ出さないが、もし狭い画面なら）
            const smallScreenPos = ui.calculateMenuPosition(10, 10, 100, 100, 50, 50);
            expect(smallScreenPos.x).toBe(0);
            expect(smallScreenPos.y).toBe(0);
        });
    });

    describe('version display', () => {
        it('formatVersionText returns normal version format when not in debug mode', () => {
            const text = ui.formatVersionText('2.0.3', false);
            expect(text).toBe('v2.0.3');
        });

        it('formatVersionText returns detailed format when in debug mode', () => {
            const text = ui.formatVersionText('2.0.3', true, 'abc123f', '2026/07/16 18:00');
            expect(text).toBe('v2.0.3 (commit: abc123f, built: 2026/07/16 18:00)');
        });

        it('formatDocumentTitle returns formatted document title', () => {
            const title = ui.formatDocumentTitle('2.0.3');
            expect(title).toBe('Kura-Tas v2.0.3');
        });
    });
});
