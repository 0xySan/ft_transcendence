/**
 * @file dataEncoding.ts
 * @brief Functions to encode text payloads into QR code data codewords.
 */

import { EcLevel, QrVersionEcEntry, getInfo } from './qr.types.js';

/**
 * Split data codewords into blocks according to version and error correction level.
 * @param dataCodewords Array of data codewords to split
 * @param version QR code version (1..40)
 * @param ecl Error correction level ('L'|'M'|'Q'|'H')
 * @returns Array of blocks, each with { data: number[]; eccCount: number }
 */
export function splitIntoBlocks(
	dataCodewords: number[],
	version: number,
	ecl: EcLevel
): { data: number[]; eccCount: number }[] {
	const entry: QrVersionEcEntry | undefined = getInfo(version, ecl);
	if (!entry) throw new Error(`Unknown version/ecLevel: ${version} / ${ecl}`);

	const blocks: { data: number[]; eccCount: number }[] = [];
	let offset = 0;

	// Group 1 blocks
	for (let i = 0; i < entry.G1Blocks; i++) {
		const size = entry.G1DataCW;
		const slice = dataCodewords.slice(offset, offset + size);
		if (slice.length !== size) throw new Error(`Unexpected slice length for G1 block (expected ${size}, got ${slice.length})`);
		blocks.push({ data: slice, eccCount: entry.ecCWPerBlock });
		offset += size;
	}

	// Group 2 blocks
	for (let i = 0; i < entry.G2Blocks; i++) {
		const size = entry.G2DataCW;
		const slice = dataCodewords.slice(offset, offset + size);
		if (slice.length !== size) throw new Error(`Unexpected slice length for G2 block (expected ${size}, got ${slice.length})`);
		blocks.push({ data: slice, eccCount: entry.ecCWPerBlock });
		offset += size;
	}

	// Sanity check total
	const totalExpected = entry.G1Blocks * entry.G1DataCW + entry.G2Blocks * entry.G2DataCW;
	if (offset !== totalExpected) throw new Error(`Mismatch in total data codewords: expected ${totalExpected}, got ${offset}`);

	console.log(
		`Split into ${blocks.length} blocks: `,
		blocks.map((b, i) => `Block ${i + 1}: ${b.data.length} data bytes, ${b.eccCount} ECC bytes`).join('; ')
	);
	console.log("Raw data length (bits):", dataCodewords.length * 8);
	console.log("Raw data length (bytes):", Math.ceil(dataCodewords.length));
	console.log("Last 16 bytes of final data:", dataCodewords.slice(-16).map(x=>x.toString(16).padStart(2,'0')).join(' '));

	return blocks;
}

/**
 * Intercalate data and ECC blocks, convert to bits, and place in the QR matrix.
 *
 * @param matrix (boolean | null)[][] initial matrix with function patterns placed
 * @param blocks array of { data: number[], eccCount: number }
 * @param eccBlocks array of ECC byte arrays corresponding to blocks (same order)
 * @param functionMask boolean[][] mask where true = reserved/function module
 * @returns modified matrix with data & ecc placed (boolean | null)[][]
 */
export function placeDataAndEcc(
	matrix: (boolean | null)[][],
	blocks: { data: number[]; eccCount: number }[],
	eccBlocks: number[][],
	functionMask: boolean[][]
): (boolean | null)[][] {
	const size = matrix.length;
	const maxDataLen = Math.max(...blocks.map((b) => b.data.length));
	const maxEccLen = Math.max(...eccBlocks.map((b) => b.length));

	// Interleave data and ECC bytes
	const interleaved: number[] = [];
	for (let i = 0; i < maxDataLen; i++) {
		for (let b = 0; b < blocks.length; b++) if (i < blocks[b].data.length) interleaved.push(blocks[b].data[i]);
	}
	for (let i = 0; i < maxEccLen; i++) {
		for (let b = 0; b < eccBlocks.length; b++) if (i < eccBlocks[b].length) interleaved.push(eccBlocks[b][i]);
	}

	// Convert bytes to bits (MSB first)
	const finalBits: number[] = [];
	for (const byte of interleaved) for (let bit = 7; bit >= 0; bit--) finalBits.push((byte >> bit) & 1);

	// Place bits in zigzag (bottom-right)
	let bitIndex = 0;
	let upward = true;
	for (let col = size - 1; col > 0; col -= 2) {
		if (col === 6) col--; // skip timing column

		const colOffsets = [0, 1];
		for (let i = 0; i < size; i++) {
			const row = upward ? size - 1 - i : i;
			for (const offset of colOffsets) {
				const c = col - offset;
				if (c < 0) continue;
				if (!functionMask[row][c]) {
					matrix[row][c] = bitIndex < finalBits.length ? finalBits[bitIndex++] === 1 : false;
				}
			}
		}
		upward = !upward;
	}

	console.log('bits placed:', bitIndex, 'total bits:', finalBits.length);
	if (bitIndex < finalBits.length) console.warn('NOT ALL BITS PLACED - remaining:', finalBits.length - bitIndex);

	return matrix;
}