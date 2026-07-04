import type { Tool } from "@/types/tool";
import { buildToolSchemas } from "@/seo/tool-seo";

interface ToolMetadataProps {
  tool: Tool;
}

export function ToolMetadata({ tool }: ToolMetadataProps) {
  const schemas = buildToolSchemas(tool);
  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
