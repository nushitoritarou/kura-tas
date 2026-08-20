import { el } from '@/core/el';
import { registerModal } from '@/shared/utils/dom/modal';

const aiMemoModal = registerModal(el.modals.aiMemo.root);

/**
 * AIメモ設定モーダルの表示状態を切り替える
 */
export function toggleAiMemoModal(show: boolean): void {
    if (show) aiMemoModal.open(); else aiMemoModal.close();
}

/**
 * 現在保存されているAIメモをテキストエリアへ反映する
 */
export function renderAiMemo(memo: string): void {
    el.modals.aiMemo.input.value = memo;
}
