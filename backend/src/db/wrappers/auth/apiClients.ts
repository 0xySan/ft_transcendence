/**
 * Wrapper functions for interacting with the `apiClients` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface apiClients {
    client_id:                  string;
    owner_id:                   number;
    name:                       string;
    client_secret_encrypted:    string;
    redirect_url:               string;
    scopes:                     string;
    is_confidential:            boolean;
    created_at:                 number;
    updated_at:                 number;
    secret_expiration:          number;
}

/**
 * Retrieve a apiClients by its ID.
 * @param id - The primary key of the apiClients
 * @returns The apiClients object if found, otherwise undefined
 */
export function getApiClientsById(id: number): apiClients | undefined {
    return (getRow<apiClients>("api_clients", "app_id", id));
}

/**
 * Create a new apiClients if it doesn't exist.
 * Default values will be applied for missing fields.
 * Uses the generic insertRow wrapper to insert and fetch the apiClients.
 * 
 * @param options - Partial apiClients object with client_id, owner_id, name, client_secret_encrypted, redirect_url, scopes, 
 * is_confidential, created_at, updated_at, secret_expiration
 * @returns The newly created or existing apiClients object, or undefined if insertion failed
 */
export function createApiClients(options: Partial<apiClients>): apiClients | undefined {
    const   client_id = (options.client_id);
    const   owner_id = (options.owner_id);
    const   name = (options.name ?? "unamed");
    const   client_secret_encrypted = (options.client_secret_encrypted);
    const   redirect_url = (options.redirect_url);
    const   scopes = (options.scopes);
    const   is_confidential = (options.is_confidential ?? 1);
    const   created_at = (options.created_at);
    const   updated_at = (options.updated_at);
    const   secret_expiration = (options.secret_expiration);

    return (insertRow<apiClients>("api_clients", {
        client_id: client_id,
        owner_id: owner_id,
        name: name,
        client_secret_encrypted: client_secret_encrypted,
        redirect_url: redirect_url,
        scopes: scopes,
        is_confidential: (is_confidential ? 1 : 0),
        created_at: created_at,
        updated_at: updated_at,
        secret_expiration: secret_expiration
    }));
}

/**
 * Update apiClients.
 * Only updates the provided fields.
 * 
 * @param app_id - The provider ID
 * @param options - Partial information to update
 * @returns true if updated, false otherwise
 */
export function updateApiClients(app_id: number, options: Partial<apiClients>): boolean {
    const keys = Object.keys(options).filter(
        key => options[key as keyof apiClients] !== undefined && options[key as keyof apiClients] !== null
    );

    if (keys.length === 0) return false;

    const setClause = keys.map(key => `${key} = @${key}`).join(", ");

    const params: Record<string, unknown> = { app_id };
    for (const key of keys) {
        if (key === "is_confidential") {
            params[key] = options.is_confidential ? 1 : 0;
        } else {
            params[key] = options[key as keyof apiClients];
        }
    }

    const stmt = db.prepare(`
        UPDATE api_clients
        SET ${setClause}
        WHERE app_id = @app_id
    `);

    const result = stmt.run(params);

    return (result.changes > 0);
}
