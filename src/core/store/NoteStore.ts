import { DirectoryStore } from '@/core/store/BaseStore';
import { storage } from '@/core/storage';
import { NoteMetadata, Note } from '@/types';
import { logger } from '@/core/logger';

export interface NoteStoreState {
    metadata: NoteMetadata[];
    notes: Record<string, Note>; // パース済みの Note オブジェクトをキャッシュ
}

/**
 * NoteStore - ノートのメタデータとパース済みの内容を保持するストア。
 * メモリ使用量を抑えるため、読み込まれたノートのみを notes にキャッシュする。
 * Undo/Redo 時は、キャッシュされているノートの状態をファイルシステムへ書き戻す。
 */
export class NoteStore extends DirectoryStore<NoteStoreState> {
    protected dirName = "notes";

    constructor() {
        super({ metadata: [], notes: {} });
    }

    /** Note ファイルのパース (Static Pure) */
    static parseNoteFile(content: string): { meta: Record<string, string>, body: string } {
        const meta: Record<string, string> = {};
        let body = content;

        if (content.startsWith('---')) {
            const parts = content.split('---');
            if (parts.length >= 3) {
                const frontmatterContent = parts[1].trim();
                body = parts.slice(2).join('---').trim();
                
                const lines = frontmatterContent.split('\n');
                for (const line of lines) {
                    const colonIndex = line.indexOf(':');
                    if (colonIndex !== -1) {
                        const key = line.slice(0, colonIndex).trim();
                        const val = line.slice(colonIndex + 1).trim();
                        if (key) meta[key] = val;
                    }
                }
            }
        }
        return { meta, body };
    }

    /** Note ファイルの構築 (Static Pure) */
    static buildFileContent(note: Note): string {
        const metadataMap: Record<string, string> = {
            title: note.title,
            date: note.date,
            type: note.type
        };
        if (note.taskId) {
            metadataMap.taskId = note.taskId;
        }

        let frontmatter = '---\n';
        for (const [key, val] of Object.entries(metadataMap)) {
            frontmatter += `${key}: ${val}\n`;
        }
        frontmatter += '---\n\n';
        return frontmatter + note.body;
    }

    async load() {
        let entries: { name: string, lastModified: number }[] = [];
        try {
            // notes/ フォルダをスキャンし、メタデータ（一覧）のみを構築する
            entries = await storage.listDirWithMeta(this.dirName);
        } catch (e) {
            logger.warn(`[NoteStore] Directory ${this.dirName} not found.`);
        }
        
        const metadata = entries
            .filter(e => e.name.endsWith('.md'))
            .map(e => ({
                id: e.name.replace('.md', ''),
                title: e.name.replace('.md', ''),
                updatedAt: new Date(e.lastModified).toISOString()
            }));
        
        this.state = { metadata, notes: {} };
    }

    /** メモリ(State) またはファイルから Note オブジェクトを取得する */
    async getNote(id: string, context: { date: string; taskId?: string }): Promise<Note> {
        // 1. キャッシュにあればそれを返す（クローンして参照を切り離す）
        if (this.state.notes[id]) {
            return { ...this.state.notes[id] };
        }

        // 2. なければファイルシステムから読み込む
        const content = await storage.readText(`${this.dirName}/${id}.md`);
        if (content !== null) {
            const { meta, body } = NoteStore.parseNoteFile(content);
            const note: Note = {
                id,
                title: meta.title || id,
                body,
                date: meta.date || context.date,
                type: (meta.type as 'task' | 'daily') || (context.taskId ? 'task' : 'daily'),
                taskId: meta.taskId || context.taskId
            };

            // notes キャッシュを更新（履歴スナップショットに含めるため state を更新）
            return await this.enqueue(async (currentState) => {
                const nextState = {
                    ...currentState,
                    notes: { ...currentState.notes, [id]: note }
                };
                return { nextState, result: { ...note } };
            });
        }

        // 3. 全く存在しない場合はデフォルト値を返す
        return {
            id,
            title: id,
            body: '',
            date: context.date,
            type: context.taskId ? 'task' : 'daily',
            taskId: context.taskId
        };
    }

    /** Note オブジェクトを保存し、メモリとファイルを更新する */
    async saveNote(note: Note): Promise<void> {
        const content = NoteStore.buildFileContent(note);
        
        await this.enqueue(async (currentState) => {
            // ファイル書き込み
            await storage.writeText(`${this.dirName}/${note.id}.md`, content);
            
            const now = new Date().toISOString();
            
            // metadata と notes キャッシュの両方を更新
            const nextMetadata = currentState.metadata.map(m => 
                m.id === note.id ? { ...m, updatedAt: now, title: note.title } : m
            );
            if (!nextMetadata.find(m => m.id === note.id)) {
                nextMetadata.push({ id: note.id, title: note.title, updatedAt: now });
            }

            const nextState = {
                metadata: nextMetadata,
                notes: { ...currentState.notes, [note.id]: { ...note } }
            };

            return { nextState, result: undefined };
        });
    }

    /** Note を別のIDへ移動/リネームする。ファイルシステム上のリネームとメモリ上のキャッシュの更新。 */
    async moveNote(oldId: string, newId: string, context: { date: string; taskId?: string }): Promise<void> {
        await this.enqueue(async (currentState) => {
            // 1. 古いノートのファイル読み込み
            const content = await storage.readText(`${this.dirName}/${oldId}.md`);
            if (content !== null) {
                // パースして、メタデータを新しい情報（date, taskId など）で更新
                const { meta, body } = NoteStore.parseNoteFile(content);
                const updatedNote: Note = {
                    id: newId,
                    title: meta.title || newId,
                    body,
                    date: context.date,
                    type: context.taskId ? 'task' : 'daily',
                    taskId: context.taskId
                };
                
                // 新しいIDで保存
                const newContent = NoteStore.buildFileContent(updatedNote);
                await storage.writeText(`${this.dirName}/${newId}.md`, newContent);
                
                // 古いファイルを削除
                await storage.deleteFile(`${this.dirName}/${oldId}.md`);
                
                // メモリ上のキャッシュ (notes) 更新
                const nextNotes = { ...currentState.notes };
                delete nextNotes[oldId];
                nextNotes[newId] = updatedNote;
                
                // メモリ上の metadata 更新
                const now = new Date().toISOString();
                let nextMetadata = currentState.metadata.filter(m => m.id !== oldId);
                const existingMetaIndex = nextMetadata.findIndex(m => m.id === newId);
                if (existingMetaIndex === -1) {
                    nextMetadata.push({ id: newId, title: updatedNote.title, updatedAt: now });
                } else {
                    nextMetadata = nextMetadata.map(m =>
                        m.id === newId ? { ...m, updatedAt: now, title: updatedNote.title } : m
                    );
                }
                
                return {
                    nextState: {
                        metadata: nextMetadata,
                        notes: nextNotes
                    },
                    result: undefined
                };
            }
            
            // ファイルが存在しない場合は何もしない
            return { nextState: currentState, result: undefined };
        });
    }

    async restoreSnapshot(snapshot: NoteStoreState): Promise<void> {
        await this.enqueue(async (currentState) => {
            const currentIds = currentState.metadata.map(m => m.id);
            const snapshotIds = new Set(snapshot.metadata.map(m => m.id));

            // 1. 削除の同期: スナップショットになかったが現在は存在するファイルを削除
            for (const id of currentIds) {
                if (!snapshotIds.has(id)) {
                    await storage.deleteFile(`${this.dirName}/${id}.md`);
                }
            }

            // 2. 内容の同期: スナップショットのキャッシュにあるものを書き戻す
            // キャッシュにある = そのセッション中に読み書きされたノートのみが Undo の対象
            for (const [id, note] of Object.entries(snapshot.notes)) {
                const currentNote = currentState.notes[id];
                // 内容が異なる場合のみ書き戻しを実行
                if (!currentNote || JSON.stringify(currentNote) !== JSON.stringify(note)) {
                    const content = NoteStore.buildFileContent(note);
                    await storage.writeText(`${this.dirName}/${id}.md`, content);
                }
            }

            return { nextState: snapshot, result: undefined };
        });
    }
}
