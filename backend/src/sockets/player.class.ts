export class Player {
    worker_index: number;
    player_id: string;
    game_id: string;
    token: string;

    constructor(worker_index: number, player_id: string, game_id: string, token: string) {
        this.worker_index = worker_index;
        this.player_id = player_id;
        this.game_id = game_id;
        this.token = token;
    }
}