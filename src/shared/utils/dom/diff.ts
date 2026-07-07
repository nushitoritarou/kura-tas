/**
 * DOM 差分更新ユーティリティ
 */

/**
 * 指定したコンテナ内の DOM を新しい HTML 文字列に基づいて差分更新する。
 * data-id 属性をキーとして要素を再利用し、フォーカスや入力を維持する。
 */
export function patch(container: HTMLElement, newHtml: string): void {
    const activeElement = document.activeElement as HTMLElement;
    const activeId = activeElement?.closest('[data-id]')?.getAttribute('data-id');
    const activeSelector = getSelectorInParent(activeElement);

    const parser = new DOMParser();
    const doc = parser.parseFromString(newHtml, 'text/html');
    const newNodes = Array.from(doc.body.children) as HTMLElement[];

    // 既存のノードを data-id でマップ化
    const existingNodes = new Map<string, HTMLElement>();
    for (const child of Array.from(container.children) as HTMLElement[]) {
        const id = child.getAttribute('data-id');
        if (id) {
            existingNodes.set(id, child);
        }
    }

    let lastProcessedNode: Node | null = null;

    for (const newNode of newNodes) {
        const id = newNode.getAttribute('data-id');
        const existingNode = id ? existingNodes.get(id) : null;

        if (existingNode) {
            // 同一 ID の要素があれば同期して再利用
            syncNode(existingNode, newNode);
            
            // 順序が異なる場合は移動
            const expectedNext = lastProcessedNode ? lastProcessedNode.nextSibling : container.firstChild;
            if (existingNode !== expectedNext) {
                container.insertBefore(existingNode, expectedNext);
            }
            lastProcessedNode = existingNode;
            existingNodes.delete(id!);
        } else {
            // 新規要素を挿入
            const insertBeforeNode = lastProcessedNode ? lastProcessedNode.nextSibling : container.firstChild;
            // newNode は parser の document に属しているため、importNode は不要（現在の DOM に移動される）
            container.insertBefore(newNode, insertBeforeNode);
            lastProcessedNode = newNode;
        }
    }

    // 使われなくなったノードを削除
    for (const nodeToRemove of existingNodes.values()) {
        container.removeChild(nodeToRemove);
    }

    // フォーカスの復元
    if (activeId) {
        const parent = container.querySelector(`[data-id="${activeId}"]`);
        if (parent) {
            const elToFocus = activeSelector ? parent.querySelector(activeSelector) : parent;
            if (elToFocus instanceof HTMLElement && document.activeElement !== elToFocus) {
                elToFocus.focus();
            }
        }
    }
}

/**
 * 2つの要素の属性や状態を同期する
 */
function syncNode(oldEl: HTMLElement, newEl: HTMLElement): void {
    // クラス名の同期
    if (oldEl.className !== newEl.className) {
        oldEl.className = newEl.className;
    }

    // フォーム要素の状態同期
    syncFormState(oldEl, newEl);

    // 内容の更新（簡易的に innerHTML を比較）
    // TODO: より細かな差分更新が必要になった場合はここを拡張する
    if (oldEl.innerHTML !== newEl.innerHTML) {
        // innerHTML を直接変えると子要素のイベントリスナ等が死ぬ可能性があるが、
        // 現状の Kura-Tas はイベントデリゲーション主体なので許容範囲とする。
        // ただし、input 要素の状態は syncFormState で保護している。
        oldEl.innerHTML = newEl.innerHTML;
        // 再度 syncFormState を行い、innerHTML 置換で失われた状態を戻す
        syncFormState(oldEl, newEl);
    }
}

/**
 * input/textarea などの状態を同期する
 */
function syncFormState(oldEl: HTMLElement, newEl: HTMLElement): void {
    const oldInputs = oldEl.querySelectorAll('input, textarea, select');
    const newInputs = newEl.querySelectorAll('input, textarea, select');

    newInputs.forEach((newIn, i) => {
        const oldIn = oldInputs[i] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        if (!oldIn) return;

        if (oldIn instanceof HTMLInputElement && (oldIn.type === 'checkbox' || oldIn.type === 'radio')) {
            const newInCheck = newIn as HTMLInputElement;
            if (oldIn.checked !== newInCheck.checked) {
                oldIn.checked = newInCheck.checked;
            }
        } else {
            const newInValue = newIn as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
            if (oldIn.value !== newInValue.value) {
                oldIn.value = newInValue.value;
            }
        }
    });
}

/**
 * 親要素内での簡易的なセレクタを取得する（フォーカス復元用）
 */
function getSelectorInParent(el: HTMLElement | null): string | null {
    if (!el || !el.parentElement || el.hasAttribute('data-id')) return null;
    
    // タグ名とクラス名を用いた簡易セレクタ
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList).join('.');
    return classes ? `${tag}.${classes}` : tag;
}
