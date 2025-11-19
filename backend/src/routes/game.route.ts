/**
 * @file socket.ts
 * @description TODO met un nom
 */

import { FastifyInstance } from "fastify";
import { generateRandomToken } from '../utils/crypto.js';
import { sv_game } from '../sockets/interfaces/interfaces.type.js';
import { Position, Games } from '../sockets/games.classe.js';

const games: Games[] = [];

export async function gameRoutes(fastify: FastifyInstance) {

    fastify.get("/game", async (request, reply) => {
        return (reply.status(202).send({token: generateRandomToken(32)}));
    });

    fastify.post("/game", async (request, reply) => {
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

        games.push(new Games(
            game.position_paddle,
            game.score,
            game.position_ball,
            game.velocity_ball,
            game.end_game,
            generateRandomToken(32),
            game.code
        ));

        return (reply.status(202).send({token: generateRandomToken(32), game: game}));
    });
}