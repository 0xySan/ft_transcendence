export {};

declare function addListener(
    target: EventTarget | null, 
    event: string, 
    handler: EventListenerOrEventListenerObject
): void;

try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const user_id = params.get("user_id");

    const ws = new WebSocket(`ws://localhost:8080/ws/?user_id=${user_id}&token=${token}`);

    const canvas = document.getElementById("pong-board") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    const paddleWidth = 10;
    const paddleHeight = 80;

    let ball = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        size: 10,
        targetX: canvas.width / 2,
        targetY: canvas.height / 2
    };

    let player1 = { x: 20, y: canvas.height / 2 - paddleHeight / 2 + 50 };
    let player2 = { x: canvas.width - 30, y: canvas.height / 2 - paddleHeight / 2 + 50 };
    let player3 = { x: 20, y: canvas.height / 2 - paddleHeight / 2 - 50 };
    let player4 = { x: canvas.width - 30, y: canvas.height / 2 - paddleHeight / 2 - 50 };


    /* ------------------------ WEBSOCKET EVENTS ------------------------ */

    ws.addEventListener("open", () => {
        console.log("Connected to WebSocket server.");
    });

    ws.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);

        if (data.action === "send" && data.ball) {
            updateBallPosition(data.ball.pos_x, data.ball.pos_y);
        }
    });

    ws.addEventListener("close", () => {
        console.log("Disconnected from server.");
    });

    ws.addEventListener("error", (err) => {
        console.error("WebSocket error:", err);
    });

    // Ping server occasionally
    setInterval(() => ws.send("CLIENT: ping"), 200);

    /* ------------------------ GAME LOGIC ------------------------ */

    function updateBallPosition(x: number, y: number) {
        ball.targetX = x;
        ball.targetY = y;
    }

    function animate() {
        const smooth = 0.2;

        ball.x += (ball.targetX - ball.x) * smooth;
        ball.y += (ball.targetY - ball.y) * smooth;

        draw();
        requestAnimationFrame(animate);
    }

    animate();

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // ---- Middle dashed line ----
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // ---- Paddle 1 ----
        ctx.fillStyle = "red";
        ctx.fillRect(player1.x, player1.y, paddleWidth, paddleHeight);

        // ---- Paddle 4 ----
        ctx.fillRect(player3.x, player3.y, paddleWidth, paddleHeight);

        // ---- Paddle 2 ----
        ctx.fillStyle = "blue";
        ctx.fillRect(player2.x, player2.y, paddleWidth, paddleHeight);

        // ---- Paddle 3 ----
        ctx.fillRect(player4.x, player4.y, paddleWidth, paddleHeight);

        // ---- Ball ----
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
        ctx.fill();
    }

    draw();

} catch (err) {
    console.error("Erreur :", err);
}
