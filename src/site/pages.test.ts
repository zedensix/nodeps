import { expect, test } from "bun:test";
import { readTags } from "./pages.ts";

test("tags become unique lowercase words, spaces turned into dashes so #tag search matches them", () => {
  const problems: string[] = [];
  expect(readTags(["Getting Started", "dark  mode", "config", "CONFIG"], "a.md", problems)).toEqual([
    "getting-started",
    "dark-mode",
    "config",
  ]);
  expect(readTags("cli, Server", "a.md", problems)).toEqual(["cli", "server"]);
  expect(problems).toEqual([]);
});
