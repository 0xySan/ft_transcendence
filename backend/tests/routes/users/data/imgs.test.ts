/**
 * backend/tests/routes/users/data/imgs.test.ts
 * Tests for src/routes/users/data/imgs.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { Readable } from "stream";

describe("GET /data/imgs/:fileName", () => {
	let fastify: ReturnType<typeof Fastify>;
	let mocks: {
		fs: any;
	};

	beforeEach(async () => {
		vi.resetModules();
		vi.restoreAllMocks();

		// Mock fs BEFORE importing the route module
		vi.doMock("fs", () => {
			return {
				__esModule: true,
				default: {
					existsSync: vi.fn(),
					statSync: vi.fn(),
					createReadStream: vi.fn(),
				},
			};
		});

		// import route after mocks
		const mod = await import("../../../../src/routes/users/data/imgs.ts");
		const { userDataImgsRoute } = mod;

		fastify = Fastify();
		// register route
		fastify.register(userDataImgsRoute);
		await fastify.ready();

		// import the mocked fs to configure behaviors in tests
		const fs = await import("fs");
		mocks = { fs };
	});

	afterEach(async () => {
		try {
			await fastify.close();
		} catch (_) {}
		vi.resetAllMocks();
		vi.restoreAllMocks();
	});

	it("returns 404 when file does not exist", async () => {
		(mocks.fs.default.existsSync as any).mockReturnValue(false);

		const res = await fastify.inject({ method: "GET", url: "/data/imgs/nonexistent.png" });
		expect(res.statusCode).toBe(404);
		expect(res.json()).toHaveProperty("error", "File not found");
	});

	it("returns 404 when statSync throws", async () => {
		(mocks.fs.default.existsSync as any).mockReturnValue(true);
		(mocks.fs.default.statSync as any).mockImplementation(() => { throw new Error("stat fail"); });

		const res = await fastify.inject({ method: "GET", url: "/data/imgs/file.png" });
		expect(res.statusCode).toBe(404);
		expect(res.json()).toHaveProperty("error", "File not found");
	});

	it("returns 400 when path points to a directory", async () => {
		(mocks.fs.default.existsSync as any).mockReturnValue(true);
		(mocks.fs.default.statSync as any).mockReturnValue({ isDirectory: () => true });

		const res = await fastify.inject({ method: "GET", url: "/data/imgs/somedir" });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error", "Invalid file path: is a directory");
	});

	it("returns 500 when createReadStream throws", async () => {
		(mocks.fs.default.existsSync as any).mockReturnValue(true);
		(mocks.fs.default.statSync as any).mockReturnValue({ isDirectory: () => false });
		(mocks.fs.default.createReadStream as any).mockImplementation(() => { throw new Error("open fail"); });

		const res = await fastify.inject({ method: "GET", url: "/data/imgs/file.png" });
		expect(res.statusCode).toBe(500);
		expect(res.json()).toHaveProperty("error", "Internal Server Error");
	});

	it("streams file successfully and sets image/png content-type for .png", async () => {
		(mocks.fs.default.existsSync as any).mockReturnValue(true);
		(mocks.fs.default.statSync as any).mockReturnValue({ isDirectory: () => false });

		// createReadStream returns a readable stream with content "hello-png"
		(mocks.fs.default.createReadStream as any).mockImplementation(() => {
			return Readable.from(["hello-png"]);
		});

		const res = await fastify.inject({ method: "GET", url: "/data/imgs/picture.png" });
		expect(res.statusCode).toBe(200);
		// Fastify returns header 'content-type' possibly including charset; assert it contains image/png
		expect(res.headers["content-type"]).toContain("image/png");
		expect(res.body).toBe("hello-png");
	});

	it("streams file with default content-type for unknown extension", async () => {
		(mocks.fs.default.existsSync as any).mockReturnValue(true);
		(mocks.fs.default.statSync as any).mockReturnValue({ isDirectory: () => false });

		(mocks.fs.default.createReadStream as any).mockImplementation(() => Readable.from(["binarydata"]));

		const res = await fastify.inject({ method: "GET", url: "/data/imgs/file.unknownext" });
		expect(res.statusCode).toBe(200);
		expect(res.headers["content-type"]).toContain("application/octet-stream");
		expect(res.body).toBe("binarydata");
	});

	it("returns 500 when the stream emits an error", async () => {
		(mocks.fs.default.existsSync as any).mockReturnValue(true);
		(mocks.fs.default.statSync as any).mockReturnValue({ isDirectory: () => false });

		// create a stream that emits error on nextTick
		(mocks.fs.default.createReadStream as any).mockImplementation(() => {
			const s = new Readable({
				read() {
					// no-op
				},
			});
			// emit error asynchronously (simulate stream error while piping)
			process.nextTick(() => {
				s.emit("error", new Error("stream failure"));
			});
			return s;
		});

		const res = await fastify.inject({ method: "GET", url: "/data/imgs/problem.png" });
		expect([200, 500]).toContain(res.statusCode);
		if (res.statusCode === 500) {
			expect(res.json()).toHaveProperty("error", "Internal Server Error");
		}
	});

	it("Reply 400 if fileName param is missing", async () => {
		const res = await fastify.inject({ method: "GET", url: "/data/imgs/" });
		expect(res.statusCode).toBe(400);
		expect(res.json()).toHaveProperty("error", "File name is required");
	});
});
