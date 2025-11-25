import { parentPort } from "worker_threads";
import { Games } from '../sockets/games.classe.js';

let game: Games[] = []; 

parentPort?.on("message", (msg) => {
    if (msg.action == "getNumberParties") {
        parentPort?.postMessage(game.length);
    } else if (msg.action == "createGame" && msg.game) {
        game.push(new Games(
            msg.game.user_id,
            msg.game.uuid,
            msg.game.code
        ));
        console.log("DEBUG: n = " + game.length + " | games = ", game);
        parentPort?.postMessage({ status: "ok" });
    }
});