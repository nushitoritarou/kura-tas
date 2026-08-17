/**
 * Globalな表示に関連する純粋な設計図（副作用なし）
 */

/**
 * 日付の稼働状態を表す種別
 * work: 通常の稼働日 / holiday: 個別指定された休日 / off: 稼働日設定に含まれない曜日
 */
export type DateDisplayStatus = 'work' | 'holiday' | 'off';

/**
 * 指定日が稼働日/休日/非稼働日のいずれかを判定する
 */
export function getDateDisplayStatus(
    dateStr: string,
    workDays: number[] = [1, 2, 3, 4, 5],
    holidays: string[] = []
): DateDisplayStatus {
    if (holidays.includes(dateStr)) {
        return 'holiday';
    }
    // タイムゾーン問題を避けるため、時刻を指定してローカルとしてパースする
    const d = new Date(`${dateStr}T00:00:00`);
    if (!workDays.includes(d.getDay())) {
        return 'off';
    }
    return 'work';
}

/**
 * 表示用の日付文字列を生成する (例: 2026-05-31 (日)、休日/非稼働日はラベル付き)
 */
export function formatCurrentDate(dateStr: string, status: DateDisplayStatus = 'work'): string {
    // タイムゾーン問題を避けるため、時刻を指定してローカルとしてパースする
    const d = new Date(`${dateStr}T00:00:00`);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayName = days[d.getDay()];
    const label = status === 'holiday' ? ' [休日]' : status === 'off' ? ' [非稼働日]' : '';
    return `${dateStr} (${dayName})${label}`;
}

export type ContextMenuItem = 
    | { type?: 'item'; label: string; action: () => void }
    | { type: 'priority'; currentPriority?: number; onSelectPriority: (priority: number) => void };

/**
 * 共通右クリックメニューのHTMLを生成する
 */
export function generateContextMenuHtml(items: ContextMenuItem[]): string {
    return items
        .map(item => {
            if (item.type === 'priority') {
                const buttons = [1, 2, 3, 4, 5].map(p => {
                    const isActive = item.currentPriority === p ? 'active' : '';
                    return `<button type="button" class="btn-priority ${isActive}" data-priority="${p}">${p}</button>`;
                }).join('');
                return `
                    <div class="menu-item-priority" data-menu-type="priority">
                        <span class="priority-label">優先度:</span>
                        <div class="priority-buttons">${buttons}</div>
                    </div>
                `;
            }
            return `<div class="menu-item" data-menu-type="item">${item.label}</div>`;
        })
        .join('');
}

/**
 * コンテキストメニューの表示位置を計算する（はみ出し防止ロジック）
 */
export function calculateMenuPosition(
    clickX: number, 
    clickY: number, 
    menuWidth: number, 
    menuHeight: number, 
    windowWidth: number, 
    windowHeight: number
): { x: number, y: number } {
    let x = clickX;
    let y = clickY;

    if (clickX + menuWidth > windowWidth) {
        x = clickX - menuWidth;
    }
    if (clickY + menuHeight > windowHeight) {
        y = clickY - menuHeight;
    }

    // 負数にならないようにガード
    return {
        x: Math.max(0, x),
        y: Math.max(0, y)
    };
}

/**
 * 表示用のバージョン文字列を生成する
 */
export function formatVersionText(
    version: string,
    isDebug: boolean,
    commitHash: string = 'unknown',
    buildTime: string = 'unknown'
): string {
    if (isDebug) {
        return `v${version} (commit: ${commitHash}, built: ${buildTime})`;
    }
    return `v${version}`;
}

/**
 * 表示用のドキュメントタイトルを生成する
 */
export function formatDocumentTitle(version: string): string {
    return `Kura-Tas v${version}`;
}

