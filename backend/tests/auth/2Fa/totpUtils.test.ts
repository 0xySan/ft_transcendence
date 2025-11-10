/**
 * @file totpUtils.test.ts
 * Unit tests for TOTP-based 2FA utilities
 */


import { describe, it, expect } from 'vitest';
import { base32Encode, base32Decode, generateTotp, verifyTotp } from '../../../src/auth/2Fa/totpUtils';

describe('Base32 encoding/decoding', () => {
	const testString = 'hello world';
	const buffer = Buffer.from(testString, 'utf-8');

	it('should encode and decode correctly', () => {
		const encoded = base32Encode(buffer);
		const decoded = base32Decode(encoded).toString('utf-8');
		expect(decoded).toBe(testString);
	});

	it('should produce correct known encoding', () => {
		const encoded = base32Encode(Buffer.from('foo', 'utf-8'));
		expect(encoded.replace(/=/g, '')).toBe('MZXW6'); // ignore padding
	});

	it('should decode known value correctly', () => {
		const decoded = base32Decode('MZXW6===').toString('utf-8');
		expect(decoded).toBe('foo');
	});
});

describe('TOTP generation', () => {
	const secret = 'JBSWY3DPEHPK3PXP'; // known test secret

	it('should generate 6-digit code', () => {
		const otp = generateTotp(secret, 6, 30, 'sha1', 1650000000000);
		expect(otp).toMatch(/^\d{6}$/);
	});

	it('should generate consistent code for same timestamp', () => {
		const ts = 1650000000000;
		const otp1 = generateTotp(secret, 6, 30, 'sha1', ts);
		const otp2 = generateTotp(secret, 6, 30, 'sha1', ts);
		expect(otp1).toBe(otp2);
	});

	it('should generate different codes for different timestamps', () => {
		const ts1 = 1650000000000;
		const ts2 = ts1 + 30000; // +1 period
		const otp1 = generateTotp(secret, 6, 30, 'sha512', ts1);
		const otp2 = generateTotp(secret, 6, 30, 'sha512', ts2);
		expect(otp1).not.toBe(otp2);
	});
});

describe('TOTP verification', () => {
	const secret = 'JBSWY3DPEHPK3PXP';
	const ts = 1650000000000;

	it('should verify correct code', () => {
		const otp = generateTotp(secret, 6, 30, 'sha256', ts);
		const result = verifyTotp(secret, otp, 6, 30, 'sha256', 1, ts);
		expect(result).toBe(true);
	});

	it('should reject incorrect code', () => {
		const wrongOtp = '123456';
		const result = verifyTotp(secret, wrongOtp, 6, 30, 'sha1', 1, ts);
		expect(result).toBe(false);
	});

	it('should accept code within window', () => {
		const otpPrev = generateTotp(secret, 6, 30, 'sha1', ts - 30000); // previous period
		const otpNext = generateTotp(secret, 6, 30, 'sha1', ts + 30000); // next period
		expect(verifyTotp(secret, otpPrev, 6, 30, 'sha1', 1, ts)).toBe(true);
		expect(verifyTotp(secret, otpNext, 6, 30, 'sha1', 1, ts)).toBe(true);
	});

	it('should reject code outside window', () => {
		const otp = generateTotp(secret, 6, 30, 'sha1', ts + 90000); // 3 periods away
		expect(verifyTotp(secret, otp, 6, 30, 'sha1', 1, ts)).toBe(false);
	});
});
