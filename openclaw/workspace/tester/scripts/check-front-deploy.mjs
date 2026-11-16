// check-front-deploy.mjs — read-only check of the My Insurance preprod front deploy.
// Prints one JSON line: { asset, baseline, changed, hasApiV1 }
// Used by the front-redeploy watcher automation. No writes, no side effects.
const BASE = "https://develop--my-insurance-front.netlify.app";
const BASELINE_ASSET = "index-Dh0B6sAr.js";

async function get(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const html = await get(`${BASE}/`);
const match = html.match(/src="([^"]+\.js)"/);
const assetPath = match ? match[1] : null;
const asset = assetPath ? assetPath.split("/").pop() : null;

let hasApiV1 = false;
if (assetPath) {
  const url = assetPath.startsWith("http") ? assetPath : `${BASE}${assetPath}`;
  const js = await get(url);
  hasApiV1 = js.includes("/api/v1");
}

console.log(
  JSON.stringify({
    asset,
    baseline: BASELINE_ASSET,
    changed: asset !== null && asset !== BASELINE_ASSET,
    hasApiV1,
  }),
);
