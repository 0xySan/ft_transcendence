import { Games } from './games.classe.js'
import { workers } from '../server.js'

/**
 * This function can parse the json file for message with sockets.
 * @param json - The json file
 * @throws Error if the user_id or game_id is missing.
 */
export function parse(json: any) {
    const user_id = json["user_id"];
    const game_id = json["game_id"];
    const action = json["action"];

    if (!user_id || !game_id || !action) {
        throw new Error("user_id, game_id or action is missing");
    }

    const game: Games = 

    if (action == "move") {
        /* Apply logic for move */
    } else if (action == "add") {
        /* Apply logic for score */
    } else if (action == "start") {
        const user_id = json["user_id"];
        const game_id = json["game_id"];

        if (!user_id || !game_id) {
            throw new Error("user_id or game_id is missing");
        }


    }
}