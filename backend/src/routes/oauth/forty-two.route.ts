import { FastifyInstance } from 'fastify';
import { ftCallbackSchema } from '../../plugins/swagger/schemas/ftCallback.schema.js';

import fetch from 'node-fetch';

import { getOauthProviderByName } from '../../db/wrappers/auth/oauth/oauthProviders.js';
import { getOauthAccountByProviderAndUserId, getUserByEmail } from '../../db/index.js';
import { returnOauthSession } from '../../auth/oauth/utils.js';
import { decryptSecret } from '../../utils/crypto.js';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface UserInfo {
  id: string;
  email: string;
  login: string;
  usual_first_name: string;
  usual_full_name: string;
  first_name: string;
  last_name: string;
  displayname: string;
  image: {
    link: string;
  };
}

export function ftRoutes(fastify: FastifyInstance) {
    fastify.get('/forty-two/callback', { schema: ftCallbackSchema, validatorCompiler: ({ schema }) => {return () => true;} }, async (request, reply) => {
        const { code } = request.query as { code?: string };
		if (!code) return reply.status(400).send('Missing code');

		const provider = getOauthProviderByName('forty-two');
		if (!provider) return reply.status(404).send('OAuth provider not found');

        try {
            const clientSecret = decryptSecret(provider.client_secret_encrypted);

            const tokenRes = await fetch('https://api.intra.42.fr/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: provider.client_id,
                    client_secret: clientSecret,
                    redirect_uri: provider.discovery_url,
                    grant_type: 'authorization_code'
                })
            });
            
            const tokenData = (await tokenRes.json()) as TokenResponse;
            const accessToken = tokenData.access_token;
			if (!accessToken) throw new Error('No access token returned');

            const userRes = await fetch('https://api.intra.42.fr/v2/me', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
            const userInfo = (await userRes.json()) as UserInfo;
            
            const oauthAccount = getOauthAccountByProviderAndUserId('42', userInfo.id);

            if (oauthAccount)
                return returnOauthSession(oauthAccount, request, reply);

            const existingUser = getUserByEmail(userInfo.email);
			const query = new URLSearchParams({
				email: userInfo.email,
				provider: '42',
				providerId: userInfo.id,
				name: userInfo.usual_first_name || userInfo.first_name || userInfo.login,
				displayName: userInfo.usual_full_name || userInfo.displayname || `${userInfo.first_name} ${userInfo.last_name}`,
				picture: userInfo.image?.link || '',
			}).toString();

			if (existingUser)
				return reply.redirect(`/auth/link-account?${query}`);
			return reply.redirect(`/register?${query}`);
        } catch (err) {
			console.error('42 OAuth callback error:', err);
			return reply.status(500).send({ error: (err as Error).message });
		}
    });

}
