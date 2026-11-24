export interface Preset {
  name: string;
  title: string;
  description: string;
  accent: string;
  tokens: Record<string, string>;
  light: Record<string, string>;
  dark: Record<string, string>;
}

const sans = '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
const mono = 'ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace';
const serif = '"Iowan Old Style", "Charter", "Palatino Linotype", Georgia, serif';

const base: Omit<Preset, "name" | "title" | "description"> = {
  accent: "#6d5efc",
  tokens: { font: sans, mono, radius: "10px" },
  light: {
    background: "#ffffff",
    surface: "#f7f7f9",
    "surface-strong": "#efeff3",
    border: "#e5e5ec",
    text: "#16161b",
    "text-muted": "#575766",
    "text-subtle": "#868695",
    "code-background": "#fafafc",
    "accent-contrast": "#ffffff",
  },
  dark: {
    background: "#0b0b0f",
    surface: "#121218",
    "surface-strong": "#1c1c25",
    border: "#25252f",
    text: "#ececf1",
    "text-muted": "#a3a3b3",
    "text-subtle": "#6f6f80",
    "code-background": "#0f0f15",
    accent: "color-mix(in oklab, var(--brand) 72%, white)",
    "accent-contrast": "#ffffff",
  },
};

function preset(
  name: string,
  title: string,
  description: string,
  overrides: Partial<Omit<Preset, "name" | "title" | "description">>,
): Preset {
  return {
    name,
    title,
    description,
    accent: overrides.accent ?? base.accent,
    tokens: { ...base.tokens, ...overrides.tokens },
    light: { ...base.light, ...overrides.light },
    dark: { ...base.dark, ...overrides.dark },
  };
}

export const presets: Preset[] = [
  preset("default", "Default", "Neutral greys with a violet accent.", {}),
  preset("ocean", "Ocean", "Cool blues and teals, softly rounded.", {
    accent: "#0e8fb3",
    tokens: { radius: "12px" },
    light: {
      background: "#fbfdfe",
      surface: "#f2f7f9",
      "surface-strong": "#e6eff3",
      border: "#dbe6eb",
      text: "#0f1d24",
      "text-muted": "#4a5d66",
      "text-subtle": "#7f939c",
      "code-background": "#f5f9fb",
    },
    dark: {
      background: "#071318",
      surface: "#0c1c23",
      "surface-strong": "#13272f",
      border: "#1b323c",
      text: "#e3f0f4",
      "text-muted": "#9fb6bf",
      "text-subtle": "#6b8590",
      "code-background": "#0a171d",
      accent: "#4cc3e6",
      "accent-contrast": "#04141a",
    },
  }),
  preset("forest", "Forest", "Warm paper whites and deep greens.", {
    accent: "#2f7d4f",
    light: {
      background: "#fbfaf6",
      surface: "#f3f1ea",
      "surface-strong": "#e9e6dc",
      border: "#e2ded2",
      text: "#1d211c",
      "text-muted": "#575c52",
      "text-subtle": "#8a8f83",
      "code-background": "#f7f5ef",
    },
    dark: {
      background: "#0d110e",
      surface: "#131a15",
      "surface-strong": "#1b241d",
      border: "#243026",
      text: "#e6ece4",
      "text-muted": "#a3afa0",
      "text-subtle": "#6f7d6c",
      "code-background": "#101611",
      accent: "#6fcf95",
      "accent-contrast": "#0a1a10",
    },
  }),
  preset("ember", "Ember", "Glowing orange on warm neutrals.", {
    accent: "#e0571b",
    tokens: { radius: "8px" },
    light: {
      background: "#fffdfb",
      surface: "#fbf5f1",
      "surface-strong": "#f4ebe4",
      border: "#efe2d8",
      text: "#22160f",
      "text-muted": "#66524a",
      "text-subtle": "#9a857b",
      "code-background": "#fcf8f5",
    },
    dark: {
      background: "#120c09",
      surface: "#1a120e",
      "surface-strong": "#241913",
      border: "#2f2119",
      text: "#f4e9e2",
      "text-muted": "#bba69a",
      "text-subtle": "#846f63",
      "code-background": "#150e0b",
      accent: "#ff8a4c",
      "accent-contrast": "#1f0d03",
    },
  }),
  preset("rose", "Rose", "Pink accents and generous curves.", {
    accent: "#d6336c",
    tokens: { radius: "14px" },
    light: {
      background: "#fffbfc",
      surface: "#fcf3f6",
      "surface-strong": "#f6e6ec",
      border: "#f0dbe3",
      text: "#24121a",
      "text-muted": "#6b4c58",
      "text-subtle": "#a08592",
      "code-background": "#fdf7f9",
    },
    dark: {
      background: "#130a0e",
      surface: "#1c1015",
      "surface-strong": "#27161d",
      border: "#331d27",
      text: "#f6e6ec",
      "text-muted": "#c4a2b0",
      "text-subtle": "#8b6b78",
      "code-background": "#170c11",
      accent: "#ff7aa8",
      "accent-contrast": "#22060f",
    },
  }),
  preset("midnight", "Midnight", "Indigo on deep navy, made for the dark.", {
    accent: "#5b6cff",
    light: {
      background: "#f8f9fd",
      surface: "#eef0f9",
      "surface-strong": "#e2e6f4",
      border: "#d9ddef",
      text: "#12152b",
      "text-muted": "#4d5375",
      "text-subtle": "#8288a8",
      "code-background": "#f2f4fb",
    },
    dark: {
      background: "#070a1a",
      surface: "#0d1126",
      "surface-strong": "#151a34",
      border: "#1e2442",
      text: "#e4e7fa",
      "text-muted": "#9ea5cc",
      "text-subtle": "#6a7199",
      "code-background": "#0a0e20",
      accent: "#8d99ff",
    },
  }),
  preset("mono", "Mono", "Black and white, sharp corners, no color.", {
    accent: "#111111",
    tokens: { radius: "4px" },
    light: {
      background: "#ffffff",
      surface: "#f6f6f6",
      "surface-strong": "#ececec",
      border: "#e2e2e2",
      text: "#0a0a0a",
      "text-muted": "#525252",
      "text-subtle": "#8a8a8a",
      "code-background": "#fafafa",
    },
    dark: {
      background: "#0a0a0a",
      surface: "#141414",
      "surface-strong": "#1f1f1f",
      border: "#2a2a2a",
      text: "#f5f5f5",
      "text-muted": "#a3a3a3",
      "text-subtle": "#6b6b6b",
      "code-background": "#101010",
      accent: "#f5f5f5",
      "accent-contrast": "#0a0a0a",
    },
  }),
  preset("paper", "Paper", "Serif type on sepia, like a printed manual.", {
    accent: "#8b5e34",
    tokens: { font: serif, radius: "6px" },
    light: {
      background: "#fbf7ef",
      surface: "#f4eee2",
      "surface-strong": "#ebe3d3",
      border: "#e4dac7",
      text: "#2b2118",
      "text-muted": "#5f5244",
      "text-subtle": "#95866f",
      "code-background": "#f7f1e6",
    },
    dark: {
      background: "#17130e",
      surface: "#1f1a13",
      "surface-strong": "#29221a",
      border: "#352c21",
      text: "#ece3d4",
      "text-muted": "#b5a690",
      "text-subtle": "#7f725f",
      "code-background": "#1b1610",
      accent: "#d9a46c",
      "accent-contrast": "#1d1208",
    },
  }),
  preset("terminal", "Terminal", "Monospace everything, phosphor green.", {
    accent: "#16a34a",
    tokens: { font: mono, radius: "2px" },
    light: {
      background: "#fcfdfc",
      surface: "#f1f5f2",
      "surface-strong": "#e4ece6",
      border: "#d8e2da",
      text: "#0d1a11",
      "text-muted": "#45594b",
      "text-subtle": "#7a8f80",
      "code-background": "#f5f8f6",
    },
    dark: {
      background: "#050806",
      surface: "#0a100c",
      "surface-strong": "#101a13",
      border: "#18261c",
      text: "#d7f5df",
      "text-muted": "#8fb89b",
      "text-subtle": "#5e8a6b",
      "code-background": "#070b08",
      accent: "#3ee07a",
      "accent-contrast": "#03140a",
    },
  }),
];

export function findPreset(name: string) {
  return presets.find((candidate) => candidate.name === name);
}

export function themeDeclarations(theme: Omit<Preset, "name" | "title" | "description">) {
  const declarations = [`--brand:${theme.accent}`];
  for (const [name, value] of Object.entries(theme.tokens)) {
    declarations.push(`--${name}:${value}`);
  }
  for (const [name, value] of Object.entries(theme.light)) {
    declarations.push(`--light-${name}:${value}`);
  }
  for (const [name, value] of Object.entries(theme.dark)) {
    declarations.push(`--dark-${name}:${value}`);
  }
  return declarations.join(";");
}
