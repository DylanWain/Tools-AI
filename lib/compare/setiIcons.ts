/**
 * Seti file-icon resolver — direct port of veronum-overlay/renderer/
 * src/lib/setiIcons.ts so /compare uses the same VS Code seti icon
 * set as the Veronum desktop app. Assets live under
 * /Tools-AI/public/seti/{seti.woff, seti-theme.json}.
 *
 * Lookup chain (matches VS Code's resolution order):
 *   1. fileNames["package.json" | "Dockerfile" | ".env" …]
 *   2. fileExtensions["png" | "pdf" | "tsbuildinfo" …]
 *   3. languageIds["typescript" | "javascript" | "python" …]
 *      — derived here from extension since we don't have a tokenizer
 *   4. _default
 *
 * fetchSetiTheme() loads /seti/seti-theme.json once at startup;
 * subsequent callers share the pending promise.
 */

type SetiIconDef = { fontCharacter: string; fontColor?: string };
type SetiTheme = {
  fonts: { id: string; src: { path: string; format: string }[] }[];
  iconDefinitions: Record<string, SetiIconDef>;
  file: string;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  languageIds: Record<string, string>;
};

let theme: SetiTheme | null = null;
let loadingPromise: Promise<SetiTheme | null> | null = null;

export function fetchSetiTheme(): Promise<SetiTheme | null> {
  if (theme) return Promise.resolve(theme);
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const res = await fetch("/seti/seti-theme.json");
      if (!res.ok) throw new Error(`seti theme HTTP ${res.status}`);
      theme = (await res.json()) as SetiTheme;
      return theme;
    } catch (e) {
      console.warn("[seti] failed to load icon theme:", e);
      return null;
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: "typescript", mts: "typescript", cts: "typescript",
  tsx: "typescriptreact",
  js: "javascript", mjs: "javascript", cjs: "javascript",
  jsx: "javascriptreact",
  py: "python", rb: "ruby", rs: "rust", go: "go",
  java: "java", kt: "kotlin", kts: "kotlin", swift: "swift", scala: "scala",
  c: "c", h: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp",
  cs: "csharp", fs: "fsharp", php: "php", pl: "perl", lua: "lua", r: "r",
  json: "json", jsonc: "jsonc",
  md: "markdown", mdx: "markdown", rst: "restructuredtext",
  css: "css", scss: "scss", sass: "sass", less: "less",
  html: "html", htm: "html", xml: "xml", svg: "xml",
  vue: "vue", svelte: "svelte",
  yaml: "yaml", yml: "yaml", toml: "toml",
  sh: "shellscript", bash: "shellscript", zsh: "shellscript", fish: "shellscript",
  sql: "sql", graphql: "graphql", gql: "graphql",
  dockerfile: "dockerfile", ini: "ini", conf: "ini",
  env: "dotenv", log: "log", diff: "diff", patch: "diff",
};

export type ResolvedIcon = {
  char: string;
  color?: string;
};

export function resolveSetiIcon(filePath: string): ResolvedIcon | null {
  if (!theme) return null;
  const fileName = (filePath.split("/").pop() || filePath).toLowerCase();

  let key: string | undefined = theme.fileNames[fileName];

  if (!key) {
    const dot = fileName.lastIndexOf(".");
    const ext = dot >= 0 ? fileName.slice(dot + 1) : "";
    if (ext) {
      key = theme.fileExtensions[ext];
      if (!key) {
        const lang = EXT_TO_LANGUAGE[ext];
        if (lang) key = theme.languageIds[lang];
      }
    }
  }

  if (!key) key = theme.file;

  const def = theme.iconDefinitions[key];
  if (!def) return null;
  return {
    char: parseFontChar(def.fontCharacter),
    color: def.fontColor,
  };
}

function parseFontChar(raw: string): string {
  if (!raw) return "";
  const hex = raw.replace(/^\\+/, "").replace(/^0x/i, "");
  const code = parseInt(hex, 16);
  if (Number.isNaN(code)) return "";
  return String.fromCodePoint(code);
}
