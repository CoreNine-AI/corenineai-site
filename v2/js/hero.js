// hero.js — mouse-reactive GPU particle field (Three.js, vendored)
import * as THREE from '../lib/three.module.min.js';

export function initHero(canvas, opts = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(max-width: 720px)').matches;
  const COUNT = opts.count || (isMobile ? 4200 : 13000);
  const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  camera.position.set(0, 0, 5.4);

  // --- build particle positions on a sphere (fibonacci) ---
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);
  const scales = new Float32Array(COUNT);
  const R = 1.85;
  for (let i = 0; i < COUNT; i++) {
    const t = i / COUNT;
    const phi = Math.acos(1 - 2 * t);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = R * (0.86 + 0.14 * Math.random());
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    seeds[i] = Math.random();
    scales[i] = 0.6 + Math.random() * 1.6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

  const uniforms = {
    uTime:   { value: 0 },
    uPixel:  { value: DPR },
    uMouse:  { value: new THREE.Vector3(0, 0, 0) },
    uAmp:    { value: 0 },        // eased-in on load
    uCyan:   { value: new THREE.Color(0x6ee7ff) },
    uViolet: { value: new THREE.Color(0xa78bfa) },
    uAccent: { value: new THREE.Color(0xd7ff4f) },
    uSize:   { value: isMobile ? 15.0 : 20.0 },
  };

  const vert = /* glsl */`
    uniform float uTime; uniform float uPixel; uniform float uSize;
    uniform vec3 uMouse; uniform float uAmp;
    attribute float aSeed; attribute float aScale;
    varying float vGlow; varying float vSeed;
    // ashima simplex noise 3d
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
      i=mod(i,289.0);
      vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z);
      vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }
    void main(){
      vSeed=aSeed;
      vec3 pos=position;
      vec3 dir=normalize(pos);
      float n=snoise(pos*0.9+vec3(uTime*0.14, uTime*0.11, aSeed*3.0));
      float breathe=sin(uTime*0.7+aSeed*6.28)*0.06;
      pos+=dir*(n*0.42+breathe)*uAmp;
      // mouse repulsion in view space direction
      vec3 toM=pos-uMouse;
      float d=length(toM);
      float push=smoothstep(1.5,0.0,d)*0.9*uAmp;
      pos+=normalize(toM+0.0001)*push;
      vGlow=clamp(n*0.5+0.5,0.0,1.0)+push*0.6;
      vec4 mv=modelViewMatrix*vec4(pos,1.0);
      gl_Position=projectionMatrix*mv;
      gl_PointSize=uSize*aScale*uPixel*(1.0/-mv.z);
    }`;

  const frag = /* glsl */`
    precision mediump float;
    uniform vec3 uCyan; uniform vec3 uViolet; uniform vec3 uAccent;
    varying float vGlow; varying float vSeed;
    void main(){
      vec2 uv=gl_PointCoord-0.5;
      float dd=dot(uv,uv);
      if(dd>0.25) discard;
      float alpha=smoothstep(0.25,0.0,dd);
      vec3 col=mix(uViolet,uCyan,smoothstep(0.2,0.9,vGlow));
      col=mix(col,uAccent,smoothstep(0.85,1.4,vGlow));
      gl_FragColor=vec4(col, alpha*(0.35+vGlow*0.6));
    }`;

  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: vert, fragmentShader: frag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // faint inner core
  const coreGeo = new THREE.IcosahedronGeometry(1.2, 1);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e, wireframe: true, transparent: true, opacity: 0.18 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  scene.add(core);

  // --- interaction ---
  const target = { x: 0, y: 0 };
  const cur = { x: 0, y: 0 };
  const mouseWorld = new THREE.Vector3();
  function onMove(e) {
    const x = (e.touches ? e.touches[0].clientX : e.clientX) / window.innerWidth;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) / window.innerHeight;
    target.x = (x - 0.5) * 2;
    target.y = (y - 0.5) * 2;
  }
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let raf = 0, running = true, t0 = performance.now(), amp = 0;
  const clock = new THREE.Clock();
  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    // ease amplitude in
    amp += (1 - amp) * Math.min(dt * 1.1, 0.06);
    uniforms.uAmp.value = amp;
    uniforms.uTime.value = t;

    cur.x += (target.x - cur.x) * 0.05;
    cur.y += (target.y - cur.y) * 0.05;
    mouseWorld.set(cur.x * 2.2, -cur.y * 1.6, 0.4);
    uniforms.uMouse.value.copy(mouseWorld);

    const rot = reduce ? 0 : 1;
    points.rotation.y += dt * 0.05 * rot;
    points.rotation.x = cur.y * 0.35 * rot;
    points.rotation.z = cur.x * 0.12 * rot;
    core.rotation.copy(points.rotation);
    camera.position.x += (cur.x * 0.5 - camera.position.x) * 0.04;
    camera.position.y += (-cur.y * 0.4 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  frame();

  // pause when offscreen
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (en.isIntersecting) { if (!running) { running = true; clock.getDelta(); frame(); } }
      else { running = false; cancelAnimationFrame(raf); }
    });
  }, { threshold: 0 });
  io.observe(canvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!running) { running = true; clock.getDelta(); frame(); }
  });

  return {
    destroy() {
      running = false; cancelAnimationFrame(raf); io.disconnect();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('resize', resize);
      geo.dispose(); mat.dispose(); coreGeo.dispose(); coreMat.dispose(); renderer.dispose();
    }
  };
}
