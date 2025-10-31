/**
 * @file utils/security.ts
 * Security-related utility functions.
 */

import { FastifyReply } from "fastify";

/**
 * This function introduces a delay to ensure that the response time is at least MIN_DELAY milliseconds.
 * @param startTime - The timestamp when the request started.
 */
export async function delayResponse(startTime: number, delay: number) {
	const elapsed = Date.now() - startTime;
	if (elapsed < delay) {
		await new Promise((res) => setTimeout(res, delay - elapsed));
	}
}



interface RateEntry {
	count: number;
	lastReset: number;
}

/**
 * Checks rate limit for a given IP and updates the counter.
 * Returns true if request is allowed, or sends 429 and returns false if limit exceeded.
 */
export function checkRateLimit(
	requestCount: Record<string, RateEntry>,
	clientIp: string,
	reply: FastifyReply,
	rateLimit: number,
	rateWindow: number
): boolean {
	const now = Date.now();
	const rate = requestCount[clientIp] || { count: 0, lastReset: now };

	// reset window if expired
	if (now - rate.lastReset > rateWindow) {
		rate.count = 0;
		rate.lastReset = now;
	}

	// increment counter
	rate.count++;
	requestCount[clientIp] = rate;

	// check limit
	if (rate.count > rateLimit) {
		reply.header("Retry-After", Math.ceil(rateWindow / 1000));
		reply.status(429).send({ message: "Too many requests. Try again later." });
		return false;
	}

	return true;
}
