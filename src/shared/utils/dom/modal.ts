/**
 * モーダルの開閉・オーバーレイクリック・Escapeキーでの一括クローズを一元管理するユーティリティ
 *
 * モーダルの開閉状態は root 要素の style.display（'flex' か否か）を正とする。
 * 呼び出し元（テストコードを含む）が DOM を直接操作した場合でも整合が取れるよう、
 * 内部で独自の開閉状態を持たず、都度 DOM を参照して判定する。
 */

interface ModalEntry {
    root: HTMLElement;
    onClose?: () => void;
}

export interface ModalHandle {
    open(): void;
    close(): void;
    isOpen(): boolean;
    /** 呼び出しごとに閉じる際の追加処理を差し替える（Promiseベースの呼び出し元向け） */
    setOnClose(fn: (() => void) | undefined): void;
}

export interface RegisterModalOptions {
    /** close() が呼ばれた際に実行される追加処理（Promiseのresolve等） */
    onClose?: () => void;
    /** オーバーレイ（root自身）クリックで閉じるか。デフォルト true */
    closeOnOverlayClick?: boolean;
}

// 登録された全モーダル（登録順）。開閉状態はDOM(style.display)を都度参照して判定する。
const registeredModals: ModalEntry[] = [];

function isEntryOpen(entry: ModalEntry): boolean {
    return entry.root.style.display === 'flex';
}

function closeEntry(entry: ModalEntry): void {
    entry.root.style.display = 'none';
    entry.onClose?.();
}

/**
 * モーダルの root 要素を登録し、開閉ハンドルを返す。
 * オーバーレイクリックでの close は自動的に配線される。
 */
export function registerModal(root: HTMLElement, options: RegisterModalOptions = {}): ModalHandle {
    const entry: ModalEntry = { root, onClose: options.onClose };
    registeredModals.push(entry);
    const closeOnOverlayClick = options.closeOnOverlayClick ?? true;

    if (closeOnOverlayClick) {
        root.onclick = (e) => {
            if (e.target === root) {
                closeEntry(entry);
            }
        };
    }

    return {
        open(): void {
            root.style.display = 'flex';
        },
        close(): void {
            closeEntry(entry);
        },
        isOpen(): boolean {
            return isEntryOpen(entry);
        },
        setOnClose(fn: (() => void) | undefined): void {
            entry.onClose = fn;
        },
    };
}

/** いずれかの登録済みモーダルが開いているか */
export function isAnyModalOpen(): boolean {
    return registeredModals.some(isEntryOpen);
}

/**
 * 現在開いているモーダルの root 要素。
 * 複数開いていることは想定していないが、その場合は登録順で最後に見つかったものを返す。
 */
export function getTopModalRoot(): HTMLElement | null {
    for (let i = registeredModals.length - 1; i >= 0; i--) {
        if (isEntryOpen(registeredModals[i])) return registeredModals[i].root;
    }
    return null;
}

/** 開いているモーダルを閉じる。閉じるモーダルが無ければ false を返す */
export function closeTopModal(): boolean {
    for (let i = registeredModals.length - 1; i >= 0; i--) {
        if (isEntryOpen(registeredModals[i])) {
            closeEntry(registeredModals[i]);
            return true;
        }
    }
    return false;
}
