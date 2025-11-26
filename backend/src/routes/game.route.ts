/**
 * @file socket.ts
 * @description TODO met un nom
 */

import { FastifyInstance } from "fastify";
import { generateRandomToken } from '../utils/crypto.js';
import { sv_game } from '../sockets/interfaces/interfaces.type.js';
import { workers, parties_per_core } from '../server.js';
import { FastifyReply } from "fastify/types/reply.js";

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

async function getWorker() {
    let bestWorker = workers[0];

    for (const tmp of workers) {
        const tmpPlayers = tmp.players.length;
        const bestPlayers = bestWorker.players.length;

        const tmpParties = await new Promise<number>((resolve) => {
            tmp.worker.once("message", (msg) => resolve(msg));
            tmp.worker.postMessage({ action: "getNumberParties" });
        });

        if (tmpPlayers >= parties_per_core) {
            continue;
        }

        const bestParties = await new Promise<number>((resolve) => {
            bestWorker.worker.once("message", (msg) => resolve(msg));
            bestWorker.worker.postMessage({ action: "getNumberParties" });
        });

        if (
            tmpParties < bestParties || 
            (tmpParties === bestParties && tmpPlayers < bestPlayers)
        ) {
            bestWorker = tmp;
        }
    }

    const tmpParties = await new Promise<number>((resolve) => {
        bestWorker.worker.once("message", (msg) => resolve(msg));
        bestWorker.worker.postMessage({ action: "getNumberParties" });
    });
    if (tmpParties >= parties_per_core) {
        return (null);
    }

    return (bestWorker);
}

async function gameCreate(game: sv_game, reply: FastifyReply) {
    const worker = await getWorker();
    if (worker == null)
        return (reply.status(501).send({ error: "Every server is full" }));

    const code = createCode();
    codes.push(code);

    worker.worker.postMessage({ action: "createGame", game: {
        user_id: game.user_id,
        uuid: generateRandomToken(32),
        code: code,
    } });

    worker.players.push(game.user_id);

    // stock uuid and token in map
    const token = generateRandomToken(32);
    clientToken.set(game.user_id, token);
    // return party Token
    return (reply.status(202).send({token}));
}

async function gameJoin(game: sv_game, reply: FastifyReply) {
    if (!codes.includes(game.code)) {
        return (reply.status(401).send({ error: "Code doesn't exist" }));
    }

    for (const target of workers) {
        const result = await new Promise<string>((resolve) => {
            target.worker.once("message", (msg) => resolve(msg));
            target.worker.postMessage({ action: "getCode", game: game });
        });

        console.log("DEBUG: test");
        console.log("DEBUG: result = ", result);
        if (result != "null") {
            target.players.push(game.user_id);
            const token = generateRandomToken(32);
            clientToken.set(game.user_id, token);
            return (reply.status(202).send({token}));
        }
    }
    return (reply.status(501).send({ error: "Game is full" }));
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

        if (game.code == null) {
            return (gameCreate(game, reply));
        } else {
            return (gameJoin(game, reply));
        }
    });
}