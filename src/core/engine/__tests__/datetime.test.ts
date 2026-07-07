import { describe, it, expect } from 'vitest';
import * as datetime from '../datetime';

describe('core/engine/datetime', () => {
    it('adds days correctly', () => {
        expect(datetime.addDays('2024-06-01', 1)).toBe('2024-06-02');
        expect(datetime.addDays('2024-06-01', -1)).toBe('2024-05-31');
        expect(datetime.addDays('2024-12-31', 1)).toBe('2025-01-01');
    });

    it('throws on invalid date', () => {
        expect(() => datetime.addDays('invalid', 1)).toThrow();
    });

    it('returns today string in YYYY-MM-DD format', () => {
        const today = datetime.getTodayStr();
        expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    describe('getNextWorkDay', () => {
        it('returns Monday if input is Friday', () => {
            expect(datetime.getNextWorkDay('2024-05-31')).toBe('2024-06-03');
        });

        it('returns Monday if input is Saturday', () => {
            expect(datetime.getNextWorkDay('2024-06-01')).toBe('2024-06-03');
        });

        it('returns Tuesday if input is Monday', () => {
            expect(datetime.getNextWorkDay('2024-06-03')).toBe('2024-06-04');
        });
    });
});
