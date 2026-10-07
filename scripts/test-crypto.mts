import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const { encryptField, decryptField } = await import("../lib/security/crypto.ts");

const secret = "ya29.a0-super-secret-access-token";
const enc = encryptField(secret)!;
assert.ok(enc.startsWith("enc:v1:") && !enc.includes(secret), "ciphertext only");
assert.equal(decryptField(enc), secret);
assert.notEqual(encryptField(secret), enc, "random IV: same plaintext encrypts differently");
assert.equal(decryptField("legacy-plaintext"), "legacy-plaintext", "legacy rows still readable");
assert.equal(encryptField(null), null);
assert.equal(decryptField(null), null);
// tamper detection
const parts = enc.split(":");
parts[4] = Buffer.from("tampered").toString("base64url");
assert.throws(() => decryptField(parts.join(":")), /decrypt/);
// key rotation: old key still decrypts, new key encrypts
const oldKey = process.env.DATA_ENCRYPTION_KEY!;
process.env.DATA_ENCRYPTION_KEY_PREVIOUS = oldKey;
process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
assert.equal(decryptField(enc), secret, "rotation: previous key decrypts old data");
const rotated = encryptField(secret)!;
delete process.env.DATA_ENCRYPTION_KEY_PREVIOUS;
assert.equal(decryptField(rotated), secret, "new key decrypts new data");
assert.throws(() => decryptField(enc), /decrypt/, "old data unreadable once previous key removed");
// bad key length rejected
process.env.DATA_ENCRYPTION_KEY = Buffer.from("short").toString("base64");
assert.throws(() => encryptField("x"), /32 bytes/);
console.log("crypto ok");
