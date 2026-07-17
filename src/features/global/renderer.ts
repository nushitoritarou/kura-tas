import { el } from '@/core/el';
import * as ui from './ui';

/**
 * GlobalなUI操作の手続き（副作用あり）
 */

/**
 * セットアップ画面を非表示にし、メイン画面を表示する
 */
export function showAppContainer(): void {
    el.setup.overlay.style.display = 'none';
    el.app.container.classList.remove('hidden');
}

/**
 * 保存されたディレクトリがある場合に再開用UIを表示する
 */
export function showResumeContainer(dirName: string): void {
    el.setup.lastDirName.textContent = dirName;
    el.setup.resumeContainer.classList.remove('hidden');
}

/**
 * バージョン情報を表示する
 */
export function displayVersion(version: string, isDebug: boolean, commitHash: string = 'unknown', buildTime: string = 'unknown'): void {
    const versionText = ui.formatVersionText(version, isDebug, commitHash, buildTime);
    const documentTitle = ui.formatDocumentTitle(version);

    el.app.version.forEach(element => {
        element.style.display = 'inline';
        element.textContent = versionText;
    });
    document.title = documentTitle;
}

/**
 * 日付表示を更新する
 */
export function updateDateDisplay(dateStr: string): void {
    el.nav.dateDisplay.textContent = ui.formatCurrentDate(dateStr);
}

/**
 * Undo/Redoボタンの状態（有効/無効）を更新する
 */
export function updateUndoRedoButtons(canUndo: boolean, canRedo: boolean): void {
    el.nav.btnUndo.disabled = !canUndo;
    el.nav.btnRedo.disabled = !canRedo;
}

/**
 * 右クリックメニューを表示する
 */
export function displayContextMenu(x: number, y: number, items: { label: string, action: () => void }[]): void {
    el.common.contextMenu.innerHTML = ui.generateContextMenuHtml(items);
    
    // 一旦表示してサイズを取得
    el.common.contextMenu.style.display = 'block';
    el.common.contextMenu.style.visibility = 'hidden';

    const menuW = el.common.contextMenu.offsetWidth;
    const menuH = el.common.contextMenu.offsetHeight;
    
    const pos = ui.calculateMenuPosition(x, y, menuW, menuH, window.innerWidth, window.innerHeight);

    el.common.contextMenu.style.left = `${pos.x}px`;
    el.common.contextMenu.style.top = `${pos.y}px`;
    el.common.contextMenu.style.visibility = 'visible';

    // メニュー外クリックまたはメニュー項目クリックで閉じるための共通処理
    const closeMenu = () => {
        el.common.contextMenu.style.display = 'none';
        document.removeEventListener('mousedown', onMouseDownOutside);
    };

    const onMouseDownOutside = (e: MouseEvent) => {
        if (!el.common.contextMenu.contains(e.target as Node)) {
            closeMenu();
        }
    };

    // アクションの紐付け
    const itemEls = el.common.contextMenu.querySelectorAll('.menu-item');
    items.forEach((item, idx) => {
        (itemEls[idx] as HTMLElement).onclick = () => {
            item.action();
            closeMenu();
        };
    });

    document.addEventListener('mousedown', onMouseDownOutside);
}

/**
 * ユーザーにテキスト入力を求めるダイアログを表示する
 */
export function promptUser(message: string, defaultValue: string = ''): string | null {
    return prompt(message, defaultValue);
}

/**
 * ユーザーに確認を求めるダイアログを表示する
 */
export function confirmAction(message: string): boolean {
    return confirm(message);
}

/**
 * ユーザーにエラーを通知する
 */
export function notifyError(message: string): void {
    alert(message);
}
