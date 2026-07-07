"use client";
import Editor, { type Monaco } from "@monaco-editor/react";
import { SAMPLE_CODE } from "@/lib/mock/strategy-builder";

// Match Monaco's canvas to the app's dark tokens (#0a0e14 bg, #9db2ce gutter, green accents).
function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme("xnoquant", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "475467", fontStyle: "italic" },
      { token: "keyword", foreground: "67e1c1" },
      { token: "number", foreground: "f1c617" },
      { token: "string", foreground: "9db2ce" },
    ],
    colors: {
      "editor.background": "#0a0e14",
      "editor.foreground": "#f1f8f3",
      "editorLineNumber.foreground": "#475467",
      "editorLineNumber.activeForeground": "#9db2ce",
      "editor.lineHighlightBackground": "#151a2480",
      "editorGutter.background": "#0a0e14",
      "editor.selectionBackground": "#1d2939",
      "editorIndentGuide.background1": "#1d2939",
    },
  });
}

export function CodeEditor() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-4">
        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-foreground">Strategy.rhai</span>
        <span className="text-xs text-muted-foreground">HFT · Rhai</span>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          defaultLanguage="rust"
          defaultValue={SAMPLE_CODE}
          theme="xnoquant"
          beforeMount={defineTheme}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, 'Courier New', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            padding: { top: 12 },
            renderLineHighlight: "line",
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          }}
        />
      </div>
    </div>
  );
}
