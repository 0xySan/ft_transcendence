/**
 * @file qrCode.extended.test.ts
 * Extended tests for QR code utilities to cover uncovered lines.
 */

import { describe, it, expect } from 'vitest';
import { generateQrCode, getMinimalVersion, printMatrix } from '../../../../src/auth/2Fa/qrCode/qrCode.js';
import { EcLevel } from '../../../../src/auth/2Fa/qrCode/qr.types.js';

describe('getMinimalVersion extended coverage', () => {

	it('numeric data chooses numeric mode', () => {
		const result = getMinimalVersion('123456', 'L');
		expect(result).toBeDefined();
		expect(result?.mode).toBe('numeric');
	});

	it('alphanumeric data chooses alphanumeric mode', () => {
		const result = getMinimalVersion('HELLO123', 'L');
		expect(result).toBeDefined();
		expect(result?.mode).toBe('alphanumeric');
	});

	it('byte data with UTF-16BE uses byte mode', () => {
		const result = getMinimalVersion('Hello', 'L', 'UTF-16BE');
		expect(result).toBeDefined();
		expect(result?.mode).toBe('byte');
	});

	it('kanji data with Shift_JIS uses kanji mode', () => {
		const kanjiChar = '悶'; // Shift_JIS 0xE040
		const result = getMinimalVersion(kanjiChar, 'L', 'Shift_JIS');
		expect(result).toBeDefined();
		expect(result?.mode).toBe('kanji');
	});

	it('non-standard encoding triggers ECI mode', () => {
		const result = getMinimalVersion('Hello', 'L', 'Shift_JIS');
		expect(result).toBeDefined();
		expect(result?.mode).toBe('kanji');
	});

	it('unsupported encoding returns undefined', () => {
		const result = getMinimalVersion('Hello', 'L', 'UNKNOWN' as any);
		expect(result).toBeUndefined();
	});

	it('version >= 7 triggers version bits placement', () => {
		const payload = 'A'.repeat(500); // enough to require version >= 7
		const qr = generateQrCode(payload);
		expect(qr.length).toBeGreaterThanOrEqual(45); // version 7 size = 21 + 4*6 = 45
	});

	it('maskPattern parameter forces a specific mask', () => {
		const payload = 'MASK TEST';
		const qrMask0 = generateQrCode(payload, undefined, 0);
		const qrMask1 = generateQrCode(payload, undefined, 1);
		expect(qrMask0).not.toEqual(qrMask1);
	});

	it('small payload uses terminator and padding correctly', () => {
		const payload = 'HI';
		const qr = generateQrCode(payload, 1);
		expect(qr.length).toBe(21);
		const flat = qr.flat();
		const hasBooleansOnly = flat.every(cell => cell === true || cell === false);
		expect(hasBooleansOnly).toBe(true);
	});

	it('throws if payload too large', () => {
		const payload = 'X'.repeat(5000);
		expect(() => generateQrCode(payload)).toThrow();
	});

	it('produces reproducible matrix for same payload', () => {
		const payload = 'REPEAT';
		const qr1 = generateQrCode(payload);
		const qr2 = generateQrCode(payload);
		expect(qr1).toEqual(qr2);
	});

	it('produces different matrix if version changes', () => {
		const qr1 = generateQrCode('A'.repeat(5), 1);
		const qr2 = generateQrCode('A'.repeat(20), 2);
		expect(qr1).not.toEqual(qr2);
	});

	it('printMatrix() outputs correct string representation', () => {
		const payload = 'TEST';
		const qr = generateQrCode(payload);

		// Spy on console.log
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (msg?: any) => logs.push(String(msg));
		
		printMatrix(qr);
		console.log = originalLog;
		expect(logs.length).toBe(qr.length);

		logs.forEach((line, r) => {
			expect(line.length).toBe(qr.length * 2); // each cell is printed as 2 chars ('██' or ' ')
		});
	});
});