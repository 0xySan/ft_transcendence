/**
 * @file new.ts
 * @description Route to create a new user account, with optional OAuth link.
 */

import { FastifyInstance } from "fastify";
import { registerAccountSchema } from "../../../plugins/swagger/schemas/register.schema.js";
import geoip from 'geoip-lite';
import dotenv from 'dotenv';

import { 
	createUser, 
	getUserByEmail, 
	createProfile, 
	getProfileByUsername,
	getCountryByCode,
	getRoleByName
} from '../../../db/wrappers/main/index.js';

import { 
	getOauthAccountByProviderAndUserId,
	createEmailVerification,
	createOauthAccount
} from '../../../db/wrappers/auth/index.js';

import { hashPassword, generateRandomToken, encryptSecret } from '../../../utils/crypto.js';
import { saveAvatarFromUrl } from '../../../utils/userData.js';

import { sendMail } from "../../../utils/mail/mail.js";

dotenv.config({ quiet: true });

export async function newUserAccountRoutes(fastify: FastifyInstance) {
	const emailRegex = /^([-!#-'*+\/-9=?A-Z^-~]+(\.[-!#-'*+\/-9=?A-Z^-~]+)*|"([]!#-[^-~ \t]|(\\[\t -~]))+")@[0-9A-Za-z]([0-9A-Za-z-]{0,61}[0-9A-Za-z])?(\.[0-9A-Za-z]([0-9A-Za-z-]{0,61}[0-9A-Za-z])?)+$/;
	const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};\'\\|,.<>\/?]).{8,40}$/;
	const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

	fastify.post("/accounts/register", { schema: registerAccountSchema }, async (request, reply) => {
		try {
			const { username, email, password, oauth, pfp, display_name } = request.body as {
				username?:	string;
				email?:		string;
				password?:	string;
				oauth?: {
					provider_name:		string;
					provider_user_id:	string;
					profile_json?:		string;
					id_token_hash?:		string;
				};
				pfp?:			string;
				display_name?:	string;
			};

			// --- Validate input ---
			const validations: { condition: any; status: 400 | 409 | 500 | 201; error: string }[] = [
				{	condition: !email,
					status: 400,
					error: "Email is required"
				}, {
					condition: email && !emailRegex.test(email),
					status: 400,
					error: "Invalid email format"
				}, {
					condition: !username,
					status: 400,
					error: "Username is required"
				}, {
					condition: username && !usernameRegex.test(username),
					status: 400,
					error: "Username must be 3-20 characters long and contain only letters, numbers, and underscores"
				}, {
					condition: pfp && pfp.length > 255,
					status: 400,
					error: "Profile picture URL/path must be 255 characters or fewer"
				}, {
					condition: display_name !== undefined && (display_name.length === 0 || display_name.length > 50),
					status: 400,
					error: "Display name must be 1-50 characters long"
				}, {
					condition: !password && !oauth,
					status: 400,
					error: "Either password or OAuth data is required"
				}, {
					condition: password && !passwordRegex.test(password),
					status: 400,
					error: "Password must be 8-40 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character"
				}, {
					condition: getUserByEmail(email!),
					status: 409,
					error: "User with this email already exists"
				}, {
					condition: getProfileByUsername(username!),
					status: 409,
					error: "Username is already taken"
				}, {
					condition: oauth && getOauthAccountByProviderAndUserId(oauth.provider_name, oauth.provider_user_id),
					status: 409,
					error: "An account with this OAuth provider and user ID already exists"
				},
			];

			// execute checks
			for (const v of validations) {
				if (v.condition) return reply.status(v.status).send({ error: v.error });
			}

			// --- Create user (if password provided) ---
			let passwordHash = "";
			if (password) {
				passwordHash = await hashPassword(password);
			}

			const newUser = createUser(email!, passwordHash, getRoleByName('unverified')!.role_id);
			if (!newUser) {
				return reply.status(500).send({ error: "Failed to create user" });
			}

			const ip = request.ip || request.headers['x-forwarded-for']?.toString() || '';
			let countryId: number | undefined;
			if (ip) {
				const geo = geoip.lookup(ip);
				if (geo && geo.country) {
					const country  = getCountryByCode(geo.country);
					if (country) {countryId = country.country_id;}
				}
			}

			let avatarFileName: string | undefined;
			if (pfp) {
				try {
					avatarFileName = await saveAvatarFromUrl(newUser.user_id.toString(), pfp);
				} catch (err) {
					console.error("Failed to save avatar from URL:", err);
				}
			}

			createProfile(
						newUser.user_id,
						username!,
						display_name || username!,
						avatarFileName || undefined,
						countryId
					);

			// --- Optional OAuth association ---
			if (oauth) {
				createOauthAccount({
					user_id: newUser.user_id,
					provider_name: oauth.provider_name,
					provider_user_id: oauth.provider_user_id,
					profile_json: oauth.profile_json,
					id_token_hash: oauth.id_token_hash,
					linked_at: Date.now(),
				});
			}

			const verificationToken = generateRandomToken(32);
			const encryptedToken = encryptSecret(verificationToken).toString('base64');

			createEmailVerification({
				user_id: newUser.user_id,
				token: encryptedToken,
				expires_at: Date.now() + 60 * 60 * 1000, // 1 hour
			});

			sendMail(
				newUser.email,
				"Welcome to ft_transcendence!",
				"accountVerification.html",
				{
					HEADER: "Welcome to ft_transcendence!",
					VERIFICATION_LINK: `https://moutig.sh/verify?user=${newUser.user_id}&token=${encodeURIComponent(verificationToken)}`,
				},
				`verify@${process.env.MAIL_DOMAIN || 'example.com'}`
			).catch(err => {
				console.error("Failed to send welcome email:", err);
			});

			// --- Response ---
			return reply.status(201).send({
				message: "User account created successfully",
				user: {
					user_id: newUser.user_id,
					email: newUser.email,
					role_id: newUser.role_id,
				},
			});
		} catch (err) {
			console.error("Error in /accounts/register:", err);
			return reply.status(500).send({ error: "Internal server error" });
		}
	});
}
