import { describe, it, expect, afterEach } from "vitest";
import { Worker } from 'worker_threads';
import path from "path";

let worker: Worker;

afterEach(async () => {
  if (worker) {
    await worker.terminate();
  }
});

describe("gamesLogic Worker", () => {
  it("should create a game and return the correct number of parties", async () => {
    const workerPath = path.resolve(__dirname, "../../dist/game/gamesLogic.js");
    
    worker = new Worker(workerPath);

    // Helper pour recevoir un message du worker
    const sendMessage = (msg: any) =>
      new Promise((resolve) => {
        worker.once("message", (data) => resolve(data));
        worker.postMessage(msg);
      });

    // Vérifie qu'il n'y a aucune partie au départ
    let count = await sendMessage({ action: "getNumberParties" });
    expect(count).toBe(0);

    // Crée un jeu
    await sendMessage({
      action: "createGame",
      game: { user_id: 1, uuid: "abc123", code: "XYZ" }
    });

    // Vérifie qu'il y a maintenant une partie
    count = await sendMessage({ action: "getNumberParties" });
    expect(count).toBe(1);

    // Crée un deuxième jeu
    await sendMessage({
      action: "createGame",
      game: { user_id: 2, uuid: "def456", code: "ABC" }
    });

    // Vérifie qu'il y a deux parties
    count = await sendMessage({ action: "getNumberParties" });
    expect(count).toBe(2);
  });
});
