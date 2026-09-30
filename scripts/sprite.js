const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const LUCIDE = path.join(ROOT, 'node_modules', 'lucide-static', 'icons');
const SPRITE = path.join(ROOT, 'public', 'icons.svg');
const DRAWABLES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable');

const WEB = [
    'arrow-left', 'award', 'check', 'circle-check', 'circle-x', 'code', 'corner-up-left', 'crown', 'disc-3', 'download',
    'flame', 'headphones', 'hourglass', 'house', 'key-round', 'keyboard', 'laugh', 'list-checks', 'list-music', 'medal',
    'mic', 'moon', 'music', 'party-popper', 'pause', 'play', 'power', 'rotate-ccw', 'send-horizontal', 'settings',
    'skip-forward', 'sliders-horizontal', 'smartphone', 'sparkles', 'square', 'trophy', 'tv', 'user', 'users',
    'volume-2', 'volume-x', 'x', 'zap', 'triangle-alert', 'eraser', 'flag', 'log-out', 'plus', 'sun', 'user-x', 'ellipsis'
];

const ANDROID = {
    ic_menu_tv: 'tv',
    ic_menu_reload: 'rotate-cw',
    ic_menu_settings: 'settings',
    ic_menu_update: 'download',
    ic_menu_power: 'power'
};

function read(name) {
    const file = path.join(LUCIDE, `${name}.svg`);
    if (!fs.existsSync(file)) throw new Error(`Icône Lucide inconnue : ${name}`);
    const svg = fs.readFileSync(file, 'utf8');
    const start = svg.indexOf('>', svg.indexOf('<svg')) + 1;
    const end = svg.lastIndexOf('</svg>');
    return svg.slice(start, end).replace(/\s+/g, ' ').trim();
}

function elements(inner) {
    const list = [];
    const pattern = /<(\w+)([^>]*?)\/?>/g;
    let match;
    while ((match = pattern.exec(inner))) {
        const attrs = {};
        const attrPattern = /([\w-]+)="([^"]*)"/g;
        let attr;
        while ((attr = attrPattern.exec(match[2]))) attrs[attr[1]] = attr[2];
        list.push({ tag: match[1], attrs });
    }
    return list;
}

function num(value) {
    return Number(value || 0);
}

function pathData({ tag, attrs }) {
    if (tag === 'path') return attrs.d;
    if (tag === 'line') return `M${attrs.x1},${attrs.y1} L${attrs.x2},${attrs.y2}`;
    if (tag === 'polyline' || tag === 'polygon') {
        const points = attrs.points.trim().split(/[\s,]+/).map(Number);
        const parts = [];
        for (let index = 0; index < points.length; index += 2) parts.push(`${index ? 'L' : 'M'}${points[index]},${points[index + 1]}`);
        return parts.join(' ') + (tag === 'polygon' ? ' Z' : '');
    }
    if (tag === 'circle' || tag === 'ellipse') {
        const cx = num(attrs.cx);
        const cy = num(attrs.cy);
        const rx = num(tag === 'circle' ? attrs.r : attrs.rx);
        const ry = num(tag === 'circle' ? attrs.r : attrs.ry);
        return `M${cx + rx},${cy} A${rx},${ry} 0 1 1 ${cx - rx},${cy} A${rx},${ry} 0 1 1 ${cx + rx},${cy} Z`;
    }
    if (tag === 'rect') {
        const x = num(attrs.x);
        const y = num(attrs.y);
        const w = num(attrs.width);
        const h = num(attrs.height);
        const r = Math.min(num(attrs.rx || attrs.ry), w / 2, h / 2);
        if (!r) return `M${x},${y} h${w} v${h} h${-w} Z`;
        return `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - 2 * r)} a${r},${r} 0 0 1 ${-r},${-r} v${-(h - 2 * r)} a${r},${r} 0 0 1 ${r},${-r} Z`;
    }
    throw new Error(`Forme SVG non gérée : ${tag}`);
}

function buildSprite() {
    const symbols = WEB.map((name) => `<symbol id="i-${name}" viewBox="0 0 24 24">${read(name)}</symbol>`);
    const sprite = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="sprite" aria-hidden="true" focusable="false">${symbols.join('')}</svg>`;
    fs.writeFileSync(SPRITE, sprite + '\n');
    return WEB.length;
}

function buildDrawables() {
    fs.mkdirSync(DRAWABLES, { recursive: true });
    for (const [file, name] of Object.entries(ANDROID)) {
        const paths = elements(read(name)).map((element) => [
            '    <path',
            '        android:fillColor="@android:color/transparent"',
            '        android:strokeColor="#F3ECFF"',
            '        android:strokeWidth="2"',
            '        android:strokeLineCap="round"',
            '        android:strokeLineJoin="round"',
            `        android:pathData="${pathData(element)}" />`
        ].join('\n'));
        const xml = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
            '    android:width="24dp"',
            '    android:height="24dp"',
            '    android:viewportWidth="24"',
            '    android:viewportHeight="24">',
            ...paths,
            '</vector>',
            ''
        ].join('\n');
        fs.writeFileSync(path.join(DRAWABLES, `${file}.xml`), xml);
    }
    return Object.keys(ANDROID).length;
}

const web = buildSprite();
const native = buildDrawables();
console.log(`${web} icônes dans public/icons.svg, ${native} drawables Android (Lucide ${require('lucide-static/package.json').version}, ISC)`);
