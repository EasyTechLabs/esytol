/**
 * XML engine tests (DEVELOPER-004).
 *
 * The parser is a controlled, XXE-safe tokenizer (no DOMParser, no entity resolution, no network).
 * Tests cover formatting/minify, well-formedness errors with line/column, namespaces, attributes,
 * CDATA, comments, processing instructions, unicode, statistics, XXE safety, and duplicate attrs.
 */

import { describe, it, expect } from "vitest";
import { parseXmlDocument, formatXml, analyzeXml, type XmlNode } from "@/lib/dev/xml";

describe("formatXml — pretty print & minify", () => {
  it("pretty-prints nested elements with indentation", () => {
    const r = formatXml("<a><b><c>hi</c></b></a>", { indent: "2" });
    expect(r.ok).toBe(true);
    expect(r.output).toBe("<a>\n  <b>\n    <c>hi</c>\n  </b>\n</a>");
  });

  it("keeps a text-only element inline", () => {
    expect(formatXml("<x>  hello  </x>", { indent: "2" }).output).toBe("<x>hello</x>");
  });

  it("minifies (no whitespace between tags)", () => {
    expect(formatXml("<a>\n  <b>1</b>\n  <c/>\n</a>", { indent: "2", minify: true }).output).toBe(
      "<a><b>1</b><c/></a>"
    );
  });

  it("preserves the declaration, comments, CDATA, and processing instructions", () => {
    const src = '<?xml version="1.0"?><!-- note --><root><![CDATA[<raw>]]><?pi go?></root>';
    const out = formatXml(src, { indent: "2" }).output;
    expect(out).toContain('<?xml version="1.0"?>');
    expect(out).toContain("<!-- note -->");
    expect(out).toContain("<![CDATA[<raw>]]>");
    expect(out).toContain("<?pi go?>");
  });

  it("re-serialises self-closing and attribute-bearing elements", () => {
    const out = formatXml('<a x="1" y="2"><b/></a>', { indent: "2" }).output;
    expect(out).toBe('<a x="1" y="2">\n  <b/>\n</a>');
  });

  it("handles unicode content", () => {
    expect(formatXml("<m>₹ é 😀</m>", { indent: "2" }).output).toBe("<m>₹ é 😀</m>");
  });

  it("keeps attribute values well-formed when they contain a quote", () => {
    // A single-quoted value that holds a literal double quote must re-serialise as single-quoted
    // (never a naked double quote that would corrupt the output).
    expect(formatXml(`<a x='say "hi"'/>`, { indent: "2" }).output).toBe(`<a x='say "hi"'/>`);
  });
});

describe("parseXmlDocument — validation", () => {
  it("accepts well-formed XML", () => {
    const r = parseXmlDocument("<a><b/></a>");
    expect(r.ok).toBe(true);
    expect(r.validation.level).toBe("valid");
  });

  it("reports mismatched tags with a line and column", () => {
    const r = parseXmlDocument("<a>\n  <b></c>\n</a>");
    expect(r.ok).toBe(false);
    expect(r.validation.message).toMatch(/invalid xml/i);
    expect(r.validation.detail).toMatch(/mismatched/i);
    expect(r.validation.line).toBe(2);
  });

  it("reports an unclosed element", () => {
    expect(parseXmlDocument("<a><b></a>").validation.detail).toMatch(/mismatched|unclosed/i);
  });

  it("rejects an unquoted attribute value", () => {
    expect(parseXmlDocument("<a x=1></a>").validation.detail).toMatch(/quoted/i);
  });

  it("requires a single root element", () => {
    expect(parseXmlDocument("<a/><b/>").validation.detail).toMatch(/one root/i);
  });
});

describe("metadata & warnings", () => {
  it("detects the XML declaration and DOCTYPE", () => {
    const r = parseXmlDocument('<?xml version="1.0"?><!DOCTYPE note><note/>');
    expect(r.meta.hasDeclaration).toBe(true);
    expect(r.meta.hasDoctype).toBe(true);
  });

  it("summarises namespaces", () => {
    const r = parseXmlDocument('<root xmlns="urn:d" xmlns:x="urn:x"><x:a/></root>');
    expect(r.meta.namespaces).toContain("(default) = urn:d");
    expect(r.meta.namespaces).toContain("x = urn:x");
  });

  it("collects processing instructions and entity references", () => {
    const r = parseXmlDocument(
      '<?xml version="1.0"?><?xml-stylesheet href="a.xsl"?><a>x &amp; y &custom;</a>'
    );
    expect(r.meta.processingInstructions).toContain("xml-stylesheet");
    expect(r.meta.entityRefs).toContain("&amp;");
    expect(r.meta.entityRefs).toContain("&custom;");
  });

  it("detects duplicate attributes", () => {
    const r = parseXmlDocument('<a x="1" x="2"/>');
    expect(r.meta.duplicateAttributes).toHaveLength(1);
    expect(r.meta.duplicateAttributes[0].attr).toBe("x");
  });
});

describe("security — XXE / entity safety", () => {
  it("never resolves external entities or fetches (treats entities as literal text)", () => {
    const src =
      '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><a>&xxe;</a>';
    const r = parseXmlDocument(src);
    expect(r.ok).toBe(true);
    // The entity is recorded as a reference, NOT expanded to file contents.
    expect(r.meta.entityRefs).toContain("&xxe;");
    const formatted = formatXml(src, { indent: "2" }).output;
    expect(formatted).toContain("&xxe;");
    expect(formatted).not.toContain("root:"); // no file contents ever appear
  });

  it("does not expand a billion-laughs entity (no exponential blow-up)", () => {
    const src =
      '<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]><lolz>&lol2;</lolz>';
    const r = parseXmlDocument(src);
    expect(r.ok).toBe(true);
    // "&lol2;" stays a single literal reference — not expanded into thousands of "lol"s.
    expect(formatXml(src, { indent: "2" }).output).toContain("&lol2;");
  });
});

describe("analyzeXml — statistics", () => {
  it("counts elements, attributes, text nodes, and depth", () => {
    const nodes = parseXmlDocument('<a id="1"><b>x</b><b>y</b><!--c--></a>').nodes;
    const s = analyzeXml(nodes);
    expect(s.elements).toBe(3); // a, b, b
    expect(s.attributes).toBe(1); // id
    expect(s.textNodes).toBe(2); // x, y
    expect(s.comments).toBe(1);
    expect(s.maxDepth).toBe(2);
  });

  it("handles a larger document without error", () => {
    const big = "<root>" + "<item>x</item>".repeat(5000) + "</root>";
    const r = parseXmlDocument(big);
    expect(r.ok).toBe(true);
    expect(analyzeXml(r.nodes).elements).toBe(5001);
  });
});

describe("tree shape", () => {
  it("produces a nested node tree", () => {
    const nodes = parseXmlDocument('<a><b x="1"/>text</a>').nodes;
    const a = nodes[0] as Extract<XmlNode, { type: "element" }>;
    expect(a.type).toBe("element");
    expect(a.children[0].type).toBe("element");
    expect(a.children[1].type).toBe("text");
  });
});
