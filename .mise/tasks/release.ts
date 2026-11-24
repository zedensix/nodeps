#!/usr/bin/env bun
//MISE description="Build release binaries, npm packages and Python wheels into build/release"
//USAGE arg "<version>" help="Version to release, like 1.2.0"
import { $ } from "bun";
import { chmod, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const version = (process.env.usage_version ?? Bun.argv[2] ?? "").replace(/^v/, "");
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Expected a version like 1.2.0, got "${version}"`);
  process.exit(1);
}

const root = process.env.MISE_PROJECT_ROOT ?? process.cwd();
const output = join(root, "build/release");
const repository = "https://github.com/zedensix/nodeps";
const stableBun = "1.4.5";
const description = "Documentation site generator and server built only on Bun's native APIs.";

const targets = [
  {
    bun: "bun-linux-x64",
    npm: "linux-x64",
    os: "linux",
    cpu: "x64",
    libc: "glibc",
    wheel: ["manylinux_2_17_x86_64", "manylinux2014_x86_64"],
  },
  {
    bun: "bun-linux-arm64",
    npm: "linux-arm64",
    os: "linux",
    cpu: "arm64",
    libc: "glibc",
    wheel: ["manylinux_2_17_aarch64", "manylinux2014_aarch64"],
  },
  {
    bun: "bun-linux-x64-musl",
    npm: "linux-x64-musl",
    os: "linux",
    cpu: "x64",
    libc: "musl",
    wheel: ["musllinux_1_2_x86_64"],
  },
  {
    bun: "bun-linux-arm64-musl",
    npm: "linux-arm64-musl",
    os: "linux",
    cpu: "arm64",
    libc: "musl",
    wheel: ["musllinux_1_2_aarch64"],
  },
  { bun: "bun-darwin-x64", npm: "darwin-x64", os: "darwin", cpu: "x64", libc: "", wheel: ["macosx_13_0_x86_64"] },
  { bun: "bun-darwin-arm64", npm: "darwin-arm64", os: "darwin", cpu: "arm64", libc: "", wheel: ["macosx_13_0_arm64"] },
  { bun: "bun-windows-x64", npm: "win32-x64", os: "win32", cpu: "x64", libc: "", wheel: ["win_amd64"] },
];

const licenses = [join(root, "theme/icons/LICENSE"), join(root, "theme/icons/brands/LICENSE.md")];
const thirdPartyNotice = async () =>
  `nodeps embeds Lucide icons (ISC) and Simple Icons logos (CC0).\n\n${(await Promise.all(licenses.map((file) => Bun.file(file).text()))).join("\n\n")}`;

await rm(output, { recursive: true, force: true });
// Cross-compiling downloads the Bun runtime of the running version, and canary runtimes are not published.
await $`mise exec bun@${stableBun} -- bun ${join(root, ".mise/tasks/compile.ts")} ${targets.map((target) => target.bun)}`.cwd(
  root,
);

async function binaryOf(target: (typeof targets)[number]) {
  const base = join(root, "build", `nodeps-${target.bun.replace(/^bun-/, "")}`);
  for (const candidate of [base, `${base}.exe`]) {
    if (await Bun.file(candidate).exists()) {
      return candidate;
    }
  }
  throw new Error(`Missing compiled binary for ${target.bun}`);
}

const checksums: string[] = [];
for (const target of targets) {
  const binary = await binaryOf(target);
  const assetName = `nodeps-${target.npm}${target.os === "win32" ? ".exe" : ""}`;
  await Bun.write(join(output, "assets", assetName), Bun.file(binary));
  checksums.push(
    `${new Bun.CryptoHasher("sha256").update(await Bun.file(binary).arrayBuffer()).digest("hex")}  ${assetName}`,
  );
}
await Bun.write(join(output, "assets/SHA256SUMS"), checksums.join("\n") + "\n");

const readme = await Bun.file(join(root, "README.md")).text();
const notice = await thirdPartyNotice();

for (const target of targets) {
  const directory = join(output, "npm", `nodeps-${target.npm}`);
  const executable = `nodeps${target.os === "win32" ? ".exe" : ""}`;
  await Bun.write(join(directory, "bin", executable), Bun.file(await binaryOf(target)));
  await chmod(join(directory, "bin", executable), 0o755);
  await Bun.write(join(directory, "THIRD_PARTY_NOTICES"), notice);
  await Bun.write(
    join(directory, "package.json"),
    JSON.stringify(
      {
        name: `@zedensix/nodeps-${target.npm}`,
        version,
        description: `${description} Binary for ${target.npm}.`,
        repository: { type: "git", url: `git+${repository}.git` },
        os: [target.os],
        cpu: [target.cpu],
        ...(target.libc ? { libc: [target.libc] } : {}),
        files: ["bin", "THIRD_PARTY_NOTICES"],
      },
      null,
      2,
    ) + "\n",
  );
}

const launcher = `#!/usr/bin/env node
"use strict";
const { spawnSync } = require("node:child_process");
const musl = process.platform === "linux" && !process.report.getReport().header.glibcVersionRuntime;
const platform = \`\${process.platform}-\${process.arch}\${musl ? "-musl" : ""}\`;
let binary;
try {
  binary = require.resolve(\`@zedensix/nodeps-\${platform}/bin/nodeps\${process.platform === "win32" ? ".exe" : ""}\`);
} catch {
  console.error(\`nodeps: no prebuilt binary for \${platform}. Reinstall without --omit=optional, or download one from ${repository}/releases.\`);
  process.exit(1);
}
const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit" });
if (result.error) {
  console.error(result.error.message);
}
process.exit(result.status ?? 1);
`;
const mainDirectory = join(output, "npm", "nodeps");
await Bun.write(join(mainDirectory, "bin/nodeps.js"), launcher);
await chmod(join(mainDirectory, "bin/nodeps.js"), 0o755);
await Bun.write(join(mainDirectory, "README.md"), readme);
await Bun.write(join(mainDirectory, "THIRD_PARTY_NOTICES"), notice);
await Bun.write(
  join(mainDirectory, "package.json"),
  JSON.stringify(
    {
      name: "@zedensix/nodeps",
      version,
      description,
      repository: { type: "git", url: `git+${repository}.git` },
      homepage: repository,
      bin: { nodeps: "bin/nodeps.js" },
      files: ["bin", "README.md", "THIRD_PARTY_NOTICES"],
      optionalDependencies: Object.fromEntries(targets.map((target) => [`@zedensix/nodeps-${target.npm}`, version])),
    },
    null,
    2,
  ) + "\n",
);

const urlsafeDigest = (bytes: ArrayBuffer) =>
  new Bun.CryptoHasher("sha256")
    .update(bytes)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const distribution = "zedensix_nodeps";
for (const target of targets) {
  const staging = join(output, "pypi-staging", target.npm);
  const executable = `nodeps${target.os === "win32" ? ".exe" : ""}`;
  const dataScript = `${distribution}-${version}.data/scripts/${executable}`;
  const distInfo = `${distribution}-${version}.dist-info`;
  const files: Record<string, string | Blob> = {
    [dataScript]: Bun.file(await binaryOf(target)),
    [`${distInfo}/METADATA`]: [
      "Metadata-Version: 2.1",
      "Name: zedensix-nodeps",
      `Version: ${version}`,
      `Summary: ${description}`,
      `Project-URL: Source, ${repository}`,
      "Requires-Python: >=3.8",
      "Description-Content-Type: text/markdown",
      "",
      readme,
    ].join("\n"),
    [`${distInfo}/WHEEL`]: [
      "Wheel-Version: 1.0",
      "Generator: nodeps-release",
      "Root-Is-Purelib: false",
      ...target.wheel.map((tag) => `Tag: py3-none-${tag}`),
      "",
    ].join("\n"),
    [`${distInfo}/licenses/THIRD_PARTY_NOTICES`]: notice,
  };
  const record: string[] = [];
  for (const [path, content] of Object.entries(files)) {
    await Bun.write(join(staging, path), content);
    const bytes = await Bun.file(join(staging, path)).arrayBuffer();
    record.push(`${path},sha256=${urlsafeDigest(bytes)},${bytes.byteLength}`);
  }
  await chmod(join(staging, dataScript), 0o755);
  record.push(`${distInfo}/RECORD,,`);
  await Bun.write(join(staging, distInfo, "RECORD"), record.join("\n") + "\n");
  await mkdir(join(output, "pypi"), { recursive: true });
  const wheel = join(output, "pypi", `${distribution}-${version}-py3-none-${target.wheel.join(".")}.whl`);
  await $`zip -qrX ${wheel} .`.cwd(staging);
}
await rm(join(output, "pypi-staging"), { recursive: true, force: true });

console.log(`Release ${version} ready in ${output}`);
