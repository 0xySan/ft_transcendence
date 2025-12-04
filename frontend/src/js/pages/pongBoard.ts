export {};

declare function addListener(target: EventTarget | null, event: string, handler: EventListenerOrEventListenerObject): void;
// declare function translatePage(language: string): void;
// declare function translateElement(language: string, element: HTMLElement): void;
// declare function getUserLang(): string;

console.log("DEBUG: WELCOME !");



try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const user_id = params.get("user_id");

    const ws = new WebSocket(`ws://localhost:8080/ws/?user_id=${user_id}&token=${token}`);

    const ballEl = document.getElementById("ball") as HTMLDivElement;

    ws.addEventListener('open', () => {
        console.log('Connected to WebSocket server.');
    });

    ws.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);

        if (data.action === "send" && data.ball) {
            updateBallPosition(data.ball.pos_x, data.ball.pos_y);
        }
    });

    ws.addEventListener('close', () => {
        console.log('Disconnected from server.');
    });

    ws.addEventListener('error', (err) => {
        console.error('WebSocket error:', err);
    });

    setInterval(game, 200);

    function game() {
        ws.send("CLIENT: ping");
    }

    function updateBallPosition(x: number, y: number) {
        ballEl.style.left = x + "px";
        ballEl.style.top = y + "px";
    }

    function sendPaddleMove(side: string, newTop: number) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        ws.send(JSON.stringify({
            action: "move",
            side,      // "left" ou "right"
            position: newTop
        }));
    }

    /* ---------------- CONTROLES DES PADDLES ---------------- */

    document.addEventListener("keydown", (e) => {
        const leftPaddle = document.querySelector('#player1') as HTMLElement;
        if (!leftPaddle) throw new Error("player1-id introuvable");
        const rightPaddle = document.querySelector('#player2') as HTMLElement;
        if (!rightPaddle) throw new Error("player2-id introuvable");

        const speed = 15; // vitesse du déplacement

        // Position actuelle
        const leftTop = parseInt(window.getComputedStyle(leftPaddle).top);
        const rightTop = parseInt(window.getComputedStyle(rightPaddle).top);

        switch (e.key) {
            case "w": // monter le paddle gauche
                leftPaddle.style.top = Math.max(leftTop - speed, 0) + "px";
                sendPaddleMove("left", leftTop - speed);
                break;

            case "s": // descendre le paddle gauche
                leftPaddle.style.top = Math.min(leftTop + speed, 520) + "px";
                sendPaddleMove("left", leftTop + speed);
                break;

            case "ArrowUp": // monter le paddle droit
                rightPaddle.style.top = Math.max(rightTop - speed, 0) + "px";
                sendPaddleMove("right", rightTop - speed);
                break;

            case "ArrowDown": // descendre le paddle droit
                rightPaddle.style.top = Math.min(rightTop + speed, 520) + "px";
                sendPaddleMove("right", rightTop + speed);
                break;
        }
    });

} catch (err) {
    console.error("Erreur :", err);
}
