/**
 * @file qr.constants.ts
 */

import { QrVersionEcEntry } from './qr.types.js';

export const QR_MIN_VERSION = 1;
export const QR_MAX_VERSION = 40;

/**
 * Alignment pattern positions for each QR version (v1..v40)
 * Version 1 has no alignment patterns.
 */
export const ALIGNMENT_POSITIONS: number[][] = [
	[], // v1
	[6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38],
	[6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
	[6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
	[6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82],
	[6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94],
	[6, 26, 50, 74, 98], [6, 30, 54, 78, 102],
	[6, 28, 54, 80, 106], [6, 32, 58, 84, 110],
	[6, 30, 58, 86, 114], [6, 34, 62, 90, 118],
	[6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126],
	[6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134],
	[6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142],
	[6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150],
	[6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158],
	[6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166],
	[6, 30, 58, 86, 114, 142, 170]
];

/**
 * Complete table for QR versions 1..40 and EC levels L/M/Q/H.
 * Use getInfo(version, ecLevel) to lookup an entry.
 * @link https://www.thonky.com/qr-code-tutorial/error-correction-table
 */
export const qrVersionEcTable: QrVersionEcEntry[] = [
	{ version: 1, ecLevel: 'L', totDataCW: 19, ecCWPerBlock: 7,  G1Blocks: 1, G1DataCW: 19, G2Blocks: 0, G2DataCW: 0 },
	{ version: 1, ecLevel: 'M', totDataCW: 16, ecCWPerBlock: 10, G1Blocks: 1, G1DataCW: 16, G2Blocks: 0, G2DataCW: 0 },
	{ version: 1, ecLevel: 'Q', totDataCW: 13, ecCWPerBlock: 13, G1Blocks: 1, G1DataCW: 13, G2Blocks: 0, G2DataCW: 0 },
	{ version: 1, ecLevel: 'H', totDataCW: 9,  ecCWPerBlock: 17, G1Blocks: 1, G1DataCW: 9,  G2Blocks: 0, G2DataCW: 0 },

	{ version: 2, ecLevel: 'L', totDataCW: 34, ecCWPerBlock: 10, G1Blocks: 1, G1DataCW: 34, G2Blocks: 0, G2DataCW: 0 },
	{ version: 2, ecLevel: 'M', totDataCW: 28, ecCWPerBlock: 16, G1Blocks: 1, G1DataCW: 28, G2Blocks: 0, G2DataCW: 0 },
	{ version: 2, ecLevel: 'Q', totDataCW: 22, ecCWPerBlock: 22, G1Blocks: 1, G1DataCW: 22, G2Blocks: 0, G2DataCW: 0 },
	{ version: 2, ecLevel: 'H', totDataCW: 16, ecCWPerBlock: 28, G1Blocks: 1, G1DataCW: 16, G2Blocks: 0, G2DataCW: 0 },

	{ version: 3, ecLevel: 'L', totDataCW: 55, ecCWPerBlock: 15, G1Blocks: 1, G1DataCW: 55, G2Blocks: 0, G2DataCW: 0 },
	{ version: 3, ecLevel: 'M', totDataCW: 44, ecCWPerBlock: 26, G1Blocks: 1, G1DataCW: 44, G2Blocks: 0, G2DataCW: 0 },
	{ version: 3, ecLevel: 'Q', totDataCW: 34, ecCWPerBlock: 18, G1Blocks: 2, G1DataCW: 17, G2Blocks: 0, G2DataCW: 0 },
	{ version: 3, ecLevel: 'H', totDataCW: 26, ecCWPerBlock: 22, G1Blocks: 2, G1DataCW: 13, G2Blocks: 0, G2DataCW: 0 },

	{ version: 4, ecLevel: 'L', totDataCW: 80, ecCWPerBlock: 20, G1Blocks: 1, G1DataCW: 80, G2Blocks: 0, G2DataCW: 0 },
	{ version: 4, ecLevel: 'M', totDataCW: 64, ecCWPerBlock: 18, G1Blocks: 2, G1DataCW: 32, G2Blocks: 0, G2DataCW: 0 },
	{ version: 4, ecLevel: 'Q', totDataCW: 48, ecCWPerBlock: 26, G1Blocks: 2, G1DataCW: 24, G2Blocks: 0, G2DataCW: 0 },
	{ version: 4, ecLevel: 'H', totDataCW: 36, ecCWPerBlock: 16, G1Blocks: 4, G1DataCW: 9,  G2Blocks: 0, G2DataCW: 0 },

	{ version: 5, ecLevel: 'L', totDataCW: 108, ecCWPerBlock: 26, G1Blocks: 1, G1DataCW: 108, G2Blocks: 0, G2DataCW: 0 },
	{ version: 5, ecLevel: 'M', totDataCW: 86, ecCWPerBlock: 24, G1Blocks: 2, G1DataCW: 43, G2Blocks: 0, G2DataCW: 0 },
	{ version: 5, ecLevel: 'Q', totDataCW: 62, ecCWPerBlock: 18, G1Blocks: 2, G1DataCW: 15, G2Blocks: 2, G2DataCW: 16 },
	{ version: 5, ecLevel: 'H', totDataCW: 46, ecCWPerBlock: 22, G1Blocks: 2, G1DataCW: 11, G2Blocks: 2, G2DataCW: 12 },

	{ version: 6, ecLevel: 'L', totDataCW: 136, ecCWPerBlock: 18, G1Blocks: 2, G1DataCW: 68, G2Blocks: 0, G2DataCW: 0 },
	{ version: 6, ecLevel: 'M', totDataCW: 108, ecCWPerBlock: 16, G1Blocks: 4, G1DataCW: 27, G2Blocks: 0, G2DataCW: 0 },
	{ version: 6, ecLevel: 'Q', totDataCW: 76, ecCWPerBlock: 24, G1Blocks: 4, G1DataCW: 19, G2Blocks: 0, G2DataCW: 0 },
	{ version: 6, ecLevel: 'H', totDataCW: 60, ecCWPerBlock: 28, G1Blocks: 4, G1DataCW: 15, G2Blocks: 0, G2DataCW: 0 },

	{ version: 7, ecLevel: 'L', totDataCW: 156, ecCWPerBlock: 20, G1Blocks: 2, G1DataCW: 78, G2Blocks: 0, G2DataCW: 0 },
	{ version: 7, ecLevel: 'M', totDataCW: 124, ecCWPerBlock: 18, G1Blocks: 4, G1DataCW: 31, G2Blocks: 0, G2DataCW: 0 },
	{ version: 7, ecLevel: 'Q', totDataCW: 88, ecCWPerBlock: 18, G1Blocks: 2, G1DataCW: 14, G2Blocks: 4, G2DataCW: 15 },
	{ version: 7, ecLevel: 'H', totDataCW: 66, ecCWPerBlock: 26, G1Blocks: 4, G1DataCW: 13, G2Blocks: 1, G2DataCW: 14 },

	{ version: 8, ecLevel: 'L', totDataCW: 194, ecCWPerBlock: 24, G1Blocks: 2, G1DataCW: 97, G2Blocks: 0, G2DataCW: 0 },
	{ version: 8, ecLevel: 'M', totDataCW: 154, ecCWPerBlock: 22, G1Blocks: 2, G1DataCW: 38, G2Blocks: 2, G2DataCW: 39 },
	{ version: 8, ecLevel: 'Q', totDataCW: 110, ecCWPerBlock: 22, G1Blocks: 4, G1DataCW: 18, G2Blocks: 2, G2DataCW: 19 },
	{ version: 8, ecLevel: 'H', totDataCW: 86, ecCWPerBlock: 26, G1Blocks: 4, G1DataCW: 14, G2Blocks: 2, G2DataCW: 15 },

	{ version: 9, ecLevel: 'L', totDataCW: 232, ecCWPerBlock: 30, G1Blocks: 2, G1DataCW: 116, G2Blocks: 0, G2DataCW: 0 },
	{ version: 9, ecLevel: 'M', totDataCW: 182, ecCWPerBlock: 22, G1Blocks: 3, G1DataCW: 36, G2Blocks: 2, G2DataCW: 37 },
	{ version: 9, ecLevel: 'Q', totDataCW: 132, ecCWPerBlock: 20, G1Blocks: 4, G1DataCW: 16, G2Blocks: 4, G2DataCW: 17 },
	{ version: 9, ecLevel: 'H', totDataCW: 100, ecCWPerBlock: 24, G1Blocks: 4, G1DataCW: 12, G2Blocks: 4, G2DataCW: 13 },

	{ version: 10, ecLevel: 'L', totDataCW: 274, ecCWPerBlock: 18, G1Blocks: 2, G1DataCW: 68, G2Blocks: 2, G2DataCW: 69 },
	{ version: 10, ecLevel: 'M', totDataCW: 216, ecCWPerBlock: 26, G1Blocks: 4, G1DataCW: 43, G2Blocks: 1, G2DataCW: 44 },
	{ version: 10, ecLevel: 'Q', totDataCW: 154, ecCWPerBlock: 24, G1Blocks: 6, G1DataCW: 19, G2Blocks: 2, G2DataCW: 20 },
	{ version: 10, ecLevel: 'H', totDataCW: 122, ecCWPerBlock: 28, G1Blocks: 6, G1DataCW: 15, G2Blocks: 2, G2DataCW: 16 },

	{ version: 11, ecLevel: 'L', totDataCW: 324, ecCWPerBlock: 20, G1Blocks: 4, G1DataCW: 81, G2Blocks: 0, G2DataCW: 0 },
	{ version: 11, ecLevel: 'M', totDataCW: 254, ecCWPerBlock: 30, G1Blocks: 1, G1DataCW: 50, G2Blocks: 4, G2DataCW: 51 },
	{ version: 11, ecLevel: 'Q', totDataCW: 180, ecCWPerBlock: 28, G1Blocks: 4, G1DataCW: 22, G2Blocks: 4, G2DataCW: 23 },
	{ version: 11, ecLevel: 'H', totDataCW: 140, ecCWPerBlock: 24, G1Blocks: 3, G1DataCW: 12, G2Blocks: 8, G2DataCW: 13 },

	{ version: 12, ecLevel: 'L', totDataCW: 370, ecCWPerBlock: 24, G1Blocks: 2, G1DataCW: 92, G2Blocks: 2, G2DataCW: 93 },
	{ version: 12, ecLevel: 'M', totDataCW: 290, ecCWPerBlock: 22, G1Blocks: 6, G1DataCW: 36, G2Blocks: 2, G2DataCW: 37 },
	{ version: 12, ecLevel: 'Q', totDataCW: 206, ecCWPerBlock: 26, G1Blocks: 4, G1DataCW: 20, G2Blocks: 6, G2DataCW: 21 },
	{ version: 12, ecLevel: 'H', totDataCW: 158, ecCWPerBlock: 28, G1Blocks: 7, G1DataCW: 14, G2Blocks: 4, G2DataCW: 15 },

	{ version: 13, ecLevel: 'L', totDataCW: 428, ecCWPerBlock: 26, G1Blocks: 4, G1DataCW: 107, G2Blocks: 0, G2DataCW: 0 },
	{ version: 13, ecLevel: 'M', totDataCW: 334, ecCWPerBlock: 22, G1Blocks: 8, G1DataCW: 37, G2Blocks: 1, G2DataCW: 38 },
	{ version: 13, ecLevel: 'Q', totDataCW: 244, ecCWPerBlock: 24, G1Blocks: 8, G1DataCW: 20, G2Blocks: 4, G2DataCW: 21 },
	{ version: 13, ecLevel: 'H', totDataCW: 180, ecCWPerBlock: 22, G1Blocks: 12, G1DataCW: 11, G2Blocks: 4, G2DataCW: 12 },

	{ version: 14, ecLevel: 'L', totDataCW: 461, ecCWPerBlock: 30, G1Blocks: 3, G1DataCW: 115, G2Blocks: 1, G2DataCW: 116 },
	{ version: 14, ecLevel: 'M', totDataCW: 365, ecCWPerBlock: 24, G1Blocks: 4, G1DataCW: 40, G2Blocks: 5, G2DataCW: 41 },
	{ version: 14, ecLevel: 'Q', totDataCW: 261, ecCWPerBlock: 20, G1Blocks: 11, G1DataCW: 16, G2Blocks: 5, G2DataCW: 17 },
	{ version: 14, ecLevel: 'H', totDataCW: 197, ecCWPerBlock: 24, G1Blocks: 11, G1DataCW: 12, G2Blocks: 5, G2DataCW: 13 },

	{ version: 15, ecLevel: 'L', totDataCW: 523, ecCWPerBlock: 22, G1Blocks: 5, G1DataCW: 87, G2Blocks: 1, G2DataCW: 88 },
	{ version: 15, ecLevel: 'M', totDataCW: 415, ecCWPerBlock: 24, G1Blocks: 5, G1DataCW: 41, G2Blocks: 5, G2DataCW: 42 },
	{ version: 15, ecLevel: 'Q', totDataCW: 295, ecCWPerBlock: 30, G1Blocks: 5, G1DataCW: 24, G2Blocks: 7, G2DataCW: 25 },
	{ version: 15, ecLevel: 'H', totDataCW: 223, ecCWPerBlock: 24, G1Blocks: 11, G1DataCW: 12, G2Blocks: 7, G2DataCW: 13 },

	{ version: 16, ecLevel: 'L', totDataCW: 589, ecCWPerBlock: 24, G1Blocks: 5, G1DataCW: 98, G2Blocks: 1, G2DataCW: 99 },
	{ version: 16, ecLevel: 'M', totDataCW: 453, ecCWPerBlock: 28, G1Blocks: 7, G1DataCW: 45, G2Blocks: 3, G2DataCW: 46 },
	{ version: 16, ecLevel: 'Q', totDataCW: 325, ecCWPerBlock: 24, G1Blocks: 15, G1DataCW: 19, G2Blocks: 2, G2DataCW: 20 },
	{ version: 16, ecLevel: 'H', totDataCW: 253, ecCWPerBlock: 30, G1Blocks: 3, G1DataCW: 15, G2Blocks: 13, G2DataCW: 16 },

	{ version: 17, ecLevel: 'L', totDataCW: 647, ecCWPerBlock: 28, G1Blocks: 1, G1DataCW: 107, G2Blocks: 5, G2DataCW: 108 },
	{ version: 17, ecLevel: 'M', totDataCW: 507, ecCWPerBlock: 28, G1Blocks: 10, G1DataCW: 46, G2Blocks: 1, G2DataCW: 47 },
	{ version: 17, ecLevel: 'Q', totDataCW: 367, ecCWPerBlock: 28, G1Blocks: 1, G1DataCW: 22, G2Blocks: 15, G2DataCW: 23 },
	{ version: 17, ecLevel: 'H', totDataCW: 283, ecCWPerBlock: 28, G1Blocks: 2, G1DataCW: 14, G2Blocks: 17, G2DataCW: 15 },

	{ version: 18, ecLevel: 'L', totDataCW: 721, ecCWPerBlock: 30, G1Blocks: 5, G1DataCW: 120, G2Blocks: 1, G2DataCW: 121 },
	{ version: 18, ecLevel: 'M', totDataCW: 563, ecCWPerBlock: 26, G1Blocks: 9, G1DataCW: 43, G2Blocks: 4, G2DataCW: 44 },
	{ version: 18, ecLevel: 'Q', totDataCW: 397, ecCWPerBlock: 28, G1Blocks: 17, G1DataCW: 22, G2Blocks: 1, G2DataCW: 23 },
	{ version: 18, ecLevel: 'H', totDataCW: 313, ecCWPerBlock: 28, G1Blocks: 2, G1DataCW: 14, G2Blocks: 19, G2DataCW: 15 },

	{ version: 19, ecLevel: 'L', totDataCW: 795, ecCWPerBlock: 28, G1Blocks: 3, G1DataCW: 113, G2Blocks: 4, G2DataCW: 114 },
	{ version: 19, ecLevel: 'M', totDataCW: 627, ecCWPerBlock: 26, G1Blocks: 3, G1DataCW: 44, G2Blocks: 11, G2DataCW: 45 },
	{ version: 19, ecLevel: 'Q', totDataCW: 445, ecCWPerBlock: 26, G1Blocks: 17, G1DataCW: 21, G2Blocks: 4, G2DataCW: 22 },
	{ version: 19, ecLevel: 'H', totDataCW: 341, ecCWPerBlock: 26, G1Blocks: 9, G1DataCW: 13, G2Blocks: 16, G2DataCW: 14 },

	{ version: 20, ecLevel: 'L', totDataCW: 861, ecCWPerBlock: 28, G1Blocks: 3, G1DataCW: 107, G2Blocks: 5, G2DataCW: 108 },
	{ version: 20, ecLevel: 'M', totDataCW: 669, ecCWPerBlock: 26, G1Blocks: 3, G1DataCW: 41, G2Blocks: 13, G2DataCW: 42 },
	{ version: 20, ecLevel: 'Q', totDataCW: 485, ecCWPerBlock: 30, G1Blocks: 15, G1DataCW: 24, G2Blocks: 5, G2DataCW: 25 },
	{ version: 20, ecLevel: 'H', totDataCW: 385, ecCWPerBlock: 28, G1Blocks: 15, G1DataCW: 15, G2Blocks: 10, G2DataCW: 16 },

	{ version: 21, ecLevel: 'L', totDataCW: 932, ecCWPerBlock: 28, G1Blocks: 4, G1DataCW: 116, G2Blocks: 4, G2DataCW: 117 },
	{ version: 21, ecLevel: 'M', totDataCW: 714, ecCWPerBlock: 26, G1Blocks: 17, G1DataCW: 42, G2Blocks: 0, G2DataCW: 0 },
	{ version: 21, ecLevel: 'Q', totDataCW: 512, ecCWPerBlock: 28, G1Blocks: 17, G1DataCW: 22, G2Blocks: 6, G2DataCW: 23 },
	{ version: 21, ecLevel: 'H', totDataCW: 406, ecCWPerBlock: 30, G1Blocks: 19, G1DataCW: 16, G2Blocks: 6, G2DataCW: 17 },

	{ version: 22, ecLevel: 'L', totDataCW: 1006, ecCWPerBlock: 28, G1Blocks: 2, G1DataCW: 111, G2Blocks: 7, G2DataCW: 112 },
	{ version: 22, ecLevel: 'M', totDataCW: 782, ecCWPerBlock: 28, G1Blocks: 17, G1DataCW: 46, G2Blocks: 0, G2DataCW: 0 },
	{ version: 22, ecLevel: 'Q', totDataCW: 568, ecCWPerBlock: 30, G1Blocks: 7, G1DataCW: 24, G2Blocks: 16, G2DataCW: 25 },
	{ version: 22, ecLevel: 'H', totDataCW: 442, ecCWPerBlock: 24, G1Blocks: 34, G1DataCW: 13, G2Blocks: 0, G2DataCW: 0 },

	{ version: 23, ecLevel: 'L', totDataCW: 1094, ecCWPerBlock: 30, G1Blocks: 4, G1DataCW: 121, G2Blocks: 5, G2DataCW: 122 },
	{ version: 23, ecLevel: 'M', totDataCW: 860, ecCWPerBlock: 28, G1Blocks: 4, G1DataCW: 47, G2Blocks: 14, G2DataCW: 48 },
	{ version: 23, ecLevel: 'Q', totDataCW: 614, ecCWPerBlock: 30, G1Blocks: 11, G1DataCW: 24, G2Blocks: 14, G2DataCW: 25 },
	{ version: 23, ecLevel: 'H', totDataCW: 464, ecCWPerBlock: 30, G1Blocks: 16, G1DataCW: 15, G2Blocks: 14, G2DataCW: 16 },

	{ version: 24, ecLevel: 'L', totDataCW: 1174, ecCWPerBlock: 30, G1Blocks: 6, G1DataCW: 117, G2Blocks: 4, G2DataCW: 118 },
	{ version: 24, ecLevel: 'M', totDataCW: 914, ecCWPerBlock: 28, G1Blocks: 6, G1DataCW: 45, G2Blocks: 14, G2DataCW: 46 },
	{ version: 24, ecLevel: 'Q', totDataCW: 664, ecCWPerBlock: 30, G1Blocks: 11, G1DataCW: 24, G2Blocks: 16, G2DataCW: 25 },
	{ version: 24, ecLevel: 'H', totDataCW: 514, ecCWPerBlock: 30, G1Blocks: 30, G1DataCW: 16, G2Blocks: 2, G2DataCW: 17 },

	{ version: 25, ecLevel: 'L', totDataCW: 1276, ecCWPerBlock: 26, G1Blocks: 8, G1DataCW: 106, G2Blocks: 4, G2DataCW: 107 },
	{ version: 25, ecLevel: 'M', totDataCW: 1000, ecCWPerBlock: 28, G1Blocks: 8, G1DataCW: 47, G2Blocks: 13, G2DataCW: 48 },
	{ version: 25, ecLevel: 'Q', totDataCW: 718, ecCWPerBlock: 30, G1Blocks: 7, G1DataCW: 24, G2Blocks: 22, G2DataCW: 25 },
	{ version: 25, ecLevel: 'H', totDataCW: 538, ecCWPerBlock: 30, G1Blocks: 22, G1DataCW: 15, G2Blocks: 13, G2DataCW: 16 },

	{ version: 26, ecLevel: 'L', totDataCW: 1370, ecCWPerBlock: 28, G1Blocks: 10, G1DataCW: 114, G2Blocks: 2, G2DataCW: 115 },
	{ version: 26, ecLevel: 'M', totDataCW: 1062, ecCWPerBlock: 28, G1Blocks: 19, G1DataCW: 46, G2Blocks: 4, G2DataCW: 47 },
	{ version: 26, ecLevel: 'Q', totDataCW: 754, ecCWPerBlock: 28, G1Blocks: 28, G1DataCW: 22, G2Blocks: 6, G2DataCW: 23 },
	{ version: 26, ecLevel: 'H', totDataCW: 596, ecCWPerBlock: 30, G1Blocks: 33, G1DataCW: 16, G2Blocks: 4, G2DataCW: 17 },

	{ version: 27, ecLevel: 'L', totDataCW: 1468, ecCWPerBlock: 30, G1Blocks: 8, G1DataCW: 122, G2Blocks: 4, G2DataCW: 123 },
	{ version: 27, ecLevel: 'M', totDataCW: 1128, ecCWPerBlock: 28, G1Blocks: 22, G1DataCW: 45, G2Blocks: 3, G2DataCW: 46 },
	{ version: 27, ecLevel: 'Q', totDataCW: 808, ecCWPerBlock: 30, G1Blocks: 8, G1DataCW: 23, G2Blocks: 26, G2DataCW: 24 },
	{ version: 27, ecLevel: 'H', totDataCW: 628, ecCWPerBlock: 30, G1Blocks: 12, G1DataCW: 15, G2Blocks: 28, G2DataCW: 16 },

	{ version: 28, ecLevel: 'L', totDataCW: 1531, ecCWPerBlock: 30, G1Blocks: 3, G1DataCW: 117, G2Blocks: 10, G2DataCW: 118 },
	{ version: 28, ecLevel: 'M', totDataCW: 1193, ecCWPerBlock: 28, G1Blocks: 3, G1DataCW: 45, G2Blocks: 23, G2DataCW: 46 },
	{ version: 28, ecLevel: 'Q', totDataCW: 871, ecCWPerBlock: 30, G1Blocks: 4, G1DataCW: 24, G2Blocks: 31, G2DataCW: 25 },
	{ version: 28, ecLevel: 'H', totDataCW: 661, ecCWPerBlock: 30, G1Blocks: 11, G1DataCW: 15, G2Blocks: 31, G2DataCW: 16 },

	{ version: 29, ecLevel: 'L', totDataCW: 1631, ecCWPerBlock: 30, G1Blocks: 7, G1DataCW: 116, G2Blocks: 7, G2DataCW: 117 },
	{ version: 29, ecLevel: 'M', totDataCW: 1267, ecCWPerBlock: 28, G1Blocks: 21, G1DataCW: 45, G2Blocks: 7, G2DataCW: 46 },
	{ version: 29, ecLevel: 'Q', totDataCW: 911, ecCWPerBlock: 30, G1Blocks: 1, G1DataCW: 23, G2Blocks: 37, G2DataCW: 24 },
	{ version: 29, ecLevel: 'H', totDataCW: 701, ecCWPerBlock: 30, G1Blocks: 19, G1DataCW: 15, G2Blocks: 26, G2DataCW: 16 },

	{ version: 30, ecLevel: 'L', totDataCW: 1735, ecCWPerBlock: 30, G1Blocks: 5, G1DataCW: 115, G2Blocks: 10, G2DataCW: 116 },
	{ version: 30, ecLevel: 'M', totDataCW: 1373, ecCWPerBlock: 28, G1Blocks: 19, G1DataCW: 47, G2Blocks: 10, G2DataCW: 48 },
	{ version: 30, ecLevel: 'Q', totDataCW: 985, ecCWPerBlock: 30, G1Blocks: 15, G1DataCW: 24, G2Blocks: 25, G2DataCW: 25 },
	{ version: 30, ecLevel: 'H', totDataCW: 745, ecCWPerBlock: 30, G1Blocks: 23, G1DataCW: 15, G2Blocks: 25, G2DataCW: 16 },

	{ version: 31, ecLevel: 'L', totDataCW: 1843, ecCWPerBlock: 30, G1Blocks: 13, G1DataCW: 115, G2Blocks: 3, G2DataCW: 116 },
	{ version: 31, ecLevel: 'M', totDataCW: 1455, ecCWPerBlock: 28, G1Blocks: 2, G1DataCW: 46, G2Blocks: 29, G2DataCW: 47 },
	{ version: 31, ecLevel: 'Q', totDataCW: 1033, ecCWPerBlock: 30, G1Blocks: 42, G1DataCW: 24, G2Blocks: 1, G2DataCW: 25 },
	{ version: 31, ecLevel: 'H', totDataCW: 793, ecCWPerBlock: 30, G1Blocks: 23, G1DataCW: 15, G2Blocks: 28, G2DataCW: 16 },

	{ version: 32, ecLevel: 'L', totDataCW: 1955, ecCWPerBlock: 30, G1Blocks: 17, G1DataCW: 115, G2Blocks: 0, G2DataCW: 0 },
	{ version: 32, ecLevel: 'M', totDataCW: 1541, ecCWPerBlock: 28, G1Blocks: 10, G1DataCW: 46, G2Blocks: 23, G2DataCW: 47 },
	{ version: 32, ecLevel: 'Q', totDataCW: 1115, ecCWPerBlock: 30, G1Blocks: 10, G1DataCW: 24, G2Blocks: 35, G2DataCW: 25 },
	{ version: 32, ecLevel: 'H', totDataCW: 845, ecCWPerBlock: 30, G1Blocks: 19, G1DataCW: 15, G2Blocks: 35, G2DataCW: 16 },

	{ version: 33, ecLevel: 'L', totDataCW: 2071, ecCWPerBlock: 30, G1Blocks: 17, G1DataCW: 115, G2Blocks: 1, G2DataCW: 116 },
	{ version: 33, ecLevel: 'M', totDataCW: 1631, ecCWPerBlock: 28, G1Blocks: 14, G1DataCW: 46, G2Blocks: 21, G2DataCW: 47 },
	{ version: 33, ecLevel: 'Q', totDataCW: 1171, ecCWPerBlock: 30, G1Blocks: 29, G1DataCW: 24, G2Blocks: 19, G2DataCW: 25 },
	{ version: 33, ecLevel: 'H', totDataCW: 901, ecCWPerBlock: 30, G1Blocks: 11, G1DataCW: 15, G2Blocks: 46, G2DataCW: 16 },

	{ version: 34, ecLevel: 'L', totDataCW: 2191, ecCWPerBlock: 30, G1Blocks: 13, G1DataCW: 115, G2Blocks: 6, G2DataCW: 116 },
	{ version: 34, ecLevel: 'M', totDataCW: 1725, ecCWPerBlock: 28, G1Blocks: 14, G1DataCW: 46, G2Blocks: 23, G2DataCW: 47 },
	{ version: 34, ecLevel: 'Q', totDataCW: 1231, ecCWPerBlock: 30, G1Blocks: 44, G1DataCW: 24, G2Blocks: 7, G2DataCW: 25 },
	{ version: 34, ecLevel: 'H', totDataCW: 961, ecCWPerBlock: 30, G1Blocks: 59, G1DataCW: 16, G2Blocks: 1, G2DataCW: 17 },

	{ version: 35, ecLevel: 'L', totDataCW: 2306, ecCWPerBlock: 30, G1Blocks: 12, G1DataCW: 121, G2Blocks: 7, G2DataCW: 122 },
	{ version: 35, ecLevel: 'M', totDataCW: 1812, ecCWPerBlock: 28, G1Blocks: 12, G1DataCW: 47, G2Blocks: 26, G2DataCW: 48 },
	{ version: 35, ecLevel: 'Q', totDataCW: 1286, ecCWPerBlock: 30, G1Blocks: 39, G1DataCW: 24, G2Blocks: 14, G2DataCW: 25 },
	{ version: 35, ecLevel: 'H', totDataCW: 986, ecCWPerBlock: 30, G1Blocks: 22, G1DataCW: 15, G2Blocks: 41, G2DataCW: 16 },

	{ version: 36, ecLevel: 'L', totDataCW: 2434, ecCWPerBlock: 30, G1Blocks: 6, G1DataCW: 121, G2Blocks: 14, G2DataCW: 122 },
	{ version: 36, ecLevel: 'M', totDataCW: 1914, ecCWPerBlock: 28, G1Blocks: 6, G1DataCW: 47, G2Blocks: 34, G2DataCW: 48 },
	{ version: 36, ecLevel: 'Q', totDataCW: 1354, ecCWPerBlock: 30, G1Blocks: 46, G1DataCW: 24, G2Blocks: 10, G2DataCW: 25 },
	{ version: 36, ecLevel: 'H', totDataCW: 1054, ecCWPerBlock: 30, G1Blocks: 2, G1DataCW: 15, G2Blocks: 64, G2DataCW: 16 },

	{ version: 37, ecLevel: 'L', totDataCW: 2566, ecCWPerBlock: 30, G1Blocks: 17, G1DataCW: 122, G2Blocks: 4, G2DataCW: 123 },
	{ version: 37, ecLevel: 'M', totDataCW: 1992, ecCWPerBlock: 28, G1Blocks: 29, G1DataCW: 46, G2Blocks: 14, G2DataCW: 47 },
	{ version: 37, ecLevel: 'Q', totDataCW: 1426, ecCWPerBlock: 30, G1Blocks: 49, G1DataCW: 24, G2Blocks: 10, G2DataCW: 25 },
	{ version: 37, ecLevel: 'H', totDataCW: 1096, ecCWPerBlock: 30, G1Blocks: 24, G1DataCW: 15, G2Blocks: 46, G2DataCW: 16 },

	{ version: 38, ecLevel: 'L', totDataCW: 2702, ecCWPerBlock: 30, G1Blocks: 4, G1DataCW: 122, G2Blocks: 18, G2DataCW: 123 },
	{ version: 38, ecLevel: 'M', totDataCW: 2102, ecCWPerBlock: 28, G1Blocks: 13, G1DataCW: 46, G2Blocks: 32, G2DataCW: 47 },
	{ version: 38, ecLevel: 'Q', totDataCW: 1502, ecCWPerBlock: 30, G1Blocks: 48, G1DataCW: 24, G2Blocks: 14, G2DataCW: 25 },
	{ version: 38, ecLevel: 'H', totDataCW: 1142, ecCWPerBlock: 30, G1Blocks: 42, G1DataCW: 15, G2Blocks: 32, G2DataCW: 16 },

	{ version: 39, ecLevel: 'L', totDataCW: 2812, ecCWPerBlock: 30, G1Blocks: 20, G1DataCW: 117, G2Blocks: 4, G2DataCW: 118 },
	{ version: 39, ecLevel: 'M', totDataCW: 2216, ecCWPerBlock: 28, G1Blocks: 40, G1DataCW: 47, G2Blocks: 7, G2DataCW: 48 },
	{ version: 39, ecLevel: 'Q', totDataCW: 1582, ecCWPerBlock: 30, G1Blocks: 43, G1DataCW: 24, G2Blocks: 22, G2DataCW: 25 },
	{ version: 39, ecLevel: 'H', totDataCW: 1222, ecCWPerBlock: 30, G1Blocks: 10, G1DataCW: 15, G2Blocks: 67, G2DataCW: 16 },

	{ version: 40, ecLevel: 'L', totDataCW: 2956, ecCWPerBlock: 30, G1Blocks: 19, G1DataCW: 118, G2Blocks: 6, G2DataCW: 119 },
	{ version: 40, ecLevel: 'M', totDataCW: 2334, ecCWPerBlock: 28, G1Blocks: 18, G1DataCW: 47, G2Blocks: 31, G2DataCW: 48 },
	{ version: 40, ecLevel: 'Q', totDataCW: 1666, ecCWPerBlock: 30, G1Blocks: 34, G1DataCW: 24, G2Blocks: 34, G2DataCW: 25 },
	{ version: 40, ecLevel: 'H', totDataCW: 1276, ecCWPerBlock: 30, G1Blocks: 20, G1DataCW: 15, G2Blocks: 61, G2DataCW: 16 }
];