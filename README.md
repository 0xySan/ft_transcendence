# 🕹️ ft_transcendence – Web-Based Pong & Tetris Experience 🚀

**ft_transcendence** is a full-stack web application developed as part of the **42 cursus**.
It brings together **retro gaming (Pong & Tetris)** with modern web technologies — enabling players to compete, chat, and challenge each other in real-time, directly in the browser.

Built entirely from scratch with a focus on **clean architecture**, **security**, and **scalability**, this project goes beyond gameplay to explore authentication, WebSockets, REST APIs, and responsive design.

---

## 📚 Table of Contents

1. [Tech Stack](#%EF%B8%8F-tech-stack)
2. [Project Structure](#-project-structure)
3. [Installation & Setup](#%EF%B8%8F-installation--setup)

   * [Backend Setup](#2-backend-setup)
   * [Frontend Setup](#3-frontend-setup)
   * [Run with Docker](#4-run-with-docker)
4. [API Documentation](#-api-documentation)

   * [Tool](#tool)
   * [Sample Endpoint](#sample-endpoint)
5. [Contributing](#-contributing)
6. [Design Assets](#-design-assets)
7. [License](#-license)

---

## 🛠️ Tech Stack

### Frontend

* **TypeScript**
* **Fastify** – with fastify-static
* **Html and CSS**

### Backend

* **Fastify** – high-performance Node.js framework
* **SQLite** – lightweight SQL database (auto-initialized) using **better-sqlite3** for synchronous access
* **WebSockets** – real-time multiplayer & chat

### DevOps / Observability

* **Docker / Docker Compose** – full-stack orchestration
* **Vitest** – testing framework
* **Redis** – in-memory data store for caching and real-time features
* **Nginx** – reverse proxy
* **GitHub Actions** – automated CI/CD workflows

---

## 📁 Project Structure

```plaintext
.
├── backend/          # Fastify server, SQLite DB, API routes, WebSocket logic
│   ├── src/          # Source code (auth, db, routes, server utils)
│   ├── sql/          # Init & schema SQL files
│   ├── tests/        # Vitest test suites
│   ├── Dockerfile
│   └── README.md
├── frontend/         # Frontend app with Tailwind, TypeScript, BabylonJS
│   ├── public/       # Static assets (HTML, images)
│   ├── src/          # TS and CSS source files
│   ├── Dockerfile
│   └── README.md
├── nginx/            # Nginx reverse proxy config
├── docker-compose.yml
├── LICENSE
└── README.md         # You are here!
```

---

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/0xySan/ft_transcendence.git
cd ft_transcendence
```

---

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run build
npm run start
```

* Runs by default at: **[http://localhost:3000](http://localhost:3000)**
* Uses SQLite (auto-initialized using `init.sql`)
* Logs API and WebSocket events to console
* Test using:

  ```bash
  npm run test
  ```

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run build
npm run start
```

* Runs by default at: **[http://localhost:8080](http://localhost:8080)**
* Tailwind is preconfigured
* Backend API endpoint can be set in `.env`

---

### 4. Run with Docker

To run the full stack (frontend + backend + nginx):

```bash
docker-compose up --build
```

This will:

* Build and start both services
* Initialize SQLite
* Expose the app at **[http://localhost:8080](http://localhost:8080)**

---

## 📘 API Documentation

### Tool

API documentation is powered by **Swagger (OpenAPI)** and lives under `/api/docs` when running locally.

Future endpoints will follow OpenAPI 3.1 format and can be automatically generated using `fastify-swagger`.

#### Example initialization (in `backend/src/plugins/swagger.ts`):

```ts
fastify.register(import('@fastify/swagger'), {
  openapi: {
    info: {
      title: 'ft_transcendence API',
      version: '1.0.0',
      description: 'API documentation for ft_transcendence project'
    },
  },
});
```

---

### Sample Endpoint

#### **GET /api/users/:id**

**Description:**
Fetches public information about a user by their ID.

**Request**

```http
GET /api/users/1
Accept: application/json
```

**Response (200 OK)**

```json
{
  "id": 1,
  "username": "playerOne",
  "avatar": "/avatars/playerOne.png",
  "wins": 12,
  "losses": 8
}
```

**Error Response (404 Not Found)**

```json
{
  "error": "User not found"
}
```

---

## 🎨 Design Assets

Figma layout and component guides are available here:
👉 [Figma – ft_transcendence UI/UX](https://www.figma.com/file/)

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.
See [LICENSE](https://github.com/0xySan/ft_transcendence/blob/main/LICENSE) for details.
