// The block at night, in 3D. Every school is a small house at its real position: the brighter its
// windows, the more its children read and count above what its context predicts. Verified bright
// spots are circled by fireflies; the support plan shows as arcs of light, with a spark travelling
// from the demonstrator's school to the school learning from it. Built from the live data.
import { OrbitControls, Stars } from "@react-three/drei";
import { Minus, Plus } from "lucide-react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { mulberry32 } from "../engine/rng";
import type { School } from "../engine/types";
import { useT } from "../lib/prefs";
import { STATUS_INFO, type SchoolStatus } from "../lib/status";
import type { MapProps } from "./maps";
import { cx } from "./ui";

const S = 0.55; // km → scene units

/** Gentle hills; also used to sit houses and trees on the ground. */
const hill = (x: number, z: number) => 0.32 * Math.sin(x * 0.23 + 1.3) * Math.cos(z * 0.19 - 0.4) + 0.18 * Math.sin(x * 0.51 + z * 0.37) + 0.08 * Math.cos(z * 0.9 - x * 0.3);
const ground = (x: number, z: number) => hill(x, z) - Math.max(0, Math.hypot(x, z) - 16) * 0.28;

const ROOF: Record<SchoolStatus, string> = { ok: "#6a3a28", bright: "#facc15", support: "#8a7cc4", check_due: "#38bdf8", check_data: "#ef4444", revisit: "#e08a3c" };

function spriteTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.25, "rgba(255,240,160,0.9)");
  r.addColorStop(1, "rgba(255,220,80,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(52, 52, 150, 150);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color("#06111b");
    const high = new THREE.Color("#143341");
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = ground(pos.getX(i), pos.getZ(i));
      pos.setY(i, y);
      c.copy(low).lerp(high, THREE.MathUtils.clamp((y + 0.45) / 0.95, 0, 1));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} flatShading />
    </mesh>
  );
}

function River() {
  const geo = useMemo(() => {
    const pts = [
      [-20, 6],
      [-12, 3.5],
      [-6, 5.5],
      [0, 2],
      [5, -1.5],
      [11, 0.5],
      [20, -3],
    ].map(([x, z]) => new THREE.Vector3(x, ground(x, z) + 0.03, z));
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 220, 0.32, 8);
    g.scale(1, 0.06, 1);
    g.translate(0, 0.02, 0);
    return g;
  }, []);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#0c3a63" emissive="#0a2a4d" emissiveIntensity={0.7} roughness={0.15} metalness={0.4} />
    </mesh>
  );
}

function Trees({ avoid }: { avoid: { x: number; z: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const trees = useMemo(() => {
    const rng = mulberry32(7);
    const out: { x: number; z: number; s: number; c: number }[] = [];
    while (out.length < 420) {
      const a = rng() * Math.PI * 2;
      const r = 2 + Math.sqrt(rng()) * 17;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.85;
      if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < 0.45)) continue;
      out.push({ x, z, s: 0.14 + rng() * 0.2, c: rng() });
    }
    return out;
  }, [avoid]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const dark = new THREE.Color("#0d2a1c");
    const light = new THREE.Color("#1d4a2e");
    trees.forEach((t, i) => {
      o.position.set(t.x, ground(t.x, t.z) + t.s * 1.1, t.z);
      o.scale.set(t.s, t.s * 2.4, t.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, dark.clone().lerp(light, t.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [trees]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, trees.length]}>
      <coneGeometry args={[1, 1, 6]} />
      <meshStandardMaterial roughness={0.9} flatShading />
    </instancedMesh>
  );
}

interface Placed {
  s: School;
  x: number;
  z: number;
  y: number;
  status: SchoolStatus;
  glow: number;
}

function Houses({
  placed,
  selected,
  highlight,
  onHover,
  onSelect,
}: {
  placed: Placed[];
  selected?: string | null;
  highlight?: Set<string>;
  onHover: (i: number | null) => void;
  onSelect?: (id: string) => void;
}) {
  const body = useRef<THREE.InstancedMesh>(null);
  const roof = useRef<THREE.InstancedMesh>(null);
  const win = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const wall = new THREE.Color("#b9b3a2");
    const warm = new THREE.Color("#ffc46b");
    const dimWall = new THREE.Color("#3a3b40");
    placed.forEach((p, i) => {
      const sel = p.s.id === selected;
      const dim = !!highlight && !highlight.has(p.s.id) && !sel;
      const k = sel ? 1.35 : 1;
      o.rotation.set(0, (p.s.cluster * 0.7) % Math.PI, 0);
      o.position.set(p.x, p.y + 0.11 * k, p.z);
      o.scale.set(0.38 * k, 0.22 * k, 0.27 * k);
      o.updateMatrix();
      body.current!.setMatrixAt(i, o.matrix);
      body.current!.setColorAt(i, dim ? dimWall : wall);
      o.position.set(p.x, p.y + (0.22 + 0.085) * k, p.z);
      o.scale.set(0.3 * k, 0.17 * k, 0.22 * k);
      o.updateMatrix();
      roof.current!.setMatrixAt(i, o.matrix);
      roof.current!.setColorAt(i, new THREE.Color(sel ? "#ffffff" : ROOF[p.status]).multiplyScalar(dim ? 0.35 : 1));
      // A lit strip of windows on the long side; brightness = results vs expectation.
      o.position.set(p.x, p.y + 0.1 * k, p.z);
      o.scale.set(0.3 * k, 0.065 * k, 0.28 * k);
      o.updateMatrix();
      win.current!.setMatrixAt(i, o.matrix);
      win.current!.setColorAt(i, warm.clone().multiplyScalar(dim ? p.glow * 0.2 : p.glow));
    });
    for (const m of [body.current!, roof.current!, win.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [placed, selected, highlight]);
  const events = {
    onPointerMove: (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onHover(e.instanceId ?? null)),
    onPointerOut: () => onHover(null),
    onClick: (e: ThreeEvent<MouseEvent>) => (e.stopPropagation(), e.instanceId !== undefined && onSelect?.(placed[e.instanceId].s.id)),
  };
  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, placed.length]} {...events}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={roof} args={[undefined, undefined, placed.length]} {...events}>
        <coneGeometry args={[0.7071, 1, 4, 1]} />
        <meshStandardMaterial roughness={0.6} flatShading />
      </instancedMesh>
      <instancedMesh ref={win} args={[undefined, undefined, placed.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function Fireflies({ homes }: { homes: Placed[] }) {
  const ref = useRef<THREE.Points>(null);
  const tex = useMemo(spriteTexture, []);
  const per = 18;
  const seeds = useMemo(() => {
    const rng = mulberry32(11);
    return homes.flatMap((h) => Array.from({ length: per }, () => ({ h, r: 0.25 + rng() * 0.6, a: rng() * Math.PI * 2, y: 0.35 + rng() * 1.1, sp: 0.25 + rng() * 0.6, ph: rng() * 10 })));
  }, [homes]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seeds.length * 3), 3));
    return g;
  }, [seeds]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    seeds.forEach((f, i) => {
      const a = f.a + t * f.sp;
      pos.setXYZ(i, f.h.x + Math.cos(a) * f.r, f.h.y + f.y + Math.sin(t * 1.3 + f.ph) * 0.12, f.h.z + Math.sin(a) * f.r * 0.8);
    });
    pos.needsUpdate = true;
    if (ref.current) (ref.current.material as THREE.PointsMaterial).opacity = 0.75 + Math.sin(t * 2.2) * 0.2;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial map={tex} size={0.22} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} color={new THREE.Color(2.2, 1.9, 0.7)} toneMapped={false} />
    </points>
  );
}

/** A small floating lantern over each bright spot, and a warm pool of light on the ground. */
function Lanterns({ homes }: { homes: Placed[] }) {
  const pool = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(253,224,71,0.55)");
    r.addColorStop(0.5, "rgba(253,224,71,0.14)");
    r.addColorStop(1, "rgba(253,224,71,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  const orbs = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    orbs.current?.children.forEach((o, i) => {
      o.position.y = homes[i].y + 0.95 + Math.sin(clock.elapsedTime * 1.4 + i) * 0.08;
    });
  });
  return (
    <group>
      {homes.map((h) => (
        <mesh key={h.s.id} position={[h.x, h.y + 0.025, h.z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[2.2, 2.2]} />
          <meshBasicMaterial map={pool} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
      <group ref={orbs}>
        {homes.map((h) => (
          <mesh key={h.s.id} position={[h.x, h.y + 0.95, h.z]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshBasicMaterial color={new THREE.Color(4, 3.4, 1.4)} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Links({ curves }: { curves: THREE.QuadraticBezierCurve3[] }) {
  const sparks = useRef<THREE.InstancedMesh>(null);
  const tubes = useMemo(() => curves.map((c) => new THREE.TubeGeometry(c, 40, 0.014, 6)), [curves]);
  useFrame(({ clock }) => {
    const m = sparks.current;
    if (!m) return;
    const o = new THREE.Object3D();
    curves.forEach((c, i) => {
      o.position.copy(c.getPoint((clock.elapsedTime * 0.22 + i * 0.137) % 1));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial color={new THREE.Color(1.6, 1.25, 0.45)} transparent opacity={0.45} toneMapped={false} />
        </mesh>
      ))}
      {curves.length > 0 && (
        <instancedMesh ref={sparks} args={[undefined, undefined, curves.length]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshBasicMaterial color={new THREE.Color(3, 2.6, 1.2)} toneMapped={false} />
        </instancedMesh>
      )}
    </group>
  );
}

function SelectedRing({ at }: { at: Placed }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const k = 1 + (Math.sin(clock.elapsedTime * 3) + 1) * 0.12;
    ref.current?.scale.set(k, k, k);
  });
  return (
    <mesh ref={ref} position={[at.x, at.y + 0.03, at.z]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.42, 0.5, 40]} />
      <meshBasicMaterial color={new THREE.Color(2, 2, 2)} toneMapped={false} transparent opacity={0.9} />
    </mesh>
  );
}

type HoverInfo = { name: string; teacher: string; cluster: string; status: SchoolStatus };

/** Keeps plain DOM labels (in the overlay next to the canvas) on their 3D positions, every frame. */
function LabelProjector({ overlay, items }: { overlay: RefObject<HTMLDivElement | null>; items: { key: string; pos: THREE.Vector3 }[] }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const box = overlay.current;
    if (!box) return;
    for (const it of items) {
      const el = box.querySelector<HTMLElement>(`[data-k="${CSS.escape(it.key)}"]`);
      if (!el) continue;
      v.copy(it.pos).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, ${it.key === "__hover" ? "-110%" : "-50%"})`;
      el.style.visibility = v.z < 1 ? "visible" : "hidden";
    }
  });
  return null;
}

function Scene({
  schools,
  status,
  selected,
  onSelect,
  links = [],
  z = {},
  autoRotate,
  highlight,
  controls,
  overlay,
  onLabels,
  onHoverInfo,
}: MapProps & {
  autoRotate?: boolean;
  controls: RefObject<OrbitControlsImpl | null>;
  overlay: RefObject<HTMLDivElement | null>;
  onLabels: (names: string[]) => void;
  onHoverInfo: (h: HoverInfo | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const placed = useMemo<Placed[]>(
    () =>
      schools.map((s) => {
        const x = s.x * S;
        const zz = -s.y * S;
        const above = z[s.id] ?? 0;
        return { s, x, z: zz, y: ground(x, zz), status: status.get(s.id) ?? "ok", glow: THREE.MathUtils.clamp(0.25 + (above + 1.2) * 0.55, 0.12, 2.4) };
      }),
    [schools, status, z],
  );
  const byId = useMemo(() => new Map(placed.map((p) => [p.s.id, p])), [placed]);
  const bright = useMemo(() => placed.filter((p) => p.status === "bright"), [placed]);
  const avoid = useMemo(() => placed.map((p) => ({ x: p.x, z: p.z })), [placed]);
  const curves = useMemo(
    () =>
      links
        .map((l) => [byId.get(l.from), byId.get(l.to)] as const)
        .filter((p): p is readonly [Placed, Placed] => !!p[0] && !!p[1])
        .map(([a, b]) => {
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          return new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(a.x, a.y + 0.45, a.z),
            new THREE.Vector3((a.x + b.x) / 2, Math.max(a.y, b.y) + 0.6 + d * 0.32, (a.z + b.z) / 2),
            new THREE.Vector3(b.x, b.y + 0.35, b.z),
          );
        }),
    [links, byId],
  );
  const clusters = useMemo(() => {
    const m = new Map<string, { x: number; z: number; n: number }>();
    for (const p of placed) {
      const c = m.get(p.s.clusterName) ?? { x: 0, z: 0, n: 0 };
      m.set(p.s.clusterName, { x: c.x + p.x, z: c.z + p.z, n: c.n + 1 });
    }
    return [...m.entries()].map(([name, c]) => ({ name, x: c.x / c.n, z: c.z / c.n }));
  }, [placed]);
  const sel = selected ? byId.get(selected) : undefined;
  // Look at the highlighted schools (for example one cluster) when they are a small part of the block.
  const focusTarget = useMemo<[number, number, number]>(() => {
    const pts = highlight && highlight.size < placed.length * 0.5 ? placed.filter((p) => highlight.has(p.s.id)) : [];
    if (!pts.length) return [0, 0, 0];
    return [pts.reduce((a, p) => a + p.x, 0) / pts.length, 0, pts.reduce((a, p) => a + p.z, 0) / pts.length];
  }, [highlight, placed]);
  const hov = hover !== null ? placed[hover] : null;
  useEffect(() => onLabels(clusters.map((c) => c.name)), [clusters, onLabels]);
  useEffect(() => onHoverInfo(hov ? { name: hov.s.name, teacher: hov.s.teacher, cluster: hov.s.clusterName, status: hov.status } : null), [hov, onHoverInfo]);
  const items = useMemo(() => {
    const out = clusters.map((c) => ({ key: c.name, pos: new THREE.Vector3(c.x, ground(c.x, c.z) + 1.5, c.z) }));
    if (hov) out.push({ key: "__hover", pos: new THREE.Vector3(hov.x, hov.y + 0.6, hov.z) });
    return out;
  }, [clusters, hov]);

  return (
    <>
      <color attach="background" args={["#050912"]} />
      <fog attach="fog" args={["#050912", 22, 46]} />
      <hemisphereLight args={["#5d7ab8", "#0b1a12", 0.55]} />
      <directionalLight position={[-8, 14, 6]} intensity={0.75} color="#a9c1ff" />
      <Stars radius={70} depth={30} count={1400} factor={2.6} saturation={0} fade speed={0.35} />
      <Terrain />
      <River />
      <Trees avoid={avoid} />
      <Houses placed={placed} selected={selected} highlight={highlight} onHover={setHover} onSelect={onSelect} />
      <Lanterns homes={bright} />
      <Fireflies homes={bright} />
      <Links curves={curves} />
      {sel && <SelectedRing at={sel} />}
      <LabelProjector overlay={overlay} items={items} />
      <OrbitControls
        ref={controls}
        target={focusTarget}
        enablePan={false}
        enableZoom={false}
        enableDamping
        autoRotate={autoRotate}
        autoRotateSpeed={0.35}
        minDistance={4}
        maxDistance={34}
        minPolarAngle={0.35}
        maxPolarAngle={1.18}
      />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.82} luminanceSmoothing={0.25} />
        <Vignette offset={0.32} darkness={0.6} />
      </EffectComposer>
    </>
  );
}

export default function BlockScene(props: MapProps & { autoRotate?: boolean }) {
  const t = useT();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const focused = !!props.highlight && props.highlight.size < props.schools.length * 0.5;
  const zoom = (k: number) => {
    const c = controls.current;
    if (!c) return;
    const dir = c.object.position.clone().sub(c.target);
    c.object.position.copy(c.target.clone().add(dir.setLength(THREE.MathUtils.clamp(dir.length() * k, 4, 34))));
    c.update();
  };
  const btn = "grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md hover:bg-black/70";
  const overlay = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [hov, setHov] = useState<HoverInfo | null>(null);
  return (
    <div
      className={cx("relative", props.className ?? "overflow-hidden rounded-2xl")}
      style={{ height: props.height ?? 420 }}
      role="img"
      aria-label={t(
        "3D night map of the block: houses are schools, fireflies mark bright spots, arcs of light link schools that help each other",
        "ब्लॉक का 3D रात का नक्शा: घर स्कूल हैं, जुगनू अच्छे स्कूल दिखाते हैं, रोशनी की रेखाएँ एक-दूसरे की मदद करने वाले स्कूल जोड़ती हैं",
      )}
    >
      <Canvas dpr={[1, 1.6]} camera={{ position: focused ? [0, 8, 11] : [0, 12, 17], fov: 38 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <Scene {...props} controls={controls} overlay={overlay} onLabels={setLabels} onHoverInfo={setHov} />
      </Canvas>
      {/* labels as plain DOM, positioned from the 3D scene (no extra React roots inside the canvas) */}
      <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {labels.map((name) => (
          <div key={name} data-k={name} className="invisible absolute left-0 top-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
            {name}
          </div>
        ))}
        {hov && (
          <div data-k="__hover" className="invisible absolute left-0 top-0 z-10 whitespace-nowrap rounded-2xl border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur-xl">
            <div className="font-semibold">{hov.name}</div>
            <div className="text-white/70">
              {hov.teacher} · {hov.cluster}
            </div>
            <div style={{ color: STATUS_INFO[hov.status].color }}>{t(STATUS_INFO[hov.status].en, STATUS_INFO[hov.status].hi)}</div>
          </div>
        )}
      </div>
      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        <button className={btn} onClick={() => zoom(0.8)} aria-label={t("Zoom in", "पास करें")}>
          <Plus size={15} />
        </button>
        <button className={btn} onClick={() => zoom(1.25)} aria-label={t("Zoom out", "दूर करें")}>
          <Minus size={15} />
        </button>
      </div>
    </div>
  );
}
