import { readProfile } from './doll.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 220;
const H = 244;
const CX = W / 2;
const BASE_Y = H - 14;
const SCALE = (H - 30) / 4.2;

const HANDLES = [
  { key: 'base', shape: 'rect', cursor: 'move', hint: '底径 · 左右 / 底座圆角 · 上下' },
  { key: 'belly', shape: 'diamond', cursor: 'ew-resize', hint: '腹线 · 车削弧度' },
  { key: 'shoulder', shape: 'rect', cursor: 'ew-resize', hint: '肩径' },
  { key: 'dome', shape: 'circle', cursor: 'ns-resize', hint: '拱顶 · 拉起变胶囊' },
  { key: 'head', shape: 'rect', cursor: 'move', hint: '头球 · 左右改头径 / 下压嵌入身体' }
];

function el(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

export class ProfileEditor {
  constructor(host, { getParams, onPatch, onDragStart, onDragEnd }) {
    this.host = host;
    this.getParams = getParams;
    this.onPatch = onPatch;
    this.onDragStart = onDragStart;
    this.onDragEnd = onDragEnd;
    this.svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'profile-svg', 'aria-label': '木偶横截面图纸' });
    this.grid = el('g', { class: 'pe-grid' });
    for (let y = 0; y <= 4; y++) {
      const py = BASE_Y - y * SCALE;
      this.grid.append(el('line', { x1: 14, x2: W - 14, y1: py, y2: py }));
    }
    this.svg.append(this.grid);
    this.svg.append(el('line', { class: 'pe-axis', x1: CX, x2: CX, y1: 6, y2: BASE_Y + 6 }));
    this.shape = el('path', { class: 'pe-shape' });
    this.ctrl = el('path', { class: 'pe-ctrl' });
    this.svg.append(this.shape, this.ctrl);
    this.handles = {};
    for (const def of HANDLES) {
      const node = def.shape === 'circle'
        ? el('circle', { r: 4.6 })
        : el('rect', { width: 8.4, height: 8.4, x: -4.2, y: -4.2 });
      node.setAttribute('class', `pe-handle pe-${def.key}`);
      node.dataset.h = def.key;
      node.style.cursor = def.cursor;
      const title = el('title');
      title.textContent = def.hint;
      node.append(title);
      if (def.shape === 'diamond') node.setAttribute('transform-origin', '0 0');
      this.svg.append(node);
      this.handles[def.key] = node;
    }
    host.replaceChildren(this.svg);
    this.svg.addEventListener('pointerdown', event => this.beginDrag(event));
    this.svg.addEventListener('pointermove', event => this.moveDrag(event));
    this.svg.addEventListener('pointerup', event => this.endDrag(event));
    this.svg.addEventListener('pointercancel', event => this.endDrag(event));
    this.render();
  }

  toWorld(event) {
    const rect = this.svg.getBoundingClientRect();
    const k = W / rect.width;
    return {
      r: ((event.clientX - rect.left) * k - CX) / SCALE,
      y: (BASE_Y - (event.clientY - rect.top) * k) / SCALE
    };
  }

  beginDrag(event) {
    const key = event.target.dataset?.h;
    if (!key) return;
    event.preventDefault();
    this.drag = { key, start: this.toWorld(event), params: { ...this.getParams() } };
    this.svg.setPointerCapture(event.pointerId);
    this.svg.classList.add('dragging');
    this.onDragStart?.();
  }

  moveDrag(event) {
    if (!this.drag) return;
    const { key, start, params } = this.drag;
    const w = this.toWorld(event);
    const dr = w.r - start.r;
    const dy = w.y - start.y;
    const patch = {};
    if (key === 'base') {
      patch.base = params.base + dr;
      patch.foot = params.foot + dy;
    } else if (key === 'belly') patch.belly = params.belly + dr;
    else if (key === 'shoulder') patch.shoulder = params.shoulder + dr;
    else if (key === 'dome') patch.dome = params.dome + dy;
    else if (key === 'head') {
      patch.head = params.head + dr;
      patch.seat = params.seat - dy;
    }
    this.onPatch(patch);
  }

  endDrag(event) {
    if (!this.drag) return;
    this.drag = null;
    this.svg.classList.remove('dragging');
    if (this.svg.hasPointerCapture(event.pointerId)) this.svg.releasePointerCapture(event.pointerId);
    this.onDragEnd?.();
  }

  render() {
    const g = readProfile(this.getParams());
    const pt = (r, y) => `${(CX + r * SCALE).toFixed(2)} ${(BASE_Y - y * SCALE).toFixed(2)}`;
    const right = g.points.map(p => pt(p.x, p.y));
    const left = [...g.points].reverse().map(p => pt(-p.x, p.y));
    this.shape.setAttribute('d', `M${right.join(' L')} L${left.join(' L')} Z`);
    this.ctrl.setAttribute('d', `M${pt(g.params.base, g.edge)} L${pt(g.ctrlX, g.ctrlY)} L${pt(g.params.shoulder, g.sideH)}`);

    const place = (key, r, y) => {
      const node = this.handles[key];
      if (node.tagName === 'circle') {
        node.setAttribute('cx', CX + r * SCALE);
        node.setAttribute('cy', BASE_Y - y * SCALE);
      } else {
        node.setAttribute('transform', `translate(${CX + r * SCALE} ${BASE_Y - y * SCALE})${key === 'belly' ? ' rotate(45)' : ''}`);
      }
    };
    place('base', g.params.base, 0);
    place('belly', g.ctrlX, g.ctrlY);
    place('shoulder', g.params.shoulder, g.sideH);
    place('dome', 0, g.bodyTop);
    place('head', g.params.head, g.headY);
    this.svg.classList.toggle('has-dome', g.dome > 0.004);
  }
}
