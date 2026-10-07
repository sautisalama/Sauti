import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Application-level field encryption (AES-256-GCM) for secrets and sensitive
 * columns. The database only ever sees ciphertext; the key lives in the server
 * environment, so a leaked backup, SQL access or a mis-scoped RLS policy does
 * not reveal the plaintext.
 *
 *   DATA_ENCRYPTION_KEY           base64 of 32 random bytes   (current key)
 *   DATA_ENCRYPTION_KEY_PREVIOUS  same, optional — decrypt-only, for rotation
 *
 *   openssl rand -base64 32
 *
 * Format: enc:v1:<iv>:<tag>:<ciphertext>   (all base64url). Values without the
 * prefix are treated as legacy plaintext, so existing rows keep working until
 * they are next written.
 */

const PREFIX = "enc:v1:";

function loadKey(name: string): Buffer | null {
	const raw = process.env[name];
	if (!raw) return null;
	const key = Buffer.from(raw, "base64");
	if (key.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded (openssl rand -base64 32)`);
	return key;
}

export function encryptionConfigured(): boolean {
	return !!process.env.DATA_ENCRYPTION_KEY;
}

export function encryptField(plain: string | null | undefined): string | null {
	if (plain == null || plain === "") return null;
	const key = loadKey("DATA_ENCRYPTION_KEY");
	if (!key) {
		// Fail closed in production: never silently store a secret in the clear.
		if (process.env.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY is not configured");
		return plain;
	}
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	return `${PREFIX}${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ct.toString("base64url")}`;
}

export function decryptField(value: string | null | undefined): string | null {
	if (value == null || value === "") return null;
	if (!value.startsWith(PREFIX)) return value; // legacy plaintext
	const [iv, tag, ct] = value.slice(PREFIX.length).split(":");
	if (!iv || !tag || !ct) throw new Error("Malformed encrypted value");
	for (const name of ["DATA_ENCRYPTION_KEY", "DATA_ENCRYPTION_KEY_PREVIOUS"]) {
		const key = loadKey(name);
		if (!key) continue;
		try {
			const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
			d.setAuthTag(Buffer.from(tag, "base64url"));
			return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
		} catch {
			/* wrong key or tampered — try the next key */
		}
	}
	throw new Error("Could not decrypt value (wrong key or tampered data)");
}
