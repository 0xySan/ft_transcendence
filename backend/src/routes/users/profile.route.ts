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
import { requireAuth } from "../../middleware/auth.middleware.js";
import { updateProfile, getProfileById } from "../../db/wrappers/main/users/userProfiles.js";
import { getCountryById } from "../../db/wrappers/main/countries.js";

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
	
	fastify.patch(
		"/profile",
		{
			preHandler: requireAuth,
			validatorCompiler: ({ schema }) => { return () => true; }
		},
		async (request, reply) => {
			try {
				const session = (request as any).session;
				const userId = session?.user_id;
				if (!userId) return reply.status(401).send({ error: "Unauthorized" });
				
				const existingProfile = getProfileByUserId(userId);
				if (!existingProfile) return reply.status(404).send({ error: "Profile not found" });
				
				const body = request.body as Record<string, any> | undefined;
				if (!body || typeof body !== "object") return reply.status(400).send({ error: "Invalid request body" });
				
				// Disallow changing username here (username must be changed via a dedicated flow)
				if (body.username !== undefined) {
					return reply.status(400).send({ error: "Changing username is not allowed via this endpoint" });
				}
				
				const updates: Record<string, any> = {};
				
				// display_name: optional string <= 50
				if (body.display_name !== undefined) {
					if (typeof body.display_name !== "string" || body.display_name.length > 50) {
						return reply.status(400).send({ error: "Invalid display_name (must be string, ≤50 chars)" });
					}
					updates.display_name = body.display_name;
				}
				
				// profile_picture: optional string <= 255
				if (body.profile_picture !== undefined) {
					if (typeof body.profile_picture !== "string" || body.profile_picture.length > 255) {
						return reply.status(400).send({ error: "Invalid profile_picture (must be string, ≤255 chars)" });
					}
					updates.profile_picture = body.profile_picture;
				}
				
				// bio: optional string <= 500
				if (body.bio !== undefined) {
					if (typeof body.bio !== "string" || body.bio.length > 500) {
						return reply.status(400).send({ error: "Invalid bio (must be string, ≤500 chars)" });
					}
					updates.bio = body.bio;
				}
				
				// country_id: optional numeric, must exist
				if (body.country_id !== undefined) {
					const cid = Number(body.country_id);
					if (!Number.isFinite(cid) || cid <= 0) {
						return reply.status(400).send({ error: "Invalid country_id" });
					}
					const country = getCountryById(cid);
					if (!country) {
						return reply.status(400).send({ error: "Country not found" });
					}
					updates.country_id = cid;
				}
				
				if (Object.keys(updates).length === 0) {
					return reply.status(400).send({ error: "No valid fields provided to update" });
				}
				
				const ok = updateProfile(existingProfile.profile_id, updates);
				if (!ok) {
					console.error("Failed to update profile:", updates);
					return reply.status(500).send({ error: "Failed to update profile" });
				}
				
				const updatedProfile = getProfileById(existingProfile.profile_id);
				return reply.status(200).send({ success: true, profile: updatedProfile ?? null });
			} catch (err) {
				console.error("Error in PATCH /profile:", err);
				return reply.status(500).send({ error: "Internal server error" });
			}
		}
	);
}
