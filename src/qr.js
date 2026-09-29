const LEVEL_L = 1;
const VERSIONS = [[26, 7], [44, 10], [70, 15], [100, 20], [134, 26]];
const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

function multiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}

function divisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
            result[j] = multiply(result[j], root) ^ (j + 1 < degree ? result[j + 1] : 0);
        }
        root = multiply(root, 2);
    }
    return result;
}

function remainder(data, generator) {
    const result = new Array(generator.length).fill(0);
    for (const byte of data) {
        const factor = byte ^ result.shift();
        result.push(0);
        for (let i = 0; i < generator.length; i++) result[i] ^= multiply(generator[i], factor);
    }
    return result;
}

function codewords(text) {
    const bytes = [...Buffer.from(text, 'utf8')];
    const version = VERSIONS.findIndex(([total, ec]) => (total - ec) * 8 >= 12 + bytes.length * 8) + 1;
    if (!version) throw new Error('Texte trop long pour un QR code');
    const [total, ecLength] = VERSIONS[version - 1];
    const dataLength = total - ecLength;
    const bits = [];
    const push = (value, length) => {
        for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    };
    push(4, 4);
    push(bytes.length, 8);
    for (const byte of bytes) push(byte, 8);
    push(0, Math.min(4, dataLength * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let pad = 0xec; data.length < dataLength; pad ^= 0xec ^ 0x11) data.push(pad);
    return { version, data: data.concat(remainder(data, divisor(ecLength))) };
}

function drawFormat(grid, mask) {
    const { modules, reserved, size } = grid;
    const info = (LEVEL_L << 3) | mask;
    let rem = info;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((info << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) === 1;
    const set = (x, y, dark) => {
        modules[y][x] = dark;
        reserved[y][x] = true;
    };
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
}

function drawFunctions(grid, version) {
    const { modules, reserved, size } = grid;
    const set = (x, y, dark) => {
        modules[y][x] = dark;
        reserved[y][x] = true;
    };
    for (let i = 0; i < size; i++) {
        set(6, i, i % 2 === 0);
        set(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const x = cx + dx;
                const y = cy + dy;
                if (x < 0 || y < 0 || x >= size || y >= size) continue;
                const distance = Math.max(Math.abs(dx), Math.abs(dy));
                set(x, y, distance !== 2 && distance !== 4);
            }
        }
    }
    if (version > 1) {
        const center = size - 7;
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                set(center + dx, center + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
            }
        }
    }
    drawFormat(grid, 0);
}

function drawData(grid, data) {
    const { modules, reserved, size } = grid;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) {
            for (let j = 0; j < 2; j++) {
                const x = right - j;
                const upward = ((right + 1) & 2) === 0;
                const y = upward ? size - 1 - vert : vert;
                if (!reserved[y][x] && i < data.length * 8) {
                    modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
                    i++;
                }
            }
        }
    }
}

function applyMask(grid, mask) {
    const { modules, reserved, size } = grid;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (!reserved[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x];
        }
    }
}

function linePenalty(line) {
    let score = 0;
    let run = 1;
    for (let i = 1; i <= line.length; i++) {
        if (i < line.length && line[i] === line[i - 1]) {
            run++;
        } else {
            if (run >= 5) score += run - 2;
            run = 1;
        }
    }
    const text = line.map((dark) => (dark ? '1' : '0')).join('');
    for (let i = 0; i < text.length; i++) {
        if (text.startsWith('10111010000', i) || text.startsWith('00001011101', i)) score += 40;
    }
    return score;
}

function penalty(grid) {
    const { modules, size } = grid;
    let score = 0;
    let dark = 0;
    for (let y = 0; y < size; y++) {
        score += linePenalty(modules[y]);
        score += linePenalty(modules.map((row) => row[y]));
        for (let x = 0; x < size; x++) {
            if (modules[y][x]) dark++;
            if (y < size - 1 && x < size - 1) {
                const cell = modules[y][x];
                if (cell === modules[y][x + 1] && cell === modules[y + 1][x] && cell === modules[y + 1][x + 1]) score += 3;
            }
        }
    }
    const total = size * size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
}

function encode(text) {
    const { version, data } = codewords(text);
    const size = version * 4 + 17;
    const grid = {
        size,
        modules: Array.from({ length: size }, () => new Array(size).fill(false)),
        reserved: Array.from({ length: size }, () => new Array(size).fill(false))
    };
    drawFunctions(grid, version);
    drawData(grid, data);
    let best = { mask: 0, score: Infinity };
    for (let mask = 0; mask < 8; mask++) {
        applyMask(grid, mask);
        drawFormat(grid, mask);
        const score = penalty(grid);
        if (score < best.score) best = { mask, score };
        applyMask(grid, mask);
    }
    applyMask(grid, best.mask);
    drawFormat(grid, best.mask);
    return { size, modules: grid.modules, version, mask: best.mask };
}

function svg(text) {
    const { size, modules } = encode(text);
    const quiet = 4;
    const total = size + quiet * 2;
    let path = '';
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (modules[y][x]) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">`
        + `<rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

module.exports = { encode, svg };
