import { validateBundleShape, type Bundle } from "./requisition";

export function encodeBundle(bundle: Bundle): string {
  const bytes = new TextEncoder().encode(JSON.stringify(bundle));
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeBundle(encoded: string): Bundle {
  const trimmed = encoded.trim();
  if (!trimmed) throw new Error("Bundle value is empty.");
  const base64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error("Bundle is not valid base64url.");
  }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Bundle is not valid JSON.");
  }
  return validateBundleShape(parsed);
}

export function readBundleFromLocation(search: string, hash: string): Bundle | null {
  const params = new URLSearchParams(search);
  const fromSearch = params.get("b");
  if (fromSearch) return decodeBundle(fromSearch);
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!normalizedHash) return null;
  const hashParams = new URLSearchParams(normalizedHash);
  const fromHash = hashParams.get("b");
  return fromHash ? decodeBundle(fromHash) : null;
}

export function bundleLink(appUrl: string, bundle: Bundle): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/desk#b=${encodeBundle(bundle)}`;
}

export function bundleJson(bundle: Bundle): string {
  return JSON.stringify(bundle, null, 2);
}
