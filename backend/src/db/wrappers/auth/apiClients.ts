/**
 * Wrapper functions for interacting with the `apiClients` table.
 * Provides retrieval, creation, and listing utilities.
*/

import { db, insertRow, getRow } from "../../index.js";

export interface apiClients {
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
export function getApiClientById(id: number): apiClients | undefined {
    return (getRow<apiClients>("api_clients", "app_id", id));
}

/**
 * List of api clients
 * @returns The list of the table
 */
export function listApiClient(): apiClients[] {
    const stmt = db.prepare("SELECT * FROM api_clients");
    return stmt.all() as apiClients[];
}

/**
 * Retrieve apiClients by owner_id.
 * @param owner_id - The user ID of the owner
 * @returns An array of apiClients objects owned by the specified owner
 */
export function getApiClientByOwnerId(owner_id: number): apiClients[] {
    const stmt = db.prepare("SELECT * FROM api_clients WHERE owner_id = ?");
    return stmt.all(owner_id) as apiClients[];
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
export function createApiClient(options: Partial<apiClients>): apiClients | undefined {
    const   owner_id = (options.owner_id);
    const   name = (options.name ?? "unamed");
    const   client_secret_encrypted = (options.client_secret_encrypted);
    const   redirect_url = (options.redirect_url);
    const   scopes = (options.scopes);
    const   is_confidential = (options.is_confidential ?? 1);
    const   created_at = Math.floor(Date.now() / 1000);
    const   updated_at = (options.updated_at);
    const   secret_expiration = (options.secret_expiration);

    return (insertRow<apiClients>("api_clients", {
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
export function updateApiClient(app_id: number, options: Partial<apiClients>): boolean {
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
