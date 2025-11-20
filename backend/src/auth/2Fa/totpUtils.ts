/**
 * @file totpUtils.ts
 * Utilities for TOTP-based 2FA
 */

import crypto from 'crypto';
import { generateRandomToken } from '../../utils/crypto.js';

/**
 * @brief Encodes a binary buffer into a Base32 string (RFC 4648 standard).
 *
 * Base32 encoding takes 5-bit groups from the binary data (octets)
 * and maps them to characters from the Base32 alphabet:
 * "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".
 *
 * Each 5-bit group corresponds to one Base32 character.
 * Padding '=' is added at the end if the output length is not a multiple of 8.
 *
 * @param buffer The binary data to encode, as a Buffer.
 * @return The Base32-encoded string (with '=' padding if needed).
 *
 * @example
 * const data = Buffer.from('hello');
 * const encoded = base32Encode(data);
 * console.log(encoded); // --> 'NBSWY3DP'
 */
export function base32Encode(buffer: Buffer): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	let bits = '';
	let output = '';

	// Convert each byte of the buffer into a binary string
	for (let i = 0; i < buffer.length; i++) {
		bits += buffer[i].toString(2).padStart(8, '0'); // Convert to base 2 and fill start with zeros to garantee 8 bits
	}

	// Split the binary string into 5-bit groups and map to Base32 alphabet
	for (let i = 0; i < bits.length; i += 5) {
		const chunk = bits.slice(i, i + 5);
		if (chunk.length < 5) {
			// Pad last group with zeros if less than 5 bits remain
			output += alphabet[parseInt(chunk.padEnd(5, '0'), 2)];
		} else {
			output += alphabet[parseInt(chunk, 2)];
		}
	}

	// Add '=' padding until output length is a multiple of 8 (RFC requirement)
	while (output.length % 8 !== 0) {
		output += '=';
	}

	return output;
}

/**
 * @brief Decodes a Base32-encoded string into a binary buffer (RFC 4648 standard).
 *
 * This function reverses the Base32 encoding process:
 * - Each Base32 character represents a 5-bit group.
 * - These groups are concatenated into a binary string.
 * - Every 8 bits (1 byte) are converted back into a Buffer.
 *
 * All padding ('=') characters are ignored.
 *
 * @param base32 The Base32-encoded string to decode.
 * @return A Buffer containing the decoded binary data.
 *
 * @example
 * const decoded = base32Decode('NBSWY3DP');
 * console.log(decoded.toString()); // --> 'hello'
 */
export function base32Decode(base32: string): Buffer {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	let bits = '';
	let output: number[] = [];

	// Remove padding '=' at the end of the Base32 string
	base32 = base32.replace(/=+$/, '');

	// Convert each Base32 character to its 5-bit binary representation
	for (let i = 0; i < base32.length; i++) {
		const val = alphabet.indexOf(base32[i].toUpperCase());
		if (val === -1) continue; // Ignore invalid characters
		bits += val.toString(2).padStart(5, '0');
	}

	// Group every 8 bits to form bytes and convert to numbers
	for (let i = 0; i + 8 <= bits.length; i += 8) {
		output.push(parseInt(bits.substring(i, i + 8), 2));
	}

	// Create a Buffer from the byte array
	return Buffer.from(output);
}

/**
 * @brief Generate a Time-based One-Time Password (TOTP) using RFC 6238.
 *
 * This function generates a numeric one-time code based on the current time
 * and a shared secret key. The algorithm follows RFC 6238, using:
 *   - HMAC-SHA1(secret, counter)
 *   - Dynamic truncation to extract a 31-bit integer
 *   - Modulo operation to limit the code to a fixed number of digits
 *
 * @param secretBase32 The Base32-encoded shared secret.
 * @param digits The number of digits in the generated code (default: 6).
 * @param period The duration of each time step in seconds (default: 30).
 * @param timestamp Optional Unix timestamp override (in milliseconds).
 * @return A zero-padded numeric TOTP code as a string.
 *
 * @example
 * const secret = 'JBSWY3DPEHPK3PXP';
 * const code = generateTotp(secret);
 * console.log(code); // e.g., "492039"
 */
export function generateTotp(
	secretBase32: string,
	digits = 6,
	period = 30,
	algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha1',
	timestamp = Date.now()): string {
	// Step 1: Decode the Base32 secret into a binary buffer
	const secretBuffer = base32Decode(secretBase32);

	// Step 2: Compute time counter (number of periods since Unix epoch)
	const counter = Math.floor(timestamp / 1000 / period);

	// Step 3: Convert counter to 8-byte buffer (big-endian)
	const buffer = Buffer.alloc(8);
	let temp = counter;
	for (let i = 7; i >= 0; i--) {
		buffer[i] = temp & 0xff; // Get least significant byte
		temp >>= 8; // Shift right by 8 bits
	}

	// Step 4: Compute HMAC-SHA1(secret, counter)
	const hmac = crypto.createHmac(algorithm, secretBuffer).update(buffer).digest();

	// Step 5: Dynamic truncation (RFC 4226 §5.3)
	/* THe last 4 bits of the last byte (nibble) of the HMAC
	 * are used as an offset to start extracting 4 bytes from the HMAC.
	 */
	const offset = hmac[hmac.length - 1] & 0x0f;
	const binary =
		((hmac[offset] & 0x7f) // Ensure the most significant bit is 0
		<< 24) | // 4 bytes from offset
		((hmac[offset + 1] & 0xff) << 16) | // Shift and add next byte
		((hmac[offset + 2] & 0xff) << 8) |
		(hmac[offset + 3] & 0xff);

	// Step 6: Reduce to the requested number of digits and pad with zeros
	const truncated = binary % 10 ** digits; // Modulo to get the last 'digits' digits
	const stringOtp = truncated.toString(); // Convert number to string
	const otp = stringOtp.padStart(digits, '0'); // Left-pad with zeros if needed to reach exact length

	return otp;
}

/**
 * @brief Verify a TOTP code against a secret.
 *
 * This function checks if the provided TOTP code is valid for the given
 * Base32 secret. It supports a configurable time window to account for
 * clock drift between client and server.
 *
 * @param secretBase32 The Base32-encoded shared secret.
 * @param token The TOTP code entered by the user (string or number).
 * @param digits Number of digits in the TOTP (default: 6).
 * @param period Time step in seconds (default: 30).
 * @param algorithm The hashing algorithm ('sha1', 'sha256', 'sha512') (default: 'sha1').
 * @param window Number of periods before/after current to check (default: 0).
 * @param timestamp Optional timestamp override in milliseconds.
 * @return True if the code is valid, false otherwise.
 *
 * @example
 * const secret = 'JBSWY3DPEHPK3PXP';
 * console.log(verifyTotp(secret, '492039')); // true/false
 */
export function verifyTotp(
	secretBase32: string,
	token: string | number,
	digits = 6,
	period = 30,
	algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha1',
	window = 0,
	timestamp = Date.now()
): boolean {
	const code = token.toString().padStart(digits, '0');
	const counter = Math.floor(timestamp / 1000 / period);

	// Check the current time step and surrounding steps (clock drift)
	for (let step = -window; step <= window; step++) {
		const stepTime = (counter + step) * period * 1000; // convert back to ms
		const generated = generateTotp(secretBase32, digits, period, algorithm, stepTime);
		// Use timing-safe comparison to prevent timing attacks
		const codeBuffer = Buffer.from(code, 'utf-8');
		const genBuffer = Buffer.from(generated, 'utf-8');
		if (codeBuffer.length === genBuffer.length && crypto.timingSafeEqual(codeBuffer, genBuffer)) {
			return true;
		}
	}

	return false;
}

/**
 * Generate a random TOTP secret encoded in Base32.
 * @param algorithm The hashing algorithm to use ('sha1', 'sha256', 'sha512')
 * @returns A Base32-encoded TOTP secret
 */
export function generateTotpSecret(algorithm: 'sha1' | 'sha256' | 'sha512'): string {
	const lengths = {
		sha1: 20,
		sha256: 32,
		sha512: 64,
	};
	const buf = generateRandomToken(lengths[algorithm]);
	return base32Encode(Buffer.from(buf, 'hex'));
}

/**
 * Create a TOTP URI for use with authenticator apps. RFC 6238 compliant.
 * @param userEmail The user's email address
 * @param secretBase32 The Base32-encoded TOTP secret
 * @param issuer The service or issuer name
 * @param algorithm The hashing algorithm ('sha1', 'sha256', 'sha512')
 * @param digits Number of digits in the TOTP code
 * @param duration Time step duration in seconds
 * @returns The TOTP URI string
 */
export function createTotpUri(
	userEmail: string,
	secretBase32: string,
	issuer: string,
	algorithm: 'sha1' | 'sha256' | 'sha512',
	digits: number,
	duration: number
): string {
	// Encode safely for URI
	const label = encodeURIComponent(`${issuer}:${userEmail}`);
	const encodedIssuer = encodeURIComponent(issuer);
	const upperAlgorithm = algorithm.toUpperCase();

	return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=${upperAlgorithm}&digits=${digits}&period=${duration}`;
}
