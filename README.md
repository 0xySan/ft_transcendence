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
├── .github/            # GitHub workflows and CI/CD configurations
├── backend/            # Fastify server, SQLite DB, API routes, WebSocket logic
│   ├── src/            # Source code (auth, db, routes, server utils)
│   │  ├── db/
│   │  │  ├── index.ts
│   │  │  ├── seeders/
│   │  │  └── wrappers/
│   │  └── server.ts
│   ├── sql/            # Init & schema SQL files
│   ├── tests/          # Vitest test suites
│   ├── dist/           # Compiled backend JS (runtime) (ignored in Git)
│   ├── data/           # Runtime data (e.g., SQLite files, user uploads) (ignored in Git)
│   ├── node_modules/   # Installed dependencies (ignored in Git)
│   ├── coverage/       # Test coverage reports (ignored in Git)
│   ├── .env            # Environment variables
│   └── Dockerfile
├── frontend/           # Frontend app with TypeScript, Fastify, HTML and CSS
│   ├── public/         # Static assets (HTML, images)
│   │  ├── index.html
│   │  ├── pages/       # HTML pages other than default (index.html)
│   │  └── resources/   # Ressources to get imgs, etc... eg: bzh.svg
│   ├── src/            # TS and CSS source files
│   │  ├── input.css
│   │  └── js/
│   └── Dockerfile
├── nginx/              # Nginx reverse proxy config
├── docker-compose.yml
├── LICENSE
├── CONTRIBUTING.md
└── README.md           # You are here!
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

# Edit .env to fill in the values for your environment:
``
# Encryption & cookies
ENCRYPTION_KEY=your_random_encryption_key
COOKIE_SECRET=your_random_cookie_secret

# Email settings (for notifications, etc.)
MAIL_DOMAIN=your_mail_domain.com

# Google OAuth2
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration

# 42 OAuth2
42_CLIENT_ID=your_42_client_id
42_CLIENT_SECRET=your_42_client_secret
42_DISCOVERY_URL=https://api.intra.42.fr/oauth/token

# GitHub OAuth2
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_DISCOVERY_URL=https://github.com/login/oauth/access_token
``

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
