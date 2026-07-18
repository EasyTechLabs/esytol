"use client";

/**
 * Shared code editor — DEVELOPER-001 (Part 1).
 *
 * A reusable CodeMirror 6 editor behind a small, stable interface. Every
 * developer tool consumes THIS, never CodeMirror directly, so the engine can be
 * swapped without touching a single tool. CodeMirror was chosen over Monaco to
 * stay inside the platform's strict CSP (no CDN, no web-workers, no blob: — all
 * same-origin) and its lightweight/self-contained principle.
 *
 * Client-only: the EditorView is created in an effect, so the module SSRs to an
 * empty container with no hydration mismatch.
 */

import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  placeholder as cmPlaceholder,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
} from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";

export type EditorLanguage =
  "json" | "jwt" | "xml" | "yaml" | "sql" | "javascript" | "html" | "css" | "text";

function languageExtension(language: EditorLanguage) {
  switch (language) {
    case "json":
    case "jwt": // JWT payloads are JSON
      return json();
    case "javascript":
      return javascript();
    case "html":
      return html();
    case "css":
      return css();
    case "sql":
      return sql();
    case "xml":
      return xml();
    case "yaml":
      return yaml();
    case "text":
      return [];
  }
}

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: EditorLanguage;
  readOnly?: boolean;
  dark?: boolean;
  placeholder?: string;
  minHeight?: string;
  ariaLabel?: string;
}

export function CodeEditor({
  value,
  onChange,
  language = "text",
  readOnly = false,
  dark = false,
  placeholder = "",
  minHeight = "16rem",
  ariaLabel = "Code editor",
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  const langComp = useRef(new Compartment());
  const themeComp = useRef(new Compartment());
  const roComp = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Create the editor once.
  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        foldGutter(),
        history(),
        bracketMatching(),
        highlightActiveLine(),
        cmPlaceholder(placeholder),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        langComp.current.of(languageExtension(language)),
        themeComp.current.of(themeExtensions(dark)),
        roComp.current.of(EditorState.readOnly.of(readOnly)),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
        }),
      ],
    });
    const v = new EditorView({ state, parent: host.current });
    view.current = v;
    if (ariaLabel) v.contentDOM.setAttribute("aria-label", ariaLabel);
    return () => {
      v.destroy();
      view.current = null;
    };
    // Intentionally run once — subsequent prop changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (Load sample, Clear, file upload, format).
  useEffect(() => {
    const v = view.current;
    if (v && value !== v.state.doc.toString()) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  // Reconfigure language / theme / read-only without recreating the editor.
  useEffect(() => {
    view.current?.dispatch({ effects: langComp.current.reconfigure(languageExtension(language)) });
  }, [language]);
  useEffect(() => {
    view.current?.dispatch({ effects: themeComp.current.reconfigure(themeExtensions(dark)) });
  }, [dark]);
  useEffect(() => {
    view.current?.dispatch({
      effects: roComp.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  return (
    <div
      ref={host}
      style={{ minHeight }}
      className="overflow-auto rounded-lg border border-gray-300 text-sm [&_.cm-editor.cm-focused]:outline-none [&_.cm-editor]:min-h-[inherit] [&_.cm-scroller]:font-mono"
    />
  );
}

function themeExtensions(dark: boolean) {
  return dark ? [oneDark] : [syntaxHighlighting(defaultHighlightStyle, { fallback: true })];
}
