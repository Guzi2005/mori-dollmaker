import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PIGMENTS, STAMPS, EYES } from './paint.js';
import { WOODS, FORM_PRESETS, readProfile } from './doll.js';

function canvasTexture(size, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  painter(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function woodMaterial(color = '#8b694a', repeat = [3, 3]) {
  const texture = canvasTexture(512, (ctx, size) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    let seed = 93;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 700; i++) {
      const y = random() * size;
      ctx.strokeStyle = `rgba(61,38,20,${random() * 0.09})`;
      ctx.lineWidth = random() * 1.3 + 0.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * .3, y + random() * 9, size * .65, y - random() * 8, size, y + random() * 4);
      ctx.stroke();
    }
  });
  texture.repeat.set(...repeat);
  return new THREE.MeshStandardMaterial({ map: texture, roughness: .55, metalness: 0 });
}

function roundedRectPath(path, cx, cy, width, height, radius, clockwise = false) {
  const x = cx - width / 2;
  const y = cy - height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  if (clockwise) {
    path.moveTo(x + r, y);
    path.quadraticCurveTo(x, y, x, y + r);
    path.lineTo(x, y + height - r);
    path.quadraticCurveTo(x, y + height, x + r, y + height);
    path.lineTo(x + width - r, y + height);
    path.quadraticCurveTo(x + width, y + height, x + width, y + height - r);
    path.lineTo(x + width, y + r);
    path.quadraticCurveTo(x + width, y, x + width - r, y);
  } else {
    path.moveTo(x + r, y);
    path.lineTo(x + width - r, y);
    path.quadraticCurveTo(x + width, y, x + width, y + r);
    path.lineTo(x + width, y + height - r);
    path.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    path.lineTo(x + r, y + height);
    path.quadraticCurveTo(x, y + height, x, y + height - r);
    path.lineTo(x, y + r);
    path.quadraticCurveTo(x, y, x + r, y);
  }
  path.closePath();
  return path;
}

let sharedPaintTexture = null;
function paintSurfaceTexture() {
  if (sharedPaintTexture) return sharedPaintTexture;
  sharedPaintTexture = canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#f8f4ec';
    ctx.fillRect(0, 0, size, size);
    const swirls = [[.2, .3], [.68, .2], [.44, .68], [.84, .58], [.14, .8]];
    swirls.forEach(([x, y], index) => {
      ctx.save();
      ctx.translate(x * size, y * size);
      ctx.rotate(index * 1.7);
      ctx.strokeStyle = index % 2 ? 'rgba(255,255,255,.42)' : 'rgba(108,94,74,.10)';
      ctx.lineWidth = size * .034;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, size * (.09 + index * .018), .18, Math.PI * 1.32);
      ctx.stroke();
      ctx.restore();
    });
    ctx.strokeStyle = 'rgba(92,80,62,.09)';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 15; i++) {
      const y = (i + .5) * size / 15;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * .3, y + 8, size * .7, y - 6, size, y + 3);
      ctx.stroke();
    }
  });
  sharedPaintTexture.wrapS = sharedPaintTexture.wrapT = THREE.ClampToEdgeWrapping;
  return sharedPaintTexture;
}

function paintBlob(radius, seed) {
  const shape = new THREE.Shape();
  const count = 52;
  for (let i = 0; i <= count; i++) {
    const angle = i / count * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const wobble = 1 + Math.sin(angle * 3 + seed) * .012 + Math.sin(angle * 5 + seed * 1.7) * .007;
    const x = Math.sign(c) * Math.pow(Math.abs(c), .56) * radius * wobble;
    const y = Math.sign(s) * Math.pow(Math.abs(s), .56) * radius * wobble;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function squareTexture(size, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  painter(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function stampIconTexture(id) {
  return squareTexture(128, (ctx, size) => {
    const c = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(59,48,37,.8)';
    ctx.strokeStyle = ctx.fillStyle;
    if (id === 'daisy' || id === 'blossom') {
      const petals = id === 'daisy' ? 8 : 5;
      for (let i = 0; i < petals; i++) {
        const angle = i / petals * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(c + Math.cos(angle) * 23, c + Math.sin(angle) * 23, 20, 11, angle, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(c, c, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'leaf') {
      ctx.beginPath();
      ctx.moveTo(size * .22, size * .7);
      ctx.bezierCurveTo(size * .28, size * .26, size * .68, size * .2, size * .82, size * .27);
      ctx.bezierCurveTo(size * .86, size * .6, size * .55, size * .8, size * .22, size * .7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(242,233,214,.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(size * .3, size * .66);
      ctx.lineTo(size * .73, size * .34);
      ctx.stroke();
    } else {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + i / 10 * Math.PI * 2;
        const radius = i % 2 ? 17 : 43;
        const x = c + Math.cos(angle) * radius;
        const y = c + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  });
}

function stampShape(id) {
  const shape = new THREE.Shape();
  if (id === 'leaf') {
    shape.moveTo(0, -.68);
    shape.bezierCurveTo(-.56, -.3, -.44, .34, .1, .6);
    shape.bezierCurveTo(.5, .22, .44, -.32, 0, -.68);
    return shape;
  }
  if (id === 'star') {
    for (let i = 0; i <= 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 ? .29 : .66;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }
  const petals = id === 'daisy' ? 9 : 5;
  const steps = petals * 14;
  for (let i = 0; i <= steps; i++) {
    const angle = i / steps * Math.PI * 2;
    const lobe = .5 + .5 * Math.cos(petals * angle);
    const radius = .34 + .33 * Math.pow(lobe, .55);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function leatherPunchBody(id, depth) {
  const geometry = new THREE.ExtrudeGeometry(stampShape(id), {
    depth, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2, curveSegments: 10
  });
  geometry.scale(.3, .3, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function woodChipTexture(key) {
  const wood = WOODS[key];
  return squareTexture(256, (ctx, size) => {
    ctx.fillStyle = wood.base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 1; i < 9; i++) {
      ctx.strokeStyle = `rgba(70,46,26,${.045 + (i % 3) * .022})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(size * .47, size * .43, i * 13, i * 10.5, .3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(74,48,26,.12)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = size * (.15 + i * .05);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * .3, y + 7, size * .7, y - 5, size, y + 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(53,38,24,.62)';
    ctx.font = '500 34px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wood.name, size / 2, size * .8);
  });
}

function finishDotTexture(label) {
  return squareTexture(128, (ctx, size) => {
    ctx.fillStyle = '#cfae80';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(70,48,28,.76)';
    ctx.font = '600 60px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, size / 2, size * .55);
  });
}

function drawEyePair(ctx, cx, cy, id) {
  const gap = 40;
  ctx.save();
  ctx.strokeStyle = '#3b352e';
  ctx.fillStyle = '#3b352e';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const ex of [cx - gap, cx + gap]) {
    if (id === 'sleepy') {
      ctx.beginPath();
      ctx.arc(ex, cy, 20, Math.PI * .26, Math.PI * .74);
      ctx.stroke();
    } else if (id === 'happy') {
      ctx.beginPath();
      ctx.arc(ex, cy + 8, 19, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();
    } else {
      const radius = id === 'bright' ? 16 : 13;
      ctx.beginPath();
      ctx.arc(ex, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f6efe1';
      ctx.beginPath();
      ctx.arc(ex - 4, cy - 5, radius * .3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3b352e';
    }
  }
  ctx.restore();
}

export class Studio {
  constructor(container, doll) {
    this.container = container;
    this.doll = doll;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#d6cfc2');
    this.scene.fog = new THREE.Fog('#d6cfc2', 11, 22);
    this.camera = new THREE.PerspectiveCamera(36, 1, .05, 60);
    this.cameraTarget = new THREE.Vector3(0, 1.75, 0);
    this.lookAt = this.cameraTarget.clone();
    this.cameraGoal = new THREE.Vector3(3.55, 3.62, 7.85);
    this.camera.position.copy(this.cameraGoal);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .96;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.needsRender = true;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
    pmrem.dispose();

    this.interactive = [];
    this.wells = [];
    this.rotationGoal = 0;
    this.autoRotate = false;
    this.dipAnimation = null;
    this.cursorPositions = [];
    this.createLights();
    this.createWorkbench();
    this.createWorkshopDecor();
    this.createTurntable();
    this.createPaintBox();
    this.createAccessories();
    this.createBrushCursor();
    this.createToolCursors();
    this.createCursorRings();
    this.activeTool = 'brush';
    this.viewMode = 'three-quarter';
    this.doll.onChange = () => this.requestRender();
    this.resize();
    this.fitView();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }

  createLights() {
    const hemisphere = new THREE.HemisphereLight('#fff6e6', '#7f715f', 2.0);
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight('#fff0d8', 3.4);
    key.position.set(-3.8, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -5;
    key.shadow.camera.right = key.shadow.camera.top = 5;
    key.shadow.camera.near = .5;
    key.shadow.camera.far = 18;
    key.shadow.bias = -.0003;
    key.shadow.normalBias = .025;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#dbe8e4', 2.2);
    rim.position.set(4, 4, -3);
    this.scene.add(rim);
    const warm = new THREE.PointLight('#ffc98f', 16, 8, 2);
    warm.position.set(-2.5, 3.5, 1.2);
    this.scene.add(warm);
  }

  createWorkbench() {
    const table = new THREE.Mesh(new THREE.BoxGeometry(16, .28, 12), woodMaterial('#9c7c5d', [4, 4]));
    table.position.y = -.15;
    table.receiveShadow = true;
    this.scene.add(table);

    const wallTexture = canvasTexture(256, (ctx, size) => {
      ctx.fillStyle = '#d7d0c3';
      ctx.fillRect(0, 0, size, size);
      let seed = 41;
      const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 1300; i++) {
        ctx.fillStyle = random() > .5 ? 'rgba(255,253,246,.08)' : 'rgba(112,98,78,.05)';
        ctx.fillRect(random() * size, random() * size, 1.6, 1.6);
      }
      ctx.strokeStyle = 'rgba(255,253,246,.05)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 26; i++) {
        const x = random() * size;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + random() * 8 - 4, size);
        ctx.stroke();
      }
    });
    wallTexture.repeat.set(5, 3);
    const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 1 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), wallMaterial);
    wall.position.set(0, 4.2, -4.4);
    wall.receiveShadow = true;
    this.scene.add(wall);

    const windowGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 3.8),
      new THREE.MeshBasicMaterial({ color: '#eee9dd', transparent: true, opacity: .42 })
    );
    windowGlow.position.set(-3.7, 3.8, -4.37);
    this.scene.add(windowGlow);
    const frameMaterial = new THREE.MeshStandardMaterial({ color: '#b9b2a6', roughness: .8 });
    for (const x of [-5.02, -3.7, -2.38]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(.055, 3.9, .06), frameMaterial);
      frame.position.set(x, 3.8, -4.32);
      this.scene.add(frame);
    }
    for (const y of [1.86, 3.8, 5.74]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.7, .055, .06), frameMaterial);
      frame.position.set(-3.7, y, -4.32);
      this.scene.add(frame);
    }

    const clothTexture = canvasTexture(256, (ctx, size) => {
      ctx.fillStyle = '#b8ad96'; ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(250,244,224,.16)'; ctx.lineWidth = 1;
      for (let i = 0; i < size; i += 3) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
      }
    });
    clothTexture.repeat.set(3, 3);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.5, 12, 12), new THREE.MeshStandardMaterial({ map: clothTexture, roughness: 1, side: THREE.DoubleSide }));
    cloth.rotation.set(-Math.PI / 2, 0, -.18);
    cloth.position.set(-1.85, .012, .15);
    cloth.receiveShadow = true;
    this.scene.add(cloth);
  }

  createWorkshopDecor() {
    const timber = (color, repeat = [1, 1]) => woodMaterial(color, repeat);
    const shadowed = mesh => { mesh.castShadow = mesh.receiveShadow = true; return mesh; };

    const skirting = shadowed(new THREE.Mesh(new THREE.BoxGeometry(15.6, .18, .07), timber('#6d5239', [3, .3])));
    skirting.position.set(0, .075, -4.34);
    this.scene.add(skirting);

    const shelf = new THREE.Group();
    shelf.position.set(-1.32, 1.5, -4.23);
    this.scene.add(shelf);
    const shelfBoard = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.98, .065, .38), timber('#7d6043', [1.6, .4])));
    shelf.add(shelfBoard);
    for (const x of [-.78, .78]) {
      const bracket = shadowed(new THREE.Mesh(new THREE.BoxGeometry(.055, .34, .3), timber('#6b5138', [.6, .6])));
      bracket.position.set(x, -.2, -.02);
      shelf.add(bracket);
    }

    const jarColors = ['#B8493D', '#D2A83E', '#5E9696', '#65764B', '#385A78'];
    jarColors.forEach((hex, index) => {
      const body = shadowed(new THREE.Mesh(
        new THREE.CylinderGeometry(.072, .075, .23, 20),
        new THREE.MeshPhysicalMaterial({ color: hex, roughness: .28, clearcoat: .4, clearcoatRoughness: .35 })
      ));
      body.position.set(-.82 + index * .19, .147, .02);
      shelf.add(body);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(.078, .078, .03, 20), new THREE.MeshStandardMaterial({ color: '#4c3d2c', roughness: .5 }));
      lid.position.set(body.position.x, .277, .02);
      lid.castShadow = true;
      shelf.add(lid);
    });

    const bookColors = ['#6f7f68', '#a45a48', '#5d6c7c'];
    bookColors.forEach((hex, index) => {
      const book = new THREE.Mesh(new THREE.BoxGeometry(.42 - index * .03, .042, .3), new THREE.MeshStandardMaterial({ color: hex, roughness: .78 }));
      book.position.set(.4, .055 + index * .045, .02);
      book.rotation.y = -.14 + index * .1;
      book.castShadow = book.receiveShadow = true;
      shelf.add(book);
    });

    const potMaterial = new THREE.MeshStandardMaterial({ color: '#b07152', roughness: .8 });
    const pot = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.078, .062, .12, 18), potMaterial));
    pot.position.set(.84, .093, .01);
    shelf.add(pot);
    const potRim = new THREE.Mesh(new THREE.TorusGeometry(.074, .01, 6, 18), potMaterial);
    potRim.rotation.x = Math.PI / 2;
    potRim.position.set(.84, .153, .01);
    shelf.add(potRim);
    const leafMaterial = new THREE.MeshStandardMaterial({ color: '#617a52', roughness: .82 });
    for (let i = 0; i < 7; i++) {
      const angle = i / 7 * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(.026, .19 + (i % 3) * .03, 5), leafMaterial);
      leaf.position.set(.84 + Math.cos(angle) * .035, .19 + (i % 3) * .02, .01 + Math.sin(angle) * .035);
      leaf.rotation.z = Math.cos(angle) * .62;
      leaf.rotation.x = Math.sin(angle) * .62;
      leaf.scale.z = .45;
      leaf.castShadow = true;
      shelf.add(leaf);
    }

    const sketchCanvas = document.createElement('canvas');
    sketchCanvas.width = 480;
    sketchCanvas.height = 600;
    const sketch = sketchCanvas.getContext('2d');
    sketch.fillStyle = '#f4ecda';
    sketch.fillRect(0, 0, 480, 600);
    sketch.fillStyle = 'rgba(214,198,164,.5)';
    sketch.save(); sketch.translate(52, 22); sketch.rotate(-.14); sketch.fillRect(-38, -14, 76, 28); sketch.restore();
    sketch.save(); sketch.translate(432, 24); sketch.rotate(.12); sketch.fillRect(-38, -14, 76, 28); sketch.restore();
    sketch.strokeStyle = 'rgba(118,98,72,.24)';
    sketch.lineWidth = 2;
    sketch.strokeRect(16, 16, 448, 568);
    sketch.fillStyle = '#7a6249';
    sketch.font = '600 24px "Noto Serif SC", serif';
    sketch.fillText('木偶手记 · 03', 42, 72);
    sketch.font = '400 13px "DM Sans", sans-serif';
    sketch.fillStyle = 'rgba(112,94,70,.62)';
    sketch.fillText('HAND-TURNED NOTES', 42, 94);
    sketch.strokeStyle = 'rgba(88,70,50,.7)';
    sketch.lineWidth = 2.6;
    sketch.lineJoin = 'round';
    sketch.beginPath(); sketch.arc(240, 196, 86, 0, Math.PI * 2); sketch.stroke();
    sketch.beginPath();
    sketch.moveTo(216, 278); sketch.lineTo(216, 296); sketch.lineTo(264, 296); sketch.lineTo(264, 278);
    sketch.stroke();
    sketch.beginPath();
    sketch.moveTo(208, 296);
    sketch.quadraticCurveTo(184, 400, 152, 520);
    sketch.quadraticCurveTo(240, 548, 328, 520);
    sketch.quadraticCurveTo(296, 400, 272, 296);
    sketch.closePath(); sketch.stroke();
    sketch.beginPath();
    sketch.moveTo(206, 344); sketch.lineTo(198, 514);
    sketch.quadraticCurveTo(240, 528, 282, 514); sketch.lineTo(274, 344);
    sketch.stroke();
    sketch.beginPath();
    sketch.moveTo(160, 166); sketch.quadraticCurveTo(198, 104, 274, 116);
    sketch.quadraticCurveTo(326, 150, 318, 208);
    sketch.stroke();
    sketch.lineWidth = 1.8;
    sketch.beginPath(); sketch.arc(208, 218, 12, .3, Math.PI - .3); sketch.stroke();
    sketch.beginPath(); sketch.arc(272, 218, 12, .3, Math.PI - .3); sketch.stroke();
    sketch.beginPath(); sketch.moveTo(212, 250); sketch.quadraticCurveTo(240, 262, 268, 250); sketch.stroke();
    sketch.beginPath(); sketch.moveTo(240, 244); sketch.lineTo(240, 252); sketch.stroke();
    sketch.strokeStyle = 'rgba(150,108,72,.55)';
    sketch.setLineDash([5, 6]);
    sketch.beginPath(); sketch.moveTo(148, 116); sketch.lineTo(148, 532); sketch.stroke();
    sketch.setLineDash([]);
    sketch.strokeStyle = 'rgba(118,98,72,.55)';
    for (const y of [116, 532]) {
      sketch.beginPath(); sketch.moveTo(142, y); sketch.lineTo(154, y); sketch.stroke();
    }
    sketch.save();
    sketch.translate(126, 324);
    sketch.rotate(-Math.PI / 2);
    sketch.fillStyle = 'rgba(112,94,70,.8)';
    sketch.font = '500 15px "Noto Serif SC", serif';
    sketch.textAlign = 'center';
    sketch.fillText('14 cm', 0, 0);
    sketch.restore();
    sketch.fillStyle = 'rgba(112,94,70,.72)';
    sketch.font = '400 14px "Noto Serif SC", serif';
    sketch.fillText('发际线压低一点', 318, 132);
    sketch.fillText('围裙压住裙面', 318, 430);
    sketch.fillText('薄涂两遍', 318, 456);
    sketch.strokeStyle = 'rgba(112,94,70,.35)';
    sketch.lineWidth = 1;
    sketch.beginPath(); sketch.moveTo(314, 140); sketch.lineTo(292, 168); sketch.stroke();
    sketch.beginPath(); sketch.moveTo(314, 438); sketch.lineTo(286, 430); sketch.stroke();
    const swatches = ['#B8493D', '#303733', '#E8DCC3', '#65764B', '#6B4D3B'];
    swatches.forEach((hex, index) => {
      sketch.fillStyle = hex;
      sketch.fillRect(300 + index * 30, 512, 24, 24);
      sketch.strokeStyle = 'rgba(112,94,70,.35)';
      sketch.strokeRect(300 + index * 30, 512, 24, 24);
    });
    const sketchTexture = new THREE.CanvasTexture(sketchCanvas);
    sketchTexture.colorSpace = THREE.SRGBColorSpace;
    sketchTexture.anisotropy = 8;

    const frame = new THREE.Group();
    frame.position.set(.43, 1.62, -4.31);
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(.72, .9), new THREE.MeshStandardMaterial({ map: sketchTexture, roughness: .92 }));
    paper.position.z = .012;
    frame.add(paper);
    const frameWood = timber('#70543a', [.8, .8]);
    for (const [x, y, w, h] of [[0, .48, .8, .045], [0, -.48, .8, .045], [-.392, 0, .045, .96], [.392, 0, .045, .96]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, .05), frameWood);
      bar.position.set(x, y, .02);
      bar.castShadow = true;
      frame.add(bar);
    }
    this.scene.add(frame);

    const pencil = new THREE.Group();
    pencil.position.set(.9, .018, .92);
    pencil.rotation.y = -.48;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .6, 6), new THREE.MeshStandardMaterial({ color: '#d7a53f', roughness: .6 }));
    shaft.rotation.z = Math.PI / 2;
    shaft.castShadow = true;
    pencil.add(shaft);
    const sharpened = new THREE.Mesh(new THREE.ConeGeometry(.018, .07, 12), new THREE.MeshStandardMaterial({ color: '#e3c193', roughness: .8 }));
    sharpened.rotation.z = -Math.PI / 2;
    sharpened.position.x = .335;
    pencil.add(sharpened);
    const graphite = new THREE.Mesh(new THREE.ConeGeometry(.0065, .022, 8), new THREE.MeshStandardMaterial({ color: '#3a3632', roughness: .4 }));
    graphite.rotation.z = -Math.PI / 2;
    graphite.position.x = .381;
    pencil.add(graphite);
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(.0175, .0175, .04, 12), new THREE.MeshStandardMaterial({ color: '#a8a69b', roughness: .3, metalness: .8 }));
    ferrule.rotation.z = Math.PI / 2;
    ferrule.position.x = -.318;
    pencil.add(ferrule);
    const eraser = new THREE.Mesh(new THREE.CylinderGeometry(.017, .017, .035, 12), new THREE.MeshStandardMaterial({ color: '#c9877e', roughness: .9 }));
    eraser.rotation.z = Math.PI / 2;
    eraser.position.x = -.355;
    pencil.add(eraser);
    this.scene.add(pencil);

    const shavingMaterial = new THREE.MeshStandardMaterial({ color: '#c8a270', roughness: .78, side: THREE.DoubleSide });
    const shavingSpots = [[-.58, .9, .5, 1.1], [-.34, 1.02, -.4, .9], [.35, 1.06, 1.0, .7], [-.84, .74, .2, .3]];
    shavingSpots.forEach(([x, z, rotation, scale]) => {
      const shaving = new THREE.Mesh(new THREE.TorusGeometry(.05, .007, 5, 14, Math.PI * 1.35), shavingMaterial);
      shaving.rotation.set(-Math.PI / 2, 0, rotation);
      shaving.position.set(x, .021, z);
      shaving.scale.setScalar(scale);
      shaving.castShadow = true;
      this.scene.add(shaving);
    });

    const ragTexture = canvasTexture(128, (ctx, size) => {
      ctx.fillStyle = '#ccd4c8';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(120,142,128,.35)';
      ctx.lineWidth = 5;
      for (let i = 0; i < size; i += 16) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,252,240,.28)';
      ctx.lineWidth = 1.5;
      for (let i = 8; i < size; i += 16) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      }
    });
    const ragGeometry = new THREE.PlaneGeometry(.42, .32, 7, 6);
    const positions = ragGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      positions.setZ(i, Math.sin(x * 22) * .018 + Math.cos(y * 18) * .015);
    }
    ragGeometry.computeVertexNormals();
    const rag = new THREE.Mesh(ragGeometry, new THREE.MeshStandardMaterial({ map: ragTexture, roughness: 1, side: THREE.DoubleSide }));
    rag.rotation.x = -Math.PI / 2;
    rag.rotation.z = .42;
    rag.position.set(1.06, .018, .62);
    rag.receiveShadow = true;
    this.scene.add(rag);
  }

  createTurntable() {
    this.turntableVisual = new THREE.Group();
    this.scene.add(this.turntableVisual);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.16, .13, 96), woodMaterial('#5c4432', [2, 2]));
    base.position.y = .065;
    base.castShadow = base.receiveShadow = true;
    this.turntableVisual.add(base);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.82, .9, .08, 64), new THREE.MeshStandardMaterial({ color: '#3c3831', roughness: .4, metalness: .25 }));
    foot.position.y = .025;
    this.turntableVisual.add(foot);
    const platter = new THREE.Mesh(new THREE.CylinderGeometry(1.055, 1.055, .13, 96), woodMaterial('#a8845e', [2, 2]));
    platter.position.y = .17;
    platter.castShadow = platter.receiveShadow = true;
    this.turntableVisual.add(platter);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.052, .018, 12, 96), new THREE.MeshStandardMaterial({ color: '#b59862', roughness: .26, metalness: .8 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = .19;
    this.turntableVisual.add(rim);
    const centerRing = new THREE.Mesh(new THREE.TorusGeometry(.87, .004, 6, 96), new THREE.MeshStandardMaterial({ color: '#6e5137', roughness: .7 }));
    centerRing.rotation.x = Math.PI / 2;
    centerRing.position.y = .238;
    this.turntableVisual.add(centerRing);

    this.rotator = new THREE.Group();
    this.scene.add(this.rotator);
    this.doll.group.position.y = .235;
    this.rotator.add(this.doll.group);
    this.fitTurntable();
  }

  fitTurntable() {
    if (!this.turntableVisual) return;
    const scale = this.doll.group.scale.x || 1;
    const baseRadius = (this.doll.metrics?.baseRadius ?? .78) * scale;
    const factor = THREE.MathUtils.clamp(baseRadius * 1.5 / 1.055, .58, 1.9);
    this.turntableVisual.scale.set(factor, 1, factor);
    this.requestRender();
  }

  createPaintBox() {
    const group = new THREE.Group();
    this.paintBox = group;
    group.position.set(1.58, .015, -.5);
    group.rotation.y = -.24;
    group.scale.setScalar(.86);
    this.scene.add(group);

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.62, .15, 1.62), woodMaterial('#5e4532', [1.6, 1.6]));
    body.position.y = .075;
    body.castShadow = body.receiveShadow = true;
    group.add(body);

    const plateShape = new THREE.Shape();
    roundedRectPath(plateShape, 0, 0, 1.47, 1.47, .045);
    const pitch = .347;
    const opening = .272;
    const cells = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const cell = { x: (col - 1.5) * pitch, y: (row - 1) * pitch, index: row * 4 + col };
        cells.push(cell);
        const hole = new THREE.Path();
        roundedRectPath(hole, cell.x, cell.y, opening, opening, .018, true);
        plateShape.holes.push(hole);
      }
    }
    const plateGeometry = new THREE.ExtrudeGeometry(plateShape, { depth: .05, bevelEnabled: false, curveSegments: 4 });
    plateGeometry.rotateX(-Math.PI / 2);
    plateGeometry.translate(0, .145, 0);
    const plate = new THREE.Mesh(plateGeometry, new THREE.MeshPhysicalMaterial({
      color: '#d8d0bf', roughness: .46, metalness: .04, clearcoat: .24, clearcoatRoughness: .52
    }));
    plate.castShadow = plate.receiveShadow = true;
    group.add(plate);

    const lipMaterial = woodMaterial('#6d5138', [1.6, .3]);
    const frontBack = new THREE.BoxGeometry(1.62, .055, .075);
    const leftRight = new THREE.BoxGeometry(.075, .055, 1.47);
    for (const z of [-.7725, .7725]) {
      const bar = new THREE.Mesh(frontBack, lipMaterial);
      bar.position.set(0, .1875, z);
      bar.castShadow = bar.receiveShadow = true;
      group.add(bar);
    }
    for (const x of [-.7725, .7725]) {
      const bar = new THREE.Mesh(leftRight, lipMaterial);
      bar.position.set(x, .1875, 0);
      bar.castShadow = bar.receiveShadow = true;
      group.add(bar);
    }

    const cavityMaterial = new THREE.MeshStandardMaterial({ color: '#37342c', roughness: .82, metalness: .04 });
    const surface = paintSurfaceTexture();
    cells.forEach((cell, index) => {
      const pigment = PIGMENTS[index];
      const cavity = new THREE.Mesh(new THREE.BoxGeometry(opening, .07, opening), cavityMaterial);
      cavity.position.set(cell.x, .108, -cell.y);
      group.add(cavity);

      const geometry = new THREE.ExtrudeGeometry(paintBlob(.126, index * 2.3 + 1), {
        depth: .026, bevelEnabled: true, bevelThickness: .009, bevelSize: .008, bevelSegments: 2, curveSegments: 2, steps: 1
      });
      geometry.rotateX(-Math.PI / 2);
      const map = surface.clone();
      map.center.set(.5, .5);
      map.rotation = index * .7;
      map.needsUpdate = true;
      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(pigment.hex).multiplyScalar(.9),
        map, roughness: .48, metalness: 0, clearcoat: .12, clearcoatRoughness: .5, envMapIntensity: .2
      });
      const paint = new THREE.Mesh(geometry, material);
      paint.position.set(cell.x, .127, -cell.y);
      paint.rotation.y = index * .13;
      paint.userData = { type: 'pigment', index, hex: pigment.hex, name: pigment.name };
      group.add(paint);
      this.interactive.push(paint);
      this.wells.push(paint);
    });

    this.finishMaterials = {};
    const finishSpecs = [
      { key: 'raw', label: '素', roughness: .96, clearcoat: 0 },
      { key: 'wax', label: '蜡', roughness: .56, clearcoat: .3 },
      { key: 'gloss', label: '漆', roughness: .17, clearcoat: .92 }
    ];
    finishSpecs.forEach((finish, index) => {
      const sideMaterial = new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: .66 });
      const topMaterial = new THREE.MeshPhysicalMaterial({
        map: finishDotTexture(finish.label), roughness: finish.roughness,
        clearcoat: finish.clearcoat, clearcoatRoughness: .2, emissive: '#000000'
      });
      this.finishMaterials[finish.key] = topMaterial;
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(.075, .079, .014, 32), [sideMaterial, topMaterial, sideMaterial]);
      dot.position.set((index - 1) * .37, .223, .7725);
      dot.userData = { type: 'finish', key: finish.key };
      group.add(dot);
      this.interactive.push(dot);
    });
  }

  createAccessories() {
    const ceramic = new THREE.MeshPhysicalMaterial({ color: '#d8d0bc', roughness: .24, clearcoat: .55, clearcoatRoughness: .2 });
    const cupProfile = [
      new THREE.Vector2(.25, 0), new THREE.Vector2(.28, .03), new THREE.Vector2(.31, .42),
      new THREE.Vector2(.29, .48), new THREE.Vector2(.265, .48), new THREE.Vector2(.27, .40), new THREE.Vector2(.24, .06)
    ];
    const cup = new THREE.Mesh(new THREE.LatheGeometry(cupProfile, 64), ceramic);
    cup.position.set(-2.18, .02, -1.22);
    cup.scale.setScalar(.92);
    cup.castShadow = cup.receiveShadow = true;
    cup.userData = { type: 'rinse' };
    this.scene.add(cup);
    this.interactive.push(cup);
    const water = new THREE.Mesh(new THREE.CircleGeometry(.265, 48), new THREE.MeshPhysicalMaterial({ color: '#829d99', transparent: true, opacity: .72, roughness: .08, transmission: .18 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(-2.18, .02 + .40 * .92, -1.22);
    water.scale.setScalar(.92);
    water.userData = { type: 'rinse' };
    this.scene.add(water);
    this.interactive.push(water);
    this.water = water;

    const jarProfile = [new THREE.Vector2(.22, 0), new THREE.Vector2(.27, .04), new THREE.Vector2(.25, .52), new THREE.Vector2(.22, .57), new THREE.Vector2(.19, .57), new THREE.Vector2(.21, .48)];
    const jar = new THREE.Mesh(new THREE.LatheGeometry(jarProfile, 48), new THREE.MeshStandardMaterial({ color: '#6d7666', roughness: .5 }));
    jar.position.set(-1.42, .02, -.78);
    jar.castShadow = true;
    this.scene.add(jar);

    this.jarBrushes = {};
    const brushKeys = ['liner', 'round', 'flat', 'wash', 'blush'];
    const handleColors = ['#223f34', '#5b3a2c', '#2f3d52', '#6c4a2f', '#7a5a33'];
    brushKeys.forEach((key, index) => {
      const brush = this.makeBrushModel(handleColors[index], false, key);
      brush.scale.setScalar(.68);
      const angle = index / brushKeys.length * Math.PI * 2;
      brush.position.set(-1.42 + Math.cos(angle) * .11, .38, -.78 + Math.sin(angle) * .11);
      brush.rotation.z = Math.cos(angle) * .26;
      brush.rotation.x = Math.sin(angle) * .26;
      this.scene.add(brush);
      this.jarBrushes[key] = brush.children[0].material;
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, 1.3, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.position.y = 1.08;
      hit.userData = { type: 'brush', key };
      brush.add(hit);
      this.interactive.push(hit);
    });

    this.stampRings = {};
    const punchFace = new THREE.MeshStandardMaterial({ color: '#4d3c28', roughness: .48, metalness: .55 });
    const punchSide = new THREE.MeshStandardMaterial({ color: '#b08850', roughness: .32, metalness: .72 });
    const punchWood = new THREE.MeshPhysicalMaterial({ color: '#9b744a', roughness: .36, clearcoat: .4 });
    STAMPS.forEach((stamp, index) => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(leatherPunchBody(stamp.id, .09), [punchFace, punchSide]);
      body.position.y = .03;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.026, .034, .09, 16), punchSide);
      stem.position.y = .16;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(.05, 18, 12), punchWood);
      knob.scale.y = .78;
      knob.position.y = .225;
      const icon = new THREE.Mesh(new THREE.CircleGeometry(.035, 20), new THREE.MeshBasicMaterial({ map: stampIconTexture(stamp.id), transparent: true, depthWrite: false, color: '#2f2619' }));
      icon.rotation.x = -Math.PI / 2;
      icon.position.y = .265;
      body.castShadow = stem.castShadow = knob.castShadow = true;
      body.userData = { type: 'stamp', stamp: stamp.id };
      stem.userData = { type: 'stamp', stamp: stamp.id };
      knob.userData = { type: 'stamp', stamp: stamp.id };
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.215, .006, 8, 40), new THREE.MeshBasicMaterial({ color: '#f4e5c8', transparent: true, opacity: .92 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = .012;
      ring.visible = false;
      this.stampRings[stamp.id] = ring;
      group.add(body, stem, knob, icon, ring);
      group.position.set(.72 + index * .5, .015, -1.55 - (index % 2) * .09);
      group.rotation.y = -.3 + index * .16;
      this.scene.add(group);
      this.interactive.push(body, stem, knob);
    });

    this.woodChips = {};
    const chipPositions = [[-2.28, .16], [-1.98, .03], [-1.7, .16], [-1.4, .03]];
    Object.keys(WOODS).forEach((key, index) => {
      const [x, z] = chipPositions[index];
      const sideMaterial = new THREE.MeshStandardMaterial({ color: WOODS[key].dark, roughness: .7 });
      const topMaterial = new THREE.MeshStandardMaterial({ map: woodChipTexture(key), roughness: .55 });
      const chip = new THREE.Mesh(new THREE.CylinderGeometry(.16, .165, .055, 44), [sideMaterial, topMaterial, sideMaterial]);
      chip.position.set(x, .028, z);
      chip.rotation.y = index * .8;
      chip.castShadow = chip.receiveShadow = true;
      chip.userData = { type: 'wood', key };
      this.scene.add(chip);
      this.interactive.push(chip);
      this.woodChips[key] = chip;
    });
    this.woodRing = new THREE.Mesh(new THREE.TorusGeometry(.19, .006, 8, 44), new THREE.MeshBasicMaterial({ color: '#f2e3c3', transparent: true, opacity: .9 }));
    this.woodRing.rotation.x = Math.PI / 2;
    this.woodRing.visible = false;
    this.scene.add(this.woodRing);

    const rack = new THREE.Mesh(new THREE.BoxGeometry(.96, .035, .26), woodMaterial('#8d6c4c', [1.2, .4]));
    rack.position.set(-1.98, .03, -.98);
    rack.castShadow = rack.receiveShadow = true;
    this.scene.add(rack);
    this.shapeBlanks = {};
    Object.entries(FORM_PRESETS).forEach(([key, preset], index) => {
      const material = woodMaterial('#c99d67', [1.4, 2.2]);
      material.emissive = new THREE.Color('#000000');
      const profile = readProfile(preset).points.map(p => new THREE.Vector2(p.x * .26, p.y * .26));
      const geometry = new THREE.LatheGeometry(profile, 48);
      geometry.computeVertexNormals();
      const blank = new THREE.Mesh(geometry, material);
      blank.position.set(-2.34 + index * .24, .049, -.98);
      blank.rotation.y = index * .7;
      blank.castShadow = blank.receiveShadow = true;
      blank.userData = { type: 'shape', key };
      this.scene.add(blank);
      this.interactive.push(blank);
      this.shapeBlanks[key] = { mesh: blank, material };
    });

    this.buildEyeSheet();
  }

  buildEyeSheet() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    this.eyeCanvas = canvas;
    this.eyeContext = canvas.getContext('2d');
    this.eyeTexture = new THREE.CanvasTexture(canvas);
    this.eyeTexture.colorSpace = THREE.SRGBColorSpace;
    this.eyeTexture.anisotropy = 8;
    const board = new THREE.Group();
    const backing = new THREE.Mesh(new THREE.BoxGeometry(.62, .44, .018), new THREE.MeshStandardMaterial({ color: '#c8b695', roughness: .88 }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.6, .42), new THREE.MeshBasicMaterial({ map: this.eyeTexture, transparent: true }));
    face.position.z = .0095;
    board.add(backing, face);
    this.eyeHits = [];
    EYES.forEach((eye, index) => {
      const hit = new THREE.Mesh(new THREE.PlaneGeometry(.14, .36), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.position.set((index - 1.5) * .15, 0, .011);
      hit.userData = { type: 'eye', eye: eye.id };
      board.add(hit);
      this.eyeHits.push(hit);
      this.interactive.push(hit);
    });
    board.position.set(1.35, .8, -1.95);
    board.rotation.set(-.18, -.35, 0);
    board.scale.setScalar(1.3);
    this.scene.add(board);
    this.eyeBoard = board;

    const easel = new THREE.Group();
    const easelWood = woodMaterial('#8a6a48', [1.2, 1.2]);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.95, .05, .32), easelWood);
    base.position.y = .025;
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(.84, .05, .13), easelWood);
    ledge.position.set(0, .5, .06);
    easel.add(base, ledge);
    for (const x of [-.42, .42]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.045, .66, .045), easelWood);
      post.position.set(x, .33, -.06);
      easel.add(post);
    }
    const strut = new THREE.Mesh(new THREE.BoxGeometry(.045, .7, .045), easelWood);
    strut.position.set(0, .34, -.14);
    strut.rotation.x = .14;
    easel.add(strut);
    easel.position.set(1.35, 0, -1.95);
    easel.rotation.y = -.35;
    base.castShadow = ledge.castShadow = true;
    easel.traverse(child => { if (child.isMesh) child.receiveShadow = true; });
    this.scene.add(easel);
    this.eyeEasel = easel;

    this.drawEyeSheet();
  }

  drawVinylSticker(ctx, x, y, w, h, radius, options = {}) {
    const { selected = false, lift = false } = options;
    ctx.save();
    ctx.shadowColor = 'rgba(58,48,34,.28)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = 'rgba(252,248,240,.55)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();
    const gloss = ctx.createLinearGradient(x, y + h, x + w, y);
    gloss.addColorStop(0, 'rgba(255,255,255,.05)');
    gloss.addColorStop(.42, 'rgba(255,255,255,.3)');
    gloss.addColorStop(.56, 'rgba(255,255,255,.06)');
    gloss.addColorStop(.8, 'rgba(255,255,255,.22)');
    gloss.addColorStop(1, 'rgba(255,255,255,.04)');
    ctx.fillStyle = gloss;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = selected ? 'rgba(148,111,56,.6)' : 'rgba(118,98,72,.28)';
    ctx.lineWidth = selected ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 5, w - 10, h - 10, Math.max(2, radius - 4));
    ctx.stroke();
    ctx.setLineDash([]);
    if (lift) {
      const c = Math.min(w, h) * .2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + w - c, y + h);
      ctx.quadraticCurveTo(x + w - c * .3, y + h - c * .5, x + w, y + h - c);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(224,213,190,.9)';
      ctx.shadowColor = 'rgba(58,48,34,.3)';
      ctx.shadowBlur = 7;
      ctx.fill();
      ctx.restore();
    }
  }

  drawEyeSheet() {
    if (!this.eyeContext) return;
    const ctx = this.eyeContext;
    const width = 640;
    const height = 480;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(247,242,231,.34)';
    ctx.fillRect(0, 0, width, height);
    const sheen = ctx.createLinearGradient(0, 0, width, height);
    sheen.addColorStop(0, 'rgba(255,255,255,.26)');
    sheen.addColorStop(.45, 'rgba(255,255,255,.04)');
    sheen.addColorStop(.68, 'rgba(255,255,255,.18)');
    sheen.addColorStop(1, 'rgba(255,255,255,.02)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(112,102,84,.22)';
    ctx.lineWidth = 3;
    ctx.strokeRect(7, 7, width - 14, height - 14);
    EYES.forEach((eye, index) => {
      const cx = width * (index + .5) / EYES.length;
      const selected = eye.id === this.activeEye;
      this.drawVinylSticker(ctx, cx - 64, 92, 128, 302, 20, { selected, lift: selected });
      drawEyePair(ctx, cx, 238, eye.id);
      ctx.fillStyle = '#6a6153';
      ctx.font = '500 30px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(eye.name, cx, 362);
    });
    this.eyeTexture.needsUpdate = true;
    this.requestRender();
  }

  setActiveWood(key) {
    const chip = this.woodChips?.[key];
    if (!chip) return;
    this.woodRing.position.set(chip.position.x, .002, chip.position.z);
    this.woodRing.visible = true;
    this.requestRender();
  }

  setActiveBrush(key) {
    Object.entries(this.jarBrushes || {}).forEach(([name, material]) => {
      material.emissive?.set(name === key ? '#8a6a32' : '#000000');
      material.emissiveIntensity = name === key ? .4 : 0;
    });
    this.requestRender();
  }

  setActiveStamp(id) {
    this.activeStamp = id;
    Object.entries(this.stampRings || {}).forEach(([name, ring]) => {
      ring.visible = name === id;
    });
    this.buildStampCursor(id);
    this.requestRender();
  }

  buildStampCursor(id) {
    if (!this.stampCursor) return;
    for (const child of [...this.stampCursor.children]) {
      child.geometry?.dispose();
      this.stampCursor.remove(child);
    }
    const body = new THREE.Mesh(leatherPunchBody(id, .14), this.stampPadMaterial);
    body.position.y = .018;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.024, .03, .07, 16), this.stampSteelMaterial);
    stem.position.y = .21;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.046, 18, 12), this.stampWoodMaterial);
    knob.scale.y = .74;
    knob.position.y = .26;
    const icon = new THREE.Mesh(new THREE.CircleGeometry(.031, 18), new THREE.MeshBasicMaterial({ map: stampIconTexture(id), transparent: true, depthWrite: false, color: '#2b2117' }));
    icon.rotation.x = -Math.PI / 2;
    icon.position.y = .294;
    [body, stem, knob].forEach(mesh => { mesh.castShadow = true; });
    this.stampCursor.add(body, stem, knob, icon);
  }

  setActiveEye(id) {
    this.activeEye = id;
    this.drawEyeSheet();
  }

  setActiveShape(key) {
    Object.entries(this.shapeBlanks || {}).forEach(([name, blank]) => {
      blank.material.emissive.set(name === key ? '#b98f52' : '#000000');
      blank.material.emissiveIntensity = name === key ? .22 : 0;
    });
    this.requestRender();
  }

  setActiveFinish(key) {
    Object.entries(this.finishMaterials || {}).forEach(([name, material]) => {
      material.emissive.set(name === key ? '#c9a05c' : '#000000');
      material.emissiveIntensity = name === key ? .3 : 0;
    });
    this.requestRender();
  }

  makeBrushModel(handleColor = '#2e5042', active = true, type = 'round') {
    const group = new THREE.Group();
    const handlePoints = [new THREE.Vector2(.025, .38), new THREE.Vector2(.043, .48), new THREE.Vector2(.047, .85), new THREE.Vector2(.031, 1.7), new THREE.Vector2(.018, 1.78), new THREE.Vector2(0, 1.8)];
    const handle = new THREE.Mesh(new THREE.LatheGeometry(handlePoints, 24), new THREE.MeshPhysicalMaterial({ color: handleColor, roughness: .26, clearcoat: .7, clearcoatRoughness: .18 }));
    handle.castShadow = true;
    group.add(handle);
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(type === 'wash' ? .066 : .052, type === 'wash' ? .06 : .046, .25, 24), new THREE.MeshStandardMaterial({ color: '#b6b4aa', roughness: .22, metalness: .88 }));
    ferrule.position.y = .285;
    group.add(ferrule);
    for (const y of [.19, .36]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(type === 'wash' ? .064 : .05, .006, 6, 24), new THREE.MeshStandardMaterial({ color: '#777971', roughness: .25, metalness: .85 }));
      band.rotation.x = Math.PI / 2; band.position.y = y; group.add(band);
    }
    if (active) {
      this.brushTipMaterial = new THREE.MeshStandardMaterial({ color: PIGMENTS[0].hex, roughness: .62 });
      this.bristleType = type;
      this.bristle = this.makeBristle(type, this.brushTipMaterial);
      group.add(this.bristle);
    } else {
      group.add(this.makeBristle(type, new THREE.MeshStandardMaterial({ color: '#514235', roughness: .8 })));
    }
    return group;
  }

  makeBristle(type, material) {
    let geometry, height, rest = 1;
    if (type === 'wash') { geometry = new THREE.BoxGeometry(.24, .2, .05); height = .2; rest = .86; }
    else if (type === 'flat') { geometry = new THREE.BoxGeometry(.13, .19, .035); height = .19; }
    else if (type === 'blush') { geometry = new THREE.SphereGeometry(.09, 20, 16); height = .18; rest = 1.35; }
    else if (type === 'liner') { geometry = new THREE.ConeGeometry(.022, .27, 24); height = .27; }
    else { geometry = new THREE.ConeGeometry(.052, .2, 24); height = .2; }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = type === 'flat' || type === 'blush' || type === 'wash' ? 0 : Math.PI;
    mesh.userData.rest = rest;
    mesh.userData.half = height * .5;
    mesh.userData.tip = type === 'liner' ? -.1 : type === 'flat' ? -.02 : type === 'wash' ? -.015 : -.035;
    this.placeBristle(mesh, 0);
    return mesh;
  }

  placeBristle(mesh, load) {
    if (!mesh) return;
    const pressed = THREE.MathUtils.clamp(load, 0, 1.3);
    const squash = mesh.userData.rest * (1 - pressed * .26);
    const splay = 1 + pressed * .45;
    mesh.scale.set(splay, squash, splay);
    mesh.position.y = mesh.userData.tip + mesh.userData.half * squash;
  }

  createBrushCursor() {
    this.brush = this.makeBrushModel('#2e5042', true);
    this.brush.scale.setScalar(.6);
    this.brush.visible = false;
    this.scene.add(this.brush);
  }

  createToolCursors() {
    this.stampCursor = new THREE.Group();
    this.stampPadMaterial = new THREE.MeshStandardMaterial({ color: PIGMENTS[0].hex, roughness: .74, metalness: .05 });
    this.stampWoodMaterial = new THREE.MeshPhysicalMaterial({ color: '#8b6947', roughness: .34, clearcoat: .42 });
    this.stampSteelMaterial = new THREE.MeshStandardMaterial({ color: '#b18d61', roughness: .38, metalness: .45 });
    this.stampCursor.scale.setScalar(1);
    this.stampCursor.visible = false;
    this.scene.add(this.stampCursor);
    this.buildStampCursor(this.activeStamp || 'daisy');

    this.stickerCursor = new THREE.Group();
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = sheetCanvas.height = 160;
    this.stickerCtx = sheetCanvas.getContext('2d');
    this.stickerTexture = new THREE.CanvasTexture(sheetCanvas);
    this.stickerTexture.colorSpace = THREE.SRGBColorSpace;
    const film = new THREE.Mesh(new THREE.BoxGeometry(.232, .005, .232), new THREE.MeshPhysicalMaterial({
      color: '#fffaf0', transparent: true, opacity: .42, roughness: .16, clearcoat: 1, clearcoatRoughness: .06
    }));
    film.position.y = .0025;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.21, .21), new THREE.MeshBasicMaterial({ map: this.stickerTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    face.rotation.x = -Math.PI / 2;
    face.position.y = .0054;
    this.stickerCursor.add(film, face);
    this.stickerCursor.visible = false;
    this.scene.add(this.stickerCursor);
  }

  setTool(tool) {
    this.activeTool = tool;
    if (tool !== 'brush' && tool !== 'eraser') this.hideBrush();
    this.requestRender();
  }

  setEyePreview(canvas) {
    if (!this.stickerCtx) return;
    this.stickerCtx.clearRect(0, 0, 160, 160);
    this.drawVinylSticker(this.stickerCtx, 6, 6, 148, 148, 26, { selected: true, lift: true });
    if (canvas) this.stickerCtx.drawImage(canvas, 20, 20, 120, 120);
    this.stickerTexture.needsUpdate = true;
    this.requestRender();
  }

  createCursorRings() {
    this.rings = [];
    const geometry = new THREE.RingGeometry(.83, 1, 40);
    for (let i = 0; i < 8; i++) {
      const ring = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#f7f0df', side: THREE.DoubleSide, transparent: true, opacity: .8, depthTest: false }));
      ring.visible = false;
      ring.renderOrder = 20;
      this.scene.add(ring);
      this.rings.push(ring);
    }
  }

  setBrushType(type) {
    if (this.bristleType === type) return;
    this.bristleType = type;
    this.brush.remove(this.bristle);
    this.bristle.geometry.dispose();
    this.bristle = this.makeBristle(type, this.brushTipMaterial);
    this.brush.add(this.bristle);
    this.requestRender();
  }

  setBrushColor(color) {
    this.brushTipMaterial.color.set(color);
    this.stampPadMaterial?.color.set(color);
    this.requestRender();
  }

  showBrushAt(hit, radius, color, mode = 'free', count = 4, dx = 0, dy = 0, load = 0) {
    if (this.dipAnimation) return;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    this.brush.visible = false;
    this.stampCursor.visible = false;
    this.stickerCursor.visible = false;
    const cursor = this.activeTool === 'stamp' ? this.stampCursor : this.activeTool === 'sticker' ? this.stickerCursor : this.brush;
    cursor.visible = true;
    cursor.position.copy(hit.point).addScaledVector(normal, .018);
    if (this.activeTool === 'brush' || this.activeTool === 'eraser') {
      cursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.brushAim(normal, dx, dy, load));
      if (this.bristleType === 'flat' || this.bristleType === 'wash') cursor.rotateY(this.brushRoll());
      this.placeBristle(this.bristle, load);
    } else {
      const aim = this.activeTool === 'stamp'
        ? normal.clone().addScaledVector(new THREE.Vector3(0, 1, 0), .2).normalize()
        : normal;
      cursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim);
    }
    this.brushTipMaterial.color.set(color);
    this.stampPadMaterial.color.set(color);

    const localPoint = this.doll.group.worldToLocal(hit.point.clone());
    const inverse = this.doll.group.matrixWorld.clone().invert();
    const localNormal = normal.clone().transformDirection(inverse);
    const positions = [{ point: localPoint, normal: localNormal }];
    if (mode === 'mirror') {
      positions.push({ point: new THREE.Vector3(-localPoint.x, localPoint.y, localPoint.z), normal: new THREE.Vector3(-localNormal.x, localNormal.y, localNormal.z) });
    } else if (mode === 'radial') {
      for (let i = 1; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        positions.push({
          point: localPoint.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle),
          normal: localNormal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
        });
      }
    }
    this.rings.forEach((ring, index) => {
      if (index >= positions.length || mode === 'lathe') { ring.visible = false; return; }
      const item = positions[index];
      const worldPoint = this.doll.group.localToWorld(item.point.clone());
      const worldNormal = item.normal.transformDirection(this.doll.group.matrixWorld);
      ring.visible = true;
      ring.position.copy(worldPoint).addScaledVector(worldNormal, .012);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
      ring.scale.setScalar(radius);
      ring.material.color.set(color);
    });
    this.requestRender();
  }

  brushAim(normal, dx, dy, load) {
    if (!this.brushTangent) this.brushTangent = new THREE.Vector3();
    if (!this.brushAimVec) this.brushAimVec = normal.clone();
    if (Math.hypot(dx, dy) > .3) {
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      const tangent = right.multiplyScalar(dx).addScaledVector(up, -dy);
      tangent.addScaledVector(normal, -tangent.dot(normal));
      if (tangent.lengthSq() > 1e-6) this.brushTangent.copy(tangent.normalize());
    }
    const tilt = .3 + load * .5;
    const goal = normal.clone()
      .addScaledVector(this.brushTangent, -tilt)
      .addScaledVector(new THREE.Vector3(0, 1, 0), tilt * .45)
      .normalize();
    return this.brushAimVec.lerp(goal, .3).normalize();
  }

  brushRoll() {
    if (!this.brushTangent || this.brushTangent.lengthSq() < .1) return this.brushRollValue || 0;
    const local = this.brushTangent.clone().applyQuaternion(this.brush.quaternion.clone().invert());
    if (Math.hypot(local.x, local.z) < .05) return this.brushRollValue || 0;
    let goal = Math.atan2(local.x, local.z) - Math.PI / 2;
    goal = (((goal + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI - Math.PI / 2;
    const current = this.brushRollValue ?? goal;
    this.brushRollValue = current + (((goal - current + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2) * .25;
    return this.brushRollValue;
  }

  hideBrush() {
    this.brush.visible = false;
    if (this.stampCursor) this.stampCursor.visible = false;
    if (this.stickerCursor) this.stickerCursor.visible = false;
    this.rings.forEach(ring => { ring.visible = false; });
    this.requestRender();
  }

  setPressure(load = 0) {
    this.placeBristle(this.bristle, load);
    const pressed = load > .25;
    if (this.stampCursor) this.stampCursor.scale.y = pressed ? .74 : 1;
    if (this.stickerCursor) this.stickerCursor.scale.y = pressed ? .7 : 1;
    this.requestRender();
  }

  dip(index, color) {
    const well = this.wells[index % this.wells.length];
    if (!well) return;
    this.hideBrush();
    this.dipAnimation = { start: performance.now(), well, color };
    this.setBrushColor(color);
    this.rings.forEach(ring => { ring.visible = false; });
    this.requestRender();
  }

  rinse() {
    this.hideBrush();
    this.dipAnimation = { start: performance.now(), well: this.water, color: '#b9c7bc', rinse: true };
    this.rings.forEach(ring => { ring.visible = false; });
    this.requestRender();
  }

  updateDip(now) {
    if (!this.dipAnimation) return;
    const { start, well, color, rinse } = this.dipAnimation;
    const t = (now - start) / 1050;
    const target = well.getWorldPosition(new THREE.Vector3());
    this.brush.visible = true;
    this.brush.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-.14, 1, .08).normalize());
    if (t < .34) {
      const p = t / .34;
      this.brush.position.copy(target).add(new THREE.Vector3(-.25 * (1 - p), .25 + (1 - p) * .9, .15 * (1 - p)));
    } else if (t < .58) {
      const p = (t - .34) / .24;
      this.brush.position.copy(target).add(new THREE.Vector3(0, .25 - Math.sin(p * Math.PI) * .18, 0));
      if (well.material && !rinse) well.material.emissive?.set(color);
    } else {
      const p = (t - .58) / .42;
      this.brush.position.copy(target).add(new THREE.Vector3(-.2 * p, .25 + p * .7, .12 * p));
    }
    if (well.material?.emissive) well.material.emissive.multiplyScalar(.88);
    if (t >= 1) {
      if (well.material?.emissive) well.material.emissive.set(0);
      this.dipAnimation = null;
      this.brush.visible = false;
    }
  }

  nudge(direction) {
    this.rotationGoal += direction * Math.PI / 4;
    this.requestRender();
  }

  setAutoRotate(active) {
    this.autoRotate = active;
    this.requestRender();
  }

  rotateBy(delta) {
    this.rotationGoal += delta;
    this.requestRender();
  }

  zoom(delta) {
    const direction = this.cameraGoal.clone().sub(this.cameraTarget);
    const min = Math.max(1, (this.doll.worldHeight || 3.5) * 1.02);
    const distance = THREE.MathUtils.clamp(direction.length() * (1 + delta * .001), min, 26);
    direction.setLength(distance);
    this.cameraGoal.copy(this.cameraTarget).add(direction);
    this.requestRender();
  }

  setView(view) {
    this.viewMode = view === 'front' ? 'front' : 'three-quarter';
    this.fitView();
  }

  fitView() {
    const metrics = this.doll.metrics || {};
    const scale = this.doll.group.scale.x || 1;
    const top = .235 + (metrics.headTop ?? 3.44) * scale + .06;
    const bottom = .05;
    const height = top - bottom;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = Math.max(.6, this.camera.aspect);
    const radius = (metrics.baseRadius ?? .78) * scale;
    const vertical = height * .5 * 1.5 / Math.tan(fov / 2);
    const horizontal = radius * 1.7 / (Math.tan(fov / 2) * aspect);
    const workbench = 2.5 / (Math.tan(fov / 2) * aspect);
    const distance = THREE.MathUtils.clamp(Math.max(vertical, horizontal, workbench), 1.2, 26);
    this.fitTurntable();
    this.cameraTarget.set(.2, (top + bottom) * .5, 0);
    const direction = this.viewMode === 'front' ? new THREE.Vector3(0, .19, .98) : new THREE.Vector3(.4, .21, .89);
    this.cameraGoal.copy(this.cameraTarget).addScaledVector(direction.normalize(), distance);
    this.requestRender();
  }

  requestRender() {
    this.needsRender = true;
  }

  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.requestRender();
  }

  update(now = performance.now()) {
    let active = false;
    if (this.autoRotate && !this.dipAnimation) {
      this.rotationGoal += .0014;
      active = true;
    }
    const rotationDelta = this.rotationGoal - this.rotator.rotation.y;
    if (Math.abs(rotationDelta) > .00002) {
      this.rotator.rotation.y += rotationDelta * .085;
      active = true;
    } else {
      this.rotator.rotation.y = this.rotationGoal;
    }
    if (this.camera.position.distanceToSquared(this.cameraGoal) > 1e-7) {
      this.camera.position.lerp(this.cameraGoal, .075);
      active = true;
    }
    if (this.lookAt.distanceToSquared(this.cameraTarget) > 1e-7) {
      this.lookAt.lerp(this.cameraTarget, .075);
      active = true;
    }
    if (this.dipAnimation) {
      this.updateDip(now);
      active = true;
    }
    if (!active && !this.needsRender) return;
    this.camera.lookAt(this.lookAt);
    this.renderer.render(this.scene, this.camera);
    this.needsRender = false;
  }

  takePhoto() {
    const brushVisible = this.brush.visible;
    this.brush.visible = false;
    this.rings.forEach(ring => { ring.visible = false; });
    this.renderer.render(this.scene, this.camera);
    const data = this.renderer.domElement.toDataURL('image/png');
    this.brush.visible = brushVisible;
    this.requestRender();
    return data;
  }
}
