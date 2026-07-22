"use client";
import Editor, { type Monaco } from "@monaco-editor/react";

// Match Monaco's canvas to the app's dark tokens (#0a0e14 bg, muted gutter, green accents).
// Readable syntax palette on the near-black bg: comments are a soft slate (not the old low-contrast
// #475467), strings a distinct green, numbers warm amber, keywords the brand teal.
function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme("xnoquant", {
    base: "vs-dark",
    inherit: true,
    // VS Code Dark+ palette.
    rules: [
      { token: "comment", foreground: "6a9955" },
      { token: "keyword", foreground: "569cd6" },
      { token: "keyword.control", foreground: "c586c0" },
      { token: "keyword.operator", foreground: "d4d4d4" },
      { token: "operator", foreground: "d4d4d4" },
      { token: "delimiter", foreground: "d4d4d4" },
      { token: "number", foreground: "b5cea8" },
      { token: "string", foreground: "ce9178" },
      { token: "string.escape", foreground: "d7ba7d" },
      { token: "type", foreground: "4ec9b0" },
      { token: "type.identifier", foreground: "4ec9b0" },
      { token: "function", foreground: "dcdcaa" },
      { token: "identifier", foreground: "9cdcfe" },
      { token: "variable", foreground: "9cdcfe" },
      { token: "constant", foreground: "4fc1ff" },
    ],
    colors: {
      "editor.background": "#0a0e14",
      "editor.foreground": "#d4d4d4",
      "editorLineNumber.foreground": "#5a6270",
      "editorLineNumber.activeForeground": "#c6c6c6",
      "editor.lineHighlightBackground": "#151a2480",
      "editorGutter.background": "#0a0e14",
      "editor.selectionBackground": "#264f78",
      "editor.inactiveSelectionBackground": "#1d2939",
      "editorIndentGuide.background1": "#1d2939",
      "editorCursor.foreground": "#d4d4d4",
      "editorBracketMatch.background": "#1d293980",
      "editorBracketMatch.border": "#569cd6",
    },
  });
}

// HFT strategies are Rhai (Rust-like: `//` line comments, `let`/`fn`) — highlight them as Rust so
// comments/keywords tokenize correctly. MFT strategies are Python.
export function CodeEditor({
  code,
  onChange,
  language = "python",
  readOnly = false,
}: {
  code: string;
  onChange?: (code: string) => void;
  language?: "python" | "rust";
  readOnly?: boolean;
}) {
  const file = language === "rust" ? "strategy.rs" : "strategy.py";
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
      <Editor
        height="100%"
        language={language}
        // Read-only views (e.g. a run's Code tab) get a distinct model path so they never share
        // Monaco's model with the editable builder instance.
        path={readOnly ? `view/${file}` : file}
        value={code}
        theme="xnoquant"
        beforeMount={defineTheme}
        onChange={(v) => onChange?.(v ?? "")}
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          padding: { top: 12 },
          renderLineHighlight: "line",
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          readOnly,
        }}
      />
    </div>
  );
}
