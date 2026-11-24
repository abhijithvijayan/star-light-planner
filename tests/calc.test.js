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
  near(r.C.length, 30688, 1, "full-body spiral, side points wound on their own");
  near(computeAll({ ...spec, pitch: 1.5, sideSeparate: false }).C.length, 26552, 1, "full-body spiral, all level turns");
});

test("full-body spiral keeps the two top points separate", () => {
  const r = computeAll({ ...spec, pitch: 1.5 });
  assert.equal(r.C.branches, 2);
  assert.deepEqual(Array.from(r.C.parts, (p) => p.name), ["left point", "right point", "main body", "left top point", "right top point"]);
  near(r.C.splitY, 45.95, 1.5, "split height at the top corner of the pentagon");
  const levelOnly = computeAll({ ...spec, pitch: 1.5, sideSeparate: false });
  assert.ok(levelOnly.C.length < levelOnly.B.length, "spiral that bridges the top V uses more wire");
});

test("a point edge too short for the base is reported, not drawn", () => {
  const S = buildStar({ ...spec, upperEdge: 20 });
  assert.match(S.error, /too short/);
});

test("winding direction changes the path but not the wire length", () => {
  const lr = computeAll({ ...spec, pitch: 3 });
  const rl = computeAll({ ...spec, pitch: 3, frontLR: false });
  near(lr.C.length, rl.C.length, lr.C.length * 0.005, "spiral length");
  near(lr.A_total, rl.A_total, lr.A_total * 0.005, "points + centre length");
  // second point of the first full turn: on the front face (z > 0) moving right when frontLR
  const turn = lr.C.parts.find((p) => p.name === "main body").path.slice(48 * 20, 48 * 21); // a full-size turn above the bottom tip
  const firstFront = turn.find((p) => p[2] > 1);
  const lastFront = turn.findLast((p) => p[2] > 1);
  assert.ok(turn.indexOf(firstFront) < turn.indexOf(lastFront) && firstFront[0] < lastFront[0], "front crossed left to right");
});

test("side points wound on their own get turns all along their flat underside", () => {
  const r = computeAll({ ...spec, pitch: 1.5 });
  const side = r.C.parts.find((p) => p.name === "right point");
  assert.equal(side.loops, Math.floor(80 / 1.5) + 1); // first turn at the base, then one per 1.5 cm
  // level turns would cross the 3.9 degree underside bar only every ~22 cm; wound along the point it is one turn per 1.5 cm of bar
  const S = r.S, pt = S.points.find((p) => p.name === "right point");
  const lower = Math.atan2(Math.abs(pt.tip[1] - pt.base[0][1]), Math.hypot(pt.tip[0] - pt.base[0][0], pt.tip[2] - pt.base[0][2]));
  near(1.5 / Math.sin(lower), 21.9, 0.1, "level-turn spacing along the underside");
});
