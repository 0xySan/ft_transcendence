import { Player } from './player.class.js'
import { workers } from '../server.js'

/**
 * This function can parse the json file for message with sockets.
 * @param json - The json file
 * @throws Error if the user_id or game_id is missing.
 */
export async function parse(json: any, player: Player, ws: any) {
    const action = json["action"];

    if (!action) throw new Error("Action is missing");

    if (action == "move") {
        /* Apply logic for move */
    } else if (action == "start") {
        await new Promise<string> ((resolve) => {
            workers[player.worker_index].worker.once("message", (msg) => resolve(msg));
            workers[player.worker_index].worker.postMessage({ action: "startGame", game_uuid: player.game_id });

        })
    }
}

/* 
{
    "action": "example"
}
*/