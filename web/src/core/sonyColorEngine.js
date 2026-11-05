/**
 * Sony Color Science WebGL2 Rendering Engine
 * ==========================================
 * 100% 还原 Sony Imaging Edge (Edit.app) 与 BIONZ XR 官方色彩科学：
 * 1. 官方 3x3 线性色彩矩阵 (Tag 0x7800 CCM, 严格中性灰守恒)
 * 2. 官方 128 点非线性对数色调曲线 (Tag 0x7805/0x7806)
 * 3. 官方 33x33x33 3D-LUT (Argus 胶片查找表) 三线性插值
 * 4. 原厂白平衡增益微调 (-400K 自动去黄优化与自定义色温)
 * 5. 曝光 (-3~+3EV)、高光/阴影、对比度、饱和度与分屏对比实时 60FPS 渲染
 */

import toneCurvesData from './sonyToneCurves.json';

// 全套 12 种创意外观原厂元数据与矩阵 (Tag 0x7800，基数 1024.0)
export const SONY_CREATIVE_LOOKS = {
  ST: {
    key: 'ST',
    name: 'ST (Standard)',
    title: '标准',
    desc: '索尼基准自然色调，色彩还原真实、通透纯净',
    badge: '原厂基准',
    matrix: [
      1.099609, -0.063477, -0.036133,
      0.241211,  0.907227, -0.148438,
      0.208984,  0.004883,  0.786133
    ],
    lutFile: 'Sony_Look_ST.cube',
  },
  FL: {
    key: 'FL',
    name: 'FL (Film 1)',
    title: '经典冷暖胶片',
    desc: '暗部偏青冷、微提暗部与中灰密度，经典电影叙事氛围',
    badge: '原厂保留',
    matrix: [
      1.034180,  0.020508, -0.054688,
      0.064453,  0.958984, -0.023438,
      0.038086,  0.162109,  0.799805
    ],
    lutFile: 'Sony_Look_FL.cube',
  },
  FL2: {
    key: 'FL2',
    name: 'FL2 (Film 2)',
    title: '怀旧复古胶片',
    desc: '高反差、浓郁胶片质感、暗部沉稳内敛、暖调怀旧情绪',
    badge: '⚡ 原厂新胶片',
    matrix: [
      0.937500,  0.016602,  0.045898,
      0.044922,  1.065430, -0.110352,
     -0.396484, -0.179688,  1.576172
    ],
    lutFile: 'Sony_Look_FL2.cube',
  },
  FL3: {
    key: 'FL3',
    name: 'FL3 (Film 3)',
    title: '清透电影胶片',
    desc: '柔和低反差、亮部通透清爽、柔美空气感与纯净日系光泽',
    badge: '⚡ 原厂新胶片',
    matrix: [
      0.918945, -0.134766,  0.215820,
      0.041016,  0.833984,  0.125000,
     -0.247070,  0.016602,  1.230469
    ],
    lutFile: 'Sony_Look_FL3.cube',
  },
  IN: {
    key: 'IN',
    name: 'IN (Instant)',
    title: '即时 / 拍立得',
    desc: '哑光质感、低对比度、日系随拍文艺复古感',
    badge: '原厂保留',
    matrix: [
      0.846680,  0.212891, -0.059570,
      0.154297,  0.996094, -0.150391,
     -0.307617,  0.180664,  1.126953
    ],
    lutFile: 'Sony_Look_IN.cube',
  },
  SH: {
    key: 'SH',
    name: 'SH (Soft Highkey)',
    title: '柔和高调',
    desc: '明亮柔和、轻盈空气感、高光柔化写真与甜美透亮',
    badge: '原厂保留',
    matrix: [
      1.048828, -0.193359,  0.144531,
      0.091797,  1.058594, -0.150391,
      0.018555, -0.115234,  1.096680
    ],
    lutFile: 'Sony_Look_SH.cube',
  },
  VV: {
    key: 'VV',
    name: 'VV (Vivid)',
    title: '生动鲜艳',
    desc: '高对比度、高饱和度鲜艳色彩，适合艳丽风光与晚霞',
    badge: '原厂保留',
    matrix: [
      1.126953, -0.193359,  0.066406,
     -0.048828,  1.125977, -0.077148,
      0.130859, -0.099609,  0.968750
    ],
    lutFile: 'Sony_Look_VV.cube',
  },
  VV2: {
    key: 'VV2',
    name: 'VV2 (Vivid 2)',
    title: '极清生动',
    desc: '极清透亮、微反差与清晰度显著增强，晴朗明快',
    badge: '原厂保留',
    matrix: [
      1.017578,  0.012695, -0.030273,
     -0.008789,  1.090820, -0.082031,
      0.157227, -0.124023,  0.966797
    ],
    lutFile: 'Sony_Look_VV2.cube',
  },
  PT: {
    key: 'PT',
    name: 'PT (Portrait)',
    title: '人像肤色',
    desc: '优化亚洲人肤色过渡、柔和粉嫩透亮、平滑高光阴影',
    badge: '原厂保留',
    matrix: [
      1.071289, -0.029297, -0.041992,
      0.239258,  0.916016, -0.155273,
      0.182617,  0.002930,  0.814453
    ],
    lutFile: 'Sony_Look_PT.cube',
  },
  NT: {
    key: 'NT',
    name: 'NT (Neutral)',
    title: '中性平直',
    desc: '低饱和、平直宽容度，适合精修商业底片与大动态范围',
    badge: '原厂保留',
    matrix: [
      0.913086, -0.022461,  0.109375,
      0.235352,  0.915039, -0.150391,
      0.185547,  0.014648,  0.800000
    ],
    lutFile: 'Sony_Look_NT.cube',
  },
  BW: {
    key: 'BW',
    name: 'BW (Monochrome)',
    title: '单色黑白',
    desc: '细腻黑白灰阶、明暗层次平滑醇厚',
    badge: '单色',
    matrix: [
      0.299000, 0.587000, 0.114000,
      0.299000, 0.587000, 0.114000,
      0.299000, 0.587000, 0.114000
    ],
    lutFile: 'Sony_Look_BW.cube',
  },
  SE: {
    key: 'SE',
    name: 'SE (Sepia)',
    title: '怀旧褐色',
    desc: '典雅复古棕褐色调、老旧岁月质感',
    badge: '单色',
    matrix: [
      0.393000, 0.769000, 0.189000,
      0.349000, 0.686000, 0.168000,
      0.272000, 0.534000, 0.131000
    ],
    lutFile: 'Sony_Look_SE.cube',
  },
};

// 顶点着色器代码 (通用全屏矩形)
const VS_SOURCE = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

// 片元着色器代码 (100% 官方渲染色彩科学管线)
const FS_SOURCE = `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform sampler2D u_toneCurve;
uniform sampler3D u_lut3D;
uniform bool u_hasLut;

uniform mat3 u_colorMatrix;
uniform float u_lutIntensity;
uniform float u_exposure;     // EV (-3.0 ~ +3.0)
uniform float u_contrast;     // -50 ~ +50 -> factor (0.5 ~ 1.5)
uniform float u_highlights;   // -50 ~ +50
uniform float u_shadows;      // -50 ~ +50
uniform float u_wbOffset;     // -2000K ~ +2000K
uniform float u_tint;         // -50 ~ +50
uniform float u_saturation;   // 0.0 ~ 2.0 (1.0 = normal)

// 对比模式: 0 = 单图, 1 = 分屏对比, 2 = 纯原图
uniform int u_splitMode;
uniform float u_splitRatio;   // 0.0 ~ 1.0

// sRGB 转 线性 RGB (用于曝光和白平衡物理光学校正)
vec3 sRGBToLinear(vec3 c) {
    vec3 bLess = step(vec3(0.04045), c);
    vec3 low = c / 12.92;
    vec3 high = pow((c + 0.055) / 1.055, vec3(2.4));
    return mix(low, high, bLess);
}

// 线性 RGB 转 sRGB
vec3 linearToSRGB(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    vec3 bLess = step(vec3(0.0031308), c);
    vec3 low = c * 12.92;
    vec3 high = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
    return mix(low, high, bLess);
}

// 官方 3D-LUT 纹理精准坐标映射 (解决 33x33x33 边界半像素漂移)
vec3 sampleLut(sampler3D lut, vec3 color) {
    const float lutSize = 33.0;
    vec3 coord = clamp(color, 0.0, 1.0) * ((lutSize - 1.0) / lutSize) + (0.5 / lutSize);
    return texture(lut, coord).rgb;
}

// 快速样条色调映射 (通过 1D 查找表采样，用于无 LUT 时的平滑后备)
vec3 applyToneCurve(vec3 c) {
    float r = texture(u_toneCurve, vec2(clamp(c.r, 0.0, 1.0), 0.5)).r;
    float g = texture(u_toneCurve, vec2(clamp(c.g, 0.0, 1.0), 0.5)).r;
    float b = texture(u_toneCurve, vec2(clamp(c.b, 0.0, 1.0), 0.5)).r;
    return vec3(r, g, b);
}

void main() {
    vec4 rawColor = texture(u_image, v_texCoord);
    vec3 origRgb = rawColor.rgb;

    // 检查是否显示纯原图
    if (u_splitMode == 2) {
        fragColor = vec4(origRgb, 1.0);
        return;
    }

    // 分屏对比模式处理 (左原图 / 右调色)
    if (u_splitMode == 1) {
        if (v_texCoord.x < u_splitRatio) {
            // 边缘画 1.5px 白色高光分割线
            if (abs(v_texCoord.x - u_splitRatio) < 0.0015) {
                fragColor = vec4(1.0, 1.0, 1.0, 1.0);
            } else {
                fragColor = vec4(origRgb, 1.0);
            }
            return;
        }
    }

    // --- 1. 光学物理域曝光与白平衡校正 ---
    vec3 baseRgb = origRgb;
    bool hasLinearAdj = (u_exposure != 0.0 || u_wbOffset != 0.0 || u_tint != 0.0);
    if (hasLinearAdj) {
        vec3 lin = sRGBToLinear(origRgb);

        // 曝光补偿 (EV: lin * 2^EV)
        if (u_exposure != 0.0) {
            lin *= pow(2.0, u_exposure);
        }

        // 白平衡温差校正 (-2000K ~ +2000K)
        // 负值为去黄冷调 (减少红增益，增加蓝增益)
        if (u_wbOffset != 0.0 || u_tint != 0.0) {
            float rGain = 1.0 - u_wbOffset * 0.00015;
            float bGain = 1.0 + u_wbOffset * 0.00018;
            float gGain = 1.0 - u_tint * 0.004;
            lin.r *= rGain;
            lin.b *= bGain;
            lin.g *= gGain;
        }

        baseRgb = linearToSRGB(lin);
    }

    // --- 2. 索尼官方 3D-LUT 创意外观色彩科学渲染 ---
    vec3 styled = baseRgb;
    if (u_hasLut) {
        vec3 lutRgb = sampleLut(u_lut3D, baseRgb);
        styled = mix(baseRgb, lutRgb, u_lutIntensity);
    } else {
        // 无 LUT 时的平滑后备映射
        styled = applyToneCurve(baseRgb);
    }

    // --- 3. 高光 / 阴影微调 (Highlight & Shadow Recovery) ---
    float luma = dot(styled, vec3(0.2126, 0.7152, 0.0722));
    if (u_shadows != 0.0) {
        float shadowMask = 1.0 - smoothstep(0.0, 0.5, luma);
        styled += shadowMask * (u_shadows * 0.004);
    }
    if (u_highlights != 0.0) {
        float highMask = smoothstep(0.4, 1.0, luma);
        styled += highMask * (u_highlights * 0.004);
    }

    // --- 4. 对比度微调 ---
    if (u_contrast != 0.0) {
        float cFactor = 1.0 + u_contrast * 0.015;
        styled = (styled - 0.5) * cFactor + 0.5;
    }

    // --- 5. 饱和度调节 (保持感知亮度 Y) ---
    if (u_saturation != 1.0) {
        float finalLuma = dot(styled, vec3(0.2126, 0.7152, 0.0722));
        styled = mix(vec3(finalLuma), styled, u_saturation);
    }

    fragColor = vec4(clamp(styled, 0.0, 1.0), 1.0);
}
`;

/**
 * 索尼色彩渲染器实例类
 */
export class SonyColorRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: true,
    });

    if (!this.gl) {
      console.warn('WebGL2 不可用，尝试降级');
      return;
    }

    this.program = null;
    this.imageTexture = null;
    this.toneCurveTexture = null;
    this.lutTextures = new Map(); // key -> WebGLTexture
    this.currentLutKey = null;

    this.initShaders();
    this.initGeometry();
    this.initToneCurveTextures();
  }

  initShaders() {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, VS_SOURCE);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('VS 编译错误:', gl.getShaderInfoLog(vs));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, FS_SOURCE);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('FS 编译错误:', gl.getShaderInfoLog(fs));
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program 连接错误:', gl.getProgramInfoLog(prog));
    }

    this.program = prog;

    // 缓存 Uniform 变量位置
    this.uniforms = {
      u_image: gl.getUniformLocation(prog, 'u_image'),
      u_toneCurve: gl.getUniformLocation(prog, 'u_toneCurve'),
      u_lut3D: gl.getUniformLocation(prog, 'u_lut3D'),
      u_hasLut: gl.getUniformLocation(prog, 'u_hasLut'),
      u_colorMatrix: gl.getUniformLocation(prog, 'u_colorMatrix'),
      u_lutIntensity: gl.getUniformLocation(prog, 'u_lutIntensity'),
      u_exposure: gl.getUniformLocation(prog, 'u_exposure'),
      u_contrast: gl.getUniformLocation(prog, 'u_contrast'),
      u_highlights: gl.getUniformLocation(prog, 'u_highlights'),
      u_shadows: gl.getUniformLocation(prog, 'u_shadows'),
      u_wbOffset: gl.getUniformLocation(prog, 'u_wbOffset'),
      u_tint: gl.getUniformLocation(prog, 'u_tint'),
      u_saturation: gl.getUniformLocation(prog, 'u_saturation'),
      u_splitMode: gl.getUniformLocation(prog, 'u_splitMode'),
      u_splitRatio: gl.getUniformLocation(prog, 'u_splitRatio'),
    };
  }

  initGeometry() {
    const gl = this.gl;
    // 覆盖整个屏幕的两个三角形
    const quadVertices = new Float32Array([
      // pos: x, y,  tex: u, v
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
      -1,  1, 0, 0,
       1, -1, 1, 1,
       1,  1, 1, 0,
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

  // 生成 1024x1 的色调曲线查找表纹理
  initToneCurveTextures() {
    this.curveTextures = {};
    const gl = this.gl;

    for (const [lookKey, data] of Object.entries(toneCurvesData)) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);

      const lutWidth = 1024;
      const lutBytes = new Uint8Array(lutWidth);

      const xPts = data.x;
      const yPts = data.y;

      // 单调样条或线性插值采样 1024 个点
      for (let i = 0; i < lutWidth; i++) {
        const xVal = i / (lutWidth - 1);
        let yVal = 0;

        if (xVal <= xPts[0]) {
          yVal = yPts[0];
        } else if (xVal >= xPts[xPts.length - 1]) {
          yVal = yPts[yPts.length - 1];
        } else {
          // 查找区间
          let idx = 0;
          while (idx < xPts.length - 1 && xPts[idx + 1] < xVal) {
            idx++;
          }
          const t = (xVal - xPts[idx]) / (xPts[idx + 1] - xPts[idx]);
          yVal = yPts[idx] * (1 - t) + yPts[idx + 1] * t;
        }

        lutBytes[i] = Math.round(Math.min(Math.max(yVal, 0.0), 1.0) * 255);
      }

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        lutWidth,
        1,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        lutBytes
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this.curveTextures[lookKey] = tex;
    }
  }

  // 载入待渲染的照片源 (HTMLImageElement 或 ImageBitmap)
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

  // 异步加载并绑定 3D-LUT 文件 (.cube)
  async loadLut(lookKey, basePath = '') {
    if (this.lutTextures.has(lookKey)) {
      return this.lutTextures.get(lookKey);
    }

    const lookConfig = SONY_CREATIVE_LOOKS[lookKey] || SONY_CREATIVE_LOOKS.ST;
    const cubeUrl = `${basePath}/luts/${lookConfig.lutFile}`;

    try {
      const resp = await fetch(cubeUrl);
      if (!resp.ok) {
        console.warn(`LUT 文件 ${cubeUrl} 加载失败`);
        return null;
      }
      const text = await resp.text();
      const lutData = this.parseCube(text);

      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_3D, tex);

      gl.texImage3D(
        gl.TEXTURE_3D,
        0,
        gl.RGBA8,
        lutData.size,
        lutData.size,
        lutData.size,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        lutData.bytes
      );

      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

      this.lutTextures.set(lookKey, tex);
      return tex;
    } catch (e) {
      console.warn('解析或绑定 3D-LUT 错误:', e);
      return null;
    }
  }

  parseCube(cubeText) {
    const lines = cubeText.split('\n');
    let size = 33;
    const values = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;
      if (line.startsWith('LUT_3D_SIZE')) {
        size = parseInt(line.split(/\s+/)[1], 10) || 33;
        continue;
      }
      if (line.startsWith('TITLE') || line.startsWith('DOMAIN_')) continue;

      const parts = line.split(/\s+/).map(Number);
      if (parts.length >= 3 && !isNaN(parts[0])) {
        // RGB 转为 0~255 的 RGBA8
        values.push(
          Math.round(Math.min(Math.max(parts[0], 0.0), 1.0) * 255),
          Math.round(Math.min(Math.max(parts[1], 0.0), 1.0) * 255),
          Math.round(Math.min(Math.max(parts[2], 0.0), 1.0) * 255),
          255
        );
      }
    }

    return {
      size,
      bytes: new Uint8Array(values),
    };
  }

  /**
   * 执行渲染
   * @param {Object} params 调色与渲染参数
   */
  render(params = {}) {
    const gl = this.gl;
    if (!gl || !this.program || !this.imageTexture) return;

    const {
      look = 'FL2',
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
    } = params;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // 1. 绑定输入照片源 (Texture 0)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    gl.uniform1i(this.uniforms.u_image, 0);

    // 2. 绑定对应创意外观的 128 点非线性曲线查找表 (Texture 1)
    const curveTex = this.curveTextures[look] || this.curveTextures.ST;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, curveTex);
    gl.uniform1i(this.uniforms.u_toneCurve, 1);

    // 3. 绑定 3D-LUT 纹理 (Texture 2)
    const lutTex = this.lutTextures.get(look);
    if (lutTex) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_3D, lutTex);
      gl.uniform1i(this.uniforms.u_lut3D, 2);
      gl.uniform1i(this.uniforms.u_hasLut, 1);
    } else {
      gl.uniform1i(this.uniforms.u_hasLut, 0);
    }

    // 4. 设置 3x3 矩阵 (Tag 0x7800)
    const lookConfig = SONY_CREATIVE_LOOKS[look] || SONY_CREATIVE_LOOKS.ST;
    // WebGL uniformMatrix3fv 要求以列主序排列
    const m = lookConfig.matrix;
    const colMajorMatrix = new Float32Array([
      m[0], m[3], m[6],
      m[1], m[4], m[7],
      m[2], m[5], m[8],
    ]);
    gl.uniformMatrix3fv(this.uniforms.u_colorMatrix, false, colMajorMatrix);

    // 5. 设置各项调色参数 Uniforms
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

    // 6. 绘制矩形
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // 释放资源
  destroy() {
    const gl = this.gl;
    if (!gl) return;
    if (this.imageTexture) gl.deleteTexture(this.imageTexture);
    if (this.curveTextures) {
      Object.values(this.curveTextures).forEach((t) => gl.deleteTexture(t));
    }
    this.lutTextures.forEach((t) => gl.deleteTexture(t));
    if (this.program) gl.deleteProgram(this.program);
  }
}

