/**
 * Codec platform — the reusable engine behind the Encoding & Escape tool family (PLATFORM-005).
 *
 * A `Codec` is a reversible, byte-accurate text transform: an encode side and a decode side, each
 * returning the shared `CodecResult`. Every codec composes the audited primitives in lib/dev/encode
 * (no transform is reimplemented) and adds only the metadata a tool needs — labels, samples, a note.
 *
 * One registry drives the whole family: a new encoder/decoder tool is a single `CODECS` entry plus a
 * three-line page that hands the id to the shared `EncoderDecoderTool` UI. Pure and deterministic;
 * nothing touches the network, DOM, or storage.
 */

import {
  type CodecResult,
  encodeHtml,
  decodeHtml,
  encodeHex,
  decodeHex,
  encodeBinary,
  decodeBinary,
  encodeUnicode,
  decodeUnicode,
  encodeBackslash,
  decodeBackslash,
} from "./encode";

export type { CodecResult };

export interface Codec {
  id: string;
  /** Display name of the tool ("HTML Entity Encoder / Decoder"). */
  name: string;
  /** The plain-text side label (input when encoding, output when decoding). */
  plainLabel: string;
  /** The encoded side label (output when encoding, input when decoding). */
  encodedLabel: string;
  /** The word used on the encode button/status ("Encode"). */
  encodeVerb: string;
  /** The word used on the decode button/status ("Decode"). */
  decodeVerb: string;
  encode(input: string): CodecResult;
  decode(input: string): CodecResult;
  /** A representative plain-text sample and its encoded form (for the "Sample" button). */
  samplePlain: string;
  sampleEncoded: string;
  /** One-line privacy/education note shown beneath the tool. */
  note: string;
}

export const CODECS = {
  html: {
    id: "html",
    name: "HTML Entity Encoder / Decoder",
    plainLabel: "Text",
    encodedLabel: "HTML-encoded",
    encodeVerb: "Encode",
    decodeVerb: "Decode",
    encode: encodeHtml,
    decode: decodeHtml,
    samplePlain: `<a href="/x">Tom & "Jerry"</a>`,
    sampleEncoded: `&lt;a href=&quot;/x&quot;&gt;Tom &amp; &quot;Jerry&quot;&lt;/a&gt;`,
    note: "Encoding escapes the HTML-significant characters (& < > \" ') so text renders literally instead of as markup — a defence against HTML/attribute injection. Decoding also resolves numeric (&#38;, &#x26;) entities. Runs entirely in your browser; nothing is uploaded.",
  },
  hex: {
    id: "hex",
    name: "Hex Converter",
    plainLabel: "Text",
    encodedLabel: "Hex",
    encodeVerb: "Encode",
    decodeVerb: "Decode",
    encode: (input: string) => encodeHex(input, true),
    decode: decodeHex,
    samplePlain: "Hello, Esytol! ₹",
    sampleEncoded: "48 65 6c 6c 6f 2c 20 45 73 79 74 6f 6c 21 20 e2 82 b9",
    note: "Text is encoded as its UTF-8 bytes in lowercase hexadecimal. Decoding accepts spaced, continuous, or 0x-prefixed hex. Runs entirely in your browser; nothing is uploaded.",
  },
  binary: {
    id: "binary",
    name: "Binary Converter",
    plainLabel: "Text",
    encodedLabel: "Binary",
    encodeVerb: "Encode",
    decodeVerb: "Decode",
    encode: encodeBinary,
    decode: decodeBinary,
    samplePlain: "Hi!",
    sampleEncoded: "01001000 01101001 00100001",
    note: "Text is encoded as its UTF-8 bytes in 8-bit binary. Decoding accepts spaced or continuous bits (a multiple of 8). Runs entirely in your browser; nothing is uploaded.",
  },
  unicode: {
    id: "unicode",
    name: "Unicode Escape Converter",
    plainLabel: "Text",
    encodedLabel: "Unicode escapes",
    encodeVerb: "Encode",
    decodeVerb: "Decode",
    encode: encodeUnicode,
    decode: decodeUnicode,
    samplePlain: "café ₹ 😀",
    sampleEncoded: "\\u0063\\u0061\\u0066\\u00e9\\u0020\\u20b9\\u0020\\ud83d\\ude00",
    note: "Each character becomes a \\uXXXX escape (astral characters like emoji become a surrogate pair). Decoding also resolves \\xXX escapes. Runs entirely in your browser; nothing is uploaded.",
  },
  backslash: {
    id: "backslash",
    name: "Backslash String Escaper",
    plainLabel: "Raw text",
    encodedLabel: "Escaped string",
    encodeVerb: "Escape",
    decodeVerb: "Unescape",
    encode: encodeBackslash,
    decode: decodeBackslash,
    samplePlain: `line1\nline2\ttabbed "quoted" C:\\path`,
    sampleEncoded: `line1\\nline2\\ttabbed \\"quoted\\" C:\\\\path`,
    note: 'Escaping turns raw text into a safe string-literal body (\\\\, \\n, \\r, \\t, \\", \\0) for pasting into code. Unescaping interprets those sequences plus \\uXXXX and \\xXX. Runs entirely in your browser; nothing is uploaded.',
  },
} satisfies Record<string, Codec>;

export type CodecId = keyof typeof CODECS;

export function getCodec(id: CodecId): Codec {
  return CODECS[id];
}
