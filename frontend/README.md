# Frontend for ft_transcendence

## Table of Contents

1. [Overview](#overview)
2. [Technologies Used](#technologies-used)
3. [Project Structure](#project-structure)
4. [File Descriptions](#file-descriptions)
5. [Setup and Run](#setup-and-run)

## Overview
This frontend handles dynamic page loading via AJAX, serves static resources (CSS/JS/images/audio), and styles the UI using TailwindCSS. The server is based on Fastify and injects page content into [`index.html`](./public/index.html).

## Technologies Used

- **Node.js** — runtime.

- **Fastify** — HTTP server.

- **TypeScript** — typed client-side JS.

- **TailwindCSS** — utility-first CSS.

```
Browser
   │
   ▼
dynamicLoader.ts -> injects page content & executes scripts
dupChecker.ts   -> forces full reload when needed
   │
   ▼
Fastify server (server.js)
   ├─ Serves static HTML (/public/pages)
   ├─ Serves compiled JS (/dist/js)
   └─ Serves CSS (/dist/style.css)
   │
   ▼
Browser renders content dynamically without full page reload
```

## Project Structure

```
frontend
├── Dockerfile
├── package.json
├── package-lock.json
├── public
│   ├── index.html
│   ├── pages
│   │   ├── home.html
│   │   ├── register.html
│   │   └── users.html
│   └── ressources
│       ├── audio
│       └── images
├── server.js
├── src
│   ├── input.css
│   └── js
│       ├── dupChecker.ts
│       └── dynamicLoader.ts
├── tailwind.config.js
└── tsconfig.json
```

## File Descriptions

- [**Dockerfile**](./Dockerfile) — image build/run instructions.

- [**package.json**](./package.json) — build (build / build:css) and start (start) scripts, dependencies.

- [**index.html**](./public/index.html) — main template containing `<div id="content"></div>`.

- [**pages/**](./public/pages/) — partial HTML pages (injected into index.html).

- [**ressources/**](./public/ressources/) — images/audio (served under /resources/).

- [**server.js**](./server.js) — Fastify server: serves assets, injects page fragments, handles AJAX requests.

- [**input.css**](./src/input.css) — TailwindCSS input file (compiled to dist/style.css).

- [**dynamicLoader.ts**](./src/js/dynamicLoader.ts) — intercepts links and forms, fetches AJAX pages, injects HTML, executes scripts.

- [**dupChecker.ts**](./src/js/dupChecker.ts) — ensures full reload if a page was dynamically loaded or duplicated.

- [**tailwind.config.js**](./tailwind.config.js) — Tailwind content paths, theme configuration.

- [**tsconfig.json**](./tsconfig.json) — TypeScript configuration.

## Setup and Run

### Docker:
```
docker build -t frontend .
docker run -p 8080:8080 frontend
```

### Local
```
npm install
npm run build
npm run start
```

Open `http://localhost:8080`.
