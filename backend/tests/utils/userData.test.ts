import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import { Writable } from "stream";

/* Helper to create a ReadableStream from a string */
function makeWebReadableStream(chunk: string) {
  return new (globalThis as any).ReadableStream({
    start(controller: any) {
      controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
}

describe("userData utilities", () => {
  let existsSpy: any;
  let unlinkSpy: any;
  let createWsSpy: any;
  let writeFileSpy: any;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();

    existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
    unlinkSpy = vi.spyOn(fs, "unlinkSync").mockImplementation(() => {});
    createWsSpy = vi.spyOn(fs, "createWriteStream").mockImplementation(() => {
      return new Writable({
        write(_chunk, _enc, cb) { cb(); },
      }) as any;
    });
    writeFileSpy = vi.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  // saveAvatarFromUrl tests

  it("should save a valid image and update DB", async () => {
    const updateProfileMock = vi.fn().mockResolvedValue(true);
    vi.doMock("../../src/db/index.js", () => ({ updateProfile: updateProfileMock, db: {} }));
    vi.doMock("node-fetch", () => ({
      default: async () => ({
        ok: true,
        statusText: "OK",
        headers: { get: () => "image/png" },
        body: makeWebReadableStream("data"),
      }),
    }));

    existsSpy.mockReturnValue(true); // fichier existant pour tester unlink

    const userData = await import("../../src/utils/userData.js");
    const userId = "123";
    const fileName = `avatar_${userId}.png`;

    const result = await userData.saveAvatarFromUrl(userId, "http://example.com/img.png");
    expect(result).toBe(fileName);
    expect(unlinkSpy).toHaveBeenCalled();
    const dbModule = await import("../../src/db/index.js");
    expect(dbModule.updateProfile).toHaveBeenCalledWith(Number(userId), { profile_picture: fileName });
  });

  it("should throw if fetch fails (ok === false)", async () => {
    vi.doMock("../../src/db/index.js", () => ({ updateProfile: vi.fn(), db: {} }));
    vi.doMock("node-fetch", () => ({
      default: async () => ({ ok: false, statusText: "Not Found", headers: { get: () => null }, body: null }),
    }));

    const userData = await import("../../src/utils/userData.js");
    await expect(userData.saveAvatarFromUrl("1", "http://example.com"))
      .rejects.toThrow("Failed to download image: Not Found");
  });

  it("should throw if URL is not an image", async () => {
    vi.doMock("../../src/db/index.js", () => ({ updateProfile: vi.fn(), db: {} }));
    vi.doMock("node-fetch", () => ({
      default: async () => ({
        ok: true,
        statusText: "OK",
        headers: { get: () => "text/html" },
        body: makeWebReadableStream("<html></html>"),
      }),
    }));

    const userData = await import("../../src/utils/userData.js");
    await expect(userData.saveAvatarFromUrl("1", "http://example.com"))
      .rejects.toThrow("URL does not point to an image");
  });

  it("should throw if res.body is null", async () => {
    vi.doMock("../../src/db/index.js", () => ({ updateProfile: vi.fn(), db: {} }));
    vi.doMock("node-fetch", () => ({
      default: async () => ({ ok: true, statusText: "OK", headers: { get: () => "image/png" }, body: null }),
    }));

    const userData = await import("../../src/utils/userData.js");
    await expect(userData.saveAvatarFromUrl("1", "http://example.com"))
      .rejects.toThrow("Response body is null");
  });

  // saveAvatarFromFile tests

  it("should write file and update DB", async () => {
    const updateProfileMock = vi.fn().mockResolvedValue(true);
    vi.doMock("../../src/db/index.js", () => ({ updateProfile: updateProfileMock, db: {} }));

    const userData = await import("../../src/utils/userData.js");
    const userId = "42";
    const file = { filename: "myPic.jpg", toBuffer: async () => Buffer.from("data") };
    const expectedFileName = `avatar_${userId}.jpg`;

    const result = await userData.saveAvatarFromFile(userId, file);
    expect(result).toBe(expectedFileName);
    expect(writeFileSpy).toHaveBeenCalled();
    expect(updateProfileMock).toHaveBeenCalledWith(Number(userId), { profile_picture: expectedFileName });
  });

  it("should remove existing file if exists", async () => {
    const updateProfileMock = vi.fn().mockResolvedValue(true);
    vi.doMock("../../src/db/index.js", () => ({ updateProfile: updateProfileMock, db: {} }));

    existsSpy.mockReturnValue(true);
    const userData = await import("../../src/utils/userData.js");

    const file = { filename: "file.png", toBuffer: async () => Buffer.from("") };
    await userData.saveAvatarFromFile("1", file);
    expect(unlinkSpy).toHaveBeenCalled();
  });
});
