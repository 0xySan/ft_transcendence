import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		include: ["tests/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reportsDirectory: "./coverage",
			reporter: ["text", "html", "lcov"],
			all: true,
		},
	},
});
