export class Position {
    pos_x: number;
    pos_y: number;

    constructor(pos_x: number, pos_y: number) {
        this.pos_x = pos_x;
        this.pos_y = pos_y;
    }
}

export class Games {
    equip_a: string[] = [];
    equip_b: string[] = [];
    uuid: string;
    code: string;

    position_paddle: Record<string, Position>;
    score: Record<string, number>
    position_ball: Position;
    velocity_ball: Position;
    end_game: number;

    constructor(user_id: string, uuid: string, code: string)
    {
        this.equip_a.push(user_id);
        this.uuid = uuid;
        this.code = code;

        this.position_paddle = { "player_1": { pos_x: 100, pos_y: 0 }, "player_2": { pos_x: 1000, pos_y: 0 } };
        this.score = { "player_1": 0, "player_2": 0 };
        this.position_ball = { pos_x: 0, pos_y: 0 };
        this.velocity_ball = { pos_x: 3, pos_y: 3 };
        this.end_game = 3600;
    }

    init(position_paddle: Record<string, Position>, score: Record<string, number>, position_ball: Position, velocity_ball: Position, end_game: number) {
        this.position_paddle = position_paddle;
        this.position_ball = position_ball;
        this.velocity_ball = velocity_ball;
        this.end_game = end_game;
        this.score = score;
    }
}