/**
 * @file qrCode/dataEncoding.ts
 * @brief Functions to encode text payloads into QR code data codewords.
 */

import { ALPHANUMERIC_TABLE, ECI_ASSIGNMENTS, EcLevel, getInfo, QrEncodingMode, QrEncodingModeBits, QrTextEncoding } from './qr.types.js';

/**
 * @brief Get length of character count indicator for given mode and version.
 * @param mode Encoding mode
 * @param version QR version
 * @returns Length in bits of character count indicator
 */
function charCountIndicatorLength(mode: QrEncodingMode, version: number): number {
	const group =
		version <= 9 ? 0 : version <= 26 ? 1 : 2;
	// table from spec
	const table: Record<QrEncodingMode, number[]> = {
		numeric: [10, 12, 14],
		alphanumeric: [9, 11, 13],
		byte: [8, 16, 16],
		kanji: [8, 10, 12],
		eci: [0, 0, 0], // ECI has no char count indicator
	};
	return table[mode][group];
}

/**
 * @brief Append numeric mode payload to bit stream.
 * @param bits Array of bits to append to
 * @param payload The text payload
 * @param version QR version
 */
function appendNumericPayload(bits: number[], payload: string, version: number): void {
	const count = payload.length;
	const countBits = charCountIndicatorLength('numeric', version);
	for (let i = countBits - 1; i >= 0; i--) bits.push((count >> i) & 1);

	let i = 0;
	while (i < payload.length) {
		const remain = payload.length - i;
		if (remain >= 3) {
			const num = Number(payload.slice(i, i + 3));
			for (let b = 9; b >= 0; b--) bits.push((num >> b) & 1);
			i += 3;
		} else if (remain === 2) {
			const num = Number(payload.slice(i, i + 2));
			for (let b = 6; b >= 0; b--) bits.push((num >> b) & 1);
			i += 2;
		} else {
			const num = Number(payload[i]);
			for (let b = 3; b >= 0; b--) bits.push((num >> b) & 1);
			i += 1;
		}
	}
}

/**
 * @brief Append alphanumeric mode payload to bit stream.
 * @param bits Array of bits to append to
 * @param payload The text payload
 * @param version QR version
 */
function appendAlphanumericPayload(bits: number[], payload: string, version: number): void {
	const count = payload.length;
	const countBits = charCountIndicatorLength('alphanumeric', version);
	for (let i = countBits - 1; i >= 0; i--) bits.push((count >> i) & 1);

	let i = 0;
	while (i < payload.length) {
		const remain = payload.length - i;
		if (remain >= 2) {
			const a = ALPHANUMERIC_TABLE.indexOf(payload[i]);
			const b = ALPHANUMERIC_TABLE.indexOf(payload[i + 1]);
			if (a === -1 || b === -1) throw new Error('Invalid alphanumeric character');
			const v = a * 45 + b;
			for (let bit = 10; bit >= 0; bit--) bits.push((v >> bit) & 1); // 11 bits
			i += 2;
		} else {
			const a = ALPHANUMERIC_TABLE.indexOf(payload[i]);
			if (a === -1) throw new Error('Invalid alphanumeric character');
			for (let bit = 5; bit >= 0; bit--) bits.push((a >> bit) & 1); // 6 bits
			i += 1;
		}
	}
}

/**
 * @brief Append byte mode payload to bit stream.
 * @param bits Array of bits to append to
 * @param payload The text payload
 * @param version QR version
 * @param encoding Text encoding
 */
function appendByteModePayload(bits: number[], payload: string, version: number, encoding: QrTextEncoding): void {
	// character count
	const countBits = charCountIndicatorLength('byte', version);

	// convert payload to bytes according to encoding
	const bytes: number[] = encodeStringToBytes(payload, encoding);

	// character count indicator = number of bytes
	const byteCount = bytes.length;
	for (let i = countBits - 1; i >= 0; i--) bits.push((byteCount >> i) & 1);

	// append each byte MSB-first
	for (let i = 0; i < bytes.length; i++) {
		const b = bytes[i];
		for (let bit = 7; bit >= 0; bit--) bits.push((b >> bit) & 1);
	}
}

/**
 * @brief Encode a string into bytes using specified encoding.
 * @param s The string to encode
 * @param encoding The text encoding to use
 * @returns Array of bytes representing the encoded string
 */
function encodeStringToBytes(s: string, encoding: QrTextEncoding): number[] {
	if (encoding === 'UTF-8') {
		return Array.from(new TextEncoder().encode(s));
	}
	if (encoding === 'ISO-8859-1') {
		const out: number[] = [];
		for (let i = 0; i < s.length; i++) {
			const code = s.charCodeAt(i);
			if (code > 0xFF) throw new Error('Character cannot be encoded in ISO-8859-1');
			out.push(code & 0xff);
		}
		return out;
	}
	if (encoding === 'UTF-16BE') {
		const out: number[] = [];
		for (let i = 0; i < s.length; i++) {
			const code = s.charCodeAt(i);
			out.push((code >> 8) & 0xff);
			out.push(code & 0xff);
		}
		return out;
	}
	if (encoding === 'Shift_JIS') {
		// Best-effort: some environments expose TextEncoder('shift_jis'), otherwise we throw
		try {
			// @ts-ignore - some runtimes support named encodings
			const enc = new TextEncoder('shift_jis');
			return Array.from(enc.encode(s));
		} catch (e) {
			throw new Error('Shift_JIS encoding not available in this environment; provide Shift_JIS bytes or use a library (e.g. iconv-lite)');
		}
	}
	throw new Error(`Unsupported encoding: ${encoding}`);
}

/**
 * @brief Append Kanji mode payload to bit stream.
 * @param bits Array of bits to append to
 * @param payload The text payload (expected to contain Kanji characters)
 * @param version QR version
 *
 * Encoding spec:
 * - Convert text to Shift_JIS bytes
 * - Each pair of bytes (2 bytes per character)
 *   - Combine to 16-bit value v = (high << 8) | low
 *   - If 0x8140 <= v <= 0x9FFC, then v' = v - 0x8140
 *   - Else if 0xE040 <= v <= 0xEBBF, then v' = v - 0xC140
 *   - Else → invalid Kanji
 *   - Then: encoded = ((v' >> 8) * 0xC0) + (v' & 0xFF)
 *   - Append 13 bits MSB-first
 */
function appendKanjiPayload(bits: number[], payload: string, version: number): void {
	const count = payload.length;
	const countBits = charCountIndicatorLength('kanji', version);
	for (let i = countBits - 1; i >= 0; i--) bits.push((count >> i) & 1);

	let bytes: Uint8Array;
	try {
		// @ts-ignore - some runtimes support Shift_JIS directly
		bytes = new TextEncoder('shift_jis').encode(payload);
	} catch {
		throw new Error('Shift_JIS encoding not available in this environment; use iconv-lite or similar.');
	}

	if (bytes.length % 2 !== 0)
		throw new Error('Invalid Shift_JIS byte sequence for Kanji mode.');

	for (let i = 0; i < bytes.length; i += 2) {
		const high = bytes[i];
		const low = bytes[i + 1];
		const value = (high << 8) | low;

		let v: number;
		if (value >= 0x8140 && value <= 0x9FFC)
			v = value - 0x8140;
		else if (value >= 0xE040 && value <= 0xEBBF)
			v = value - 0xC140;
		else
			throw new Error(`Character 0x${value.toString(16)} not encodable in Kanji mode.`);

		const encoded = ((v >> 8) * 0xC0) + (v & 0xFF);

		// append 13 bits MSB-first
		for (let b = 12; b >= 0; b--) bits.push((encoded >> b) & 1);
	}
}

/**
 * @brief Get bits for the mode indicator.
 * @param mode QrEncodingMode
 * @returns bits for the mode indicator
 */
function modeBits(mode: QrEncodingMode): number[] {
	return QrEncodingModeBits[mode].split('').map(ch => (ch === '1' ? 1 : 0));
}

/**
 * @brief Get bits representing the ECI assignment.
 * @param assignment ECI assignment number
 * @returns bits representing the ECI assignment
 */
function eciAssignmentBits(assignment: number): number[] {
	// spec encodes assignment in variable-length form; for small values (<128) one byte is fine
	if (assignment < 0 || assignment >= 128) throw new Error('ECI assignment out of range for helper');
	const bits: number[] = [];
	for (let i = 7; i >= 0; i--) bits.push((assignment >> i) & 1);
	return bits;
}

/**
 * @brief Build bit stream for given payload, version, mode, and encoding.
 * @param payload Text payload
 * @param version QR version (1..40)
 * @param mode Encoding mode
 * @param encoding Text encoding for byte mode
 * @returns Array of bits (0/1) representing the encoded payload
 */
function buildBitStreamForPayload(
	payload: string,
	version: number,
	mode: QrEncodingMode,
	encoding: QrTextEncoding
): number[] {
	const bits: number[] = [];

	// Decide whether we need to insert an ECI segment.
	// We treat UTF-8 and ISO-8859-1 as "no ECI needed" (they're standard).
	const needsEci = encoding !== 'UTF-8' && encoding !== 'ISO-8859-1';

	if (mode === 'eci') {
		// Explicit: user requested ECI mode -> must provide encoding
		const assignment = ECI_ASSIGNMENTS[encoding];
		if (assignment === undefined) throw new Error(`Unsupported ECI encoding: ${encoding}`);
		bits.push(...modeBits('eci'));           // mode indicator for ECI
		bits.push(...eciAssignmentBits(assignment)); // ECI value (one byte for small assignments)
		bits.push(...modeBits('byte'));
		appendByteModePayload(bits, payload, version, encoding);
		return bits;
	}

	// If encoding requires ECI (and mode is not explicitly 'eci'), insert ECI before the real mode
	if (needsEci) {
		const assignment = ECI_ASSIGNMENTS[encoding];
		if (assignment === undefined) throw new Error(`Unsupported ECI encoding: ${encoding}`);
		bits.push(...modeBits('eci'));
		bits.push(...eciAssignmentBits(assignment));
		// then continue with real mode
	}

	// Append the actual mode indicator and payload
	bits.push(...modeBits(mode));

	switch (mode) {
		case 'numeric':
			appendNumericPayload(bits, payload, version);
			break;
		case 'alphanumeric':
			appendAlphanumericPayload(bits, payload, version);
			break;
		case 'kanji':
			appendKanjiPayload(bits, payload, version);
			break;
		case 'byte':
			appendByteModePayload(bits, payload, version, encoding);
			break;
		default:
			throw new Error(`Unsupported mode: ${mode}`);
	}

	return bits;
}


/**
 * @brief Convert bit array to padded codewords for QR data.
 * @param bits Array of bits (0/1)
 * @param capacityBytes Total capacity in bytes for the QR version and ECL
 * @returns Array of codewords (bytes) padded to capacity
 */
function bitsToPaddedCodewords(bits: number[], capacityBytes: number): number[] {
	const totalCapacityBits = capacityBytes * 8;

	// 1) terminator (up to 4 zeros)
	const terminatorLen = Math.min(4, Math.max(0, totalCapacityBits - bits.length));
	for (let i = 0; i < terminatorLen; i++) bits.push(0);

	// 2) pad to full byte
	while (bits.length % 8 !== 0) bits.push(0);

	// 3) bits -> bytes
	const codewords: number[] = [];
	for (let i = 0; i < bits.length; i += 8) {
		let byte = 0;
		for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] & 1);
		codewords.push(byte);
	}

	// 4) pad codewords 0xEC,0x11 alternately
	let toggle = true;
	while (codewords.length < capacityBytes) {
		codewords.push(toggle ? 0xec : 0x11);
		toggle = !toggle;
	}

	// If we somehow exceeded capacity (shouldn't happen), truncate
	if (codewords.length > capacityBytes) codewords.length = capacityBytes;

	return codewords;
}

/**
 * @brief Encode a text payload into QR data codewords.
 *
 * Steps implemented:
 *	- mode indicator
 *	- character count indicator
 *	- payload bytes (according to mode and encoding)
 *	- terminator (up to 4 bits)
 *	- pad bit(s) to full byte
 *	- pad codewords 0xEC / 0x11 alternately until full capacity
 * @param payload The text to encode
 * @param version QR version (1..40)
 * @param ecl Error correction level
 * @param mode QrEncodingMode @default 'byte'
 * @param encoding Text encoding for byte mode @default 'UTF-8'
 * @returns array of data codewords (length = entry.totDataCW)
 */
export function encodePayloadToDataCodewords(
	payload: string,
	version: number,
	ecl: EcLevel,
	mode: QrEncodingMode = 'byte',
	encoding: QrTextEncoding = 'UTF-8'
): number[] {
	const entry = getInfo(version, ecl);
	if (!entry) throw new Error(`Unknown version/ecLevel: ${version} / ${ecl}`);

	// 1) Build bit stream according to mode (including optional ECI)
	const bits = buildBitStreamForPayload(payload, version, mode, encoding);

	// 2) Convert bit stream into padded codewords of length capacityBytes
	const codewords = bitsToPaddedCodewords(bits, entry.totDataCW);

	return codewords;
}