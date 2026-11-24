import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../public/calc.js", import.meta.url), "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${src}\nthis.api = { buildStar, computeAll };`, ctx);
const { buildStar, computeAll } = ctx.api;

const spec = { upperEdge: 80, bottomEdge: 112, depth: 27, sideEdge: 53, bottomInner: 58 };
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: got ${actual}, expected ${expected} ± ${tol}`);

test("every bar of every point matches the spec length", () => {
  const S = buildStar(spec);
  for (const pt of S.points) {
    const want = pt.name === "bottom point" ? 112 : 80;
    for (const b of pt.base) near(d(b, pt.tip), want, 1e-9, pt.name);
  }
});

test("inner pentagon edges and depth match the spec", () => {
  const S = buildStar(spec);
  const front = S.inner.slice(0, 5).map((v) => v.p);
  const edges = front.map((p, i) => d(p, front[(i + 1) % 5]));
  // order: mid-right, top-right, top-left, mid-left, bottom
  [53, 53, 53, 53, 58].forEach((want, i) => near(edges[i], want, 1e-9, `edge ${i}`));
  for (let i = 0; i < 5; i++) near(d(S.inner[i].p, S.inner[i + 5].p), 27, 1e-9, "strut");
  for (const t of S.tips) assert.equal(t.p[2], 0);
});

test("star is about 234 cm tall and 215 cm wide", () => {
  const S = buildStar(spec);
  near(S.ymax - S.ymin, 234.32, 0.01, "height");
  near(Math.max(...S.tips.map((t) => t.p[0])) * 2, 215.32, 0.01, "width");
});

test("wire lengths at 1.5 cm pitch", () => {
  const r = computeAll({ ...spec, pitch: 1.5 });
  near(r.A_total, 32988, 1, "points + centre");
  near(r.C.length, 26552, 1, "full-body spiral");
});

test("full-body spiral keeps the two top points separate", () => {
  const r = computeAll({ ...spec, pitch: 1.5 });
  assert.equal(r.C.branches, 2);
  assert.deepEqual(Array.from(r.C.parts, (p) => p.name), ["main body", "left top point", "right top point"]);
  near(r.C.splitY, 45.95, 1.5, "split height at the top corner of the pentagon");
  assert.ok(r.C.length < r.B.length, "spiral that bridges the top V uses more wire");
});

test("a point edge too short for the base is reported, not drawn", () => {
  const S = buildStar({ ...spec, upperEdge: 20 });
  assert.match(S.error, /too short/);
});
