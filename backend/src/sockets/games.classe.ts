/**
 * @file games.classe.ts
 * @description This file have 2 classes for the game management.
 */

/**
 * This class is used for a position.
 * @constructor
 * @example ```ts
 * const pos = new Position(6, 8);
 */
export class Position {
    /* The position x of the instance */
    pos_x: number;
    /* The position y of the instance */
    pos_y: number;

    /* Constructor of the Position instance */
    constructor(pos_x: number, pos_y: number) {
        this.pos_x = pos_x;
        this.pos_y = pos_y;
    }
}

/**
 * This class is used for a Games.
 * @constructor
 * @example ```ts
 * const pos = new Games("019aa6b3-8520-749c-9fc6-6312e1d54979", "484545", "123ABC");
 */
export class Games {
    /* List of string contain uuid of the player for this equip */
    equip_a: string[] = [];
    /* List of string contain uuid of the player for this equip */
    equip_b: string[] = [];
    /* The uuid of the game */
    game_uuid: string;
    /* The code of the game */
    code: string;

    /* The paddle position of the game (setting) */
    position_paddle: Record<string, Position>;
    /* The score of the game (setting) */
    score: Record<string, number>
    /* The ball position of the game (setting) */
    position_ball: Position;
    /* The ball velocity of the game (setting) */
    velocity_ball: Position;
    /* The time of the game (setting) */
    time: number;

    /* Constructor of the Games instance */
    constructor(user_id: string, game_uuid: string, code: string)
    {
        this.equip_a.push(user_id);
        this.game_uuid = game_uuid;
        this.code = code;

        this.position_paddle = { "player_1": { pos_x: 0, pos_y: 0 }, "player_2": { pos_x: 0, pos_y: 0 } };
        this.score = { "player_1": 0, "player_2": 0 };
        this.position_ball = { pos_x: 0, pos_y: 0 };
        this.velocity_ball = { pos_x: 0, pos_y: 0 };
        this.time = 0;
    }

    /**
     * This function could join a correct equip.
     * @param user_id - The user_if of the player.
     */
    addPlayer(user_id: string) {
        if (this.equip_b.length < this.equip_a.length) {
            this.equip_b.push(user_id);
        } else {
            this.equip_a.push(user_id);
        }
    }

    /**
     * This function could init the different settings.
     * @param position_paddle   - The position paddle. (setting)
     * @param score             - The score. (setting)
     * @param position_ball     - The position ball. (setting)
     * @param velocity_ball     - The velocity ball. (setting)
     * @param time              - The time. (setting)
     */
    init(position_paddle: Record<string, Position>, score: Record<string, number>, position_ball: Position, velocity_ball: Position, time: number) {
        this.position_paddle = position_paddle;
        this.position_ball = position_ball;
        this.velocity_ball = velocity_ball;
        this.time = time;
        this.score = score;
    }
}