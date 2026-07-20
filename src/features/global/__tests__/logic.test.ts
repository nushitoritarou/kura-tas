import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as logic from '../logic';
import { StoreRegistry } from '@/core/store';

// Mock storage to prevent side effects
vi.mock('@/core/storage', () => ({
    storage: {
        init: vi.fn(),
        readJson: vi.fn(),
        writeJson: vi.fn(),
        listDir: vi.fn(),
        listDirWithMeta: vi.fn().mockResolvedValue([]),
    }
}));

// Mock datetime to prevent flaky tests
vi.mock('@/core/engine/datetime', async () => {
    const actual = await vi.importActual<any>('@/core/engine/datetime');
    return {
        ...actual,
        getTodayStr: vi.fn(() => '2024-06-01'),
    };
});

describe('features/global/logic', () => {
    let store: StoreRegistry;
    
    beforeEach(() => {
        vi.clearAllMocks();
        store = new StoreRegistry();
    });

    it('checkSavedHandle updates lastDirName if handle exists', async () => {
        const mockHandle = { name: 'test-repo' };
        vi.spyOn(store.handle, 'load').mockResolvedValue(undefined);
        vi.spyOn(store.handle, 'getState').mockReturnValue(mockHandle as any);

        const result = await logic.checkSavedHandle(store);
        
        expect(result).toBe(mockHandle);
        expect(store.ui.getState().lastDirName).toBe('test-repo');
    });

    it('setupStorage initializes app correctly', async () => {
        const mockHandle = { name: 'test-repo' };
        
        // Spy on store methods
        vi.spyOn(store.handle, 'save').mockResolvedValue(undefined);
        vi.spyOn(store.config, 'load').mockResolvedValue(undefined);
        vi.spyOn(store.commonLinks, 'load').mockResolvedValue(undefined);
        vi.spyOn(store.inboxItems, 'load').mockResolvedValue(undefined);
        vi.spyOn(store.routine, 'load').mockResolvedValue(undefined);
        vi.spyOn(store.ui, 'load').mockResolvedValue(undefined);
        vi.spyOn(store.tasks, 'load').mockResolvedValue(undefined);
        vi.spyOn(store.tasks, 'getTasksFor').mockResolvedValue([]);

        await logic.setupStorage(mockHandle as any, store);

        const state = store.ui.getState();
        expect(state.isAppReady).toBe(true);
        expect(state.currentDate).toBe('2024-06-01'); // Fixed by mock
        
        // Verify dependencies
        expect(store.handle.save).toHaveBeenCalledWith(mockHandle);
        expect(store.tasks.getTasksFor).toHaveBeenCalledWith('2024-06-01');
    });

    it('shiftCurrentDate updates store and returns new date', async () => {
        store.ui.update({ currentDate: '2024-06-01' });
        vi.spyOn(store.tasks, 'getTasksFor').mockResolvedValue([]);
        
        const result = await logic.shiftCurrentDate(1, store);
        
        expect(result).toBe('2024-06-02');
        expect(store.ui.getState().currentDate).toBe('2024-06-02');
        expect(store.tasks.getTasksFor).toHaveBeenCalledWith('2024-06-02');
    });

    it('jumpToToday updates store with today', async () => {
        vi.spyOn(store.tasks, 'getTasksFor').mockResolvedValue([]);

        const result = await logic.jumpToToday(store);
        
        expect(result).toBe('2024-06-01'); // Fixed by mock
        expect(store.ui.getState().currentDate).toBe('2024-06-01');
        expect(store.tasks.getTasksFor).toHaveBeenCalledWith('2024-06-01');
    });

    describe('checkAndApplyDayChange', () => {
        beforeEach(() => {
            vi.spyOn(store.tasks, 'getTasksFor').mockResolvedValue([]);
        });

        it('does nothing if date has not changed', async () => {
            store.ui.update({ 
                currentDate: '2024-06-01', 
                lastKnownToday: '2024-06-01' 
            });
            
            const result = await logic.checkAndApplyDayChange(store);
            
            expect(result).toBeNull();
            const state = store.ui.getState();
            expect(state.currentDate).toBe('2024-06-01');
            expect(state.lastKnownToday).toBe('2024-06-01');
            expect(store.tasks.getTasksFor).not.toHaveBeenCalled();
        });

        it('updates both currentDate and lastKnownToday if user is on "Today"', async () => {
            // Setup: user is on 2024-06-01 which is the old today
            store.ui.update({ 
                currentDate: '2024-06-01', 
                lastKnownToday: '2024-06-01',
                isEditMode: false
            });
            
            // Simulating day passing: new today is 2024-06-02
            const datetime = await import('@/core/engine/datetime');
            (datetime.getTodayStr as any).mockReturnValue('2024-06-02');

            const result = await logic.checkAndApplyDayChange(store);
            
            expect(result).toBe('2024-06-02');
            const state = store.ui.getState();
            expect(state.currentDate).toBe('2024-06-02');
            expect(state.lastKnownToday).toBe('2024-06-02');
            expect(store.tasks.getTasksFor).toHaveBeenCalledWith('2024-06-02');
        });

        it('updates only lastKnownToday if user is on a different date', async () => {
            // Setup: user is on 2024-05-31 (yesterday)
            store.ui.update({ 
                currentDate: '2024-05-31', 
                lastKnownToday: '2024-06-01',
                isEditMode: false
            });
            
            // Simulating day passing: new today is 2024-06-02
            const datetime = await import('@/core/engine/datetime');
            (datetime.getTodayStr as any).mockReturnValue('2024-06-02');

            const result = await logic.checkAndApplyDayChange(store);
            
            expect(result).toBeNull();
            const state = store.ui.getState();
            expect(state.currentDate).toBe('2024-05-31'); // Should NOT change
            expect(state.lastKnownToday).toBe('2024-06-02');
            expect(store.tasks.getTasksFor).not.toHaveBeenCalled();
        });

        it('does NOT update anything if in edit mode', async () => {
            // Setup: user is on 2024-06-01 (old today) AND in edit mode
            store.ui.update({ 
                currentDate: '2024-06-01', 
                lastKnownToday: '2024-06-01',
                isEditMode: true
            });
            
            // Simulating day passing
            const datetime = await import('@/core/engine/datetime');
            (datetime.getTodayStr as any).mockReturnValue('2024-06-02');

            const result = await logic.checkAndApplyDayChange(store);
            
            expect(result).toBeNull();
            const state = store.ui.getState();
            expect(state.currentDate).toBe('2024-06-01'); // Should NOT change
            expect(state.lastKnownToday).toBe('2024-06-01'); // Should NOT change (skipped)
            expect(store.tasks.getTasksFor).not.toHaveBeenCalled();
        });
    });
});
