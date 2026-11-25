import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./config.ts";

test("a token cut short by an unquoted YAML # is refused instead of breaking every later token", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "nodeps-config-")), "docs.yaml");
  await Bun.write(path, "theme:\n  header-background: linear-gradient(90deg, #1e3a8a, #7c3aed)\n");
  await expect(loadConfig(path)).rejects.toThrow(
    '"theme.header-background" must be a CSS value with balanced parentheses',
  );
  await Bun.write(path, 'theme:\n  header-background: "linear-gradient(90deg, #1e3a8a, #7c3aed)"\n');
  expect((await loadConfig(path)).theme.tokens["header-background"]).toBe("linear-gradient(90deg, #1e3a8a, #7c3aed)");
});
