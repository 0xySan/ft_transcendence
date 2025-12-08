/**
 * @file game.route.ts
 * @description This fild could manage the game lobby with they differents endpoints.
 */

import { FastifyInstance } from "fastify";
import { generateRandomToken } from '../utils/crypto.js';
import { sv_game } from '../sockets/interfaces/interfaces.type.js';
import { workers, parties_per_core } from '../server.js';
import { FastifyReply } from "fastify/types/reply.js";
import { requirePartialAuth } from '../middleware/auth.middleware.js';
import { patchGameSchema, postGameSchema, getGameSchema } from '../plugins/swagger/schemas/game.schema.js';
import { Player } from '../sockets/player.class.js';
import { getProfileByUserId, UserProfile } from '../db/wrappers/main/users/userProfiles.js';

/**
 * Set the clientToken and codes.
 */
export const clientToken: Player[] = []
let codes: string[] = [];

export function getPlayerWithToken(token: string) {
    for (const target of clientToken) {
        if (target.token == token) {
            return (target);
        }
    }
    return (null);
}

export function deletePlayerWithToken(token: string) {
    for (const target of clientToken) {
        if (target.token == token) {
            clientToken.splice(clientToken.indexOf(target), 1);
            return (true);
        }
    }
    return (null);
}

export function getPlayerWithUserId(user_id: string) {
    for (const target of clientToken) {
        if (target.player_id == user_id) {
            return (target);
        }
    }
    return (null);
}

/**
 * This function could create a unique code.
 * @returns 
 */
function createCode(): string {
    const codeRegex = "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345789"
    const size = codeRegex.length
    let code = "";

    while (code == "" || codes.includes(code)) {
        code = "";
        for (let i = 0; i < 6; i++)
            code += codeRegex[Math.floor(Math.random() * size)];
    }
    return (code);
}

/**
 * This function could get the correct worker (thread) with a user_id.
 * @param user_id - The user_id of the correct worker with a parties.
 * @returns The correct worker (thread) with the correct game_uuid.
 */
async function getWorkerWithUserId(user_id: string) {
    let result;

    // Loop of every workers (threads).
    for (const target of workers) {
        // Communicated with the targeted worker (thread) and return a json file with the correct game_uuid or null.
        result = await new Promise<{ return: string; game_uuid: string }>((resolve) => {
            target.worker.once("message", (msg) => resolve(msg));
            target.worker.postMessage({ action: "getIdWithUserId", user_id: user_id });
        });

        // Check if the game_uuid find and retorn the correct value.
        if (result.return == "getIdWithUserId" && result.game_uuid != "null") {
            return ({ worker: target, game_uuid: result.game_uuid });
        }
    }

    return (null);
}

/**
 * This function can get the best worker (thread) with they games in or players.
 * @returns The best worker find.
 */
async function getWorker() {
    let bestWorker = workers[0];

    // Loop of every workers.
    for (const tmp of workers) {
        const tmpPlayers = tmp.players.length;
        const bestPlayers = bestWorker.players.length;

        // Communicated with the target worker for get the number of parties.
        const tmpParties = await new Promise<number>((resolve) => {
            tmp.worker.once("message", (msg) => resolve(msg));
            tmp.worker.postMessage({ action: "getNumberParties" });
        });

        // If the limit of the parties reach continue...
        if (tmpParties >= parties_per_core) {
            continue;
        }

        // This part could itter with every workers (threads) and check the difference below this.
        const bestParties = await new Promise<number>((resolve) => {
            bestWorker.worker.once("message", (msg) => resolve(msg));
            bestWorker.worker.postMessage({ action: "getNumberParties" });
        });

        // Check the diff
        if (tmpParties < bestParties || (tmpParties === bestParties && tmpPlayers < bestPlayers)) {
            bestWorker = tmp;
        }
    }

    // Communicated with the best worker for check if this is a last and if the partied doesn't reach.
    const tmpParties = await new Promise<number>((resolve) => {
        bestWorker.worker.once("message", (msg) => resolve(msg));
        bestWorker.worker.postMessage({ action: "getNumberParties" });
    });
    if (tmpParties >= parties_per_core) {
        return (null);
    }

    return (bestWorker);
}

/**
 * This function could create a game.
 * @param game - Interface with the user_id of the new game.
 * @param reply - The fastify replys instance.
 * @returns A json file with sucess or error attribut.
 */
async function gameCreate(game: sv_game, reply: FastifyReply) {
    // Get the best worker (thread) for the new game.
    const worker = await getWorker();
    if (worker == null) {
        return (reply.status(501).send({ error: "Every server is full" }));
    }

    // Create the code and save in the 'codes'
    const code = createCode();
    codes.push(code);
    console.log("DEBUG: code = " + code);

    // Communicated with the worker (thread) for create a game.
    const game_uuid = generateRandomToken(32);
    worker.worker.postMessage({ action: "createGame", game: {
        user_id: game.user_id,
        uuid: game_uuid,
        code: code
    } });

    worker.players.push(String(game.user_id));

    // stock uuid and token in map
    const token = generateRandomToken(32);
    clientToken.push(new Player(workers.indexOf(worker), game.user_id, game_uuid, token));
    // return party Token
    return (reply.status(202).send({token, user_id: game.user_id}));
}

/**
 * This function could joind a game for the player.
 * @param game - Interface with the user_id and the code of the targeted game.
 * @param reply - The fastify replys instance.
 * @returns A json file with sucess or error attribut.
 */
async function gameJoin(game: sv_game, reply: FastifyReply) {
    if (!codes.includes(game.code)) {
        return (reply.status(401).send({ error: "Code doesn't exist" }));
    }

    // Loop on every workers (threads)
    for (const target of workers) {
        // Communicated with the 'target' worker (thread) for get the game_uuid.
        const result = await new Promise<string>((resolve) => {
            target.worker.once("message", (msg) => resolve(msg));
            target.worker.postMessage({ action: "getCode", game: game });
        });

        // Check if the resul is != null because if the code is not in this thread result == "null".
        if (result != "null") {
            target.players.push(game.user_id);
            const token = generateRandomToken(32);
            clientToken.push(new Player(workers.indexOf(target), game.user_id, result, token));
            return (reply.status(202).send({token}));
        }
    }

    return (reply.status(501).send({ error: "Game is full", user_id: game.user_id }));
}

/**
 * This function set the different (GET, POST, PATCH) routes.
 * @param fastify - IS instance of fastify server.
 */
export async function gameRoutes(fastify: FastifyInstance) {

    // ------------------    GET METHOD    ----------------------- \\
    // fastify.get("/api/game", { schema: getGameSchema }, async (request, reply) => {
    //     const game = request.body as sv_game;
    //     const token = generateRandomToken(32);

    //     if (game.user_id == null)
    //         return (reply.status(401).send({ error: "user_is is empty" }));
    //     // stock uuid and token in maptarget
    //     clientToken.set(game.user_id, token);
    //     // return party Token
    //     return (reply.status(202).send({token}));
    // });

    // -----------------    POST METHOD    ----------------------- \\
    fastify.post("/api/game", { preHandler: requirePartialAuth, schema: postGameSchema }, async (request, reply) => {
        const game = request.body as sv_game;
        const session = (request as any).session;
        const userId = session?.user_id;

        if (userId == null)
            return (reply.status(401).send({ error: "user_is is empty" }));

        console.log("\n\n\n\nDEBUG: HERE user_id = " + userId);
        const userName = getProfileByUserId(userId)?.display_name;
        if (userName) game.user_id = userName;
        else return (reply.status(501).send({ error: "User Profile not find" }));

        // (code = null) == Create a game | (code != null) == Join a game
        if (game.code == "null") {
            return (gameCreate(game, reply));
        } else {
            return (gameJoin(game, reply));
        }
    });

    // ----------------    PATCH METHOD    ----------------------- \\
    fastify.patch("/api/game", { schema: patchGameSchema }, async (request, reply) => {
        const game = request.body as sv_game;
        const session = (request as any).session;
        const userId = session?.user_id;

        if (userId == null)
            return (reply.status(401).send({ error: "user_id is empty" }));

        // Get the correct worker (thread)
        const worker_target = await getWorkerWithUserId(game.user_id);
        if (worker_target == null) {
            return (reply.status(501).send({ error: "Game doesn't exist" }));
        }

        // Check they settings
        if (game.time == undefined) {
            return (reply.status(401).send({ error: "Setting 'time' is not set" }));
        } else if (game.score == undefined) {
            return (reply.status(401).send({ error: "Setting 'score' is not set" }));
        } else if (game.position_ball == undefined) {
            return (reply.status(401).send({ error: "Setting 'position_ball' is not set" }));
        } else if (game.velocity_ball == undefined) {
            return (reply.status(401).send({ error: "Setting 'velocity_ball' is not set" }));
        } else if (game.position_paddle == undefined) {
            return (reply.status(401).send({ error: "Setting 'position_paddle' is not set" }));
        }

        // Send the correct settings after the correction to the worker (thread)
        const settings = await new Promise<{ return: string, result: string }>((resolve) => {
            worker_target.worker.worker.once("message", (msg) => resolve(msg));
            worker_target.worker.worker.postMessage({ action: "setSettings", game_uuid: worker_target.game_uuid, game: { 
                time: game.time, 
                score: { "equip_a": game.score.equip_a, "equip_b": game.score.equip_b },
                position_ball: { "pos_x": game.position_ball.pos_x, "pos_y": game.position_ball.pos_y },
                velocity_ball: { "pos_x": game.velocity_ball.pos_x, "pos_y": game.velocity_ball.pos_y },
                position_paddle: {
                    "player_1": { "pos_x": game.position_paddle.player_1.pos_x, "pos_y": game.position_paddle.player_1.pos_y }, 
                    "player_2": { "pos_x": game.position_paddle.player_2.pos_x, "pos_y": game.position_paddle.player_2.pos_y }, 
                    "player_3": { "pos_x": game.position_paddle.player_3.pos_x, "pos_y": game.position_paddle.player_3.pos_y }, 
                    "player_4": { "pos_x": game.position_paddle.player_4.pos_x, "pos_y": game.position_paddle.player_4.pos_y }
                }
            } });
        });

        if (settings.result == "failed") {
            return (reply.status(501).send({ error: "Game not find" }));
        }

        return (reply.status(202).send({ sucess: "settings updated" }));
    });
}