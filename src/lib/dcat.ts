// Interfaces for DCAT JSON-LD (expanded form)
export interface DCATDistribution {
  "@id": string;
  "@type": string[];
  [key: string]: any;
}

export interface DCATDataset {
  "@id": string;
  "@type": string[];
  [key: string]: any;
}

// Helper to extract string value from JSON-LD predicate (e.g., [{"@value": "title"}])
export function extractString(obj: any, predicate: string): string {
  const values = obj[predicate];
  if (Array.isArray(values) && values.length > 0) {
    const first = values[0];
    return first["@value"] || first["@id"] || "";
  }
  return "";
}

export function extractAgentName(
  obj: any,
  predicate: string,
  allObjects: any[]
): string {
  const agentId = extractString(obj, predicate);
  if (agentId) {
    const agent = allObjects.find((o) => o["@id"] === agentId);
    if (agent) {
      return (
        extractString(agent, "http://xmlns.com/foaf/0.1/name") ||
        extractString(agent, "http://purl.org/dc/terms/title") ||
        ""
      );
    }
  }
  return "";
}

// Helper to extract array of strings (e.g., for multiple values)
export function extractStringArray(obj: any, predicate: string): string[] {
  const values = obj[predicate];
  if (Array.isArray(values)) {
    return values.map((v) => v["@value"] || v["@id"] || "").filter(Boolean);
  }
  return [];
}

// Helper to extract distributions by @id references
export function extractDistributions(
  dataset: DCATDataset,
  allObjects: any[]
): DCATDistribution[] {
  const distIds = extractStringArray(
    dataset,
    "http://www.w3.org/ns/dcat#distribution"
  );
  return allObjects.filter(
    (obj) =>
      distIds.includes(obj["@id"]) &&
      obj["@type"]?.includes("http://www.w3.org/ns/dcat#Distribution")
  ) as DCATDistribution[];
}
