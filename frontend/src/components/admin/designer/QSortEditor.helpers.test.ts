import { describe, it, expect } from 'vitest';
import { computeAutoShapedCapacities } from './QSortEditor.helpers';

describe('computeAutoShapedCapacities', () => {
    it('returns [] when numColumns is 0', () => {
        expect(computeAutoShapedCapacities(40, 0)).toEqual([]);
    });

    it('returns all-zeros when N is 0', () => {
        expect(computeAutoShapedCapacities(0, 5)).toEqual([0, 0, 0, 0, 0]);
    });

    it('total of capacities equals N (odd cols, N=40)', () => {
        const r = computeAutoShapedCapacities(40, 7);
        expect(r.reduce((a, b) => a + b, 0)).toBe(40);
    });

    it('total of capacities equals N (even cols, N=40)', () => {
        const r = computeAutoShapedCapacities(40, 6);
        expect(r.reduce((a, b) => a + b, 0)).toBe(40);
    });

    it('total of capacities equals N (odd cols, N=20 — small but ≥numCols)', () => {
        const r = computeAutoShapedCapacities(20, 5);
        expect(r.reduce((a, b) => a + b, 0)).toBe(20);
    });

    it('total of capacities equals N (N<numCols — minPerCol=0)', () => {
        const r = computeAutoShapedCapacities(3, 5);
        expect(r.reduce((a, b) => a + b, 0)).toBe(3);
    });

    it('total of capacities equals N for various N×cols', () => {
        for (const N of [9, 11, 16, 24, 30, 41, 60, 100]) {
            for (const cols of [3, 5, 7, 9, 11]) {
                const r = computeAutoShapedCapacities(N, cols);
                expect(r.reduce((a, b) => a + b, 0)).toBe(N);
                expect(r).toHaveLength(cols);
            }
        }
    });

    it('produces a symmetric (mirrored) distribution for odd columns when N is even', () => {
        const r = computeAutoShapedCapacities(40, 7);
        // Mirror around center: r[0]==r[6], r[1]==r[5], r[2]==r[4]
        expect(r[0]).toBe(r[6]);
        expect(r[1]).toBe(r[5]);
        expect(r[2]).toBe(r[4]);
    });

    it('produces a symmetric distribution for even columns when N is even', () => {
        const r = computeAutoShapedCapacities(40, 6);
        expect(r[0]).toBe(r[5]);
        expect(r[1]).toBe(r[4]);
        expect(r[2]).toBe(r[3]);
    });

    it('center column has the largest capacity for odd cols', () => {
        const r = computeAutoShapedCapacities(40, 7);
        const centerIdx = 3;
        const center = r[centerIdx] ?? 0;
        for (let i = 0; i < r.length; i++) {
            if (i === centerIdx) continue;
            expect(center).toBeGreaterThanOrEqual(r[i] ?? 0);
        }
    });

    it('extreme columns have the smallest capacity (monotone non-increasing toward edges)', () => {
        const r = computeAutoShapedCapacities(40, 7);
        // Going from center to edge, capacity should not increase.
        expect(r[3] ?? 0).toBeGreaterThanOrEqual(r[2] ?? 0);
        expect(r[2] ?? 0).toBeGreaterThanOrEqual(r[1] ?? 0);
        expect(r[1] ?? 0).toBeGreaterThanOrEqual(r[0] ?? 0);
    });

    it('respects minPerCol=2 baseline when N>=40', () => {
        const r = computeAutoShapedCapacities(40, 7);
        for (const c of r) expect(c).toBeGreaterThanOrEqual(2);
    });

    it('respects minPerCol=1 baseline when 1<=numCols<=N<40', () => {
        const r = computeAutoShapedCapacities(20, 7);
        for (const c of r) expect(c).toBeGreaterThanOrEqual(1);
    });

    it('handles N<numCols with sparse non-zero columns (sum still N)', () => {
        const r = computeAutoShapedCapacities(2, 7);
        expect(r.reduce((a, b) => a + b, 0)).toBe(2);
        expect(r).toHaveLength(7);
    });

    it('handles N=1 (single statement → centre column)', () => {
        const r = computeAutoShapedCapacities(1, 5);
        expect(r.reduce((a, b) => a + b, 0)).toBe(1);
        // The lone statement should land on the centre (index 2) for odd cols.
        expect(r[2]).toBe(1);
    });
});
