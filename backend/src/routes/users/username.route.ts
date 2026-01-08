/**
 * @file username.route.ts
 * @description Route to get user and profile info by username
 */

import { FastifyInstance } from "fastify";
import { getProfileByUsername } from "../../db/wrappers/main/users/userProfiles.js";
import { getUserById } from "../../db/wrappers/main/users/users.js";
import { getCountryById } from "../../db/wrappers/main/countries.js";

export async function userUsernameRoutes(fastify: FastifyInstance) {
	fastify.get("/username", async (request, reply) => {
		try {
			const { username } = request.query as { username?: string };
			
			if (!username) {
				return reply.status(400).send({ error: "Missing username in query" });
			}
			
			if (typeof username !== "string" || username.length < 3 || username.length > 20) {
				return reply.status(400).send({ error: "Invalid username format" });
			}
			
			const profile = getProfileByUsername(username);
			if (!profile) {
				return reply.status(404).send({ error: "User not found" });
			}
			
			const user = getUserById(profile.user_id);
			if (!user) {
				return reply.status(404).send({ error: "User not found" });
			}
			
			const country = getCountryById(profile.country_id || 0);
			
			return reply.status(200).send({
				user: {
					id: user.user_id,
					createdAt: user.created_at,
					profile: {
						username: profile.username,
						displayName: profile.display_name || null,
						profilePicture: profile.profile_picture || null,
						bio: profile.bio || null,
						country: country ? {
							id: country.country_id,
							name: country.country_name,
							code: country.country_code,
							flag: country.flag_svg_path
						} : null
					}
				}
			});
		} catch (err) {
			console.error("Error in /username:", err);
			return reply.status(500).send({ error: "Internal server error" });
		}
	});
}
