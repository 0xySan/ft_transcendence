/**
 * @file qr-table.ts
 * @description QR Code Version and Error Correction Level table.
 */

import { qrVersionEcTable } from './qr.constants.js';

/**
 * Error Correction Levels as per QR Code specification.
 * Low (L), Medium (M), Quartile (Q), High (H).
 * @description Levels can recover:
 * - L: ~7% of data bytes
 * - M: ~15% of data bytes
 * - Q: ~25% of data bytes
 * - H: ~30% of data bytes
 * 
 * Higher lvl = more redundancy = less data capacity.
 */
export type EcLevel = 'L' | 'M' | 'Q' | 'H';

/**
 * Entry in the QR Version and EC Level table.
 */
export interface QrVersionEcEntry {
	/** QR Code version (1..40) */
	version: number;

	/** Error Correction Level */
	ecLevel: EcLevel;

	/** Total number of data codewords for this version and EC level */
	totDataCW: number;

	/** Number of error correction codewords per block */
	ecCWPerBlock: number;

	/** Number of blocks in group 1 */
	G1Blocks: number;

	/** Number of data codewords per block in group 1 */
	G1DataCW: number;

	/** Number of blocks in group 2 */
	G2Blocks: number;

	/** Number of data codewords per block in group 2 */
	G2DataCW: number;
}

/**
 * QR Encoding Modes.
 * Used to specify how data is encoded in the QR code.
 * @see [Mode Indicator](https://www.thonky.com/qr-code-tutorial/data-encoding#step-3-add-the-mode-indicator)
 */
export type QrEncodingMode =
	| 'numeric'
	| 'alphanumeric'
	| 'byte'
	| 'kanji'
	| 'eci';

/**
 * Mapping of QrEncodingMode to its corresponding bit representation.
 * Used in the mode indicator of the QR code data structure.
 */
export const QrEncodingModeBits: Record<QrEncodingMode, string> = {
	numeric: '0001',
	alphanumeric: '0010',
	byte: '0100',
	kanji: '1000',
	eci: '0111',
};

/**
 * Text encoding options for QR codes.
 * Specifies the character encoding used for byte mode data.
 */
export type QrTextEncoding =
	| 'UTF-8'
	| 'ISO-8859-1'
	| 'UTF-16BE'
	| 'Shift_JIS';

/**
 * Mapping of QrTextEncoding to their corresponding ECI assignment numbers.
 * ECI (Extended Channel Interpretation) assignments are used to specify
 * the character encoding in QR codes.
 * @see [ECI Assignments](https://symbology.dev/docs/encoding.html#available-eci-codes)
 */
export const ECI_ASSIGNMENTS: Record<QrTextEncoding, number> = {
	'UTF-8': 26,
	'ISO-8859-1': 3,
	'UTF-16BE': 25,
	'Shift_JIS': 20,
};

/**
 * Table for alphanumeric character set used in QR codes.
 * - 0-9
 * - A-Z
 * - ' ' $ % * + - . / :
 */
export const ALPHANUMERIC_TABLE: string = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'

/**
 * Get QR version and error correction level info
 * @param version the QR version
 * @param ecLevel the error correction level
 * @returns the corresponding info entry, or undefined if not found
 */
export function getInfo(version: number, ecLevel: EcLevel): QrVersionEcEntry | undefined {
	return qrVersionEcTable.find(e => e.version === version && e.ecLevel === ecLevel);
}