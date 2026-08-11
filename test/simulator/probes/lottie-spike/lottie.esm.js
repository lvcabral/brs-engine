// src/math/bezier.ts
function cubicBezierEasing(x1, y1, x2, y2) {
  if (x1 === y1 && x2 === y2) return linear;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  function solveT(x) {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 24 && lo < hi; i++) {
      const cur = sampleX(t);
      if (Math.abs(cur - x) < 1e-6) break;
      if (cur < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  }
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleY(solveT(x));
  };
}
var linear = (t) => t;

// src/model/property.ts
var slots = null;
function setSlots(s) {
  slots = s ?? null;
}
function resolved(prop) {
  if (slots && typeof prop.sid === "string") {
    const slot = slots[prop.sid];
    if (slot && typeof slot === "object" && slot.p) return slot.p;
  }
  return prop;
}
var exprEval = null;
var exprFrameRate = 30;
function setExpressionEvaluator(fn) {
  exprEval = fn;
}
function setExpressionFrameRate(fr) {
  exprFrameRate = fr || 30;
}
function rawEvaluate(prop, frame) {
  if (prop.k === void 0) return void 0;
  if (!animated(prop)) return prop.k;
  return evaluateKeyframes(prop.k, frame);
}
function evaluate(prop, frame) {
  if (prop == null) return void 0;
  if (prop.sid !== void 0) prop = resolved(prop);
  const base = rawEvaluate(prop, frame);
  if (exprEval && typeof prop.x === "string") {
    const target = prop;
    const kfs = animated(target) ? target.k : null;
    try {
      const out = exprEval(target.x, {
        value: base,
        frame,
        time: frame / exprFrameRate,
        frameRate: exprFrameRate,
        evalAt: (f) => rawEvaluate(target, f),
        keyStart: kfs ? kfs[0].t : void 0,
        keyEnd: kfs ? kfs[kfs.length - 1].t : void 0
      });
      if (out !== void 0) return out;
    } catch {
      return base;
    }
  }
  return base;
}
var scalar = (v) => Array.isArray(v) ? v[0] : typeof v === "number" ? v : void 0;
function isStatic(prop) {
  if (prop == null) return true;
  if (prop.sid !== void 0) prop = resolved(prop);
  if (exprEval && typeof prop.x === "string") return false;
  return prop.k === void 0 || !animated(prop);
}
function animated(prop) {
  if (!Array.isArray(prop.k)) return false;
  const first = prop.k[0];
  return typeof first === "object" && first !== null && typeof first.t === "number";
}
function evaluateKeyframes(kfs, frame) {
  const last = kfs.length - 1;
  if (frame <= kfs[0].t) return keyValue(kfs, 0);
  if (frame >= kfs[last].t) return keyValue(kfs, last);
  let i = 0;
  while (i < last && kfs[i + 1].t <= frame) i++;
  const k0 = kfs[i];
  const k1 = kfs[i + 1];
  const v0 = keyValue(kfs, i);
  if (k0.h === 1) return v0;
  const v1 = k0.e !== void 0 ? unwrap(k0.e) : keyValue(kfs, i + 1);
  if (v0 === void 0 || v1 === void 0) return v0 ?? v1;
  const lin = (frame - k0.t) / (k1.t - k0.t);
  const ease = easingFor(k0);
  if (Array.isArray(ease)) {
    if (Array.isArray(v0) && Array.isArray(v1) && !(Array.isArray(k0.to) && Array.isArray(k0.ti))) {
      return v0.map((a, idx) => {
        const fn = ease[Math.min(idx, ease.length - 1)];
        return lerp(a, v1[idx] ?? a, fn(lin));
      });
    }
    return interpolate(v0, v1, ease[0](lin), k0);
  }
  return interpolate(v0, v1, ease(lin), k0);
}
function keyValue(kfs, i) {
  for (let j = i; j >= 0; j--) {
    if (j < i && kfs[j].e !== void 0) return unwrap(kfs[j].e);
    if (kfs[j].s !== void 0) return unwrap(kfs[j].s);
  }
  return void 0;
}
var isPath = (v) => v !== null && typeof v === "object" && Array.isArray(v.v);
function unwrap(v) {
  if (Array.isArray(v) && v.length === 1 && isPath(v[0])) return v[0];
  return v;
}
var easingCache = /* @__PURE__ */ new WeakMap();
var clamp01 = (v) => Math.min(1, Math.max(0, v));
function pickAt(v, idx, fallback) {
  const n = Array.isArray(v) ? v[Math.min(idx, v.length - 1)] : v;
  return typeof n === "number" ? n : fallback;
}
function easeAt(kf, idx) {
  return cubicBezierEasing(
    clamp01(pickAt(kf.o?.x, idx, 1 / 3)),
    pickAt(kf.o?.y, idx, 1 / 3),
    clamp01(pickAt(kf.i?.x, idx, 2 / 3)),
    pickAt(kf.i?.y, idx, 2 / 3)
  );
}
function easingFor(kf) {
  let fn = easingCache.get(kf);
  if (!fn) {
    const dims = Math.max(
      Array.isArray(kf.o?.x) ? kf.o.x.length : 1,
      Array.isArray(kf.i?.x) ? kf.i.x.length : 1
    );
    if (dims > 1) {
      const fns = [];
      for (let d = 0; d < dims; d++) fns.push(easeAt(kf, d));
      const same = fns.every(
        (_, d) => d === 0 || pickAt(kf.o?.x, d, 1 / 3) === pickAt(kf.o?.x, 0, 1 / 3) && pickAt(kf.o?.y, d, 1 / 3) === pickAt(kf.o?.y, 0, 1 / 3) && pickAt(kf.i?.x, d, 2 / 3) === pickAt(kf.i?.x, 0, 2 / 3) && pickAt(kf.i?.y, d, 2 / 3) === pickAt(kf.i?.y, 0, 2 / 3)
      );
      fn = same ? fns[0] : fns;
    } else {
      fn = easeAt(kf, 0);
    }
    easingCache.set(kf, fn);
  }
  return fn;
}
var lerp = (a, b, t) => a + (b - a) * t;
function interpolate(v0, v1, t, kf) {
  if (typeof v0 === "number") return lerp(v0, typeof v1 === "number" ? v1 : v0, t);
  if (isPath(v0) && isPath(v1)) {
    return {
      c: v0.c,
      v: lerpPoints(v0.v, v1.v, t),
      i: lerpPoints(v0.i, v1.i, t),
      o: lerpPoints(v0.o, v1.o, t)
    };
  }
  if (Array.isArray(v0) && Array.isArray(v1)) {
    if (Array.isArray(kf.to) && Array.isArray(kf.ti) && v0.length >= 2) {
      return spatialBezier(v0, v1, kf.to, kf.ti, t);
    }
    return v0.map((a, idx) => lerp(a, v1[idx] ?? a, t));
  }
  return t < 1 ? v0 : v1;
}
function lerpPoints(p0 = [], p1 = [], t) {
  return p0.map((pt, i) => {
    const q = p1[i] ?? pt;
    return [lerp(pt[0] ?? 0, q[0] ?? 0, t), lerp(pt[1] ?? 0, q[1] ?? 0, t)];
  });
}
function spatialBezier(v0, v1, to, ti, t) {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return v0.map((a, i) => {
    const b = v1[i] ?? a;
    const c1 = a + (to[i] ?? 0);
    const c2 = b + (ti[i] ?? 0);
    return w0 * a + w1 * c1 + w2 * c2 + w3 * b;
  });
}

// src/util.ts
function fmt(n) {
  if (!Number.isFinite(n)) return "0";
  const r = Math.round(n * 1e3) / 1e3;
  return Object.is(r, -0) ? "0" : String(r);
}
var HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
function safeHexColor(value, fallback = "#000000") {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

// src/math/matrix.ts
var identity = () => [1, 0, 0, 1, 0, 0];
function multiply(m1, m2) {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ];
}
var translation = (x, y) => [1, 0, 0, 1, x, y];
var scaling = (x, y) => [x, 0, 0, y, 0, 0];
function rotation(deg) {
  const r = deg * Math.PI / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [cos, sin, -sin, cos, 0, 0];
}
function skewX(deg) {
  return [1, 0, Math.tan(deg * Math.PI / 180), 1, 0, 0];
}
function invert(m) {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (!det) return identity();
  const id = 1 / det;
  return [d * id, -b * id, -c * id, a * id, (c * f - d * e) * id, (b * e - a * f) * id];
}
var isIdentity = (m) => m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
var toSvg = (m) => `matrix(${m.map(fmt).join(" ")})`;

// src/math/color.ts
function rgb(c = []) {
  const [r, g, b] = to255(c);
  return `rgb(${r},${g},${b})`;
}
function to255(c = []) {
  const parts = [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0];
  const scale = parts.some((v) => v > 1) ? 1 : 255;
  const [r, g, b] = parts.map((v) => Math.round(Math.min(255, Math.max(0, v * scale))));
  return [r, g, b];
}
function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length < 6) h = h.split("").map((ch) => ch + ch).join("");
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0
  ];
}

// src/scene/transform.ts
function positionAt(ks = {}, frame) {
  if (!ks.p) return [0, 0];
  if (ks.p.s) {
    return [scalar(evaluate(ks.p.x, frame)) ?? 0, scalar(evaluate(ks.p.y, frame)) ?? 0];
  }
  const p = evaluate(ks.p, frame);
  return Array.isArray(p) ? [p[0] ?? 0, p[1] ?? 0] : [0, 0];
}
function transformMatrix(ks = {}, frame, autoOrient = 0) {
  let m = identity();
  const [px, py] = positionAt(ks, frame);
  if (px || py) m = multiply(m, translation(px, py));
  if (autoOrient) m = multiply(m, rotation(autoOrient));
  const r = ks.r ? scalar(evaluate(ks.r, frame)) ?? 0 : 0;
  if (r) m = multiply(m, rotation(r));
  const sk = ks.sk ? scalar(evaluate(ks.sk, frame)) ?? 0 : 0;
  if (sk) {
    const sa = ks.sa ? scalar(evaluate(ks.sa, frame)) ?? 0 : 0;
    if (sa) m = multiply(m, rotation(-sa));
    m = multiply(m, skewX(-sk));
    if (sa) m = multiply(m, rotation(sa));
  }
  const s = ks.s ? evaluate(ks.s, frame) : void 0;
  if (Array.isArray(s) && (s[0] !== 100 || (s[1] ?? s[0]) !== 100)) {
    m = multiply(m, scaling((s[0] ?? 100) / 100, (s[1] ?? s[0] ?? 100) / 100));
  }
  const a = ks.a ? evaluate(ks.a, frame) : void 0;
  if (Array.isArray(a) && ((a[0] ?? 0) || (a[1] ?? 0))) {
    m = multiply(m, translation(-(a[0] ?? 0), -(a[1] ?? 0)));
  }
  return m;
}
function transformOpacity(ks = {}, frame) {
  if (!ks.o) return 1;
  const o = scalar(evaluate(ks.o, frame));
  return typeof o === "number" ? Math.min(1, Math.max(0, o / 100)) : 1;
}

// src/scene/shape.ts
var KAPPA = 0.5522847498307936;
function reversePath(p) {
  const n = p.v.length;
  const v = new Array(n);
  const i = new Array(n);
  const o = new Array(n);
  for (let j = 0; j < n; j++) {
    const k = n - 1 - j;
    v[j] = p.v[k];
    i[j] = p.o?.[k] ?? [0, 0];
    o[j] = p.i?.[k] ?? [0, 0];
  }
  return { c: p.c, v, i, o };
}
function polystarPath(p = [0, 0], points, rotationDeg, outerR, innerR, outerRound, innerRound, star) {
  const cx = p[0] ?? 0;
  const cy = p[1] ?? 0;
  const numPts = Math.max(3, Math.floor(points)) * (star ? 2 : 1);
  const angle = Math.PI * 2 / numPts;
  let currentAng = -Math.PI / 2 + rotationDeg * Math.PI / 180;
  const longPerim = 2 * Math.PI * outerR / (numPts * (star ? 2 : 4));
  const shortPerim = 2 * Math.PI * innerR / (numPts * 2);
  const v = [];
  const inn = [];
  const out = [];
  let longFlag = true;
  for (let j = 0; j < numPts; j++) {
    const rad = longFlag || !star ? outerR : innerR;
    const roundness = (longFlag || !star ? outerRound : innerRound) / 100;
    const perim = longFlag || !star ? longPerim : shortPerim;
    const x = rad * Math.cos(currentAng);
    const y = rad * Math.sin(currentAng);
    const len = Math.hypot(x, y);
    const tx = len ? y / len : 0;
    const ty = len ? -x / len : 0;
    const k = perim * roundness;
    v.push([cx + x, cy + y]);
    out.push([-tx * k, -ty * k]);
    inn.push([tx * k, ty * k]);
    longFlag = !longFlag;
    currentAng += angle;
  }
  return { c: true, v, i: inn, o: out };
}
function ellipsePath(p = [0, 0], s = [0, 0]) {
  const [cx, cy] = p;
  const rx = (s[0] ?? 0) / 2;
  const ry = (s[1] ?? 0) / 2;
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return {
    c: true,
    v: [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]],
    o: [[kx, 0], [0, ky], [-kx, 0], [0, -ky]],
    i: [[-kx, 0], [0, -ky], [kx, 0], [0, ky]]
  };
}
function rectPath(p = [0, 0], s = [0, 0], r = 0) {
  const [cx, cy] = p;
  const hw = (s[0] ?? 0) / 2;
  const hh = (s[1] ?? 0) / 2;
  const rad = Math.min(Math.max(r || 0, 0), hw, hh);
  if (!rad) {
    const z2 = [0, 0];
    return {
      c: true,
      v: [[cx + hw, cy - hh], [cx + hw, cy + hh], [cx - hw, cy + hh], [cx - hw, cy - hh]],
      o: [z2, z2, z2, z2],
      i: [z2, z2, z2, z2]
    };
  }
  const k = rad * KAPPA;
  const z = [0, 0];
  return {
    c: true,
    v: [
      [cx + hw - rad, cy - hh],
      [cx + hw, cy - hh + rad],
      [cx + hw, cy + hh - rad],
      [cx + hw - rad, cy + hh],
      [cx - hw + rad, cy + hh],
      [cx - hw, cy + hh - rad],
      [cx - hw, cy - hh + rad],
      [cx - hw + rad, cy - hh]
    ],
    o: [[k, 0], z, [0, k], z, [-k, 0], z, [0, -k], z],
    i: [z, [0, -k], z, [k, 0], z, [0, k], z, [-k, 0]]
  };
}

// src/scene/modifiers.ts
var SAMPLES = 16;
function makeSeg(ax, ay, c1x, c1y, c2x, c2y, bx, by) {
  const table = [0];
  let px = ax;
  let py = ay;
  let len = 0;
  for (let k = 1; k <= SAMPLES; k++) {
    const t = k / SAMPLES;
    const u = 1 - t;
    const w0 = u * u * u;
    const w1 = 3 * u * u * t;
    const w2 = 3 * u * t * t;
    const w3 = t * t * t;
    const x = w0 * ax + w1 * c1x + w2 * c2x + w3 * bx;
    const y = w0 * ay + w1 * c1y + w2 * c2y + w3 * by;
    len += Math.hypot(x - px, y - py);
    table.push(len);
    px = x;
    py = y;
  }
  return { ax, ay, c1x, c1y, c2x, c2y, bx, by, len, table };
}
function segmentsOf(p) {
  const n = p.v.length;
  const count = p.c ? n : n - 1;
  const segs = [];
  for (let j = 0; j < count; j++) {
    const k = (j + 1) % n;
    const a = p.v[j];
    const b = p.v[k];
    const o = p.o?.[j] ?? [0, 0];
    const i = p.i?.[k] ?? [0, 0];
    segs.push(
      makeSeg(
        a[0],
        a[1],
        a[0] + (o[0] ?? 0),
        a[1] + (o[1] ?? 0),
        b[0] + (i[0] ?? 0),
        b[1] + (i[1] ?? 0),
        b[0],
        b[1]
      )
    );
  }
  return segs;
}
function segsToPath(segs, closed) {
  const v = [[segs[0].ax, segs[0].ay]];
  const i = [[0, 0]];
  const o = [];
  for (let j = 0; j < segs.length; j++) {
    const s = segs[j];
    o.push([s.c1x - s.ax, s.c1y - s.ay]);
    {
      v.push([s.bx, s.by]);
      i.push([s.c2x - s.bx, s.c2y - s.by]);
    }
  }
  o.push([0, 0]);
  return { c: closed, v, i, o };
}
function tAtLength(seg, target) {
  if (target <= 0) return 0;
  if (target >= seg.len) return 1;
  const table = seg.table;
  let lo = 0;
  let hi = SAMPLES;
  while (lo < hi - 1) {
    const mid = lo + hi >> 1;
    if (table[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = table[lo + 1] - table[lo];
  const f = span > 0 ? (target - table[lo]) / span : 0;
  return (lo + f) / SAMPLES;
}
function subSeg(s, t0, t1) {
  const [ax, ay, c1x, c1y, c2x, c2y, bx, by] = splitRange(
    s.ax,
    s.ay,
    s.c1x,
    s.c1y,
    s.c2x,
    s.c2y,
    s.bx,
    s.by,
    t0,
    t1
  );
  return makeSeg(ax, ay, c1x, c1y, c2x, c2y, bx, by);
}
function splitRange(x0, y0, x1, y1, x2, y2, x3, y3, t0, t1) {
  if (t0 > 0) {
    const r = splitAt(x0, y0, x1, y1, x2, y2, x3, y3, t0, false);
    [x0, y0, x1, y1, x2, y2, x3, y3] = r;
    t1 = (t1 - t0) / (1 - t0);
  }
  if (t1 < 1) {
    return splitAt(x0, y0, x1, y1, x2, y2, x3, y3, t1, true);
  }
  return [x0, y0, x1, y1, x2, y2, x3, y3];
}
function splitAt(x0, y0, x1, y1, x2, y2, x3, y3, t, left) {
  const ux = x0 + (x1 - x0) * t, uy = y0 + (y1 - y0) * t;
  const vx = x1 + (x2 - x1) * t, vy = y1 + (y2 - y1) * t;
  const wx = x2 + (x3 - x2) * t, wy = y2 + (y3 - y2) * t;
  const mx = ux + (vx - ux) * t, my = uy + (vy - uy) * t;
  const nx = vx + (wx - vx) * t, ny = vy + (wy - vy) * t;
  const px = mx + (nx - mx) * t, py = my + (ny - my) * t;
  return left ? [x0, y0, ux, uy, mx, my, px, py] : [px, py, nx, ny, wx, wy, x3, y3];
}
function cutSegs(segs, from, to, wrap) {
  const out = [];
  const rounds = wrap ? 2 : 1;
  let pos = 0;
  for (let r = 0; r < rounds && pos < to; r++) {
    for (const seg of segs) {
      const s0 = pos;
      const s1 = pos + seg.len;
      if (seg.len > 0 && s1 > from && s0 < to) {
        const t0 = from > s0 ? tAtLength(seg, from - s0) : 0;
        const t1 = to < s1 ? tAtLength(seg, to - s0) : 1;
        out.push(t0 > 0 || t1 < 1 ? subSeg(seg, t0, t1) : seg);
      }
      pos = s1;
      if (pos >= to) break;
    }
  }
  return out;
}
var totalLen = (segs) => {
  let L = 0;
  for (const s of segs) L += s.len;
  return L;
};
function trimPaths(paths, s, e, off, simultaneous) {
  let lo = Math.max(0, Math.min(1, Math.min(s, e)));
  let hi = Math.max(0, Math.min(1, Math.max(s, e)));
  const span = hi - lo;
  if (span >= 1) return paths;
  if (span <= 0) return [];
  let a = lo + off;
  a -= Math.floor(a);
  const b = a + span;
  const entries = paths.map((p) => ({ segs: segmentsOf(p), closed: !!p.c }));
  if (!simultaneous || entries.length === 1) {
    const out2 = [];
    for (const ent of entries) out2.push(...cutOne(ent.segs, ent.closed, a, b));
    return out2;
  }
  const lens = entries.map((ent) => totalLen(ent.segs));
  const L = lens.reduce((x, y) => x + y, 0);
  if (!L) return [];
  const ivals = b <= 1 ? [[a, b]] : [[a, 1], [0, b - 1]];
  const out = [];
  let acc = 0;
  for (let idx = 0; idx < entries.length; idx++) {
    const ent = entries[idx];
    const gs = acc / L;
    const ge = (acc + lens[idx]) / L;
    acc += lens[idx];
    if (ge <= gs) continue;
    for (const [x, y] of ivals) {
      const o0 = Math.max(x, gs);
      const o1 = Math.min(y, ge);
      if (o1 <= o0) continue;
      const from = (o0 - gs) / (ge - gs) * lens[idx];
      const to = (o1 - gs) / (ge - gs) * lens[idx];
      const cutted = cutSegs(ent.segs, from, to, false);
      if (cutted.length) out.push(segsToPath(cutted, false));
    }
  }
  return out;
}
function cutOne(segs, closed, a, b) {
  const L = totalLen(segs);
  if (!L) return [];
  const from = a * L;
  const to = b * L;
  if (closed) {
    const cutted = cutSegs(segs, from, to, to > L);
    return cutted.length ? [segsToPath(cutted, false)] : [];
  }
  const out = [];
  const first = cutSegs(segs, from, Math.min(to, L), false);
  if (first.length) out.push(segsToPath(first, false));
  if (to > L) {
    const second = cutSegs(segs, 0, to - L, false);
    if (second.length) out.push(segsToPath(second, false));
  }
  return out;
}
var ROUND_HANDLE = 0.5519;
function roundCorners(p, r) {
  if (r <= 0 || p.v.length < 3) return p;
  const n = p.v.length;
  const v = [];
  const i = [];
  const o = [];
  for (let j = 0; j < n; j++) {
    const iT = p.i?.[j] ?? [0, 0];
    const oT = p.o?.[j] ?? [0, 0];
    const corner = !iT[0] && !iT[1] && !oT[0] && !oT[1];
    const interior = p.c || j > 0 && j < n - 1;
    if (!corner || !interior) {
      v.push(p.v[j]);
      i.push(iT);
      o.push(oT);
      continue;
    }
    const cur = p.v[j];
    const prev = p.v[(j - 1 + n) % n];
    const next = p.v[(j + 1) % n];
    const dPrev = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    const dNext = Math.hypot(cur[0] - next[0], cur[1] - next[1]);
    const fPrev = dPrev ? Math.min(dPrev / 2, r) / dPrev : 0;
    const fNext = dNext ? Math.min(dNext / 2, r) / dNext : 0;
    const A = [cur[0] + (prev[0] - cur[0]) * fPrev, cur[1] + (prev[1] - cur[1]) * fPrev];
    const B = [cur[0] + (next[0] - cur[0]) * fNext, cur[1] + (next[1] - cur[1]) * fNext];
    v.push(A);
    i.push([0, 0]);
    o.push([(cur[0] - A[0]) * ROUND_HANDLE, (cur[1] - A[1]) * ROUND_HANDLE]);
    v.push(B);
    i.push([(cur[0] - B[0]) * ROUND_HANDLE, (cur[1] - B[1]) * ROUND_HANDLE]);
    o.push([0, 0]);
  }
  return { c: p.c, v, i, o };
}
function zigZag(p, amp, ridges, smooth) {
  const segs = segmentsOf(p);
  if (!segs.length || ridges < 1 || !amp) return p;
  const per = Math.max(1, Math.round(ridges));
  const v = [];
  const i = [];
  const o = [];
  let dir = 1;
  const pushPt = (x, y, tx, ty, tlen) => {
    v.push([x, y]);
    if (smooth && tlen > 0) {
      i.push([-tx * tlen, -ty * tlen]);
      o.push([tx * tlen, ty * tlen]);
    } else {
      i.push([0, 0]);
      o.push([0, 0]);
    }
  };
  for (let sIdx = 0; sIdx < segs.length; sIdx++) {
    const s = segs[sIdx];
    const step = s.len / (per + 1);
    const tlen = step / 2 * 0.5;
    if (sIdx === 0 || !p.c) {
      if (sIdx === 0) {
        const [tx, ty] = tangentAt(s, 0);
        pushPt(s.ax, s.ay, tx, ty, tlen);
      }
    }
    for (let k = 1; k <= per; k++) {
      const t = tAtLength(s, step * k);
      const [px, py] = pointAt(s, t);
      const [tx, ty] = tangentAt(s, t);
      const nx = -ty * amp * dir;
      const ny = tx * amp * dir;
      pushPt(px + nx, py + ny, tx, ty, tlen);
      dir = -dir;
    }
    if (!(p.c && sIdx === segs.length - 1)) {
      const [tx, ty] = tangentAt(s, 1);
      pushPt(s.bx, s.by, tx, ty, tlen);
    }
  }
  return { c: p.c, v, i, o };
}
function pointAt(s, t) {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return [
    w0 * s.ax + w1 * s.c1x + w2 * s.c2x + w3 * s.bx,
    w0 * s.ay + w1 * s.c1y + w2 * s.c2y + w3 * s.by
  ];
}
function tangentAt(s, t) {
  const u = 1 - t;
  let dx = 3 * u * u * (s.c1x - s.ax) + 6 * u * t * (s.c2x - s.c1x) + 3 * t * t * (s.bx - s.c2x);
  let dy = 3 * u * u * (s.c1y - s.ay) + 6 * u * t * (s.c2y - s.c1y) + 3 * t * t * (s.by - s.c2y);
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}
function puckerBloat(p, amount) {
  const n = p.v.length;
  if (!n || !amount) return p;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pt of p.v) {
    if (pt[0] < minX) minX = pt[0];
    if (pt[0] > maxX) maxX = pt[0];
    if (pt[1] < minY) minY = pt[1];
    if (pt[1] > maxY) maxY = pt[1];
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const kv = 1 - amount / 100;
  const kh = 1 + amount / 100;
  const v = [];
  const i = [];
  const o = [];
  for (let j = 0; j < n; j++) {
    const pt = p.v[j];
    const iT = p.i?.[j] ?? [0, 0];
    const oT = p.o?.[j] ?? [0, 0];
    const nvx = cx + (pt[0] - cx) * kv;
    const nvy = cy + (pt[1] - cy) * kv;
    const iax = cx + (pt[0] + iT[0] - cx) * kh;
    const iay = cy + (pt[1] + iT[1] - cy) * kh;
    const oax = cx + (pt[0] + oT[0] - cx) * kh;
    const oay = cy + (pt[1] + oT[1] - cy) * kh;
    v.push([nvx, nvy]);
    i.push([iax - nvx, iay - nvy]);
    o.push([oax - nvx, oay - nvy]);
  }
  return { c: p.c, v, i, o };
}
function twist(p, angleDeg, center) {
  const n = p.v.length;
  if (!n || !angleDeg) return p;
  const cx = center[0] ?? 0;
  const cy = center[1] ?? 0;
  let maxD = 0;
  for (const pt of p.v) {
    const d = Math.hypot(pt[0] - cx, pt[1] - cy);
    if (d > maxD) maxD = d;
  }
  if (!maxD) return p;
  const rot = (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    const theta = angleDeg * Math.PI / 180 * (1 - Math.min(1, d / maxD));
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  };
  const v = [];
  const i = [];
  const o = [];
  for (let j = 0; j < n; j++) {
    const pt = p.v[j];
    const iT = p.i?.[j] ?? [0, 0];
    const oT = p.o?.[j] ?? [0, 0];
    const nv = rot(pt[0], pt[1]);
    const ni = rot(pt[0] + iT[0], pt[1] + iT[1]);
    const no = rot(pt[0] + oT[0], pt[1] + oT[1]);
    v.push([nv[0], nv[1]]);
    i.push([ni[0] - nv[0], ni[1] - nv[1]]);
    o.push([no[0] - nv[0], no[1] - nv[1]]);
  }
  return { c: p.c, v, i, o };
}
var unit = (a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  return l < 1e-9 ? null : [dx / l, dy / l];
};
function lineIntersect(a, ad, b, bd) {
  const det = ad[0] * bd[1] - ad[1] * bd[0];
  if (Math.abs(det) < 1e-9) return null;
  const t = ((b[0] - a[0]) * bd[1] - (b[1] - a[1]) * bd[0]) / det;
  return [a[0] + ad[0] * t, a[1] + ad[1] * t];
}
function offsetSeg(s, d) {
  const p0 = [s.ax, s.ay];
  const p1 = [s.c1x, s.c1y];
  const p2 = [s.c2x, s.c2y];
  const p3 = [s.bx, s.by];
  const d1 = unit(p0, p1) ?? unit(p0, p2) ?? unit(p0, p3) ?? [1, 0];
  const d2 = unit(p1, p2) ?? d1;
  const d3 = unit(p2, p3) ?? d2;
  const n1 = [d1[1] * d, -d1[0] * d];
  const n2 = [d2[1] * d, -d2[0] * d];
  const n3 = [d3[1] * d, -d3[0] * d];
  const q0 = [p0[0] + n1[0], p0[1] + n1[1]];
  const q3 = [p3[0] + n3[0], p3[1] + n3[1]];
  const q1 = lineIntersect(q0, d1, [p1[0] + n2[0], p1[1] + n2[1]], d2) ?? [p1[0] + (n1[0] + n2[0]) / 2, p1[1] + (n1[1] + n2[1]) / 2];
  const q2 = lineIntersect([p1[0] + n2[0], p1[1] + n2[1]], d2, q3, d3) ?? [p2[0] + (n2[0] + n3[0]) / 2, p2[1] + (n2[1] + n3[1]) / 2];
  return { p0: q0, c1: q1, c2: q2, p3: q3, dStart: d1, dEnd: d3, jointStart: p0, jointEnd: p3 };
}
function offsetPath(p, amount, miterLimit, join = 2) {
  if (!amount || p.v.length < 2) return p;
  const segs = segmentsOf(p);
  if (!segs.length) return p;
  const off = [];
  for (const s of segs) {
    const curved = s.c1x !== s.ax || s.c1y !== s.ay || s.c2x !== s.bx || s.c2y !== s.by;
    if (curved) {
      off.push(offsetSeg(subSeg(s, 0, 0.5), amount), offsetSeg(subSeg(s, 0.5, 1), amount));
    } else {
      off.push(offsetSeg(s, amount));
    }
  }
  const v = [];
  const i = [];
  const o = [];
  const push2 = (pt, inn, out) => {
    v.push(pt);
    i.push(inn);
    o.push(out);
  };
  const r = Math.abs(amount);
  const maxMiter = Math.max(1, miterLimit || 4) * r;
  let carryIn = [0, 0];
  let firstIn = null;
  for (let idx = 0; idx < off.length; idx++) {
    const seg = off[idx];
    push2(seg.p0, carryIn, [seg.c1[0] - seg.p0[0], seg.c1[1] - seg.p0[1]]);
    carryIn = [0, 0];
    const wrap = idx === off.length - 1;
    const next = wrap ? p.c ? off[0] : null : off[idx + 1];
    let endOut = [0, 0];
    let miterPt = null;
    if (next) {
      const joint = seg.jointEnd;
      const gap = Math.hypot(next.p0[0] - seg.p3[0], next.p0[1] - seg.p3[1]);
      if (gap > 1e-6) {
        if (join === 2) {
          const a0 = Math.atan2(seg.p3[1] - joint[1], seg.p3[0] - joint[0]);
          const a1 = Math.atan2(next.p0[1] - joint[1], next.p0[0] - joint[0]);
          let sweep = a1 - a0;
          while (sweep > Math.PI) sweep -= 2 * Math.PI;
          while (sweep < -Math.PI) sweep += 2 * Math.PI;
          const k = 4 / 3 * Math.tan(sweep / 4) * r;
          endOut = [-Math.sin(a0) * k, Math.cos(a0) * k];
          const inHandle = [Math.sin(a1) * k, -Math.cos(a1) * k];
          if (wrap) firstIn = inHandle;
          else carryIn = inHandle;
        } else if (join === 1) {
          const m = lineIntersect(seg.p3, seg.dEnd, next.p0, next.dStart);
          if (m && Math.hypot(m[0] - joint[0], m[1] - joint[1]) <= maxMiter) miterPt = m;
        }
      }
    }
    push2(seg.p3, [seg.c2[0] - seg.p3[0], seg.c2[1] - seg.p3[1]], endOut);
    if (miterPt) push2(miterPt, [0, 0], [0, 0]);
  }
  if (firstIn) i[0] = firstIn;
  return { c: p.c, v, i, o };
}
function pathSampler(p) {
  const segs = segmentsOf(p);
  if (!segs.length) return null;
  const L = totalLen(segs);
  return {
    length: L,
    at(d) {
      let pos = 0;
      let clamped = Math.min(Math.max(d, 0), L);
      for (let j = 0; j < segs.length; j++) {
        const s = segs[j];
        if (clamped <= pos + s.len || j === segs.length - 1) {
          const t = tAtLength(s, Math.min(Math.max(clamped - pos, 0), s.len));
          const [x, y] = pointAt(s, t);
          const [tx, ty] = tangentAt(s, t);
          return { x, y, angle: Math.atan2(ty, tx) };
        }
        pos += s.len;
      }
      return { x: segs[0].ax, y: segs[0].ay, angle: 0 };
    }
  };
}
function signedArea(p) {
  let area2 = 0;
  const n = p.v.length;
  for (let j = 0; j < n; j++) {
    const a = p.v[j];
    const b = p.v[(j + 1) % n];
    area2 += a[0] * b[1] - b[0] * a[1];
  }
  return area2 / 2;
}

// src/scene/text.ts
function textEnv(data) {
  if (!Array.isArray(data.chars) || !data.chars.length) return null;
  const chars = /* @__PURE__ */ new Map();
  for (const c of data.chars) {
    if (!c || typeof c.ch !== "string") continue;
    chars.set(glyphKey(c.ch, c.fFamily ?? "", c.style ?? ""), {
      shapes: c.data?.shapes ?? [],
      w: typeof c.w === "number" ? c.w : 0
    });
  }
  const fonts = /* @__PURE__ */ new Map();
  for (const f of data.fonts?.list ?? []) {
    if (f?.fName) fonts.set(f.fName, f);
  }
  return { chars, fonts };
}
var glyphKey = (ch, family, style) => ch + " " + family + " " + style;
function textDocAt(layer2, frame) {
  const d = layer2.t?.d;
  if (!d) return void 0;
  const k = d.k;
  if (!Array.isArray(k)) return k;
  let doc;
  for (const kf of k) {
    if (kf && typeof kf.t === "number" && kf.t <= frame && kf.s) doc = kf.s;
    if (kf && typeof kf.t === "number" && kf.t > frame) break;
  }
  return doc ?? k[0]?.s;
}
function isStaticDoc(layer2) {
  const k = layer2.t?.d?.k;
  return !Array.isArray(k) || k.length <= 1;
}
function shapeFactor(shape, u, lo, hi) {
  if (hi <= lo) return 0;
  if (u < lo || u >= hi) return 0;
  const t = (u - lo) / (hi - lo);
  switch (shape) {
    case 2:
      return t;
    case 3:
      return 1 - t;
    case 4:
      return 1 - Math.abs(t * 2 - 1);
    case 5:
      return Math.sqrt(Math.max(0, 1 - (t * 2 - 1) ** 2));
    case 6: {
      const x = 1 - Math.abs(t * 2 - 1);
      return x * x * (3 - 2 * x);
    }
    default:
      return 1;
  }
}
function hasAnimators(layer2) {
  const a = layer2.t?.a;
  return Array.isArray(a) && a.length > 0;
}
function textAnimators(layer2, frame, chars, totalChars) {
  const anims = layer2.t?.a;
  if (!Array.isArray(anims) || !anims.length || !chars.length) return null;
  const mods = chars.map(() => ({ dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, opacity: 1 }));
  for (const an of anims) {
    if (!an) continue;
    const sel = an.s ?? {};
    const props = an.a ?? {};
    const sVal = scalar(evaluate(sel.s, frame)) ?? 0;
    const eVal = sel.e !== void 0 ? scalar(evaluate(sel.e, frame)) ?? 100 : 100;
    const oVal = scalar(evaluate(sel.o, frame)) ?? 0;
    const amount = sel.a !== void 0 ? (scalar(evaluate(sel.a, frame)) ?? 100) / 100 : 1;
    const shape = sel.sh ?? 1;
    const units = sel.r ?? 1;
    const p = evaluate(props.p, frame);
    const sc = evaluate(props.s, frame);
    const rot = scalar(evaluate(props.r, frame)) ?? 0;
    const op = props.o !== void 0 ? scalar(evaluate(props.o, frame)) : void 0;
    const fc = props.fc ? evaluate(props.fc, frame) : void 0;
    const trk = scalar(evaluate(props.t, frame)) ?? 0;
    let lo = sVal + oVal;
    let hi = eVal + oVal;
    if (hi < lo) [lo, hi] = [hi, lo];
    let cumTrack = 0;
    for (let ci = 0; ci < chars.length; ci++) {
      const idx = chars[ci].charIndex;
      const u = units === 2 ? idx : (idx + 0.5) / Math.max(1, totalChars) * 100;
      const f = shapeFactor(shape, u, lo, hi) * amount;
      if (trk) {
        cumTrack += trk * f;
        mods[ci].dx += cumTrack;
      }
      if (!f) continue;
      const m = mods[ci];
      if (Array.isArray(p)) {
        m.dx += (p[0] ?? 0) * f;
        m.dy += (p[1] ?? 0) * f;
      }
      if (Array.isArray(sc)) {
        m.sx *= 1 + ((sc[0] ?? 100) / 100 - 1) * f;
        m.sy *= 1 + ((sc[1] ?? sc[0] ?? 100) / 100 - 1) * f;
      }
      if (rot) m.rot += rot * f;
      if (op !== void 0 && op !== null) m.opacity *= 1 + (op / 100 - 1) * f;
      if (Array.isArray(fc)) {
        m.fcColor = fc;
        m.fcF = Math.min(1, Math.max(0, f));
      }
    }
  }
  return mods;
}
function layoutText(doc, env) {
  const text = String(doc.t ?? "");
  if (!text) return [];
  const size = doc.s ?? 12;
  const scale = size / 100;
  const tracking = (doc.tr ?? 0) / 1e3 * size;
  const lineHeight = doc.lh ?? size * 1.2;
  const font = doc.f ? env.fonts.get(doc.f) : void 0;
  const family = font?.fFamily ?? "";
  const style = font?.fStyle ?? "";
  const boxWidth = Array.isArray(doc.sz) ? doc.sz[0] : void 0;
  const origin = Array.isArray(doc.ps) ? [doc.ps[0] ?? 0, (doc.ps[1] ?? 0) + lineHeight] : [0, 0];
  const advanceOf = (ch) => {
    if (ch === " ") {
      const g2 = env.chars.get(glyphKey(" ", family, style));
      return { glyph: g2, adv: (g2 ? g2.w : 33.3) * scale };
    }
    const g = env.chars.get(glyphKey(ch, family, style));
    return { glyph: g, adv: (g ? g.w : 60) * scale };
  };
  const paragraphs = text.split(/\r\n|\r|\n|\u0003/);
  const lines = [];
  let charIndex = 0;
  for (const para of paragraphs) {
    if (boxWidth) {
      let current = [];
      let width = 0;
      let wordStart = 0;
      const flush = () => {
        while (current.length && current[current.length - 1].ch === " ") current.pop();
        lines.push(current);
        current = [];
        width = 0;
        wordStart = 0;
      };
      for (const ch of para) {
        const { glyph, adv } = advanceOf(ch);
        if (width + adv > boxWidth && current.length) {
          if (ch === " ") {
            flush();
            charIndex++;
            continue;
          }
          if (wordStart > 0 && wordStart < current.length) {
            const carried = current.splice(wordStart);
            flush();
            current = carried;
            for (const c of current) width += c.adv + tracking;
          } else {
            flush();
          }
        }
        current.push({ ch, glyph, adv, charIndex });
        width += adv + tracking;
        if (ch === " ") wordStart = current.length;
        charIndex++;
      }
      flush();
    } else {
      const line = [];
      for (const ch of para) {
        const { glyph, adv } = advanceOf(ch);
        line.push({ ch, glyph, adv, charIndex });
        charIndex++;
      }
      lines.push(line);
    }
    charIndex++;
  }
  const placed = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    let lineWidth = 0;
    for (const item of line) lineWidth += item.adv + tracking;
    if (line.length) lineWidth -= tracking;
    const shift = doc.j === 1 ? -lineWidth : doc.j === 2 ? -lineWidth / 2 : 0;
    let pen = origin[0] + (boxWidth && doc.j ? doc.j === 1 ? boxWidth : boxWidth / 2 : 0) + shift;
    const y = origin[1] + li * lineHeight + (doc.ls ?? 0);
    for (const item of line) {
      if (item.glyph && item.ch !== " ") {
        placed.push({ glyph: item.glyph, x: pen, y, scale, charIndex: item.charIndex });
      }
      pen += item.adv + tracking;
    }
  }
  return placed;
}

// src/scene/boolean.ts
var CURVE_STEPS = 24;
var EPS = 1e-9;
var DEGEN = 1e-6;
function flatten(p) {
  const v = p.v;
  const n = v.length;
  if (n < 3) return [];
  const inT = p.i ?? [];
  const outT = p.o ?? [];
  const pts = [[v[0][0], v[0][1]]];
  for (let j = 1; j <= n; j++) {
    const k = j % n;
    if (!p.c && j === n) break;
    const a = v[j - 1];
    const b = v[k];
    const o = outT[j - 1] ?? [0, 0];
    const i = inT[k] ?? [0, 0];
    if (!o[0] && !o[1] && !i[0] && !i[1]) {
      pts.push([b[0], b[1]]);
    } else {
      const x0 = a[0], y0 = a[1];
      const x1 = a[0] + o[0], y1 = a[1] + o[1];
      const x3 = b[0], y3 = b[1];
      const x2 = b[0] + i[0], y2 = b[1] + i[1];
      for (let s = 1; s <= CURVE_STEPS; s++) {
        const t = s / CURVE_STEPS;
        const u = 1 - t;
        const w0 = u * u * u;
        const w1 = 3 * u * u * t;
        const w2 = 3 * u * t * t;
        const w3 = t * t * t;
        pts.push([
          w0 * x0 + w1 * x1 + w2 * x2 + w3 * x3,
          w0 * y0 + w1 * y1 + w2 * y2 + w3 * y3
        ]);
      }
    }
  }
  while (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.abs(first[0] - last[0]) < EPS && Math.abs(first[1] - last[1]) < EPS) pts.pop();
    else break;
  }
  return pts.length >= 3 ? pts : [];
}
function ring(points) {
  let first = null;
  let prev = null;
  for (const [x, y] of points) {
    const v = {
      x,
      y,
      next: null,
      prev: null,
      intersect: false,
      entry: false,
      neighbor: null,
      alpha: 0,
      visited: false
    };
    if (!first) first = v;
    if (prev) {
      prev.next = v;
      v.prev = prev;
    }
    prev = v;
  }
  first.prev = prev;
  prev.next = first;
  return first;
}
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function nextNonIntersect(v) {
  let c = v;
  while (c.intersect) c = c.next;
  return c;
}
function insertBetween(start, v) {
  let c = start.next;
  while (c.intersect && c.alpha < v.alpha) c = c.next;
  v.next = c;
  v.prev = c.prev;
  c.prev.next = v;
  c.prev = v;
}
function buildIntersections(sRing, cRing) {
  let count = 0;
  let degenerate = false;
  let s = sRing;
  do {
    if (!s.intersect) {
      const sEnd = nextNonIntersect(s.next);
      let c = cRing;
      do {
        if (!c.intersect) {
          const cEnd = nextNonIntersect(c.next);
          const den = (cEnd.y - c.y) * (sEnd.x - s.x) - (cEnd.x - c.x) * (sEnd.y - s.y);
          if (Math.abs(den) > EPS) {
            const ua = ((cEnd.x - c.x) * (s.y - c.y) - (cEnd.y - c.y) * (s.x - c.x)) / den;
            const ub = ((sEnd.x - s.x) * (s.y - c.y) - (sEnd.y - s.y) * (s.x - c.x)) / den;
            if (ua > -DEGEN && ua < 1 + DEGEN && ub > -DEGEN && ub < 1 + DEGEN) {
              if (ua < DEGEN || ua > 1 - DEGEN || ub < DEGEN || ub > 1 - DEGEN) {
                degenerate = true;
              } else {
                const x = s.x + ua * (sEnd.x - s.x);
                const y = s.y + ua * (sEnd.y - s.y);
                const vs = { x, y, next: null, prev: null, intersect: true, entry: false, neighbor: null, alpha: ua, visited: false };
                const vc = { x, y, next: null, prev: null, intersect: true, entry: false, neighbor: null, alpha: ub, visited: false };
                vs.neighbor = vc;
                vc.neighbor = vs;
                insertBetween(s, vs);
                insertBetween(c, vc);
                count++;
              }
            }
          }
        }
        c = nextNonIntersect(c.next);
      } while (c !== cRing);
    }
    s = nextNonIntersect(s.next);
  } while (s !== sRing);
  return { count, degenerate };
}
function markEntries(start, other, invert2) {
  let inside = pointInPoly(start.x, start.y, other);
  let v = start;
  do {
    if (v.intersect) {
      v.entry = invert2 ? inside : !inside;
      inside = !inside;
    }
    v = v.next;
  } while (v !== start);
}
function trace(sRing, maxPoints) {
  const out = [];
  for (; ; ) {
    let start = null;
    let v = sRing;
    do {
      if (v.intersect && !v.visited) {
        start = v;
        break;
      }
      v = v.next;
    } while (v !== sRing);
    if (!start) break;
    const poly = [];
    let cur = start;
    let guard = 0;
    do {
      cur.visited = true;
      if (cur.neighbor) cur.neighbor.visited = true;
      if (cur.entry) {
        do {
          cur = cur.next;
          poly.push([cur.x, cur.y]);
          if (++guard > maxPoints) return null;
        } while (!cur.intersect);
      } else {
        do {
          cur = cur.prev;
          poly.push([cur.x, cur.y]);
          if (++guard > maxPoints) return null;
        } while (!cur.intersect);
      }
      cur = cur.neighbor;
    } while (cur !== start && !cur.visited);
    if (poly.length >= 3) out.push(poly);
  }
  return out;
}
function area(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return a / 2;
}
function reversePoly(poly) {
  return poly.slice().reverse();
}
function clipPair(subject, clip, mode) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const cl = attempt === 0 ? clip : clip.map(([x, y]) => [x + 131e-6, y + 79e-6]);
    const sRing = ring(subject);
    const cRing = ring(cl);
    const { count, degenerate } = buildIntersections(sRing, cRing);
    if (degenerate) continue;
    if (!count) {
      const sInC = pointInPoly(subject[0][0], subject[0][1], cl);
      const cInS = pointInPoly(cl[0][0], cl[0][1], subject);
      if (mode === 2) {
        if (sInC) return [cl];
        if (cInS) return [subject];
        return [subject, cl];
      }
      if (mode === 4) {
        if (sInC) return [subject];
        if (cInS) return [cl];
        return [];
      }
      if (sInC) return [];
      if (cInS) {
        return area(subject) * area(cl) > 0 ? [subject, reversePoly(cl)] : [subject, cl];
      }
      return [subject];
    }
    markEntries(sRing, cl, mode !== 4);
    markEntries(cRing, subject, mode === 3 ? false : mode !== 4);
    const res = trace(sRing, (subject.length + cl.length + count * 2) * 4);
    if (res) return res;
  }
  return null;
}
function mergePathsBoolean(paths, mode) {
  if (paths.length < 2) return null;
  const polys = paths.map(flatten);
  if (polys.some((p) => !p.length)) return null;
  let acc = [polys[0]];
  for (let i = 1; i < polys.length; i++) {
    const b = polys[i];
    if (mode === 2) {
      let merged = b;
      const rest = [];
      for (const a of acc) {
        const r = clipPair(a, merged, 2);
        if (r === null) return null;
        if (r.length === 1) merged = r[0];
        else if (r.length === 2 && r[1] === merged) rest.push(a);
        else {
          merged = r[0];
          for (let k = 1; k < r.length; k++) rest.push(r[k]);
        }
      }
      acc = [merged, ...rest];
    } else {
      const next = [];
      for (const a of acc) {
        const r = clipPair(a, b, mode);
        if (r === null) return null;
        next.push(...r);
      }
      acc = next;
    }
  }
  const out = [];
  for (const poly of acc) {
    if (poly.length < 3 || Math.abs(area(poly)) < 1e-6) continue;
    const z = [0, 0];
    out.push({
      c: true,
      v: poly.map((pt) => [pt[0], pt[1]]),
      i: poly.map(() => z),
      o: poly.map(() => z)
    });
  }
  return out;
}

// src/math/filter.ts
var clamp012 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
function tableAt(t, x) {
  if (!t || !t.length) return x;
  if (t.length === 1) return t[0];
  const p = clamp012(x) * (t.length - 1);
  const i = Math.floor(p);
  if (i >= t.length - 1) return t[t.length - 1];
  return t[i] + (t[i + 1] - t[i]) * (p - i);
}
function colorMatrix(m, out) {
  const [r, g, b, a] = out;
  out[0] = m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4];
  out[1] = m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9];
  out[2] = m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14];
  out[3] = m[15] * r + m[16] * g + m[17] * b + m[18] * a + m[19];
}
function colorTable(f, out) {
  out[0] = tableAt(f.r, out[0]);
  out[1] = tableAt(f.g, out[1]);
  out[2] = tableAt(f.b, out[2]);
  out[3] = tableAt(f.a, out[3]);
}
function colorAt(f, out) {
  if (f.kind === "colorMatrix") colorMatrix(f.values, out);
  else colorTable(f, out);
}
var isColorFilter = (f) => f.kind === "colorMatrix" || f.kind === "colorTable";
function applyColorFilters(data, filters) {
  const px = [0, 0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    px[0] = data[i] / 255;
    px[1] = data[i + 1] / 255;
    px[2] = data[i + 2] / 255;
    px[3] = data[i + 3] / 255;
    for (const f of filters) {
      if (isColorFilter(f)) colorAt(f, px);
    }
    data[i] = clamp012(px[0]) * 255;
    data[i + 1] = clamp012(px[1]) * 255;
    data[i + 2] = clamp012(px[2]) * 255;
    data[i + 3] = clamp012(px[3]) * 255;
  }
}

// src/scene/effects.ts
var TINT = 20;
var FILL = 21;
var TRITONE = 23;
var LEVELS = 24;
var SHADOW = 25;
var BLUR = 29;
var BLUR_SIGMA = 0.3;
var SHADOW_SIGMA = 0.25;
var LUT = 256;
var DEG = Math.PI / 180;
var GRAY = [
  1 / 3,
  1 / 3,
  1 / 3,
  0,
  0,
  1 / 3,
  1 / 3,
  1 / 3,
  0,
  0,
  1 / 3,
  1 / 3,
  1 / 3,
  0,
  0,
  0,
  0,
  0,
  1,
  0
];
var filterCache = /* @__PURE__ */ new WeakMap();
var staticCache = /* @__PURE__ */ new WeakMap();
function layerFilters(layer2, frame) {
  const list = layer2.ef;
  if (!Array.isArray(list) || !list.length) return null;
  if (!staticEffects(layer2, list)) return build(list, frame);
  let cached2 = filterCache.get(layer2);
  if (cached2 === void 0) {
    cached2 = build(list, frame);
    filterCache.set(layer2, cached2);
  }
  return cached2;
}
function staticEffects(layer2, list) {
  let st = staticCache.get(layer2);
  if (st === void 0) {
    st = true;
    for (const e of list) {
      for (const p of e?.ef ?? []) {
        if (!isStatic(p?.v)) {
          st = false;
          break;
        }
      }
      if (!st) break;
    }
    staticCache.set(layer2, st);
  }
  return st;
}
function build(list, frame) {
  const out = [];
  for (const e of list) {
    if (!e || e.en === 0 || !Array.isArray(e.ef)) continue;
    switch (e.ty) {
      case TINT:
        push(out, tint(e.ef, frame));
        break;
      case FILL:
        push(out, fill(e.ef, frame));
        break;
      case TRITONE:
        out.push({ kind: "colorMatrix", values: GRAY }, tritone(e.ef, frame));
        break;
      case LEVELS:
        push(out, levels(e.ef, frame));
        break;
      case SHADOW:
        push(out, shadow(e.ef, frame));
        break;
      case BLUR:
        push(out, blur(e.ef, frame));
        break;
    }
  }
  return out.length ? out : null;
}
function push(out, f) {
  if (f) out.push(f);
}
function num(ef, i, frame, fallback) {
  const v = scalar(evaluate(ef[i]?.v, frame));
  return typeof v === "number" ? v : fallback;
}
function rgbAt(ef, i, frame) {
  const c = evaluate(ef[i]?.v, frame);
  return Array.isArray(c) ? to255(c) : [0, 0, 0];
}
function tint(ef, frame) {
  const t = clamp012(num(ef, 2, frame, 100) / 100);
  if (t <= 0) return null;
  const b = rgbAt(ef, 0, frame);
  const w = rgbAt(ef, 1, frame);
  const values = new Array(20).fill(0);
  for (let k = 0; k < 3; k++) {
    const d = t * (w[k] - b[k]) / 765;
    values[k * 5] = d;
    values[k * 5 + 1] = d;
    values[k * 5 + 2] = d;
    values[k * 5 + k] += 1 - t;
    values[k * 5 + 4] = t * b[k] / 255;
  }
  values[18] = 1;
  return { kind: "colorMatrix", values };
}
function fill(ef, frame) {
  const c = rgbAt(ef, 2, frame);
  const values = new Array(20).fill(0);
  for (let k = 0; k < 3; k++) values[k * 5 + 4] = c[k] / 255;
  values[18] = clamp012(num(ef, 6, frame, 1));
  return { kind: "colorMatrix", values };
}
function tritone(ef, frame) {
  const c = [rgbAt(ef, 0, frame), rgbAt(ef, 1, frame), rgbAt(ef, 2, frame)];
  return {
    kind: "colorTable",
    r: c.map((v) => v[0] / 255),
    g: c.map((v) => v[1] / 255),
    b: c.map((v) => v[2] / 255)
  };
}
function levelCurve(ef, i, frame) {
  const ib = num(ef, i, frame, 0);
  const iw = num(ef, i + 1, frame, 1);
  const g = num(ef, i + 2, frame, 1);
  const ob = num(ef, i + 3, frame, 0);
  const ow = num(ef, i + 4, frame, 1);
  if (ib === 0 && iw === 1 && g === 1 && ob === 0 && ow === 1) return null;
  const span = iw - ib;
  const inv = g > 0 ? 1 / g : 1;
  return (x) => {
    let t = span ? (x - ib) / span : x >= iw ? 1 : 0;
    t = clamp012(t);
    if (inv !== 1) t = Math.pow(t, inv);
    return ob + (ow - ob) * t;
  };
}
function sample(base, ch) {
  const out = new Array(LUT);
  for (let i = 0; i < LUT; i++) {
    let v = i / (LUT - 1);
    if (base) v = base(v);
    if (ch) v = ch(v);
    out[i] = clamp012(v);
  }
  return out;
}
function levels(ef, frame) {
  const base = levelCurve(ef, 3, frame);
  const cr = levelCurve(ef, 10, frame);
  const cg = levelCurve(ef, 17, frame);
  const cb = levelCurve(ef, 24, frame);
  const ca = levelCurve(ef, 31, frame);
  if (!base && !cr && !cg && !cb && !ca) return null;
  const f = { kind: "colorTable" };
  if (base || cr) f.r = sample(base, cr);
  if (base || cg) f.g = sample(base, cg);
  if (base || cb) f.b = sample(base, cb);
  if (ca) f.a = sample(null, ca);
  return f;
}
function shadow(ef, frame) {
  const alpha = clamp012(num(ef, 1, frame, 255) / 255);
  if (alpha <= 0) return null;
  const angle = (num(ef, 2, frame, 0) - 90) * DEG;
  const dist = num(ef, 3, frame, 0);
  return {
    kind: "shadow",
    color: rgbAt(ef, 0, frame),
    alpha,
    offsetX: dist * Math.cos(angle),
    offsetY: dist * Math.sin(angle),
    sigma: Math.max(0, num(ef, 4, frame, 0)) * SHADOW_SIGMA
  };
}
function blur(ef, frame) {
  const sigma = Math.max(0, num(ef, 0, frame, 0)) * BLUR_SIGMA;
  if (!sigma) return null;
  const dim = num(ef, 1, frame, 1);
  const f = {
    kind: "blur",
    sigmaX: dim === 3 ? 0 : sigma,
    sigmaY: dim === 2 ? 0 : sigma
  };
  if (num(ef, 2, frame, 0) === 1) f.repeatEdge = true;
  return f;
}
function bakeFilters(op, filters) {
  if (op.kind !== "shape") return filters;
  let i = 0;
  while (i < filters.length && isColorFilter(filters[i])) i++;
  if (!i) return filters;
  const head = filters.slice(0, i);
  op.fills = op.fills.map((p) => bakePaint(p, head));
  op.strokes = op.strokes.map((p) => bakePaint(p, head));
  return i < filters.length ? filters.slice(i) : null;
}
function bakePaint(paint, filters) {
  const px = [0, 0, 0, 0];
  const run = () => {
    for (const f of filters) {
      if (isColorFilter(f)) colorAt(f, px);
    }
    for (let k = 0; k < 4; k++) px[k] = clamp012(px[k]);
  };
  if (paint.kind === "color") {
    px[0] = paint.color[0] / 255;
    px[1] = paint.color[1] / 255;
    px[2] = paint.color[2] / 255;
    px[3] = clamp012(paint.alpha);
    run();
    return { ...paint, color: [px[0] * 255, px[1] * 255, px[2] * 255], alpha: px[3] };
  }
  const alpha = clamp012(paint.alpha);
  const stops = paint.stops.map((s) => {
    px[0] = s.r / 255;
    px[1] = s.g / 255;
    px[2] = s.b / 255;
    px[3] = clamp012(s.a) * alpha;
    run();
    return { p: s.p, r: px[0] * 255, g: px[1] * 255, b: px[2] * 255, a: px[3] };
  });
  return { ...paint, stops, alpha: 1 };
}

// src/scene/evaluate.ts
var TY_PRECOMP = 0;
var TY_SOLID = 1;
var TY_IMAGE = 2;
var TY_NULL = 3;
var TY_SHAPE = 4;
var TY_TEXT = 5;
var textEnvCache = /* @__PURE__ */ new WeakMap();
var textPathsCache = /* @__PURE__ */ new WeakMap();
function sceneAt(data, frame) {
  const op = data.op ?? 0;
  if (op > (data.ip ?? 0) && frame >= op) frame = op - 1e-3;
  setSlots(data.slots);
  setExpressionFrameRate(data.fr ?? 30);
  let env = textEnvCache.get(data);
  if (env === void 0) {
    env = textEnv(data);
    textEnvCache.set(data, env);
  }
  const ctx = {
    assets: new Map((data.assets ?? []).map((a) => [a.id, a])),
    frameRate: data.fr ?? 30,
    ops: [],
    depth: 0,
    text: env
  };
  layers(data.layers ?? [], frame, ctx);
  return { width: data.w, height: data.h, ops: ctx.ops };
}
var tmCache = /* @__PURE__ */ new WeakMap();
var chainCache = /* @__PURE__ */ new WeakMap();
var geomCache = /* @__PURE__ */ new WeakMap();
function isStaticTransform(ks) {
  if (!ks) return true;
  const p = ks.p;
  const pStatic = !p || (p.s ? isStatic(p.x) && isStatic(p.y) : isStatic(p));
  return pStatic && isStatic(ks.r) && isStatic(ks.s) && isStatic(ks.sk) && isStatic(ks.sa) && isStatic(ks.a);
}
function cachedTransformMatrix(ks, frame) {
  if (!isStaticTransform(ks)) return transformMatrix(ks, frame);
  let m = tmCache.get(ks);
  if (!m) {
    m = transformMatrix(ks, frame);
    tmCache.set(ks, m);
  }
  return m;
}
function autoOrientAngle(layer2, frame) {
  if (layer2.ao !== 1 || !layer2.ks?.p) return 0;
  const p = layer2.ks.p;
  if (p.s ? isStatic(p.x) && isStatic(p.y) : isStatic(p)) return 0;
  const [x0, y0] = positionAt(layer2.ks, frame - 0.5);
  const [x1, y1] = positionAt(layer2.ks, frame + 0.5);
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (!dx && !dy) return 0;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}
function layerMatrix(layer2, local) {
  const ao = autoOrientAngle(layer2, local);
  if (ao) return transformMatrix(layer2.ks ?? {}, local, ao);
  return cachedTransformMatrix(layer2.ks ?? {}, local);
}
function chainStatic(layer2, byInd) {
  const cached2 = chainCache.get(layer2);
  if (cached2 !== void 0) return cached2;
  let node = layer2;
  let ok = true;
  let guard = 0;
  while (node && guard++ < 100) {
    if (!isStaticTransform(node.ks)) {
      ok = false;
      break;
    }
    if (node.parent === void 0) break;
    node = byInd.get(node.parent);
  }
  chainCache.set(layer2, ok);
  return ok;
}
function cachedGeom(item, build2) {
  let g = geomCache.get(item);
  if (!g) {
    g = build2();
    geomCache.set(item, g);
  }
  return g;
}
var styledCache = /* @__PURE__ */ new WeakMap();
function hasStyles(group) {
  let styled = styledCache.get(group);
  if (styled === void 0) {
    styled = false;
    for (const it of group.it ?? []) {
      if (!it || it.hd) continue;
      const t = it.ty;
      if (t === "fl" || t === "st" || t === "gf" || t === "gs" || t === "gr" && hasStyles(it)) {
        styled = true;
        break;
      }
    }
    styledCache.set(group, styled);
  }
  return styled;
}
function geomOf(item, frame) {
  switch (item.ty) {
    case "sh": {
      let path = evaluate(item.ks, frame);
      if (!path || !Array.isArray(path.v) || !path.v.length) return null;
      if (item.d === 3) path = reversePath(path);
      return { path, static: isStatic(item.ks) };
    }
    case "el": {
      const st = isStatic(item.p) && isStatic(item.s);
      const build2 = () => {
        const p = ellipsePath(evaluate(item.p, frame), evaluate(item.s, frame));
        return item.d === 3 ? reversePath(p) : p;
      };
      return { path: st ? cachedGeom(item, build2) : build2(), static: st };
    }
    case "rc": {
      const st = isStatic(item.p) && isStatic(item.s) && isStatic(item.r);
      const build2 = () => {
        const p = rectPath(
          evaluate(item.p, frame),
          evaluate(item.s, frame),
          scalar(evaluate(item.r, frame)) ?? 0
        );
        return item.d === 3 ? reversePath(p) : p;
      };
      return { path: st ? cachedGeom(item, build2) : build2(), static: st };
    }
    case "sr": {
      const st = isStatic(item.p) && isStatic(item.pt) && isStatic(item.r) && isStatic(item.or) && isStatic(item.ir) && isStatic(item.os) && isStatic(item.is);
      const build2 = () => {
        const p = polystarPath(
          evaluate(item.p, frame),
          scalar(evaluate(item.pt, frame)) ?? 5,
          scalar(evaluate(item.r, frame)) ?? 0,
          scalar(evaluate(item.or, frame)) ?? 0,
          scalar(evaluate(item.ir, frame)) ?? 0,
          scalar(evaluate(item.os, frame)) ?? 0,
          scalar(evaluate(item.is, frame)) ?? 0,
          item.sy !== 2
        );
        return item.d === 3 ? reversePath(p) : p;
      };
      return { path: st ? cachedGeom(item, build2) : build2(), static: st };
    }
    default:
      return null;
  }
}
function transformPath(p, m) {
  const n = p.v.length;
  const v = new Array(n);
  const i = new Array(n);
  const o = new Array(n);
  for (let j = 0; j < n; j++) {
    const pt = p.v[j];
    const it = p.i?.[j] ?? [0, 0];
    const ot = p.o?.[j] ?? [0, 0];
    v[j] = [m[0] * pt[0] + m[2] * pt[1] + m[4], m[1] * pt[0] + m[3] * pt[1] + m[5]];
    i[j] = [m[0] * it[0] + m[2] * it[1], m[1] * it[0] + m[3] * it[1]];
    o[j] = [m[0] * ot[0] + m[2] * ot[1], m[1] * ot[0] + m[3] * ot[1]];
  }
  return { c: p.c, v, i, o };
}
function collectPaths(group, frame, m, out) {
  let allStatic = true;
  const items = group.it ?? [];
  const tr = items.find((it) => it && it.ty === "tr");
  if (tr) {
    const trM = cachedTransformMatrix(tr, frame);
    m = m ? multiply(m, trM) : trM;
    if (!isStaticTransform(tr)) allStatic = false;
  }
  for (const item of items) {
    if (!item || item.hd) continue;
    if (item.ty === "gr") {
      if (!collectPaths(item, frame, m, out)) allStatic = false;
      continue;
    }
    const g = geomOf(item, frame);
    if (g) {
      out.push(m ? transformPath(g.path, m) : g.path);
      if (!g.static) allStatic = false;
    }
  }
  return allStatic;
}
function layers(list, frame, ctx) {
  const byInd = /* @__PURE__ */ new Map();
  for (const l of list) if (l.ind !== void 0) byInd.set(l.ind, l);
  for (let i = list.length - 1; i >= 0; i--) {
    const l = list[i];
    if (l.td === 1) continue;
    let matte;
    if (l.tt) {
      const src = l.tp !== void 0 ? byInd.get(l.tp) : list[i - 1];
      if (src) matte = matteClips(src, byInd, frame, ctx, l.tt);
    }
    layer(l, byInd, frame, ctx, matte);
  }
}
function matteCoverage(fills, luma) {
  const f = fills[0];
  if (!f) return 0;
  const alpha = Math.min(1, Math.max(0, f.alpha));
  if (!luma) return alpha;
  const lum = (c) => (0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0)) / 255;
  if (f.kind === "color") return lum(f.color) * alpha;
  let sum = 0;
  for (const s of f.stops) sum += lum([s.r, s.g, s.b]) * s.a;
  return (f.stops.length ? sum / f.stops.length : 0) * alpha;
}
function matteClips(src, byInd, frame, ctx, tt) {
  const sub = {
    assets: ctx.assets,
    frameRate: ctx.frameRate,
    ops: [],
    depth: ctx.depth,
    text: ctx.text
  };
  layer(src, byInd, frame, sub);
  const luma = tt === 3 || tt === 4;
  const shapes = [];
  for (const op of sub.ops) {
    if (op.kind === "shape" && op.paths.length) {
      const coverage = matteCoverage(op.fills, luma);
      const shape = { paths: op.paths, matrix: op.matrix };
      if (coverage < 1) shape.coverage = coverage;
      shapes.push(shape);
    }
  }
  const inverted = tt === 2 || tt === 4;
  if (!shapes.length) return inverted ? [] : [{ shapes: [], mode: 1 }];
  return [{ shapes, mode: inverted ? 2 : 1 }];
}
function maskClips(layer2, m, frame) {
  const list = layer2.masksProperties;
  if (!Array.isArray(list) || !list.length) return [];
  const clips = [];
  let add = [];
  let addAlpha = 1;
  const flushAdd = () => {
    if (add.length) {
      clips.push({ shapes: add, mode: 1, alpha: addAlpha });
      add = [];
      addAlpha = 1;
    }
  };
  for (const mk of list) {
    if (!mk || mk.mode === "n") continue;
    let pd = evaluate(mk.pt, frame);
    if (!pd || !Array.isArray(pd.v) || !pd.v.length) continue;
    const expand = scalar(evaluate(mk.x, frame)) ?? 0;
    if (expand) pd = offsetPath(pd, signedArea(pd) >= 0 ? expand : -expand, 4, 2);
    const alpha = Math.min(1, Math.max(0, (scalar(evaluate(mk.o, frame)) ?? 100) / 100));
    const shape = { paths: [pd], matrix: m };
    const inv = !!mk.inv;
    if (mk.mode === "s") {
      flushAdd();
      clips.push({ shapes: [shape], mode: inv ? 1 : 2, alpha });
    } else if (mk.mode === "i" || mk.mode === "d") {
      flushAdd();
      clips.push({ shapes: [shape], mode: inv ? 2 : 1, alpha });
    } else if (mk.mode === "f") {
      flushAdd();
      clips.push({ shapes: [shape], mode: 3, alpha });
    } else if (inv) {
      flushAdd();
      clips.push({ shapes: [shape], mode: 2, alpha });
    } else {
      if (add.length && alpha !== addAlpha) flushAdd();
      add.push(shape);
      addAlpha = alpha;
    }
  }
  flushAdd();
  return clips;
}
var MB_SAMPLES = 6;
var MB_SHUTTER = 0.5;
function scaleOpAlpha(op, mul) {
  if (op.kind === "shape") {
    op.fills = op.fills.map((f) => ({ ...f, alpha: f.alpha * mul }));
    op.strokes = op.strokes.map((s) => ({ ...s, alpha: s.alpha * mul }));
  } else {
    op.alpha *= mul;
  }
  op.static = false;
}
function layer(layer2, byInd, frame, ctx, extraClips, mbSample = false) {
  if (layer2.hd || layer2.ty === TY_NULL) return;
  if (!mbSample && layer2.mb && !chainStatic(layer2, byInd)) {
    for (let k = 0; k < MB_SAMPLES; k++) {
      const t = frame + ((k + 0.5) / MB_SAMPLES - 0.5) * MB_SHUTTER;
      const before = ctx.ops.length;
      layer_(layer2, byInd, t, ctx, extraClips);
      const mul = 1 / (k + 1);
      if (mul < 1) {
        for (let i = before; i < ctx.ops.length; i++) scaleOpAlpha(ctx.ops[i], mul);
      }
    }
    return;
  }
  layer_(layer2, byInd, frame, ctx, extraClips);
}
function layer_(layer2, byInd, frame, ctx, extraClips) {
  if (frame < (layer2.ip ?? 0) || frame >= (layer2.op ?? Infinity)) return;
  const opacity = transformOpacity(layer2.ks, frame);
  if (opacity <= 0) return;
  const staticMx = chainStatic(layer2, byInd);
  let m = layerMatrix(layer2, frame);
  let node = layer2;
  let guard = 0;
  while (node.parent !== void 0 && guard++ < 100) {
    const parent = byInd.get(node.parent);
    if (!parent) break;
    m = multiply(layerMatrix(parent, frame), m);
    node = parent;
  }
  const start = ctx.ops.length;
  switch (layer2.ty) {
    case TY_SHAPE:
      shapeItems(layer2.shapes ?? [], frame, m, opacity, staticMx, ctx, []);
      break;
    case TY_PRECOMP: {
      if (ctx.depth > 20) return;
      const asset = ctx.assets.get(layer2.refId);
      if (!asset || !Array.isArray(asset.layers)) return;
      let childFrame = localFrame(layer2, frame);
      if (layer2.tm) childFrame = (scalar(evaluate(layer2.tm, frame)) ?? 0) * ctx.frameRate;
      ctx.depth++;
      layers(asset.layers, childFrame, ctx);
      ctx.depth--;
      const w = layer2.w ?? asset.w ?? 0;
      const h = layer2.h ?? asset.h ?? 0;
      const clipStage = w && h && layer2.ct !== 1 ? { shapes: [{ paths: [rectPath([w / 2, h / 2], [w, h], 0)], matrix: m }], mode: 1 } : null;
      for (let i = start; i < ctx.ops.length; i++) {
        const op = ctx.ops[i];
        op.matrix = multiply(m, op.matrix);
        op.static = op.static && staticMx;
        if (op.kind === "shape") {
          for (const p of op.fills) p.alpha *= opacity;
          for (const p of op.strokes) p.alpha *= opacity;
        } else {
          op.alpha *= opacity;
        }
        if (op.clips) {
          op.clips = op.clips.map((c) => ({
            mode: c.mode,
            shapes: c.shapes.map((s) => ({ ...s, matrix: multiply(m, s.matrix) }))
          }));
        }
        if (clipStage) op.clips = op.clips ? [...op.clips, clipStage] : [clipStage];
      }
      break;
    }
    case TY_SOLID: {
      const w = layer2.sw ?? 0;
      const h = layer2.sh ?? 0;
      if (!w || !h) return;
      ctx.ops.push({
        kind: "shape",
        paths: [rectPath([w / 2, h / 2], [w, h], 0)],
        matrix: m,
        fills: [{ kind: "color", color: hexToRgb(safeHexColor(layer2.sc)), alpha: opacity, rule: 1 }],
        strokes: [],
        static: staticMx
      });
      break;
    }
    case TY_TEXT: {
      if (!ctx.text) return;
      const doc = textDocAt(layer2, frame);
      if (!doc) return;
      const pathOpts = layer2.t?.p;
      const pathMask = pathOpts && typeof pathOpts.m === "number" ? layer2.masksProperties?.[pathOpts.m] : void 0;
      if (!hasAnimators(layer2) && !pathMask) {
        let paths = textPathsCache.get(doc);
        if (!paths) {
          paths = [];
          for (const g of layoutText(doc, ctx.text)) {
            const gm = multiply(translation(g.x, g.y), scaling(g.scale, g.scale));
            for (const item of g.glyph.shapes) {
              if (!item || item.hd) continue;
              if (item.ty === "gr") collectPaths(item, frame, gm, paths);
              else {
                const geo = geomOf(item, frame);
                if (geo) paths.push(transformPath(geo.path, gm));
              }
            }
          }
          textPathsCache.set(doc, paths);
        }
        if (!paths.length) return;
        const fills = [];
        const strokes = [];
        if (Array.isArray(doc.fc)) {
          fills.push({ kind: "color", color: to255(doc.fc), alpha: opacity, rule: 1 });
        }
        if (Array.isArray(doc.sc) && (doc.sw ?? 0) > 0) {
          strokes.push({
            kind: "color",
            color: to255(doc.sc),
            alpha: opacity,
            width: doc.sw ?? 1,
            cap: 2,
            join: 2
          });
        }
        if (!fills.length && !strokes.length) {
          fills.push({ kind: "color", color: [0, 0, 0], alpha: opacity, rule: 1 });
        }
        ctx.ops.push({
          kind: "shape",
          paths,
          matrix: m,
          fills,
          strokes,
          static: staticMx && isStaticDoc(layer2)
        });
        break;
      }
      const placed = layoutText(doc, ctx.text);
      if (!placed.length) return;
      const totalChars = placed[placed.length - 1].charIndex + 1;
      const mods = textAnimators(layer2, frame, placed, totalChars);
      let sampler = null;
      let margin = 0;
      if (pathMask) {
        const pd = evaluate(pathMask.pt, frame);
        if (pd && Array.isArray(pd.v) && pd.v.length) sampler = pathSampler(pd);
        margin = scalar(evaluate(pathOpts.f, frame)) ?? 0;
      }
      const baseColor = Array.isArray(doc.fc) ? doc.fc : [0, 0, 0];
      for (let gi = 0; gi < placed.length; gi++) {
        const g = placed[gi];
        const md = mods ? mods[gi] : null;
        const charAlpha = opacity * (md ? Math.min(1, Math.max(0, md.opacity)) : 1);
        if (charAlpha <= 0) continue;
        let cm;
        if (sampler) {
          const pt = sampler.at(margin + g.x + (md?.dx ?? 0));
          cm = multiply(translation(pt.x, pt.y), rotation(pt.angle * 180 / Math.PI));
          const dy = (md?.dy ?? 0) + (doc.ls ?? 0);
          if (dy) cm = multiply(cm, translation(0, dy));
        } else {
          cm = translation(g.x + (md?.dx ?? 0), g.y + (md?.dy ?? 0));
        }
        if (md?.rot) cm = multiply(cm, rotation(md.rot));
        cm = multiply(cm, scaling(g.scale * (md?.sx ?? 1), g.scale * (md?.sy ?? 1)));
        const paths = [];
        for (const item of g.glyph.shapes) {
          if (!item || item.hd) continue;
          if (item.ty === "gr") collectPaths(item, frame, cm, paths);
          else {
            const geo = geomOf(item, frame);
            if (geo) paths.push(transformPath(geo.path, cm));
          }
        }
        if (!paths.length) continue;
        let color = baseColor;
        if (md?.fcColor && md.fcF) {
          const w = md.fcF;
          color = baseColor.map((c, k) => c + ((md.fcColor[k] ?? c) - c) * w);
        }
        const strokes = [];
        if (Array.isArray(doc.sc) && (doc.sw ?? 0) > 0) {
          strokes.push({
            kind: "color",
            color: to255(doc.sc),
            alpha: charAlpha,
            width: doc.sw ?? 1,
            cap: 2,
            join: 2
          });
        }
        ctx.ops.push({
          kind: "shape",
          paths,
          matrix: m,
          fills: [{ kind: "color", color: to255(color), alpha: charAlpha, rule: 1 }],
          strokes,
          static: false
        });
      }
      break;
    }
    case TY_IMAGE: {
      const asset = ctx.assets.get(layer2.refId);
      if (!asset || typeof asset.p !== "string" || !asset.p) return;
      const src = asset.e === 1 || asset.p.startsWith("data:") ? asset.p : (asset.u ?? "") + asset.p;
      ctx.ops.push({
        kind: "image",
        src,
        assetId: asset.id,
        width: asset.w ?? 0,
        height: asset.h ?? 0,
        matrix: m,
        alpha: opacity,
        static: staticMx,
        paths: [],
        fills: [],
        strokes: []
      });
      break;
    }
  }
  const stages = extraClips ? [...extraClips] : [];
  stages.push(...maskClips(layer2, m, frame));
  const blend = typeof layer2.bm === "number" && layer2.bm ? layer2.bm : void 0;
  const filters = layerFilters(layer2, frame);
  if (stages.length || blend !== void 0 || filters) {
    for (let i = start; i < ctx.ops.length; i++) {
      const op = ctx.ops[i];
      if (stages.length) op.clips = op.clips ? [...op.clips, ...stages] : stages.slice();
      if (blend !== void 0 && op.blend === void 0) op.blend = blend;
      if (filters) {
        const rest = bakeFilters(op, op.filters ? [...op.filters, ...filters] : filters);
        if (rest) op.filters = rest;
      }
    }
  }
}
function localFrame(layer2, frame) {
  return (frame - (layer2.st ?? 0)) / (layer2.sr || 1);
}
function modOf(item) {
  switch (item.ty) {
    case "tm":
      return (paths, frame) => trimPaths(
        paths,
        (scalar(evaluate(item.s, frame)) ?? 0) / 100,
        (scalar(evaluate(item.e, frame)) ?? 100) / 100,
        (scalar(evaluate(item.o, frame)) ?? 0) / 360,
        item.m !== 2
      );
    case "rd":
      return (paths, frame) => {
        const r = scalar(evaluate(item.r, frame)) ?? 0;
        return r > 0 ? paths.map((p) => roundCorners(p, r)) : paths;
      };
    case "zz":
      return (paths, frame) => {
        const amp = scalar(evaluate(item.s, frame)) ?? 0;
        const ridges = scalar(evaluate(item.r, frame)) ?? 1;
        const smooth = (scalar(evaluate(item.pt, frame)) ?? 1) === 2;
        return amp ? paths.map((p) => zigZag(p, amp, ridges, smooth)) : paths;
      };
    case "pb":
      return (paths, frame) => {
        const a = scalar(evaluate(item.a, frame)) ?? 0;
        return a ? paths.map((p) => puckerBloat(p, a)) : paths;
      };
    case "tw":
      return (paths, frame) => {
        const a = scalar(evaluate(item.a, frame)) ?? 0;
        const c = evaluate(item.c, frame) ?? [0, 0];
        return a ? paths.map((p) => twist(p, a, c)) : paths;
      };
    case "op":
      return (paths, frame) => {
        const a = scalar(evaluate(item.a, frame)) ?? 0;
        const ml = scalar(evaluate(item.ml, frame)) ?? item.ml ?? 4;
        return a ? paths.map((p) => offsetPath(p, a, ml, item.lj ?? 2)) : paths;
      };
    default:
      return null;
  }
}
function modStatic(item) {
  switch (item.ty) {
    case "tm":
      return isStatic(item.s) && isStatic(item.e) && isStatic(item.o);
    case "rd":
      return isStatic(item.r);
    case "zz":
      return isStatic(item.s) && isStatic(item.r) && isStatic(item.pt);
    case "pb":
    case "tw":
      return isStatic(item.a) && isStatic(item.c);
    case "op":
      return isStatic(item.a);
    default:
      return true;
  }
}
function repeaterStatic(item) {
  const tr = item.tr ?? {};
  return isStatic(item.c) && isStatic(item.o) && isStatic(tr.p) && isStatic(tr.a) && isStatic(tr.s) && isStatic(tr.r) && isStatic(tr.so) && isStatic(tr.eo);
}
function repeaterMatrix(tr, n, frame) {
  const p = evaluate(tr.p, frame) ?? [0, 0];
  const a = evaluate(tr.a, frame) ?? [0, 0];
  const s = evaluate(tr.s, frame) ?? [100, 100];
  const r = scalar(evaluate(tr.r, frame)) ?? 0;
  const ax = Array.isArray(a) ? a[0] ?? 0 : 0;
  const ay = Array.isArray(a) ? a[1] ?? 0 : 0;
  let m = translation((Array.isArray(p) ? p[0] ?? 0 : 0) * n, (Array.isArray(p) ? p[1] ?? 0 : 0) * n);
  if (ax || ay) m = multiply(m, translation(ax, ay));
  if (r) m = multiply(m, rotation(r * n));
  const sx = Math.pow((Array.isArray(s) ? s[0] ?? 100 : 100) / 100, n);
  const sy = Math.pow((Array.isArray(s) ? s[1] ?? s[0] ?? 100 : 100) / 100, n);
  if (sx !== 1 || sy !== 1) m = multiply(m, scaling(sx, sy));
  if (ax || ay) m = multiply(m, translation(-ax, -ay));
  return m;
}
function clonePath(p) {
  return { c: p.c, v: p.v, i: p.i, o: p.o };
}
function applyRepeater(item, frame, groupMatrix, ctx, startIdx) {
  const count = Math.max(0, Math.round(scalar(evaluate(item.c, frame)) ?? 0));
  const offset = scalar(evaluate(item.o, frame)) ?? 0;
  const tr = item.tr ?? {};
  const so = tr.so ? (scalar(evaluate(tr.so, frame)) ?? 100) / 100 : 1;
  const eo = tr.eo ? (scalar(evaluate(tr.eo, frame)) ?? 100) / 100 : 1;
  const originals = ctx.ops.splice(startIdx);
  if (!count || !originals.length) return;
  const inv = invert(groupMatrix);
  const stat = repeaterStatic(item);
  for (let k = 0; k < count; k++) {
    const n = offset + k;
    const world = multiply(multiply(groupMatrix, repeaterMatrix(tr, n, frame)), inv);
    const alphaMul = count > 1 ? so + (eo - so) * (k / (count - 1)) : so;
    for (const op of originals) {
      const matrix = multiply(world, op.matrix);
      if (op.kind === "shape") {
        ctx.ops.push({
          kind: "shape",
          paths: k === 0 ? op.paths : op.paths.map(clonePath),
          matrix,
          fills: op.fills.map((f) => ({ ...f, alpha: f.alpha * alphaMul })),
          strokes: op.strokes.map((s) => ({ ...s, alpha: s.alpha * alphaMul })),
          clips: op.clips,
          blend: op.blend,
          static: op.static && stat
        });
      } else {
        ctx.ops.push({ ...op, matrix, alpha: op.alpha * alphaMul, static: op.static && stat });
      }
    }
  }
}
function shapeItems(items, frame, matrix, opacity, staticMatrix, ctx, inherited) {
  const startOps = ctx.ops.length;
  const paths = [];
  const fills = [];
  const strokes = [];
  const subgroups = [];
  const mods = [...inherited];
  const repeaters = [];
  let mergeMode = 0;
  let geomStatic = true;
  for (const item of items) {
    if (!item || item.hd) continue;
    switch (item.ty) {
      case "gr":
        if (hasStyles(item)) subgroups.push(item);
        else if (!collectPaths(item, frame, null, paths)) geomStatic = false;
        break;
      case "sh":
      case "el":
      case "rc":
      case "sr": {
        const g = geomOf(item, frame);
        if (g) {
          paths.push(g.path);
          if (!g.static) geomStatic = false;
        }
        break;
      }
      case "fl":
        fills.push({
          kind: "color",
          color: colorOf(evaluate(item.c, frame)),
          alpha: opacityOf(item, frame) * opacity,
          rule: item.r === 2 ? 2 : 1
        });
        break;
      case "gf": {
        const g = gradientPaint(item, frame, opacityOf(item, frame) * opacity);
        if (g) fills.push(g);
        break;
      }
      case "st": {
        strokes.push({
          kind: "color",
          color: colorOf(evaluate(item.c, frame)),
          ...strokeBase(item, frame, opacity)
        });
        break;
      }
      case "gs": {
        const g = gradientPaint(item, frame, 1);
        if (g) {
          const base = strokeBase(item, frame, opacity);
          strokes.push({ ...g, ...base, alpha: base.alpha });
        }
        break;
      }
      case "tm":
      case "rd":
      case "zz":
      case "pb":
      case "tw":
      case "op": {
        mods.push(item);
        if (!modStatic(item)) geomStatic = false;
        break;
      }
      case "rp":
        repeaters.push(item);
        break;
      case "mm":
        mergeMode = item.mm ?? 1;
        break;
    }
  }
  let outPaths = paths;
  for (const item of mods) {
    const mod = modOf(item);
    if (mod) outPaths = mod(outPaths, frame);
  }
  let mergeClips;
  if ((mergeMode === 2 || mergeMode === 3 || mergeMode === 4) && outPaths.length > 1) {
    const solved = strokes.length ? mergePathsBoolean(outPaths, mergeMode) : null;
    if (solved) {
      outPaths = solved;
      geomStatic = false;
    } else if (mergeMode === 3 || mergeMode === 4) {
      mergeClips = [
        { shapes: [{ paths: outPaths.slice(1), matrix }], mode: mergeMode === 3 ? 2 : 1 }
      ];
      outPaths = [outPaths[0]];
    }
  }
  for (let i = subgroups.length - 1; i >= 0; i--) {
    const group = subgroups[i];
    const groupItems = group.it ?? [];
    const tr = groupItems.find((it) => it && it.ty === "tr");
    const groupMatrix = tr ? multiply(matrix, cachedTransformMatrix(tr, frame)) : matrix;
    const groupOpacity = tr ? opacity * transformOpacity(tr, frame) : opacity;
    if (groupOpacity <= 0) continue;
    const groupStatic = tr ? staticMatrix && isStaticTransform(tr) : staticMatrix;
    shapeItems(groupItems, frame, groupMatrix, groupOpacity, groupStatic, ctx, mods);
  }
  if (outPaths.length && (fills.length || strokes.length)) {
    if (mergeMode === 5) {
      for (const f of fills) f.rule = 2;
    }
    ctx.ops.push({
      kind: "shape",
      paths: outPaths,
      matrix,
      fills,
      strokes,
      clips: mergeClips,
      static: staticMatrix && geomStatic
    });
  }
  for (let i = repeaters.length - 1; i >= 0; i--) {
    applyRepeater(repeaters[i], frame, matrix, ctx, startOps);
  }
}
function strokeBase(item, frame, opacity) {
  const base = {
    alpha: opacityOf(item, frame) * opacity,
    width: scalar(evaluate(item.w, frame)) ?? 1,
    cap: item.lc ?? 1,
    join: item.lj ?? 1
  };
  if (typeof item.ml === "number" && item.ml) base.miter = item.ml;
  if (Array.isArray(item.d) && item.d.length) {
    const arr = [];
    let off = 0;
    for (const seg of item.d) {
      const val = scalar(evaluate(seg?.v, frame)) ?? 0;
      if (seg?.n === "o") off = val;
      else arr.push(Math.max(0, val));
    }
    if (arr.some((v) => v > 0)) {
      base.dash = arr;
      if (off) base.dashOffset = off;
    }
  }
  return base;
}
function gradientPaint(item, frame, alpha) {
  const stops = gradientStops(item.g, frame);
  if (!stops.length) return null;
  const g = {
    kind: item.t === 2 ? "radial" : "linear",
    s: evaluate(item.s, frame) ?? [0, 0],
    e: evaluate(item.e, frame) ?? [0, 0],
    stops,
    alpha,
    rule: item.r === 2 ? 2 : 1
  };
  if (item.t === 2) {
    const h = scalar(evaluate(item.h, frame));
    const a = scalar(evaluate(item.a, frame));
    if (h) g.h = Math.max(-0.99, Math.min(0.99, h / 100));
    if (a) g.a = a;
  }
  return g;
}
function opacityOf(item, frame) {
  const o = scalar(evaluate(item.o, frame));
  return typeof o === "number" ? Math.min(1, Math.max(0, o / 100)) : 1;
}
function colorOf(c) {
  return Array.isArray(c) ? to255(c) : [0, 0, 0];
}
function gradientStops(g, frame) {
  const flat = evaluate(g?.k, frame);
  if (!Array.isArray(flat) || flat.length < 4) return [];
  const count = g?.p ?? flat.length >> 2;
  const alphaData = flat.slice(count * 4);
  const alphaAt = (pos) => {
    if (alphaData.length < 2) return 1;
    if (pos <= alphaData[0]) return alphaData[1];
    for (let i = 0; i + 3 < alphaData.length; i += 2) {
      const [p0, a0, p1, a1] = [alphaData[i], alphaData[i + 1], alphaData[i + 2], alphaData[i + 3]];
      if (pos <= p1) return p1 === p0 ? a1 : a0 + (a1 - a0) * ((pos - p0) / (p1 - p0));
    }
    return alphaData[alphaData.length - 1];
  };
  const stops = [];
  for (let i = 0; i < count; i++) {
    const p = flat[i * 4] ?? 0;
    const [r, g255, b] = colorOf([flat[i * 4 + 1], flat[i * 4 + 2], flat[i * 4 + 3]]);
    stops.push({ p, r, g: g255, b, a: alphaAt(p) });
  }
  return stops;
}

// src/animation.ts
var Animation = class {
  data;
  constructor(data) {
    if (!data || typeof data !== "object" || !Array.isArray(data.layers)) {
      throw new TypeError('Not a Lottie animation: expected an object with a "layers" array');
    }
    this.data = data;
  }
  get name() {
    return this.data.nm ?? "";
  }
  get version() {
    return this.data.v ?? "";
  }
  get width() {
    return this.data.w;
  }
  get height() {
    return this.data.h;
  }
  get frameRate() {
    return this.data.fr ?? 30;
  }
  get inPoint() {
    return this.data.ip ?? 0;
  }
  get outPoint() {
    return this.data.op ?? 0;
  }
  get totalFrames() {
    return this.outPoint - this.inPoint;
  }
  get duration() {
    return this.frameRate ? this.totalFrames / this.frameRate : 0;
  }
  get markers() {
    return this.data.markers ?? [];
  }
  frameAtTime(seconds) {
    const total = this.totalFrames;
    if (!total) return this.inPoint;
    const f = seconds * this.frameRate % total;
    return this.inPoint + (f < 0 ? f + total : f);
  }
  frameAtProgress(t) {
    return this.inPoint + Math.min(1, Math.max(0, t)) * this.totalFrames;
  }
  sceneAt(frame = this.inPoint) {
    return sceneAt(this.data, frame);
  }
};

// src/parse.ts
function parse(source) {
  if (typeof source === "string") return new Animation(JSON.parse(source));
  if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
    return new Animation(JSON.parse(new TextDecoder().decode(source)));
  }
  return new Animation(source);
}

// src/load.ts
async function load(src, opts = {}) {
  if (src instanceof URL) return parse(await fetchBytes(src.href, opts));
  if (typeof src === "string") {
    const t = src.trimStart();
    if (t[0] === "{" || t[0] === "[") return parse(src);
    return parse(await fetchBytes(src, opts));
  }
  return parse(src);
}
async function fetchBytes(url, opts) {
  const f = opts.fetch ?? globalThis.fetch;
  if (!f) throw new Error("load: no fetch available; pass one via options");
  const res = await f(url, { signal: opts.signal });
  if (!res.ok) throw new Error(`load: fetch ${url} failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

// src/events.ts
var Emitter = class {
  map = /* @__PURE__ */ new Map();
  on(type, cb) {
    let set = this.map.get(type);
    if (!set) this.map.set(type, set = /* @__PURE__ */ new Set());
    set.add(cb);
    return () => set.delete(cb);
  }
  off(type, cb) {
    this.map.get(type)?.delete(cb);
  }
  emit(type, payload) {
    const set = this.map.get(type);
    if (set) for (const cb of set) cb(payload);
  }
  clear() {
    this.map.clear();
  }
};

// src/playback.ts
var Playback = class {
  frame;
  playing = false;
  anim;
  surface;
  opts;
  lo;
  hi;
  dir;
  loop;
  speed;
  mode;
  emitter = new Emitter();
  rafId = null;
  lastNow = 0;
  resolveFinished;
  _finished;
  constructor(o) {
    this.anim = o.animation;
    this.surface = o.surface;
    this.opts = o.render ?? {};
    const [lo, hi] = o.segment ?? [o.animation.inPoint, o.animation.outPoint];
    this.lo = lo;
    this.hi = hi;
    this.loop = o.loop ?? false;
    this.speed = o.speed ?? 1;
    this.mode = o.mode ?? "forward";
    this.dir = this.mode === "reverse" ? -1 : 1;
    this.frame = this.dir === -1 ? hi : lo;
    this._finished = new Promise((res) => this.resolveFinished = res);
    if (o.respectReducedMotion) {
      this.frame = hi;
      this.renderFrame();
      return;
    }
    this.renderFrame();
    if (o.autoplay) this.start();
  }
  get progress() {
    const span = this.hi - this.lo;
    return span ? (this.frame - this.lo) / span : 0;
  }
  get finished() {
    return this._finished;
  }
  tick(dtMs) {
    if (!this.playing) return;
    const span = this.hi - this.lo || 1;
    let f = this.frame + dtMs / 1e3 * this.anim.frameRate * this.speed * this.dir;
    while (f > this.hi || f < this.lo) {
      if (f > this.hi) {
        if (this.mode === "bounce") {
          f = this.hi - (f - this.hi);
          this.dir = -1;
          this.emitter.emit("loop", void 0);
        } else if (this.loop) {
          f = this.lo + (f - this.lo) % span;
          this.emitter.emit("loop", void 0);
        } else {
          f = this.hi;
          this.finish();
          break;
        }
      } else if (f < this.lo) {
        if (this.mode === "bounce") {
          f = this.lo + (this.lo - f);
          this.dir = 1;
          this.emitter.emit("loop", void 0);
        } else if (this.loop) {
          f = this.hi - (this.lo - f) % span;
          this.emitter.emit("loop", void 0);
        } else {
          f = this.lo;
          this.finish();
          break;
        }
      }
    }
    this.frame = f;
    this.renderFrame();
    this.emitter.emit("frame", { frame: f, progress: this.progress });
  }
  play() {
    if (!this.playing) this.start();
  }
  pause() {
    this.playing = false;
    this.cancelRaf();
  }
  start() {
    this.playing = true;
    const raf = globalThis.requestAnimationFrame;
    if (!raf) return;
    this.lastNow = 0;
    const step = (now) => {
      if (!this.playing) return;
      if (this.lastNow) this.tick(now - this.lastNow);
      this.lastNow = now;
      this.rafId = raf(step);
    };
    this.rafId = raf(step);
  }
  stop() {
    this.pause();
    this.frame = this.dir === -1 ? this.hi : this.lo;
    this.renderFrame();
  }
  seek(frame) {
    this.frame = Math.min(this.hi, Math.max(this.lo, frame));
    this.renderFrame();
    this.emitter.emit("frame", { frame: this.frame, progress: this.progress });
  }
  seekTime(seconds) {
    this.seek(this.anim.frameAtTime(seconds));
  }
  on(type, cb) {
    return this.emitter.on(type, cb);
  }
  destroy() {
    this.pause();
    this.emitter.clear();
    this.surface.dispose();
  }
  renderFrame() {
    try {
      this.surface.render(this.anim, this.frame, this.opts);
    } catch (err) {
      this.emitter.emit("error", err);
    }
  }
  finish() {
    this.playing = false;
    this.cancelRaf();
    this.emitter.emit("complete", void 0);
    this.resolveFinished();
  }
  cancelRaf() {
    const cancel = globalThis.cancelAnimationFrame;
    if (this.rafId !== null && cancel) cancel(this.rafId);
    this.rafId = null;
  }
};

// src/surface/surface.ts
function outputSize(sceneW, sceneH, opts) {
  const dpr = Number(opts.dpr ?? 1) || 1;
  const width = Number(opts.width ?? sceneW) * dpr;
  const height = Number(opts.height ?? sceneH) * dpr;
  return { width, height, sx: width / (sceneW || width), sy: height / (sceneH || height) };
}

// src/surface/canvas.ts
var BLEND = {
  1: "multiply",
  2: "screen",
  3: "overlay",
  4: "darken",
  5: "lighten",
  6: "color-dodge",
  7: "color-burn",
  8: "hard-light",
  9: "soft-light",
  10: "difference",
  11: "exclusion",
  12: "hue",
  13: "saturation",
  14: "color",
  15: "luminosity",
  16: "lighter"
};
var CanvasSurface = class {
  ctx;
  images = /* @__PURE__ */ new Map();
  tints = /* @__PURE__ */ new WeakMap();
  constructor(ctx) {
    this.ctx = ctx;
  }
  render(anim, frame, options = {}) {
    const scene = anim.sceneAt(frame);
    const { sx, sy } = outputSize(scene.width, scene.height, options);
    const ctx = this.ctx;
    const base = ctx.getTransform();
    if (options.clear !== false) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.setTransform(base);
    }
    const ba = base.a, bb = base.b, bc = base.c, bd = base.d, be = base.e, bf = base.f;
    const prevAlpha = ctx.globalAlpha;
    const dev = { ba, bb, bc, bd, be, bf, sx, sy };
    for (const op of scene.ops) {
      let clipped = 0;
      let clipAlpha = 1;
      if (op.clips?.length) {
        const res = applyClips(ctx, op.clips, dev);
        if (res === null) continue;
        clipped = res.saved ? 1 : 0;
        clipAlpha = res.alpha;
      }
      const m = op.matrix;
      const ma = m[0] * sx, mb = m[1] * sy, mc = m[2] * sx, md = m[3] * sy, me = m[4] * sx, mf = m[5] * sy;
      ctx.setTransform(
        ba * ma + bc * mb,
        bb * ma + bd * mb,
        ba * mc + bc * md,
        bb * mc + bd * md,
        ba * me + bc * mf + be,
        bb * me + bd * mf + bf
      );
      const blend = op.blend !== void 0 ? BLEND[op.blend] : void 0;
      if (blend) ctx.globalCompositeOperation = blend;
      const filter = op.filters?.length ? cssFilter(op.filters) : "";
      if (filter) ctx.filter = filter;
      if (op.kind === "image") {
        this.drawImage(op, clipAlpha);
      } else {
        const path = opPath(op);
        for (const fill2 of op.fills) {
          if (fill2.alpha <= 0) continue;
          ctx.globalAlpha = fill2.alpha * clipAlpha;
          ctx.fillStyle = paintStyle(ctx, fill2);
          ctx.fill(path, fill2.rule === 2 ? "evenodd" : "nonzero");
        }
        for (const stroke of op.strokes) {
          if (stroke.alpha <= 0 || !stroke.width) continue;
          ctx.globalAlpha = stroke.alpha * clipAlpha;
          ctx.strokeStyle = paintStyle(ctx, stroke);
          ctx.lineWidth = stroke.width;
          ctx.lineCap = stroke.cap === 2 ? "round" : stroke.cap === 3 ? "square" : "butt";
          ctx.lineJoin = stroke.join === 2 ? "round" : stroke.join === 3 ? "bevel" : "miter";
          ctx.miterLimit = stroke.miter ?? 10;
          if (stroke.dash) {
            ctx.setLineDash(stroke.dash);
            ctx.lineDashOffset = stroke.dashOffset ?? 0;
          }
          ctx.stroke(path);
          if (stroke.dash) ctx.setLineDash([]);
        }
      }
      if (filter) ctx.filter = "none";
      if (blend) ctx.globalCompositeOperation = "source-over";
      if (clipped) ctx.restore();
    }
    ctx.setTransform(base);
    ctx.globalAlpha = prevAlpha;
  }
  drawImage(op, alphaMul = 1) {
    if (typeof Image === "undefined") return;
    let img = this.images.get(op.src);
    if (!img) {
      img = new Image();
      img.decoding = "async";
      img.src = op.src;
      this.images.set(op.src, img);
    }
    if (!img.complete || !img.naturalWidth) return;
    const source = op.filters?.length ? this.tinted(op, img) : img;
    this.ctx.globalAlpha = Math.min(1, Math.max(0, op.alpha)) * alphaMul;
    this.ctx.drawImage(source, 0, 0, op.width || img.naturalWidth, op.height || img.naturalHeight);
  }
  tinted(op, img) {
    const color = op.filters.filter(isColorFilter);
    if (!color.length) return img;
    let bySrc = this.tints.get(op.filters);
    if (!bySrc) {
      bySrc = /* @__PURE__ */ new Map();
      this.tints.set(op.filters, bySrc);
    }
    const hit = bySrc.get(op.src);
    if (hit !== void 0) return hit ?? img;
    const baked = bakeImage(img, color);
    bySrc.set(op.src, baked);
    return baked ?? img;
  }
  dispose() {
    this.images.clear();
    this.tints = /* @__PURE__ */ new WeakMap();
  }
};
function scratch(w, h) {
  if (typeof document !== "undefined") {
    const el = document.createElement("canvas");
    el.width = w;
    el.height = h;
    return el.getContext("2d", { willReadFrequently: true });
  }
  if (typeof OffscreenCanvas !== "undefined") {
    const off = new OffscreenCanvas(w, h);
    return off.getContext("2d");
  }
  return null;
}
function bakeImage(img, filters) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const ctx = scratch(w, h);
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h);
    applyColorFilters(data.data, filters);
    ctx.putImageData(data, 0, 0);
  } catch {
    return null;
  }
  return ctx.canvas;
}
function cssFilter(filters) {
  let out = "";
  for (const f of filters) {
    if (f.kind === "blur") {
      const r = Math.max(f.sigmaX, f.sigmaY);
      if (r > 0) out += `blur(${fmt(r)}px) `;
    } else if (f.kind === "shadow") {
      out += `drop-shadow(${fmt(f.offsetX)}px ${fmt(f.offsetY)}px ${fmt(f.sigma * 2)}px ${rgba(f.color, f.alpha)}) `;
    }
  }
  return out.trim();
}
var rgba = (c, a) => a >= 1 ? rgb(c) : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${fmt(a)})`;
function applyClips(ctx, clips, dev) {
  let saved = false;
  let alpha = 1;
  for (const clip of clips) {
    if (!clip.shapes.length) {
      if (clip.mode === 1) {
        if (saved) ctx.restore();
        return null;
      }
      continue;
    }
    if (clip.mode === 1 && clip.alpha !== void 0 && clip.alpha < 1) alpha *= clip.alpha;
    const p2d = new Path2D();
    let any = false;
    for (const shape of clip.shapes) {
      const m = shape.matrix;
      const ma = m[0] * dev.sx, mb = m[1] * dev.sy, mc = m[2] * dev.sx, md = m[3] * dev.sy;
      const me = m[4] * dev.sx, mf = m[5] * dev.sy;
      const dm = {
        a: dev.ba * ma + dev.bc * mb,
        b: dev.bb * ma + dev.bd * mb,
        c: dev.ba * mc + dev.bc * md,
        d: dev.bb * mc + dev.bd * md,
        e: dev.ba * me + dev.bc * mf + dev.be,
        f: dev.bb * me + dev.bd * mf + dev.bf
      };
      for (const pd of shape.paths) {
        if (!pd.v?.length) continue;
        p2d.addPath(buildOne(pd), dm);
        any = true;
      }
    }
    if (!any) {
      if (clip.mode === 1) {
        if (saved) ctx.restore();
        return null;
      }
      continue;
    }
    if (!saved) {
      ctx.save();
      saved = true;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (clip.mode === 2 || clip.mode === 3) {
      const outer = new Path2D();
      outer.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
      outer.addPath(p2d);
      ctx.clip(outer, "evenodd");
    } else {
      ctx.clip(p2d, "nonzero");
    }
  }
  return { saved, alpha };
}
var path2dCache = /* @__PURE__ */ new WeakMap();
function opPath(op) {
  if (op.paths.length === 1) {
    return op.static ? cachedPath2D(op.paths[0]) : buildOne(op.paths[0]);
  }
  const combined = new Path2D();
  for (const pd of op.paths) combined.addPath(op.static ? cachedPath2D(pd) : buildOne(pd));
  return combined;
}
function cachedPath2D(pd) {
  let p = path2dCache.get(pd);
  if (!p) {
    p = buildOne(pd);
    path2dCache.set(pd, p);
  }
  return p;
}
function buildOne(path) {
  const p = new Path2D();
  const v = path.v;
  if (!Array.isArray(v) || v.length === 0) return p;
  const inT = path.i ?? [];
  const outT = path.o ?? [];
  const n = v.length;
  p.moveTo(v[0][0], v[0][1]);
  for (let j = 1; j < n; j++) curve(p, v[j - 1], outT[j - 1], v[j], inT[j]);
  if (path.c && n > 1) {
    curve(p, v[n - 1], outT[n - 1], v[0], inT[0]);
    p.closePath();
  }
  return p;
}
function curve(p, p0, out = [0, 0], p1, inn = [0, 0]) {
  p.bezierCurveTo(
    p0[0] + (out[0] ?? 0),
    p0[1] + (out[1] ?? 0),
    p1[0] + (inn[0] ?? 0),
    p1[1] + (inn[1] ?? 0),
    p1[0],
    p1[1]
  );
}
function paintStyle(ctx, paint) {
  if (paint.kind === "color") return colorString(paint.color);
  const g = paint;
  const [sx, sy] = g.s;
  const [ex, ey] = g.e;
  let grad;
  if (g.kind === "radial") {
    const r = Math.hypot(ex - sx, ey - sy) || 1e-6;
    let fx = sx;
    let fy = sy;
    if (g.h) {
      const ang = Math.atan2(ey - sy, ex - sx) + (g.a ?? 0) * Math.PI / 180;
      fx = sx + Math.cos(ang) * g.h * r;
      fy = sy + Math.sin(ang) * g.h * r;
    }
    grad = ctx.createRadialGradient(fx, fy, 0, sx, sy, r);
  } else {
    grad = ctx.createLinearGradient(sx, sy, ex, ey);
  }
  for (const s of g.stops) {
    grad.addColorStop(Math.min(1, Math.max(0, s.p)), `rgba(${s.r},${s.g},${s.b},${s.a})`);
  }
  return grad;
}
var colorString = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

// src/mount.ts
async function mount(opts) {
  const animation = opts.animation ?? await load(opts.src);
  const ctx = opts.canvas.getContext("2d");
  if (!ctx) throw new Error("mount: canvas has no 2d context");
  const surface = new CanvasSurface(ctx);
  let render = opts.render;
  const dpr = render?.dpr ?? globalThis.devicePixelRatio ?? 1;
  const canvas = opts.canvas;
  if (dpr !== 1 && render?.width === void 0 && typeof canvas.width === "number" && typeof canvas.height === "number") {
    const cssW = canvas.width;
    const cssH = canvas.height;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    if (canvas.style) {
      if (!canvas.style.width) canvas.style.width = `${cssW}px`;
      if (!canvas.style.height) canvas.style.height = `${cssH}px`;
    }
    render = { ...render, width: canvas.width, height: canvas.height };
  }
  return new Playback({
    animation,
    surface,
    render,
    loop: opts.loop,
    speed: opts.speed,
    mode: opts.mode,
    segment: opts.segment,
    autoplay: opts.autoplay ?? true,
    respectReducedMotion: opts.respectReducedMotion
  });
}

// src/surface/svg.ts
var CAPS = { 1: "butt", 2: "round", 3: "square" };
var JOINS = { 1: "miter", 2: "round", 3: "bevel" };
var BLEND2 = {
  1: "multiply",
  2: "screen",
  3: "overlay",
  4: "darken",
  5: "lighten",
  6: "color-dodge",
  7: "color-burn",
  8: "hard-light",
  9: "soft-light",
  10: "difference",
  11: "exclusion",
  12: "hue",
  13: "saturation",
  14: "color",
  15: "luminosity"
};
var SvgSurface = class {
  render(anim, frame, options = {}) {
    const scene = anim.sceneAt(frame);
    const width = Number(options.width ?? scene.width);
    const height = Number(options.height ?? scene.height);
    const ctx = {
      defs: [],
      nextId: 0,
      idPrefix: String(options.idPrefix ?? "lj").replace(/[^\w-]/g, ""),
      sceneW: scene.width,
      sceneH: scene.height
    };
    let body = "";
    for (const op of scene.ops) {
      let inner = "";
      if (op.kind === "image") {
        if (op.alpha <= 0) continue;
        inner = `<image href="${escapeAttr(op.src)}" width="${fmt(op.width)}" height="${fmt(op.height)}"${op.alpha < 1 ? ` opacity="${fmt(op.alpha)}"` : ""} preserveAspectRatio="none"/>`;
      } else {
        const d = op.paths.map(pathToD).filter(Boolean).join(" ");
        if (!d) continue;
        for (const fill2 of op.fills) {
          if (fill2.alpha <= 0) continue;
          inner += `<path d="${d}" ${fillAttrs(fill2, ctx)} stroke="none"/>`;
        }
        for (const stroke of op.strokes) {
          if (stroke.alpha <= 0 || !stroke.width) continue;
          inner += `<path d="${d}" fill="none" ${strokeAttrs(stroke, ctx)}/>`;
        }
      }
      if (!inner) continue;
      let out = isIdentity(op.matrix) ? inner : `<g transform="${toSvg(op.matrix)}">${inner}</g>`;
      const blend = op.blend !== void 0 ? BLEND2[op.blend] : void 0;
      if (op.clips?.length) {
        const wrapped = wrapClips(out, op.clips, ctx);
        if (wrapped === null) continue;
        out = wrapped;
      }
      if (op.filters?.length) out = `<g filter="url(#${filterDef(op, op.filters, ctx)})">${out}</g>`;
      if (blend) out = `<g style="mix-blend-mode:${blend}">${out}</g>`;
      body += out;
    }
    const defs = ctx.defs.length ? `<defs>${ctx.defs.join("")}</defs>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(scene.width)} ${fmt(scene.height)}">${defs}${body}</svg>`;
  }
  dispose() {
  }
};
function wrapClips(inner, clips, ctx) {
  let out = inner;
  for (let i = clips.length - 1; i >= 0; i--) {
    const clip = clips[i];
    const subtractive = clip.mode === 2 || clip.mode === 3;
    const soft = clip.shapes.some((s) => s.coverage !== void 0 && s.coverage < 1);
    if (soft) {
      let content2 = "";
      for (const shape of clip.shapes) {
        const d = shape.paths.map(pathToD).filter(Boolean).join(" ");
        if (!d) continue;
        const tr = isIdentity(shape.matrix) ? "" : ` transform="${toSvg(shape.matrix)}"`;
        let g = Math.round(Math.min(1, Math.max(0, shape.coverage ?? 1)) * 255);
        if (subtractive) g = 255 - g;
        content2 += `<path d="${d}" fill="rgb(${g},${g},${g})"${tr}/>`;
      }
      if (!content2) {
        if (clip.mode === 1) return null;
        continue;
      }
      const pad = Math.max(ctx.sceneW, ctx.sceneH) * 4;
      const bg = subtractive ? 255 : 0;
      const id2 = `${ctx.idPrefix}-mask-${ctx.nextId++}`;
      ctx.defs.push(
        `<mask id="${id2}" maskUnits="userSpaceOnUse" x="${fmt(-pad)}" y="${fmt(-pad)}" width="${fmt(pad * 2 + ctx.sceneW)}" height="${fmt(pad * 2 + ctx.sceneH)}"><rect x="${fmt(-pad)}" y="${fmt(-pad)}" width="${fmt(pad * 2 + ctx.sceneW)}" height="${fmt(pad * 2 + ctx.sceneH)}" fill="rgb(${bg},${bg},${bg})"/>${content2}</mask>`
      );
      out = `<g mask="url(#${id2})">${out}</g>`;
      if (clip.mode === 1 && clip.alpha !== void 0 && clip.alpha < 1) {
        out = `<g opacity="${fmt(clip.alpha)}">${out}</g>`;
      }
      continue;
    }
    let content = "";
    for (const shape of clip.shapes) {
      const d = shape.paths.map(pathToD).filter(Boolean).join(" ");
      if (!d) continue;
      const tr = isIdentity(shape.matrix) ? "" : ` transform="${toSvg(shape.matrix)}"`;
      content += `<path d="${d}"${tr}${subtractive ? ' clip-rule="evenodd"' : ""}/>`;
    }
    if (!content) {
      if (clip.mode === 1) return null;
      continue;
    }
    const id = `${ctx.idPrefix}-clip-${ctx.nextId++}`;
    if (subtractive) {
      const pad = Math.max(ctx.sceneW, ctx.sceneH) * 4;
      content = `<path d="M${fmt(-pad)},${fmt(-pad)}h${fmt(pad * 2 + ctx.sceneW)}v${fmt(pad * 2 + ctx.sceneH)}h${fmt(-(pad * 2 + ctx.sceneW))}Z" clip-rule="evenodd"/>` + content;
      ctx.defs.push(`<clipPath id="${id}" clip-rule="evenodd">${content}</clipPath>`);
    } else {
      ctx.defs.push(`<clipPath id="${id}">${content}</clipPath>`);
    }
    out = `<g clip-path="url(#${id})">${out}</g>`;
    if (clip.mode === 1 && clip.alpha !== void 0 && clip.alpha < 1) {
      out = `<g opacity="${fmt(clip.alpha)}">${out}</g>`;
    }
  }
  return out;
}
function opBounds(op, m) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (x, y) => {
    const dx = m[0] * x + m[2] * y + m[4];
    const dy = m[1] * x + m[3] * y + m[5];
    if (dx < x0) x0 = dx;
    if (dx > x1) x1 = dx;
    if (dy < y0) y0 = dy;
    if (dy > y1) y1 = dy;
  };
  if (op.kind === "image") {
    add(0, 0);
    add(op.width, 0);
    add(0, op.height);
    add(op.width, op.height);
  } else {
    let widen = 0;
    for (const s of op.strokes) widen = Math.max(widen, (s.width ?? 0) / 2);
    for (const path of op.paths) {
      const v = path.v;
      if (!Array.isArray(v)) continue;
      for (let j = 0; j < v.length; j++) {
        const p = v[j];
        const i = path.i?.[j] ?? [0, 0];
        const o = path.o?.[j] ?? [0, 0];
        add(p[0] - widen, p[1] - widen);
        add(p[0] + widen, p[1] + widen);
        add(p[0] + (i[0] ?? 0), p[1] + (i[1] ?? 0));
        add(p[0] + (o[0] ?? 0), p[1] + (o[1] ?? 0));
      }
    }
  }
  if (!Number.isFinite(x0)) return [0, 0, 0, 0];
  return [x0, y0, x1, y1];
}
function filterDef(op, filters, ctx) {
  const m = op.matrix;
  const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
  const id = `${ctx.idPrefix}-filter-${ctx.nextId++}`;
  let pad = 0;
  let prev = "SourceGraphic";
  let body = "";
  let n = 0;
  const step = () => `${id}-${n++}`;
  for (const f of filters) {
    const result = step();
    if (f.kind === "blur") {
      const sx = f.sigmaX * scale;
      const sy = f.sigmaY * scale;
      pad += 3 * Math.max(sx, sy);
      body += `<feGaussianBlur in="${prev}" stdDeviation="${fmt(sx)} ${fmt(sy)}"${f.repeatEdge ? ' edgeMode="duplicate"' : ""} result="${result}"/>`;
    } else if (f.kind === "shadow") {
      const dx = m[0] * f.offsetX + m[2] * f.offsetY;
      const dy = m[1] * f.offsetX + m[3] * f.offsetY;
      const sigma = f.sigma * scale;
      pad += 3 * sigma + Math.hypot(dx, dy);
      const alphaId = step();
      const blurId = step();
      const offsetId = step();
      const floodId = step();
      const shadowId = step();
      body += `<feColorMatrix in="${prev}" type="matrix" result="${alphaId}" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"/><feGaussianBlur in="${alphaId}" stdDeviation="${fmt(sigma)}" result="${blurId}"/><feOffset in="${blurId}" dx="${fmt(dx)}" dy="${fmt(dy)}" result="${offsetId}"/><feFlood flood-color="${rgb(f.color)}" flood-opacity="${fmt(f.alpha)}" result="${floodId}"/><feComposite in="${floodId}" in2="${offsetId}" operator="in" result="${shadowId}"/><feMerge result="${result}"><feMergeNode in="${shadowId}"/><feMergeNode in="${prev}"/></feMerge>`;
    } else if (f.kind === "colorMatrix") {
      body += `<feColorMatrix in="${prev}" type="matrix" result="${result}" values="${f.values.map(fmt).join(" ")}"/>`;
    } else {
      body += `<feComponentTransfer in="${prev}" result="${result}">` + transferFunc("R", f.r) + transferFunc("G", f.g) + transferFunc("B", f.b) + transferFunc("A", f.a) + "</feComponentTransfer>";
    }
    prev = result;
  }
  const [x0, y0, x1, y1] = opBounds(op, m);
  pad = Math.max(pad, 1);
  ctx.defs.push(
    `<filter id="${id}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB" x="${fmt(x0 - pad)}" y="${fmt(y0 - pad)}" width="${fmt(x1 - x0 + pad * 2)}" height="${fmt(y1 - y0 + pad * 2)}">${body}</filter>`
  );
  return id;
}
function transferFunc(channel, table) {
  if (!table?.length) return "";
  return `<feFunc${channel} type="table" tableValues="${table.map(fmt).join(" ")}"/>`;
}
function pathToD(path) {
  const { v, c } = path;
  if (!Array.isArray(v) || v.length === 0) return "";
  const inT = path.i ?? [];
  const outT = path.o ?? [];
  const n = v.length;
  let d = `M${fmt(v[0][0])},${fmt(v[0][1])}`;
  for (let j = 1; j < n; j++) d += curveTo(v[j - 1], outT[j - 1], v[j], inT[j]);
  if (c && n > 1) {
    d += curveTo(v[n - 1], outT[n - 1], v[0], inT[0]);
    d += "Z";
  }
  return d;
}
function curveTo(p0, out = [0, 0], p1, inn = [0, 0]) {
  return `C${fmt(p0[0] + (out[0] ?? 0))},${fmt(p0[1] + (out[1] ?? 0))} ${fmt(p1[0] + (inn[0] ?? 0))},${fmt(p1[1] + (inn[1] ?? 0))} ${fmt(p1[0])},${fmt(p1[1])}`;
}
function fillAttrs(fill2, ctx) {
  let paint;
  if (fill2.kind === "color") {
    paint = `fill="${rgb(fill2.color)}"`;
  } else {
    paint = `fill="url(#${gradientDef(fill2, ctx)})"`;
  }
  if (fill2.alpha < 1) paint += ` fill-opacity="${fmt(Math.max(0, fill2.alpha))}"`;
  if (fill2.rule === 2) paint += ' fill-rule="evenodd"';
  return paint;
}
function strokeAttrs(s, ctx) {
  const paint = s.kind === "color" ? rgb(s.color) : `url(#${gradientDef(s, ctx)})`;
  let attrs = `stroke="${paint}" stroke-width="${fmt(s.width ?? 1)}"`;
  if (s.alpha < 1) attrs += ` stroke-opacity="${fmt(Math.max(0, s.alpha))}"`;
  const cap = CAPS[s.cap ?? 1];
  if (cap && cap !== "butt") attrs += ` stroke-linecap="${cap}"`;
  const join = JOINS[s.join ?? 1];
  if (join && join !== "miter") attrs += ` stroke-linejoin="${join}"`;
  if (s.miter && s.miter !== 4) attrs += ` stroke-miterlimit="${fmt(s.miter)}"`;
  if (s.dash?.length) {
    attrs += ` stroke-dasharray="${s.dash.map(fmt).join(" ")}"`;
    if (s.dashOffset) attrs += ` stroke-dashoffset="${fmt(s.dashOffset)}"`;
  }
  return attrs;
}
function gradientDef(g, ctx) {
  const id = `${ctx.idPrefix}-grad-${ctx.nextId++}`;
  const stops = g.stops.map(
    (s) => `<stop offset="${fmt(s.p * 100)}%" stop-color="rgb(${s.r},${s.g},${s.b})"${s.a < 1 ? ` stop-opacity="${fmt(s.a)}"` : ""}/>`
  ).join("");
  const common = `id="${id}" gradientUnits="userSpaceOnUse"`;
  if (g.kind === "radial") {
    const r = Math.hypot((g.e[0] ?? 0) - (g.s[0] ?? 0), (g.e[1] ?? 0) - (g.s[1] ?? 0));
    let focal = "";
    if (g.h) {
      const ang = Math.atan2((g.e[1] ?? 0) - (g.s[1] ?? 0), (g.e[0] ?? 0) - (g.s[0] ?? 0)) + (g.a ?? 0) * Math.PI / 180;
      focal = ` fx="${fmt(g.s[0] + Math.cos(ang) * g.h * r)}" fy="${fmt(g.s[1] + Math.sin(ang) * g.h * r)}"`;
    }
    ctx.defs.push(
      `<radialGradient ${common} cx="${fmt(g.s[0])}" cy="${fmt(g.s[1])}" r="${fmt(r)}"${focal}>${stops}</radialGradient>`
    );
  } else {
    ctx.defs.push(
      `<linearGradient ${common} x1="${fmt(g.s[0])}" y1="${fmt(g.s[1])}" x2="${fmt(g.e[0])}" y2="${fmt(g.e[1])}">${stops}</linearGradient>`
    );
  }
  return id;
}
function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// src/surface/image/flatten.ts
var CURVE_STEPS_MAX = 48;
var avgScaleCached = 1;
function avgScale(m) {
  const det = Math.abs(m[0] * m[3] - m[1] * m[2]);
  avgScaleCached = Math.sqrt(det) || 1;
  return avgScaleCached;
}
function flattenPath(path, m, out) {
  const v = path.v;
  if (!Array.isArray(v) || v.length < 2) return;
  const inT = path.i ?? [];
  const outT = path.o ?? [];
  const n = v.length;
  const ring2 = [];
  pushPoint(ring2, v[0], m);
  for (let j = 1; j <= (path.c ? n : n - 1); j++) {
    const a = v[j - 1];
    const b = v[j % n];
    const ta = outT[j - 1] ?? [0, 0];
    const tb = inT[j % n] ?? [0, 0];
    flattenCubic(ring2, a, ta, b, tb, m);
  }
  if (ring2.length >= 4) out.push(ring2);
}
function pushPoint(ring2, p, m) {
  ring2.push(m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]);
}
function flattenCubic(ring2, a, ta, b, tb, m) {
  const tax = ta[0] ?? 0;
  const tay = ta[1] ?? 0;
  const tbx = tb[0] ?? 0;
  const tby = tb[1] ?? 0;
  if (!tax && !tay && !tbx && !tby) {
    pushPoint(ring2, b, m);
    return;
  }
  const x0 = a[0];
  const y0 = a[1];
  const x1 = x0 + tax;
  const y1 = y0 + tay;
  const x3 = b[0];
  const y3 = b[1];
  const x2 = x3 + tbx;
  const y2 = y3 + tby;
  const len = (Math.abs(x1 - x0) + Math.abs(y1 - y0) + Math.abs(x2 - x1) + Math.abs(y2 - y1) + Math.abs(x3 - x2) + Math.abs(y3 - y2)) * avgScaleCached;
  const steps = Math.min(CURVE_STEPS_MAX, Math.max(4, Math.ceil(len / 4)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const w0 = u * u * u;
    const w1 = 3 * u * u * t;
    const w2 = 3 * u * t * t;
    const w3 = t * t * t;
    const px = w0 * x0 + w1 * x1 + w2 * x2 + w3 * x3;
    const py = w0 * y0 + w1 * y1 + w2 * y2 + w3 * y3;
    ring2.push(m[0] * px + m[2] * py + m[4], m[1] * px + m[3] * py + m[5]);
  }
}
function strokeRing(ring2, halfW, cap, out) {
  const n = ring2.length / 2;
  if (n < 2 || halfW <= 0) return;
  for (let i = 0; i < n - 1; i++) {
    const x0 = ring2[i * 2];
    const y0 = ring2[i * 2 + 1];
    const x1 = ring2[i * 2 + 2];
    const y1 = ring2[i * 2 + 3];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const nx = -dy / len * halfW;
    const ny = dx / len * halfW;
    out.push([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny]);
  }
  const segs = Math.min(32, Math.max(8, Math.ceil(halfW * 2)));
  const from = cap === 1 ? 1 : 0;
  const to = cap === 1 ? n - 1 : n;
  for (let i = from; i < to; i++) {
    const cx = ring2[i * 2];
    const cy = ring2[i * 2 + 1];
    const disk = [];
    for (let k = segs - 1; k >= 0; k--) {
      const a = k / segs * Math.PI * 2;
      disk.push(cx + Math.cos(a) * halfW, cy + Math.sin(a) * halfW);
    }
    out.push(disk);
  }
}

// src/surface/image/paint.ts
var LUT_SIZE = 256;
function devicePaint(paint, m) {
  if (paint.kind === "color") {
    return { grad: null, r: paint.color[0], g: paint.color[1], b: paint.color[2], a: paint.alpha };
  }
  const sx = m[0] * paint.s[0] + m[2] * paint.s[1] + m[4];
  const sy = m[1] * paint.s[0] + m[3] * paint.s[1] + m[5];
  const ex = m[0] * paint.e[0] + m[2] * paint.e[1] + m[4];
  const ey = m[1] * paint.e[0] + m[3] * paint.e[1] + m[5];
  const lut = new Uint8Array(LUT_SIZE * 4);
  const stops = paint.stops;
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1);
    let s0 = stops[0];
    let s1 = stops[stops.length - 1];
    for (let k = 0; k < stops.length - 1; k++) {
      if (t >= stops[k].p && t <= stops[k + 1].p) {
        s0 = stops[k];
        s1 = stops[k + 1];
        break;
      }
    }
    const span = s1.p - s0.p;
    const f = span > 0 ? Math.min(1, Math.max(0, (t - s0.p) / span)) : t < s0.p ? 0 : 1;
    const a = (s0.a + (s1.a - s0.a) * f) * paint.alpha;
    lut[i * 4] = (s0.r + (s1.r - s0.r) * f) * a;
    lut[i * 4 + 1] = (s0.g + (s1.g - s0.g) * f) * a;
    lut[i * 4 + 2] = (s0.b + (s1.b - s0.b) * f) * a;
    lut[i * 4 + 3] = a * 255;
  }
  if (paint.kind === "radial") {
    const radius = Math.hypot(ex - sx, ey - sy) || 1e-6;
    if (paint.h) {
      const ang = Math.atan2(ey - sy, ex - sx) + (paint.a ?? 0) * Math.PI / 180;
      const fx = sx + Math.cos(ang) * paint.h * radius;
      const fy = sy + Math.sin(ang) * paint.h * radius;
      return { grad: "focal", lut, cx: sx, cy: sy, fx, fy, r: radius };
    }
    return { grad: "radial", lut, gx: sx, gy: sy, invR: 1 / radius };
  }
  const dx = ex - sx;
  const dy = ey - sy;
  const len2 = dx * dx + dy * dy || 1e-6;
  return { grad: "linear", lut, gx: sx, gy: sy, gdx: dx / len2, gdy: dy / len2 };
}

// src/surface/image/filter.ts
var PASSES = 3;
function boxRadii(sigma) {
  const ideal = Math.sqrt(12 * sigma * sigma / PASSES + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl--;
  if (wl < 1) wl = 1;
  const wu = wl + 2;
  const m = Math.round(
    (12 * sigma * sigma - PASSES * wl * wl - 4 * PASSES * wl - 3 * PASSES) / (-4 * wl - 4)
  );
  const out = [];
  for (let i = 0; i < PASSES; i++) out.push(((i < m ? wl : wu) - 1) / 2);
  return out;
}
function boxH(src, dst, w, h, r, edge) {
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    let a = 0;
    let b = 0;
    let c = 0;
    let d = 0;
    for (let k = -r; k <= r; k++) {
      const x = edge ? k < 0 ? 0 : k >= w ? w - 1 : k : k;
      if (x < 0 || x >= w) continue;
      const i = row + x * 4;
      a += src[i];
      b += src[i + 1];
      c += src[i + 2];
      d += src[i + 3];
    }
    for (let x = 0; x < w; x++) {
      const o = row + x * 4;
      dst[o] = a * norm;
      dst[o + 1] = b * norm;
      dst[o + 2] = c * norm;
      dst[o + 3] = d * norm;
      let xm = x - r;
      let xp = x + r + 1;
      if (edge) {
        if (xm < 0) xm = 0;
        if (xp >= w) xp = w - 1;
      }
      if (xm >= 0) {
        const i = row + xm * 4;
        a -= src[i];
        b -= src[i + 1];
        c -= src[i + 2];
        d -= src[i + 3];
      }
      if (xp < w) {
        const i = row + xp * 4;
        a += src[i];
        b += src[i + 1];
        c += src[i + 2];
        d += src[i + 3];
      }
    }
  }
}
function boxV(src, dst, w, h, r, edge) {
  const norm = 1 / (2 * r + 1);
  const stride = w * 4;
  for (let x = 0; x < w; x++) {
    const col = x * 4;
    let a = 0;
    let b = 0;
    let c = 0;
    let d = 0;
    for (let k = -r; k <= r; k++) {
      const y = edge ? k < 0 ? 0 : k >= h ? h - 1 : k : k;
      if (y < 0 || y >= h) continue;
      const i = col + y * stride;
      a += src[i];
      b += src[i + 1];
      c += src[i + 2];
      d += src[i + 3];
    }
    for (let y = 0; y < h; y++) {
      const o = col + y * stride;
      dst[o] = a * norm;
      dst[o + 1] = b * norm;
      dst[o + 2] = c * norm;
      dst[o + 3] = d * norm;
      let ym = y - r;
      let yp = y + r + 1;
      if (edge) {
        if (ym < 0) ym = 0;
        if (yp >= h) yp = h - 1;
      }
      if (ym >= 0) {
        const i = col + ym * stride;
        a -= src[i];
        b -= src[i + 1];
        c -= src[i + 2];
        d -= src[i + 3];
      }
      if (yp < h) {
        const i = col + yp * stride;
        a += src[i];
        b += src[i + 1];
        c += src[i + 2];
        d += src[i + 3];
      }
    }
  }
}
function blurRGBA(buf, tmp, w, h, sigmaX, sigmaY, edge) {
  const rx = sigmaX > 0.05 ? boxRadii(sigmaX) : null;
  const ry = sigmaY > 0.05 ? boxRadii(sigmaY) : null;
  if (!rx && !ry) return;
  let src = buf;
  let dst = tmp;
  for (let i = 0; i < PASSES; i++) {
    if (rx && rx[i] > 0) {
      boxH(src, dst, w, h, rx[i], edge);
      const swap = src;
      src = dst;
      dst = swap;
    }
    if (ry && ry[i] > 0) {
      boxV(src, dst, w, h, ry[i], edge);
      const swap = src;
      src = dst;
      dst = swap;
    }
  }
  if (src !== buf) buf.set(src);
}
function shadowRGBA(layer2, out, tmp, w, h, color, alpha, dx, dy, sigma) {
  out.fill(0);
  const ox = Math.round(dx);
  const oy = Math.round(dy);
  const stride = w * 4;
  for (let y = 0; y < h; y++) {
    const sy = y - oy;
    if (sy < 0 || sy >= h) continue;
    const srcRow = sy * stride;
    const dstRow = y * stride;
    for (let x = 0; x < w; x++) {
      const sx = x - ox;
      if (sx < 0 || sx >= w) continue;
      const a = layer2[srcRow + sx * 4 + 3] * alpha;
      if (a <= 0) continue;
      const i = dstRow + x * 4;
      const t = a / 255;
      out[i] = color[0] * t;
      out[i + 1] = color[1] * t;
      out[i + 2] = color[2] * t;
      out[i + 3] = a;
    }
  }
  blurRGBA(out, tmp, w, h, sigma, sigma, false);
  for (let i = 0; i < out.length; i += 4) {
    const sa = layer2[i + 3];
    if (sa <= 0) continue;
    const ia = 1 - sa / 255;
    out[i] = out[i] * ia + layer2[i];
    out[i + 1] = out[i + 1] * ia + layer2[i + 1];
    out[i + 2] = out[i + 2] * ia + layer2[i + 2];
    out[i + 3] = out[i + 3] * ia + sa;
  }
  layer2.set(out);
}
function colorRGBA(buf, f) {
  const px = [0, 0, 0, 0];
  for (let i = 0; i < buf.length; i += 4) {
    const a = buf[i + 3];
    if (a === 0) continue;
    px[0] = buf[i] / a;
    px[1] = buf[i + 1] / a;
    px[2] = buf[i + 2] / a;
    px[3] = a / 255;
    colorAt(f, px);
    const na = clamp012(px[3]);
    buf[i] = clamp012(px[0]) * na * 255;
    buf[i + 1] = clamp012(px[1]) * na * 255;
    buf[i + 2] = clamp012(px[2]) * na * 255;
    buf[i + 3] = na * 255;
  }
}

// src/surface/image/scanline.ts
var SUBS = 4;
var SUB_COVER = 1 / SUBS;
var cached = null;
function getRaster(w, h) {
  if (!cached || cached.w !== w || cached.h !== h) cached = new Raster(w, h);
  return cached;
}
var BLENDS = {
  1: (b, s) => b * s,
  2: (b, s) => b + s - b * s,
  3: (b, s) => b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s),
  4: (b, s) => Math.min(b, s),
  5: (b, s) => Math.max(b, s),
  6: (b, s) => b === 0 ? 0 : s === 1 ? 1 : Math.min(1, b / (1 - s)),
  7: (b, s) => b === 1 ? 1 : s === 0 ? 0 : 1 - Math.min(1, (1 - b) / s),
  8: (b, s) => s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s),
  9: (b, s) => s <= 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * ((b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b)) - b),
  10: (b, s) => Math.abs(b - s),
  11: (b, s) => b + s - 2 * b * s,
  16: (b, s) => Math.min(1, b + s)
};
var lum3 = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
function clipColor(r, g, b) {
  const l = lum3(r, g, b);
  const n = Math.min(r, g, b);
  const x = Math.max(r, g, b);
  if (n < 0) {
    r = l + (r - l) * l / (l - n);
    g = l + (g - l) * l / (l - n);
    b = l + (b - l) * l / (l - n);
  }
  if (x > 1) {
    r = l + (r - l) * (1 - l) / (x - l);
    g = l + (g - l) * (1 - l) / (x - l);
    b = l + (b - l) * (1 - l) / (x - l);
  }
  return [r, g, b];
}
function setLum(r, g, b, l) {
  const d = l - lum3(r, g, b);
  return clipColor(r + d, g + d, b + d);
}
function setSat(r, g, b, s) {
  const c = [r, g, b];
  const idx = [0, 1, 2].sort((a, z) => c[a] - c[z]);
  const [lo, mid, hi] = idx;
  if (c[hi] > c[lo]) {
    c[mid] = (c[mid] - c[lo]) * s / (c[hi] - c[lo]);
    c[hi] = s;
  } else {
    c[mid] = 0;
    c[hi] = 0;
  }
  c[lo] = 0;
  return [c[0], c[1], c[2]];
}
var sat3 = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
var BLENDS3 = {
  12: (br, bg, bb, sr, sg, sb) => {
    const [r, g, b] = setSat(sr, sg, sb, sat3(br, bg, bb));
    return setLum(r, g, b, lum3(br, bg, bb));
  },
  13: (br, bg, bb, sr, sg, sb) => {
    const [r, g, b] = setSat(br, bg, bb, sat3(sr, sg, sb));
    return setLum(r, g, b, lum3(br, bg, bb));
  },
  14: (br, bg, bb, sr, sg, sb) => setLum(sr, sg, sb, lum3(br, bg, bb)),
  15: (br, bg, bb, sr, sg, sb) => setLum(br, bg, bb, lum3(sr, sg, sb))
};
var Raster = class {
  w;
  h;
  buf;
  out;
  cov;
  cap;
  ex;
  eslope;
  ey0;
  ey1;
  edir;
  order;
  xs;
  ws;
  active;
  clipBuf = null;
  stageBuf = null;
  shapeBuf = null;
  layerBuf = null;
  tmpBuf = null;
  shadowBuf = null;
  saved = null;
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8ClampedArray(w * h * 4);
    this.out = new Uint8ClampedArray(w * h * 4);
    this.cov = new Float32Array(w + 2);
    this.growEdges(1024);
    this.xs = new Float64Array(256);
    this.ws = new Int8Array(256);
    this.active = new Int32Array(256);
    this.order = new Int32Array(1024);
  }
  growEdges(n) {
    this.cap = n;
    this.ex = new Float64Array(n);
    this.eslope = new Float64Array(n);
    this.ey0 = new Float64Array(n);
    this.ey1 = new Float64Array(n);
    this.edir = new Int8Array(n);
    this.order = new Int32Array(n);
  }
  clear() {
    this.buf.fill(0);
  }
  acquireClipBuf() {
    if (!this.clipBuf) this.clipBuf = new Float32Array(this.w * this.h);
    this.clipBuf.fill(1);
    return this.clipBuf;
  }
  acquireStageBuf() {
    if (!this.stageBuf) this.stageBuf = new Float32Array(this.w * this.h);
    this.stageBuf.fill(0);
    return this.stageBuf;
  }
  acquireShapeBuf() {
    if (!this.shapeBuf) this.shapeBuf = new Float32Array(this.w * this.h);
    this.shapeBuf.fill(0);
    return this.shapeBuf;
  }
  beginLayer() {
    if (!this.layerBuf) this.layerBuf = new Uint8ClampedArray(this.w * this.h * 4);
    this.layerBuf.fill(0);
    this.saved = this.buf;
    this.buf = this.layerBuf;
  }
  endLayer(filters, scale, m, blend) {
    const layer2 = this.buf;
    this.buf = this.saved;
    this.saved = null;
    const { w, h } = this;
    for (const f of filters) {
      if (f.kind === "blur") {
        blurRGBA(layer2, this.scratch("tmp"), w, h, f.sigmaX * scale, f.sigmaY * scale, !!f.repeatEdge);
      } else if (f.kind === "shadow") {
        shadowRGBA(
          layer2,
          this.scratch("shadow"),
          this.scratch("tmp"),
          w,
          h,
          f.color,
          f.alpha,
          m[0] * f.offsetX + m[2] * f.offsetY,
          m[1] * f.offsetX + m[3] * f.offsetY,
          f.sigma * scale
        );
      } else {
        colorRGBA(layer2, f);
      }
    }
    this.compose(layer2, blend);
  }
  scratch(which) {
    if (which === "tmp") {
      if (!this.tmpBuf) this.tmpBuf = new Uint8ClampedArray(this.w * this.h * 4);
      return this.tmpBuf;
    }
    if (!this.shadowBuf) this.shadowBuf = new Uint8ClampedArray(this.w * this.h * 4);
    return this.shadowBuf;
  }
  compose(src, blend) {
    const buf = this.buf;
    const blendFn = blend ? BLENDS[blend] : void 0;
    const blend3 = blend ? BLENDS3[blend] : void 0;
    if (!blendFn && !blend3) {
      for (let i = 0; i < buf.length; i += 4) {
        const sa = src[i + 3];
        if (sa <= 0) continue;
        const ia = 1 - sa / 255;
        buf[i] = buf[i] * ia + src[i];
        buf[i + 1] = buf[i + 1] * ia + src[i + 1];
        buf[i + 2] = buf[i + 2] * ia + src[i + 2];
        buf[i + 3] = buf[i + 3] * ia + sa;
      }
      return;
    }
    for (let i = 0; i < buf.length; i += 4) {
      const as = src[i + 3] / 255;
      if (as <= 0) continue;
      const sr = src[i] / 255 / as;
      const sg = src[i + 1] / 255 / as;
      const sb = src[i + 2] / 255 / as;
      const ab = buf[i + 3] / 255;
      const br = ab > 0 ? buf[i] / 255 / ab : 0;
      const bg = ab > 0 ? buf[i + 1] / 255 / ab : 0;
      const bb = ab > 0 ? buf[i + 2] / 255 / ab : 0;
      let mr;
      let mg;
      let mb;
      if (blend3) {
        [mr, mg, mb] = blend3(br, bg, bb, sr, sg, sb);
      } else {
        mr = blendFn(br, sr);
        mg = blendFn(bg, sg);
        mb = blendFn(bb, sb);
      }
      buf[i] = (as * (1 - ab) * sr + as * ab * mr + (1 - as) * ab * br) * 255;
      buf[i + 1] = (as * (1 - ab) * sg + as * ab * mg + (1 - as) * ab * bg) * 255;
      buf[i + 2] = (as * (1 - ab) * sb + as * ab * mb + (1 - as) * ab * bb) * 255;
      buf[i + 3] = (as + ab * (1 - as)) * 255;
    }
  }
  fillRings(rings, rule, paint, clip = null, blend = 0) {
    const blendFn = blend ? BLENDS[blend] : void 0;
    const blend3 = blend ? BLENDS3[blend] : void 0;
    this.scan(rings, rule, paint, clip, blendFn, blend3, null);
  }
  coverageRings(rings, out) {
    this.scan(rings, 1, null, null, void 0, void 0, out);
  }
  coverageRow(py, x0, x1, out) {
    const cov = this.cov;
    const off = py * this.w;
    for (let x = x0; x <= x1; x++) {
      const c = cov[x];
      if (c > 0) {
        cov[x] = 0;
        out[off + x] = c > 1 ? 1 : c;
      }
    }
  }
  scan(rings, rule, paint, clip, blendFn, blend3, covOut) {
    const { w, h } = this;
    let ne = 0;
    let minY = h;
    let maxY = 0;
    for (const ring2 of rings) {
      const n = ring2.length / 2;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        let x0 = ring2[i * 2];
        let y0 = ring2[i * 2 + 1];
        let x1 = ring2[j * 2];
        let y1 = ring2[j * 2 + 1];
        if (y0 === y1) continue;
        let dir = 1;
        if (y0 > y1) {
          [x0, x1] = [x1, x0];
          [y0, y1] = [y1, y0];
          dir = -1;
        }
        if (y1 <= 0 || y0 >= h) continue;
        if (ne >= this.cap) {
          const [ex, es, e0, e1, ed] = [this.ex, this.eslope, this.ey0, this.ey1, this.edir];
          this.growEdges(this.cap * 2);
          this.ex.set(ex);
          this.eslope.set(es);
          this.ey0.set(e0);
          this.ey1.set(e1);
          this.edir.set(ed);
        }
        this.ex[ne] = x0;
        this.eslope[ne] = (x1 - x0) / (y1 - y0);
        this.ey0[ne] = y0;
        this.ey1[ne] = y1;
        this.edir[ne] = dir;
        ne++;
        if (y0 < minY) minY = y0;
        if (y1 > maxY) maxY = y1;
      }
    }
    if (!ne) return;
    const yStart = Math.max(0, Math.floor(minY));
    const yEnd = Math.min(h - 1, Math.ceil(maxY));
    const order = this.order;
    for (let i = 0; i < ne; i++) order[i] = i;
    const ey0 = this.ey0;
    order.subarray(0, ne).sort((a, b) => ey0[a] - ey0[b]);
    if (this.active.length < ne) this.active = new Int32Array(ne);
    if (this.xs.length < ne) {
      this.xs = new Float64Array(ne);
      this.ws = new Int8Array(ne);
    }
    const active = this.active;
    const xs = this.xs;
    const ws = this.ws;
    const cov = this.cov;
    let nActive = 0;
    let ptr = 0;
    for (let py = yStart; py <= yEnd; py++) {
      let rowMin = w;
      let rowMax = -1;
      for (let sub = 0; sub < SUBS; sub++) {
        const ys = py + (sub + 0.5) / SUBS;
        while (ptr < ne && ey0[order[ptr]] <= ys) active[nActive++] = order[ptr++];
        let nx = 0;
        let write = 0;
        for (let i = 0; i < nActive; i++) {
          const e = active[i];
          if (this.ey1[e] <= ys) continue;
          active[write++] = e;
          if (this.ey0[e] <= ys) {
            xs[nx] = this.ex[e] + (ys - this.ey0[e]) * this.eslope[e];
            ws[nx] = this.edir[e];
            nx++;
          }
        }
        nActive = write;
        if (nx < 2) continue;
        for (let i = 1; i < nx; i++) {
          const x = xs[i];
          const wd = ws[i];
          let k = i - 1;
          while (k >= 0 && xs[k] > x) {
            xs[k + 1] = xs[k];
            ws[k + 1] = ws[k];
            k--;
          }
          xs[k + 1] = x;
          ws[k + 1] = wd;
        }
        let winding = 0;
        for (let i = 0; i < nx - 1; i++) {
          winding += ws[i];
          const inside = rule === 2 ? (i & 1) === 0 : winding !== 0;
          if (!inside) continue;
          let xa = xs[i];
          let xb = xs[i + 1];
          if (xb <= 0 || xa >= w) continue;
          if (xa < 0) xa = 0;
          if (xb > w) xb = w;
          if (xb <= xa) continue;
          const ia = Math.floor(xa);
          const ib = Math.min(Math.floor(xb), w - 1);
          if (ia === ib) {
            cov[ia] += (xb - xa) * SUB_COVER;
          } else {
            cov[ia] += (ia + 1 - xa) * SUB_COVER;
            for (let x = ia + 1; x < ib; x++) cov[x] += SUB_COVER;
            cov[ib] += (xb - ib) * SUB_COVER;
          }
          if (ia < rowMin) rowMin = ia;
          if (ib > rowMax) rowMax = ib;
        }
      }
      if (rowMax >= rowMin) {
        if (covOut) this.coverageRow(py, rowMin, rowMax, covOut);
        else if (blendFn || blend3) this.blendRowMixed(py, rowMin, rowMax, paint, clip, blendFn, blend3);
        else this.blendRow(py, rowMin, rowMax, paint, clip);
      }
    }
  }
  gradT(paint, x, py) {
    let t;
    if (paint.grad === "focal") {
      const dx = x + 0.5 - paint.fx;
      const dy = py + 0.5 - paint.fy;
      const fcx = paint.fx - paint.cx;
      const fcy = paint.fy - paint.cy;
      const dd = dx * dx + dy * dy;
      if (!dd) return 0;
      const dfc = dx * fcx + dy * fcy;
      const disc = dfc * dfc - dd * (fcx * fcx + fcy * fcy - paint.r * paint.r);
      const denom = -dfc + Math.sqrt(Math.max(0, disc));
      t = denom > 0 ? dd / denom : 1;
    } else if (paint.grad === "radial") {
      const dx = x + 0.5 - paint.gx;
      const dy = py + 0.5 - paint.gy;
      t = Math.sqrt(dx * dx + dy * dy) * paint.invR;
    } else {
      t = (x + 0.5 - paint.gx) * paint.gdx + (py + 0.5 - paint.gy) * paint.gdy;
    }
    if (t < 0) return 0;
    if (t > 1) return 1;
    return t;
  }
  blendRow(py, x0, x1, paint, clip) {
    const { buf, cov, w } = this;
    const rowOff = py * w * 4;
    const clipOff = py * w;
    if (!paint.grad) {
      const pa = paint.a;
      const pr = paint.r;
      const pg = paint.g;
      const pb = paint.b;
      if (!clip) {
        for (let x = x0; x <= x1; x++) {
          let c = cov[x];
          if (c > 0) {
            cov[x] = 0;
            if (c > 1) c = 1;
            const a = c * pa;
            const ia = 1 - a;
            const idx = rowOff + x * 4;
            buf[idx] = buf[idx] * ia + pr * a;
            buf[idx + 1] = buf[idx + 1] * ia + pg * a;
            buf[idx + 2] = buf[idx + 2] * ia + pb * a;
            buf[idx + 3] = buf[idx + 3] * ia + 255 * a;
          }
        }
        return;
      }
      for (let x = x0; x <= x1; x++) {
        let c = cov[x];
        if (c > 0) {
          cov[x] = 0;
          if (c > 1) c = 1;
          c *= clip[clipOff + x];
          if (c <= 0) continue;
          const a = c * pa;
          const ia = 1 - a;
          const idx = rowOff + x * 4;
          buf[idx] = buf[idx] * ia + pr * a;
          buf[idx + 1] = buf[idx + 1] * ia + pg * a;
          buf[idx + 2] = buf[idx + 2] * ia + pb * a;
          buf[idx + 3] = buf[idx + 3] * ia + 255 * a;
        }
      }
      return;
    }
    const lut = paint.lut;
    for (let x = x0; x <= x1; x++) {
      let c = cov[x];
      if (c <= 0) continue;
      cov[x] = 0;
      if (c > 1) c = 1;
      if (clip) {
        c *= clip[clipOff + x];
        if (c <= 0) continue;
      }
      const t = this.gradT(paint, x, py);
      const li = t * (LUT_SIZE - 1) << 2;
      const a = lut[li + 3] / 255 * c;
      const ia = 1 - a;
      const idx = rowOff + x * 4;
      buf[idx] = buf[idx] * ia + lut[li] * c;
      buf[idx + 1] = buf[idx + 1] * ia + lut[li + 1] * c;
      buf[idx + 2] = buf[idx + 2] * ia + lut[li + 2] * c;
      buf[idx + 3] = buf[idx + 3] * ia + 255 * a;
    }
  }
  blendRowMixed(py, x0, x1, paint, clip, blendFn, blend3) {
    const { buf, cov, w } = this;
    const rowOff = py * w * 4;
    const clipOff = py * w;
    const lut = paint.grad ? paint.lut : null;
    for (let x = x0; x <= x1; x++) {
      let c = cov[x];
      if (c <= 0) continue;
      cov[x] = 0;
      if (c > 1) c = 1;
      if (clip) c *= clip[clipOff + x];
      if (c <= 0) continue;
      let sr;
      let sg;
      let sb;
      let as;
      if (lut) {
        const t = this.gradT(paint, x, py);
        const li = t * (LUT_SIZE - 1) << 2;
        const la = lut[li + 3] / 255;
        as = la * c;
        sr = la > 0 ? lut[li] / 255 / la : 0;
        sg = la > 0 ? lut[li + 1] / 255 / la : 0;
        sb = la > 0 ? lut[li + 2] / 255 / la : 0;
      } else {
        as = paint.a * c;
        sr = paint.r / 255;
        sg = paint.g / 255;
        sb = paint.b / 255;
      }
      if (as <= 0) continue;
      const idx = rowOff + x * 4;
      const ab = buf[idx + 3] / 255;
      const br = ab > 0 ? buf[idx] / 255 / ab : 0;
      const bg = ab > 0 ? buf[idx + 1] / 255 / ab : 0;
      const bb = ab > 0 ? buf[idx + 2] / 255 / ab : 0;
      let mr;
      let mg;
      let mb;
      if (blend3) {
        [mr, mg, mb] = blend3(br, bg, bb, sr, sg, sb);
      } else {
        mr = blendFn(br, sr);
        mg = blendFn(bg, sg);
        mb = blendFn(bb, sb);
      }
      const rr = as * (1 - ab) * sr + as * ab * mr + (1 - as) * ab * br;
      const rg = as * (1 - ab) * sg + as * ab * mg + (1 - as) * ab * bg;
      const rb = as * (1 - ab) * sb + as * ab * mb + (1 - as) * ab * bb;
      const ra = as + ab * (1 - as);
      buf[idx] = rr * 255;
      buf[idx + 1] = rg * 255;
      buf[idx + 2] = rb * 255;
      buf[idx + 3] = ra * 255;
    }
  }
  drawImage(img, m, alpha, clip, blend = 0) {
    const { buf, w, h } = this;
    const det = m[0] * m[3] - m[1] * m[2];
    if (!det) return;
    const id = 1 / det;
    const i0 = m[3] * id;
    const i1 = -m[1] * id;
    const i2 = -m[2] * id;
    const i3 = m[0] * id;
    const i4 = (m[2] * m[5] - m[3] * m[4]) * id;
    const i5 = (m[1] * m[4] - m[0] * m[5]) * id;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    for (const [cx, cy] of [[0, 0], [img.width, 0], [0, img.height], [img.width, img.height]]) {
      const dx = m[0] * cx + m[2] * cy + m[4];
      const dy = m[1] * cx + m[3] * cy + m[5];
      if (dx < minX) minX = dx;
      if (dx > maxX) maxX = dx;
      if (dy < minY) minY = dy;
      if (dy > maxY) maxY = dy;
    }
    const x0 = Math.max(0, Math.floor(minX));
    const x1 = Math.min(w - 1, Math.ceil(maxX));
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(h - 1, Math.ceil(maxY));
    const data = img.data;
    const iw = img.width;
    const ih = img.height;
    const blendFn = blend ? BLENDS[blend] : void 0;
    const blend3 = blend ? BLENDS3[blend] : void 0;
    for (let py = y0; py <= y1; py++) {
      const clipOff = py * w;
      for (let px = x0; px <= x1; px++) {
        const cx = px + 0.5;
        const cy = py + 0.5;
        const u = i0 * cx + i2 * cy + i4 - 0.5;
        const v = i1 * cx + i3 * cy + i5 - 0.5;
        if (u < -1 || v < -1 || u > iw || v > ih) continue;
        const uf = Math.floor(u);
        const vf = Math.floor(v);
        const fu = u - uf;
        const fv = v - vf;
        let r = 0, g = 0, b = 0, a = 0;
        for (let dy = 0; dy <= 1; dy++) {
          const sy = vf + dy;
          if (sy < 0 || sy >= ih) continue;
          const wy = dy ? fv : 1 - fv;
          for (let dx = 0; dx <= 1; dx++) {
            const sx = uf + dx;
            if (sx < 0 || sx >= iw) continue;
            const wt = wy * (dx ? fu : 1 - fu);
            if (!wt) continue;
            const si = (sy * iw + sx) * 4;
            const sa2 = data[si + 3] / 255 * wt;
            r += data[si] * sa2;
            g += data[si + 1] * sa2;
            b += data[si + 2] * sa2;
            a += sa2;
          }
        }
        let sa = a * alpha;
        if (clip) sa *= clip[clipOff + px];
        if (sa <= 0) continue;
        if (sa > 1) sa = 1;
        const scale = a > 0 ? sa / a : 0;
        const idx = (py * w + px) * 4;
        if (blendFn || blend3) {
          const ab = buf[idx + 3] / 255;
          const br = ab > 0 ? buf[idx] / 255 / ab : 0;
          const bg = ab > 0 ? buf[idx + 1] / 255 / ab : 0;
          const bb = ab > 0 ? buf[idx + 2] / 255 / ab : 0;
          const sr = a > 0 ? r / a / 255 : 0;
          const sg = a > 0 ? g / a / 255 : 0;
          const sb = a > 0 ? b / a / 255 : 0;
          let mr;
          let mg;
          let mb;
          if (blend3) {
            [mr, mg, mb] = blend3(br, bg, bb, sr, sg, sb);
          } else {
            mr = blendFn(br, sr);
            mg = blendFn(bg, sg);
            mb = blendFn(bb, sb);
          }
          buf[idx] = (sa * (1 - ab) * sr + sa * ab * mr + (1 - sa) * ab * br) * 255;
          buf[idx + 1] = (sa * (1 - ab) * sg + sa * ab * mg + (1 - sa) * ab * bg) * 255;
          buf[idx + 2] = (sa * (1 - ab) * sb + sa * ab * mb + (1 - sa) * ab * bb) * 255;
          buf[idx + 3] = (sa + ab * (1 - sa)) * 255;
        } else {
          const ia = 1 - sa;
          buf[idx] = buf[idx] * ia + r * scale;
          buf[idx + 1] = buf[idx + 1] * ia + g * scale;
          buf[idx + 2] = buf[idx + 2] * ia + b * scale;
          buf[idx + 3] = buf[idx + 3] * ia + 255 * sa;
        }
      }
    }
  }
  unpremultiplied() {
    const { buf, out } = this;
    for (let i = 0; i < buf.length; i += 4) {
      const a = buf[i + 3];
      if (a === 0) {
        out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
      } else if (a === 255) {
        out[i] = buf[i];
        out[i + 1] = buf[i + 1];
        out[i + 2] = buf[i + 2];
        out[i + 3] = 255;
      } else {
        const inv = 255 / a;
        out[i] = buf[i] * inv;
        out[i + 1] = buf[i + 1] * inv;
        out[i + 2] = buf[i + 2] * inv;
        out[i + 3] = a;
      }
    }
    return out;
  }
};

// src/surface/image/raster.ts
var flattenCache = /* @__PURE__ */ new WeakMap();
function rasterize(scene, options = {}) {
  const dpr = Number(options.dpr ?? 1) || 1;
  const width = Math.max(1, Math.round(Number(options.width ?? scene.width ?? 512) * dpr));
  const height = Math.max(1, Math.round(Number(options.height ?? scene.height ?? 512) * dpr));
  const r = getRaster(width, height);
  r.clear();
  const sx = width / (scene.width || width);
  const sy = height / (scene.height || height);
  for (const op of scene.ops) {
    const m = op.matrix;
    const dm = [m[0] * sx, m[1] * sy, m[2] * sx, m[3] * sy, m[4] * sx, m[5] * sy];
    const filters = op.filters?.length ? op.filters : null;
    const blend = op.blend ?? 0;
    if (!filters) {
      drawOp(r, op, options, dm, sx, sy, blend);
      continue;
    }
    r.beginLayer();
    drawOp(r, op, options, dm, sx, sy, 0);
    r.endLayer(filters, Math.sqrt(Math.abs(dm[0] * dm[3] - dm[1] * dm[2])) || 1, dm, blend);
  }
  return { data: r.unpremultiplied(), width, height };
}
function drawOp(r, op, options, dm, sx, sy, blend) {
  let clip = null;
  if (op.clips?.length) {
    clip = clipCoverage(r, op.clips, sx, sy);
    if (!clip) return;
  }
  const scale = avgScale(dm);
  if (op.kind === "image") {
    const img = options.images?.[op.assetId ?? ""] ?? options.images?.[op.src];
    if (!img || op.alpha <= 0) return;
    const mw = op.width && img.width ? op.width / img.width : 1;
    const mh = op.height && img.height ? op.height / img.height : 1;
    const im = [dm[0] * mw, dm[1] * mw, dm[2] * mh, dm[3] * mh, dm[4], dm[5]];
    r.drawImage(img, im, Math.min(1, op.alpha), clip, blend);
    return;
  }
  const rings = [];
  if (op.static) {
    const key = dm.join(",");
    for (const path of op.paths) {
      const ent = flattenCache.get(path);
      if (ent && ent.key === key) {
        for (const rg of ent.rings) rings.push(rg);
      } else {
        const fresh = [];
        flattenPath(path, dm, fresh);
        flattenCache.set(path, { key, rings: fresh });
        for (const rg of fresh) rings.push(rg);
      }
    }
  } else {
    for (const path of op.paths) flattenPath(path, dm, rings);
  }
  if (!rings.length) return;
  for (const fill2 of op.fills) {
    if (fill2.alpha > 0) r.fillRings(rings, fill2.rule ?? 1, devicePaint(fill2, dm), clip, blend);
  }
  for (const stroke of op.strokes) {
    if (stroke.alpha <= 0) continue;
    const w = (stroke.width ?? 1) * scale;
    if (w <= 0) continue;
    let baseRings = rings;
    if (stroke.dash?.length) {
      const dashed = [];
      const pattern = stroke.dash.map((v) => v * scale);
      for (const ring2 of rings) dashRing(ring2, pattern, (stroke.dashOffset ?? 0) * scale, dashed);
      baseRings = dashed;
    }
    const strokeRings = [];
    for (const ring2 of baseRings) strokeRing(ring2, w / 2, stroke.cap ?? 1, strokeRings);
    if (strokeRings.length) r.fillRings(strokeRings, 1, devicePaint(stroke, dm), clip, blend);
  }
}
function clipCoverage(r, clips, sx, sy) {
  const buf = r.acquireClipBuf();
  for (const stage of clips) {
    const soft = stage.shapes.some((s) => s.coverage !== void 0 && s.coverage < 1);
    let tmp = null;
    if (soft) {
      tmp = r.acquireStageBuf();
      let any = false;
      for (const shape of stage.shapes) {
        const m = shape.matrix;
        const dm = [m[0] * sx, m[1] * sy, m[2] * sx, m[3] * sy, m[4] * sx, m[5] * sy];
        avgScale(dm);
        const rings = [];
        for (const p of shape.paths) flattenPath(p, dm, rings);
        if (!rings.length) continue;
        any = true;
        const cover = shape.coverage ?? 1;
        const sb = r.acquireShapeBuf();
        r.coverageRings(rings, sb);
        for (let i = 0; i < tmp.length; i++) {
          const c = sb[i];
          if (c > 0) tmp[i] = tmp[i] * (1 - c) + cover * c;
        }
      }
      if (!any) {
        if (stage.mode === 1) return null;
        continue;
      }
    } else {
      const rings = [];
      for (const shape of stage.shapes) {
        const m = shape.matrix;
        const dm = [m[0] * sx, m[1] * sy, m[2] * sx, m[3] * sy, m[4] * sx, m[5] * sy];
        avgScale(dm);
        for (const p of shape.paths) flattenPath(p, dm, rings);
      }
      if (!rings.length) {
        if (stage.mode === 1) return null;
        continue;
      }
      tmp = r.acquireStageBuf();
      r.coverageRings(rings, tmp);
    }
    const a = stage.alpha ?? 1;
    if (stage.mode === 1) {
      for (let i = 0; i < buf.length; i++) buf[i] *= tmp[i] * a;
    } else if (stage.mode === 2) {
      for (let i = 0; i < buf.length; i++) buf[i] *= 1 - tmp[i] * a;
    } else {
      for (let i = 0; i < buf.length; i++) {
        const c = tmp[i] * a;
        buf[i] = buf[i] * (1 - c) + (1 - buf[i]) * c;
      }
    }
  }
  return buf;
}
function dashRing(ring2, pattern, offset, out) {
  const arr = pattern.length % 2 ? pattern.concat(pattern) : pattern;
  const total = arr.reduce((a, b) => a + b, 0);
  if (total <= 1e-6) {
    out.push(ring2);
    return;
  }
  let idx = 0;
  let on = true;
  let rem = arr[0];
  let off = (offset % total + total) % total;
  while (off > 1e-9) {
    const take = Math.min(off, rem);
    rem -= take;
    off -= take;
    if (rem <= 1e-9) {
      idx = (idx + 1) % arr.length;
      rem = arr[idx];
      on = !on;
    }
  }
  let cur = on ? [ring2[0], ring2[1]] : null;
  for (let i = 0; i + 3 < ring2.length; i += 2) {
    let x0 = ring2[i];
    let y0 = ring2[i + 1];
    const x1 = ring2[i + 2];
    const y1 = ring2[i + 3];
    let seg = Math.hypot(x1 - x0, y1 - y0);
    while (seg > rem + 1e-9) {
      const t = rem / seg;
      const mx = x0 + (x1 - x0) * t;
      const my = y0 + (y1 - y0) * t;
      if (on) {
        cur.push(mx, my);
        if (cur.length >= 4) out.push(cur);
        cur = null;
      } else {
        cur = [mx, my];
      }
      seg -= rem;
      x0 = mx;
      y0 = my;
      idx = (idx + 1) % arr.length;
      rem = arr[idx];
      on = !on;
    }
    rem -= seg;
    if (on && cur) cur.push(x1, y1);
    if (rem <= 1e-9) {
      idx = (idx + 1) % arr.length;
      rem = arr[idx];
      if (on) {
        if (cur && cur.length >= 4) out.push(cur);
        cur = null;
      } else {
        cur = [x1, y1];
      }
      on = !on;
    }
  }
  if (cur && cur.length >= 4) out.push(cur);
}

// src/surface/image/png.ts
async function encodePNG(rgba2, width, height) {
  if (rgba2.length !== width * height * 4) {
    throw new RangeError(`encodePNG: expected ${width * height * 4} bytes, got ${rgba2.length}`);
  }
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgba2.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const idat = typeof CompressionStream === "function" ? await deflate(raw) : storedDeflate(raw);
  const ihdr = new Uint8Array(13);
  const iv = new DataView(ihdr.buffer);
  iv.setUint32(0, width);
  iv.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  return concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))]);
}
async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function storedDeflate(bytes) {
  const MAX = 65535;
  const blocks = Math.max(1, Math.ceil(bytes.length / MAX));
  const out = new Uint8Array(2 + blocks * 5 + bytes.length + 4);
  let o = 0;
  out[o++] = 120;
  out[o++] = 1;
  for (let b = 0; b < blocks; b++) {
    const start = b * MAX;
    const len = Math.min(MAX, bytes.length - start);
    out[o++] = b === blocks - 1 ? 1 : 0;
    out[o++] = len & 255;
    out[o++] = len >>> 8;
    out[o++] = ~len & 255;
    out[o++] = ~len >>> 8 & 255;
    out.set(bytes.subarray(start, start + len), o);
    o += len;
  }
  const adler = adler32(bytes);
  out[o++] = adler >>> 24 & 255;
  out[o++] = adler >>> 16 & 255;
  out[o++] = adler >>> 8 & 255;
  out[o++] = adler & 255;
  return out;
}
function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16 | a) >>> 0;
}
function chunk(type, body) {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}
var crcTable = null;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = 4294967295;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ crc >>> 8;
  return (crc ^ 4294967295) >>> 0;
}
function concat(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// src/surface/image/image.ts
var ImageSurface = class {
  width;
  height;
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }
  render(anim, frame, options = {}) {
    return rasterize(anim.sceneAt(frame), {
      width: options.width ?? this.width,
      height: options.height ?? this.height,
      dpr: options.dpr,
      images: options.images
    });
  }
  async png(anim, frame, options = {}) {
    const img = this.render(anim, frame, options);
    return encodePNG(img.data, img.width, img.height);
  }
  dispose() {
  }
};

export { Animation, CanvasSurface, Emitter, ImageSurface, Playback, SvgSurface, applyColorFilters, encodePNG, load, mount, parse, setExpressionEvaluator };
