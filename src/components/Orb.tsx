// Jugnu's voice orb: a living 3D mesh of light. A translucent, iridescent body with a halo; over it
// a fine wireframe sphere that the voice deforms (3D noise in the vertex shader), and a dust of
// sparks around it. Colour follows the mode — cool blues at rest, cyan while listening, violet
// while thinking, firefly amber while speaking. Plain WebGL, no libraries.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Mode } from "./Agent";

type RGB = [number, number, number];
const PALETTE: Record<Mode, [RGB, RGB, RGB]> = {
  off: [[0.25, 0.45, 1], [0.62, 0.3, 1], [1, 0.32, 0.8]],
  listening: [[0.2, 0.85, 1], [0.3, 1, 0.72], [0.35, 0.5, 1]],
  hearing: [[0.3, 0.8, 1], [0.55, 0.35, 1], [1, 0.3, 0.75]],
  thinking: [[0.55, 0.35, 1], [1, 0.3, 0.75], [0.3, 0.8, 1]],
  working: [[0.45, 0.4, 1], [0.3, 0.85, 1], [1, 0.4, 0.7]],
  speaking: [[1, 0.72, 0.28], [1, 0.35, 0.6], [0.6, 0.4, 1]],
  error: [[1, 0.3, 0.3], [1, 0.6, 0.3], [0.6, 0.4, 1]],
};

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 tis(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 nr=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=nr.x; p1*=nr.y; p2*=nr.z; p3*=nr.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// The mesh and the sparks: unit-sphere points pushed out by noise, seen from a camera at z = 3.
const MESH_V = `
attribute vec3 aP; attribute float aK;
uniform float uT, uAmp, uSize; uniform mediump float uPt; uniform mat3 uRot; uniform vec3 uA, uB, uC;
varying vec3 vCol; varying float vA;
${NOISE}
void main(){
  vec3 n = normalize(aP);
  float sp = uT * .35;
  float d = snoise(n*1.6 + vec3(0., sp, sp*.6)) * (.06 + uAmp*.24) + snoise(n*3.8 + vec3(sp*1.3, 0., -sp)) * (.02 + uAmp*.09);
  vec3 p = uRot * (n * (length(aP) + d));
  vec3 v = p; v.z -= 3.;
  gl_Position = vec4(v.x*1.75, v.y*1.75, 0., -v.z);
  float h = .5 + .5*snoise(n*1.1 + vec3(uT*.08));
  vCol = mix(mix(uA, uB, smoothstep(-.8, .9, n.y + n.x*.4)), uC, smoothstep(.45, 1., h));
  float facing = smoothstep(-1., 1., p.z);
  vA = uPt > .5 ? (.2 + .8*pow(.5 + .5*sin(uT*2.2 + aK*60.), 4.)) * (.35 + .65*facing) : (.1 + .75*facing*facing) * (.75 + uAmp*.6);
  gl_PointSize = uSize * (.5 + aK);
}`;
const MESH_F = `
precision mediump float;
varying vec3 vCol; varying float vA; uniform float uPt;
void main(){
  float a = vA;
  if (uPt > .5) a *= smoothstep(.5, .0, length(gl_PointCoord - .5));
  gl_FragColor = vec4(vCol * a, a);
}`;

// Body and halo: an analytic sphere drawn on a full-canvas quad, brighter at the rim.
const GLOW_V = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const GLOW_F = `
precision mediump float;
uniform vec2 uRes; uniform float uT, uAmp, uR; uniform vec3 uA, uB, uC;
void main(){
  vec2 uv = (gl_FragCoord.xy*2. - uRes) / uRes.y;
  float r = length(uv);
  float R = uR * (1. + uAmp*.1);
  vec3 tint = mix(uA, uC, .5 + .5*sin(uT*.6 + atan(uv.y, uv.x)));
  vec3 col = tint * exp(-max(r - R*.92, 0.) * 6.) * (.16 + uAmp*.45) * (r > R ? 1. : .5);
  if (r < R) {
    float z = sqrt(1. - r*r/(R*R));
    vec3 n = vec3(uv/R, z);
    float k = .5 + .5*sin(n.x*3.1 + uT*.7) * cos(n.y*2.4 - uT*.5 + n.x);
    vec3 body = mix(mix(uA, uB, k), uC, pow(1. - z, 2.));
    col += body * (.08 + .32*pow(1. - z, 1.6) + uAmp*.12);
    col += vec3(1.) * pow(max(dot(reflect(-normalize(vec3(-.4, .6, .7)), n), vec3(0., 0., 1.)), 0.), 30.) * .25;
  }
  col *= smoothstep(1., .78, length((gl_FragCoord.xy*2. - uRes) / uRes));
  gl_FragColor = vec4(col, min(1., max(col.r, max(col.g, col.b))));
}`;

function build(size: number) {
  const big = size > 140;
  const [nLat, nLong, seg, nPts] = big ? [34, 56, 96, 700] : [12, 18, 36, 0];
  const v: number[] = [];
  const at = (th: number, ph: number) => [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph), 0];
  for (let i = 1; i < nLat; i++) {
    const th = (i / nLat) * Math.PI;
    for (let j = 0; j < seg; j++) v.push(...at(th, (j / seg) * 2 * Math.PI), ...at(th, ((j + 1) / seg) * 2 * Math.PI));
  }
  for (let j = 0; j < nLong; j++) {
    const ph = (j / nLong) * 2 * Math.PI;
    for (let i = 0; i < seg / 2; i++) v.push(...at((i / (seg / 2)) * Math.PI, ph), ...at(((i + 1) / (seg / 2)) * Math.PI, ph));
  }
  const lines = v.length / 4;
  for (let i = 0; i < nPts; i++) {
    const u = Math.random() * 2 - 1;
    const ph = Math.random() * 2 * Math.PI;
    const r = 1.05 + Math.pow(Math.random(), 2) * 0.45;
    const s = Math.sqrt(1 - u * u);
    v.push(s * Math.cos(ph) * r, u * r, s * Math.sin(ph) * r, Math.random());
  }
  return { data: new Float32Array(v), lines, points: nPts };
}

/** The orb. `level` is read every frame (0–1): the microphone while listening, the voice while speaking. */
export function Orb({ mode, level, size, fallback }: { mode: Mode; level: () => number; size: number; fallback?: ReactNode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const levelRef = useRef(level);
  levelRef.current = level;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    const gl = c.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) return setFailed(true);
    const program = (vs: string, fs: string) => {
      const p = gl.createProgram()!;
      for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
      return p;
    };
    let mesh: WebGLProgram, glow: WebGLProgram;
    try {
      mesh = program(MESH_V, MESH_F);
      glow = program(GLOW_V, GLOW_F);
    } catch (e) {
      console.warn("Orb: WebGL shader failed", e);
      return setFailed(true);
    }
    const geo = build(size);
    const meshBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.data, gl.STATIC_DRAW);
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const U = (p: WebGLProgram) => (n: string) => gl.getUniformLocation(p, n);
    const um = U(mesh);
    const ug = U(glow);
    const aP = gl.getAttribLocation(mesh, "aP");
    const aK = gl.getAttribLocation(mesh, "aK");
    const aQ = gl.getAttribLocation(glow, "p");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const cols = PALETTE[modeRef.current].map((x) => [...x]);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let amp = 0;
    let spin = 0;
    let t = 0;
    let last = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) * (reduced ? 0.25 : 1);
      last = now;
      t += dt;
      const m = modeRef.current;
      const busy = m === "thinking" || m === "working" || m === "hearing";
      const target = m === "listening" || m === "speaking" ? 0.08 + Math.min(0.9, levelRef.current() * 1.1) : busy ? 0.28 + Math.sin(t * 3) * 0.08 : 0.06 + Math.sin(t * 1.2) * 0.03;
      amp += (target - amp) * (target > amp ? 0.3 : 0.07);
      spin += dt * (busy ? 1.1 : 0.22 + amp * 0.5);
      const goal = PALETTE[m];
      for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) cols[k][j] += (goal[k][j] - cols[k][j]) * 0.05;
      const [cy, sy, cx, sx] = [Math.cos(spin), Math.sin(spin), Math.cos(0.38 + Math.sin(t * 0.3) * 0.12), Math.sin(0.38 + Math.sin(t * 0.3) * 0.12)];
      // rotX · rotY, column-major
      const rot = new Float32Array([cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy]);
      gl.viewport(0, 0, c.width, c.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(glow);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.disableVertexAttribArray(aK);
      gl.enableVertexAttribArray(aQ);
      gl.vertexAttribPointer(aQ, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(ug("uRes"), c.width, c.height);
      gl.uniform1f(ug("uT"), t);
      gl.uniform1f(ug("uAmp"), amp);
      gl.uniform1f(ug("uR"), 1.75 / Math.sqrt(8));
      gl.uniform3fv(ug("uA"), cols[0]);
      gl.uniform3fv(ug("uB"), cols[1]);
      gl.uniform3fv(ug("uC"), cols[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.useProgram(mesh);
      gl.bindBuffer(gl.ARRAY_BUFFER, meshBuf);
      gl.enableVertexAttribArray(aP);
      gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(aK);
      gl.vertexAttribPointer(aK, 1, gl.FLOAT, false, 16, 12);
      gl.uniform1f(um("uT"), t);
      gl.uniform1f(um("uAmp"), amp);
      gl.uniformMatrix3fv(um("uRot"), false, rot);
      gl.uniform3fv(um("uA"), cols[0]);
      gl.uniform3fv(um("uB"), cols[1]);
      gl.uniform3fv(um("uC"), cols[2]);
      gl.uniform1f(um("uPt"), 0);
      gl.drawArrays(gl.LINES, 0, geo.lines);
      if (geo.points) {
        gl.uniform1f(um("uPt"), 1);
        gl.uniform1f(um("uSize"), 3 * dpr);
        gl.drawArrays(gl.POINTS, geo.lines, geo.points);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      // (Not loseContext: React may mount the same canvas again, and a lost context stays lost.)
      gl.deleteBuffer(meshBuf);
      gl.deleteBuffer(quadBuf);
    };
  }, [size]);
  if (failed) return <>{fallback}</>;
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}
