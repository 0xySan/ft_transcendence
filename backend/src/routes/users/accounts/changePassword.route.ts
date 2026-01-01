import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { getUser2FaMethodsByUserId, getUser2FaMethodsById } from '../../../db/index.js';
import { getPasswordHashByUserId, updateUser } from '../../../db/wrappers/main/users/users.js';
import { hashString, verifyHashedString, decryptSecret, verifyToken } from '../../../utils/crypto.js';
import { passwordChangeSchema } from '../../../plugins/swagger/schemas/passwordChange.schema.js';

interface ChangePasswordBody {
    old_password: string;
    new_password: string;
    twofa_method_id?: string;
    twoFaToken?: string;
}

const passwordRegex = /^.{8,64}$/;

export async function changePasswordRoutes(fastify: FastifyInstance) {
    fastify.post(
        '/accounts/change-password',
        {
            preHandler: requireAuth,
            schema: passwordChangeSchema,
            validatorCompiler: () => () => true
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const session = (request as any).session;
                const userId = session?.user_id;
                if (!userId) return reply.status(401).send({ message: 'Unauthorized' });

                const body = request.body as ChangePasswordBody;
                if (!body || !body.old_password || !body.new_password)
                    return reply.status(400).send({ message: 'Fields missing' });

                if (!passwordRegex.test(body.new_password))
                    return reply.status(400).send({ message: 'New password invalid' });

                // --- Check old password ---
                const storedHash = getPasswordHashByUserId(userId);
                if (!storedHash) return reply.status(401).send({ message: 'Unauthorized' });

                const ok = await verifyHashedString(body.old_password, storedHash);
                if (!ok) return reply.status(401).send({ message: 'Old password incorrect' });

                // --- If user has any verified 2FA methods, require and validate a previously-issued 2FA token ---
                const userMethods = getUser2FaMethodsByUserId(userId).filter(m => m.is_verified);
                if (userMethods.length > 0) {
                    if (!body.twoFaToken)
                        return reply.status(401).send({ message: '2FA token required' });

                    const payload = verifyToken(body.twoFaToken);
                    if (!payload) return reply.status(401).send({ message: 'Invalid or expired 2FA token' });
                }

                // --- Update password ---
                const newHash = await hashString(body.new_password);
                const res = updateUser(userId, { password_hash: newHash });
                if (!res) return reply.status(500).send({ message: 'Failed to update password' });

                return reply.status(200).send({ message: 'Password updated' });

            } catch (err) {
                console.error(err);
                return reply.status(500).send({ message: 'Internal server error' });
            }
        }
    );
}
