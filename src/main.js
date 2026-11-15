import * as THREE from 'three';
import { createIcons, icons } from 'lucide';
import './style.css';
import { PegDoll, WOODS, FORMS, FORM_PRESETS, SIZE_LIMITS } from './doll.js';
import { ProfileEditor } from './profile-editor.js';
import { PaintSurface, BRUSHES, PIGMENTS, STAMPS, EYES, resolveSymmetry } from './paint.js';
import { Studio } from './studio.js';

const FINISH_LABELS = { raw: '素木', wax: '蜂蜡', gloss: '亮漆' };

class SoundKit {
  constructor() { this.context = null; }
  ensure() {
    if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
    if (this.context.state === 'suspended') this.context.resume();
  }
  tone(from, to, duration, volume = .025, type = 'sine') {
    try {
      this.ensure();
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, now);
      oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch { /* Audio is a progressive enhancement. */ }
  }
  click() { this.tone(480, 340, .045, .012, 'triangle'); }
  dip() { this.tone(760, 260, .16, .018); }
  stamp() { this.tone(170, 100, .07, .018, 'triangle'); }
  success() { this.tone(620, 880, .14, .018); }
}

class DollMakerApp {
  constructor() {
    this.doll = new PegDoll();
    this.paint = new PaintSurface(this.doll);
    this.doll.setPaintCanvas(this.paint.canvas);
    this.doll.setPhysCanvas(this.paint.physCanvas);
    this.studio = new Studio(document.getElementById('scene-container'), this.doll);
    this.sound = new SoundKit();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.painting = false;
    this.rotating = false;
    this.pointerId = null;
    this.lastX = 0;
    this.lastY = 0;
    this.tool = 'brush';
    this.brush = 'round';
    this.brushSize = 14;
    this.water = 0.42;
    this.usePressure = false;
    this.load = 0;
    this.loadTarget = 0;
    this.strokeStarted = 0;
    this.lastMoveAt = 0;
    this.pointerSpeed = 0;
    this.ruler = null;
    this.physClock = 0;
    this.symmetry = 'mirror';
    this.radialCount = 4;
    this.pigments = PIGMENTS.map(pigment => ({ ...pigment }));
    this.pigmentIndex = 0;
    this.color = PIGMENTS[0].hex;
    this.colorName = PIGMENTS[0].name;
    this.brushClean = false;
    this.selectedStamp = 'daisy';
    this.selectedEye = 'sleepy';
    this.name = '春日雏菊';
    this.toastTimer = null;
    this.colorHue = .02;
    this.colorSaturation = .64;
    this.colorValue = .72;
    this.savedImage = null;
    this.bindScene();
    this.bindUI();
    this.bindDrawers();
    this.guardBrowserGestures();
    this.renderPigments();
    this.renderAccessories();
    this.paint.applyPreset('nordic');
    this.doll.updateTexture();
    this.studio.setBrushType(this.brush);
    this.$('#brush-illustration').dataset.brush = this.brush;
    this.setPigment(0, false);
    this.studio.setActiveWood(this.doll.woodKey);
    this.studio.setActiveBrush(this.brush);
    this.studio.setActiveStamp(this.selectedStamp);
    this.studio.setActiveEye(this.selectedEye);
    this.studio.setActiveShape(this.doll.shapeKey);
    this.studio.setActiveFinish(this.doll.finishKey);
    this.profileEditor = new ProfileEditor(this.$('#profile-editor'), {
      getParams: () => this.doll.shapeParams,
      onPatch: patch => this.setShapeParams(patch),
      onDragStart: () => this.beginProfileDrag(),
      onDragEnd: () => this.endProfileDrag()
    });
    this.refreshHistory();
    this.updateLabels();
    this.syncShapeParams();
    this.updateFoldSummaries();
    this.loadSaved();
    this.createWheel();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
    createIcons({ icons });
  }

  guardBrowserGestures() {
    const isEditable = target => target instanceof Element && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    document.addEventListener('contextmenu', event => {
      if (!isEditable(event.target)) event.preventDefault();
    });
    document.addEventListener('dragstart', event => event.preventDefault());
    document.addEventListener('selectstart', event => {
      if (!isEditable(event.target)) event.preventDefault();
    });
    document.addEventListener('gesturestart', event => event.preventDefault());
    document.addEventListener('gesturechange', event => event.preventDefault());
    document.addEventListener('auxclick', event => {
      if (event.button === 1) event.preventDefault();
    });
    window.addEventListener('wheel', event => {
      if (event.ctrlKey) event.preventDefault();
    }, { passive: false });
    window.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && ['+', '-', '=', '0'].includes(event.key)) event.preventDefault();
    }, { passive: false });
  }

  $(selector) { return document.querySelector(selector); }
  $$(selector) { return [...document.querySelectorAll(selector)]; }

  bindScene() {
    const canvas = this.studio.renderer.domElement;
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => this.onPointerDown(event));
    window.addEventListener('pointermove', event => this.onPointerMove(event));
    window.addEventListener('pointerup', event => this.onPointerUp(event));
    canvas.addEventListener('pointerleave', () => { if (!this.painting && !this.rotating) this.studio.hideBrush(); });
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.studio.zoom(event.deltaY);
    }, { passive: false });
  }

  updatePointer(event) {
    const rect = this.studio.renderer.domElement.getBoundingClientRect();
    this.pointer.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    this.pointer.y = -(event.clientY - rect.top) / rect.height * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.studio.camera);
  }

  raycastDoll() {
    this.doll.mesh.updateWorldMatrix(true, false);
    return this.raycaster.intersectObject(this.doll.mesh, false)[0] || null;
  }

  raycastProp() {
    return this.raycaster.intersectObjects(this.studio.interactive, false)[0] || null;
  }

  onPointerDown(event) {
    this.sound.ensure();
    this.updatePointer(event);
    this.pointerId = event.pointerId;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.lastMoveAt = performance.now();
    this.strokeStarted = performance.now();
    this.load = 0.3;
    this.loadTarget = 0.5;
    this.studio.setAutoRotate(false);
    this.$('#auto-rotate').classList.remove('active');

    if (event.button !== 0 || event.altKey || this.$('#workspace').dataset.spaceHeld === 'true') {
      this.rotating = true;
      return;
    }

    const dollHit = this.raycastDoll();
    if (dollHit?.uv) {
      event.preventDefault();
      if (event.shiftKey && (this.tool === 'brush' || this.tool === 'eraser')) {
        this.beginRuler(dollHit);
        return;
      }
      this.painting = true;
      this.studio.setPressure(this.load);
      this.paintAtHit(dollHit, true);
      this.studio.renderer.domElement.setPointerCapture?.(event.pointerId);
      return;
    }

    const propHit = this.raycastProp();
    if (propHit) {
      const data = propHit.object.userData;
      if (data.type === 'pigment') {
        this.setPigment(data.index, true);
        return;
      }
      if (data.type === 'rinse') {
        this.rinseBrush();
        return;
      }
      if (data.type === 'wood') {
        this.setWood(data.key);
        return;
      }
      if (data.type === 'finish') {
        this.setFinish(data.key);
        this.showToast(`表面换成${FINISH_LABELS[data.key]}`);
        return;
      }
      if (data.type === 'brush') {
        this.selectBrush(data.key);
        this.sound.click();
        return;
      }
      if (data.type === 'stamp') {
        this.selectedStamp = data.stamp;
        this.setTool('stamp');
        this.sound.click();
        this.showToast(`拿起${STAMPS.find(stamp => stamp.id === data.stamp)?.name || ''}海绵章`);
        return;
      }
      if (data.type === 'eye') {
        this.selectedEye = data.eye;
        this.setTool('sticker');
        this.studio.setEyePreview(this.paint.createEyeDecal(this.selectedEye, '#39342E'));
        this.sound.click();
        this.showToast('这张眼睛贴纸已拿起，轻点木偶脸部');
        return;
      }
      if (data.type === 'shape') {
        this.setShape(data.key);
        return;
      }
    }

    this.rotating = true;
    this.studio.hideBrush();
  }

  onPointerMove(event) {
    this.updatePointer(event);
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;

    if (this.rotating) {
      this.studio.rotateBy(dx * .012);
      return;
    }

    if (this.ruler) {
      this.trackPointer(event, dx, dy);
      const hit = this.raycastDoll();
      if (hit?.uv) this.ruler.to = { u: hit.uv.x, v: hit.uv.y };
      this.updateRulerPreview();
      return;
    }

    if (this.painting) {
      this.trackPointer(event, dx, dy);
      const hit = this.raycastDoll();
      if (hit?.uv) {
        this.paintAtHit(hit, false);
        this.studio.showBrushAt(hit, this.cursorRadius(), this.color, this.symmetry, this.radialCount, dx, dy, this.load);
      } else {
        this.studio.hideBrush();
      }
      return;
    }

    const hit = this.raycastDoll();
    if (hit) {
      this.studio.showBrushAt(hit, this.cursorRadius(), this.color, this.symmetry, this.radialCount, dx, dy, 0.2);
      this.studio.renderer.domElement.style.cursor = 'none';
    } else {
      this.studio.hideBrush();
      this.studio.renderer.domElement.style.cursor = this.raycastProp() ? 'pointer' : 'grab';
    }
  }

  trackPointer(event, dx, dy) {
    const now = performance.now();
    const delta = Math.max(8, now - this.lastMoveAt);
    this.pointerSpeed = Math.hypot(dx, dy) / delta;
    this.lastMoveAt = now;
    const stylus = this.usePressure && event.pointerType === 'pen' && event.pressure > 0;
    if (stylus) {
      this.loadTarget = Math.max(0.1, Math.min(1.3, event.pressure * 1.25));
    } else {
      const dwell = Math.min(1, (now - this.strokeStarted) / 420);
      const ease = THREE.MathUtils.clamp(1 - this.pointerSpeed / 1.9, 0.22, 1);
      this.loadTarget = this.usePressure
        ? 0.3 + Math.min(1, (event.pressure ?? 0.5) * 1.1) * 0.7
        : 0.34 + dwell * 0.66 * ease;
    }
    this.load += (this.loadTarget - this.load) * 0.3;
  }

  worldToScreen(point) {
    const vector = point.clone().project(this.studio.camera);
    const rect = this.studio.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + (vector.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-vector.y * 0.5 + 0.5) * rect.height
    };
  }

  beginRuler(hit) {
    this.ruler = {
      from: { u: hit.uv.x, v: hit.uv.y },
      to: { u: hit.uv.x, v: hit.uv.y },
      origin: this.worldToScreen(hit.point)
    };
    this.paint.beginPreview();
    this.studio.hideBrush();
    this.updateRulerPreview();
    this.showToast('直尺模式：拖动定方向，松手落笔');
  }

  updateRulerPreview() {
    const guide = this.$('#guide-layer');
    if (!guide || !this.ruler) return;
    const rect = this.studio.renderer.domElement.getBoundingClientRect();
    const from = this.ruler.origin;
    const to = { x: this.lastX, y: this.lastY };
    const line = guide.querySelector('line');
    line.setAttribute('x1', from.x - rect.left);
    line.setAttribute('y1', from.y - rect.top);
    line.setAttribute('x2', to.x - rect.left);
    line.setAttribute('y2', to.y - rect.top);
    guide.classList.add('active');
    const config = this.strokeConfig();
    this.paint.drawPreviewLine(this.ruler.from, this.ruler.to, config);
    this.doll.updateTexture();
  }

  endRuler(commit) {
    if (!this.ruler) return;
    this.ruler = null;
    this.$('#guide-layer')?.classList.remove('active');
    this.paint.commitPreview(commit);
    this.doll.updateTexture();
    this.refreshHistory();
  }

  onPointerUp(event) {
    if (this.ruler) {
      const moved = Math.hypot(event.clientX - this.ruler.origin.x, event.clientY - this.ruler.origin.y);
      this.endRuler(moved > 3);
    }
    if (this.painting) {
      this.paint.endStroke();
      this.painting = false;
      this.load = 0;
      this.studio.setPressure(0);
      this.refreshHistory();
    }
    this.rotating = false;
    this.pointerId = null;
    this.studio.renderer.domElement.style.cursor = 'default';
  }

  cursorRadius() {
    const splay = 0.66 + (this.painting ? this.load : 0.2) * 0.52;
    return Math.max(.018, this.brushSize * splay / 650);
  }

  strokeConfig() {
    return {
      tool: this.tool,
      brush: this.brush,
      color: this.tool === 'sticker' ? '#39342E' : this.color,
      size: this.brushSize,
      water: this.water,
      load: this.painting || this.ruler ? this.load : 0.45,
      mode: this.symmetry,
      count: this.radialCount,
      stamp: this.selectedStamp,
      eye: this.selectedEye
    };
  }

  paintAtHit(hit, first) {
    if (this.tool === 'stamp' || this.tool === 'sticker') {
      if (!first) return;
      const points = resolveSymmetry(hit.uv, this.symmetry, this.radialCount);
      this.paint.stampAt(points, this.strokeConfig());
      this.doll.updateTexture();
      this.refreshHistory();
      this.sound.stamp();
      return;
    }

    if (this.tool === 'brush' && this.brushClean) {
      this.showToast('笔尖已洗净，先去颜料盒蘸一点颜色');
      this.painting = false;
      return;
    }

    const points = this.symmetry === 'lathe'
      ? [{ u: hit.uv.x, v: hit.uv.y }]
      : resolveSymmetry(hit.uv, this.symmetry, this.radialCount);
    const config = this.strokeConfig();
    if (first) this.paint.beginStroke(points, config);
    else this.paint.continueStroke(points, config);
    this.doll.updateTexture();
  }

  bindDrawers() {
    const body = document.body;
    const close = () => body.classList.remove('drawer-left', 'drawer-right');
    const open = side => {
      close();
      body.classList.add(`drawer-${side}`);
      this.sound.click();
    };
    this.$('#drawer-left-toggle')?.addEventListener('click', () => open('left'));
    this.$('#drawer-right-toggle')?.addEventListener('click', () => open('right'));
    this.$('#drawer-backdrop')?.addEventListener('click', close);
    this.$$('[data-close-drawer]').forEach(button => button.addEventListener('click', () => {
      close();
      this.sound.click();
    }));
    this.$$('.panel').forEach(panel => panel.addEventListener('click', event => {
      if (event.target.closest('.wood-card, [data-form], [data-finish], [data-brush], .paint-well, [data-stamp], [data-eye]')) close();
    }));
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && (body.classList.contains('drawer-left') || body.classList.contains('drawer-right'))) close();
    });
    this.closeDrawers = close;
  }

  bindUI() {
    this.$$('.fold-toggle').forEach(button => button.addEventListener('click', () => {
      const fold = button.closest('.fold');
      const open = !fold.classList.contains('open');
      fold.classList.toggle('open', open);
      button.setAttribute('aria-expanded', String(open));
      this.sound.click();
    }));

    this.$$('.tool-button').forEach(button => button.addEventListener('click', () => {
      this.sound.click();
      this.setTool(button.dataset.tool);
    }));

    this.$$('.symmetry-group [data-mode]').forEach(button => button.addEventListener('click', event => {
      const mode = button.dataset.mode;
      this.setSymmetry(mode);
      if (mode === 'radial') this.$('#radial-menu').classList.toggle('open');
      else this.$('#radial-menu').classList.remove('open');
      this.sound.click();
      event.stopPropagation();
    }));

    this.$$('#radial-menu [data-count]').forEach(button => button.addEventListener('click', () => {
      this.radialCount = Number(button.dataset.count);
      this.symmetry = 'radial';
      this.$('#radial-count-label').textContent = this.radialCount;
      this.$$('#radial-menu [data-count]').forEach(item => item.classList.toggle('active', item === button));
      this.updateSymmetryUI();
      this.$('#radial-menu').classList.remove('open');
      this.sound.click();
      this.showToast(`环向重复已设为 ${this.radialCount} 头`);
    }));

    document.addEventListener('click', event => {
      if (!event.target.closest('#radial-menu') && !event.target.closest('#radial-button')) {
        this.$('#radial-menu').classList.remove('open');
      }
    });

    this.$$('.wood-card').forEach(button => button.addEventListener('click', () => this.setWood(button.dataset.wood)));
    this.$$('#form-options [data-form]').forEach(button => button.addEventListener('click', () => this.setShape(button.dataset.form)));
    this.$$('#finish-options [data-finish]').forEach(button => button.addEventListener('click', () => this.setFinish(button.dataset.finish)));
    this.$$('[data-profile]').forEach(input => {
      input.addEventListener('pointerdown', () => this.beginProfileDrag());
      input.addEventListener('input', () => this.setShapeParams({ [input.dataset.profile]: Number(input.value) }));
    });
    this.$('#size-input').addEventListener('input', event => {
      this.doll.setSize(Number(event.target.value));
      this.syncShapeParams();
      this.studio.fitView();
      this.updateFoldSummaries();
    });
    this.$('#reset-shape').addEventListener('click', () => {
      this.doll.setShapeParams({ ...FORM_PRESETS[this.doll.shapeKey] });
      this.syncShapeParams();
      this.refreshPresetLayout();
      this.studio.fitView();
      this.sound.click();
      this.showToast('横截面已复原，脖子归零');
    });
    this.$('#immersive-toggle').addEventListener('click', () => this.toggleImmersive());

    this.$$('#brush-list [data-brush]').forEach(button => button.addEventListener('click', () => {
      this.selectBrush(button.dataset.brush);
      this.sound.click();
    }));
    this.$('#brush-size').addEventListener('input', event => {
      this.brushSize = Number(event.target.value);
      this.$('#brush-size-value').textContent = this.brushSize;
      this.updateFoldSummaries();
    });
    this.$('#water-input').addEventListener('input', event => {
      this.water = Number(event.target.value) / 100;
      this.$('#water-value').textContent = `${Math.round(this.water * 100)}%`;
      this.$('#water-note').textContent = this.water > 0.66
        ? '水多：颜色更透、会化开，干得慢'
        : this.water > 0.33 ? '适中：铺色与边界比较平衡' : '水少：膏体厚，笔触留痕、几乎不化开';
      this.sound.click();
    });
    this.$('#pressure-toggle').addEventListener('click', () => {
      this.usePressure = !this.usePressure;
      const button = this.$('#pressure-toggle');
      button.classList.toggle('active', this.usePressure);
      button.setAttribute('aria-pressed', String(this.usePressure));
      this.showToast(this.usePressure ? '已接入笔压：压得越重，笔头越开' : '改用下笔节奏模拟力度，按住不动会加重');
      this.sound.click();
    });

    this.$('#undo').addEventListener('click', () => {
      if (this.paint.undo()) {
        this.doll.updateTexture();
        this.refreshHistory();
        this.sound.click();
      }
    });
    this.$('#redo').addEventListener('click', () => {
      if (this.paint.redo()) {
        this.doll.updateTexture();
        this.refreshHistory();
        this.sound.click();
      }
    });

    this.$('#rinse-brush').addEventListener('click', () => this.rinseBrush());
    this.$('#open-color-picker').addEventListener('click', event => {
      event.stopPropagation();
      this.openColorPicker();
    });
    this.$('#close-color-picker').addEventListener('click', () => this.closeColorPicker());
    this.$('#add-color').addEventListener('click', () => this.addCustomColor());

    this.colorWheelInteraction();
    this.$('#color-lightness').addEventListener('input', event => {
      this.colorValue = Number(event.target.value) / 100;
      this.updateColorFromWheel();
    });
    this.$('#color-hex-input').addEventListener('change', event => {
      const match = /^#[0-9a-f]{6}$/i.exec(event.target.value.trim());
      if (match) {
        this.color = match[0].toUpperCase();
        this.colorName = '调和色';
        this.updateMixerPreview();
      }
    });

    this.$('#new-piece').addEventListener('click', () => {
      this.paint.clear();
      this.doll.updateTexture();
      this.name = '未命名小品';
      this.updateLabels();
      this.refreshHistory();
      this.showToast('已换上一块素木坯，保留你喜欢的木料');
    });
    this.$('#save-piece').addEventListener('click', () => this.savePiece());
    this.$('#export-piece').addEventListener('click', () => this.takePhoto());
    this.$('#project-name').addEventListener('click', () => this.renamePiece());
    this.$('#inspiration-button').addEventListener('click', () => this.toggleModal(true));
    this.$('#close-inspiration').addEventListener('click', () => this.toggleModal(false));
    this.$('#inspiration-modal .modal-backdrop').addEventListener('click', () => this.toggleModal(false));
    this.$$('.preset-grid [data-preset]').forEach(button => button.addEventListener('click', () => {
      this.paint.applyPreset(button.dataset.preset);
      this.doll.updateTexture();
      this.refreshHistory();
      this.toggleModal(false);
      this.sound.success();
      this.showToast(button.dataset.preset === 'blank' ? '已换成素木坯' : '灵感配色已落到木坯上');
    }));

    this.$('#view-front').addEventListener('click', () => { this.studio.setView('front'); this.sound.click(); });
    this.$('#zoom-fit').addEventListener('click', () => { this.studio.setView('fit'); this.sound.click(); });
    this.$('#rotate-left').addEventListener('click', () => { this.studio.nudge(-1); this.sound.click(); });
    this.$('#rotate-right').addEventListener('click', () => { this.studio.nudge(1); this.sound.click(); });
    this.$('#auto-rotate').addEventListener('click', () => {
      const active = !this.studio.autoRotate;
      this.studio.setAutoRotate(active);
      this.$('#auto-rotate').classList.toggle('active', active);
      this.showToast(active ? '转盘正在缓慢旋转，方便观察背面' : '转盘已停下');
    });

    document.addEventListener('click', event => {
      if (!event.target.closest('#color-popover') && !event.target.closest('#open-color-picker')) this.closeColorPicker();
    });

    window.addEventListener('keydown', event => {
      if (/^(INPUT|TEXTAREA)$/.test(event.target.tagName) || event.target.isContentEditable) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault();
        (event.shiftKey ? this.$('#redo') : this.$('#undo')).click();
      } else if (key === 'b') this.setTool('brush');
      else if (key === 's') this.setTool('stamp');
      else if (key === 'e') this.setTool('sticker');
      else if (key === 'r') this.setTool('eraser');
      else if (key === 'f') this.toggleImmersive();
      else if (key === 'escape' && document.body.classList.contains('immersive')) this.toggleImmersive(false);
      else if (key === '[') this.changeBrushSize(-2);
      else if (key === ']') this.changeBrushSize(2);
      else if (key === ' ') this.$('#workspace').dataset.spaceHeld = 'true';
    });
    window.addEventListener('keyup', event => {
      if (event.key === ' ') this.$('#workspace').dataset.spaceHeld = 'false';
    });
  }

  setTool(tool) {
    this.tool = tool;
    this.$$('.tool-button').forEach(button => button.classList.toggle('active', button.dataset.tool === tool));
    this.studio.setTool(tool);
    this.renderAccessories();
    if (tool === 'sticker') {
      this.studio.setEyePreview(this.paint.createEyeDecal(this.selectedEye, '#39342E'));
      this.studio.setActiveEye(this.selectedEye);
    }
    if (tool === 'stamp') this.studio.setActiveStamp(this.selectedStamp);
    this.updateFoldSummaries();
    if (tool === 'stamp') {
      this.studio.setBrushType?.('round');
      this.showToast('拿起海绵章，在颜料里蘸色后按压木偶');
    } else if (tool === 'sticker') {
      this.showToast('选一款眼睛，轻点木偶脸部贴上去');
    } else if (tool === 'eraser') {
      this.showToast('轻轻擦去色彩，木纹仍在下面');
    }
  }

  setSymmetry(mode) {
    this.symmetry = mode;
    this.updateSymmetryUI();
  }

  updateSymmetryUI() {
    this.$$('.symmetry-group [data-mode]').forEach(button => {
      button.classList.toggle('active', button.dataset.mode === this.symmetry);
    });
  }

  setWood(key) {
    this.doll.setWood(key);
    this.paint.setWoodBase();
    this.doll.updateTexture();
    this.$$('.wood-card').forEach(button => button.classList.toggle('active', button.dataset.wood === key));
    this.$('#wood-detail').textContent = WOODS[key].detail;
    this.studio.setActiveWood(key);
    this.updateLabels();
    this.updateFoldSummaries();
    this.sound.click();
    this.showToast(`换成${WOODS[key].name}，彩绘与木纹都已保留`);
  }

  setShape(key) {
    if (!FORMS[key]) return;
    this.doll.setShape(key);
    this.syncShapeParams();
    this.refreshPresetLayout();
    this.studio.fitView();
    this.studio.setActiveShape(this.doll.shapeKey);
    this.updateLabels();
    this.updateFoldSummaries();
    this.sound.click();
    this.showToast(`已车出${FORMS[this.doll.shapeKey].name}，可在图纸上继续改`);
  }

  setShapeParams(patch) {
    this.doll.setShapeParams(patch);
    this.syncShapeParams();
    if (this.profileDrag) return;
    this.refreshPresetLayout();
    this.studio.fitView();
    this.updateLabels();
  }

  beginProfileDrag() {
    if (this.profileDrag) return;
    this.profileDrag = true;
    this.closeUp = () => this.endProfileDrag();
    window.addEventListener('pointerup', this.closeUp, { once: true });
    window.addEventListener('pointercancel', this.closeUp, { once: true });
    this.doll.setTurnQuality(0.5);
  }

  endProfileDrag() {
    if (!this.profileDrag) return;
    this.profileDrag = false;
    window.removeEventListener('pointerup', this.closeUp);
    window.removeEventListener('pointercancel', this.closeUp);
    this.doll.setTurnQuality(1);
    this.refreshPresetLayout();
    this.studio.fitView();
    this.updateLabels();
    this.updateFoldSummaries();
  }

  refreshPresetLayout() {
    cancelAnimationFrame(this.presetFrame);
    this.presetFrame = requestAnimationFrame(() => {
      if (!this.paint.refreshPreset()) return;
      this.doll.updateTexture();
      this.refreshHistory();
    });
  }

  syncShapeParams() {
    const params = this.doll.shapeParams;
    this.$$('#form-options [data-form]').forEach(button => {
      button.classList.toggle('active', button.dataset.form === this.doll.shapeKey);
    });
    this.$('#size-input').value = this.doll.sizeCm;
    this.$('#size-value').textContent = `${this.doll.sizeCm.toFixed(0)} cm`;
    this.$$('[data-profile]').forEach(input => {
      input.value = params[input.dataset.profile];
    });
    this.$$('[data-profile-value]').forEach(output => {
      const key = output.dataset.profileValue;
      if (key === 'neck') output.textContent = params.neck < 0.004 ? '无' : `${(params.neck * 10).toFixed(1)} cm`;
      else if (key === 'squash') output.textContent = params.squash > 1.08 ? '高颅' : params.squash < 0.92 ? '扁头' : '标准';
      else output.textContent = `${(params[key] * 10).toFixed(1)} cm`;
    });
    this.profileEditor?.render();
  }

  toggleImmersive(force) {
    const active = typeof force === 'boolean' ? force : !document.body.classList.contains('immersive');
    document.body.classList.toggle('immersive', active);
    const button = this.$('#immersive-toggle');
    button.title = active ? '退出沉浸 F' : '沉浸模式 F';
    button.innerHTML = `<i data-lucide="${active ? 'minimize' : 'maximize'}"></i>`;
    createIcons({ icons });
    this.studio.requestRender?.();
    setTimeout(() => this.studio.resize(), 280);
    this.showToast(active ? '已进入沉浸模式，按 F 或 Esc 退出' : '回到工坊控制台');
  }

  setFinish(key) {
    this.doll.setFinish(key);
    this.$$('#finish-options [data-finish]').forEach(button => button.classList.toggle('active', button.dataset.finish === key));
    this.studio.setActiveFinish(key);
    this.updateFoldSummaries();
    this.sound.click();
  }

  updateLabels() {
    const wood = WOODS[this.doll.woodKey];
    this.$('#active-material-label').textContent = `${wood.name} · ${FORMS[this.doll.shapeKey]?.name || '球 + 圆锥'}器形`;
    this.$('#project-name').childNodes[0].nodeValue = `${this.name} `;
    document.title = `${this.name} · 木间 MORI`;
  }

  selectBrush(brush) {
    this.brush = brush;
    this.brushSize = BRUSHES[brush].size;
    this.$('#brush-size').value = this.brushSize;
    this.$('#brush-size-value').textContent = this.brushSize;
    this.$$('#brush-list [data-brush]').forEach(button => button.classList.toggle('active', button.dataset.brush === brush));
    this.$('#brush-name').textContent = BRUSHES[brush].label;
    this.$('#brush-display-name').textContent = BRUSHES[brush].name;
    this.$('#brush-description').textContent = BRUSHES[brush].description;
    this.$('#brush-illustration').dataset.brush = brush;
    this.studio.setBrushType(brush);
    this.studio.setActiveBrush(brush);
    this.setTool('brush');
    this.showToast(`手中换成${BRUSHES[brush].name}`);
  }

  changeBrushSize(amount) {
    this.brushSize = Math.max(3, Math.min(64, this.brushSize + amount));
    this.$('#brush-size').value = this.brushSize;
    this.$('#brush-size-value').textContent = this.brushSize;
  }

  renderPigments() {
    const container = this.$('#paint-wells');
    container.innerHTML = this.pigments.map((pigment, index) => `
      <button class="paint-well ${index === this.pigmentIndex ? 'active' : ''}" data-pigment="${index}" title="${pigment.name} ${pigment.hex}" style="--paint:${pigment.hex}"><span></span></button>
    `).join('');
    container.querySelectorAll('[data-pigment]').forEach(button => button.addEventListener('click', () => {
      this.setPigment(Number(button.dataset.pigment), true);
    }));
    if (this.pigments.length > 12) {
      this.$('.paint-wells').style.gridTemplateColumns = 'repeat(4, 1fr)';
    }
  }

  setPigment(index, dip = true) {
    const pigment = this.pigments[index];
    if (!pigment) return;
    this.pigmentIndex = index;
    this.color = pigment.hex;
    this.colorName = pigment.name;
    this.brushClean = false;
    this.$$('.paint-well').forEach(button => button.classList.toggle('active', Number(button.dataset.pigment) === index));
    this.$('#current-color').style.background = pigment.hex;
    this.$('#color-name').textContent = pigment.name;
    this.$('#color-hex').textContent = pigment.hex.toUpperCase();
    this.$('#paint-status').innerHTML = '<i data-lucide="check"></i>笔尖已蘸色';
    this.updateFoldSummaries();
    createIcons({ icons });
    this.studio.setBrushColor(pigment.hex);
    this.studio.brushTipMaterial.roughness = .4;
    if (dip) {
      this.studio.dip(index % 12, pigment.hex);
      this.$('#brush-illustration').classList.add('dip');
      setTimeout(() => this.$('#brush-illustration').classList.remove('dip'), 480);
      const well = this.$(`[data-pigment="${index}"]`);
      if (well) { well.classList.add('dipping'); setTimeout(() => well.classList.remove('dipping'), 460); }
      this.sound.dip();
    }
  }

  rinseBrush() {
    this.brushClean = true;
    this.studio.rinse();
    this.studio.setBrushColor('#c9bba5');
    this.$('#paint-status').innerHTML = '<i data-lucide="droplets"></i>笔尖已洗净';
    createIcons({ icons });
    this.sound.dip();
    this.showToast('清水洗笔完成，去颜料盒重新蘸色');
  }

  renderAccessories() {
    const title = this.$('#accessory-title');
    const hint = this.$('#accessory-hint');
    const grid = this.$('#accessory-grid');
    if (this.tool === 'sticker') {
      title.textContent = '眼睛贴纸';
      hint.textContent = '轻点脸部贴上';
      grid.innerHTML = EYES.map(eye => `
        <button class="accessory-button ${this.selectedEye === eye.id ? 'active' : ''}" data-eye="${eye.id}" title="${eye.name}眼睛">
          <span class="eye-preview ${eye.id}"><i></i><i></i></span><small>${eye.name}</small>
        </button>
      `).join('');
      grid.querySelectorAll('[data-eye]').forEach(button => button.addEventListener('click', () => {
        this.selectedEye = button.dataset.eye;
        this.renderAccessories();
        this.studio.setEyePreview(this.paint.createEyeDecal(this.selectedEye, '#39342E'));
        this.studio.setActiveEye(this.selectedEye);
        this.sound.click();
        this.showToast('贴纸已换好，轻点木偶脸部');
      }));
    } else {
      title.textContent = '海绵章';
      hint.textContent = this.tool === 'stamp' ? '蘸色后轻按' : '轻点拿起';
      grid.innerHTML = STAMPS.map(stamp => `
        <button class="accessory-button ${this.tool === 'stamp' && this.selectedStamp === stamp.id ? 'active' : ''}" data-stamp="${stamp.id}" title="${stamp.name}海绵章">
          <i data-lucide="${stamp.icon}"></i><small>${stamp.name}</small>
        </button>
      `).join('');
      grid.querySelectorAll('[data-stamp]').forEach(button => button.addEventListener('click', () => {
        this.selectedStamp = button.dataset.stamp;
        this.setTool('stamp');
        this.sound.click();
        this.showToast(`拿起${STAMPS.find(stamp => stamp.id === this.selectedStamp).name}海绵章`);
      }));
    }
    this.updateFoldSummaries();
    createIcons({ icons });
  }

  updateFoldSummaries() {
    const shape = FORMS[this.doll.shapeKey]?.name || '球 + 圆锥';
    this.$('#wood-fold-value').textContent = `${WOODS[this.doll.woodKey].name} · ${WOODS[this.doll.woodKey].detail.split(' · ')[0]}`;
    this.$('#shape-fold-value').textContent = `${shape} · ${this.doll.sizeCm.toFixed(0)} cm`;
    this.$('#finish-fold-value').textContent = FINISH_LABELS[this.doll.finishKey] || '蜂蜡';
    this.$('#paint-fold-value').textContent = this.pigments[this.pigmentIndex]?.name || '朱砂红';
    const accessoryName = this.tool === 'sticker'
      ? `${EYES.find(eye => eye.id === this.selectedEye)?.name || '睡意'} · 贴纸`
      : `${STAMPS.find(stamp => stamp.id === this.selectedStamp)?.name || '雏菊'} · 海绵章`;
    this.$('#stamp-fold-value').textContent = this.tool === 'sticker' ? accessoryName : accessoryName.replace(' · 海绵章', '');
  }

  refreshHistory() {
    this.$('#undo').disabled = this.paint.undoStack.length <= 1;
    this.$('#redo').disabled = this.paint.redoStack.length === 0;
  }

  showToast(message) {
    const toast = this.$('#toast');
    toast.querySelector('span').textContent = message;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  toggleModal(open) {
    this.$('#inspiration-modal').classList.toggle('open', open);
    this.$('#inspiration-modal').setAttribute('aria-hidden', String(!open));
  }

  openColorPicker() {
    this.closeDrawers?.();
    this.$('#color-popover').classList.add('open');
    this.$('#color-popover').setAttribute('aria-hidden', 'false');
    this.updateMixerPreview();
  }

  closeColorPicker() {
    this.$('#color-popover').classList.remove('open');
    this.$('#color-popover').setAttribute('aria-hidden', 'true');
  }

  createWheel() {
    const canvas = this.$('#color-wheel');
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - size / 2) / (size / 2);
        const dy = (y - size / 2) / (size / 2);
        const radius = Math.hypot(dx, dy);
        if (radius > 1) continue;
        const hue = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
        const [r, g, b] = this.hsvToRgb(hue, Math.min(1, radius), 1);
        const index = (y * size + x) * 4;
        const alpha = radius > .975 ? Math.round((1 - radius) / .025 * 255) : 255;
        image.data[index] = r; image.data[index + 1] = g; image.data[index + 2] = b; image.data[index + 3] = alpha;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  colorWheelInteraction() {
    const canvas = this.$('#color-wheel');
    const pick = event => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * 2 - 1;
      const y = (event.clientY - rect.top) / rect.height * 2 - 1;
      const radius = Math.min(1, Math.hypot(x, y));
      this.colorHue = (Math.atan2(y, x) / (Math.PI * 2) + 1) % 1;
      this.colorSaturation = radius;
      this.updateColorFromWheel();
    };
    canvas.addEventListener('pointerdown', event => {
      canvas.setPointerCapture(event.pointerId);
      pick(event);
    });
    canvas.addEventListener('pointermove', event => {
      if (event.buttons) pick(event);
    });
  }

  hsvToRgb(h, s, v) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    const values = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return values.map(value => Math.round(value * 255));
  }

  rgbToHex([r, g, b]) {
    return `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  }

  updateColorFromWheel() {
    this.color = this.rgbToHex(this.hsvToRgb(this.colorHue, this.colorSaturation, this.colorValue));
    this.colorName = '调和色';
    this.updateMixerPreview();
  }

  updateMixerPreview() {
    this.$('#mix-preview').style.background = this.color;
    this.$('#color-hex-input').value = this.color;
    const canvas = this.$('#color-wheel');
    const marker = this.$('#mix-preview');
    marker.title = this.color;
    canvas.style.boxShadow = `inset 0 0 0 1px rgba(0,0,0,.06), 0 0 0 2px ${this.color}20`;
  }

  addCustomColor() {
    const existing = this.pigments.findIndex(pigment => pigment.hex.toLowerCase() === this.color.toLowerCase());
    let index;
    if (existing >= 0) {
      index = existing;
    } else {
      this.pigments.push({ name: this.colorName, hex: this.color });
      if (this.pigments.length > 16) this.pigments.splice(12, 1);
      index = this.pigments.length - 1;
    }
    this.pigmentIndex = index;
    this.renderPigments();
    this.setPigment(index, true);
    this.closeColorPicker();
    this.sound.success();
    this.showToast(`${this.color} 已添进颜料盒`);
  }

  renamePiece() {
    if (this.$('#project-name input')) return;
    const button = this.$('#project-name');
    const input = document.createElement('input');
    input.value = this.name;
    input.maxLength = 18;
    input.className = 'project-name-input';
    button.replaceChildren(input);
    input.focus();
    input.select();
    const finish = () => {
      const value = input.value.trim() || '未命名小品';
      this.name = value;
      button.textContent = value;
      this.updateLabels();
    };
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') input.blur();
      if (event.key === 'Escape') { input.value = this.name; input.blur(); }
    });
  }

  async savePiece() {
    try {
      const payload = {
        version: 1,
        name: this.name,
        paint: await this.paint.serialize(),
        wood: this.doll.woodKey,
        shape: this.doll.shapeKey,
        shapeParams: { ...this.doll.shapeParams },
        size: this.doll.sizeCm,
        finish: this.doll.finishKey
      };
      localStorage.setItem('mori-dollmaker-piece', JSON.stringify(payload));
      this.sound.success();
      this.showToast('作品已放进工坊抽屉，下次回来还在');
    } catch (error) {
      console.warn(error);
      this.showToast('本地存储空间不足，可以先留影保存');
    }
  }

  async loadSaved() {
    try {
      const raw = localStorage.getItem('mori-dollmaker-piece');
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload.paint) return;
      this.name = payload.name || this.name;
      this.doll.setWood(payload.wood || 'beech');
      this.doll.setShape(FORMS[payload.shape] ? payload.shape : 'cone');
      this.doll.setShapeParams(payload.shapeParams || {});
      this.doll.setSize(payload.size ?? SIZE_LIMITS.default);
      this.doll.setFinish(payload.finish || 'wax');
      this.paint.setWoodBase();
      await this.paint.restore(payload.paint);
      this.doll.updateTexture();
      this.$$('.wood-card').forEach(button => button.classList.toggle('active', button.dataset.wood === this.doll.woodKey));
      this.$$('#finish-options [data-finish]').forEach(button => button.classList.toggle('active', button.dataset.finish === this.doll.finishKey));
      this.$('#wood-detail').textContent = WOODS[this.doll.woodKey].detail;
      this.syncShapeParams();
      this.studio.fitView();
      this.studio.setActiveWood(this.doll.woodKey);
      this.studio.setActiveShape(this.doll.shapeKey);
      this.studio.setActiveFinish(this.doll.finishKey);
      this.updateLabels();
      this.updateFoldSummaries();
      this.refreshHistory();
      setTimeout(() => this.showToast('已从工坊抽屉取回上次的作品'), 450);
    } catch (error) {
      console.warn('Could not restore saved piece', error);
    }
  }

  takePhoto() {
    this.sound.success();
    const flash = this.$('#photo-flash');
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 80);
    const data = this.studio.takePhoto();
    const link = document.createElement('a');
    link.download = `${this.name}-木间留影-${Date.now()}.png`;
    link.href = data;
    link.click();
    this.showToast('已留下这张 3D 工坊照片');
  }

  animate(now) {
    requestAnimationFrame(this.animate);
    this.studio.update(now);
    if (now - this.physClock > 150) {
      this.physClock = now;
      this.paint.tickDrying(now);
      if (this.paint.physDirty) {
        this.paint.flushPhys();
        this.studio.requestRender();
      }
      const meter = this.$('#wet-meter');
      if (meter) {
        const wet = this.paint.drynessHint();
        meter.style.setProperty('--wet', wet.toFixed(2));
        meter.title = wet > 0.06 ? `颜料还在湿润中，约 ${Math.round(wet * 34)} 秒后干透` : '颜料已干，新笔触不再与它混色';
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.mori = new DollMakerApp();
});
