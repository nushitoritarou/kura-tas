import { el } from '@/core/el';
import * as notesLogic from '@/features/notes/logic';
import * as notesRenderer from '@/features/notes/renderer';
import * as routineLogic from '@/features/routine/logic';
import * as globalRenderer from '@/features/global/renderer';
import { WiringContext } from './context';

export async function handleSaveNote(ctx: WiringContext): Promise<void> {
    try {
        const note = await notesLogic.getActiveNote({ notes: ctx.store.notes, ui: ctx.store.ui, tasks: ctx.store.tasks });
        if (note.body === el.notes.editor.value) {
            return;
        }
        await ctx.dispatchAction(async () => {
            const activeNote = await notesLogic.getActiveNote({ notes: ctx.store.notes, ui: ctx.store.ui, tasks: ctx.store.tasks });
            activeNote.body = el.notes.editor.value;
            await notesLogic.saveNote(activeNote, { notes: ctx.store.notes });
            notesRenderer.showSaveStatus('Saved');
        });
    } catch (e: any) {
        globalRenderer.notifyError(e.message || 'ノートの保存中にエラーが発生しました');
    }
}

/**
 * クリックされた画面上の位置から、Markdownテキスト全体の文字オフセットを計算する
 */
function getClickCharacterOffset(container: HTMLElement, e: MouseEvent): number {
    let range: Range | null = null;

    if (document.caretRangeFromPoint) {
        // Chrome, Safari, Edge
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
    } else if ((document as any).caretPositionFromPoint) {
        // Firefox 用
        const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
        if (pos) {
            range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.setEnd(pos.offsetNode, pos.offset);
        }
    }

    if (!range) return el.notes.editor.value.length; // 範囲取得できない場合は末尾に

    const targetNode = range.startContainer;
    const targetOffset = range.startOffset;

    let totalOffset = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
        const currentNode = walker.currentNode;
        if (currentNode === targetNode) {
            totalOffset += targetOffset;
            break;
        }
        // コピーボタン等のUIテキストは除外して積算する
        const parent = currentNode.parentElement;
        if (parent && (parent.closest('.btn-copy-code') || parent.tagName === 'BUTTON')) {
            continue;
        }
        totalOffset += currentNode.textContent?.length || 0;
    }

    return Math.min(totalOffset, el.notes.editor.value.length);
}

export async function switchToPreviewMode(ctx: WiringContext): Promise<void> {
    const uiState = ctx.store.ui.getState();
    if (!uiState.isEditMode) return;

    await handleSaveNote(ctx);
    const editor = el.notes.editor;
    const preview = el.notes.preview;
    const scrollRatio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    
    await ctx.dispatchAction(async () => {
        ctx.store.ui.update({ isEditMode: false });
    });

    // プレビューのスクロール位置を同期
    preview.scrollTop = scrollRatio * (preview.scrollHeight - preview.clientHeight);
}

export async function switchToEditMode(ctx: WiringContext, offset?: number): Promise<void> {
    const uiState = ctx.store.ui.getState();
    if (uiState.isEditMode) return;

    const preview = el.notes.preview;
    const editor = el.notes.editor;
    const previewScrollTop = preview.scrollTop;

    await ctx.dispatchAction(async () => {
        ctx.store.ui.update({ isEditMode: true });
    });

    // 1. 同期的にスクロール位置を一旦合わせる（表示された瞬間のフラッシュを防止）
    if (offset === undefined) {
        editor.scrollTop = editor.scrollHeight;
    } else {
        editor.scrollTop = previewScrollTop;
    }

    // 2. ブラウザがtextareaを確実にvisibleと認識してフォーカスできるように、僅かにディレイを入れて実行
    setTimeout(() => {
        editor.focus();
        if (offset !== undefined) {
            editor.setSelectionRange(offset, offset);
        } else {
            // eキー等による遷移時はカーソルを末尾に配置
            const len = editor.value.length;
            editor.setSelectionRange(len, len);
        }
        // 3. フォーカスによる自動スクロールのズレを上書きして再同期
        if (offset === undefined) {
            editor.scrollTop = editor.scrollHeight;
        } else {
            editor.scrollTop = previewScrollTop;
        }
    }, 30);
}

export async function toggleEditMode(ctx: WiringContext): Promise<void> {
    const uiState = ctx.store.ui.getState();
    if (uiState.isEditMode) {
        await switchToPreviewMode(ctx);
    } else {
        await switchToEditMode(ctx);
    }
}

export function wireNotes(ctx: WiringContext): void {
    el.notes.btnSave.onclick = async () => {
        await handleSaveNote(ctx);
    };

    el.notes.editor.onblur = async () => {
        await switchToPreviewMode(ctx);
    };

    el.notes.preview.onclick = async (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        // コピーボタンをクリックした場合の処理を一括ハンドリング
        const copyBtn = target.closest('.btn-copy-code') as HTMLButtonElement;
        if (copyBtn) {
            const container = copyBtn.closest('.md-codeblock-container');
            const body = container?.querySelector('.md-code-body') as HTMLElement;
            if (body) {
                try {
                    await navigator.clipboard.writeText(body.innerText);
                    copyBtn.innerText = 'Copied!';
                    setTimeout(() => { copyBtn.innerText = 'Copy'; }, 2000);
                } catch (err) {
                    console.error('Failed to copy text: ', err);
                }
            }
            return;
        }

        // リンクをクリックした場合はそのまま遷移させ、編集モードへ移行しない
        if (target.closest('a') || target.classList.contains('md-link-url')) {
            return;
        }

        const offset = getClickCharacterOffset(el.notes.preview, e);
        await switchToEditMode(ctx, offset);
    };

    const handlePromoteNote = async () => {
        const btnPromote = el.notes.btnPromote;
        const routineId = btnPromote?.dataset.routineId;
        if (!routineId) return;

        if (globalRenderer.confirmAction('このノートを定期タスクのテンプレートとして登録/更新しますか？\n（当日・未来の未編集のタスクノートにも反映されます）')) {
            await ctx.dispatchAction(async () => {
                const note = await notesLogic.getActiveNote({ notes: ctx.store.notes, ui: ctx.store.ui, tasks: ctx.store.tasks });
                note.body = el.notes.editor.value;
                
                // まず現在のノートを保存
                await notesLogic.saveNote(note, { notes: ctx.store.notes });

                // テンプレートに昇格
                await routineLogic.promoteNoteToTemplate(
                    routineId,
                    note.body,
                    { routine: ctx.store.routine, tasks: ctx.store.tasks, notes: ctx.store.notes, config: ctx.store.config }
                );
                
                notesRenderer.showSaveStatus('Promoted & Synced');
            });
        }
    };

    if (el.notes.btnPromote) {
        el.notes.btnPromote.onclick = handlePromoteNote;
    }
}
