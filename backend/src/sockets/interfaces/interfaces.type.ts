/**
 * Interface file for (server -> client)
 */

export interface sv_game {
    /* Map<user_id, paddle(x, y) */
    position_paddle: Map<string, position>;
    position_ball: position;
    velocity_ball: position;
    end_game: number;
    score_a: number;
    score_b: number;
}

export interface position {
    position_x: number;
    position_y: number;
}

/**
 * Interface file for (client -> server)
 */
export interface cl_game {
    player: Array<cl_key>;
}

export interface cl_key {
    key: 'up' | 'down' | 'left' | 'right';
    /* true = pressed | false = not-pressed */
    statement: boolean;
    frame: number;
}