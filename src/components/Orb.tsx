// Jugnu's voice orb: a clear soap bubble with colour sliding over its skin. It reads on white and on black,
// swells with the voice, and its colours tell the state: Jugnu's yellow, lime and teal at rest, green while it
// listens, blue while it thinks, warm while it speaks. One fragment shader on a quad; plain WebGL, no libraries.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Mode } from "./Agent";

type RGB = [number, number, number];
type Colours = [RGB, RGB, RGB, RGB];
const REST: Colours = [[0.99, 0.8, 0.1], [0.55, 0.85, 0.15], [0.1, 0.78, 0.7], [0.2, 0.6, 0.97]];
const LISTEN: Colours = [[0.55, 0.9, 0.2], [0.2, 0.82, 0.4], [0.1, 0.78, 0.7], [0.4, 0.88, 0.3]];
const THINK: Colours = [[0.2, 0.6, 0.97], [0.42, 0.42, 0.98], [0.1, 0.72, 0.85], [0.3, 0.5, 0.98]];
const SPEAK: Colours = [[0.99, 0.78, 0.1], [0.98, 0.52, 0.2], [0.6, 0.85, 0.15], [0.1, 0.78, 0.7]];
const PALETTE: Record<Mode, Colours> = {
  off: REST,
  listening: LISTEN,
  hearing: THINK,
  thinking: THINK,
  working: THINK,
  speaking: SPEAK,
  error: [[0.95, 0.3, 0.3], [0.98, 0.5, 0.3], [0.9, 0.25, 0.4], [0.98, 0.45, 0.35]],
};

const FRAG = `
precision highp float;
uniform float uT, uAmp; uniform vec2 uRes; uniform vec3 uC[4];
vec3 m3(vec3 x){return x-floor(x/289.)*289.;}
vec4 m4(vec4 x){return x-floor(x/289.)*289.;}
vec4 pm(vec4 x){return m4((x*34.+1.)*x);}
float sn(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g,l.zxy); vec3 i2=max(g,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-.5;
  i=m3(i);
  vec4 p=pm(pm(pm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  vec4 j=p-49.*floor(p/49.); vec4 x_=floor(j/7.); vec4 y_=floor(j-7.*x_);
  vec4 x=(x_*2.+.5)/7.-1.; vec4 y=(y_*2.+.5)/7.-1.; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 nr=inversesqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=nr.x; p1*=nr.y; p2*=nr.z; p3*=nr.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
vec3 pal(float x){
  x=fract(x)*4.;
  if(x<1.)return mix(uC[0],uC[1],x);
  if(x<2.)return mix(uC[1],uC[2],x-1.);
  if(x<3.)return mix(uC[2],uC[3],x-2.);
  return mix(uC[3],uC[0],x-3.);
}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.-uRes)/uRes.y;
  float r=length(uv); float t=uT;
  // it breathes at rest and swells with the voice
  float R=.72+sin(t*1.3)*.008+uAmp*.08;
  vec3 c=vec3(0.); float al=0.;
  if(r<R){
    float z=sqrt(1.-r*r/(R*R));
    vec3 n=vec3(uv/R,z);
    float fr=pow(1.-z,1.5);
    // the colours of a thin film: they follow the skin's thickness, drifting with time and the voice
    float film=fr*.9+(.42+uAmp*.3)*sn(n*.8+vec3(0.,t*.16,t*.1))+t*.03;
    vec3 col=pal(film);
    // clear in the middle, colourful at the rim: on a dark page the middle lightens instead of going muddy
    float aa=.3+.7*smoothstep(.02,.9,fr);
    col=mix(col,vec3(1.),.22*(1.-fr));
    // two soft window reflections
    float s1=exp(-pow(length(uv-vec2(-.26,.32)*R/.72)/.17,2.))*.7;
    float s2=exp(-pow(length(uv-vec2(.3,-.34)*R/.72)/.09,2.))*.35;
    aa*=smoothstep(R,R-.025,r);
    float sp=(s1+s2)*smoothstep(R,R-.03,r);
    al=clamp(aa+sp*(1.-aa),0.,1.);
    c=col*aa*(1.-sp)+vec3(1.)*sp;
  }
  // a faint halo of the same colours
  float g=exp(-max(0.,r-R)*(11.-uAmp*4.))*(.3+uAmp*.35)*step(R,r)*smoothstep(.99,.8,r);
  c+=pal(atan(uv.y,uv.x)/6.2832+t*.05)*g;
  al=max(al,g);
  gl_FragColor=vec4(min(c,vec3(1.)),al);
}`;

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
    const prog = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, "attribute vec2 q;void main(){gl_Position=vec4(q,0.,1.);}"], [gl.FRAGMENT_SHADER, FRAG]] as const) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      gl.attachShader(prog, s);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("Orb: WebGL program failed", gl.getProgramInfoLog(prog));
      return setFailed(true);
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "q");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const [uT, uAmp, uRes, uC] = ["uT", "uAmp", "uRes", "uC"].map(U);
    gl.uniform2f(uRes, c.width, c.height);
    const cols = PALETTE[modeRef.current].map((x) => [...x]);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let amp = 0;
    let t = 0;
    let last = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      const m = modeRef.current;
      const busy = m === "thinking" || m === "working" || m === "hearing";
      // Thinking moves the colours faster; reduced motion slows everything.
      t += Math.min(0.05, (now - last) / 1000) * (busy ? 2.5 : 1) * (reduced ? 0.25 : 1);
      last = now;
      const target = m === "listening" || m === "speaking" ? 0.08 + Math.min(0.85, levelRef.current() * 1.2) : busy ? 0.2 + Math.sin(t * 3) * 0.06 : 0;
      amp += (target - amp) * 0.15;
      const goal = PALETTE[m];
      for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) cols[k][j] += (goal[k][j] - cols[k][j]) * 0.06;
      gl.viewport(0, 0, c.width, c.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uT, t);
      gl.uniform1f(uAmp, amp);
      gl.uniform3fv(uC, cols.flat());
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      // (Not loseContext: React may mount the same canvas again, and a lost context stays lost.)
      gl.deleteBuffer(buf);
    };
  }, [size]);
  if (failed) return <>{fallback}</>;
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}
