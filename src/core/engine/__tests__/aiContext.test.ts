import { describe, it, expect } from 'vitest';
import { buildAiContextMarkdown, AI_CONTEXT_SCHEMA_VERSION } from '../aiContext';

describe('aiContext', () => {
    it('バージョンとスキーマバージョンが含まれること', () => {
        const md = buildAiContextMarkdown({ version: '2.1.0' });
        expect(md).toContain('kura-tas バージョン: 2.1.0');
        expect(md).toContain(`スキーマバージョン: ${AI_CONTEXT_SCHEMA_VERSION}`);
    });

    it('ファイルを直接書き換えないよう警告する文言が含まれること', () => {
        const md = buildAiContextMarkdown({ version: '2.1.0' });
        expect(md).toContain('AIエージェントが直接書き換えないでください');
        expect(md).toContain('裏で（アプリを経由せず）更新されることを想定していません');
    });

    it('主要なデータファイルとスキーマの説明が含まれること', () => {
        const md = buildAiContextMarkdown({ version: '2.1.0' });
        expect(md).toContain('config.json');
        expect(md).toContain('inbox.json');
        expect(md).toContain('links.json');
        expect(md).toContain('routine.json');
        expect(md).toContain('tasks/{YYYY-MM-DD}.json');
        expect(md).toContain('notes/*.md');
        expect(md).toContain('interface Task');
        expect(md).toContain('interface RoutineTask');
        expect(md).toContain('daily-{YYYY-MM-DD}.md');
        expect(md).toContain('task-{taskId}.md');
    });

    it('userMemo が未指定の場合、未設定である旨が表示されること', () => {
        const md = buildAiContextMarkdown({ version: '2.1.0' });
        expect(md).toContain('未設定');
    });

    it('userMemo が指定された場合、その内容がそのまま埋め込まれること', () => {
        const md = buildAiContextMarkdown({ version: '2.1.0', userMemo: '優先度1は今日中必須、3は今週中でOK' });
        expect(md).toContain('優先度1は今日中必須、3は今週中でOK');
    });

    it('userMemo が空白のみの場合は未設定として扱われること', () => {
        const md = buildAiContextMarkdown({ version: '2.1.0', userMemo: '   ' });
        expect(md).toContain('未設定');
    });
});
