/**
 * Shared file support — DEVELOPER-001 (Part 7).
 *
 * Upload, download, and clipboard helpers reused by every developer tool.
 * Drag-and-drop is a thin React hook (features/dev/useFileDrop) over readFile.
 * Everything is client-side; files never leave the browser.
 */

/** Soft cap so a mis-drop of a huge binary doesn't hang the tab. Tools may override. */
export const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface FileReadResult {
  ok: boolean;
  text: string;
  name: string;
  error?: string;
}

/** Read a File as UTF-8 text, enforcing a size cap. */
export async function readTextFile(
  file: File,
  maxBytes: number = DEFAULT_MAX_FILE_BYTES
): Promise<FileReadResult> {
  if (file.size > maxBytes) {
    return {
      ok: false,
      text: "",
      name: file.name,
      error: `File is ${(file.size / (1024 * 1024)).toFixed(1)} MB — over the ${(
        maxBytes /
        (1024 * 1024)
      ).toFixed(0)} MB limit for in-browser processing.`,
    };
  }
  try {
    const text = await file.text();
    return { ok: true, text, name: file.name };
  } catch (e) {
    return {
      ok: false,
      text: "",
      name: file.name,
      error: e instanceof Error ? e.message : "Could not read file.",
    };
  }
}

/** Download a string as a file (client-side blob). */
export function downloadText(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Copy text to the clipboard; returns whether it succeeded. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Read text from the clipboard; returns null when blocked/unavailable. */
export async function pasteText(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}
