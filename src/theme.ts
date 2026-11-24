export interface BundledAsset {
  body: string;
  type: string;
}

export interface Bundle {
  entry: string;
  assets: Map<string, BundledAsset>;
}

export interface EmbeddedTheme {
  template: string;
  assets: Record<string, BundledAsset>;
  icons: Record<string, string>;
}

declare const NODEPS_EMBEDDED_THEME: EmbeddedTheme | undefined;

export const embeddedTheme: EmbeddedTheme | undefined =
  typeof NODEPS_EMBEDDED_THEME === "undefined" ? undefined : NODEPS_EMBEDDED_THEME;

export const embeddedBase = "/__nodeps_base__/";

export const themeDirectory = `${import.meta.dir}/../theme`;

export async function bundle(entrypoint: string, publicPath: string): Promise<Bundle> {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    target: "browser",
    minify: true,
    publicPath,
    naming: "[name]-[hash].[ext]",
    throw: false,
  });
  if (!result.success) {
    throw new Error(`Failed to build ${entrypoint}:\n${result.logs.join("\n")}`);
  }
  const assets = new Map<string, BundledAsset>();
  let entry = "";
  for (const output of result.outputs) {
    const name = output.path.replace(/^\.\//, "");
    if (output.kind === "entry-point" && name.endsWith(".html")) {
      entry = await output.text();
    } else {
      assets.set(name, { body: await output.text(), type: output.type });
    }
    if (output.kind === "entry-point" && !name.endsWith(".html")) {
      entry ||= publicPath + name;
    }
  }
  return { entry, assets };
}

export async function bundleLayout(publicPath: string): Promise<Bundle> {
  if (!embeddedTheme) {
    return bundle(`${themeDirectory}/layout.html`, publicPath);
  }
  const rebase = (text: string) => text.replaceAll(embeddedBase + "_assets/", publicPath);
  return {
    entry: rebase(embeddedTheme.template),
    assets: new Map(
      Object.entries(embeddedTheme.assets).map(([name, asset]) => [name, { ...asset, body: rebase(asset.body) }]),
    ),
  };
}
