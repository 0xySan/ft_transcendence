/**
 * @file gamesLogic.ts
 * @description This file is a worker (thread) for they parties.
 */

import { parentPort } from "worker_threads";
import { Games } from '../sockets/games.classe.js';
import { start } from "repl";

// List of the games in this thread.
let games: Games[] = []; 

const width_game = 928;
const height_game = 608;

setInterval(game, 50);

function goal(game_target: Games, equip: string) {
    game_target.score[equip] += 1;
    console.log("DEBUG: GOALLLLLLLLLLLLLLLLL equip A = " + game_target.score["A"] + " | equip B = " + game_target.score["B"]);
    game_target.position_ball.pos_x = width_game / 2;
    game_target.position_ball.pos_y = height_game / 2;
}

function game() {
    let date = Date.now();

    for (const game_target of games) {
        if (game_target.statement == true) {
            console.log("DEBUG: game uuid = " + game_target.game_uuid);
            for (const uuid of game_target.players) {
                parentPort?.postMessage({ 
                    action: "send",
                    user_id: uuid,
                    ball: { pos_x: game_target.position_ball.pos_x, pos_y: game_target.position_ball.pos_y },
                    equip_a: { player_1: game_target.equip_a[0], player_2: game_target.equip_a[1] },
                    equip_b: { player_1: game_target.equip_b[0], player_2: game_target.equip_b[1] },
                    score_a: game_target.score["A"],
                    score_b: game_target.score["B"]
                });
            }

            game_target.updateBall(width_game, height_game);
            if (game_target.position_ball.pos_x <= 0) {
                goal(game_target, "A");
            } else if (game_target.position_ball.pos_x >= width_game) {
                goal(game_target, "B");
            }

            if (game_target.time <= date) {
                game_target.statement = false;
                console.log("DEBUG: Partie terminee");
                for (const user of game_target.players) {
                    parentPort?.postMessage({ action: "finished", user_id: user });
                }
            }
        }
    }
}

/**
 * Is a listener for listen every message.
 */
parentPort?.on("message", (msg) => {

    /**
     * If the action message is 'getNumberParties'.
     * @returns The number of parties in this worker (thread).
     */
    if (msg.action == "getNumberParties") {
        parentPort?.postMessage(games.length);
    } 
    
    /**
     * If the action message is 'getCode'.
     * @param game - Contain the game code.
     * @returns The game_uuid or null if the game is not in this worker (thread).
     */
    else if (msg.action == "getCode") {
        for (const target of games) {
            if (target.code == msg.game.code) {
                if (target.equip_a.length == 2 && target.equip_b.length == 2) {
                    break;
                }
                target.addPlayer(msg.game.user_id);
                parentPort?.postMessage(target.game_uuid);
                return;
            }
        }
        parentPort?.postMessage("null");
    } 

    else if (msg.action == "userInGame") {
        for (const target of games) {
            if (target.players.includes(msg.user_id)) {
                parentPort?.postMessage({ found: true, game_uuid: target.game_uuid });
                return;
            }
        }
        parentPort?.postMessage({ found: false });
    } 

    else if (msg.action == "startGame") {
        for (const target of games) {
            if (target.game_uuid == msg.game_uuid) {
                target.statement = true;
                target.time += Date.now();

                for (const uuid of target.players) {
                    parentPort?.postMessage({ 
                        action: "start",
                        user_id: uuid,
                        ball: { pos_x: target.position_ball.pos_x, pos_y: target.position_ball.pos_y },
                        equip_a: { player_1: target.equip_a[0], player_2: target.equip_a[1] },
                        equip_b: { player_1: target.equip_b[0], player_2: target.equip_b[1] },
                        end_game: target.time
                    });
                }

                return;
            }
        }
    } 
    
    /**
     * If the action message is 'getGameIdWithUserId'.
     * @param user_id - Is a user_id.
     * @returns The game_uuid or null if the user_id is not in game in this worker (thread).
     */
    else if (msg.action == "getGameIdWithUserId") {
        for (const target of games) {
            if (target.equip_a.includes(msg.user_id) || target.equip_b.includes(msg.user_id)) {
                parentPort?.postMessage({ return: "getGameIdWithUserId", game_uuid: target.game_uuid });
                return;
            }
        }
        parentPort?.postMessage("null");
    } 
    
    /**
     * If the action message is 'setSettings'.
     * @param game_uuid - Is a game_uuid.
     * @param game - the game with every settings.
     * @returns Apply settings and return failed or sucess.
     */
    else if (msg.action == "setSettings") {
        let game_target = null;

        for (const target of games) {
            if (target.game_uuid == msg.game_uuid) {
                game_target = target;
                break;
            }
        }

        if (game_target == null) {
            parentPort?.postMessage({ return: "setSettings", result: "failed" });
            return;
        }

        game_target.position_paddle = {
                    "player_1": { "pos_x": msg.game.position_paddle.player_1.pos_x, "pos_y": msg.game.position_paddle.player_1.pos_y },
                    "player_2": { "pos_x": msg.game.position_paddle.player_2.pos_x, "pos_y": msg.game.position_paddle.player_2.pos_y }, 
                    "player_3": { "pos_x": msg.game.position_paddle.player_3.pos_x, "pos_y": msg.game.position_paddle.player_3.pos_x },
                    "player_4": { "pos_x": msg.game.position_paddle.player_4.pos_x, "pos_y": msg.game.position_paddle.player_4.pos_x }
                }
        game_target.velocity_ball = { pos_x: msg.game.velocity_ball.pos_x, pos_y: msg.game.velocity_ball.pos_y };
        game_target.position_ball = { pos_x: msg.game.position_ball.pos_x, pos_y: msg.game.position_ball.pos_y };
        game_target.score = { "equip_a": msg.game.score.equip_a, "equip_b": msg.game.score.equip_b };
        game_target.time = msg.game.time;

        console.log("DEBUG: game json = ", game_target);

        parentPort?.postMessage({ return: "setSettings", result: "sucess" });
    } 
    
    /**
     * If the action message is 'createGame'.
     * Create a game in this worker (thread).
     * @param game - the game.
     */
    else if (msg.action == "createGame" && msg.game) {
        games.push(new Games(
            msg.game.user_id,
            msg.game.uuid,
            msg.game.code
        ));
    }
});