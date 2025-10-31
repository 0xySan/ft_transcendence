/**
 * src/routes/password.route.ts
 * soon
 */

import { FastifyInstance } from "fastify";
import { delayResponse, checkRateLimit } from "../../../utils/security.js";
import { getUserByEmail, getRoleById } from '../../../db/wrappers/main/index.js';
import { hashString, generateRandomToken } from '../../../utils/crypto.js';
import { createEmailVerification } from '../../../db/wrappers/auth/index.js';
import { sendMail } from "../../../utils/mail/mail.js";

const requestCount_email: Record<string, { count: number; lastReset: number }> = {};
const requestCount_ip: Record<string, { count: number; lastReset: number }> = {};
const RATE_LIMIT = 100;
const MIN_DELAY = 500;
const RATE_WINDOW = 15 * 60 * 1000;

export async function newPasswordReset(fastify: FastifyInstance) {
    const emailRegex = /^[\p{L}\p{N}._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}$/u;

    fastify.get("/accounts/reset-password", async (request, reply) => {
        const clientIp = request.ip || request.headers['x-forwarded-for']?.toString() || 'unknown';
        const startTime = Date.now();

        try {
            if (!checkRateLimit(requestCount_ip, clientIp, reply, RATE_LIMIT, RATE_WINDOW)) {
                return;
            }

            const { email } = request.query as { email?: string };

            if (!email) {
                return (reply.status(400).send({ error: "Email missing" }));
            }

            if (!checkRateLimit(requestCount_email, email, reply, RATE_LIMIT, RATE_WINDOW)) {
                return;
            }

            if (!emailRegex.test(email)) {
                return (reply.status(400).send({ error: "Email invalid" }));
            }

            const user = getUserByEmail(email);
            if (!user) {
                await delayResponse(startTime, MIN_DELAY);
                return (reply.status(202).send({ duck: "Email has been send" }));
            }

            const role_id = getRoleById(user.role_id);
            if (!role_id || role_id.role_name == "banned" || role_id.role_name == "unverified") {
                await delayResponse(startTime, MIN_DELAY);
                return (reply.status(202).send({ duck: "Email has been send " + role_id?.role_name }));
            }

            const token = generateRandomToken(32);
            const encryptedToken = await hashString(token);
            createEmailVerification({
                user_id: user.user_id,
                token: encryptedToken,
                expires_at: Date.now() + 60 * 60 * 1000,
                
            });

            sendMail(
				email,
				"Password reset request for ft_transcendence",
				"password.html",
				{
					HEADER: "Password reset request for ft_transcendence",
					VERIFICATION_LINK: `https://moutig.sh/verify?user=${user.user_id}&token=${encodeURIComponent(token)}`,
				},
				`verify@${process.env.MAIL_DOMAIN || 'example.com'}`
			).catch(err => console.error("Failed to send email:", err));

            await delayResponse(startTime, MIN_DELAY);
            return (reply.status(202).send({ duck: "Email send " + token + " " + email }));
        } catch (err) {
            await delayResponse(startTime, MIN_DELAY);
            return (reply.status(500).send({ error: "Error interne" }));
        }

    })
}