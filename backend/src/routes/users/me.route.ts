/**
 * @file me.route.ts
 * @description Route to get the authenticated user's information
 */

import { FastifyInstance } from "fastify";
import { requirePartialAuth } from "../../middleware/auth.middleware.js";
import { getCountryById, getProfileByUserId, getUserById } from "../../db/index.js";
import { meSchema } from "../../plugins/swagger/schemas/me.schema.js";

export async function userMeRoutes(fastify: FastifyInstance) {
	fastify.get(
		"/me",
		{
			preHandler: requirePartialAuth,
			schema: meSchema, 
			validatorCompiler: () => () => true,
		},
		async (request, reply) => {
			try {
				const session = (request as any).session;
				if (!session || !session.user_id) {
					return reply.status(401).send({ message: "Unauthorized" });
				}

				const userId = session.user_id;

				const user = getUserById(userId);
				if (!user) {
					return reply.status(404).send({ message: "User not found" });
				}

				const userProfile = getProfileByUserId(userId);
				const country = getCountryById(userProfile?.country_id || 0);

				return reply.status(200).send({
					user: {
						id: user.user_id,
						email: user.email,
						createdAt: user.created_at,
						profile: userProfile ? {
							username: userProfile?.username || null,
							displayName: userProfile?.display_name || null,
							profilePicture: userProfile?.profile_picture || null,
							bio: userProfile?.bio || null,
							country: country ? { 
								id: country.country_id,
								name: country.country_name,
								code: country.country_code,
								flag: country.flag_svg_path
							} : null
						} : null
					}
				});
			} catch (error) {
				console.error("Error fetching user info:", error);
				return reply.status(500).send({ message: "Internal Server Error" });
			}
		}
	);
}