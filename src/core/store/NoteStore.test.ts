import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoteStore } from './NoteStore';
import { storage } from '@/core/storage';

vi.mock('@/core/storage', () => ({
    storage: {
        readText: vi.fn(),
        writeText: vi.fn(),
        listDirWithMeta: vi.fn(),
        deleteFile: vi.fn()
    }
}));

describe('NoteStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getNote() でNoteオブジェクトを取得できること', async () => {
        const store = new NoteStore();
        vi.mocked(storage.readText).mockResolvedValue('---\ntitle: Test\ndate: 2026-06-07\ntype: daily\n---\n# Hello');

        const note = await store.getNote('daily-2026-06-07', { date: '2026-06-07' });

        expect(storage.readText).toHaveBeenCalledWith('notes/daily-2026-06-07.md');
        expect(note.title).toBe('Test');
        expect(note.body).toBe('# Hello');
        expect(note.date).toBe('2026-06-07');
    });

    it('saveNote() でNoteオブジェクトをフロントマター付きで保存すること', async () => {
        const store = new NoteStore();
        const note = {
            id: 'note123',
            title: 'New Title',
            body: '# Content',
            date: '2026-06-07',
            type: 'daily'
        } as any;
        await store.saveNote(note);

        expect(storage.writeText).toHaveBeenCalledWith(
            'notes/note123.md',
            expect.stringContaining('title: New Title')
        );
        expect(storage.writeText).toHaveBeenCalledWith(
            'notes/note123.md',
            expect.stringContaining('# Content')
        );
    });

    it('ノートが存在しない場合はデフォルト値を返すこと', async () => {
        const store = new NoteStore();
        vi.mocked(storage.readText).mockResolvedValue(null);

        const note = await store.getNote('missing', { date: '2026-06-07' });
        expect(note.body).toBe('');
        expect(note.title).toBe('missing');
    });

    it('load() でディレクトリをスキャンし、メタデータを構築すること', async () => {
        const store = new NoteStore();
        vi.mocked(storage.listDirWithMeta).mockResolvedValue([
            { name: 'note1.md', lastModified: 1700000000000 },
            { name: 'note2.md', lastModified: 1700000000001 },
            { name: 'other.txt', lastModified: 1700000000002 }
        ]);

        await store.load();

        const state = store.getState();
        expect(state.metadata).toHaveLength(2);
        expect(state.metadata[0].id).toBe('note1');
        expect(state.metadata[0].updatedAt).toBe(new Date(1700000000000).toISOString());
        expect(state.metadata[1].id).toBe('note2');
    });

    it('restoreSnapshot でノートの内容が元に戻ること', async () => {
        const store = new NoteStore();
        
        // 初期状態のセットアップ
        vi.mocked(storage.listDirWithMeta).mockResolvedValue([{ name: 'noteA.md', lastModified: 1000 }]);
        vi.mocked(storage.readText).mockResolvedValue('---\ntitle: Title A\n---\nContent A');
        await store.load();
        
        // getNote でキャッシュに載せる
        await store.getNote('noteA', { date: '' });
        
        const snapshot = store.getSnapshot();
        
        // 変更を加える
        const updatedNote = { id: 'noteA', title: 'New Title', body: 'Updated Content', date: '', type: 'daily' } as any;
        await store.saveNote(updatedNote);
        
        // Undo
        await store.restoreSnapshot(snapshot);
        
        // 検証: 元の内容が書き戻されていること
        expect(storage.writeText).toHaveBeenCalledWith(
            expect.stringContaining('noteA.md'),
            expect.stringContaining('Content A')
        );
        
        // メモリ上の状態も戻っていること
        const restoredNote = await store.getNote('noteA', { date: '' });
        expect(restoredNote.body).toBe('Content A');
    });

    describe('moveNote()', () => {
        it('古いノートが存在する場合、メタデータを更新し新しい場所に書き込み、古いファイルを削除すること', async () => {
            const store = new NoteStore();
            vi.mocked(storage.readText).mockResolvedValue('---\ntitle: Old Note\ndate: 2026-06-07\ntype: task\ntaskId: old-id\n---\n# Note Content');
            vi.mocked(storage.writeText).mockResolvedValue(undefined);
            vi.mocked(storage.deleteFile).mockResolvedValue(undefined);

            await store.moveNote('task-old-id', 'task-new-id', { date: '2026-06-08', taskId: 'new-id' });

            // 古いファイルを読み込んでいること
            expect(storage.readText).toHaveBeenCalledWith('notes/task-old-id.md');

            // 新しいメタデータで書き込んでいること
            expect(storage.writeText).toHaveBeenCalledWith(
                'notes/task-new-id.md',
                expect.stringContaining('title: Old Note\ndate: 2026-06-08\ntype: task\ntaskId: new-id\n---\n\n# Note Content')
            );

            // 古いファイルを削除していること
            expect(storage.deleteFile).toHaveBeenCalledWith('notes/task-old-id.md');

            // メモリ上の状態が更新されていること
            const note = await store.getNote('task-new-id', { date: '2026-06-08' });
            expect(note.title).toBe('Old Note');
            expect(note.body).toBe('# Note Content');
            expect(note.date).toBe('2026-06-08');
            expect(note.taskId).toBe('new-id');
        });

        it('古いノートが存在しない場合、何もしないこと', async () => {
            const store = new NoteStore();
            vi.mocked(storage.readText).mockResolvedValue(null);

            await store.moveNote('task-non-existent', 'task-new-id', { date: '2026-06-08', taskId: 'new-id' });

            expect(storage.writeText).not.toHaveBeenCalled();
            expect(storage.deleteFile).not.toHaveBeenCalled();
        });
    });
});
