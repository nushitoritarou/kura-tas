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

    describe('isWorkDay', () => {
        it('デフォルト設定で土日を休日と判定すること', () => {
            expect(datetime.isWorkDay(new Date('2026-07-12'))).toBe(false); // 日曜
            expect(datetime.isWorkDay(new Date('2026-07-13'))).toBe(true);  // 月曜
        });

        it('カスタム営業日と祝日設定を考慮して正しく判定すること', () => {
            const workDays = [1, 2, 3]; // 月火水のみ営業日
            const holidays = ['2026-07-13']; // 7/13(月)は祝日

            expect(datetime.isWorkDay(new Date('2026-07-13'), workDays, holidays)).toBe(false); // 月曜だが祝日
            expect(datetime.isWorkDay(new Date('2026-07-14'), workDays, holidays)).toBe(true);  // 火曜営業日
            expect(datetime.isWorkDay(new Date('2026-07-16'), workDays, holidays)).toBe(false); // 木曜非営業日
        });
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

        it('祝日設定がある場合、祝日を避けて翌営業日を返すこと', () => {
            const holidays = ['2026-07-20']; // 月曜祝日
            expect(datetime.getNextWorkDay('2026-07-17', [1, 2, 3, 4, 5], holidays)).toBe('2026-07-21'); // 金曜の翌営業日は火曜
        });
    });

    describe('getPrevWorkDay', () => {
        it('returns Friday if input is Monday', () => {
            expect(datetime.getPrevWorkDay('2024-06-03')).toBe('2024-05-31');
        });

        it('祝日設定がある場合、祝日を避けて前営業日を返すこと', () => {
            const holidays = ['2026-07-20']; // 月曜祝日
            expect(datetime.getPrevWorkDay('2026-07-21', [1, 2, 3, 4, 5], holidays)).toBe('2026-07-17'); // 火曜の前営業日は金曜
        });
    });
    describe('parseLocalDate', () => {
        it('parses YYYY-MM-DD correctly in local time', () => {
            const date = datetime.parseLocalDate('2026-06-08');
            expect(date.getFullYear()).toBe(2026);
            expect(date.getMonth()).toBe(5); // 0-indexed, so June is 5
            expect(date.getDate()).toBe(8);
            
            expect(date.getHours()).toBe(0);
            expect(date.getMinutes()).toBe(0);
        });

        it('throws on invalid date string', () => {
            expect(() => datetime.parseLocalDate('invalid-date')).toThrow();
        });
    });
});
