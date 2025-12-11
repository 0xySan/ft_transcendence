declare global {
	interface Window {
		socket: WebSocket;
	}
}

declare function loadPage(url:string) : void;
declare function addListener(target: EventTarget | null, event: string, handler: any): void;

export {};
try {
	const canvas = document.getElementById("pong-board") as HTMLCanvasElement;
	const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

	const paddleWidth = 10;
	const paddleHeight = 80;

	const start_game = Date.now();

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

	let socketConnection = window.socket;

	if (!socketConnection) {
		const response = await fetch("/api/game", {
			method: "GET",
		});

		const data = await response.json();
		if (data["error"]) {
			document.getElementById('content')!.innerHTML = "ERROR: CONNECTION NOT ESTABLISHED";
			throw new Error("WebSocket connection not found, please use the lobby page to access this page.");
		}

		const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const socketUrl = wsProtocol + "//" + window.location.host + "/ws/?token=" + data.token;

		window.socket = new WebSocket(socketUrl);
		socketConnection = window.socket;
		console.log("Socket ouvert !");

		// redirectUser()
	}

	addListener(socketConnection, "message", (event: MessageEvent) => {
		try {
			const data = JSON.parse(event.data);

			if (data.action === "send" && data.ball) {
				updateBallPosition(data.ball.pos_x, data.ball.pos_y);
				updateName(data.equip_a.player_1, data.equip_a.player_2, data.equip_b.player_1, data.equip_b.player_2);
                updateScore(data.score_b, data.score_a);
				equip_a = Object.keys(data.equip_a).length;
				equip_b = Object.keys(data.equip_b).length;
			}
			console.log("DEBUG: json = ", data);
		} catch {
			return;
		}
	});

	addListener(socketConnection, "close", () => {
		console.log("Pong-board: Disconnected from server.");
	});

	addListener(socketConnection, "error", (err: Event) => {
		console.error("Pong-board: WebSocket error:", err);
	});

	// Ping server occasionally
	setInterval(() => {
		socketConnection.send(JSON.stringify({ action: "ping", message: "CLIENT" }));
	}, 200);


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
		if (u2) u2.textContent = player_3 || "No Player";
		if (u3) u3.textContent = player_2 || "No Player";
		if (u4) u4.textContent = player_4 || "No Player";
	}


    function updateScore(score_a: string, score_b: string) {
        const sc_a = document.getElementById("left-score");
        const sc_b = document.getElementById("right-score");
        if (sc_a) sc_a.textContent = score_a || "0";
        if (sc_b) sc_b.textContent = score_b || "0";
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

	function sendPaddleMove(side: string, newPosition: number) {
		if (!socketConnection || socketConnection.readyState !== WebSocket.OPEN) {
			console.log("socketConnection not open, skipping send");
			return;
		}

		const payload = {
			action: "move",
			position: newPosition
		};

		console.log("Sending socketConnection message:", payload);
		socketConnection.send(JSON.stringify(payload));
	}

	/* ---------------- CONTROLES DES PADDLES ---------------- */

	document.addEventListener("keydown", (e) => {
		const leftPaddle = document.querySelector('#player1') as HTMLElement;
		if (!leftPaddle) throw new Error("player1-id not found");
		const rightPaddle = document.querySelector('#player2') as HTMLElement;
		if (!rightPaddle) throw new Error("player2-id not found");

		const speed = 15;

		// Actualy position
		const leftTop = parseInt(window.getComputedStyle(leftPaddle).top);
		const rightTop = parseInt(window.getComputedStyle(rightPaddle).top);

		switch (e.key) {
			case "w": // up paddle left
				leftPaddle.style.top = Math.max(leftTop - speed, 0) + "px";
				// sendPaddleMove("left", leftTop - speed);
				break;

			case "s": // down paddle left
				leftPaddle.style.top = Math.min(leftTop + speed, 520) + "px";
				// sendPaddleMove("left", leftTop + speed);
				break;

			case "ArrowUp": // up paddle right
				rightPaddle.style.top = Math.max(rightTop - speed, 0) + "px";
				// sendPaddleMove("right", rightTop - speed);
				break;

			case "ArrowDown": // down paddle rught
				rightPaddle.style.top = Math.min(rightTop + speed, 520) + "px";
				// sendPaddleMove("right", rightTop + speed);
				break;
		}
	});

} catch (err) {
	console.error("Erreur :", err);
}
