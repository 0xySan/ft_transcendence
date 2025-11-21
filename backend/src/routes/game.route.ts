/**
 * @file socket.ts
 * @description TODO met un nom
 */

import { FastifyInstance } from "fastify";
import { generateRandomToken } from '../utils/crypto.js';
import { sv_game } from '../sockets/interfaces/interfaces.type.js';
import { workers, worker, parties_per_core } from '../server.js';

const coef_games = 1;
const coef_players = 2;
const clientToken = new Map<string, string>();
let codes: string[] = [];

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

async function getWorker(): Promise<worker | null> {
    let best = workers[0];

    let game_parties = await new Promise<number>((resolve) => {
        best.worker.once("message", (msg) => resolve(msg));
        best.worker.postMessage({ action: "getNumberParties" });
    });

    let bestScore = game_parties * coef_games
                  + workers[0].players * coef_players;

    for (const tmp of workers) {
        let game_parties_tmp = await new Promise<number>((resolve) => {
            tmp.worker.once("message", (msg) => resolve(msg));
            tmp.worker.postMessage({ action: "getNumberParties" });
        });

        if (game_parties_tmp == parties_per_core)
            continue;
        const score = game_parties_tmp * coef_games
                    + tmp.players * coef_players;
        if (score < bestScore) {
            best = tmp;
            bestScore = score;
        }
    }

    let game_parties_tmp = await new Promise<number>((resolve) => {
        best.worker.once("message", (msg) => resolve(msg));
        best.worker.postMessage({ action: "getNumberParties" });
    });

    if (game_parties_tmp == parties_per_core)
        return (null);
    return (best);
}

export async function gameRoutes(fastify: FastifyInstance) {

    // ----------------     GET METHOD     ----------------------
    fastify.get("/api/game", async (request, reply) => {
        const game = request.body as sv_game;
        const token = generateRandomToken(32);

        if (game.user_id == null)
            return (reply.status(401).send({ error: "user_is is empty" }));
        // stock uuid and token in map
        clientToken.set(game.user_id, token);
        // return party Token
        return (reply.status(202).send({token}));
    });

    // ----------------    POST METHOD    ----------------------
    fastify.post("/api/game", async (request, reply) => {

        const game = request.body as sv_game;
        if (game.user_id == null)
            return (reply.status(401).send({ error: "user_is is empty" }));
        const worker = await getWorker();
        if (worker == null)
            return (reply.status(501).send({ error: "Every server is full" }));

        const code = createCode();
        const token = generateRandomToken(32);
        codes.push(code);

        worker.worker.postMessage({ action: "createGame", game: {
            user_id: game.user_id,
            uuid: token,
            code: code,
        } });
        // stock uuid and token in map
        clientToken.set(game.user_id, token);
        // return party Token
        return (reply.status(202).send({token}));
    });
}