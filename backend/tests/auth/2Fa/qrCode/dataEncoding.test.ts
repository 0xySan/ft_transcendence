/**
 * @file dataEncoding.test.ts
 * Extended tests for QR code data encoding utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('encodePayloadToDataCodewords (extended branches)', () => {
	let dataEncoding: typeof import('../../../../src/auth/2Fa/qrCode/dataEncoding.ts');
	let getInfoMock: any;

	beforeEach(async () => {
		vi.resetModules();
		vi.restoreAllMocks();

		// Mock qr.types BEFORE importing dataEncoding so getInfo is controlled.
		vi.doMock('../../../../src/auth/2Fa/qrCode/qr.types.ts', async () => {
			const actual = await vi.importActual('../../../../src/auth/2Fa/qrCode/qr.types.ts');
			const mock = {
				...actual,
				getInfo: vi.fn((version: number, ecl: any) => ({
					// default capacity used in tests (20 bytes)
					totDataCW: 20,
				})),
			};
			return mock;
		});

		// Import module under test AFTER the mock is registered
		dataEncoding = await import('../../../../src/auth/2Fa/qrCode/dataEncoding.ts');

		// grab getInfo mock for test manipulation
		const qrTypes = await import('../../../../src/auth/2Fa/qrCode/qr.types.ts');
		getInfoMock = qrTypes.getInfo;
	});

	afterEach(() => {
		vi.resetAllMocks();
		vi.restoreAllMocks();
	});

	it('numeric: handles 3-digit group (remain>=3) correctly', () => {
		// "123" should be encoded using the 3-digit -> 10 bits branch
		const cw = dataEncoding.encodePayloadToDataCodewords('123', 1, 'L' as any, 'numeric' as any);
		expect(cw.length).toBe(20);
		expect(cw.every(b => typeof b === 'number')).toBeTruthy();
	});

	it('numeric: handles 2-digit remainder branch', () => {
		// "12" should exercise the 2-digit -> 7 bits branch
		const cw = dataEncoding.encodePayloadToDataCodewords('12', 1, 'L' as any, 'numeric' as any);
		expect(cw.length).toBe(20);
	});

	it('numeric: handles 1-digit remainder branch', () => {
		// single digit should exercise the 4-bit branch
		const cw = dataEncoding.encodePayloadToDataCodewords('7', 1, 'L' as any, 'numeric' as any);
		expect(cw.length).toBe(20);
	});

	it('alphanumeric: throws on invalid character (lowercase)', () => {
		// lowercase 'a' is invalid for alphanumeric mode
		expect(() =>
			dataEncoding.encodePayloadToDataCodewords('a', 1, 'M' as any, 'alphanumeric' as any)
		).toThrow();
	});

	it('kanji mode: throws when Shift_JIS encoder is not available', () => {
		// Most Node runtimes don't support TextEncoder("shift_jis") -> should throw
		// Use a Kanji-like character to hit the Kanji branch.
		const kanjiString = '漢'; // one Kanji character
		expect(() =>
			dataEncoding.encodePayloadToDataCodewords(kanjiString, 1, 'L' as any, 'kanji' as any, 'Shift_JIS' as any)
		).toThrow();
	});

	it('byte mode: Shift_JIS encoding not available should throw', () => {
		const OriginalTextEncoder = global.TextEncoder;
		global.TextEncoder = class {
			constructor(enc?: string) {
				if (enc === 'shift_jis') throw new Error('Shift_JIS not available');
				return new OriginalTextEncoder();
			}
		} as any;

		expect(() =>
			dataEncoding.encodePayloadToDataCodewords('abc', 1, 'M' as any, 'byte' as any, 'Shift_JIS' as any)
		).toThrow('Shift_JIS encoding not available in this environment; provide Shift_JIS bytes or use a library (e.g. iconv-lite)');

		global.TextEncoder = OriginalTextEncoder;
	});

	it('ECI insertion: build bitstream inserts ECI for non-standard encodings (UTF-16BE)', () => {
		// UTF-16BE is not a "standard" (in our helper), so it should insert an ECI segment.
		// We only assert that encoding completes and returns capacity-sized codewords.
		expect(() =>
			dataEncoding.encodePayloadToDataCodewords('ABC', 1, 'M' as any, 'byte' as any, 'UTF-16BE' as any)
		).not.toThrow();
		const cw = dataEncoding.encodePayloadToDataCodewords('ABC', 1, 'M' as any, 'byte' as any, 'UTF-16BE' as any);
		expect(cw.length).toBe(20);
	});

	it('terminator & padding: small payload uses terminator then 0xEC/0x11 pads', () => {
		const cw = dataEncoding.encodePayloadToDataCodewords('0', 1, 'L' as any, 'numeric' as any);
		expect(cw.length).toBe(20);

		// Ensure padding bytes alternate 0xEC/0x11 starting from first padding byte
		const lastBytes = cw.slice(cw.findIndex((b, i) => i >= 0 && b === 0xec || b === 0x11));
		for (let i = 0; i < lastBytes.length; i++) {
			const expected = i % 2 === 0 ? 0xec : 0x11;
			expect(lastBytes[i]).toBe(expected);
		}
	});

	it('unknown version/ecLevel should throw', () => {
		// Simulate unknown getInfo
		getInfoMock.mockReturnValueOnce(undefined);
		expect(() => dataEncoding.encodePayloadToDataCodewords('test', 99, 'H' as any)).toThrow();
	});

	it('ECI encoding mode for buildBitStreamForPayload return correct bitstream', () => {
		// ECI mode should be handled in buildBitStreamForPayload
		const cw = dataEncoding.encodePayloadToDataCodewords('test', 1, 'L' as any, 'eci' as any, 'ISO-8859-1' as any);
		expect(cw.length).toBe(20);
	});

	it('appendKanjiPayload correctly encodes Kanji characters', () => {
		// Mock TextEncoder to simulate Shift_JIS encoding for Kanji characters
		const OriginalTextEncoder = global.TextEncoder;
		global.TextEncoder = class {
			encode(input: string) {
				if (input === '漢悶') {
					// Simulated Shift_JIS bytes for '漢悶'
					return new Uint8Array([0x8A, 0xBF, 0x8C, 0xDC]);
				}
				return new OriginalTextEncoder().encode(input);
			}
		} as any;

		const cw = dataEncoding.encodePayloadToDataCodewords('漢悶', 1, 'L' as any, 'kanji' as any, 'Shift_JIS' as any);
		expect(cw.length).toBe(20);

		global.TextEncoder = OriginalTextEncoder;
	});

	it('appendKanjiPayload throw if Shift_JIS encoding is not available', () => {
		// Mock TextEncoder to throw for Shift_JIS
		const OriginalTextEncoder = global.TextEncoder;
		global.TextEncoder = class {
			constructor(enc?: string) {
				if (enc === 'shift_jis') throw new Error('Shift_JIS not available');
				return new OriginalTextEncoder();
			}
		} as any;

		expect(() =>
			dataEncoding.encodePayloadToDataCodewords('漢', 1, 'L' as any, 'kanji' as any, 'Shift_JIS' as any)
		).toThrow();

		global.TextEncoder = OriginalTextEncoder;
	});
});