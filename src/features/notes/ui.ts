import { parseMarkdownKeepSource } from '@/shared/utils/ui/markdown';

/** コンテキスト（タスク/日次）に応じたパネルタイトルを生成する (Pure) */
export function createPanelTitle(contextTitle: string, type: 'task' | 'daily'): string {
    return type === 'task' ? `Task: ${contextTitle}` : `Daily: ${contextTitle}`;
}

/**
 * ノートの表示タイトル（ヘッダー用）を決定する (Pure)
 * @param type ノートのタイプ ('task' | 'daily')
 * @param taskText 紐づくタスクのテキスト（任意）
 * @param date ノートの日付（任意）
 */
export function getDisplayTitle(type: 'task' | 'daily', taskText?: string, date?: string): string {
    if (type === 'task') {
        return taskText || '無題のノート';
    } else {
        return date || '無題のノート';
    }
}

/** MarkdownをパースしてHTML文字列を生成する（utilsをラップ） (Pure) */
export function parseToHtml(markdown: string): string {
    return parseMarkdownKeepSource(markdown);
}
