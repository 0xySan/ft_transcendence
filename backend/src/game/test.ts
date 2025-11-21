import { parentPort } from "worker_threads";
import { Games } from '../sockets/games.classe.js';

let game: Games[] = []; 

function repeat() {
  setTimeout(repeat, 1000);
}

repeat();

parentPort?.on("message", (msg) => {
    if (msg.state == "changeState" && msg.game) {
        game.push(new Games(
            msg.game.position_paddle,
            msg.game.score,
            msg.game.position_ball,
            msg.game.velocity_ball,
            msg.game.end_game,
            msg.game.uuid,
            msg.game.code
        ));
        console.log("DEBUG: n = " + game.length + " | game = ", game[game.length - 1]);
    }
});