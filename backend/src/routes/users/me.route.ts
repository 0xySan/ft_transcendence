/**
 * @file me.route.ts
 * @description Route to get the authenticated user's information
 */

import { FastifyInstance } from "fastify";
import { requirePartialAuth } from "../../middleware/auth.middleware.js";
import { getCountryById, getProfileByUserId, getUserById } from "../../db/index.js";
import { meSchema } from "../../plugins/swagger/schemas/me.schema.js";
import { updateProfile } from "../../db/wrappers/main/users/userProfiles.js";

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

	fastify.patch(
		"/me",
		{
			preHandler: requirePartialAuth,
			validatorCompiler: () => () => true,
		},
		async (request, reply) => {
			try {
				const session = (request as any).session;
				const userId = session?.user_id;
				if (!userId) return reply.status(401).send({ message: "Unauthorized" });

				const existingProfile = getProfileByUserId(userId);
				if (!existingProfile) return reply.status(404).send({ message: "Profile not found" });

				const body = request.body as Record<string, any> | undefined;
				if (!body || typeof body !== "object") return reply.status(400).send({ message: "Invalid request body" });

				// Disallow changing username here (username must be changed via a dedicated flow)
				if (body.username !== undefined) {
					return reply.status(400).send({ message: "Changing username is not allowed via this endpoint" });
				}

				const updates: Record<string, any> = {};

				// displayName: optional string <= 50
				if (body.displayName !== undefined) {
					if (typeof body.displayName !== "string" || body.displayName.length > 50) {
						return reply.status(400).send({ message: "Invalid displayName (must be string, ≤50 chars)" });
					}
					updates.display_name = body.displayName;
				}

				// profilePicture: optional string <= 255
				if (body.profilePicture !== undefined) {
					if (typeof body.profilePicture !== "string" || body.profilePicture.length > 255) {
						return reply.status(400).send({ message: "Invalid profilePicture (must be string, ≤255 chars)" });
					}
					updates.profile_picture = body.profilePicture;
				}

				// bio: optional string <= 500
				if (body.bio !== undefined) {
					if (typeof body.bio !== "string" || body.bio.length > 500) {
						return reply.status(400).send({ message: "Invalid bio (must be string, ≤500 chars)" });
					}
					updates.bio = body.bio;
				}

				// country: optional numeric, must exist
				if (body.country !== undefined) {
					const cid = Number(body.country);
					if (!Number.isFinite(cid) || cid <= 0) {
						return reply.status(400).send({ message: "Invalid country" });
					}
					const country = getCountryById(cid);
					if (!country) {
						return reply.status(400).send({ message: "Country not found" });
					}
					updates.country_id = cid;
				}

				if (Object.keys(updates).length === 0) {
					return reply.status(400).send({ message: "No valid fields provided to update" });
				}

				const ok = updateProfile(existingProfile.profile_id, updates);
				if (!ok) {
					console.error("Failed to update profile:", updates);
					return reply.status(500).send({ message: "Failed to update profile" });
				}

				const updatedProfile = getProfileByUserId(userId);
				const updatedCountry = getCountryById(updatedProfile?.country_id || 0);

				return reply.status(200).send({
					success: true,
					profile: updatedProfile ? {
						username: updatedProfile.username || null,
						displayName: updatedProfile.display_name || null,
						profilePicture: updatedProfile.profile_picture || null,
						bio: updatedProfile.bio || null,
						country: updatedCountry ? {
							id: updatedCountry.country_id,
							name: updatedCountry.country_name,
							code: updatedCountry.country_code,
							flag: updatedCountry.flag_svg_path
						} : null
					} : null
				});
			} catch (err) {
				console.error("Error in PATCH /me:", err);
				return reply.status(500).send({ message: "Internal Server Error" });
			}
		}
	);
}