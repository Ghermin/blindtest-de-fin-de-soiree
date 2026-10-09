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

    function dialog(options) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            const box = document.createElement('div');
            box.className = 'modal';
            box.setAttribute('role', 'dialog');
            box.setAttribute('aria-modal', 'true');
            if (options.title) {
                const title = document.createElement('h3');
                title.textContent = options.title;
                box.appendChild(title);
            }
            if (options.text) {
                const text = document.createElement('p');
                text.className = 'modal-text';
                text.textContent = options.text;
                box.appendChild(text);
            }
            let input = null;
            if (options.input) {
                input = document.createElement('input');
                input.type = 'text';
                input.maxLength = options.input.maxLength || 40;
                input.placeholder = options.input.placeholder || '';
                input.value = options.input.value || '';
                input.autocomplete = 'off';
                input.setAttribute('aria-label', options.input.placeholder || options.title || '');
                box.appendChild(input);
            }
            let settled = false;
            const close = (value) => {
                if (settled) return;
                settled = true;
                document.removeEventListener('keydown', onKey);
                backdrop.remove();
                resolve(value);
            };
            const submit = () => close(input ? input.value.trim() : true);
            function onKey(event) {
                if (event.key === 'Escape') close(null);
                else if (event.key === 'Enter' && input && document.activeElement === input) submit();
            }
            if (options.choices) {
                const list = document.createElement('div');
                list.className = 'modal-choices';
                for (const choice of options.choices) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = choice.active ? 'modal-choice active' : 'modal-choice';
                    label(button, choice.icon, choice.label);
                    button.addEventListener('click', () => close(choice.value));
                    list.appendChild(button);
                }
                box.appendChild(list);
            }
            const actions = document.createElement('div');
            actions.className = 'modal-actions';
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'ghost';
            cancel.textContent = options.cancel || 'Annuler';
            cancel.addEventListener('click', () => close(null));
            actions.appendChild(cancel);
            if (options.extra) {
                const extra = document.createElement('button');
                extra.type = 'button';
                extra.className = 'danger-button';
                label(extra, options.extra.icon, options.extra.label);
                extra.addEventListener('click', () => close(options.extra.value));
                actions.appendChild(extra);
            }
            if (!options.choices) {
                const ok = document.createElement('button');
                ok.type = 'button';
                ok.className = options.danger ? 'danger-button' : 'primary';
                label(ok, options.icon, options.confirm || 'OK');
                ok.addEventListener('click', submit);
                actions.appendChild(ok);
            }
            box.appendChild(actions);
            backdrop.appendChild(box);
            backdrop.addEventListener('click', (event) => {
                if (event.target === backdrop) close(null);
            });
            document.addEventListener('keydown', onKey);
            document.body.appendChild(backdrop);
            const focus = input || box.querySelector('.modal-choice, .primary, .danger-button, button');
            if (focus) focus.focus();
            if (input && options.input.value) input.select();
        });
    }

    const FADE_OUT_MS = 450;
    const FADE_IN_MS = 220;
    const MAX_POSITION = 45;

    function clipPlayer(hooks) {
        const player = new Audio();
        player.preload = 'auto';
        let wanted = '';
        let loaded = '';
        let timer = null;
        let fading = 0;

        function clearFade() {
            clearInterval(timer);
            timer = null;
            fading = 0;
        }

        function ramp(to, ms, done) {
            const from = player.volume;
            const started = Date.now();
            clearInterval(timer);
            fading = to < from ? -1 : 1;
            timer = setInterval(() => {
                const ratio = Math.min(1, (Date.now() - started) / ms);
                player.volume = Math.max(0, Math.min(1, from + (to - from) * ratio));
                if (ratio < 1) return;
                clearFade();
                if (done) done();
            }, 25);
        }

        function load(url) {
            loaded = url;
            player.src = url;
            player.load();
        }

        function stop() {
            if (player.paused || fading === -1) return;
            ramp(0, FADE_OUT_MS, () => player.pause());
        }

        function want(url) {
            if (wanted === url) return;
            wanted = url;
            if (player.paused) {
                clearFade();
                player.volume = 0;
                load(url);
                return;
            }
            ramp(0, FADE_OUT_MS, () => {
                player.pause();
                if (wanted === url) load(url);
            });
        }

        function blocked(flag) {
            if (hooks.blocked) hooks.blocked(flag);
        }

        function sync(clip, force) {
            if (!clip || !clip.url) {
                stop();
                return;
            }
            want(clip.url);
            const position = clip.startedAt ? (hooks.now() - clip.startedAt) / 1000 : -1;
            if (position < 0 || position > MAX_POSITION || loaded !== clip.url) {
                stop();
                return;
            }
            const seek = () => {
                const target = Math.max(0, (hooks.now() - clip.startedAt) / 1000);
                if (Math.abs(player.currentTime - target) > 1.5) player.currentTime = target;
            };
            if (player.readyState >= 1) seek();
            else player.addEventListener('loadedmetadata', seek, { once: true });
            if (!player.paused && !force) return;
            if (player.paused) player.volume = 0;
            player.play().then(() => {
                blocked(false);
                if (fading !== 1 && player.volume < 1) ramp(1, FADE_IN_MS);
            }).catch(() => blocked(true));
        }

        return { sync };
    }

    window.addEventListener('error', (event) => {
        const box = document.getElementById('boot-error');
        if (!box) return;
        box.hidden = false;
        box.textContent = `Erreur : ${event.message}`;
    });

    window.UI = { attempt, icon, label, formatHint, renderHint, rankMark, dialog, clipPlayer };
})();
