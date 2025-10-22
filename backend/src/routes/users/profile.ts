/**
 * @file profile.ts
 * @description Route to get user and profile info by user ID
 */

import { FastifyInstance } from "fastify";
import { getUserById } from "../../db/wrappers/main/users.js";
import { getProfileByUserId } from "../../db/wrappers/main/userProfiles.js";

export async function userProfileRoutes(fastify: FastifyInstance) {
	fastify.get("/profile/:id", async (request, reply) => {
		try {
			const { id } = request.params as { id: string };
			const userId = parseInt(id, 10);

			if (isNaN(userId)) {
				return reply.status(400).send({ error: "Invalid user ID" });
			}

			const user = getUserById(userId);
			if (!user) {
				return reply.status(404).send({ error: "User not found" });
			}

			const profile = getProfileByUserId(userId);

			return reply.status(200).send({
				user: {
					user_id: user.user_id,
					email: user.email,
					role_id: user.role_id,
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
			console.error("Error in /profile/:id:", err);
			return reply.status(500).send({ error: "Internal server error" });
		}
	});
}
