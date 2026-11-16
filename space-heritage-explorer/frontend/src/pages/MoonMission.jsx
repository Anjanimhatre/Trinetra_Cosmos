// MoonMission.jsx   (npm i three)   Route: <Route path="/mission" element={<MoonMission />} />
// 1 unit = 1000 km in space. Real Earth-Moon distance and sizes, KSC LC-39A launch, Tranquility Base landing.
// Maps: /public/textures/{earth,moon}.jpg -> NASA-derived CDN maps -> NASA Image API -> procedural fallback.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const NASA_SEARCH = "https://images-api.nasa.gov/search";
const BASE = ["https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/", "https://threejs.org/examples/textures/planets/"];
const SOURCES = {
  earth: ["/textures/earth.jpg", "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg", ...BASE.map((b) => b + "earth_atmos_2048.jpg")],
  moon: ["/textures/moon.jpg", ...BASE.map((b) => b + "moon_1024.jpg")],
};
const QUERIES = {
  earth: ["Blue Marble Next Generation global map", "Earth global map land ocean ice cloud"],
  moon: ["Lunar Reconnaissance Orbiter global color map Moon", "Moon global mosaic LROC WAC"],
};
// Accepts an image only if it loads with CORS and is a wide (about 2:1) map.
const probe = (url) => new Promise((res) => {
  const im = new Image(); im.crossOrigin = "anonymous";
  const t = setTimeout(() => res(false), 15000);
  im.onload = () => { clearTimeout(t); const r = im.naturalWidth / im.naturalHeight; res(im.naturalWidth >= 1024 && r > 1.9 && r < 2.1); };
  im.onerror = () => { clearTimeout(t); res(false); };
  im.src = url;
});
async function resolveMap(name) {
  const key = `mm-tex-${name}`; let cached = null;
  try { cached = localStorage.getItem(key); } catch { /* storage blocked */ }
  for (const u of [cached, ...SOURCES[name]]) if (u && (await probe(u))) { try { localStorage.setItem(key, u); } catch { /* ignore */ } return u; }
  let tries = 0;
  for (const q of QUERIES[name]) {
    try {
      const j = await (await fetch(`${NASA_SEARCH}?${new URLSearchParams({ q, media_type: "image", page_size: 12 })}`)).json();
      for (const it of j.collection?.items || []) {
        if (!it.href) continue;
        let urls = [];
        try { urls = (await (await fetch(it.href)).json()).filter((u) => /\.(jpe?g|png)$/i.test(u)); } catch { continue; }
        for (const tag of ["~orig", "~large", "~medium"]) for (const u of urls.filter((x) => x.includes(tag))) {
          if (++tries > 12) return null;
          if (await probe(u)) return u;
        }
      }
    } catch { /* next query */ }
  }
  return null;
}

// ---------- constants ----------
const R_E = 6.371, R_M = 1.737, DIST = 384.4, R_PARK = R_E + 0.19, R_LUN = R_M + 0.111;
const LAT = 0.674, LON = 23.473, KSC = [28.6084, -80.6041];
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SUN = V(0.216, 0, 0.976).normalize();            // space: Moon at first quarter, Sun ~11 deg above horizon at Tranquility Base
const SUNL = V(0.98, 0.19, -0.05).normalize();         // Moon surface: +x east, +y up, -z north
const EDIR = V(-0.407, 0.914, 0).normalize();          // Earth about 66 deg up, to the west
const TH_TLI = 3.5 * Math.PI;                           // parking-orbit angle where TLI starts
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => x * x * (3 - 2 * x);
const KEYS = [[0, -10], [10, 0], [38, 700], [58, 9856], [112, 273000], [124, 369180], [140, 369940]]; // sim s -> real MET s
const met = (t) => { for (let i = 1; i < KEYS.length; i++) if (t <= KEYS[i][0]) { const a = KEYS[i - 1], b = KEYS[i]; return a[1] + (b[1] - a[1]) * clamp((t - a[0]) / (b[0] - a[0])); } return 369940; };
const fmt = (s) => `${String(Math.floor(s / 3600)).padStart(3, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const LINES = [
  [0, "T-10. Kennedy Space Center, Launch Complex 39A. Saturn V, 16 July 1969."], [7, "Ignition. Five F-1 engines."],
  [10, "Liftoff. 7.6 million pounds of thrust."], [13, "Max-Q at 1 min 20 s. Peak aerodynamic stress."],
  [16.5, "First stage shuts down at 2 min 41 s and separates."], [24, "Second stage burning. Escape tower is gone."],
  [32, "Third stage takes over at 9 min 8 s."], [38, "Orbit at 11 min 40 s: 190 km up, 7.8 km/s."],
  [46, "The Earth turns 15 degrees every hour beneath us."], [58, "Translunar injection, 2 h 44 min. Third stage burns 5 min 47 s to 10.9 km/s."],
  [66, "Columbia separates, turns around and docks with Eagle."], [72, "Look back. That is every person you know."],
  [92, "Day 2. Earth is a marble. We are slowing as its gravity pulls back."], [101, "Day 3. The Moon's gravity now dominates."],
  [112, "Lunar orbit insertion at 75 h 50 min. 111 km above the surface."], [121, "Eagle undocks at 100 h 12 min. Collins stays in Columbia."],
  [124, "Powered descent, 102 h 33 min. Program alarms 1202 and 1201."], [131, "Armstrong takes manual control to clear a boulder field."],
  [136.5, "Contact light. Engine stop. About 25 seconds of fuel left."],
];

// ---------- procedural helpers ----------
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const blobs = (g, w, h, n, cols, a, b, op = 0.5) => {
  g.globalAlpha = op;
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.beginPath();
    g.ellipse(Math.random() * w, Math.random() * h, a + Math.random() * b, (a + Math.random() * b) * 0.7, Math.random() * 3, 0, 6.3); g.fill();
  }
  g.globalAlpha = 1;
};
const earthFallback = () => canvasTex(1024, 512, (g, w, h) => {
  g.fillStyle = "#17497f"; g.fillRect(0, 0, w, h);
  blobs(g, w, h, 70, ["#3f7a3a", "#7a6a3a", "#2f6a3a"], 10, 40, 0.8);
  g.fillStyle = "#eef4fa"; g.fillRect(0, 0, w, 16); g.fillRect(0, h - 24, w, 24);
});
const moonFallback = (w = 1024, h = 512) => canvasTex(w, h, (g) => {
  g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, w, h);
  blobs(g, w, h, 500, ["#777", "#999", "#6c6c6c", "#a4a4a4"], 2, 14, 0.5);
  blobs(g, w, h, 9, ["#4c4c4c"], w / 24, w / 16, 0.6);
  g.strokeStyle = "rgba(0,0,0,.25)";
  for (let i = 0; i < 120; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 14, 0, 6.3); g.stroke(); }
});
const radial = (stops) => canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, c]) => r.addColorStop(o, c)); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
const starField = (r) => {
  const p = new Float32Array(15000), col = new Float32Array(15000);
  for (let i = 0; i < 5000; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * 6.283, s = Math.sqrt(1 - u * u), b = 0.35 + Math.random() * 0.65;
    p.set([s * Math.cos(a) * r, u * r, s * Math.sin(a) * r], i * 3); col.set([b, b * (0.9 + Math.random() * 0.1), b * (0.8 + Math.random() * 0.2)], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ vertexColors: true, size: 1.6, sizeAttenuation: false, toneMapped: false, fog: false }));
};
// selenographic / geographic lat-lon -> local point on an equirectangular three.js sphere
const surf = (lat, lon, r) => {
  const la = THREE.MathUtils.degToRad(lat), phi = (0.5 + lon / 360) * Math.PI * 2;
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(la), Math.sin(la), Math.sin(phi) * Math.cos(la)).multiplyScalar(r);
};
const orb = (c, a, b, ang, r, o) => o.copy(a).multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang)).multiplyScalar(r).add(c);
const tang = (a, b, ang, o) => o.copy(a).multiplyScalar(-Math.sin(ang)).addScaledVector(b, Math.cos(ang));

const ATMO_VS = `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vW;
void main(){ vN = normalize(normalMatrix * normal); vW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
#include <logdepthbuf_vertex>
}`;
const ATMO_FS = `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSun; uniform float uK; varying vec3 vN; varying vec3 vW;
void main(){
#include <logdepthbuf_fragment>
  float rim = pow(clamp(-dot(normalize(vN), vec3(0.0, 0.0, 1.0)) * 5.7, 0.0, 1.0), 1.6);
  float lit = clamp(dot(normalize(vW), uSun) * 1.4 + 0.3, 0.0, 1.0);
  float a = rim * lit * uK;
  gl_FragColor = vec4(vec3(0.3, 0.58, 1.0) * a * 1.3, a);
}`;

export default function MoonMission() {
  const mount = useRef(null), S = useRef({}), act = useRef({});
  const [ui, setUi] = useState({ mode: "menu", label: "", met: "", dist: "", speed: "", line: "", fade: 0, flash: 0, glare: 0 });
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/sites/apollo11/media`).then((r) => (r.ok ? r.json() : [])).then((d) => setPhotos(d.slice(0, 6))).catch(() => {});
  }, []);

  useEffect(() => {
    const el = mount.current; let alive = true;
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const loader = new THREE.TextureLoader().setCrossOrigin("anonymous");
    const withTex = (mat, url, relief = 0) => loader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); mat.map = t;
      if (relief) { mat.bumpMap = t; mat.bumpScale = relief; }
      mat.needsUpdate = true;
    }, undefined, () => console.warn("texture failed, using procedural fallback:", url));
    const loadFirst = (urls, ok) => { if (!urls.length || !alive) return; loader.load(urls[0], ok, undefined, () => loadFirst(urls.slice(1), ok)); };
    const asp = () => el.clientWidth / el.clientHeight;
    const disk = radial([[0, "#fff"], [0.9, "#fff"], [1, "rgba(255,255,255,0)"]]);
    const soft = radial([[0, "rgba(255,255,255,1)"], [0.12, "rgba(255,240,210,.55)"], [0.4, "rgba(255,225,170,.12)"], [1, "rgba(255,220,160,0)"]]);
    // The Sun: a small, hard, white disk at its real angular size (0.53 deg) plus a faint lens halo.
    const mkSun = (d, halo, op) => {
      const g = new THREE.Group();
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: 0xffe6b0, blending: THREE.AdditiveBlending, transparent: true, opacity: op, depthWrite: false, toneMapped: false }));
      h.scale.setScalar(halo);
      const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: disk, color: 0xfffbe8, transparent: true, depthWrite: false, toneMapped: false }));
      c.scale.setScalar(d * 0.00926); g.add(h, c); return g;
    };

    // ================= SPACE SCENE (real sizes and distances) =================
    const space = new THREE.Scene(); const stars1 = starField(1500); space.add(stars1);
    const cam1 = new THREE.PerspectiveCamera(70, asp(), 1e-5, 3000);
    const sl = new THREE.DirectionalLight(0xffffff, 2.6); sl.position.copy(SUN).multiplyScalar(100);
    space.add(sl, new THREE.AmbientLight(0x0a0f18, 0.6));
    const sunA = mkSun(1200, 90, 0.7); space.add(sunA);

    const earthMat = new THREE.MeshStandardMaterial({ map: earthFallback(), roughness: 0.9, metalness: 0 });
    resolveMap("earth").then((u) => { if (u && alive) withTex(earthMat, u); });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R_E, 128, 96), earthMat);
    const kv = surf(KSC[0], KSC[1], 1), earthBase = Math.atan2(kv.z, kv.x); // Florida faces +x at t=0
    const cloudMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false, roughness: 1 });
    loadFirst(BASE.map((b) => b + "earth_clouds_1024.png"), (t) => { t.colorSpace = THREE.SRGBColorSpace; cloudMat.map = t; cloudMat.opacity = 0.9; cloudMat.needsUpdate = true; });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(R_E * 1.004, 96, 64), cloudMat);
    const atmoMat = new THREE.ShaderMaterial({ uniforms: { uSun: { value: SUN.clone() }, uK: { value: 1 } }, vertexShader: ATMO_VS, fragmentShader: ATMO_FS, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R_E * 1.0155, 96, 64), atmoMat);

    const moonMat = new THREE.MeshStandardMaterial({ map: moonFallback(), color: 0xd0d0d0, roughness: 1 });
    resolveMap("moon").then((u) => { if (u && alive) withTex(moonMat, u, 1.5); });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(R_M, 128, 96), moonMat);
    moon.position.set(DIST, 0, 0); moon.rotation.y = Math.PI; space.add(earth, clouds, atmo, moon);
    moon.updateMatrixWorld(true);
    const M = moon.position, ZERO = V(), N0 = V(Math.cos(THREE.MathUtils.degToRad(KSC[0])), Math.sin(THREE.MathUtils.degToRad(KSC[0])), 0), E = V(0, 0, -1);
    const P = moon.localToWorld(surf(LAT, LON, R_M)), n = P.clone().sub(M).normalize();
    const w = V().crossVectors(n, V(0, 1, 0)).normalize(), L = V().crossVectors(n, w);

    // launch pad: real scale (group scale 1e-6 => 1 unit = 1 m)
    const pad = new THREE.Group(); pad.scale.setScalar(1e-6); pad.position.copy(N0).multiplyScalar(R_E); pad.quaternion.setFromUnitVectors(V(0, 1, 0), N0);
    const concrete = new THREE.MeshStandardMaterial({ color: 0x777b80, roughness: 1 });
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(400, 400, 2, 48), concrete); slab.position.y = -0.5;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(18, 110, 18), new THREE.MeshStandardMaterial({ color: 0xb04a3a, roughness: 0.8 })); tower.position.set(45, 55, 0);
    const tower2 = tower.clone(); tower2.position.set(-60, 55, 70); tower2.scale.y = 0.7;
    const sp = new Float32Array(1200); for (let i = 0; i < 400; i++) sp.set([(Math.random() - 0.5) * 300, Math.random() * 60, (Math.random() - 0.5) * 300], i * 3);
    const sg0 = new THREE.BufferGeometry(); sg0.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const smoke = new THREE.Points(sg0, new THREE.PointsMaterial({ map: soft, size: 70, color: 0xdddddd, transparent: true, opacity: 0.5, depthWrite: false }));
    pad.add(slab, tower, tower2, smoke); space.add(pad);

    // ================= SURFACE SCENE (meters, 1.62 m/s2) =================
    const sg = new THREE.Scene(); const stars2 = starField(4000); sg.add(stars2);
    const cam2 = new THREE.PerspectiveCamera(70, asp(), 0.05, 6000);
    const sun2 = new THREE.DirectionalLight(0xffffff, 2.8); sun2.castShadow = true;
    sun2.shadow.mapSize.set(2048, 2048); Object.assign(sun2.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 400 });
    sun2.shadow.bias = -0.0005; sun2.shadow.normalBias = 0.05;
    sg.add(sun2, sun2.target, new THREE.AmbientLight(0x202428, 0.18));
    const sunB = mkSun(3500, 260, 0.25); sg.add(sunB);
    const craters = [[40, -60, 14], [-70, 30, 20], [90, 70, 26], [-30, -120, 30], [140, -40, 18], [-120, -90, 22]];
    const groundH = (x, z) => {
      const k = clamp((Math.hypot(x, z) - 25) / 40);
      let h = k * (0.9 * Math.sin(x * 0.045) * Math.cos(z * 0.037) + 0.25 * Math.sin(x * 0.21 + z * 0.17) + 0.12 * Math.sin(x * 0.6) * Math.sin(z * 0.5));
      for (const [cx, cz, s] of craters) h -= 2.4 * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));
      return h;
    };
    const rego = moonFallback(512, 512); rego.wrapS = rego.wrapT = THREE.RepeatWrapping; rego.repeat.set(70, 70);
    const gg = new THREE.PlaneGeometry(700, 700, 180, 180); gg.rotateX(-Math.PI / 2);
    const gp = gg.attributes.position; for (let i = 0; i < gp.count; i++) gp.setY(i, groundH(gp.getX(i), gp.getZ(i)));
    gg.computeVertexNormals();
    const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: rego, bumpMap: rego, bumpScale: 3, color: 0x8a8a8a, roughness: 1 })); ground.receiveShadow = true; sg.add(ground);
    // Earth in the lunar sky: ~1.9 deg wide, lit by the same Sun, so it shows its real phase
    const eg = new THREE.Group(), em = new THREE.Mesh(new THREE.SphereGeometry(15, 48, 32), earthMat), sl0 = surf(0, 10, 1);
    em.rotation.y = Math.atan2(-sl0.x, sl0.z); eg.add(em); eg.position.copy(EDIR).multiplyScalar(900); eg.lookAt(0, 0, 0); sg.add(eg);
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 1 }), 240), d = new THREE.Object3D();
    for (let i = 0; i < 240; i++) {
      const a = Math.random() * 6.283, r = 6 + Math.random() * 240, s = 0.1 + Math.random() * 0.7;
      d.position.set(Math.cos(a) * r, groundH(Math.cos(a) * r, Math.sin(a) * r) + s * 0.3, Math.sin(a) * r);
      d.scale.set(s, s * 0.7, s); d.rotation.set(Math.random(), Math.random(), 0); d.updateMatrix(); rocks.setMatrixAt(i, d.matrix);
    }
    rocks.castShadow = rocks.receiveShadow = true; sg.add(rocks);
    const lm = new THREE.Group(), foil = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.7, roughness: 0.35 }), grey = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.6 });
    const desc = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.4, 1.6, 8), foil); desc.position.y = 2.2;
    const asc = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 2.3, 10), grey); asc.position.y = 4.2;
    lm.add(desc, asc);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4, p0 = V(Math.cos(a) * 0.9, 2.2, Math.sin(a) * 0.9), p1 = V(Math.cos(a) * 3.4, 0.05, Math.sin(a) * 3.4);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), grey); leg.position.copy(p0).add(p1).multiplyScalar(0.5);
      leg.scale.y = p0.distanceTo(p1); leg.quaternion.setFromUnitVectors(V(0, 1, 0), p1.clone().sub(p0).normalize());
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12), foil); foot.position.copy(p1); lm.add(leg, foot);
    }
    lm.position.y = groundH(0, 0); lm.traverse((o) => { o.castShadow = true; o.receiveShadow = true; }); sg.add(lm);
    const flagTex = canvasTex(150, 100, (g, w2, h) => { for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? "#f2f2f2" : "#b22234"; g.fillRect(0, (i * h) / 13, w2, h / 13 + 1); } g.fillStyle = "#3c3b6e"; g.fillRect(0, 0, w2 * 0.4, h * 0.54); });
    const flag = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), grey), cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 1 }));
    pole.position.y = 1.2; cloth.position.set(0.75, 1.85, 0); flag.add(pole, cloth); flag.position.set(9, groundH(9, -4), -4);
    flag.traverse((o) => { o.castShadow = true; }); sg.add(flag);
    const suit = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 }), visorM = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 1, roughness: 0.12 });
    const astro = new THREE.Group(), part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
    astro.add(part(new THREE.CapsuleGeometry(0.24, 0.55, 4, 10), suit, 0, 1.15, 0), part(new THREE.CylinderGeometry(0.1, 0.09, 0.8, 8), suit, -0.12, 0.4, 0), part(new THREE.CylinderGeometry(0.1, 0.09, 0.8, 8), suit, 0.12, 0.4, 0),
      part(new THREE.SphereGeometry(0.22, 16, 12), suit, 0, 1.72, 0), part(new THREE.SphereGeometry(0.2, 16, 12), visorM, 0, 1.72, 0.06), part(new THREE.BoxGeometry(0.4, 0.6, 0.25), suit, 0, 1.2, -0.3));
    astro.position.set(3.5, groundH(3.5, 5), 5); astro.rotation.y = 2.4; astro.traverse((o) => { o.castShadow = true; }); sg.add(astro);

    // ================= state, audio, input =================
    const s = S.current;
    Object.assign(s, { mode: "menu", t: 0, tS: 0, yaw: 0, pitch: 0, sy: 0.72, vx: 0, vz: 0, vy: 0, onGround: true, keys: {}, drag: false, q: new THREE.Quaternion(), ready: false });
    s.px = 7; s.pz = 8; s.py = groundH(7, 8) + 1.7;
    let actx, rumble;
    act.current.start = () => {
      s.mode = "space"; s.t = 0;
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); const b = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate), ch = b.getChannelData(0); let l = 0;
        for (let i = 0; i < ch.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; ch[i] = l * 3.5; }
        const src = actx.createBufferSource(); src.buffer = b; src.loop = true; const f = actx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 140; rumble = actx.createGain(); rumble.gain.value = 0;
        src.connect(f); f.connect(rumble); rumble.connect(actx.destination); src.start(); } catch { /* audio optional */ }
    };
    act.current.skip = () => { s.mode = "surface"; s.tS = 0; };
    const onKey = (e, v) => { s.keys[e.code] = v; if (e.code === "Space" && s.mode === "surface") e.preventDefault(); };
    const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
    const pd = () => { if (s.mode === "surface") renderer.domElement.requestPointerLock?.(); else s.drag = true; };
    const pu = () => { s.drag = false; };
    const pm = (e) => {
      if (s.mode === "surface" && document.pointerLockElement) { s.sy -= e.movementX * 0.0022; s.pitch = clamp(s.pitch - e.movementY * 0.0022, -1.4, 1.4); }
      else if (s.mode === "space" && s.drag) { s.yaw = clamp(s.yaw - e.movementX * 0.004, -2.5, 2.5); s.pitch = clamp(s.pitch - e.movementY * 0.004, -1.3, 1.3); }
    };
    renderer.domElement.addEventListener("pointerdown", pd); addEventListener("pointerup", pu); addEventListener("pointermove", pm); addEventListener("keydown", kd); addEventListener("keyup", ku);
    const onResize = () => { renderer.setSize(el.clientWidth, el.clientHeight); cam1.aspect = cam2.aspect = asp(); cam1.updateProjectionMatrix(); cam2.updateProjectionMatrix(); };
    addEventListener("resize", onResize);

    // ================= mission timeline =================
    // 0-10 pad | 10-38 ascent | 38-58 parking orbit | 58-112 translunar coast | 112-124 lunar orbit | 124-140 powered descent
    const pos = V(), fwd = V(), rad = V(), dir = V(), up = V(), back = V(), toMoon = V(), tmp = V(), mat = new THREE.Matrix4();
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion(), tq = new THREE.Quaternion();
    const Qof = (dv, uv, out) => out.setFromRotationMatrix(mat.lookAt(ZERO, dv, uv));
    const QP = orb(ZERO, N0, E, TH_TLI, R_PARK, V()), QT = tang(N0, E, TH_TLI, V()), P1 = QP.clone().addScaledVector(QT, 70);
    const A = orb(M, n, w, -1.5 * Math.PI, R_LUN, V()), D1 = P1.clone().sub(QP), D2 = A.clone().sub(P1);
    const bez = (u, o) => o.copy(QP).multiplyScalar((1 - u) ** 2).addScaledVector(P1, 2 * u * (1 - u)).addScaledVector(A, u * u);
    const dbez = (u, o) => o.copy(D1).multiplyScalar(2 * (1 - u)).addScaledVector(D2, 2 * u);

    const spaceStep = (dt) => {
      const t = s.t;
      if (t < 38) {
        const k = clamp((t - 10) / 28), ang = 0.35 * k * k, r = R_E + 1e-4 + 0.19 * Math.pow(k, 2.2), e = ease(k);
        orb(ZERO, N0, E, ang, r, pos); tang(N0, E, ang, fwd); rad.copy(pos).normalize();
        dir.copy(rad).multiplyScalar(1 - e).addScaledVector(fwd, e).normalize();           // pitch-over: up -> downrange
        up.copy(rad).multiplyScalar(e).addScaledVector(fwd, -(1 - e));
        Qof(dir, up, tq);
      } else if (t < 58) {
        const ang = 0.35 + (TH_TLI - 0.35) * clamp((t - 38) / 20);
        orb(ZERO, N0, E, ang, R_PARK, pos); tang(N0, E, ang, fwd); rad.copy(pos).normalize();
        dir.copy(fwd).multiplyScalar(0.92).addScaledVector(rad, -0.38).normalize(); Qof(dir, rad, tq);
      } else if (t < 112) {
        const k = (t - 58) / 54, u = 1 - Math.pow(1 - k, 1.4);
        bez(u, pos); dbez(u, fwd).normalize(); back.copy(pos).negate().normalize(); toMoon.copy(M).sub(pos).normalize();
        Qof(fwd, V(0, 1, 0), qa); Qof(back, V(0, 1, 0), qb); Qof(toMoon, V(0, 1, 0), qc);
        tq.copy(qa).slerp(qb, ease(clamp((t - 63) / 6))).slerp(qc, ease(clamp((t - 100) / 10)));
      } else if (t < 124) {
        const psi = -1.5 * Math.PI + 1.5 * Math.PI * clamp((t - 112) / 12);
        orb(M, n, w, psi, R_LUN, pos); tang(n, w, psi, fwd); toMoon.copy(M).sub(pos).normalize();
        dir.copy(toMoon).multiplyScalar(0.7).addScaledVector(fwd, 0.7).normalize(); Qof(dir, L, tq);
      } else {
        const k = clamp((t - 124) / 16), h = (R_LUN - R_M) * (1 - k) * (1 - k) + 3e-6;
        pos.copy(P).addScaledVector(n, h);
        dir.copy(n).multiplyScalar(-(0.6 + 0.4 * k)).addScaledVector(w, 0.8 * (1 - k)).normalize(); Qof(dir, L, tq);
      }
      if (!s.ready) { s.q.copy(tq); s.ready = true; } else s.q.slerp(tq, 1 - Math.exp(-dt * 4));
      cam1.position.copy(pos); cam1.quaternion.copy(s.q); cam1.rotateY(s.yaw); cam1.rotateX(s.pitch);
      const amp = (t > 7 && t < 38 ? (t < 24 ? 1 : clamp((38 - t) / 14)) : t > 58 && t < 62 ? 0.35 : 0) * 0.012;
      cam1.rotateX((Math.random() - 0.5) * amp); cam1.rotateZ((Math.random() - 0.5) * amp);
      const m = met(t); earth.rotation.y = earthBase + 7.2921e-5 * Math.max(0, m); clouds.rotation.y = earth.rotation.y + 2e-5 * Math.max(0, m);
      smoke.scale.setScalar(1 + Math.max(0, t - 10) * 0.2); smoke.material.opacity = t < 10 ? 0.3 : 0.5 * clamp(1 - (t - 10) / 18);
      const alt = pos.length() - R_E; atmoMat.uniforms.uK.value = alt < R_E * 0.0155 ? 1 - ease(clamp(alt / 0.08)) : 1; // daytime sky only inside the air
      stars1.position.copy(cam1.position); sunA.position.copy(cam1.position).addScaledVector(SUN, 1200);
      if (rumble) rumble.gain.value = t < 7 ? 0.05 : t < 10 ? 0.2 : t < 38 ? 0.1 + 0.5 * clamp((38 - t) / 14) : t > 58 && t < 62 ? 0.2 : 0;
    };
    const surfaceStep = (dt) => {
      const k = s.keys, spd = k.ShiftLeft ? 7 : 3.5, f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), sn = Math.sin(s.sy), cs = Math.cos(s.sy);
      s.vx += (-sn * f * spd + cs * r * spd - s.vx) * Math.min(1, dt * 2.5); s.vz += (-cs * f * spd - sn * r * spd - s.vz) * Math.min(1, dt * 2.5);
      s.px += s.vx * dt; s.pz += s.vz * dt;
      if (k.Space && s.onGround) { s.vy = 3.4; s.onGround = false; }
      s.vy -= 1.62 * dt; s.py += s.vy * dt;
      const gh = groundH(s.px, s.pz) + 1.7; if (s.py <= gh) { s.py = gh; s.vy = 0; s.onGround = true; }
      cam2.position.set(s.px, s.py, s.pz); cam2.rotation.set(s.pitch, s.sy, 0, "YXZ");
      sun2.position.copy(cam2.position).addScaledVector(SUNL, 150); sun2.target.position.copy(cam2.position); sun2.target.updateMatrixWorld();
      stars2.position.copy(cam2.position); sunB.position.copy(cam2.position).addScaledVector(SUNL, 3500);
    };

    const clock = new THREE.Clock(); let acc = 0;
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05); acc += dt;
      if (s.mode === "space") { s.t += dt; if (s.t >= 140) { s.mode = "surface"; s.tS = 0; } }
      if (s.mode === "surface") { s.tS += dt; if (rumble) rumble.gain.value = 0; surfaceStep(dt); renderer.render(sg, cam2); }
      else { if (s.mode === "menu") s.t = 0; spaceStep(dt); renderer.render(space, cam1); }
      if (acc > 0.15) {
        acc = 0; const t = s.t, surfM = s.mode === "surface", m = met(t);
        const line = surfM ? (s.tS < 6 ? "Houston, Tranquility Base here. The Eagle has landed." : s.tS < 16 ? "6 h 39 min later: “That’s one small step for man, one giant leap for mankind.” Neil Armstrong, 20 July 1969." : "")
          : (LINES.filter(([a]) => t >= a && t < a + 7).pop() || [0, ""])[1];
        const rE = pos.length() * 1000, rM = pos.distanceTo(M) * 1000; let v = 0;   // km
        if (!surfM && t >= 10) {
          if (t < 38) v = 7.79 * Math.pow(clamp((t - 10) / 28), 1.6);
          else if (t < 58) v = 7.79;
          else if (t < 101) v = 7.79 + (Math.sqrt(398600 * (2 / rE - 1 / 203280)) - 7.79) * clamp((t - 58) / 3);   // vis-viva, Earth-centred
          else if (t < 112) v = Math.sqrt(0.64 + 9805.6 / rM);                                                        // Moon-centred approach
          else if (t < 124) v = Math.sqrt(4902.8 / rM);
          else v = 1.63 * Math.pow(1 - clamp((t - 124) / 16), 1.2);
        }
        const cam = surfM ? cam2 : cam1; cam.getWorldDirection(tmp); const glare = clamp((tmp.dot(surfM ? SUNL : SUN) - 0.97) / 0.03);
        setUi({ mode: s.mode,
          label: surfM ? "Tranquility Base, Mare Tranquillitatis" : t < 10 ? "Launch Complex 39A, Kennedy Space Center" : t < 38 ? "Saturn V ascent" : t < 58 ? "Earth parking orbit, 190 km" : t < 101 ? "Translunar coast" : t < 112 ? "Approaching the Moon" : t < 124 ? "Lunar orbit, 111 km" : "Powered descent",
          met: surfM ? `MET ${fmt(s.tS < 6 ? 369940 + s.tS : 392660 + s.tS)}` : t < 10 ? `T-${Math.ceil(10 - t)} s` : `MET ${fmt(m)}`,
          dist: surfM ? "Sun 11° above horizon · gravity 1.62 m/s²" : t < 58 ? `Altitude ${Math.max(0, Math.round(rE - 6371)).toLocaleString()} km` : `Earth ${Math.round(rE).toLocaleString()} km · Moon ${Math.max(0, Math.round(rM - 1737)).toLocaleString()} km`,
          speed: v > 0 ? `${v.toFixed(2)} km/s` : "", line,
          fade: surfM ? 1 - clamp(s.tS / 3) : clamp((t - 136) / 4),
          flash: s.mode === "space" ? (t > 9.5 && t < 13 ? 1 - (t - 9.5) / 3.5 : t > 58 && t < 62 ? 0.6 * (1 - (t - 58) / 4) : 0) : 0, glare });
      }
    });
    return () => {
      alive = false; renderer.setAnimationLoop(null); renderer.dispose(); el.removeChild(renderer.domElement); actx?.close?.();
      renderer.domElement.removeEventListener("pointerdown", pd);
      removeEventListener("pointerup", pu); removeEventListener("pointermove", pm); removeEventListener("keydown", kd); removeEventListener("keyup", ku); removeEventListener("resize", onResize);
    };
  }, []);

  const surface = ui.mode === "surface";
  return (
    <div className="mm">
      <style>{css}</style>
      <div ref={mount} className="mm-stage" />
      {!surface && ui.mode !== "menu" && <div className="mm-window" />}
      <div className="mm-glare" style={{ opacity: ui.glare * 0.7 }} />
      <div className="mm-fade" style={{ opacity: ui.fade }} />
      <div className="mm-flash" style={{ opacity: ui.flash * 0.55 }} />
      {ui.mode === "menu" && (
        <div className="mm-menu">
          <h1>Apollo 11: launch to Tranquility Base</h1>
          <p>You are strapped into the capsule on Pad 39A, 16 July 1969. Earth-Moon distances, body sizes, the Sun, the flight timeline and the landing site follow the real mission. Drag to look out the window. On the Moon, click to look, WASD to walk, Space to jump.</p>
          <button onClick={() => act.current.start()}>Board the spacecraft</button>
          <button className="ghost" onClick={() => act.current.skip()}>Skip to the Moon walk</button>
        </div>
      )}
      {ui.mode !== "menu" && (
        <>
          <div className="mm-hud"><b>{ui.label}</b><span>{ui.met}</span><span>{ui.dist}</span>{ui.speed && <span>{ui.speed}</span>}</div>
          {ui.line && <div className="mm-line">{ui.line}</div>}
          {surface && <div className="mm-help">Click to look around. WASD walk, Shift run, Space jump.</div>}
        </>
      )}
      {photos.length > 0 && ui.mode !== "menu" && (
        <div className="mm-photos" aria-label="NASA archive photos">
          {photos.map((p) => <a key={p.nasa_id} href={`https://images.nasa.gov/details/${p.nasa_id}`} target="_blank" rel="noreferrer" title={p.title}><img src={p.image} alt={p.title} loading="lazy" /></a>)}
        </div>
      )}
    </div>
  );
}

const css = `
.mm{position:relative;width:100%;height:100vh;background:#04060a;color:#e8edf3;font-family:"Avenir Next","Segoe UI",system-ui,sans-serif;overflow:hidden}
.mm-stage,.mm-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.mm-window{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 62% 66% at 50% 48%,transparent 62%,#0a0d12 63.5%,#06080c 100%);box-shadow:inset 0 -90px 120px #000a}
.mm-fade{position:absolute;inset:0;background:#000;pointer-events:none}
.mm-flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 100%,#ffb35a,transparent 70%);pointer-events:none;mix-blend-mode:screen}
.mm-glare{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,#fffbe8 0,#fff6d8 12%,transparent 60%);pointer-events:none;mix-blend-mode:screen}
.mm-menu{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:0 8vw;max-width:640px;background:linear-gradient(90deg,#04060aee,#04060a00)}
.mm-menu h1{font-size:clamp(28px,4.4vw,52px);line-height:1.05;margin:0;font-weight:600;letter-spacing:-.02em}
.mm-menu p{margin:0;line-height:1.55;color:#aeb8c4;max-width:46ch}
.mm button{align-self:flex-start;font:inherit;font-weight:600;padding:12px 22px;border-radius:4px;border:1px solid #f2b04a;background:#f2b04a;color:#10131a;cursor:pointer}
.mm button.ghost{background:transparent;color:#e8edf3;border-color:#3b4655}
.mm button:focus-visible,.mm a:focus-visible{outline:2px solid #fff;outline-offset:2px}
.mm-hud{position:absolute;top:20px;left:24px;display:flex;flex-direction:column;gap:4px;font-variant-numeric:tabular-nums;text-shadow:0 1px 6px #000}
.mm-hud b{font-size:15px;font-weight:600}.mm-hud span{color:#f2b04a;font-size:14px}
.mm-line{position:absolute;left:50%;bottom:9vh;transform:translateX(-50%);max-width:min(70ch,86vw);text-align:center;font-size:clamp(16px,2vw,21px);line-height:1.4;text-shadow:0 2px 10px #000}
.mm-help{position:absolute;left:24px;bottom:20px;color:#9aa6b4;font-size:13px}
.mm-photos{position:absolute;top:20px;right:20px;display:grid;grid-template-columns:repeat(3,64px);gap:6px}
.mm-photos img{width:64px;height:64px;object-fit:cover;border-radius:3px;border:1px solid #2a323d;display:block}
@media (max-width:600px){.mm-photos{display:none}}
@media (prefers-reduced-motion:reduce){.mm-flash,.mm-glare{display:none}}
`;