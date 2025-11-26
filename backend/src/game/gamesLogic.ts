import { parentPort } from "worker_threads";
import { Games } from '../sockets/games.classe.js';

let games: Games[] = []; 

parentPort?.on("message", (msg) => {
    if (msg.action == "getNumberParties") {
        parentPort?.postMessage(games.length);
    } else if (msg.action == "getCode") {
        for (const target of games) {
            if (target.code == msg.game.code) {
                if (target.equip_a.length == 2 && target.equip_b.length == 2) {
                    break;
                }
                target.addPlayer(msg.game.user_id);
                console.log("DEBUG: 1 n = " + games.length + " | games = ", games);
                parentPort?.postMessage(target.game_uuid);
                return;
            }
        }
        console.log("DEBUG: 2 n = " + games.length + " | games = ", games);
        parentPort?.postMessage("null");
    } else if (msg.action == "createGame" && msg.game) {
        games.push(new Games(
            msg.game.user_id,
            msg.game.uuid,
            msg.game.code
        ));
        console.log("DEBUG: n = " + games.length + " | games = ", games);
        parentPort?.postMessage({ status: "ok" });
    }
});