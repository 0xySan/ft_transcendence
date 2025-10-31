/**
 * @file profile.ts
 * @description Route to get user and profile info by user ID
 */

import { FastifyInstance } from "fastify";
import { profileSchema } from "../../plugins/swagger/schemas/profile.schema.js";
import { getUserById } from "../../db/wrappers/main/users/users.js";
import { getProfileByUserId } from "../../db/wrappers/main/users/userProfiles.js";
import { getRoleById } from "../../db/wrappers/main/users/userRoles.js";
import { isValidUUIDv7 } from "../../utils/crypto.js";

export async function userProfileRoutes(fastify: FastifyInstance) {
	fastify.get("/profile", { schema: profileSchema, validatorCompiler: ({ schema }) => {return () => true;} }, async (request, reply) => {
		try {
			const { id } = request.query as { id?: string };

			if (!id) {
				return reply.status(400).send({ error: "Missing user ID in query" });
			}

			const userId = id;
			if (!isValidUUIDv7(userId)) {
				return reply.status(400).send({ error: "Invalid user ID" });
			}

			const user = getUserById(userId);
			if (!user) {
				return reply.status(404).send({ error: "User not found" });
			}

			const profile = getProfileByUserId(userId);
			const role = getRoleById(user.role_id);
			return reply.status(200).send({
				user: {
					user_id: user.user_id,
					email: user.email,
					role: role
						? {
								role_id: role.role_id,
								role_name: role.role_name,
						  }
						: null,
					created_at: user.created_at,
					last_login: user.last_login ?? null,
				},
				profile: profile
					? {
							username: profile.username,
							display_name: profile.display_name,
							profile_picture: profile.profile_picture,
							country_id: profile.country_id,
							bio: profile.bio,
					  }
					: null,
			});
		} catch (err) {
			console.error("Error in /profile:", err);
			return reply.status(500).send({ error: "Internal server error" });
		}
	});
}
