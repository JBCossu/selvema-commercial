// Session signée (HMAC) stockée dans un cookie, sans dépendance externe.
// Protège /config et /dashboard via un simple mot de passe (APP_PASSWORD).

const encoder = new TextEncoder();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_COOKIE = "selvema_commercial_session";

async function getKey() {
  const secret = `selvema-commercial:${process.env.APP_PASSWORD ?? ""}`;
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

export async function createSessionToken(): Promise<string> {
  const expires = String(Date.now() + SESSION_TTL_MS);
  const key = await getKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(expires)
  );
  return `${toBase64Url(encoder.encode(expires))}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return false;

  try {
    const payload = new TextDecoder().decode(fromBase64Url(payloadPart));
    const expires = Number(payload);
    if (!Number.isFinite(expires) || Date.now() > expires) return false;

    const key = await getKey();
    return crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signaturePart),
      encoder.encode(payload)
    );
  } catch {
    return false;
  }
}
