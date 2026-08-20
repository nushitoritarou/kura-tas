import { el } from '@/core/el';

/**
 * AIメモ設定モーダルの表示状態を切り替える
 */
export function toggleAiMemoModal(show: boolean): void {
    el.modals.aiMemo.root.style.display = show ? 'flex' : 'none';
}

/**
 * 現在保存されているAIメモをテキストエリアへ反映する
 */
export function renderAiMemo(memo: string): void {
    el.modals.aiMemo.input.value = memo;
}
