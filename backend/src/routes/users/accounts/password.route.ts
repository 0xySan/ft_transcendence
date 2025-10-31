/**
 * src/routes/password.route.ts
 * soon
 */

import { FastifyInstance } from "fastify";
import { delayResponse } from "../../../utils/security.js";
import { getUserByEmail, getRoleById } from '../../../db/wrappers/main/index.js';
import { hashString, generateRandomToken } from '../../../utils/crypto.js';
import { createEmailVerification } from '../../../db/wrappers/auth/index.js';
import { sendMail } from "../../../utils/mail/mail.js";

const MIN_DELAY = 500;

export async function newPasswordReset(fastify: FastifyInstance) {
    const emailRegex = /^[\p{L}\p{N}._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}$/u;
    const startTime = Date.now();

    fastify.get("/accounts/reset-password", async (request, reply) => {

        try {
            const { email } = request.query as { email?: string };

            if (!email) {
                return (reply.status(400).send({ error: "Email missing" }));
            }

            if (!emailRegex.test(email)) {
                return (reply.status(400).send({ error: "Email invalid" }));
            }

            const user = getUserByEmail(email);
            if (!user) {
                await delayResponse(startTime, MIN_DELAY);
                return (reply.status(202).send({ error: "Email has been send" }));
            }

            const role_id = getRoleById(user.role_id);
            if (!role_id || role_id.role_name == "banned" || role_id.role_name == "unverified") {
                await delayResponse(startTime, MIN_DELAY);
                return (reply.status(202).send({ error: "Email has been send " + role_id?.role_name }));
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
            return (reply.status(202).send({ error: "Email send " + token + " " + email }));
        } catch (err) {
            return (reply.status(500).send({ error: "Error interne" }));
        }

    })
}