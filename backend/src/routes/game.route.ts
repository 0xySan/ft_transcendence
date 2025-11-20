/**
 * @file socket.ts
 * @description TODO met un nom
 */

import { FastifyInstance } from "fastify";
import { generateRandomToken } from '../utils/crypto.js';
import { sv_game } from '../sockets/interfaces/interfaces.type.js';
import { Games } from '../sockets/games.classe.js';
import { workers } from '../server.js';

export const games: Games[] = [];

export async function gameRoutes(fastify: FastifyInstance) {

    fastify.get("/api/game", async (request, reply) => {
        return (reply.status(202).send({token: generateRandomToken(32)}));
    });

    fastify.post("/api/game", async (request, reply) => {

        if (games.length >= 8) {
            return (reply.status(501).send({ error: "server is full" }));
        }

        const game = request.body as sv_game;

        if (game.position_paddle == null) {
            game.position_paddle = {
                "player_1": {
                    pos_x: 100,
                    pos_y: 0
                },
                "player_2": {
                    pos_x: 1000,
                    pos_y: 0
                }
            };
        }

        if (game.position_ball == null) {
            game.position_ball = {
                pos_x: 0,
                pos_y: 0
            };
        }

        if (game.score == null) {
            game.score = {
                "player_1": 0,
                "player_2": 0
            };
        }

        if (game.velocity_ball == null) {
            game.velocity_ball = {
                pos_x: 3,
                pos_y: 3
            };
        }

        if (game.end_game == null) {
            game.end_game = 3600;
        }

        if (game.code == null) {
            game.code = generateRandomToken(2);
        }

        const new_game = new Games(
            game.position_paddle,
            game.score,
            game.position_ball,
            game.velocity_ball,
            game.end_game,
            generateRandomToken(32),
            game.code
        )

        games.push(new_game);

        const game_data = {
            position_paddle: new_game.position_paddle,
            score: new_game.score,
            position_ball: new_game.position_ball,
            velocity_ball: new_game.velocity_ball,
            end_game: new_game.end_game,
            uuid: new_game.uuid,
            code: new_game.code,
        };

        console.log("DEBUG: nombre de partie: " + games.length);

        for (let i = 0; i < workers.length; i++) {
            const worker = workers[i];

            const state = await new Promise<boolean>((resolve) => {
                worker.once("message", (msg) => resolve(msg));
                worker.postMessage("getState");
            });

            if (state === false) {
                worker.postMessage({ state: "changeState", game: game_data });
                return (reply.status(202).send({ token: generateRandomToken(32), game: game }));
            }
        }

        return (reply.status(202).send({token: generateRandomToken(32), game: game}));
    });
}