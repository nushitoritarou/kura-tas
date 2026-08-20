import { el } from '@/core/el';
import * as ui from './ui';
import { registerModal, isAnyModalOpen as isAnyRegisteredModalOpen, closeTopModal as closeTopRegisteredModal, getTopModalRoot as getTopRegisteredModalRoot } from '@/shared/utils/dom/modal';

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
 * 日付表示を更新する（休日・非稼働日の場合は小さなバッジを併記する）
 */
export function updateDateDisplay(
    dateStr: string,
    workDays: number[] = [1, 2, 3, 4, 5],
    holidays: string[] = []
): void {
    const status = ui.getDateDisplayStatus(dateStr, workDays, holidays);
    const label = ui.getDateStatusLabel(status);

    el.nav.dateText.textContent = ui.formatCurrentDate(dateStr);
    el.nav.dateStatusBadge.textContent = label;
    el.nav.dateStatusBadge.classList.toggle('holiday', status === 'holiday');
    el.nav.dateStatusBadge.classList.toggle('off', status === 'off');
    el.nav.dateStatusBadge.style.display = label ? 'inline-block' : 'none';
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
export function displayContextMenu(x: number, y: number, items: ui.ContextMenuItem[]): void {
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
    const childEls = el.common.contextMenu.children;
    items.forEach((item, idx) => {
        const itemEl = childEls[idx] as HTMLElement;
        if (!itemEl) return;
        if (item.type === 'priority') {
            const btns = itemEl.querySelectorAll('.btn-priority');
            btns.forEach(btn => {
                (btn as HTMLElement).onclick = (e) => {
                    e.stopPropagation();
                    const p = Number((btn as HTMLElement).dataset.priority);
                    if (!isNaN(p)) {
                        item.onSelectPriority(p);
                    }
                    closeMenu();
                };
            });
        } else {
            itemEl.onclick = () => {
                item.action();
                closeMenu();
            };
        }
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

const shortcutsModal = registerModal(el.modals.shortcuts.root);

/**
 * ショートカットモーダルの表示状態を切り替える
 */
export function toggleShortcutsModal(show: boolean): void {
    if (show) shortcutsModal.open(); else shortcutsModal.close();
}

/**
 * ショートカットモーダルが表示されているか判定する
 */
export function isShortcutsModalShown(): boolean {
    return shortcutsModal.isOpen();
}

const editTaskModal = registerModal(el.modals.editTask.root);

/**
 * タスク編集モーダルが表示されているか判定する
 */
export function isTaskEditModalShown(): boolean {
    return editTaskModal.isOpen();
}

/**
 * タスク編集モーダルをキャンセルして閉じる
 */
export function cancelTaskEditModal(): void {
    if (editTaskModal.isOpen()) {
        editTaskModal.close();
    }
}

/**
 * タスク名編集モーダルを表示し、入力されたテキストを返す (キャンセル時は null)
 * mode:
 *  'i': カーソルを先頭 (0) に配置
 *  'a' | 'A': カーソルを末尾 (length) に配置
 *  'c': テキストを全選択
 */
export function showTaskEditModal(initialText: string, mode: 'i' | 'a' | 'A' | 'c' = 'a'): Promise<string | null> {
    if (editTaskModal.isOpen()) {
        editTaskModal.close();
    }

    return new Promise((resolve) => {
        const input = el.modals.editTask.input;
        const btnSubmit = el.modals.editTask.btnSubmit;
        const btnClose = el.modals.editTask.btnClose;

        input.value = initialText;

        const applyFocus = () => {
            input.focus();
            if (mode === 'i') {
                input.setSelectionRange(0, 0);
            } else if (mode === 'c') {
                input.select();
            } else {
                input.setSelectionRange(initialText.length, initialText.length);
            }
        };

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    applyFocus();
                });
            });
        } else {
            setTimeout(applyFocus, 50);
        }

        const cleanup = () => {
            btnSubmit.onclick = null;
            btnClose.onclick = null;
            input.onkeydown = null;
        };

        const handleSave = () => {
            const val = input.value;
            cleanup();
            editTaskModal.setOnClose(undefined);
            editTaskModal.close();
            resolve(val);
        };

        const handleCancel = () => {
            cleanup();
            resolve(null);
        };

        editTaskModal.setOnClose(handleCancel);
        editTaskModal.open();

        btnSubmit.onclick = handleSave;
        btnClose.onclick = () => editTaskModal.close();

        input.onkeydown = (e) => {
            if (e.isComposing) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                editTaskModal.close();
            }
        };
    });
}

/**
 * 登録済みのいずれかのモーダルが開いているか判定する
 * (wiring層は shared/utils/dom を直接参照できないため、renderer 経由で公開する)
 */
export function isAnyModalOpen(): boolean {
    return isAnyRegisteredModalOpen();
}

/** 最前面（最後に開かれた）モーダルの root 要素を取得する */
export function getTopModalRoot(): HTMLElement | null {
    return getTopRegisteredModalRoot();
}

/** 最前面のモーダルを閉じる。閉じるモーダルが無ければ false を返す */
export function closeTopModal(): boolean {
    return closeTopRegisteredModal();
}
