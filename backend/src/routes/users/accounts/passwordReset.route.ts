/**
 * src/routes/passwordReset.route.ts
 * soon
 */

import { FastifyInstance } from "fastify";
import { delayResponse, checkRateLimit } from "../../../utils/security.js";
import { getUserByEmail, getRoleById, updateUser } from '../../../db/wrappers/main/index.js';
import { hashString, generateRandomToken } from '../../../utils/crypto.js';
import { createEmailVerification, getEmailVerificationByToken, getEmailVerificationsByUserId } from '../../../db/wrappers/auth/index.js';
import { sendMail } from "../../../utils/mail/mail.js";

const requestCount_email: Record<string, { count: number; lastReset: number }> = {};
const requestCount_ip: Record<string, { count: number; lastReset: number }> = {};
const RATE_WINDOW = 15 * 60 * 1000;
const MIN_DELAY = 500;
const RATE_LIMIT = 5;

export async function newPasswordReset(fastify: FastifyInstance) {
    const emailRegex = /^[\p{L}\p{N}._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}$/u;
    const passwordRegex = /^.{8,64}$/;

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
                return (reply.status(202).send({ success: "if the request is valid, an email will be sent shortly." }));
            }

            const role_id = getRoleById(user.role_id);
            if (!role_id || role_id.role_name == "banned" || role_id.role_name == "unverified") {
                await delayResponse(startTime, MIN_DELAY);
                return (reply.status(202).send({ success: "If the request is valid, an email will be sent shortly." }));
            }

            const verifications = getEmailVerificationsByUserId(user.user_id);

            for (let i = 0; i < verifications.length; i++) {
                if (!verifications[i].verified) {
                    if (verifications[i].expires_at < startTime) {
                        verifications[i].verified = true;
                        break;
                    }
                    await delayResponse(startTime, MIN_DELAY);
                    return reply.status(400).send({ error: "You already have an active verification link" });
                }
            }

            const token = generateRandomToken(32);
            const encryptedToken = await hashString(token);
            createEmailVerification({
                user_id: user.user_id,
                token: encryptedToken,
                expires_at: Date.now() + 10 * 60 * 1000
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
            return (reply.status(202).send({ success: "If the request is valid, an email will be sent shortly."}));
        } catch (err) {
            await delayResponse(startTime, MIN_DELAY);
            return (reply.status(500).send({ error: "Internal error" }));
        }

    })

    fastify.post("/accounts/reset-password", async (request, reply) => {
        const { new_password } = request.body as { new_password: string };
        const { new_password_confirm } = request.body as { new_password_confirm: string };
        const { token } = request.body as { token: string };
        const startTime = Date.now();

        try {
            if (!new_password || !new_password_confirm || !token) {
                await delayResponse(startTime, MIN_DELAY);
                return (reply.status(400).send({ error: "Field not completed" }));
            }

            const email = getEmailVerificationByToken(token);

            if (email == undefined) {
                await delayResponse(startTime, MIN_DELAY);
                return (reply.status(202).send({ error: "Password has been change" }));
            }

            if (!passwordRegex.test(new_password)) {
                await delayResponse(startTime, MIN_DELAY);
                return (reply.status(400).send({ error: "Password invalid" }));
            }

            if (new_password != new_password_confirm) {
                await delayResponse(startTime, MIN_DELAY);
                return (reply.status(400).send({ error: "The confirm password is different" }));
            }

            updateUser(email.user_id, { password_hash: await hashString(new_password) });

            await delayResponse(startTime, MIN_DELAY);
            return (reply.status(202).send({ success: "Password has been change"}));
        } catch (err) {
            await delayResponse(startTime, MIN_DELAY);
            return (reply.status(500).send({ error: "Internal error" }));
        }
    });
}