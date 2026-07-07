import { parseMarkdown } from '@/shared/utils/ui/markdown';

/** 編集/プレビューモードに応じたボタンラベルを生成する (Pure) */
export function getToggleBtnLabel(isEditMode: boolean): string {
    return isEditMode ? '👀 プレビュー (Ctrl+P)' : '✍ 編集モード (Ctrl+P)';
}

/** コンテキスト（タスク/日次）に応じたパネルタイトルを生成する (Pure) */
export function createPanelTitle(contextTitle: string, type: 'task' | 'daily'): string {
    return type === 'task' ? `Task: ${contextTitle}` : `Daily: ${contextTitle}`;
}

/** MarkdownをパースしてHTML文字列を生成する（utilsをラップ） (Pure) */
export function parseToHtml(markdown: string): string {
    return parseMarkdown(markdown);
}
