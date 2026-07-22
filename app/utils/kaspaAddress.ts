// Kaspa-style bech32 (cashaddr-flavoured) re-encoder, ported verbatim from
// rusty-kaspa crypto/addresses/src/bech32.rs.
//
// Why it exists: coinbase rewards minted before the ZKas rebrand pay to
// addresses that were ENCODED with the legacy "firecash:" HRP. The HRP is
// display-only — the payload (the actual key hash) is identical — but the
// checksum covers the literal prefix string, so converting the spelling means
// re-computing the checksum, not just swapping the prefix. The node accepts
// both spellings; the explorer shows the canonical one.

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const REV = new Map<string, number>([...CHARSET].map((c, i) => [c, i]));

function polymod(values: number[]): bigint {
  let c = 1n;
  for (const d of values) {
    const c0 = c >> 35n;
    c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(d);
    if (c0 & 0x01n) c ^= 0x98f2bc8e61n;
    if (c0 & 0x02n) c ^= 0x79b76d99e2n;
    if (c0 & 0x04n) c ^= 0xf33e5fb3c4n;
    if (c0 & 0x08n) c ^= 0xae2eabe2a8n;
    if (c0 & 0x10n) c ^= 0x1e4f43e470n;
  }
  return c ^ 1n;
}

function checksum(payload5: number[], prefix: string): bigint {
  const pfx = [...prefix].map((ch) => ch.charCodeAt(0) & 0x1f);
  return polymod([...pfx, 0, ...payload5, 0, 0, 0, 0, 0, 0, 0, 0]);
}

/** The trailing 8 five-bit groups of an address, as the 40-bit checksum value. */
function groupsToChecksum(groups5: number[]): bigint {
  let v = 0n;
  for (const g of groups5) v = (v << 5n) | BigInt(g);
  return v;
}

/** A 40-bit checksum value as 8 charset characters. */
function checksumToChars(cs: bigint): string {
  let out = "";
  for (let shift = 35n; shift >= 0n; shift -= 5n) out += CHARSET[Number((cs >> shift) & 0x1fn)];
  return out;
}

/**
 * Re-encode a legacy `firecash…:` address to the canonical `zkas…:` spelling.
 * Same payload, same destination — only the display prefix (and therefore the
 * checksum) changes. Anything that doesn't parse is returned untouched.
 */
export function canonicalAddress(address: string): string {
  const m = /^firecash(test|dev|sim)?:([qpzry9x8gf2tvdw0s3jn54khce6mua7l]{8,})$/.exec(address.toLowerCase());
  if (!m) return address;
  const oldPrefix = `firecash${m[1] ?? ""}`;
  const newPrefix = `zkas${m[1] ?? ""}`;
  const groups = [...m[2]].map((ch) => REV.get(ch)!);
  const payload5 = groups.slice(0, -8);
  // Only rewrite what verifies against the legacy checksum — never mangle data.
  if (checksum(payload5, oldPrefix) !== groupsToChecksum(groups.slice(-8))) return address;
  return `${newPrefix}:${payload5.map((v) => CHARSET[v]).join("")}${checksumToChars(checksum(payload5, newPrefix))}`;
}
