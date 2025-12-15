/**
 * @file index.ts
 * @description This file exports all handlers for WebSocket messages.
 */

export { parseConnectPayload, handleConnectMessage } from "./connect.js";
export { parseInputPayload, handleInputMessage } from "./inputs.js";
export { parseGamePayload, handleGameMessage } from "./startGame.js";