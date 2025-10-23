// server.js
import Fastify from "fastify";
import path from "path";
import fs from "fs";
import fastifyStatic from "@fastify/static";

const app = Fastify({ logger: true });

// --- Base paths ---
const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const distDir = path.join(rootDir, "dist");
const jsDir = path.join(distDir, "js");
const publicPagesDir = path.join(publicDir, "pages");
const publicResourcesDir = path.join(publicDir, "resources");
const cssDir = path.join(publicResourcesDir, "css");
/*
  2) Serve all compiled JavaScript files from dist/js under /js/
	 Example:
	 - dist/js/main.js → /js/main.js
*/
if (fs.existsSync(jsDir)) {
	app.register(fastifyStatic, {
		root: jsDir,
		prefix: "/js/",
		decorateReply: false
	});
}

/*
  3) Serve dedicated resources (images, audio, etc.) under /resources/
	 Examples:
	 - public/resources/images/logo.png → /resources/images/logo.png
	 - public/resources/audio/song.mp3  → /resources/audio/song.mp3
*/
if (fs.existsSync(publicResourcesDir)) {
	app.register(fastifyStatic, {
		root: publicResourcesDir,
		prefix: "/resources/",
		decorateReply: false
	});
}

/*
  4) Dedicated route for /style.css (generated in dist/style.css)
*/
app.get("/style.css", async (req, reply) => {
	const cssFile = path.join(cssDir, "style.css");
	if (!fs.existsSync(cssFile)) {
		return reply.status(404).send("style.css not found");
	}
	reply.type("text/css").send(fs.readFileSync(cssFile, "utf8"));
});

/*
  5) Catch-all route for HTML pages
	 Behavior:
	 - If the request is AJAX (x-requested-with=XMLHttpRequest OR x-dynamic=1),
	   return only the page content (from public/pages/*.html).
	 - Otherwise:
	   → Load index.html from public/
	   → Replace <div id="content"></div> with the requested page content
	   → Inject style.css and dist/js scripts
*/
app.get("/*", async (req, reply) => {
	const urlPath = (req.params && req.params["*"]) ? req.params["*"] : "";
	const rawUrl = req.raw.url || "";

	// Skip if the URL points to static assets (handled by fastify-static)
	if (
		rawUrl.startsWith("/js/") ||
		rawUrl === "/style.css" ||
		rawUrl.startsWith("/resources/")
	) {
		return reply.callNotFound();
	}

	// Determine which page to load (default: home)
	let pageName = urlPath || "home";
	if (pageName === "" || pageName === "/" || pageName === "index") pageName = "home";

	// Security: prevent path traversal
	if (pageName.includes("..")) {
		return reply.status(400).send("Bad request");
	}

	// Check if the page file exists
	const pageFile = path.join(publicPagesDir, `${pageName}.html`);
	if (!fs.existsSync(pageFile)) {
		return reply.status(404).send("Page not found");
	}

	const isAjax =
		req.headers["x-requested-with"] === "XMLHttpRequest" ||
		req.headers["x-dynamic"] === "1";

	const contentHtml = fs.readFileSync(pageFile, "utf8");

	if (isAjax) {
		// --- Dynamic request: return only the page content ---
		let html = contentHtml;

		// Read the dupChecker.js content and inject it as an inline script
		const dupCheckerPath = path.join(jsDir, "dupChecker.js");
		if (fs.existsSync(dupCheckerPath)) {
			const dupCheckerScript = fs.readFileSync(dupCheckerPath, "utf8");
			html += `\n<script type="module">\n${dupCheckerScript}\n</script>`;
		}

		reply.type("text/html").send(html);
	} else {
		// --- Full page request: load index.html and inject content ---
		const indexFile = path.join(publicDir, "index.html");
		if (!fs.existsSync(indexFile)) {
			return reply.status(500).send("index.html missing");
		}

		let indexHtml = fs.readFileSync(indexFile, "utf8");

		// Replace placeholder <div id="content"></div>
		const contentDivRegex = /(<div\s+id=["']content["'][^>]*>)(.*?)(<\/div>)/s;

		if (contentDivRegex.test(indexHtml)) {
			indexHtml = indexHtml.replace(
				contentDivRegex,
				`$1${contentHtml}$3` // $1 = ouverture de div, $3 = fermeture
			);
		} else {
			// If placeholder not found, inject before </body>
			indexHtml = indexHtml.replace(
				"</body>",
				`<div id="content">${contentHtml}</div>\n</body>`
			);
		}

		// Inject style.css if present
		if (fs.existsSync(path.join(distDir, "style.css"))) {
			if (!indexHtml.includes('href="/style.css"')) {
				indexHtml = indexHtml.replace(
					"</head>",
					`<link rel="stylesheet" href="/style.css">\n</head>`
				);
			}
		}

		reply.type("text/html").send(indexHtml);
	}
});

// --- Start the server ---
await app.listen({ port: 8080, host: "0.0.0.0" });
console.log("Frontend server running on http://localhost:8080");
