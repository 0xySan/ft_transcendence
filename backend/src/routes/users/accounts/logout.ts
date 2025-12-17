/**
* @file login.route.ts
* @description Secure user login route (OWASP-compliant, with 2FA support and partial session upgrade).
*/

import { FastifyInstance } from "fastify";
import { loginAccountSchema } from "../../../plugins/swagger/schemas/login.schema.js";
import {
    updateSession,
    User
} from "../../../db/index.js";
import { requirePartialAuth } from "../../../middleware/auth.middleware.js";

// ---------- Rate limiting ----------
const requestCount: Record<string, { count: number; lastReset: number }> = {};
const RATE_LIMIT = 5; // max 5 tentatives
const RATE_WINDOW = 15 * 60 * 1000; // 15 minutes
const MIN_DELAY = 500;

// ---------- Routes ----------
export async function userLogoutRoute(fastify: FastifyInstance) {
    // --- [POST] /accounts/logout ---
    fastify.post(
        "/accounts/logout",
        {
            preHandler: requirePartialAuth,
            schema: loginAccountSchema,
            validatorCompiler: () => () => true
        },
        async (request, reply) => {
            const session = (request as any).session;
            
            const upgraded = updateSession(session.session_id, { stage: "expired" });
            
            if (!upgraded)
                return reply.status(500).send({ message: "Failed to logout session." });
            
            return reply.status(200).send({ message: "Successfully logged out." });
        }
    );
}