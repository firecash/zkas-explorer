// The shielded mesh — the explorer's hero visual.
//
// A breathing crystalline 3D mesh: nodes, edges and faint glass triangles,
// no map and no locations — just structure, which is exactly what an outside
// observer of this chain gets to see. Every REAL transaction from the live
// feed flashes a node, races a light along an edge (value moved, endpoints
// private) and briefly shows its hash "encrypting" into dots. Small
// cryptographic tags (halo2, nullifier, AEAD…) drift through for texture.
//
// Self-contained three.js scene: nothing fetched, canvas-drawn sprites,
// drag-to-spin with inertia, paused when the tab is hidden or scrolled away.

import { useEffect, useRef } from "react";
import * as THREE from "three";

const TEAL = new THREE.Color("#17d6be");
const BRIGHT = new THREE.Color("#5ff2df");
const EDGE = new THREE.Color("#55607a");

const HEXC = "0123456789abcdef";

/** One incoming block, as the mesh needs it. */
export interface MeshBlock {
  hash: string;
  blue: number;
  txs: number;
}

// Ambient telemetry: a mix of REAL numbers from the live feed and the
// cryptographic machinery actually running under every block.
const ambientLines = (latest: MeshBlock | null): string[] => [
  "rpc getBlockDagInfo ✓",
  "rpc getShieldedBlocks → 200",
  "rpc submitBlock ✓",
  "node: 1 BPS · kHeavyHash",
  "peers: relaying ✓",
  "mempool: encrypted",
  "halo2::verify ✓",
  "orchard proof ✓",
  "zk-SNARK",
  "AEAD sealed",
  "nullifier ••••",
  "anchor ✓",
  "note commitment",
  "sinsemilla ✓",
  "action ⊕",
  ...(latest ? [`blueScore ${latest.blue.toLocaleString("en-US")}`, `block · ${latest.txs} tx`] : []),
];

const randHex = () => HEXC[Math.floor(Math.random() * 16)];

/** What a hash looks like at age t∈[0,1]: flicker → resolve to the REAL id.
 *  It stays resolved (and clickable) so people can see this is live chain
 *  data, not decoration. */
function hashDisplay(id: string, t: number): string {
  if (t < 0.28) return id.replace(/./g, randHex); // flickering ciphertext
  if (t < 0.42) {
    const k = Math.floor(((t - 0.28) / 0.14) * id.length);
    return id.slice(0, k) + id.slice(k).replace(/./g, randHex); // resolving
  }
  return id;
}

/** Round soft-edged sprite texture, drawn on a canvas (nothing fetched). */
function discTexture(inner: string, outer: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

/** Thin glowing ring texture for pulse ripples. */
function ringTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = "rgba(95,242,223,0.9)";
  ctx.lineWidth = 5;
  ctx.shadowColor = "rgba(23,214,190,0.9)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(64, 64, 50, 0, Math.PI * 2);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

interface Pulse {
  sprite: THREE.Sprite;
  ring: THREE.Sprite;
  born: number;
}

interface Packet {
  sprite: THREE.Sprite;
  a: number;
  b: number;
  born: number;
  dur: number;
}

/**
 * `txIds`: latest transaction ids from the live feed — every unseen id flashes
 * the mesh once. `blocks`: the live block feed — arrivals flash the outer cage
 * and surface real blueScore/tx-count telemetry. Real activity, unknowable shape.
 */
export default function ShieldedMesh({
  txIds,
  blocks,
  onNavigate,
}: {
  txIds: string[];
  blocks: MeshBlock[];
  /** SPA navigation for clicked tags (falls back to a full page load). */
  onNavigate?: (path: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const primedRef = useRef(false);
  const seenBlocksRef = useRef<Set<string>>(new Set());
  const blockQueueRef = useRef<MeshBlock[]>([]);
  const latestBlockRef = useRef<MeshBlock | null>(null);
  const blocksPrimedRef = useRef(false);
  const navRef = useRef(onNavigate);
  navRef.current = onNavigate;

  // Feed watcher: unseen txids into a bounded spawn queue the loop drains.
  useEffect(() => {
    const fresh: string[] = [];
    for (const id of txIds) {
      if (!seenRef.current.has(id)) {
        seenRef.current.add(id);
        fresh.push(id);
      }
    }
    if (!primedRef.current) {
      // The first snapshot is history — prime with a couple so it never opens dead.
      primedRef.current = true;
      queueRef.current = fresh.slice(0, 2);
      return;
    }
    queueRef.current = [...queueRef.current, ...fresh].slice(-6);
    if (seenRef.current.size > 4000) seenRef.current = new Set(txIds);
  }, [txIds]);

  // Block watcher: same dedupe, feeding cage flashes + real telemetry.
  useEffect(() => {
    if (blocks.length > 0) latestBlockRef.current = blocks[0];
    const fresh: MeshBlock[] = [];
    for (const b of blocks) {
      if (!seenBlocksRef.current.has(b.hash)) {
        seenBlocksRef.current.add(b.hash);
        fresh.push(b);
      }
    }
    if (!blocksPrimedRef.current) {
      blocksPrimedRef.current = true;
      blockQueueRef.current = fresh.slice(0, 1);
      return;
    }
    blockQueueRef.current = [...blockQueueRef.current, ...fresh].slice(-3);
    if (seenBlocksRef.current.size > 4000) seenBlocksRef.current = new Set(blocks.map((b) => b.hash));
  }, [blocks]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    // The canvas is an absolutely-positioned background of its frame and NEVER
    // gets a pixel width of its own — so it cannot push layout anywhere, on
    // any device, no matter what size the renderer computes.
    const cv = renderer.domElement;
    cv.style.position = "absolute";
    cv.style.inset = "0";
    cv.style.width = "100%";
    cv.style.height = "100%";
    cv.style.display = "block";
    mount.appendChild(cv);

    // HTML overlay for hash / crypto tags (crisper than sprite text).
    const overlay = document.createElement("div");
    overlay.className = "meshtags";
    mount.appendChild(overlay);
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const intervals = new Set<ReturnType<typeof setInterval>>();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
    camera.position.set(0, 0.15, 3.0);
    camera.lookAt(0, 0, 0);

    const group = new THREE.Group();
    group.rotation.set(0.35, 0.7, 0);
    scene.add(group);

    // --- Build the mesh topology from an icosphere ---------------------------
    // PolyhedronGeometry is non-indexed: dedupe vertices to get shared nodes,
    // then derive the unique edge set and triangle list from the faces.
    const src = new THREE.IcosahedronGeometry(1, 2);
    const pos = src.getAttribute("position");
    const dirs: THREE.Vector3[] = [];
    const keyToIdx = new Map<string, number>();
    const faceIdx: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
      let idx = keyToIdx.get(key);
      if (idx === undefined) {
        idx = dirs.length;
        keyToIdx.set(key, idx);
        dirs.push(v.clone().normalize());
      }
      faceIdx.push(idx);
    }
    src.dispose();
    const edgeSet = new Set<string>();
    const edges: [number, number][] = [];
    const tris: [number, number, number][] = [];
    for (let f = 0; f < faceIdx.length; f += 3) {
      const [a, b, c] = [faceIdx[f], faceIdx[f + 1], faceIdx[f + 2]];
      tris.push([a, b, c]);
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, a],
      ] as [number, number][]) {
        const k = p < q ? `${p}-${q}` : `${q}-${p}`;
        if (!edgeSet.has(k)) {
          edgeSet.add(k);
          edges.push(p < q ? [p, q] : [q, p]);
        }
      }
    }
    const N = dirs.length;
    const phase = Array.from({ length: N }, () => Math.random() * Math.PI * 2);
    const phase2 = Array.from({ length: N }, () => Math.random() * Math.PI * 2);
    const nodePos = dirs.map((d) => d.clone());

    // Dynamic buffers: nodes (points), edges (line segments), faces (triangles).
    const ptsArr = new Float32Array(N * 3);
    const ptsGeom = new THREE.BufferGeometry();
    ptsGeom.setAttribute("position", new THREE.BufferAttribute(ptsArr, 3));
    const dotTex = discTexture("rgba(255,255,255,1)", "rgba(255,255,255,0)");
    const ptsMat = new THREE.PointsMaterial({
      size: 0.045,
      map: dotTex,
      color: TEAL,
      transparent: true,
      opacity: 0.95,
      alphaTest: 0.05,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(ptsGeom, ptsMat);
    points.frustumCulled = false;
    group.add(points);

    const lineArr = new Float32Array(edges.length * 6);
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute("position", new THREE.BufferAttribute(lineArr, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: EDGE, transparent: true, opacity: 0.5, depthWrite: false });
    const lines = new THREE.LineSegments(lineGeom, lineMat);
    lines.frustumCulled = false;
    group.add(lines);

    const faceArr = new Float32Array(tris.length * 9);
    const faceGeom = new THREE.BufferGeometry();
    faceGeom.setAttribute("position", new THREE.BufferAttribute(faceArr, 3));
    const faceMat = new THREE.MeshBasicMaterial({
      color: TEAL,
      transparent: true,
      opacity: 0.028,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const faces = new THREE.Mesh(faceGeom, faceMat);
    faces.frustumCulled = false;
    group.add(faces);

    // Outer cage: a bigger, sparser wireframe drifting the other way — depth.
    const cage = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.55, 1)),
      new THREE.LineBasicMaterial({ color: EDGE, transparent: true, opacity: 0.14, depthWrite: false }),
    );
    scene.add(cage);

    // Dust: tiny particles floating around the core.
    const DUST = 140;
    const dustArr = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(1.65 + Math.random() * 1.1);
      dustArr.set([v.x, v.y, v.z], i * 3);
    }
    const dustGeom = new THREE.BufferGeometry();
    dustGeom.setAttribute("position", new THREE.BufferAttribute(dustArr, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.02,
      map: dotTex,
      color: EDGE,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dust = new THREE.Points(dustGeom, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    // Halo behind everything.
    const haloTex = discTexture("rgba(23,214,190,0.11)", "rgba(23,214,190,0)");
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false }));
    halo.scale.setScalar(4.2);
    halo.position.z = -0.6;
    scene.add(halo);

    // --- Pulses / packets ----------------------------------------------------
    const pulseTex = discTexture("rgba(95,242,223,1)", "rgba(23,214,190,0)");
    const ripTex = ringTexture();
    const pulses: Pulse[] = [];
    const packets: Packet[] = [];
    const PULSE_LIFE = 1.7;

    interface TagOpts {
      id?: string; // scramble-then-resolve this text
      href?: string; // makes the tag a real link into the explorer
      info?: string; // second line revealed on hover
    }

    const spawnTag = (cls: string, text: string, xPct: number, yPct: number, opts: TagOpts = {}) => {
      if (overlay.children.length > 5) return;
      const el = document.createElement(opts.href ? "a" : "span") as HTMLElement;
      el.className = opts.href ? `${cls} meshtag--link` : cls;
      // The mesh owns its whole frame (band on mobile, half-card on desktop):
      // just keep tags fully inside it.
      const narrow = mount.clientWidth < 640;
      el.style.left = `${Math.min(Math.max(xPct, 6), narrow ? 60 : 84)}%`;
      el.style.top = `${Math.min(Math.max(yPct, 8), narrow ? 74 : 86)}%`;
      el.textContent = text;
      const life = opts.href ? 5200 : 4000;
      el.style.animationDuration = `${life}ms`;
      if (opts.href) {
        (el as HTMLAnchorElement).href = opts.href;
        if (opts.info) el.dataset.info = opts.info;
        el.addEventListener("click", (e) => {
          e.preventDefault();
          if (navRef.current) navRef.current(opts.href!);
          else window.location.href = opts.href!;
        });
      }
      overlay.appendChild(el);
      if (opts.id) {
        const id = opts.id;
        const born = performance.now();
        const iv = setInterval(() => {
          const t = (performance.now() - born) / life;
          el.textContent = hashDisplay(id, t);
          if (t >= 0.42) {
            clearInterval(iv);
            intervals.delete(iv);
          }
        }, 66);
        intervals.add(iv);
      }
      // Never yank a tag out from under the cursor: retry while hovered.
      const scheduleRemove = (delay: number) => {
        const tm = setTimeout(() => {
          if (el.matches(":hover")) scheduleRemove(1500);
          else el.remove();
        }, delay);
        timers.add(tm);
      };
      scheduleRemove(life);
    };

    const proj = new THREE.Vector3();
    const spawnTx = (id: string, now: number) => {
      const n = Math.floor(Math.random() * N);
      const p = nodePos[n];
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: pulseTex, transparent: true, depthWrite: false, color: BRIGHT }),
      );
      sprite.position.copy(p);
      sprite.scale.setScalar(0.001);
      group.add(sprite);
      const ring = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: ripTex, transparent: true, depthWrite: false, color: TEAL }),
      );
      ring.position.copy(p);
      ring.scale.setScalar(0.001);
      group.add(ring);
      pulses.push({ sprite, ring, born: now });

      // hash tag at the node's screen position — a REAL, clickable txid
      group.updateMatrixWorld();
      proj.copy(p).applyMatrix4(group.matrixWorld).project(camera);
      spawnTag("meshtag", id.slice(0, 10), (proj.x * 0.5 + 0.5) * 100, (-proj.y * 0.5 + 0.5) * 100 - 4, {
        id: id.slice(0, 10),
        href: `/transactions/${id}`,
        info: "shielded tx — value & parties encrypted · open ↗",
      });

      // a light races along edges away from the node: value moved, endpoints private
      const out = edges.filter(([a, b]) => a === n || b === n);
      if (out.length > 0) {
        const [a, b] = out[Math.floor(Math.random() * out.length)];
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: pulseTex, transparent: true, depthWrite: false, color: BRIGHT }),
        );
        sp.scale.setScalar(0.05);
        group.add(sp);
        packets.push({ sprite: sp, a: a === n ? a : b, b: a === n ? b : a, born: now, dur: 0.8 + Math.random() * 0.4 });
      }
    };

    // --- Interaction: drag to spin, with inertia -----------------------------
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let velX = 0;
    let velY = 0;
    const el = renderer.domElement;
    el.style.touchAction = "pan-y"; // vertical page scroll still works on touch
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      velX = dx * 0.005;
      velY = dy * 0.003;
      group.rotation.y += velX;
      group.rotation.x = THREE.MathUtils.clamp(group.rotation.x + velY, -1.2, 1.2);
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    // --- Sizing / visibility -------------------------------------------------
    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false); // false: leave the 100%-CSS sizing alone
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Small viewports get a smaller model (camera pulled back) so the whole
      // crystal + cage sit inside the band with air around them.
      camera.position.z = w < 640 ? 4.1 : w / h > 1.9 ? 3.4 : 3.0;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let visible = true;
    const io = new IntersectionObserver((es) => (visible = es[0]?.isIntersecting ?? true));
    io.observe(mount);

    // --- The breathing: displace every node radially with slow sines ---------
    const breathe = (t: number) => {
      for (let i = 0; i < N; i++) {
        const r = 1 + 0.055 * Math.sin(t * 0.55 + phase[i]) + 0.03 * Math.sin(t * 1.25 + phase2[i]);
        nodePos[i].copy(dirs[i]).multiplyScalar(r);
        ptsArr.set([nodePos[i].x, nodePos[i].y, nodePos[i].z], i * 3);
      }
      for (let e = 0; e < edges.length; e++) {
        const [a, b] = edges[e];
        lineArr.set([nodePos[a].x, nodePos[a].y, nodePos[a].z, nodePos[b].x, nodePos[b].y, nodePos[b].z], e * 6);
      }
      for (let f = 0; f < tris.length; f++) {
        const [a, b, c] = tris[f];
        faceArr.set(
          [nodePos[a].x, nodePos[a].y, nodePos[a].z, nodePos[b].x, nodePos[b].y, nodePos[b].z, nodePos[c].x, nodePos[c].y, nodePos[c].z],
          f * 9,
        );
      }
      ptsGeom.attributes.position.needsUpdate = true;
      lineGeom.attributes.position.needsUpdate = true;
      faceGeom.attributes.position.needsUpdate = true;
      faceMat.opacity = 0.02 + 0.014 * (Math.sin(t * 0.4) * 0.5 + 0.5);
    };

    // --- Render loop ---------------------------------------------------------
    let raf = 0;
    let lastSpawn = 0;
    let lastIdle = 0;
    let lastAmbient = 0;
    let lastBlock = 0;
    let cageFlash = 0; // 1 when a block just landed, decays to 0
    const clock = new THREE.Clock();

    const step = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = clock.elapsedTime;

      if (!dragging) {
        group.rotation.y += 0.07 * dt + velX * 0.9;
        group.rotation.x = THREE.MathUtils.clamp(group.rotation.x + velY * 0.9, -1.2, 1.2);
        velX *= 0.94;
        velY *= 0.94;
      }
      cage.rotation.y -= 0.02 * dt;
      cage.rotation.x += 0.008 * dt;
      dust.rotation.y += 0.012 * dt;

      breathe(now);

      // drain the tx queue at a human rhythm
      if (queueRef.current.length > 0 && now - lastSpawn > 0.35) {
        lastSpawn = now;
        spawnTx(queueRef.current.shift()!, now);
      }
      // blocks: the outer cage flashes — a new container sealed around the core
      if (blockQueueRef.current.length > 0 && now - lastBlock > 2.2) {
        lastBlock = now;
        const b = blockQueueRef.current.shift()!;
        cageFlash = 1;
        spawnTag(
          "meshtag meshtag--block",
          `⬢ block ${b.blue.toLocaleString("en-US")} · ${b.txs} tx`,
          12 + Math.random() * 60,
          14 + Math.random() * 70,
          { href: `/blocks/${b.hash}`, info: `${b.hash.slice(0, 8)}…${b.hash.slice(-6)} · open ↗` },
        );
      }
      cageFlash *= Math.exp(-2.2 * dt);
      (cage.material as THREE.LineBasicMaterial).opacity = 0.14 + 0.38 * cageFlash;
      // keep the scene alive between txs: an anonymous light on a random edge
      if (now - lastIdle > 1.7) {
        lastIdle = now + Math.random() * 1.3;
        const [a, b] = edges[Math.floor(Math.random() * edges.length)];
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: pulseTex, transparent: true, depthWrite: false, color: TEAL }),
        );
        sp.scale.setScalar(0.04);
        group.add(sp);
        packets.push({ sprite: sp, a, b, born: now, dur: 1 + Math.random() * 0.6 });
      }
      if (now - lastAmbient > 3 && overlay.children.length < 3) {
        lastAmbient = now + Math.random() * 2.5;
        const lines = ambientLines(latestBlockRef.current);
        spawnTag("meshtag meshtag--dim", lines[Math.floor(Math.random() * lines.length)], 10 + Math.random() * 75, 12 + Math.random() * 76);
      }

      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        const t = (now - p.born) / PULSE_LIFE;
        if (t >= 1) {
          group.remove(p.sprite);
          group.remove(p.ring);
          (p.sprite.material as THREE.SpriteMaterial).dispose();
          (p.ring.material as THREE.SpriteMaterial).dispose();
          pulses.splice(i, 1);
          continue;
        }
        const ease = 1 - Math.pow(1 - t, 3);
        p.sprite.scale.setScalar(0.04 + 0.12 * ease);
        (p.sprite.material as THREE.SpriteMaterial).opacity = 1 - t;
        p.ring.scale.setScalar(0.02 + 0.5 * ease);
        (p.ring.material as THREE.SpriteMaterial).opacity = 0.9 * (1 - t);
      }

      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        const t = (now - p.born) / p.dur;
        if (t >= 1) {
          group.remove(p.sprite);
          (p.sprite.material as THREE.SpriteMaterial).dispose();
          packets.splice(i, 1);
          continue;
        }
        const e2 = t * t * (3 - 2 * t);
        p.sprite.position.lerpVectors(nodePos[p.a], nodePos[p.b], e2);
        (p.sprite.material as THREE.SpriteMaterial).opacity = Math.sin(t * Math.PI);
      }

      renderer.render(scene, camera);
    };

    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (!visible || document.hidden) return;
      step();
    };

    if (reduced) {
      breathe(0);
      renderer.render(scene, camera);
    } else {
      animate();
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      for (const t of timers) clearTimeout(t);
      for (const iv of intervals) clearInterval(iv);
      renderer.dispose();
      ptsGeom.dispose();
      lineGeom.dispose();
      faceGeom.dispose();
      dustGeom.dispose();
      cage.geometry.dispose();
      (cage.material as THREE.Material).dispose();
      ptsMat.dispose();
      lineMat.dispose();
      faceMat.dispose();
      dustMat.dispose();
      dotTex.dispose();
      haloTex.dispose();
      pulseTex.dispose();
      ripTex.dispose();
      mount.removeChild(renderer.domElement);
      mount.removeChild(overlay);
    };
  }, []);

  // Not aria-hidden: the overlay carries real links to blocks/transactions.
  return <div ref={mountRef} className="relative h-full w-full" />;
}
