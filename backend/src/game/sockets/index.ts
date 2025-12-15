/**
 * @file index.ts
 * @description This file sets up the WebSocket server for game communication.
 */

import { WebSocketServer } from "ws";
import { parseMessage } from "./utils/parseMessage.js";
import { handleConnectMessage } from "./handlers/connect.js";
import * as msg from "../sockets/socket.types.js";
import { addOrRemovePlayerGameWorker } from "../workers/init.js";

export function setupWebSocketServer(wss: WebSocketServer) {
	wss.on("connection", (wsRaw, req) => {
		const ws = wsRaw as msg.gameSocket;
		// Set a timeout to ensure the client sends a token within 10 seconds
		const tokenTimeout = setTimeout(() => {
			ws.send(JSON.stringify({ type: "error", payload: "Token not provided in time" }));
			ws.close();
		}, 10000);

		const cleanTimeout = () => { clearTimeout(tokenTimeout); };

		ws.on("message", raw => {
			const msg = parseMessage(raw.toString());
			if (!msg) return;

			switch (msg.type) {
				case "connect":
					handleConnectMessage(ws, req, msg.payload as msg.connectPayload, cleanTimeout); // We pass cleanTimeout to clear on success
					break;
				case "game":

			}
		});

		ws.on("close", () => {
			clearTimeout(tokenTimeout); // clean up on close
			addOrRemovePlayerGameWorker(ws.id, "", "leave");
		});
	});
}

