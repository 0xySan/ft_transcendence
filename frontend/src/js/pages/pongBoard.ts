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

    let equip_a = 0;
    let equip_b = 0;


    /* ------------------------ WEBSOCKET EVENTS ------------------------ */

    ws.addEventListener("open", () => {
        console.log("Connected to WebSocket server.");
    });

    ws.addEventListener("message", (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.action === "send" && data.ball) {
                updateBallPosition(data.ball.pos_x, data.ball.pos_y);
                updateName(data.equip_a.player_1, data.equip_a.player_2, data.equip_b.player_3, data.equip_b.player_4);
                equip_a = Object.keys(data.equip_a).length;
                equip_b = Object.keys(data.equip_b).length;
            }
        } catch {
            return;
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

    function updateName(player_1: string, player_2: string, player_3: string, player_4: string) {
        const u1 = document.getElementById("username-1");
        const u2 = document.getElementById("username-2");
        const u3 = document.getElementById("username-3");
        const u4 = document.getElementById("username-4");



        if (u1) u1.textContent = player_1 || "No Player";
        if (u2) u2.textContent = player_2 || "No Player";
        if (u3) u3.textContent = player_3 || "No Player";
        if (u4) u4.textContent = player_4 || "No Player";
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
        if (equip_a > 0) ctx.fillRect(player1.x, player1.y, paddleWidth, paddleHeight);

        // ---- Paddle 4 ----
        if (equip_a == 2) ctx.fillRect(player3.x, player3.y, paddleWidth, paddleHeight);

        // ---- Paddle 2 ----
        ctx.fillStyle = "blue";
        if (equip_b > 0) ctx.fillRect(player2.x, player2.y, paddleWidth, paddleHeight);

        // ---- Paddle 3 ----
        if (equip_b == 2) ctx.fillRect(player4.x, player4.y, paddleWidth, paddleHeight);

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
