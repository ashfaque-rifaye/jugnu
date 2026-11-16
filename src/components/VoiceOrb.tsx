// Jugnu's voice orb, after the one in Toli: a soft 3D sphere whose skin ripples with noise, glowing
// amber, violet and cyan at the rim, with a warm halo behind. It ripples gently at rest, faster while it
// thinks, and swells with the voice. Plain WebGL (no 3D library to download), drawn at the dock's size.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Mode } from "./Agent";

type State = "idle" | "listening" | "thinking" | "speaking";
const STATE: Record<Mode, State> = { off: "idle", error: "idle", listening: "listening", hearing: "thinking", thinking: "thinking", working: "thinking", speaking: "speaking" };
const TARGET: Record<State, { amp: number; speed: number; glow: number }> = {
  idle: { amp: 0.06, speed: 0.35, glow: 0.6 },
  listening: { amp: 0.1, speed: 0.6, glow: 0.9 },
  thinking: { amp: 0.08, speed: 1.6, glow: 1.0 },
  speaking: { amp: 0.13, speed: 0.9, glow: 1.2 },
};

/* Ashima 3D simplex noise (MIT) */
const NOISE = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+2.0*C.xxx; vec3 x3=x0-1.0+3.0*C.xxx;
  i=mod(i,289.0);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERT = `
attribute vec3 aPos;
uniform mat4 uP; uniform mat4 uMV; uniform mat3 uN;
uniform float uTime; uniform float uAmp; uniform float uSpeed;
varying vec3 vN; varying vec3 vV; varying float vD;
${NOISE}
void main(){
  vec3 normal = aPos;
  float t = uTime * uSpeed;
  float d = snoise(normal * 1.15 + vec3(t * 0.5)) * 0.7 + snoise(normal * 2.3 - vec3(t * 0.8)) * 0.15;
  vD = d;
  vec4 mv = uMV * vec4(aPos + normal * d * uAmp, 1.0);
  vN = normalize(uN * normal);
  vV = normalize(-mv.xyz);
  gl_Position = uP * mv;
}`;

const FRAG = `
precision highp float;
uniform float uTime; uniform float uGlow;
varying vec3 vN; varying vec3 vV; varying float vD;
vec3 pal(float t){ // amber -> violet -> cyan -> amber
  vec3 a=vec3(1.0,0.85,0.63), b=vec3(0.76,0.42,1.0), c=vec3(0.30,0.92,1.0);
  t=fract(t); return t<0.33?mix(a,b,t*3.0):t<0.66?mix(b,c,(t-0.33)*3.0):mix(c,a,(t-0.66)*3.0);
}
void main(){
  float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
  float band = vN.y * 0.35 + vN.x * 0.25 + vD * 0.5 + uTime * 0.05;
  vec3 iri = pal(band);
  vec3 inner = pal(band + 0.33 + vD * 0.6);
  vec3 core = mix(vec3(0.16,0.12,0.30), inner * 0.95, 0.55 + vD * 0.45);
  core += vec3(1.0, 0.93, 0.85) * pow(max(vN.z, 0.0), 6.0) * 0.35;
  vec3 col = mix(core, iri * 1.15, fres) + iri * fres * uGlow;
  float spec = pow(max(dot(reflect(-vV, vN), normalize(vec3(-0.4,0.7,0.6))), 0.0), 24.0);
  col += vec3(1.0) * spec * 0.6;
  gl_FragColor = vec4(min(col, vec3(1.0)), 0.82 + fres * 0.18);
}`;

// The halo: a soft warm disc behind the sphere, added on top of whatever is there.
const HALO_VERT = `attribute vec2 q; varying vec2 vP; void main(){ vP=q; gl_Position=vec4(q,0.999,1.0); }`;
const HALO_FRAG = `
precision mediump float;
uniform float uGlow; uniform float uSpan; varying vec2 vP;
void main(){ float d=length(vP)*0.5/uSpan; float a=smoothstep(.5,.18,d)*.22*uGlow; gl_FragColor=vec4(vec3(1.0,.82,.6)*a,a); }`;

const FOV = (32 * Math.PI) / 180;
// Far enough that the sphere fills the same share of the canvas as the bubble it replaces.
const CAM_Z = 5.0;

function sphere(lat = 40, lon = 56) {
  const pos: number[] = [];
  for (let i = 0; i <= lat; i++) {
    const th = (i / lat) * Math.PI;
    for (let j = 0; j <= lon; j++) {
      const ph = (j / lon) * Math.PI * 2;
      pos.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
    }
  }
  const idx: number[] = [];
  const row = lon + 1;
  for (let i = 0; i < lat; i++)
    for (let j = 0; j < lon; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  // Face the triangles outwards whichever way the loops wound them, so back faces can be culled.
  const v = (k: number) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
  const [A, B, C] = [v(idx[row * 3]), v(idx[row * 3 + 1]), v(idx[row * 3 + 2])].map((x, n) => x ?? [n, 0, 0]);
  const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
  const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  if (nrm[0] * A[0] + nrm[1] * A[1] + nrm[2] * A[2] < 0) for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
  return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
}

function program(gl: WebGLRenderingContext, vs: string, fs: string) {
  const p = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link failed");
  return p;
}

/** The orb at `size` px. `level` is read every frame (0–1): the microphone while listening, the voice while speaking. */
export default function VoiceOrb({ mode, level, size, fallback }: { mode: Mode; level: () => number; size: number; fallback?: ReactNode }) {
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
    const gl = c.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl) return setFailed(true);
    let orb: WebGLProgram, halo: WebGLProgram;
    try {
      orb = program(gl, VERT, FRAG);
      halo = program(gl, HALO_VERT, HALO_FRAG);
    } catch (e) {
      console.warn("VoiceOrb:", e);
      return setFailed(true);
    }
    const geo = sphere();
    const vbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);
    const ibuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.idx, gl.STATIC_DRAW);
    const qbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const u = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);
    const U = { P: u(orb, "uP"), MV: u(orb, "uMV"), N: u(orb, "uN"), time: u(orb, "uTime"), amp: u(orb, "uAmp"), speed: u(orb, "uSpeed"), glow: u(orb, "uGlow"), hGlow: u(halo, "uGlow"), hSpan: u(halo, "uSpan") };
    const aPos = gl.getAttribLocation(orb, "aPos");
    const aQ = gl.getAttribLocation(halo, "q");
    const f = 1 / Math.tan(FOV / 2);
    const P = new Float32Array([f, 0, 0, 0, 0, f, 0, 0, 0, 0, -10.1 / 9.9, -1, 0, 0, -2 / 9.9, 0]);
    // The halo is a 3.6-wide disc 0.6 behind the sphere: how much of the canvas that covers.
    const span = 3.6 / (2 * (CAM_Z + 0.6) * Math.tan(FOV / 2));

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cur = { amp: 0.1, speed: 0.35, glow: 0.6 };
    let time = 0;
    let ry = 0;
    let clock = 0;
    let last = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      clock += dt;
      const state = STATE[modeRef.current];
      const t = TARGET[state];
      const lv = state === "listening" || state === "speaking" ? Math.min(1, levelRef.current()) : 0;
      const pulse = state === "speaking" ? (Math.sin(clock * 9) * 0.5 + 0.5) * 0.5 : 0;
      cur.amp += (t.amp + lv * 0.3 + pulse * 0.08 - cur.amp) * Math.min(1, dt * 8);
      cur.speed += (t.speed - cur.speed) * Math.min(1, dt * 3);
      cur.glow += (t.glow + lv * 0.8 - cur.glow) * Math.min(1, dt * 5);
      time += reduce ? 0 : dt;
      ry += dt * (0.15 + cur.speed * 0.2);
      const rx = Math.sin(clock * 0.3) * 0.2;
      const s = 1 + lv * 0.12 + pulse * 0.05;
      // rotation X then Y, scaled, pushed back from the camera
      const [cx, sx, cy, sy] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry)];
      const R = [cy, 0, -sy, sy * sx, cx, cy * sx, sy * cx, -sx, cy * cx];
      const MV = new Float32Array([R[0] * s, R[1] * s, R[2] * s, 0, R[3] * s, R[4] * s, R[5] * s, 0, R[6] * s, R[7] * s, R[8] * s, 0, 0, 0, -CAM_Z, 1]);

      gl.viewport(0, 0, c.width, c.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);

      gl.useProgram(halo);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform1f(U.hGlow, cur.glow);
      gl.uniform1f(U.hSpan, span);
      gl.bindBuffer(gl.ARRAY_BUFFER, qbuf);
      gl.enableVertexAttribArray(aQ);
      gl.vertexAttribPointer(aQ, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(aQ);

      gl.useProgram(orb);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.uniformMatrix4fv(U.P, false, P);
      gl.uniformMatrix4fv(U.MV, false, MV);
      gl.uniformMatrix3fv(U.N, false, new Float32Array(R));
      gl.uniform1f(U.time, time);
      gl.uniform1f(U.amp, cur.amp);
      gl.uniform1f(U.speed, cur.speed);
      gl.uniform1f(U.glow, cur.glow);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
      gl.drawElements(gl.TRIANGLES, geo.idx.length, gl.UNSIGNED_SHORT, 0);
      gl.disableVertexAttribArray(aPos);
      gl.disable(gl.CULL_FACE);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      // (Not loseContext: React may mount the same canvas again, and a lost context stays lost.)
      gl.deleteBuffer(vbuf);
      gl.deleteBuffer(ibuf);
      gl.deleteBuffer(qbuf);
    };
  }, [size]);

  if (failed) return <>{fallback}</>;
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}
