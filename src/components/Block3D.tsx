// The block in 3D: every school is a pillar at its real position; height = how far results
// beat (or fall short of) what its context predicts. Verified bright spots glow gold with
// fireflies around them. Built from the live pipeline — not a decorative model.
import { Grid, Html, OrbitControls, Sparkles } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { School } from "../engine/types";
import { useTheme } from "../lib/theme";

interface Props {
  schools: School[];
  z: Record<string, number>;
  bright: Set<string>;
  struggling: Set<string>;
  inflated: Set<string>;
  onSelect?: (id: string) => void;
  selected?: string | null;
  autoRotate?: boolean;
  className?: string;
  interactive?: boolean;
}

const SCALE = 0.42;

function pillarColor(z: number, mono: boolean): THREE.Color {
  const t = Math.max(-1, Math.min(1, z / 2));
  if (mono) {
    const v = 0.35 + (t + 1) * 0.3; // darker below expectation, near-white above
    return new THREE.Color(v, v, v);
  }
  const neutral = new THREE.Color("#5c5e62");
  return t >= 0 ? neutral.clone().lerp(new THREE.Color("#2dd4bf"), t) : neutral.clone().lerp(new THREE.Color("#e66767"), -t);
}

function Pillars({ schools, z, bright, struggling, inflated, onSelect, selected, mono, interactive }: Props & { mono: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const [hover, setHover] = useState<number | null>(null);
  const data = useMemo(
    () =>
      schools.map((s) => {
        const zz = z[s.id] ?? 0;
        const h = 0.25 + Math.max(0, zz + 1.6) * 0.75;
        return { s, h, x: s.x * SCALE, zPos: -s.y * SCALE, color: bright.has(s.id) ? new THREE.Color("#fde047") : inflated.has(s.id) ? new THREE.Color("#ef4444") : pillarColor(zz, mono) };
      }),
    [schools, z, bright, inflated, mono],
  );

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    data.forEach((d, i) => {
      o.position.set(d.x, d.h / 2, d.zPos);
      o.scale.set(0.34, d.h, 0.34);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, d.s.id === selected ? new THREE.Color("#ffffff") : d.color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data, selected]);

  const hovered = hover !== null ? data[hover] : null;
  return (
    <group>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, data.length]}
        onPointerMove={interactive ? (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), setHover(e.instanceId ?? null)) : undefined}
        onPointerOut={interactive ? () => setHover(null) : undefined}
        onClick={interactive ? (e: ThreeEvent<MouseEvent>) => e.instanceId !== undefined && onSelect?.(data[e.instanceId].s.id) : undefined}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.35} metalness={0.25} emissiveIntensity={0.2} />
      </instancedMesh>
      {data
        .filter((d) => bright.has(d.s.id))
        .map((d) => (
          <group key={d.s.id} position={[d.x, d.h + 0.35, d.zPos]}>
            <mesh>
              <sphereGeometry args={[0.16, 24, 24]} />
              <meshBasicMaterial color="#fef08a" toneMapped={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.55, 24, 24]} />
              <meshBasicMaterial color="#fde047" transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </mesh>
            <pointLight color="#fde047" intensity={6} distance={3.2} />
            <Sparkles count={10} scale={[1.6, 1.4, 1.6]} size={3} speed={0.4} color="#fef08a" />
          </group>
        ))}
      {data
        .filter((d) => struggling.has(d.s.id))
        .map((d) => (
          <mesh key={d.s.id} position={[d.x, 0.02, d.zPos]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.26, 0.32, 24]} />
            <meshBasicMaterial color={mono ? "#ffffff" : "#e66767"} transparent opacity={0.55} />
          </mesh>
        ))}
      {hovered && (
        <Html position={[hovered.x, hovered.h + 0.6, hovered.zPos]} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-xl border border-white/20 bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur">
            <div className="font-semibold">{hovered.s.name}</div>
            <div className="text-white/70">
              {(z[hovered.s.id] ?? 0) >= 0 ? "+" : ""}
              {(z[hovered.s.id] ?? 0).toFixed(1)} SD vs expected · {hovered.s.clusterName}
            </div>
            {bright.has(hovered.s.id) && <div className="text-amber-200">✦ verified bright spot</div>}
          </div>
        </Html>
      )}
    </group>
  );
}

export default function Block3D(props: Omit<Props, "mono">) {
  const { theme } = useTheme();
  const mono = theme === "mono";
  const { autoRotate = true, className, interactive = true } = props;
  return (
    <div className={className} role="img" aria-label="3D map of the block: school pillars by results versus expectation, bright spots glowing">
      <Canvas dpr={[1, 1.75]} camera={{ position: [9, 8, 11], fov: 40 }} gl={{ antialias: true, alpha: true }}>
        <fog attach="fog" args={["#000000", 24, 48]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[6, 12, 4]} intensity={1.1} />
        <directionalLight position={[-8, 5, -6]} intensity={0.35} color={mono ? "#ffffff" : "#2dd4bf"} />
        <Pillars {...props} mono={mono} interactive={interactive} />
        <Grid
          args={[40, 40]}
          position={[0, 0, 0]}
          cellSize={0.6}
          cellThickness={0.5}
          cellColor={mono ? "#3f3f46" : "#134e4a"}
          sectionSize={3}
          sectionThickness={1}
          sectionColor={mono ? "#71717a" : "#a16207"}
          fadeDistance={26}
          fadeStrength={1.4}
          infiniteGrid
        />
        <Sparkles count={120} scale={[18, 5, 18]} position={[0, 2.5, 0]} size={2.4} speed={0.3} color="#fef08a" opacity={0.8} />
        <OrbitControls enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={6} maxDistance={24} maxPolarAngle={Math.PI / 2.15} enabled={interactive} />
      </Canvas>
    </div>
  );
}
