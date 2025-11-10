// ======= Interface file for (server -> client) ======= \\
/**
 * This interface is used to have the main parameters of the game management
 * @example ```ts
 * const gameState: sv_game = {
 *     position_paddle: { "player1": { pos_x: 1, pos_y: 5 }, "player2": { pos_x: 18, pos_y: 5 } },
 *     position_ball: { pos_x: 10, pos_y: 7 },
 *     velocity_ball: { pos_x: 1, pos_y: -1 },
 *     end_game: 0,
 *     score: { "player1": 3, "player2": 2 }
 * };
 */
export interface sv_game {
    /* Map<user_id, paddle(x, y) */
    position_paddle: Record<string, position>;
    /* position of ball: position(x, y) */
    position_ball: position;
    /* velocity of ball: position(x, y) */
    velocity_ball: position;
    /* timestamp if end of game */
    end_game: number;
    /* Map<user_id, score> */
    score: Record<string, number>
}

/**
 * This interface is used for the coords
 * @example ```ts
 * const ballPosition: position = {
 *     pos_x: 12,
 *     pos_y: 7
 * };
 */
export interface position {
    /* horizontale position */
    pos_x: number;
    /* vertical position */
    pos_y: number;
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