import { error } from "console";

/**
 * This function can parse the json file for message with sockets.
 * @param json - The json file
 * @throws Error if the user_id or game_id is missing.
 */
export function parse(json: any) {
    const user_id = json["user_id"];
    const game_id = json["game_id"];
    const move = json["move"];
    const score = json["add"];

    if (!user_id || !game_id) {
        throw new Error("user_id or game_id is missing");
    }

    if (move) {
        /* Apply logic for move */
    } else if (score) {
        /* Apply logic for score */
    }
}