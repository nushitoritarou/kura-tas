/**
 * Inboxの表示操作（副作用あり）
 */
import { el } from '@/core/el';
import { InboxItem } from '@/types';
import * as ui from './ui';
import { patch } from '@/shared/utils/dom/diff';

/**
 * Inboxリストをレンダリングする
 */
export function renderInboxList(items: InboxItem[]): void {
    const html = ui.generateInboxListHtml(items);
    patch(el.inbox.list, html);
}

/**
 * 入力欄をクリアする
 */
export function clearInput(): void {
    el.inbox.input.value = '';
}
