import assert from "node:assert/strict";
import { isPrivateAddress } from "../lib/net/ssrf.ts";
for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1"]) assert.ok(isPrivateAddress(ip), ip);
for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "172.15.0.1", "104.18.0.1", "2606:4700::1111"]) assert.ok(!isPrivateAddress(ip), ip);
console.log("ssrf ok");
