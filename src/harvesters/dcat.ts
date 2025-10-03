import { env } from "../../config";
import { BaseHarvester, BaseHarvesterConfig } from "./base";
import { PortalJsCloudDataset } from "@/schemas/portaljs-cloud";
import { Harvester } from ".";
import {
  DCATDataset,
  DCATDistribution,
  extractString,
  extractAgentName,
  extractStringArray,
  extractDistributions,
} from "../lib/dcat";

@Harvester
class DCATHarvester extends BaseHarvester<DCATDataset> {
  constructor(args: BaseHarvesterConfig) {
    super(args);
  }

  async getSourceDatasets(): Promise<DCATDataset[]> {
    const url = this.config.source.url;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch DCAT JSON-LD: ${res.status} ${res.statusText}`
      );
    }
    const jsonLd: any[] = await res.json();

    const objectMap = new Map<string, any>();
    jsonLd.forEach((obj) => objectMap.set(obj["@id"], obj));

    const datasets: DCATDataset[] = jsonLd
      .filter((obj) =>
        obj["@type"]?.includes("http://www.w3.org/ns/dcat#Dataset")
      )
      .map((dataset) => ({
        ...dataset,
        distributions: extractDistributions(dataset, jsonLd),
        resolvedPublisherName: extractAgentName(
          dataset,
          "http://purl.org/dc/terms/publisher",
          jsonLd
        ),
      }));

    return datasets;
  }

  mapSourceDatasetToTarget(pkg: DCATDataset): PortalJsCloudDataset {
    const owner_org = env.PORTALJS_CLOUD_MAIN_ORG;

    // Map distributions to resources
    const resources = (pkg.distributions || []).map(
      (dist: DCATDistribution) => ({
        name:
          extractString(dist, "http://purl.org/dc/terms/title") ||
          "Unnamed Resource",
        url:
          extractString(dist, "http://www.w3.org/ns/dcat#downloadURL") ||
          extractString(dist, "http://www.w3.org/ns/dcat#accessURL") ||
          "",
        format:
          extractString(dist, "http://purl.org/dc/terms/format") ||
          extractString(dist, "http://www.w3.org/ns/dcat#mediaType") ||
          "",
        description:
          extractString(dist, "http://purl.org/dc/terms/description") || "",
        license_url:
          extractString(dist, "http://purl.org/dc/terms/license") || "",
      })
    );

    const extras: Array<{ key: string; value: string }> = [];
    const extraMappings = [
      { predicate: "http://purl.org/dc/terms/issued", key: "issued" },
      { predicate: "http://purl.org/dc/terms/modified", key: "modified" },
      {
        predicate: "http://www.w3.org/2002/07/owl#versionInfo",
        key: "dcat_version",
      },
      {
        predicate: "http://purl.org/dc/terms/accrualPeriodicity",
        key: "frequency",
      },
      {
        predicate: "http://purl.org/dc/terms/conformsTo",
        key: "conforms_to",
        isArray: true,
      },
      {
        predicate: "http://purl.org/dc/terms/accessRights",
        key: "access_rights",
      },
      { predicate: "http://purl.org/dc/terms/provenance", key: "provenance" },
      { predicate: "http://purl.org/dc/terms/type", key: "dcat_type" },
      { predicate: "http://purl.org/dc/terms/spatial", key: "spatial_uri" },
      { predicate: "http://purl.org/dc/terms/publisher", key: "publisher_uri" },
    ];

    extraMappings.forEach(({ predicate, key, isArray = false }) => {
      const value = isArray
        ? extractStringArray(pkg, predicate).join(", ")
        : extractString(pkg, predicate);
      if (value) extras.push({ key, value });
    });

    const skippedKeys = [
      "@id",
      "@type",
      "distributions",
      "http://www.w3.org/ns/dcat#distribution",
      "http://purl.org/dc/terms/title",
      "http://purl.org/dc/terms/description",
      "http://purl.org/dc/terms/identifier",
      "http://purl.org/dc/terms/issued",
      "http://purl.org/dc/terms/modified",
      "http://www.w3.org/2002/07/owl#versionInfo",
      "http://purl.org/dc/terms/language",
      "http://www.w3.org/ns/dcat#landingPage",
      "http://xmlns.com/foaf/0.1/page",
      "http://purl.org/dc/terms/accrualPeriodicity",
      "http://purl.org/dc/terms/conformsTo",
      "http://purl.org/dc/terms/accessRights",
      "http://purl.org/dc/terms/provenance",
      "http://purl.org/dc/terms/type",
      "http://purl.org/dc/terms/spatial",
      "http://purl.org/dc/terms/publisher",
      "http://www.w3.org/ns/dcat#contactPoint",
      "http://purl.org/dc/terms/creator",
      "http://purl.org/dc/terms/license",
    ];
    Object.keys(pkg).forEach((key) => {
      if (!skippedKeys.includes(key)) {
        const value = extractString(pkg, key) || JSON.stringify(pkg[key]);
        if (value) extras.push({ key, value });
      }
    });

    const extractedLanguage = extractString(
      pkg,
      "http://purl.org/dc/terms/language"
    );
    const validLanguages = ["EN", "FR", "ES", "DE", "IT"];
    const language = (
      validLanguages.includes(extractedLanguage) ? extractedLanguage : "EN"
    ) as "EN" | "FR" | "ES" | "DE" | "IT";
    const datasetLicense =
      extractString(pkg, "http://purl.org/dc/terms/license") ||
      (resources.length > 0 ? (resources[0] as any).license_url || "" : "");

    // Map to PortalJsCloudDataset (based on ckanext-dcat mappings)
    return {
      owner_org,
      name: `${owner_org}--${
        extractString(pkg, "http://purl.org/dc/terms/identifier") ||
        pkg["@id"].split("/").pop() ||
        "unknown"
      }`,
      title: extractString(pkg, "http://purl.org/dc/terms/title") || "",
      notes: extractString(pkg, "http://purl.org/dc/terms/description") || "",
      url: extractString(pkg, "http://www.w3.org/ns/dcat#landingPage") || "",
      language,
      author: extractString(pkg, "http://purl.org/dc/terms/creator") || "",
      maintainer: (pkg as any).resolvedPublisherName || "",
      license_id: extractString(pkg, "http://purl.org/dc/terms/license") || "",
      license_url: datasetLicense,
      contact_point:
        extractString(pkg, "http://www.w3.org/ns/dcat#contactPoint") || "",
      resources,
      extras,
    };
  }
}

export { DCATHarvester };
