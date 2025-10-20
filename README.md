# 🕹️ ft_transcendence – Web-Based Pong & Tetris Experience 🚀

ft_transcendence is a full-stack web application developed as part of the 42 cursus.
It brings together classic retro gaming (Pong & Tetris) with modern web technologies, allowing players to compete, chat, and challenge each other in real time — all inside the browser.

Built from scratch with a focus on clean architecture, security, and scalability, this project goes beyond simple gameplay to explore authentication, WebSockets, REST APIs, and responsive design.

---


## 🛠️ Tech Stack

### Frontend
- **TypeScript**
- **Tailwind CSS**

### Backend
- **Fastify** – high-performance Node.js framework
- **SQLite** – lightweight SQL database
- **WebSockets** – for real-time multiplayer sync
- **OAuth2** – external login providers (42, GitHub, etc.)

### DevOps / Observability
- **Docker / Docker Compose**
- **Vitest** – testing framework

---

## 📁 Project Structure

```plaintext
.
├── backend/          # Fastify server, SQLite DB, API routes, WebSocket logic
│   ├── src/          # Source code (auth, db, routes, server utils)
│   ├── sql/          # Init & schema SQL files
│   ├── tests/        # Vitest test suites
│   └── Dockerfile
├── frontend/         # Frontend with Tailwind, TypeScript, BabylonJS
│   ├── public/       # Static assets (HTML, images)
│   ├── src/          # TS and CSS source files
│   └── Dockerfile
├── nginx/            # Reverse proxy config
├── docker-compose.yml
├── LICENSE
└── README.md
```

---

## ⚙️ Installation

### 1. Clone the repository
```bash
git clone https://github.com/0xySan/ft_transcendence.git
cd ft_transcendence
```
### 2. Backend setup
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
- Uses SQLite by default. DB is auto-initialized using init.sql
### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
```
- Tailwind is already configured
---
## ▶️ Running Everything with Docker

You can use```docker-compose``` for full stack orchestration:
```bash
docker-compose up --build
```
---

## 🤝 Contributing

### We welcome contributions! Here’s how to get started:
1. Fork the repository
2. Create a feature branch: git checkout -b feature/your-feature-name
3. Commit your changes: git commit -m 'Add your feature'
4. Push to your branch: git push origin feature/your-feature-name
5. Open a pull request

### Coding Guidelines
- Use TypeScript consistently across frontend and backend
- Commit messages should follow conventional commits (feat:, fix:, chore:, etc.)

---

## 🎨 Design Assets

- [Figma – UI/UX, Component Layouts](https://www.figma.com/file/)

---

# 📄 License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0)
<br>
See [LICENSE](https://github.com/0xySan/ft_transcendence/blob/main/LICENSE) for details.
