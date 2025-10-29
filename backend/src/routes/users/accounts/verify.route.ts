/**
 * src/routes/verify.route.ts
 * Verify user account route — fixed decryption & comparison logic
 */

import { FastifyInstance } from "fastify";
import { verifySchema } from "../../../plugins/swagger/schemas/verify.schema.js";
import crypto from "crypto";
import {
	getEmailVerificationsByUserId,
	markEmailAsVerified, // wrapper existant
} from "../../../db/wrappers/auth/index.js";
import { getRoleByName, updateUserRole } from "../../../db/wrappers/main/index.js";
import { decryptSecret } from "../../../utils/crypto.js";

export async function verifyUserAccountRoutes(fastify: FastifyInstance) {
	fastify.get("/accounts/verify", { schema: verifySchema, validatorCompiler: ({ schema }) => {return () => true;} }, async (request, reply) => {
		const { token: rawToken, user: rawUser } = request.query as { token?: string; user?: string };

		if (!rawToken || !rawUser) {
			return reply.status(400).send("Missing token or user id");
		}

		const userId = Number(rawUser);
		if (!Number.isInteger(userId) || userId <= 0) {
			return reply.status(400).send("Invalid user id");
		}

		const decodedToken = decodeURIComponent(rawToken);
		const decodedBuf = Buffer.from(decodedToken, "utf8");

		// fetch all verification records for this user
		const records = getEmailVerificationsByUserId(userId);
		if (!records || records.length === 0) {
			return reply.status(404).send("Verification record not found");
		}

		let matchedRecord: any = null;

		for (const rec of records) {
			// Expectation: rec.token is stored as base64(encryptedBuffer) — produced by encryptSecret(...).toString('base64')
			if (!rec.token) continue;

			try {
				const storedBuf = Buffer.from(rec.token, "base64"); // convert base64 -> Buffer
				const plaintext = decryptSecret(storedBuf); // returns utf8 string
				const plainBuf = Buffer.from(plaintext, "utf8");

				if (plainBuf.length === decodedBuf.length && crypto.timingSafeEqual(plainBuf, decodedBuf)) {
					matchedRecord = rec;
					break;
				}
			} catch (err) {continue;}
		}

		if (!matchedRecord) {
			return reply.status(404).send("Verification record not found");
		}

		// check expiration (if present)
		if (matchedRecord.expires_at && Number(matchedRecord.expires_at) < Date.now()) {
			return reply.status(400).send("Verification token has expired");
		}

		// mark as verified
		try {
			markEmailAsVerified(matchedRecord.token);
		} catch (err) {
			fastify.log.error(`Failed to mark email as verified for user ${userId}: ${err}`);
			return reply.status(500).send("Failed to verify email");
		}

		// update user role to "user"
		try {
			updateUserRole(matchedRecord.user_id, getRoleByName("user")!.role_id);
		} catch (err) {fastify.log.error("Failed to update user role after verification");}

		return reply.status(200).send("Email verified successfully");
	});
}
