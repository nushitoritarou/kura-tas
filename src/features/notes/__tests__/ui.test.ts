import { describe, it, expect } from 'vitest';
import * as ui from '../ui';

describe('features/notes/ui', () => {
    describe('createPanelTitle', () => {
        it('returns panel title with "Task: " prefix for task type', () => {
            expect(ui.createPanelTitle('My Task Title', 'task')).toBe('Task: My Task Title');
        });

        it('returns panel title with "Daily: " prefix for daily type', () => {
            expect(ui.createPanelTitle('2026-07-09', 'daily')).toBe('Daily: 2026-07-09');
        });
    });

    describe('getDisplayTitle', () => {
        it('returns taskText when type is task and taskText is provided', () => {
            expect(ui.getDisplayTitle('task', 'Buy groceries', '2026-07-09')).toBe('Buy groceries');
        });

        it('returns "無題のノート" when type is task and taskText is missing', () => {
            expect(ui.getDisplayTitle('task', undefined, '2026-07-09')).toBe('無題のノート');
            expect(ui.getDisplayTitle('task', '', '2026-07-09')).toBe('無題のノート');
        });

        it('returns date when type is daily and date is provided', () => {
            expect(ui.getDisplayTitle('daily', undefined, '2026-07-09')).toBe('2026-07-09');
        });

        it('returns "無題のノート" when type is daily and date is missing', () => {
            expect(ui.getDisplayTitle('daily', undefined, undefined)).toBe('無題のノート');
            expect(ui.getDisplayTitle('daily', undefined, '')).toBe('無題のノート');
        });
    });
});
