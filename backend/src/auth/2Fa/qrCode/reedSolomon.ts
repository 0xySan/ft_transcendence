/**
 * @file reedSolomon.ts
 * @brief Reed–Solomon error correction encoding for QR codes (with detailed comments).
 *
 * Overview / algorithm
 * ---------------------------------
 * Reed–Solomon (RS) codes are used to add error-correcting bytes to the data of a QR code.
 * RS is defined over the finite field GF(256) (8-bit symbols). The steps to produce ECC bytes:
 *
 * 1. Work in GF(256) with a chosen primitive polynomial (QR uses x^8 + x^4 + x^3 + x^2 + 1 -> 0x11d).
 * 2. Build exponent (EXP) and log (LOG) tables so multiplication/division can be done by table lookups.
 * 3. Build the generator polynomial g(x) of degree `eccCount`:
 *      g(x) = (x - α^0) * (x - α^1) * ... * (x - α^(eccCount-1))
 *    where α is a primitive element of GF(256).
 * 4. Form the message polynomial M(x) = data(x) * x^(eccCount)  (i.e. append eccCount zeros).
 * 5. Compute the remainder R(x) = M(x) mod g(x). The coefficients of R(x) are the ECC bytes.
 *
 * Implementation notes & conventions used here
 * -------------------------------------------
 * - Field arithmetic:
 *     We precompute EXP and LOG tables:
 *       EXP[i] = α^i  for i = 0..254, and we duplicate EXP to length 512 to avoid modulus when indexing.
 *       LOG[α^i] = i
 *     Multiplication: a * b = EXP[LOG[a] + LOG[b]]
 *     Division: a / b = EXP[ (LOG[a] - LOG[b]) mod 255 ]
 *
 * - Polynomial representation:
 *     Arrays (Uint8Array) hold coefficients in **natural left-to-right order**:
 *       index 0 => coefficient of the highest-degree term in the array
 *       index (len-1) => coefficient of x^0 (constant term)
 *     e.g. [a0, a1, a2] represents a0*x^2 + a1*x + a2
 *
 * - polyMul and polyMod are implemented consistently with that representation.
 *
 * - All arithmetic on coefficients is done in GF(256). Subtraction is identical to addition (XOR).
 *
 * - This implementation aims for clarity and correctness consistent with QR RS usage.
 * https://dev.to/maxart2501/let-s-develop-a-qr-code-generator-part-iii-error-correction-1kbm
 */


/* -------------------------
 * Galois Field 256 tables
 * -------------------------
 *
 * We use the QR standard primitive polynomial 0x11d and build:
 *  - EXP: exponent table (α^i)
 *  - LOG: logarithm table (log_α(value) = i)
 *
 * EXP is duplicated to 512 entries to allow indexing EXP[LOG[a] + LOG[b]] without modulus.
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

/**
 * Generator polynomial cache
 *
 * To avoid recomputing generator polynomials of the same degree multiple times,
 * we cache them in this object.
 */
const GENERATOR_CACHE: Record<number, Uint8Array> = {};


/**
 * Initialize Galois Field exponent and logarithm tables.
 * This immediately-executed function runs at module load time.
 */
(function initGFTables() {
	let x = 1;
	for (let i = 0; i < 255; i++) {
		EXP[i] = x;
		LOG[x] = i;
		x <<= 1; // multiply by 2 in GF(256)
		// if bit 8 set, reduce modulo primitive polynomial
		if (x & 0x100) x ^= 0x11d; // 0x11d = x^8 + x^4 + x^3 + x^2 + 1
	}
	// duplicate EXP so index arithmetic can exceed 255 without doing modulus
	for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

/**
 * Multiply two field elements in GF(256).
 * Uses EXP/LOG table: if a == 0 or b == 0 => product 0.
 * Otherwise product = EXP[ LOG[a] + LOG[b] ].
 */
function gfMul(a: number, b: number): number {
	if (a === 0 || b === 0) return 0;
	return EXP[LOG[a] + LOG[b]]; // EXP duplicated means no modulus needed here
}

/**
 * Divide two field elements in GF(256): a / b.
 * Uses table arithmetic and handles zero cases.
 */
function gfDiv(a: number, b: number): number {
	if (b === 0) throw new Error('GF division by zero');
	if (a === 0) return 0;
	// (LOG[a] - LOG[b]) mod 255  -> implemented as +255 to avoid negative then %255
	return EXP[(LOG[a] + 255 - LOG[b]) % 255];
}

/* -------------------------
 * Polynomial operations
 * -------------------------
 *
 * Polynomials are represented as coefficient arrays (Uint8Array) with the highest-degree coefficient first.
 * For example: [a0, a1, a2] represents a0*x^2 + a1*x + a2.
 *
 * polyMul performs convolution with GF multiplication and XOR for addition/subtraction.
 */

/**
 * Multiply two polynomials over GF(256).
 * Result length = m + n - 1
 *
 * Complexity: O(m*n) which is acceptable for RS generator degrees used in QR (<= 30 typically).
 */
function polyMul(poly1: Uint8Array, poly2: Uint8Array): Uint8Array {
	const res = new Uint8Array(poly1.length + poly2.length - 1);
	for (let i = 0; i < poly1.length; i++) {
		const a = poly1[i];
		if (a === 0) continue;
		for (let j = 0; j < poly2.length; j++) {
			const b = poly2[j];
			if (b === 0) continue;
			// addition in GF(256) is XOR
			res[i + j] ^= gfMul(a, b);
		}
	}
	return res;
}

/**
 * Polynomial modulo operation: dividend mod divisor.
 *
 * Both dividend and divisor are Uint8Array with highest-degree coeff first.
 * Returns remainder of length divisor.length - 1 (the standard polynomial remainder).
 *
 * Algorithm:
 *  - Work on a copy of the dividend (rest).
 *  - For each leading coefficient position i, if rest[i] != 0:
 *      factor = rest[i] / divisor[0]  (divisor[0] is typically 1 for RS generators)
 *      subtract factor * divisor shifted by i (subtraction == XOR)
 *  - After processing, the remainder is the tail of the working array (last divisor.length - 1 coefficients).
 *
 * Note: this is polynomial long division implemented with GF arithmetic.
 */
function polyMod(dividend: Uint8Array, divisor: Uint8Array): Uint8Array {
	// copy dividend so we can mutate it
	const rest = new Uint8Array(dividend);
	const divisorLen = divisor.length;
	const steps = rest.length - divisorLen + 1;
	for (let i = 0; i < steps; i++) {
		const coef = rest[i];
		if (coef !== 0) {
			// factor = coef / divisor[0]  (for RS generator divisor[0] is 1)
			const factor = gfDiv(coef, divisor[0]);
			// subtract factor * divisor shifted by i (XOR)
			for (let j = 0; j < divisorLen; j++) {
				rest[i + j] ^= gfMul(divisor[j], factor);
			}
		}
		// if rest[i] == 0, nothing to do (we move to next position)
	}
	// remainder is the last (divisorLen - 1) coefficients
	const remLen = divisorLen - 1;
	return rest.slice(rest.length - remLen);
}

/**
 * Build generator polynomial g(x) of degree `degree`.
 *
 * g(x) = (x - α^0) * (x - α^1) * ... * (x - α^(degree-1))
 *
 * Implementation detail:
 *  - Start from [1] (polynomial "1")
 *  - For i from 0..degree-1 multiply current generator by [1, EXP[i]]
 *    where [1, EXP[i]] corresponds to x + EXP[i] in our coefficient ordering
 *
 * Returns Uint8Array of length degree + 1 (coefficients of g(x)).
 *
 * Note: For QR usage the leading coefficient of g(x) will be 1.
 */
function getGeneratorPoly(degree: number): Uint8Array {
	// Check cache first
	if (GENERATOR_CACHE[degree]) return GENERATOR_CACHE[degree];
	let gen: Uint8Array = new Uint8Array([1]);
	for (let i = 0; i < degree; i++) {
		const factor: Uint8Array = new Uint8Array([1, EXP[i]]); // represents x + EXP[i]
		gen = polyMul(gen, factor);
	}
	GENERATOR_CACHE[degree] = gen;
	return gen;
}

/* -------------------------
 * Public RS encoder
 * -------------------------
 *
 * reedSolomonEncode(data, eccCount)
 *  - data: array of data codewords (each 0..255)
 *  - eccCount: number of error-correction codewords to produce
 *
 * Steps:
 *  1) Construct message polynomial M(x) = data(x) * x^(eccCount) => place data then eccCount zeros
 *  2) Compute remainder R(x) = M(x) mod g(x) where g(x) is generator polynomial of degree eccCount
 *  3) Return R as an array of eccCount bytes (these are appended to data for QR usage)
 *
 * Important: The remainder length equals eccCount. The order returned is the natural polynomial order
 * (highest-degree coeff first in our internal representation) and is suitable for QR interleaving.
 */

/**
 * Encode data with Reed-Solomon to produce eccCount ECC bytes.
 * @param data data codewords (number[])
 * @param eccCount number of ECC codewords to generate
 * @returns ECC codewords as number[] length = eccCount
 */
export function reedSolomonEncode(data: number[], eccCount: number): number[] {
	// message = [data bytes] + [eccCount zeros]
	const messageLen = data.length + eccCount;
	const message = new Uint8Array(messageLen);
	for (let i = 0; i < data.length; i++) message[i] = data[i] & 0xff; // 0xff to ensure byte range

	// build generator polynomial of degree eccCount
	const gen = getGeneratorPoly(eccCount); // length = eccCount + 1

	// compute remainder = message mod gen (length = eccCount)
	const remainder = polyMod(message, gen);

	// pad remainder with leading zeros if needed
	const ecc: number[] = new Array(eccCount);
	const pad = eccCount - remainder.length;
	for (let i = 0; i < pad; i++) ecc[i] = 0;
	for (let i = 0; i < remainder.length; i++) ecc[pad + i] = remainder[i];

	return ecc;
}