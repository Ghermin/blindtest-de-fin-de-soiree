(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const screens = ['home', 'join', 'lobby', 'game', 'reveal', 'podium'];
    const roomMatch = location.pathname.match(/^\/r\/([A-Za-z0-9]{3,12})/);
    const room = roomMatch ? roomMatch[1].toUpperCase() : '';
    const api = `/api/r/${room}`;

    function attempt(fn, fallback) {
        try {
            return fn();
        } catch (_error) {
            return fallback;
        }
    }

    const storage = {
        get: (key) => attempt(() => localStorage.getItem(key), '') || '',
        set: (key, value) => attempt(() => localStorage.setItem(key, value)),
        remove: (key) => attempt(() => localStorage.removeItem(key))
    };

    let token = room ? storage.get(`bt_token_${room}`) : '';
    let myName = storage.get('bt_name');
    let myTeam = storage.get('bt_team');
    let hostKey = room ? storage.get(`bt_hostkey_${room}`) : '';
    let isHost = room ? storage.get(`bt_host_${room}`) === '1' : false;
    let speaker = room ? storage.get(`bt_speaker_${room}`) === '1' : false;
    let state = null;
    let offset = 0;
    let lastRound = 0;
    let myFound = { title: false, artist: false };
    let timerFrame = null;
    let countdownTimer = null;
    let lastPhase = '';
    let wakeLock = null;
    let lastChips = '';
    let lastHint = '';
    let source = null;
    let sourceToken = null;
    let lastMessage = 0;
    let playerSrc = '';
    let installUrl = '/install';
    let myChoice = null;
    let renderedChoices = '';
    const seen = new Map();
    const player = new Audio();
    player.preload = 'auto';

    const SVG_NS = 'http://www.w3.org/2000/svg';

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

    function rankMark(index) {
        if (index > 2) return document.createTextNode(`${index + 1}.`);
        return icon(index ? 'medal' : 'crown', `medal-${index + 1}`);
    }

    function renderSpeaker() {
        label($('host-speaker'), speaker ? 'volume-2' : 'volume-x', `Son sur ce téléphone : ${speaker ? 'oui' : 'non'}`);
    }

    function renderHostButton() {
        if (isHost) label($('become-host'), 'check', 'Hôte activé (re-clique pour désactiver)');
        else label($('become-host'), 'key-round', 'Je suis l\'hôte');
    }

    if (room && location.hash.startsWith('#host=')) {
        hostKey = decodeURIComponent(location.hash.slice(6));
        storage.set(`bt_hostkey_${room}`, hostKey);
        storage.set(`bt_host_${room}`, '1');
        isHost = true;
        history.replaceState(null, '', location.pathname);
    }

    async function post(route, data, method) {
        const response = await fetch(route, {
            method: method || 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
            body: method === 'GET' ? undefined : JSON.stringify(data || {})
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 403 && route.includes('/host/')) {
            const entered = (prompt('Clé hôte ? (le code hôte de la salle de la maison, ou la clé reçue à la création de la salle)') || '').trim();
            if (entered && entered !== hostKey) {
                hostKey = entered;
                storage.set(`bt_hostkey_${room}`, hostKey);
                return post(route, data, method);
            }
        }
        if (!response.ok) throw new Error(payload.error || 'Erreur réseau');
        return payload;
    }

    function show(name) {
        for (const screen of screens) $('screen-' + screen).hidden = screen !== name;
    }

    function now() {
        return Date.now() + offset;
    }

    async function keepAwake() {
        if (!('wakeLock' in navigator) || (wakeLock && !wakeLock.released)) return;
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (_error) {
            wakeLock = null;
        }
    }

    function syncAudio() {
        const audio = state && state.audio;
        const active = speaker && audio && audio.url && !state.paused && ['countdown', 'guess', 'reveal'].includes(state.phase);
        if (!active) {
            if (!player.paused) player.pause();
            return;
        }
        if (playerSrc !== audio.url) {
            playerSrc = audio.url;
            player.src = audio.url;
            player.load();
        }
        if (!audio.startedAt) {
            if (!player.paused) player.pause();
            return;
        }
        const position = (now() - audio.startedAt) / 1000;
        if (position > 45) {
            if (!player.paused) player.pause();
            return;
        }
        const seek = () => {
            const target = Math.max(0, (now() - audio.startedAt) / 1000);
            if (Math.abs(player.currentTime - target) > 1.5) player.currentTime = target;
        };
        if (player.readyState >= 1) seek();
        else player.addEventListener('loadedmetadata', seek, { once: true });
        if (player.paused) {
            player.play().then(() => {
                $('sound-help').hidden = true;
            }).catch(() => {
                $('sound-help').hidden = false;
            });
        }
    }

    function setSpeaker(value) {
        speaker = value;
        storage.set(`bt_speaker_${room}`, speaker ? '1' : '0');
        renderSpeaker();
        if (!speaker) $('sound-help').hidden = true;
        syncAudio();
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

    function playlistLabel(playlist, long) {
        if (!playlist) return long ? 'Aucune playlist chargée' : '';
        const base = `${playlist.name}${playlist.partial ? ' (100 premiers titres)' : ''}`;
        if (!playlist.ready) return `${base} · recherche des extraits ${playlist.resolved}/${playlist.total}…`;
        const missing = playlist.missing ? `, ${playlist.missing} sans extrait` : '';
        return long ? `${base} · ${playlist.resolved} extraits prêts${missing}` : `${base} · ${playlist.resolved} titres`;
    }

    function renderPlayers(list, element, withGains) {
        element.innerHTML = '';
        for (const entry of list) {
            const item = document.createElement('li');
            const key = `${element.id}:${entry.name}`;
            if (!seen.has(key)) item.classList.add('fresh');
            else if (seen.get(key) < entry.score) item.classList.add('bump');
            seen.set(key, entry.score);
            const gained = withGains && entry.gained ? ` +${entry.gained}` : '';
            const team = entry.team ? ` [${entry.team}]` : '';
            const offline = entry.online === false;
            item.textContent = `${entry.name}${team} — ${entry.score}${gained}`;
            const marks = document.createElement('span');
            marks.className = 'marks';
            if (entry.found.title) marks.appendChild(icon('music'));
            if (entry.found.artist) marks.appendChild(icon('mic'));
            if (offline) marks.appendChild(icon('moon', 'offline-mark'));
            if (marks.childNodes.length) item.appendChild(marks);
            item.classList.toggle('offline', offline);
            if (entry.lastGuess) {
                const guess = document.createElement('span');
                guess.className = 'last-guess';
                guess.textContent = `« ${entry.lastGuess} »`;
                item.appendChild(guess);
            }
            element.appendChild(item);
        }
    }

    function renderTeams(teams, element) {
        const list = teams || [];
        element.hidden = !list.length;
        element.innerHTML = '';
        for (const team of list) {
            const item = document.createElement('li');
            item.textContent = `${team.name} — ${team.score}`;
            element.appendChild(item);
        }
    }

    function configLabel(options) {
        if (!options) return '';
        const parts = [`${options.rounds} manches`, `${options.guessSeconds} s`, { both: 'titre + artiste', title: 'titre', artist: 'artiste' }[options.mode] || ''];
        parts.push(options.answers === 'choices' ? 'QCM' : 'clavier');
        if (options.play === 'teams') parts.push('1 téléphone par équipe');
        if (options.hints && options.answers !== 'choices') parts.push('indices');
        return parts.filter(Boolean).join(' · ');
    }

    function renderOptions() {
        const options = (state && state.options) || {};
        for (const group of document.querySelectorAll('.segmented[data-option]')) {
            const value = String(options[group.dataset.option]);
            for (const button of group.querySelectorAll('button')) {
                const active = button.dataset.value === value;
                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', String(active));
            }
        }
        $('setting-hints').hidden = options.answers === 'choices';
    }

    function renderChoices(choices) {
        const container = $('choices');
        const signature = choices.map((choice) => choice.id + choice.label).join('|') + (myChoice ? `!${myChoice.id}${myChoice.correct}` : '') + (state.paused ? '#' : '');
        if (signature === renderedChoices) return;
        renderedChoices = signature;
        container.innerHTML = '';
        choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'choice';
            button.disabled = Boolean(myChoice) || Boolean(state.paused);
            if (myChoice && myChoice.id === choice.id) button.classList.add(myChoice.correct ? 'right' : 'wrong');
            const letter = document.createElement('b');
            letter.textContent = 'ABCD'[index] || String(index + 1);
            button.append(letter, ` ${choice.label}`);
            button.addEventListener('click', () => answerChoice(choice.id));
            container.appendChild(button);
        });
    }

    async function answerChoice(id) {
        if (myChoice) return;
        myChoice = { id, correct: false, pending: true };
        for (const button of $('choices').querySelectorAll('button')) button.disabled = true;
        try {
            const result = await post(`${api}/guess`, { token, text: id });
            if (result.correct) {
                myChoice = { id, correct: true };
                if (result.title) myFound.title = true;
                if (result.artist) myFound.artist = true;
                feedback(`Bonne réponse ! +${result.gained} pts`, true, 'circle-check');
                if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
            } else if (result.accepted) {
                myChoice = { id, correct: false };
                feedback('Raté, la réponse arrive à la révélation', false, 'circle-x');
                if (navigator.vibrate) navigator.vibrate(120);
            } else {
                myChoice = null;
                if (result.reason === 'paused') feedback('Pause', false, 'pause');
                else feedback('Trop tard pour cette manche', false, 'hourglass');
            }
        } catch (error) {
            myChoice = null;
            feedback(error.message, false);
        }
        renderedChoices = '';
        render();
    }

    function renderGuess() {
        $('countdown-big').hidden = state.phase !== 'countdown';
        $('guess-zone').hidden = state.phase !== 'guess';
        $('round-label').textContent = `Manche ${state.round}/${state.rounds}`;
        const mode = $('mode-label');
        mode.textContent = '';
        if (state.mode !== 'artist') {
            mode.appendChild(icon('music'));
            mode.appendChild(document.createTextNode(' titre'));
        }
        if (state.mode === 'both') mode.appendChild(document.createTextNode(' + '));
        if (state.mode !== 'title') {
            mode.appendChild(icon('mic'));
            mode.appendChild(document.createTextNode(' artiste'));
        }

        if (state.phase === 'countdown') {
            clearInterval(countdownTimer);
            const tick = () => {
                const left = Math.max(0, Math.ceil((state.paused ? state.pauseRemaining : state.phaseEndsAt - now()) / 1000));
                if (left) $('countdown-big').textContent = String(left);
                else if (!$('countdown-big').firstElementChild) label($('countdown-big'), 'music', '');
            };
            tick();
            countdownTimer = setInterval(tick, 100);
        } else {
            clearInterval(countdownTimer);
        }

        if (state.phase === 'guess') {
            const choices = state.choices || null;
            $('choices').hidden = !choices;
            $('guess-form').hidden = Boolean(choices);
            $('hint').hidden = Boolean(choices);
            $('my-found').hidden = Boolean(choices);
            if (choices) renderChoices(choices);
            const chips = [];
            if (state.mode !== 'artist') chips.push(myFound.title ? { icon: 'circle-check', text: 'Titre trouvé', done: true } : { icon: 'music', text: 'Titre ?' });
            if (state.mode !== 'title') chips.push(myFound.artist ? { icon: 'circle-check', text: 'Artiste trouvé', done: true } : { icon: 'mic', text: 'Artiste ?' });
            const signature = chips.map((chip) => chip.icon + chip.text).join('|');
            if (signature !== lastChips) {
                lastChips = signature;
                $('my-found').textContent = '';
                for (const chip of chips) {
                    const item = document.createElement('li');
                    if (chip.done) item.className = 'fresh';
                    label(item, chip.icon, chip.text);
                    $('my-found').appendChild(item);
                }
            }
            lastHint = renderHint($('hint'), formatHint(state.hint), lastHint);
            renderTeams(state.teams, $('live-teams'));
            renderPlayers(state.players, $('live-scores'), true);
            cancelAnimationFrame(timerFrame);
            const bar = $('timer-bar');
            const counter = $('timer-left');
            const animate = () => {
                const total = state.guessMs;
                const remaining = state.paused ? state.pauseRemaining : Math.max(0, state.phaseEndsAt - now());
                const seconds = String(Math.ceil(remaining / 1000));
                bar.style.width = (remaining / total * 100) + '%';
                bar.classList.toggle('urgent', remaining < 8000);
                counter.classList.toggle('urgent', remaining < 8000);
                if (counter.textContent !== seconds) counter.textContent = seconds;
                if (remaining > 0 && state.phase === 'guess' && !state.paused) timerFrame = requestAnimationFrame(animate);
            };
            animate();
        }
    }

    function renderReveal() {
        const track = state.track;
        if (!track) return;
        $('reveal-cover').src = track.image || '/favicon.svg';
        $('reveal-title').textContent = track.name;
        $('reveal-artists').textContent = track.artists.join(', ');
        renderTeams(state.teams, $('reveal-teams'));
        renderPlayers(state.players, $('reveal-scores'), true);
    }

    function renderPodium() {
        renderTeams(state.teams, $('podium-teams'));
        const list = $('podium-list');
        list.innerHTML = '';
        state.players.forEach((entry, index) => {
            const item = document.createElement('li');
            const score = document.createElement('b');
            score.textContent = entry.score;
            item.append(rankMark(index), ` ${entry.name}${entry.team ? ` [${entry.team}]` : ''} — `, score, ' pts');
            list.appendChild(item);
        });
        const stats = state.stats || {};
        const lines = [];
        if (stats.fastest) lines.push({ icon: 'zap', text: `Plus rapide : ${stats.fastest.name} en ${String(stats.fastest.seconds).replace('.', ',')} s sur « ${stats.fastest.track} »` });
        if (stats.firsts) lines.push({ icon: 'award', text: `Le plus souvent premier : ${stats.firsts.name} (${stats.firsts.count}×)` });
        if (stats.wildest) lines.push({ icon: 'laugh', text: `Réponse la plus hors sujet : « ${stats.wildest.guess} » de ${stats.wildest.name} pour « ${stats.wildest.track} »` });
        const statsList = $('podium-stats');
        statsList.innerHTML = '';
        for (const line of lines) {
            const item = document.createElement('li');
            label(item, line.icon, line.text);
            statsList.appendChild(item);
        }
        statsList.hidden = !lines.length;
    }

    function render() {
        if (!state) return;
        if (state.round !== lastRound) {
            lastRound = state.round;
            myFound = { title: false, artist: false };
            myChoice = null;
            renderedChoices = '';
            lastChips = '';
            $('guess-feedback').textContent = '';
            $('guess-feedback').className = '';
            $('guess-input').value = '';
        }

        $('host-toggle').hidden = !isHost;
        $('lobby-host').hidden = isHost;
        $('lobby-setup').hidden = !isHost;
        $('podium-actions').hidden = !isHost;
        $('podium-guest').hidden = isHost;
        const running = ['countdown', 'guess', 'reveal'].includes(state.phase);
        const paused = Boolean(state.paused) && running;
        $('host-bar').hidden = !(isHost && running) || paused;
        document.body.classList.toggle('has-bar', isHost && running && !paused);
        document.body.classList.toggle('paused', paused);
        $('pause-overlay').hidden = !paused;
        label($('pause-resume'), isHost ? 'play' : 'pause', '');
        $('pause-resume').disabled = !isHost;
        $('pause-text').textContent = isHost ? 'Touche pour reprendre la manche' : 'L\'hôte reprend quand il veut';
        $('pause-actions').hidden = !isHost;
        label($('bar-pause'), state.paused ? 'play' : 'pause', state.paused ? 'Reprendre' : 'Pause');
        label($('host-pause'), state.paused ? 'play' : 'pause', state.paused ? 'Reprendre' : 'Pause');
        $('guess-input').disabled = paused;
        document.body.classList.toggle('is-host', isHost);
        label($('host-playlist-info'), state.playlist ? 'disc-3' : null, playlistLabel(state.playlist, true));
        renderOptions();

        if (!token) {
            const teams = Boolean(state.options && state.options.play === 'teams');
            $('join-name').placeholder = teams ? 'Nom de votre équipe' : 'Ton pseudo';
            $('join-team').hidden = teams;
            label($('join-mode'), teams ? 'users' : null, teams ? 'Un téléphone par équipe : entrez le nom de votre équipe, vous répondez ensemble.' : '');
            $('join-mode').hidden = !teams;
            show('join');
        } else if (state.phase === 'lobby') {
            show('lobby');
            label($('lobby-playlist'), state.playlist ? 'disc-3' : null, playlistLabel(state.playlist, false));
            $('lobby-config').textContent = configLabel(state.options);
            $('lobby-notice').textContent = state.notice || '';
            $('lobby-notice').hidden = !state.notice;
            $('lobby-url').textContent = state.joinUrl || '';
            $('lobby-tv').hidden = !isHost || !state.joinUrl;
            label($('lobby-tv'), state.joinUrl ? 'tv' : null, state.joinUrl ? `Écran TV : ${state.joinUrl}/tv` : '');
            renderTeams(state.teams, $('lobby-teams'));
            renderPlayers(state.players, $('lobby-players'), false);
        } else if (state.phase === 'countdown' || state.phase === 'guess') {
            show('game');
            renderGuess();
            if (state.phase === 'guess' && lastPhase !== 'guess' && !state.choices) $('guess-input').focus({ preventScroll: true });
        } else if (state.phase === 'reveal') {
            show('reveal');
            renderReveal();
        } else if (state.phase === 'podium') {
            show('podium');
            renderPodium();
        }
        lastPhase = state.phase;
        syncAudio();
    }

    function connect() {
        if (source) source.close();
        sourceToken = token;
        lastMessage = Date.now();
        source = new EventSource(`/events?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`);
        source.addEventListener('state', (event) => {
            lastMessage = Date.now();
            state = JSON.parse(event.data);
            offset = state.serverNow - Date.now();
            render();
        });
        source.addEventListener('ping', () => {
            lastMessage = Date.now();
        });
    }

    function feedback(message, ok, name) {
        const element = $('guess-feedback');
        element.className = '';
        void element.offsetWidth;
        label(element, name, message);
        element.className = ok ? 'ok' : 'ko';
    }

    function hostFeedback(message, warn) {
        label($('host-feedback'), warn && message ? 'triangle-alert' : null, message);
    }

    async function hostAction(route, data) {
        try {
            hostFeedback('…');
            await post(route, data);
            hostFeedback('');
            return true;
        } catch (error) {
            hostFeedback(error.message, true);
            return false;
        }
    }

    function toggleHostPanel(open) {
        $('host-panel').hidden = !open;
        $('host-backdrop').hidden = !open;
        $('host-toggle').setAttribute('aria-expanded', String(open));
        if (open) refreshHost();
    }

    async function refreshHost() {
        try {
            const status = await post(`${api}/host/status`, null, 'GET');
            $('host-key').textContent = `Clé hôte de la salle ${room} : ${status.key}`;
            const account = status.spotify || {};
            $('host-spotify').hidden = !account.configured;
            $('host-spotify-actions').hidden = !account.configured;
            label($('host-spotify'), 'headphones', account.connected ? `Spotify : ${account.account ? account.account.name : 'compte connecté'}` : 'Spotify : compte non connecté (liens publics OK ; connecte-le pour tes playlists privées)');
            label($('host-connect'), 'headphones', account.connected ? 'Changer de compte Spotify' : 'Connecter mon compte Spotify');
            $('host-playlists').hidden = !account.connected;
            const container = $('host-presets');
            container.innerHTML = '';
            container.hidden = !status.presets.length;
            for (const preset of status.presets) {
                const button = document.createElement('button');
                button.type = 'button';
                label(button, 'disc-3', preset.name);
                button.addEventListener('click', () => hostAction(`${api}/host/playlist`, { url: preset.url }));
                container.appendChild(button);
            }
        } catch (error) {
            hostFeedback(error.message, true);
        }
    }

    async function initHome(message) {
        show('home');
        $('home-feedback').textContent = message || '';
        const info = await post('/api/info', null, 'GET').catch(() => null);
        if (info && info.home) {
            $('home-house').hidden = false;
            $('home-house').addEventListener('click', () => {
                location.href = `/r/${info.home}`;
            });
        }
    }

    async function initRoom() {
        try {
            await post(api, null, 'GET');
        } catch (error) {
            return initHome(error.message === 'Salle introuvable' ? `La salle ${room} n'existe plus : crée-en une nouvelle ou entre un autre code.` : error.message);
        }
        post('/api/info', null, 'GET').then((info) => {
            if (info.pagesUrl) installUrl = info.pagesUrl;
        }).catch(() => null);
        $('join-room').textContent = `Salle ${room}`;
        if (myName) $('join-name').value = myName;
        if (myTeam) $('join-team').value = myTeam;
        renderHostButton();
        renderSpeaker();
        show('join');
        connect();
    }

    $('home-create').addEventListener('click', async () => {
        try {
            $('home-feedback').textContent = 'Création de la salle…';
            const created = await post('/api/rooms', {});
            storage.set(`bt_hostkey_${created.code}`, created.hostKey);
            storage.set(`bt_host_${created.code}`, '1');
            location.href = `/r/${created.code}`;
        } catch (error) {
            $('home-feedback').textContent = error.message;
        }
    });

    $('home-join-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const code = $('home-code').value.trim().toUpperCase();
        if (!code) return;
        try {
            await post(`/api/r/${encodeURIComponent(code)}`, null, 'GET');
            location.href = `/r/${code}`;
        } catch (error) {
            $('home-feedback').textContent = error.message === 'Salle introuvable' ? `Aucune salle ${code}` : error.message;
        }
    });

    $('join-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        $('join-feedback').textContent = '';
        try {
            const result = await post(`${api}/join`, { name: $('join-name').value, team: $('join-team').value, token });
            token = result.token;
            myName = result.name;
            myTeam = result.team || '';
            storage.set(`bt_token_${room}`, token);
            storage.set('bt_name', myName);
            storage.set('bt_team', myTeam);
            keepAwake();
            state = result.state;
            render();
            if (sourceToken !== token) connect();
        } catch (error) {
            $('join-feedback').textContent = error.message;
        }
    });

    $('guess-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const text = $('guess-input').value.trim();
        if (!text) return;
        $('guess-input').value = '';
        try {
            const result = await post(`${api}/guess`, { token, text });
            if (result.title && result.artist) feedback(`Titre + artiste ! +${result.gained} pts`, true, 'flame');
            else if (result.title) feedback(`Titre ! +${result.gained} pts`, true, 'music');
            else if (result.artist) feedback(`Artiste ! +${result.gained} pts`, true, 'mic');
            else if (result.reason === 'throttle') feedback('Doucement…', false, 'hourglass');
            else if (result.reason === 'paused') feedback('Pause', false, 'pause');
            else if (result.accepted) feedback('Non, essaie encore', false, 'circle-x');
            if (result.gained && navigator.vibrate) navigator.vibrate(result.title && result.artist ? [60, 40, 60] : 40);
            if (result.title) myFound.title = true;
            if (result.artist) myFound.artist = true;
            render();
        } catch (error) {
            if (error.message.includes('inconnu')) {
                token = '';
                storage.remove(`bt_token_${room}`);
                render();
            } else {
                feedback(error.message, false);
            }
        }
    });

    function toggleHost() {
        if (!isHost && !hostKey) {
            const entered = (prompt('Clé hôte ? (le code hôte de la salle de la maison, ou la clé reçue à la création de la salle)') || '').trim();
            if (!entered) return;
            hostKey = entered;
            storage.set(`bt_hostkey_${room}`, hostKey);
        }
        isHost = !isHost;
        storage.set(`bt_host_${room}`, isHost ? '1' : '0');
        renderHostButton();
        render();
    }

    $('become-host').addEventListener('click', toggleHost);
    $('lobby-host').addEventListener('click', () => {
        toggleHost();
        if (isHost) toggleHostPanel(true);
    });
    $('lobby-back').addEventListener('click', () => {
        const leaving = token;
        token = '';
        storage.remove(`bt_token_${room}`);
        if (leaving) post(`${api}/leave`, { token: leaving }).catch(() => null);
        render();
    });

    $('host-toggle').addEventListener('click', () => toggleHostPanel($('host-panel').hidden));
    $('host-close').addEventListener('click', () => toggleHostPanel(false));
    $('host-backdrop').addEventListener('click', () => toggleHostPanel(false));
    (() => {
        const panel = $('host-panel');
        const grab = $('sheet-grab');
        let pointerId = null;
        let pointerStart = 0;
        let pointerDelta = 0;
        grab.addEventListener('pointerdown', (event) => {
            if (event.target.closest('button')) return;
            pointerId = event.pointerId;
            pointerStart = event.clientY;
            pointerDelta = 0;
            panel.style.transition = 'none';
            try {
                grab.setPointerCapture(pointerId);
            } catch (_error) {
                pointerId = event.pointerId;
            }
        });
        grab.addEventListener('pointermove', (event) => {
            if (event.pointerId !== pointerId) return;
            pointerDelta = Math.max(0, event.clientY - pointerStart);
            panel.style.transform = pointerDelta ? `translateY(${pointerDelta}px)` : '';
        });
        const pointerRelease = (event) => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            panel.style.transition = '';
            panel.style.transform = '';
            if (pointerDelta > 80) toggleHostPanel(false);
        };
        grab.addEventListener('pointerup', pointerRelease);
        grab.addEventListener('pointercancel', pointerRelease);
        let startY = 0;
        let delta = 0;
        let dragging = false;
        panel.addEventListener('touchstart', (event) => {
            if (panel.scrollTop > 0 || event.touches.length !== 1 || grab.contains(event.target)) return;
            startY = event.touches[0].clientY;
            delta = 0;
            dragging = true;
            panel.style.transition = 'none';
        }, { passive: true });
        panel.addEventListener('touchmove', (event) => {
            if (!dragging) return;
            delta = event.touches[0].clientY - startY;
            if (delta <= 0 || panel.scrollTop > 0) {
                delta = 0;
                panel.style.transform = '';
                return;
            }
            panel.style.transform = `translateY(${delta}px)`;
        }, { passive: true });
        const release = () => {
            if (!dragging) return;
            dragging = false;
            panel.style.transition = '';
            panel.style.transform = '';
            if (delta > 110) toggleHostPanel(false);
        };
        panel.addEventListener('touchend', release);
        panel.addEventListener('touchcancel', release);
    })();
    $('host-speaker').addEventListener('click', () => setSpeaker(!speaker));
    for (const group of document.querySelectorAll('.segmented[data-option]')) {
        group.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-value]');
            if (!button) return;
            const key = group.dataset.option;
            let value = button.dataset.value;
            if (key === 'hints') value = value === 'true';
            else if (key === 'rounds' || key === 'guessSeconds') value = Number(value);
            if (navigator.vibrate) navigator.vibrate(10);
            hostAction(`${api}/host/options`, { [key]: value });
        });
    }
    $('host-install').addEventListener('click', () => {
        location.href = installUrl;
    });
    const native = window.BlindTestApp || null;
    if (native) {
        $('host-app-title').hidden = false;
        $('host-app').hidden = false;
        try {
            label($('app-update'), 'download', `Mettre à jour l'appli (${native.version()})`);
        } catch (_error) {
            label($('app-update'), 'download', 'Mettre à jour l\'appli');
        }
        $('app-update').addEventListener('click', () => native.checkUpdate());
        $('app-settings').addEventListener('click', () => native.openSettings());
        $('app-quit').addEventListener('click', () => {
            if (confirm('Arrêter le serveur et fermer l\'appli ? La partie en cours sera perdue.')) native.quit();
        });
    }
    $('host-connect').addEventListener('click', () => {
        location.href = `/auth/spotify?room=${encodeURIComponent(room)}&key=${encodeURIComponent(hostKey)}&back=${encodeURIComponent(location.origin)}`;
    });
    function renderPlaylists(playlists, emptyMessage) {
        const list = $('host-playlist-list');
        list.innerHTML = '';
        for (const playlist of playlists) {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            const parts = [playlist.total ? `${playlist.name} (${playlist.total})` : playlist.name];
            if (playlist.owner) parts.push(playlist.owner);
            parts.push(playlist.source === 'deezer' ? 'Deezer' : 'Spotify');
            if (playlist.source !== 'deezer' && !playlist.mine && playlist.total > 100) parts.push('100 premiers titres');
            button.textContent = parts.join(' · ');
            button.addEventListener('click', () => {
                list.innerHTML = '';
                hostAction(`${api}/host/playlist`, { url: `${playlist.source === 'deezer' ? 'deezer' : 'spotify'}:playlist:${playlist.id}` });
            });
            item.appendChild(button);
            list.appendChild(item);
        }
        hostFeedback(playlists.length ? '' : emptyMessage);
    }

    $('host-playlists').addEventListener('click', async () => {
        try {
            hostFeedback('…');
            const { playlists } = await post(`${api}/host/playlists`, null, 'GET');
            renderPlaylists(playlists, 'Aucune playlist sur ce compte');
        } catch (error) {
            hostFeedback(error.message, true);
        }
    });


    function looksLikeLink(text) {
        return /https?:\/\/|spotify:|deezer:|^[A-Za-z0-9]{22}$|^\d{4,}$/.test(text);
    }

    $('playlist-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const text = $('playlist-url').value.trim();
        if (!text) return;
        const list = $('host-playlist-list');
        if (looksLikeLink(text)) {
            list.innerHTML = '';
            hostAction(`${api}/host/playlist`, { url: text });
            return;
        }
        try {
            hostFeedback('…');
            const { playlists } = await post(`${api}/host/search`, { q: text });
            renderPlaylists(playlists, 'Aucune playlist trouvée, essaie un autre nom ou colle un lien');
            $('playlist-url').blur();
            list.scrollIntoView({ block: 'nearest' });
        } catch (error) {
            hostFeedback(error.message, true);
        }
    });
    $('host-start').addEventListener('click', async () => {
        if (await hostAction(`${api}/host/start`)) toggleHostPanel(false);
    });
    $('podium-replay').addEventListener('click', async () => {
        toggleHostPanel(true);
        if (await hostAction(`${api}/host/start`)) toggleHostPanel(false);
    });
    $('podium-setup').addEventListener('click', async () => {
        toggleHostPanel(true);
        await hostAction(`${api}/host/lobby`);
    });
    $('lobby-setup').addEventListener('click', () => toggleHostPanel(true));
    function pauseRoute() {
        return `${api}/host/${state && state.paused ? 'resume' : 'pause'}`;
    }

    async function barAction(route) {
        if (!(await hostAction(route))) toggleHostPanel(true);
    }

    $('host-pause').addEventListener('click', () => hostAction(pauseRoute()));
    $('host-skip').addEventListener('click', () => hostAction(`${api}/host/skip`));
    $('host-stop').addEventListener('click', () => hostAction(`${api}/host/stop`));
    $('host-lobby').addEventListener('click', () => hostAction(`${api}/host/lobby`));
    $('bar-pause').addEventListener('click', () => barAction(pauseRoute()));
    $('pause-resume').addEventListener('click', () => barAction(pauseRoute()));
    $('pause-skip').addEventListener('click', () => barAction(`${api}/host/skip`));
    $('pause-stop').addEventListener('click', () => barAction(`${api}/host/stop`));
    $('pause-lobby').addEventListener('click', () => barAction(`${api}/host/lobby`));
    $('bar-skip').addEventListener('click', () => barAction(`${api}/host/skip`));
    $('bar-stop').addEventListener('click', () => barAction(`${api}/host/stop`));
    $('bar-lobby').addEventListener('click', () => barAction(`${api}/host/lobby`));

    document.addEventListener('pointerdown', () => {
        if (speaker && !$('sound-help').hidden) syncAudio();
    }, { passive: true });

    setInterval(() => {
        if (source && Date.now() - lastMessage > 40000) connect();
        syncAudio();
    }, 5000);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (token) keepAwake();
        if (source && Date.now() - lastMessage > 30000) connect();
    });

    if (room) {
        $('lobby-qr').src = `/r/${room}/qr.svg`;
        initRoom();
    } else {
        initHome();
    }
})();
