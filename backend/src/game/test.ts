import { parentPort } from "worker_threads";
import { Games } from '../sockets/games.classe.js';

let state = false;
let game: Games; 

let i = 0;
function boucleInfinie() {
  console.log("n: " + state);
  i++;
  setTimeout(boucleInfinie, 1000);
}

boucleInfinie();

parentPort?.on("message", (msg) => {
    if (msg == "getState") {
        parentPort?.postMessage(state);
    }
    else if (msg.state == "changeState" && msg.game) {
        state = true;
        game = new Games(
            msg.game.position_paddle,
            msg.game.score,
            msg.game.position_ball,
            msg.game.velocity_ball,
            msg.game.end_game,
            msg.game.uuid,
            msg.game.code
        );
        console.log("DEBUG: game = ", game);
    }
});