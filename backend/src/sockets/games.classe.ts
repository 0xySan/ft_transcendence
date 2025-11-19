export class Position {
    pos_x: number;
    pos_y: number;

    constructor(pos_x: number, pos_y: number) {
        this.pos_x = pos_x;
        this.pos_y = pos_y;
    }
}

export class Games {
    position_paddle: Record<string, Position>;
    score: Record<string, number>
    position_ball: Position;
    velocity_ball: Position;
    end_game: number;
    uuid: string;
    code: string;

    constructor(position_paddle: Record<string, Position>, score: Record<string, number>, position_ball: Position, velocity_ball: Position,
        end_game: number, uuid: string, code: string)
    {
        this.position_paddle = position_paddle;
        this.position_ball = position_ball;
        this.velocity_ball = velocity_ball;
        this.end_game = end_game;
        this.score = score;
        this.uuid = uuid;
        this.code = code;
    }
}