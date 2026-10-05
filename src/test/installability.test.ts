import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const publicDir = join(process.cwd(), "public");
const manifest = JSON.parse(readFileSync(join(publicDir, "manifest.webmanifest"), "utf8"));

describe("Mevak home-screen installation", () => {
  it("opens as a standalone app at the root", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("uses the requested Mevak name and colors", () => {
    expect(manifest.name).toBe("Mevak ERP");
    expect(manifest.short_name).toBe("Mevak");
    expect(manifest.theme_color).toBe("#5D57D6");
    expect(manifest.background_color).toBe("#F4F1E9");
  });

  it("provides both requested maskable icon sizes", () => {
    expect(manifest.icons.map((icon: { src: string; sizes: string; purpose: string }) => [icon.src, icon.sizes, icon.purpose])).toEqual([
      ["/icon-192.png", "192x192", "any maskable"],
      ["/icon-512.png", "512x512", "any maskable"],
    ]);
  });
});