import { env } from "../../config";
import { CkanHarvester } from "./ckan";
import { Harvester } from ".";
import { BaseHarvesterConfig } from "./base";
import { CkanPackage } from "@/schemas/ckanPackage";
import { PortalJsCloudDataset, CkanResource } from "@/schemas/portaljs-cloud";

/**
 * Extended CKAN Package type with additional DCAT-AP fields
 */
export interface DCATAPResource extends CkanResource {
  hash?: string;
  mimetype?: string | null;
  mimetype_inner?: string | null;
  cache_url?: string | null;
  cache_last_updated?: string | null;
  datastore_active?: boolean;
  created?: string;
  last_modified?: string;
  state?: string;
  position?: number;
  id?: string;
  revision_id?: string;
  url_type?: string;
  resource_type?: string | null;
  size?: number | string | null;
  package_id?: string;
}

// Then extend both interfaces
export interface DCATAPCkanPackage extends CkanPackage {
  license_title?: string;
  license_id?: string;
  license_url?: string;
  maintainer?: string;
  maintainer_email?: string;
  author?: string;
  author_email?: string;
  metadata_created?: string;
  metadata_modified?: string;
  tags?: Array<{
    name: string;
    display_name?: string;
    id?: string;
    state?: string;
  }>;
  groups?: Array<{
    name: string;
    title?: string;
    display_name?: string;
    description?: string;
    id?: string;
  }>;
  organization?: {
    title?: string;
    name?: string;
    description?: string;
    id?: string;
  };
  isopen?: boolean;
  version?: string;
  url?: string;
  state?: string;
  type?: string;
  extras?: Array<{
    key: string;
    value: string;
  }>;
  resources?: DCATAPResource[]; // Add this line to explicitly define resource type
}

// Finally extend the PortalJsCloudDataset interface
export interface DCATAPPortalJsDataset extends PortalJsCloudDataset {
  license_title?: string;
  license_url?: string;
  metadata_created?: string;
  metadata_modified?: string;
  state?: string;
  private?: boolean;
  isopen?: boolean;
  type?: string;
  extras?: Array<{
    key: string;
    value: string;
  }>;
  resources?: DCATAPResource[]; // Override with extended resource type
}

@Harvester
export class DCATAPHarvester extends CkanHarvester<DCATAPCkanPackage> {
  constructor(args: BaseHarvesterConfig) {
    super(args);
  }

  mapSourceDatasetToTarget(pkg: DCATAPCkanPackage): DCATAPPortalJsDataset {
    const owner_org = env.PORTALJS_CLOUD_MAIN_ORG;

    // Map resources with more fields according to DCAT-AP
    const resources = (pkg.resources || []).map((r) => ({
      name: r.name || "",
      url: r.url || "",
      format: r.format || "",
      description: r.description || "",
      hash: r.hash || "",
      mimetype: r.mimetype || "",
      mimetype_inner: r.mimetype_inner || "",
      size: r.size ? String(r.size) : undefined,
      created: r.created || "",
      last_modified: r.last_modified || "",
      id: r.id || "",
      state: r.state || "active",
      position: r.position !== undefined ? r.position : 0,
    }));

    //Todo: Ask about how portaljs handle tags and groups harvesting
    // const tags = pkg.tags ? pkg.tags.map((tag) => tag.name) : [];
    // const groups = pkg.groups ? pkg.groups.map((group) => group.name) : [];

    // Build extras from fields that don't have direct mapping
    const extras: Record<string, any> = {};
    pkg.extras?.forEach((extra) => {
      extras[extra.key] = extra.value;
    });

    // Map to DCAT-AP compliant structure
    return {
      // Core metadata
      owner_org,
      name: `${owner_org}--${pkg.name}`,
      title: pkg.title || "",
      notes: pkg.notes || "",
      url: pkg.url || "",
      version: pkg.version || "",
      type: pkg.type || "dataset",

      // Temporal metadata
      metadata_created: pkg.metadata_created || "",
      metadata_modified: pkg.metadata_modified || "",

      // Licensing and access
      license_id: pkg.license_id || "",
      license_title: pkg.license_title || "",
      license_url: pkg.license_url || "",
      private: pkg.private || false,
      isopen: pkg.isopen || false,

      // Attribution
      author: pkg.author || "",
      author_email: pkg.author_email || "",
      maintainer: pkg.maintainer || "",
      maintainer_email: pkg.maintainer_email || "",

      // Resources
      resources,

      // DCAT-AP specific fields (mapped from extras or direct fields)
      language: pkg.language || extras.language || "EN",
      //   frequency: extras.frequency || "",
      //   temporal_start: extras.temporal_start || "",
      //   temporal_end: extras.temporal_end || "",
      //   publisher_name: extras.publisher_name || pkg.organization?.title || "",
      //   publisher_email: extras.publisher_email || "",
      //   contact_name: extras.contact_name || pkg.maintainer || pkg.author || "",
      //   contact_email:
      //     extras.contact_email || pkg.maintainer_email || pkg.author_email || "",
      //   theme: extras.theme || "",
      //   conforms_to: extras.conforms_to || "",
      //   extras: pkg.extras || [],
    };
  }
}
