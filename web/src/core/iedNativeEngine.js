/**
 * IED 原生复刻渲染引擎（验证版）
 * ==========================================
 * 基于对 Imaging Edge Desktop 4.1.0 (Edit.app, arm64) 的逐函数逆向，
 * 在运行时直接从原厂 *_profile.bin 解析参数并生成变换，不使用 .cube：
 *
 *   已确认并逐行转写的部分：
 *   1. 3110 字节 profile 的 IFD 参数包解析（114 标签）
 *   2. 线性 CCM（Tag 0x7800，行和 = 1024）
 *   3. Argus 色度变换：系数合成 (FUN_1000bf8e8) + 象限扭曲 (FUN_1000bfe60)
 *      + 径向色域修正 (FUN_1000c0048)，生成 129x129 2D 色度 LUT
 *      (恒等格点 (k-64)*512 来自 FUN_1000c9c94)
 *   4. 色调曲线数据（Tag 0x7805/0x7806，128 点实测）
 *   5. 色相整形表 0x780f 解码（FUN_1000d4ec4 公式，数据层已解开）
 *
 *   尚未纳入（接线未确认，不做近似填充）：
 *   - Argus 系数合成的模式字：本批 profile 下只剩三个候选
 *     (基表 0x7842 / 基表+0x7844 / 基表+0x7845)，界面可切换对照
 *   - 色相整形 (0x780f) 的逐像素消费端、33^3 主 LUT 的合成接线
 *   - 色调曲线的对数域样条求值（此处暂用线性插值采样，与 .cube 模式一致）
 *
 * 色度域约定（与逆向常数自洽）：YCbCr 取 BT.601，
 * Cb=(B-Y)/1.771978，Cr=(R-Y)/1.401988；格点域 = 色度 * 65536（±32768）。
 */

// ---------------------------------------------------------------------------
// 1. Profile 解析（移植 parse_profile.py）
// ---------------------------------------------------------------------------

const TSIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

export function parseProfileBin(buffer) {
  const dv = new DataView(buffer);
  const u8 = new Uint8Array(buffer);
  const n = dv.getUint16(0, true);
  const ents = [];
  let minPtr = Infinity;
  for (let i = 0; i < n; i++) {
    const off = 2 + i * 12;
    const tag = dv.getUint16(off, true);
    const typ = dv.getUint16(off + 2, true);
    const cnt = dv.getUint32(off + 4, true);
    const ptr = dv.getUint32(off + 8, true);
    const total = (TSIZE[typ] || 1) * cnt;
    ents.push({ tag, typ, cnt, ptr, total, entryOff: off });
    if (total > 4 && ptr < minPtr) minPtr = ptr;
  }
  const base = minPtr - (2 + 12 * n);
  const tags = new Map();
  for (const e of ents) {
    let bytes;
    if (e.total <= 4) {
      bytes = u8.slice(e.entryOff + 8, e.entryOff + 8 + e.total);
    } else {
      const start = e.ptr - base;
      bytes = u8.slice(start, start + e.total);
    }
    tags.set(e.tag, { type: e.typ, count: e.cnt, bytes });
  }
  const getShorts = (tag) => {
    const e = tags.get(tag);
    if (!e) return null;
    const bdv = new DataView(e.bytes.buffer, e.bytes.byteOffset, e.bytes.byteLength);
    const out = [];
    for (let i = 0; i < e.count; i++) out.push(bdv.getInt16(i * 2, true));
    return out;
  };
  const getUints = (tag) => {
    const e = tags.get(tag);
    if (!e) return null;
    const bdv = new DataView(e.bytes.buffer, e.bytes.byteOffset, e.bytes.byteLength);
    const out = [];
    for (let i = 0; i < e.count; i++) out.push(bdv.getUint32(i * 4, true));
    return out;
  };
  const nameEntry = tags.get(0x7770);
  const name = nameEntry
    ? new TextDecoder('ascii').decode(nameEntry.bytes).replace(/\0.*$/s, '')
    : '';
  return { name, tags, getShorts, getUints };
}

// ---------------------------------------------------------------------------
// 2. 0x780f 色相整形表解码（转写 FUN_1000d4ec4 的打包定点解码）
// ---------------------------------------------------------------------------

function decodePacked14(hi, lo) {
  // 每个 16 位半词: bit15 符号, 其余为 (v>>2)&0x3fff 的 14 位一补数式幅值
  const half = (h) => {
    const sign = (h & 0x8000) !== 0;
    let m = (h >> 2) & 0x3fff;
    if (sign) m = ((h >> 2) & 0x3ffe) ^ 0x3fff;
    const v = m / 1024.0;
    return sign ? -v : v;
  };
  return [half(hi), half(lo)];
}

export function decode780f(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const words = [];
  for (let i = 0; i < 69; i++) words.push(dv.getUint32(i * 4, true));
  const planes = [];
  for (let g = 0; g < 6; g++) {
    const vals = [];
    for (let j = 0; j < 8; j++) {
      const w = words[6 + g * 8 + j];
      const [a, b] = decodePacked14((w >>> 16) & 0xffff, w & 0xffff);
      vals.push(a, b);
    }
    planes.push(vals);
  }
  const tail12 = [];
  for (let j = 0; j < 8; j++) {
    const w = words[54 + j];
    tail12.push((w >>> 18) & 0xfff, (w >>> 2) & 0xfff);
  }
  return { planes, tail12 };
}

// ---------------------------------------------------------------------------
// 3. Argus 色度变换（转写 FUN_1000bf8e8 / FUN_1000bfe60 / FUN_1000c0048）
// ---------------------------------------------------------------------------

const S1024 = 0.0009765625;
const i16 = (v) => {
  v &= 0xffff;
  return v >= 0x8000 ? v - 0x10000 : v;
};

export const COEF_MODE_OPTIONS = [
  { key: 'base', label: '基表 0x7842（模式 1/11/12/13）' },
  { key: 'add44', label: '基表 + 0x7844（switch 默认支）' },
  { key: 'add45', label: '基表 + 0x7845（模式 7–10）' },
];

const Z8 = [0, 0, 0, 0, 0, 0, 0, 0];

export function argusTables(profile) {
  const g = (tag) => profile.getShorts(tag) || Z8;
  return {
    t7841: g(0x7841), t7842: g(0x7842), t7843: g(0x7843), t7844: g(0x7844),
    t7845: g(0x7845), t7846: g(0x7846), t7847: g(0x7847), t7848: g(0x7848),
    radial: {
      gate: 0, boundary: [0, 0],
      s68: (profile.getShorts(0x7849) || [0])[0],
      s6a: (profile.getShorts(0x784a) || [0])[0],
      s6c: (profile.getShorts(0x784b) || [0])[0],
      t70: profile.getShorts(0x784c) || [0, 0, 0, 0],
      t78: profile.getShorts(0x784d) || [0, 0, 0, 0],
      t80: profile.getShorts(0x784e) || Z8,
    },
  };
}

export function synthesizeCoef(t, coefMode) {
  // 槽位映射 (FUN_1000bf7cc): +0x20=0x7842 基表, +0x28=0x7843,
  // +0x30=0x7844, +0x38=0x7845, +0x40=0x7846
  if (coefMode === 'add44') return t.t7842.map((v, k) => i16(v + t.t7844[k]));
  if (coefMode === 'add45') return t.t7842.map((v, k) => i16(v + t.t7845[k]));
  return [...t.t7842]; // 权重表 0x7847/0x7848 缺失为零, 加权模式退化为基表
}

export function argusPoint(p2, p3, coef) {
  const x = p2 * 0.0235833125 + p3 * 0.00303415625;
  const y = p2 * 0.0079583125 + p3 * 0.01865915625;
  const c1 = y >= 0 ? coef[0] : coef[2];
  const c2 = x >= 0 ? coef[1] : coef[3];
  const xp = x + c1 * y * S1024;
  const yp = y + c2 * x * S1024;
  const c3 = xp >= 0 ? coef[5] : coef[7];
  const c4 = yp >= 0 ? coef[4] : coef[6];
  const u = Math.min(127.0, Math.max(-128.0, xp * c3 * S1024));
  const v = Math.min(127.0, Math.max(-128.0, yp * c4 * S1024));
  const o1 = Math.min(32767.0, Math.max(-32768.0, (v * 3.7e-05 + u * 1.401988) * 64.0));
  const o2 = Math.min(32767.0, Math.max(-32768.0, (v * 1.771978 + u * 0.000135) * 64.0));
  return [Math.trunc(o1), Math.trunc(o2)];
}

export function radialPoint(p2, p3, rp) {
  if (rp.gate !== 0) return [p2, p3];
  const a = p2 * -8.4375e-07 + p3 * 0.008817828125;
  const b = p3 * -2.34375e-07 + p2 * 0.011144890625;
  const bx = rp.boundary[0] * 0.015625;
  const by = rp.boundary[1] * 0.015625;
  const sector = (a < bx ? 1 : 0) | (b < by ? 2 : 0);
  const ax = rp.t80[sector * 2] * 0.015625;
  const ay = rp.t80[sector * 2 + 1] * 0.015625;
  const da = a - ax;
  const db = b - ay;
  const r = rp.t78[sector] * S1024 * Math.sqrt(da * da + db * db);
  const s68 = rp.s68 * S1024;
  const s6a = rp.s6a * S1024;
  const s6c = rp.s6c * S1024;
  let gain = 0.0;
  if (r < 64.0) gain = rp.s68 * 3.0517578125e-05 * (64.0 - r);
  if (r < 32.0) gain = s68 + (32.0 - r) * (s6a - s68) * 0.0625;
  if (r < 16.0) gain = s6a + (16.0 - r) * (s6c - s6a) * 0.0625;
  const blend = Math.min(1.0, Math.max(0.0, rp.t70[sector] * S1024 * gain));
  const oa = ax + da * (1.0 - blend);
  const ob = ay + db * (1.0 - blend);
  const o1 = Math.min(32767.0, Math.max(-32768.0, (ob * 1.401988 + oa * 3.7e-05) * 64.0));
  const o2 = Math.min(32767.0, Math.max(-32768.0, (ob * 0.000135 + oa * 1.771978) * 64.0));
  return [Math.trunc(o1), Math.trunc(o2)];
}

export function buildArgusLut(profile, coefMode) {
  const t = argusTables(profile);
  const coef = synthesizeCoef(t, coefMode);
  const data = new Float32Array(129 * 129 * 2);
  let k = 0;
  for (let i = 0; i < 129; i++) {
    const p2 = (i - 64) * 512 - (i === 128 ? 1 : 0);
    for (let j = 0; j < 129; j++) {
      const p3 = (j - 64) * 512 - (j === 128 ? 1 : 0);
      const q = argusPoint(p2, p3, coef);
      const r = radialPoint(q[0], q[1], t.radial);
      data[k++] = r[0];
      data[k++] = r[1];
    }
  }
  return { data, coef };
}

// ---------------------------------------------------------------------------
// 4. WebGL2 渲染器（接口与 SonyColorRenderer 对齐，可在同一画布上替换）
// ---------------------------------------------------------------------------

export const LOOK_PROFILE_FILES = {
  ST: 'standard', FL: 'fl', FL2: 'fl2', FL3: 'fl3', IN: 'in', NT: 'neutral',
  PT: 'portrait', SE: 'sepia', SH: 'sh', VV: 'vivid', VV2: 'vv2', BW: 'bw',
};

const VS_SOURCE = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

const FS_SOURCE = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform sampler2D u_argus;     // RG32F: 129x129 Argus 2D 色度 LUT (int16 域)
uniform sampler2D u_toneCurve; // R8: 1024x1
uniform mat3 u_ccm;
uniform bool u_hasArgus;
uniform bool u_applyCurve;
uniform float u_lutIntensity;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_wbOffset;
uniform float u_tint;
uniform float u_saturation;
uniform int u_splitMode;
uniform float u_splitRatio;

vec3 sRGBToLinear(vec3 c) {
    vec3 bLess = step(vec3(0.04045), c);
    vec3 low = c / 12.92;
    vec3 high = pow((c + 0.055) / 1.055, vec3(2.4));
    return mix(low, high, bLess);
}

vec3 linearToSRGB(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    vec3 bLess = step(vec3(0.0031308), c);
    vec3 low = c * 12.92;
    vec3 high = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
    return mix(low, high, bLess);
}

// Argus LUT 手动双线性 (格点: p = (k-64)*512, k=0..128)
// 纹理 x 轴 = p3 索引, y 轴 = p2 索引 (与 buildArgusLut 的行列布局一致)
vec2 sampleArgus(vec2 p) {
    vec2 g = clamp(p / 512.0 + 64.0, 0.0, 128.0);
    vec2 base = min(floor(g), 127.0);
    vec2 f = g - base;
    ivec2 c00 = ivec2(int(base.y), int(base.x));
    vec2 v00 = texelFetch(u_argus, c00, 0).rg;
    vec2 v10 = texelFetch(u_argus, c00 + ivec2(1, 0), 0).rg;
    vec2 v01 = texelFetch(u_argus, c00 + ivec2(0, 1), 0).rg;
    vec2 v11 = texelFetch(u_argus, c00 + ivec2(1, 1), 0).rg;
    return mix(mix(v00, v10, f.y), mix(v01, v11, f.y), f.x);
}

vec3 applyToneCurve(vec3 c) {
    float r = texture(u_toneCurve, vec2(clamp(c.r, 0.0, 1.0), 0.5)).r;
    float g = texture(u_toneCurve, vec2(clamp(c.g, 0.0, 1.0), 0.5)).r;
    float b = texture(u_toneCurve, vec2(clamp(c.b, 0.0, 1.0), 0.5)).r;
    return vec3(r, g, b);
}

void main() {
    vec4 rawColor = texture(u_image, v_texCoord);
    vec3 origRgb = rawColor.rgb;

    if (u_splitMode == 2) {
        fragColor = vec4(origRgb, 1.0);
        return;
    }
    if (u_splitMode == 1 && v_texCoord.x < u_splitRatio) {
        if (abs(v_texCoord.x - u_splitRatio) < 0.0015) {
            fragColor = vec4(1.0, 1.0, 1.0, 1.0);
        } else {
            fragColor = vec4(origRgb, 1.0);
        }
        return;
    }

    // 曝光 / 白平衡 (与 .cube 模式相同的预处理)
    vec3 baseRgb = origRgb;
    bool hasLinearAdj = (u_exposure != 0.0 || u_wbOffset != 0.0 || u_tint != 0.0);
    if (hasLinearAdj) {
        vec3 lin = sRGBToLinear(origRgb);
        if (u_exposure != 0.0) {
            lin *= pow(2.0, u_exposure);
        }
        if (u_wbOffset != 0.0 || u_tint != 0.0) {
            lin.r *= 1.0 + u_wbOffset * 0.00017;
            lin.b *= 1.0 - u_wbOffset * 0.00018;
            lin.g *= 1.0 - u_tint * 0.004;
        }
        baseRgb = linearToSRGB(lin);
    }

    // IED 原生链: 线性 CCM -> YCbCr -> Argus 2D LUT -> 回 RGB
    vec3 styled = baseRgb;
    if (u_hasArgus) {
        vec3 lin = sRGBToLinear(baseRgb);
        vec3 ccmLin = u_ccm * lin;
        float Y = dot(ccmLin, vec3(0.299, 0.587, 0.114));
        float Cb = (ccmLin.b - Y) / 1.771978;
        float Cr = (ccmLin.r - Y) / 1.401988;
        vec2 p = clamp(vec2(Cb, Cr) * 65536.0, -32767.0, 32767.0);
        vec2 o = sampleArgus(p);
        float Cb2 = o.x / 65536.0;
        float Cr2 = o.y / 65536.0;
        vec3 ycc = vec3(0.0);
        ycc.r = Y + 1.401988 * Cr2;
        ycc.b = Y + 1.771978 * Cb2;
        ycc.g = (Y - 0.299 * ycc.r - 0.114 * ycc.b) / 0.587;
        vec3 nativeRgb = linearToSRGB(ycc);
        if (u_applyCurve) {
            nativeRgb = applyToneCurve(nativeRgb);
        }
        styled = mix(baseRgb, nativeRgb, u_lutIntensity);
    }

    float luma = dot(styled, vec3(0.2126, 0.7152, 0.0722));
    if (u_shadows != 0.0) {
        float shadowMask = 1.0 - smoothstep(0.0, 0.5, luma);
        styled += shadowMask * (u_shadows * 0.004);
    }
    if (u_highlights != 0.0) {
        float highMask = smoothstep(0.4, 1.0, luma);
        styled += highMask * (u_highlights * 0.004);
    }
    if (u_contrast != 0.0) {
        float cFactor = 1.0 + u_contrast * 0.015;
        styled = (styled - 0.5) * cFactor + 0.5;
    }
    if (u_saturation != 1.0) {
        float finalLuma = dot(styled, vec3(0.2126, 0.7152, 0.0722));
        styled = mix(vec3(finalLuma), styled, u_saturation);
    }

    fragColor = vec4(clamp(styled, 0.0, 1.0), 1.0);
}
`;

export class IedNativeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: true,
    });
    if (!this.gl) {
      console.warn('WebGL2 不可用');
      return;
    }
    this.imageTexture = null;
    this.argusTexture = null;
    this.toneCurveTexture = null;
    this.ccm = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    this.currentProfile = null; // { name, lookKey, coefMode, coef }
    this.initShaders();
    this.initGeometry();
  }

  initShaders() {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, VS_SOURCE);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('IED VS 编译错误:', gl.getShaderInfoLog(vs));
    }
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, FS_SOURCE);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('IED FS 编译错误:', gl.getShaderInfoLog(fs));
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('IED Program 连接错误:', gl.getProgramInfoLog(prog));
    }
    this.program = prog;
    this.uniforms = {};
    for (const name of [
      'u_image', 'u_argus', 'u_toneCurve', 'u_ccm', 'u_hasArgus', 'u_applyCurve',
      'u_lutIntensity', 'u_exposure', 'u_contrast', 'u_highlights', 'u_shadows',
      'u_wbOffset', 'u_tint', 'u_saturation', 'u_splitMode', 'u_splitRatio',
    ]) {
      this.uniforms[name] = gl.getUniformLocation(prog, name);
    }
  }

  initGeometry() {
    const gl = this.gl;
    const quadVertices = new Float32Array([
      -1, -1, 0, 1,
      1, -1, 1, 1,
      -1, 1, 0, 0,
      -1, 1, 0, 0,
      1, -1, 1, 1,
      1, 1, 1, 0,
    ]);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    const texLoc = gl.getAttribLocation(this.program, 'a_texCoord');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);
    this.vao = vao;
  }

  setImage(img) {
    const gl = this.gl;
    if (!this.imageTexture) {
      this.imageTexture = gl.createTexture();
    }
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.imageWidth = img.naturalWidth || img.width;
    this.imageHeight = img.naturalHeight || img.height;
    this.canvas.width = this.imageWidth;
    this.canvas.height = this.imageHeight;
    gl.viewport(0, 0, this.imageWidth, this.imageHeight);
  }

  static profileCache = new Map();

  async loadLook(lookKey, basePath = '', coefMode = 'base') {
    const file = LOOK_PROFILE_FILES[lookKey] || 'standard';
    const cacheKey = `${file}:${coefMode}`;
    const gl = this.gl;

    let parsed = IedNativeRenderer.profileCache.get(file);
    if (!parsed) {
      const resp = await fetch(`${basePath}/presets/${file}_profile.bin`);
      if (!resp.ok) throw new Error(`profile 加载失败: ${file}`);
      const buf = await resp.arrayBuffer();
      parsed = parseProfileBin(buf);
      IedNativeRenderer.profileCache.set(file, parsed);
    }

    // CCM (行主序 -> 列主序 uniform)
    const ccmRaw = parsed.getShorts(0x7800);
    if (ccmRaw) {
      const m = ccmRaw.map((v) => v / 1024.0);
      this.ccm = new Float32Array([
        m[0], m[3], m[6],
        m[1], m[4], m[7],
        m[2], m[5], m[8],
      ]);
    }

    // Argus 2D LUT 纹理
    const cacheEntry = IedNativeRenderer.profileCache.get(cacheKey);
    let lutData;
    let coef;
    if (cacheEntry) {
      lutData = cacheEntry.data;
      coef = cacheEntry.coef;
    } else {
      const built = buildArgusLut(parsed, coefMode);
      lutData = built.data;
      coef = built.coef;
      IedNativeRenderer.profileCache.set(cacheKey, built);
    }
    if (!this.argusTexture) this.argusTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.argusTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, 129, 129, 0, gl.RG, gl.FLOAT, lutData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 色调曲线纹理 (0x7805/0x7806 线性插值采样, 与现有引擎一致)
    const curveX = parsed.getUints(0x7805);
    const curveY = parsed.getUints(0x7806);
    if (curveX && curveY) {
      const width = 1024;
      const bytes = new Uint8Array(width);
      const xMax = curveX[curveX.length - 1] || 1;
      const yMax = Math.max(...curveY) || 1;
      const xs = curveX.map((v) => v / xMax);
      const ys = curveY.map((v) => v / yMax);
      for (let i = 0; i < width; i++) {
        const x = i / (width - 1);
        let y;
        if (x <= xs[0]) y = ys[0];
        else if (x >= xs[xs.length - 1]) y = ys[ys.length - 1];
        else {
          let idx = 0;
          while (idx < xs.length - 2 && xs[idx + 1] < x) idx++;
          const t = (x - xs[idx]) / (xs[idx + 1] - xs[idx] || 1);
          y = ys[idx] + (ys[idx + 1] - ys[idx]) * t;
        }
        bytes[i] = Math.round(Math.min(1, Math.max(0, y)) * 255);
      }
      if (!this.toneCurveTexture) this.toneCurveTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.toneCurveTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, 1, 0, gl.RED, gl.UNSIGNED_BYTE, bytes);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    this.currentProfile = { name: parsed.name, lookKey, coefMode, coef };
    return this.currentProfile;
  }

  render(params = {}) {
    const gl = this.gl;
    if (!gl || !this.program || !this.imageTexture) return;
    const {
      lutIntensity = 1.0,
      exposure = 0.0,
      contrast = 0.0,
      highlights = 0.0,
      shadows = 0.0,
      wbOffset = 0.0,
      tint = 0.0,
      saturation = 1.0,
      splitMode = 0,
      splitRatio = 0.5,
      applyCurve = true,
    } = params;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    gl.uniform1i(this.uniforms.u_image, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.argusTexture);
    gl.uniform1i(this.uniforms.u_argus, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.toneCurveTexture);
    gl.uniform1i(this.uniforms.u_toneCurve, 2);

    gl.uniformMatrix3fv(this.uniforms.u_ccm, false, this.ccm);
    gl.uniform1i(this.uniforms.u_hasArgus, this.argusTexture ? 1 : 0);
    gl.uniform1i(this.uniforms.u_applyCurve, applyCurve ? 1 : 0);
    gl.uniform1f(this.uniforms.u_lutIntensity, Math.max(0.0, Math.min(1.0, lutIntensity)));
    gl.uniform1f(this.uniforms.u_exposure, exposure);
    gl.uniform1f(this.uniforms.u_contrast, contrast);
    gl.uniform1f(this.uniforms.u_highlights, highlights);
    gl.uniform1f(this.uniforms.u_shadows, shadows);
    gl.uniform1f(this.uniforms.u_wbOffset, wbOffset);
    gl.uniform1f(this.uniforms.u_tint, tint);
    gl.uniform1f(this.uniforms.u_saturation, saturation);
    gl.uniform1i(this.uniforms.u_splitMode, splitMode);
    gl.uniform1f(this.uniforms.u_splitRatio, splitRatio);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  destroy() {
    const gl = this.gl;
    if (!gl) return;
    for (const t of [this.imageTexture, this.argusTexture, this.toneCurveTexture]) {
      if (t) gl.deleteTexture(t);
    }
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.program) gl.deleteProgram(this.program);
    this.imageTexture = null;
    this.argusTexture = null;
    this.toneCurveTexture = null;
  }
}
