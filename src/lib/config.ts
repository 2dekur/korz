/** URL of the deployed Cloudflare Worker. Override with VITE_LICENSE_API env var. */
export const LICENSE_API =
  import.meta.env["VITE_LICENSE_API"] ?? "https://korz-license.YOUR_SUBDOMAIN.workers.dev";
