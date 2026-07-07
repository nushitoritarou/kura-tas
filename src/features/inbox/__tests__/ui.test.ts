import { describe, it, expect } from 'vitest';
import * as ui from '../ui';

describe('features/inbox/ui', () => {
    it('generateInboxItemHtml escapes HTML to prevent XSS (including attributes)', () => {
        const item = { id: '1', text: '<script>alert("xss")</script> ` = /' };
        const html = ui.generateInboxItemHtml(item);
        
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&#x2F;'); // slash
        expect(html).toContain('&#x60;'); // backtick
        expect(html).toContain('&#x3D;'); // equals
    });

    it('generateInboxListHtml returns empty message when list is empty', () => {
        const html = ui.generateInboxListHtml([]);
        expect(html).toContain('（項目はありません）');
    });

    it('generateInboxListHtml returns joined items', () => {
        const items = [
            { id: '1', text: 'Item 1' },
            { id: '2', text: 'Item 2' }
        ];
        const html = ui.generateInboxListHtml(items);
        
        expect(html).toContain('Item 1');
        expect(html).toContain('Item 2');
        expect(html.split('inbox-item').length).toBe(3); // 2 items + last part
    });
});
