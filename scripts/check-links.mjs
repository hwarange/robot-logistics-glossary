// data/*.json 의 모든 출처 URL 을 검사해 깨진 링크를 보고
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(import.meta.dirname, "..", "data");
const files = (await readdir(dataDir)).filter((f) => f.endsWith(".json"));

const entries = [];
for (const f of files) {
  const json = JSON.parse(await readFile(path.join(dataDir, f), "utf8"));
  for (const t of json.terms) {
    for (const s of t.sources || []) {
      entries.push({ file: f, term: t.term, name: s.name, url: s.url });
    }
  }
}

console.log(`checking ${entries.length} urls...`);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function check(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: "*/*" },
      });
      clearTimeout(timer);
      if (res.ok || [301, 302, 308].includes(res.status)) return { ok: true, status: res.status };
      if ([403, 405, 429, 503].includes(res.status) && method === "HEAD") continue; // retry with GET
      if ([403, 405, 429].includes(res.status))
        return { ok: true, status: res.status, note: "bot-blocked (probably fine)" };
      if (method === "GET") return { ok: false, status: res.status };
    } catch (e) {
      if (method === "GET") return { ok: false, status: "ERR", note: e.cause?.code || e.name };
    }
  }
  return { ok: false, status: "?" };
}

const queue = [...entries];
const bad = [];
const soft = [];
const workers = Array.from({ length: 12 }, async () => {
  while (queue.length) {
    const e = queue.shift();
    const r = await check(e.url);
    if (!r.ok) bad.push({ ...e, ...r });
    else if (r.note) soft.push({ ...e, ...r });
  }
});
await Promise.all(workers);

if (soft.length) {
  console.log(`\n-- bot-blocked (${soft.length}), likely fine:`);
  for (const b of soft) console.log(`  [${b.status}] ${b.term} :: ${b.url}`);
}
if (bad.length) {
  console.log(`\n== BROKEN (${bad.length}):`);
  for (const b of bad)
    console.log(`  [${b.status}${b.note ? " " + b.note : ""}] (${b.file}) ${b.term} :: ${b.url}`);
  process.exitCode = 1;
} else {
  console.log("\nall links OK");
}
