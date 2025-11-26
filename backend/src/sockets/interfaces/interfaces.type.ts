// ======= Interface file for (server -> client) ======= \\
/**
 * This interface is used to have the main parameters of the game management
 * @example ```ts
 * const gameState: sv_game = {
 *     user_id: "019aa6b3-8520-749c-9fc6-6312e1d54979"
 * };
 */
export interface sv_game {
    /* id of the user */
    user_id: string
    /* code of the game */
    code: string;
}

// ======= Interface file for (client -> server) ======= \\
/**
 * This interface is used to have the list of the player's inputs
 * @example ```ts
 * const playerInput: cl_game = {
 *     inputs: [
 *         { key: "up", statement: true, frame: 2 },
 *         { key: "down", statement: false, frame: 0 }
 *     ]
 * };
 */
export interface cl_game {
    /* list of input for the player */
    inputs: Array<cl_key>;
}

/**
 * This interface is used to have the info on each key
 * @example ```ts
 * const keyInput: cl_key = {
 *     key: "up",
 *     statement: true,
 *     frame: 3
 * };
 */
export interface cl_key {
    /* key (up, down, left, right) */
    key: 'up' | 'down' | 'left' | 'right';
    /* true = pressed | false = not-pressed */
    statement: boolean;
    /* number of frame during with the key is pressed */
    frame: number;
}