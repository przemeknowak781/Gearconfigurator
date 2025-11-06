import React, { useRef, useEffect } from 'react';

// --- WebGL Helper Functions ---
const createShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }
  console.error(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
};

const createProgram = (gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null => {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }
  console.error(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return null;
};

// --- Matrix Math Library (mat4) ---
type Mat4 = number[];
const mat4 = {
    create: (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    perspective: (out: Mat4, fovy: number, aspect: number, near: number, far: number): Mat4 => {
        const f = 1.0 / Math.tan(fovy / 2);
        out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
        out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
        out[8] = 0; out[9] = 0; out[11] = -1; out[12] = 0; out[13] = 0; out[15] = 0;
        if (far != null && far !== Infinity) {
            const nf = 1 / (near - far);
            out[10] = (far + near) * nf;
            out[14] = 2 * far * near * nf;
        } else {
            out[10] = -1;
            out[14] = -2 * near;
        }
        return out;
    },
    translate: (out: Mat4, a: Mat4, v: number[]): Mat4 => {
        const x = v[0], y = v[1], z = v[2];
        if (a === out) {
            out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
            out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
            out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
            out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
        } else {
            for (let i = 0; i < 12; i++) out[i] = a[i];
            out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
            out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
            out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
            out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
        }
        return out;
    },
    rotate: (out: Mat4, a: Mat4, rad: number, axis: number[]): Mat4 => {
        let x = axis[0], y = axis[1], z = axis[2];
        let len = Math.hypot(x, y, z);
        if (len < 1e-6) {
             if (a !== out) {
              for (let i = 0; i < 16; i++) out[i] = a[i];
            }
            return out;
        };
        len = 1 / len; x *= len; y *= len; z *= len;
        const s = Math.sin(rad), c = Math.cos(rad), t = 1 - c;
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        const b00 = x * x * t + c, b01 = y * x * t + z * s, b02 = z * x * t - y * s;
        const b10 = x * y * t - z * s, b11 = y * y * t + c, b12 = z * y * t + x * s;
        const b20 = x * z * t + y * s, b21 = y * z * t - x * s, b22 = z * z * t + c;
        out[0] = a00 * b00 + a10 * b01 + a20 * b02;
        out[1] = a01 * b00 + a11 * b01 + a21 * b02;
        out[2] = a02 * b00 + a12 * b01 + a22 * b02;
        out[3] = a03 * b00 + a13 * b01 + a23 * b02;
        out[4] = a00 * b10 + a10 * b11 + a20 * b12;
        out[5] = a01 * b10 + a11 * b11 + a21 * b12;
        out[6] = a02 * b10 + a12 * b11 + a22 * b12;
        out[7] = a03 * b10 + a13 * b11 + a23 * b12;
        out[8] = a00 * b20 + a10 * b21 + a20 * b22;
        out[9] = a01 * b20 + a11 * b21 + a21 * b22;
        out[10] = a02 * b20 + a12 * b21 + a22 * b22;
        out[11] = a03 * b20 + a13 * b21 + a23 * b22;
        if (a !== out) {
            out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
        }
        return out;
    },
};

// --- Gear Geometry Generation ---
export const createGearGeometry = (
  innerRadius: number, outerRadius: number, width: number,
  teeth: number, toothDepth: number
) => {
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  
  const toothRadius = outerRadius + toothDepth;
  const angleStep = (2 * Math.PI) / (teeth * 4);

  let vertexIndex = 0;

  for (let i = 0; i < teeth * 4; i++) {
    const angle = i * angleStep;
    const nextAngle = (i + 1) * angleStep;

    const r1 = (i % 4 === 1 || i % 4 === 2) ? toothRadius : outerRadius;
    const r2 = ((i + 1) % 4 === 1 || (i + 1) % 4 === 2) ? toothRadius : outerRadius;

    const r3 = innerRadius;
    const z = width * 0.5;
    
    const c1 = Math.cos(angle), s1 = Math.sin(angle);
    const c2 = Math.cos(nextAngle), s2 = Math.sin(nextAngle);

    // Front face
    const v0f_idx = vertexIndex++; vertices.push(r3 * c1, r3 * s1, z); normals.push(0, 0, 1);
    const v1f_idx = vertexIndex++; vertices.push(r1 * c1, r1 * s1, z); normals.push(0, 0, 1);
    const v2f_idx = vertexIndex++; vertices.push(r2 * c2, r2 * s2, z); normals.push(0, 0, 1);
    const v3f_idx = vertexIndex++; vertices.push(r3 * c2, r3 * s2, z); normals.push(0, 0, 1);
    indices.push(v0f_idx, v1f_idx, v2f_idx, v0f_idx, v2f_idx, v3f_idx);

    // Back face
    const v0b_idx = vertexIndex++; vertices.push(r3 * c1, r3 * s1, -z); normals.push(0, 0, -1);
    const v1b_idx = vertexIndex++; vertices.push(r1 * c1, r1 * s1, -z); normals.push(0, 0, -1);
    const v2b_idx = vertexIndex++; vertices.push(r2 * c2, r2 * s2, -z); normals.push(0, 0, -1);
    const v3b_idx = vertexIndex++; vertices.push(r3 * c2, r3 * s2, -z); normals.push(0, 0, -1);
    indices.push(v0b_idx, v2b_idx, v1b_idx, v0b_idx, v3b_idx, v2b_idx);

    // Outer face
    const n_outer_x = (r1 * s1 + r2 * s2);
    const n_outer_y = -(r1 * c1 + r2 * c2);
    const l_outer = Math.hypot(n_outer_x, n_outer_y) || 1;
    const nx_o = n_outer_x / l_outer, ny_o = n_outer_y / l_outer;
    
    const v4_idx = vertexIndex++; vertices.push(r1 * c1, r1 * s1, z); normals.push(nx_o, ny_o, 0);
    const v5_idx = vertexIndex++; vertices.push(r1 * c1, r1 * s1, -z); normals.push(nx_o, ny_o, 0);
    const v6_idx = vertexIndex++; vertices.push(r2 * c2, r2 * s2, -z); normals.push(nx_o, ny_o, 0);
    const v7_idx = vertexIndex++; vertices.push(r2 * c2, r2 * s2, z); normals.push(nx_o, ny_o, 0);
    indices.push(v4_idx, v5_idx, v6_idx, v4_idx, v6_idx, v7_idx);

    // Inner face
    const n_inner_x = -(r3 * s1 + r3 * s2);
    const n_inner_y = (r3 * c1 + r3 * c2);
    const l_inner = Math.hypot(n_inner_x, n_inner_y) || 1;
    const nx_i = n_inner_x / l_inner, ny_i = n_inner_y / l_inner;

    const v8_idx = vertexIndex++; vertices.push(r3 * c1, r3 * s1, z); normals.push(nx_i, ny_i, 0);
    const v9_idx = vertexIndex++; vertices.push(r3 * c2, r3 * s2, z); normals.push(nx_i, ny_i, 0);
    const v10_idx = vertexIndex++; vertices.push(r3 * c2, r3 * s2, -z); normals.push(nx_i, ny_i, 0);
    const v11_idx = vertexIndex++; vertices.push(r3 * c1, r3 * s1, -z); normals.push(nx_i, ny_i, 0);
    indices.push(v8_idx, v9_idx, v10_idx, v8_idx, v10_idx, v11_idx);
  }

  return { vertices, normals, indices };
};

// --- Shaders ---
const vertexShaderSource = `
  attribute vec4 a_position;
  attribute vec3 a_normal;

  uniform mat4 u_modelViewMatrix;
  uniform mat4 u_projectionMatrix;
  uniform mat4 u_normalMatrix;

  varying highp vec3 v_lighting;

  void main() {
    gl_Position = u_projectionMatrix * u_modelViewMatrix * a_position;

    highp vec3 ambientLight = vec3(0.3, 0.3, 0.35);
    highp vec3 directionalLightColor = vec3(1.0, 1.0, 0.9);
    highp vec3 directionalVector = normalize(vec3(0.5, 1.0, 0.75));

    vec4 transformedNormal = u_normalMatrix * vec4(a_normal, 1.0);
    
    highp float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
    v_lighting = ambientLight + (directionalLightColor * directional);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  varying highp vec3 v_lighting;
  
  void main() {
    vec3 color = vec3(0.5, 0.6, 0.8);
    gl_FragColor = vec4(color * v_lighting, 1.0);
  }
`;

// --- React Component ---
interface GearProps {
  innerRadius: number;
  outerRadius: number;
  width: number;
  teeth: number;
  toothDepth: number;
}

export const Gear: React.FC<GearProps> = ({ innerRadius, outerRadius, width, teeth, toothDepth }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const gl = canvas.getContext('webgl', { antialias: true });
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const normalAttributeLocation = gl.getAttribLocation(program, "a_normal");
    const projectionMatrixUniformLocation = gl.getUniformLocation(program, "u_projectionMatrix");
    const modelViewMatrixUniformLocation = gl.getUniformLocation(program, "u_modelViewMatrix");
    const normalMatrixUniformLocation = gl.getUniformLocation(program, "u_normalMatrix");

    const geometry = createGearGeometry(innerRadius, outerRadius, width, Math.round(teeth), toothDepth);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.vertices), gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.normals), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);
    
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.972, 0.961, 0.941, 0.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionAttributeLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(normalAttributeLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(normalAttributeLocation);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    let rotation = 0;
    let animationFrameId: number;

    const render = (time: number) => {
      rotation = time * 0.0003;

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const fieldOfView = 45 * Math.PI / 180;
      // FIX: Use `gl.canvas.width` and `gl.canvas.height` instead of `clientWidth` and `clientHeight`.
      // The `gl.canvas` property is typed as `HTMLCanvasElement | OffscreenCanvas`, and `OffscreenCanvas`
      // does not have `clientWidth` or `clientHeight`. Using `width` and `height` works for both,
      // and correctly represents the aspect ratio of the drawing buffer.
      const aspect = gl.canvas.width / gl.canvas.height;
      const projectionMatrix = mat4.create();
      mat4.perspective(projectionMatrix, fieldOfView, aspect, 0.1, 100.0);
      gl.uniformMatrix4fv(projectionMatrixUniformLocation, false, projectionMatrix);

      const modelViewMatrix = mat4.create();
      mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -4.5]);
      mat4.rotate(modelViewMatrix, modelViewMatrix, 0.5, [1, 0, 0]);
      mat4.rotate(modelViewMatrix, modelViewMatrix, rotation, [0, 1, 0]);
      gl.uniformMatrix4fv(modelViewMatrixUniformLocation, false, modelViewMatrix);
      
      const normalMatrix = mat4.create();
      mat4.rotate(normalMatrix, normalMatrix, 0.5, [1, 0, 0]);
      mat4.rotate(normalMatrix, normalMatrix, rotation, [0, 1, 0]);
      gl.uniformMatrix4fv(normalMatrixUniformLocation, false, normalMatrix);

      gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0);
      
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    
    return () => {
        cancelAnimationFrame(animationFrameId);
        gl.deleteBuffer(positionBuffer);
        gl.deleteBuffer(normalBuffer);
        gl.deleteBuffer(indexBuffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
    };
  }, [innerRadius, outerRadius, width, teeth, toothDepth]);

  return <canvas ref={canvasRef} className="rounded-lg w-full max-w-xl aspect-square cursor-grab active:cursor-grabbing" />;
};
