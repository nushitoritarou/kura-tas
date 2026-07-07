/**
 * Inboxに関連する純粋な設計図（副作用なし）
 */
import { InboxItem } from '@/types';
import { escapeHTML } from '@/shared/utils/ui/strings';

/**
 * 個別項目のHTMLを生成する
 */
export function generateInboxItemHtml(item: InboxItem): string {
    return `
        <div class="inbox-item" data-id="${item.id}">
            <span class="inbox-text">${escapeHTML(item.text)}</span>
        </div>
    `.trim();
}

/**
 * リスト全体のHTMLを生成する
 */
export function generateInboxListHtml(items: InboxItem[]): string {
    if (items.length === 0) {
        return '<div class="muted-foreground" data-id="empty-inbox" style="padding: 10px; font-size: 12px;">（項目はありません）</div>';
    }
    return items.map(generateInboxItemHtml).join('');
}
