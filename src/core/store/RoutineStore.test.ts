import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoutineStore } from './RoutineStore';
import { storage } from '@/core/storage';

vi.mock('@/core/storage', () => ({
    storage: {
        readJson: vi.fn(),
        writeJson: vi.fn()
    }
}));

describe('RoutineStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('load() で routine.json からデータを読み込むこと', async () => {
        const store = new RoutineStore();
        const mockData = [{ id: '1', text: 'Task 1', schedule: { type: 'none' as const } }];
        vi.mocked(storage.readJson).mockResolvedValue(mockData);

        await store.load();

        expect(storage.readJson).toHaveBeenCalledWith('routine.json');
        expect(store.getState()).toEqual(mockData);
    });
});
