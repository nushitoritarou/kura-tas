import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeAiContextFile, AI_CONTEXT_FILE_NAME } from './aiContext';
import { storage } from '@/core/storage';

vi.mock('@/core/storage', () => ({
    storage: {
        writeText: vi.fn()
    }
}));

describe('aiContext store writer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('AI_CONTEXT.md へバージョンとAIメモを埋め込んだ内容を書き込むこと', async () => {
        await writeAiContextFile('2.1.0', { aiMemo: '優先度1は今日中必須' });

        expect(storage.writeText).toHaveBeenCalledTimes(1);
        const [path, content] = vi.mocked(storage.writeText).mock.calls[0];
        expect(path).toBe(AI_CONTEXT_FILE_NAME);
        expect(content).toContain('kura-tas バージョン: 2.1.0');
        expect(content).toContain('優先度1は今日中必須');
    });

    it('aiMemo が未設定でもエラーにならないこと', async () => {
        await writeAiContextFile('2.1.0', {});
        expect(storage.writeText).toHaveBeenCalledTimes(1);
    });
});
