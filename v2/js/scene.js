// scene.js — dark cinematic particle journey (Three.js + UnrealBloom, all vendored)
// Particles are the star: additive soft-glow point sprites, ~tens of thousands, bloomed.
import * as THREE from 'three';
import { RoomEnvironment } from '../lib/RoomEnvironment.js';
import { EffectComposer } from '../lib/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../lib/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../lib/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../lib/jsm/postprocessing/OutputPass.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);
const rand = (a, b) => a + Math.random() * (b - a);

// shared simplex noise (Ashima) for shimmer
const SNOISE = /* glsl */`
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod(i,289.0);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=1.0/7.0;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.12, 'rgba(255,255,255,0.62)');
  grd.addColorStop(0.32, 'rgba(255,255,255,0.14)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.03)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function initScene(canvas, opts = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(max-width: 760px)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.4 : 2);
  const CT = (n) => Math.round(n * (isMobile ? 0.4 : 1));    // particle-count scaler
  const GLOW = glowTexture();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const bgColor = new THREE.Color('#06060a');
  scene.background = bgColor;
  scene.fog = new THREE.FogExp2(0x06060a, 0.058);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
  camera.position.set(0, 0, 10);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.add(new THREE.AmbientLight(0x334455, 0.6));
  const key = new THREE.DirectionalLight(0xbfd4ff, 1.4); key.position.set(4, 6, 6); scene.add(key);

  // ---------- glow-points material ----------
  function glowMat(color, size) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uPixel: { value: DPR }, uSize: { value: size || 26 },
        uColor: { value: new THREE.Color(color) }, uTex: { value: GLOW }, uBright: { value: 1 },
        uShimmer: { value: 0.16 },
      },
      vertexShader: SNOISE + /* glsl */`
        uniform float uTime,uPixel,uSize,uShimmer; attribute float aScale,aRnd;
        varying float vA,vFade;
        void main(){
          vec3 p=position;
          float n=snoise(p*0.3+vec3(0.0,uTime*0.06,aRnd*4.0));
          p+=normalize(p+0.0001)*n*uShimmer;
          vec4 mv=modelViewMatrix*vec4(p,1.0);
          gl_Position=projectionMatrix*mv;
          float d=-mv.z;
          vFade=smoothstep(1.0,7.0,d)*(1.0-smoothstep(20.0,38.0,d)); // hide distant stations
          gl_PointSize=uSize*aScale*uPixel*(12.0/-mv.z);
          vA=aScale;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform sampler2D uTex; uniform float uBright; varying float vA,vFade;
        void main(){ float a=texture2D(uTex,gl_PointCoord).a; if(a<0.01)discard;
          gl_FragColor=vec4(uColor,1.0)*a*uBright*(0.12+0.88*vA)*vFade; }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
  }

  function pointsGeo(positions, scales, rnds) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnds, 1));
    return g;
  }

  function darkGlass(tint) {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(tint || '#0b0b14'), metalness: 0, roughness: 0.12,
      transmission: 1, thickness: 2.4, ior: 1.35, attenuationColor: new THREE.Color('#1a1024'),
      attenuationDistance: 1.4, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [120, 500],
      clearcoat: 1, clearcoatRoughness: 0.25, envMapIntensity: 1.2, transparent: true, opacity: 0.92,
    });
  }

  const spin = [], custom = [], matsWithTime = [];      // animated collections

  // ---------- stations ----------
  const Z = 30;
  const defs = [
    { z: 0,        accent: '#eaf2ff', bg: '#07070c' },   // S1 nebula (white)
    { z: -Z,       accent: '#4fe3ff', bg: '#04090f' },   // S2 neural (cyan)
    { z: -2 * Z,   accent: '#ffb463', bg: '#0c0805' },   // S3 language (amber)
    { z: -3 * Z,   accent: '#b98cff', bg: '#0a0710' },   // S4 multimodal (violet)
    { z: -4 * Z,   accent: '#57ff9c', bg: '#04100a' },   // S5 tunnel (green)
    { z: -5.3 * Z, accent: '#dfe7ff', bg: '#07070d' },   // S6 outro (white)
  ];
  const N = defs.length;
  const bgColors = defs.map((d) => new THREE.Color(d.bg));
  const stations = defs.map((d) => { const g = new THREE.Group(); g.position.z = d.z; scene.add(g); return { group: g, def: d }; });

  // ===== S1 — nebula swirl =====
  (function () {
    const n = CT(11000), pos = new Float32Array(n * 3), sc = new Float32Array(n), rn = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      let r = 2.2 * Math.pow(Math.random(), 0.55);
      if (Math.random() < 0.12) r += Math.random() * 3.2;      // flung sparks
      pos[i * 3] = s * Math.cos(th) * r * 1.15;
      pos[i * 3 + 1] = u * r * 0.9;
      pos[i * 3 + 2] = s * Math.sin(th) * r;
      sc[i] = Math.pow(Math.random(), 3.4) * 3.0 + 0.22;       // mostly tiny, a few bright cores
      rn[i] = Math.random();
    }
    const m = glowMat('#eaf2ff', 9); m.uniforms.uShimmer.value = 0.28; m.uniforms.uBright.value = 0.62;
    const pts = new THREE.Points(pointsGeo(pos, sc, rn), m);
    stations[0].group.add(pts); matsWithTime.push(m);
    spin.push({ o: pts, sy: 0.08, sx: 0.015 });
  })();

  // ===== S2 — neural constellation + growing links =====
  (function () {
    const NODES = 40, nodeC = [];
    for (let i = 0; i < NODES; i++) nodeC.push(new THREE.Vector3(rand(-3.4, 3.4), rand(-2.4, 2.4), rand(-2.4, 2.4)));
    const per = Math.floor(CT(9000) / NODES), n = per * NODES;
    const pos = new Float32Array(n * 3), sc = new Float32Array(n), rn = new Float32Array(n);
    let k = 0;
    for (let a = 0; a < NODES; a++) for (let b = 0; b < per; b++) {
      const c = nodeC[a], rr = Math.pow(Math.random(), 2) * 0.5;
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, ss = Math.sqrt(1 - u * u);
      pos[k * 3] = c.x + ss * Math.cos(th) * rr; pos[k * 3 + 1] = c.y + u * rr; pos[k * 3 + 2] = c.z + ss * Math.sin(th) * rr;
      sc[k] = (b === 0 ? 3.2 : Math.pow(Math.random(), 2) * 1.2 + 0.3); rn[k] = Math.random(); k++;
    }
    const m = glowMat('#7fe9ff', 11); m.uniforms.uShimmer.value = 0.05; m.uniforms.uBright.value = 0.7;
    const pts = new THREE.Points(pointsGeo(pos, sc, rn), m);
    stations[1].group.add(pts); matsWithTime.push(m);
    spin.push({ o: pts, sy: 0.03, sx: 0.02 });
    // links
    const segs = [];
    for (let a = 0; a < NODES; a++) {
      const dists = nodeC.map((c, j) => ({ j, d: nodeC[a].distanceTo(c) })).filter((o) => o.j !== a).sort((p, q) => p.d - q.d);
      for (let t = 0; t < 2; t++) { const c = nodeC[dists[t].j]; segs.push(nodeC[a].x, nodeC[a].y, nodeC[a].z, c.x, c.y, c.z); }
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
    const lm = new THREE.LineBasicMaterial({ color: new THREE.Color('#3fd0ff'), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(lg, lm); lines.geometry.setDrawRange(0, 0);
    stations[1].group.add(lines);
    custom.push({ t: 'grow', lines, total: segs.length / 3 });
  })();

  // ===== S3 — language token flow =====
  (function () {
    const n = CT(12000), aT = new Float32Array(n), aOff = new Float32Array(n), sc = new Float32Array(n), rn = new Float32Array(n);
    for (let i = 0; i < n; i++) { aT[i] = Math.random(); aOff[i] = Math.random() * 6.28; sc[i] = Math.pow(Math.random(), 2) * 1.6 + 0.3; rn[i] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); // filled in shader
    g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
    g.setAttribute('aOff', new THREE.BufferAttribute(aOff, 1));
    g.setAttribute('aScale', new THREE.BufferAttribute(sc, 1));
    g.setAttribute('aRnd', new THREE.BufferAttribute(rn, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixel: { value: DPR }, uSize: { value: 12 }, uColor: { value: new THREE.Color('#ffc07a') }, uTex: { value: GLOW }, uBright: { value: 0.7 }, uSpeed: { value: 0.05 } },
      vertexShader: /* glsl */`
        uniform float uTime,uPixel,uSize,uSpeed; attribute float aT,aOff,aScale; varying float vA,vFade;
        void main(){
          float t=fract(aT+uTime*uSpeed);
          float x=(t-0.5)*20.0;
          float y=sin(t*8.0+aOff)*1.5 + cos(aOff)*0.5;
          float z=cos(t*6.0+aOff*1.7)*1.4;
          vec3 p=vec3(x,y,z);
          vec4 mv=modelViewMatrix*vec4(p,1.0);
          gl_Position=projectionMatrix*mv;
          float d=-mv.z; vFade=smoothstep(1.0,7.0,d)*(1.0-smoothstep(20.0,38.0,d));
          gl_PointSize=uSize*aScale*uPixel*(12.0/-mv.z);
          vA=aScale*smoothstep(0.0,0.08,t)*smoothstep(1.0,0.9,t);
        }`,
      fragmentShader: /* glsl */`uniform vec3 uColor;uniform sampler2D uTex;uniform float uBright;varying float vA,vFade;
        void main(){float a=texture2D(uTex,gl_PointCoord).a;if(a<0.01)discard;gl_FragColor=vec4(uColor,1.0)*a*uBright*(0.12+0.88*vA)*vFade;}`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false;
    stations[2].group.add(pts); matsWithTime.push(m);
  })();

  // ===== S4 — dark iridescent glass panels + violet dust =====
  (function () {
    function roundedRect(w, h, r) {
      const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return new THREE.ShapeGeometry(s, 12);
    }
    const specs = [[3.6, 4.6, -1.4, 0.3, -0.5, 0.2], [3.0, 3.8, 2.6, -0.6, -1.4, -0.24], [2.4, 3.0, 0.7, 1.9, -2.8, 0.12]];
    const eCols = ['#3a1c6e', '#123a5e', '#5e1f52'];
    specs.forEach((s, i) => {
      const pm = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#140b24'), metalness: 0.25, roughness: 0.16,
        transmission: 0.55, thickness: 1.6, ior: 1.5, iridescence: 1, iridescenceIOR: 2.0,
        iridescenceThicknessRange: [200, 760], emissive: new THREE.Color(eCols[i]), emissiveIntensity: 0.55,
        clearcoat: 1, clearcoatRoughness: 0.2, envMapIntensity: 2.8, transparent: true, opacity: 0.66, side: THREE.DoubleSide });
      const p = new THREE.Mesh(roundedRect(s[0], s[1], 0.35), pm);
      p.position.set(s[2], s[3], s[4]); p.rotation.y = s[5]; p.rotation.z = i * 0.05;
      stations[3].group.add(p); spin.push({ o: p, sy: 0.02, sx: 0, drift: true });
    });
    const n = CT(7000), pos = new Float32Array(n * 3), sc = new Float32Array(n), rn = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = rand(-5, 5); pos[i * 3 + 1] = rand(-4, 4); pos[i * 3 + 2] = rand(-4, 3);
      sc[i] = Math.pow(Math.random(), 2) * 1.4 + 0.25; rn[i] = Math.random(); }
    const m = glowMat('#c79bff', 10); m.uniforms.uShimmer.value = 0.2; m.uniforms.uBright.value = 0.55;
    const pts = new THREE.Points(pointsGeo(pos, sc, rn), m); stations[3].group.add(pts); matsWithTime.push(m);
    spin.push({ o: pts, sy: 0.02, sx: 0.01 });
  })();

  // ===== S5 — neon cube tunnel =====
  (function () {
    const COUNT = CT(220), geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    const inst = new THREE.InstancedMesh(geo, mat, COUNT);
    const cols = ['#57ff9c', '#39e0ff', '#eafff4', '#a6ff5b'];
    const dummy = new THREE.Object3D(), col = new THREE.Color(), half = 4.2;
    for (let i = 0; i < COUNT; i++) {
      const side = i % 4, along = (i / COUNT) * 22 - 11;
      let x, y;
      if (side === 0) { x = -half; y = rand(-half, half); }
      else if (side === 1) { x = half; y = rand(-half, half); }
      else if (side === 2) { y = -half; x = rand(-half, half); }
      else { y = half; x = rand(-half, half); }
      x += rand(-0.5, 0.5); y += rand(-0.5, 0.5);
      dummy.position.set(x, y, along);
      const sc = rand(0.18, 0.8); dummy.scale.set(sc, sc, rand(0.3, 2.2));
      dummy.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3)); dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      col.set(cols[(Math.random() * cols.length) | 0]).multiplyScalar(rand(0.6, 1.25));
      inst.setColorAt(i, col);
    }
    inst.instanceColor.needsUpdate = true;
    stations[4].group.add(inst);
    // faint light streaks (points) along tunnel
    const n = CT(3500), pos = new Float32Array(n * 3), sc = new Float32Array(n), rn = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = rand(-half, half); pos[i * 3 + 1] = rand(-half, half); pos[i * 3 + 2] = rand(-11, 11);
      sc[i] = Math.pow(Math.random(), 2) * 1.1 + 0.3; rn[i] = Math.random(); }
    const m = glowMat('#8affc0', 9); m.uniforms.uShimmer.value = 0.02;
    stations[4].group.add(new THREE.Points(pointsGeo(pos, sc, rn), m)); matsWithTime.push(m);
    custom.push({ t: 'tunnel', inst });
  })();

  // ===== S6 — spotlight beam + monolith + debris =====
  (function () {
    const n = CT(6000), pos = new Float32Array(n * 3), sc = new Float32Array(n), rn = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const hy = Math.random(), rad = (1 - hy) * 2.4 * Math.sqrt(Math.random());
      const th = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(th) * rad; pos[i * 3 + 1] = hy * 8 - 1.5; pos[i * 3 + 2] = Math.sin(th) * rad;
      sc[i] = Math.pow(Math.random(), 2) * 1.8 + 0.3; rn[i] = Math.random();
    }
    const m = glowMat('#eef4ff', 11); m.uniforms.uShimmer.value = 0.12; m.uniforms.uBright.value = 0.75;
    const beam = new THREE.Points(pointsGeo(pos, sc, rn), m); stations[5].group.add(beam); matsWithTime.push(m);
    custom.push({ t: 'beam', beam });
    // debris
    const dn = CT(1400), dp = new Float32Array(dn * 3), dsc = new Float32Array(dn), drn = new Float32Array(dn);
    for (let i = 0; i < dn; i++) { dp[i * 3] = rand(-6, 6); dp[i * 3 + 1] = rand(-3, 5); dp[i * 3 + 2] = rand(-4, 3);
      dsc[i] = Math.pow(Math.random(), 2) * 1.3 + 0.3; drn[i] = Math.random(); }
    const dm = glowMat('#cfe0ff', 10); stations[5].group.add(new THREE.Points(pointsGeo(dp, dsc, drn), dm)); matsWithTime.push(dm);
    // monolith
    const mono = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.2, 0.7), darkGlass('#0a0a14'));
    mono.position.set(0.4, -1.6, 0); stations[5].group.add(mono);
    spin.push({ o: mono, sy: 0.12, sx: 0 });
  })();

  // ---------- post-processing (bloom) ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // threshold high so only bright cores bloom → background stays black, glow stays concentrated
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), isMobile ? 0.5 : 0.7, 0.4, 0.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- interaction / drive ----------
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  function onMove(e) {
    const px = (e.touches ? e.touches[0].clientX : e.clientX) / innerWidth;
    const py = (e.touches ? e.touches[0].clientY : e.clientY) / innerHeight;
    pointer.tx = px - 0.5; pointer.ty = py - 0.5;
  }
  addEventListener('mousemove', onMove, { passive: true });
  addEventListener('touchmove', onMove, { passive: true });

  let progress = 0, targetProgress = 0;
  const look = new THREE.Vector3();
  function applyCamera(p) {
    const fp = p * (N - 1), i = clamp(Math.floor(fp), 0, N - 2), f = smooth(fp - i);
    const za = stations[i].group.position.z, zb = stations[i + 1].group.position.z;
    look.set(0, 0, lerp(za, zb, f));
    camera.position.set(pointer.x * 3.2, -pointer.y * 2.0, look.z + 11);
    camera.lookAt(pointer.x * 1.2, -pointer.y * 0.8, look.z - 2);
    bgColor.copy(bgColors[i]).lerp(bgColors[i + 1], f);
    scene.fog.color.copy(bgColor);
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    bloom.setSize(w * (isMobile ? 0.6 : 0.8), h * (isMobile ? 0.6 : 0.8));
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);

  let raf = 0, running = true; const clock = new THREE.Clock();
  function frame() {
    if (!running) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    progress += (targetProgress - progress) * (reduce ? 1 : 0.075);
    pointer.x += (pointer.tx - pointer.x) * 0.05; pointer.y += (pointer.ty - pointer.y) * 0.05;
    matsWithTime.forEach((m) => { m.uniforms.uTime.value = t; });
    if (!reduce) {
      spin.forEach((s) => { s.o.rotation.y += dt * s.sy; s.o.rotation.x += dt * (s.sx || 0);
        if (s.drift) s.o.position.y += Math.sin(t * 0.5 + s.o.position.x) * 0.002; });
      custom.forEach((c) => {
        if (c.t === 'grow') { const dr = (Math.sin(t * 0.25) * 0.5 + 0.5) * c.total; c.lines.geometry.setDrawRange(0, Math.floor(dr)); }
        else if (c.t === 'tunnel') { c.inst.rotation.z = t * 0.05; }
        else if (c.t === 'beam') { c.beam.rotation.y = t * 0.06; }
      });
    }
    applyCamera(progress);
    composer.render();
  }
  frame();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!running) { running = true; clock.getDelta(); frame(); }
  });

  return {
    reduced: reduce, stations: N,
    setProgress(p) { targetProgress = clamp(p, 0, 1); if (reduce) progress = targetProgress; },
    snapProgress(p) { targetProgress = progress = clamp(p, 0, 1); },
    resize,
    destroy() { running = false; cancelAnimationFrame(raf);
      removeEventListener('mousemove', onMove); removeEventListener('touchmove', onMove); removeEventListener('resize', resize);
      renderer.dispose(); pmrem.dispose(); envRT.dispose(); composer.dispose && composer.dispose(); },
  };
}

// ---- chapter subpage hero: nebula + dark glass orb ----
export function initChapterHero(canvas, opts = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(max-width: 760px)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.4 : 2);
  const accent = opts.accent || '#8fd0ff';
  const GLOW = glowTexture();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100); camera.position.set(0, 0, 9);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04); scene.environment = envRT.texture;
  scene.add(new THREE.AmbientLight(0x445566, 0.6));

  const n = (isMobile ? 4000 : 11000), pos = new Float32Array(n * 3), sc = new Float32Array(n), rn = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    let r = 2.6 * Math.pow(Math.random(), 0.6); if (Math.random() < 0.14) r += Math.random() * 3;
    pos[i * 3] = s * Math.cos(th) * r * 1.2; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = s * Math.sin(th) * r;
    sc[i] = Math.pow(Math.random(), 3) * 2.4 + 0.35; rn[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aScale', new THREE.BufferAttribute(sc, 1));
  g.setAttribute('aRnd', new THREE.BufferAttribute(rn, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixel: { value: DPR }, uSize: { value: 11 }, uColor: { value: new THREE.Color(accent) }, uTex: { value: GLOW }, uBright: { value: 1.2 }, uShimmer: { value: 0.26 } },
    vertexShader: SNOISE + `uniform float uTime,uPixel,uSize,uShimmer;attribute float aScale,aRnd;varying float vA;
      void main(){vec3 p=position;float nn=snoise(p*0.3+vec3(0.0,uTime*0.06,aRnd*4.0));p+=normalize(p+0.0001)*nn*uShimmer;
        vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=uSize*aScale*uPixel*(12.0/-mv.z);vA=aScale;}`,
    fragmentShader: `uniform vec3 uColor;uniform sampler2D uTex;uniform float uBright;varying float vA;
      void main(){float a=texture2D(uTex,gl_PointCoord).a;if(a<0.01)discard;gl_FragColor=vec4(uColor,1.0)*a*uBright*(0.12+0.88*vA);}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const neb = new THREE.Points(g, m); scene.add(neb);
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 4), new THREE.MeshPhysicalMaterial({
    color: 0x0b0b14, metalness: 0, roughness: 0.12, transmission: 1, thickness: 2.2, ior: 1.4,
    attenuationColor: new THREE.Color(accent), attenuationDistance: 1.6, iridescence: 1, iridescenceIOR: 1.8,
    clearcoat: 1, envMapIntensity: 1.2, transparent: true, opacity: 0.9 }));
  scene.add(orb);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), isMobile ? 0.5 : 0.7, 0.4, 0.6);
  composer.addPass(bloom); composer.addPass(new OutputPass());

  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => { const px = (e.touches ? e.touches[0].clientX : e.clientX) / innerWidth;
    const py = (e.touches ? e.touches[0].clientY : e.clientY) / innerHeight; ptr.tx = px - 0.5; ptr.ty = py - 0.5; };
  addEventListener('mousemove', onMove, { passive: true }); addEventListener('touchmove', onMove, { passive: true });
  function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w * 0.7, h * 0.7);
    camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);
  let raf = 0, running = true; const clock = new THREE.Clock();
  function frame() { if (!running) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    ptr.x += (ptr.tx - ptr.x) * 0.05; ptr.y += (ptr.ty - ptr.y) * 0.05;
    m.uniforms.uTime.value = t;
    if (!reduce) { neb.rotation.y += dt * 0.08; orb.rotation.y += dt * 0.15; orb.rotation.x += dt * 0.05; }
    camera.position.x += (ptr.x * 2.4 - camera.position.x) * 0.04; camera.position.y += (-ptr.y * 1.6 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0); composer.render(); }
  frame();
  const io = new IntersectionObserver((e) => e.forEach((en) => {
    if (en.isIntersecting) { if (!running) { running = true; clock.getDelta(); frame(); } } else { running = false; cancelAnimationFrame(raf); } }), { threshold: 0 });
  io.observe(canvas);
  return { destroy() { running = false; cancelAnimationFrame(raf); io.disconnect();
    removeEventListener('mousemove', onMove); removeEventListener('touchmove', onMove); removeEventListener('resize', resize);
    renderer.dispose(); pmrem.dispose(); envRT.dispose(); } };
}
