(() => {
    'use strict';

    const SVG_NS = 'http://www.w3.org/2000/svg';

    function attempt(fn, fallback) {
        try {
            return fn();
        } catch (_error) {
            return fallback;
        }
    }

    function icon(name, extra) {
        const element = document.createElementNS(SVG_NS, 'svg');
        element.setAttribute('class', extra ? `icon ${extra}` : 'icon');
        element.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS(SVG_NS, 'use');
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#i-${name}`);
        use.setAttribute('href', `#i-${name}`);
        element.appendChild(use);
        return element;
    }

    function label(element, name, text) {
        element.textContent = '';
        if (name) element.appendChild(icon(name));
        if (text) element.appendChild(document.createTextNode((name ? ' ' : '') + text));
    }

    function spaced(pattern) {
        return pattern.split(' ').map((word) => word.split('').join(' ')).join('   ');
    }

    function formatHint(hint) {
        if (!hint) return [];
        const lines = [];
        if (hint.title) lines.push({ icon: 'music', text: spaced(hint.title) });
        if (hint.artist) lines.push({ icon: 'mic', text: spaced(hint.artist) });
        return lines;
    }

    function renderHint(element, lines, previous) {
        const signature = lines.map((line) => `${line.icon}:${line.text}`).join('|');
        if (signature === previous) return previous;
        element.textContent = '';
        for (const line of lines) {
            const row = document.createElement('span');
            row.className = 'hint-line';
            row.appendChild(icon(line.icon));
            row.appendChild(document.createTextNode(' ' + line.text));
            element.appendChild(row);
        }
        element.classList.remove('fresh');
        void element.offsetWidth;
        if (lines.length) element.classList.add('fresh');
        return signature;
    }

    function rankMark(index, suffix) {
        if (index > 2) return document.createTextNode(`${index + 1}${suffix || ''}`);
        return icon(index ? 'medal' : 'crown', `medal-${index + 1}`);
    }

    window.addEventListener('error', (event) => {
        const box = document.getElementById('boot-error');
        if (!box) return;
        box.hidden = false;
        box.textContent = `Erreur : ${event.message}`;
    });

    window.UI = { attempt, icon, label, formatHint, renderHint, rankMark };
})();
