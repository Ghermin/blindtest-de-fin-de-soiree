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
    let source = null;
    let sourceToken = null;
    let lastMessage = 0;
    let playerSrc = '';
    const seen = new Map();
    const player = new Audio();
    player.preload = 'auto';

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
        $('host-speaker').textContent = `🔈 Son sur ce téléphone : ${speaker ? 'oui' : 'non'}`;
        if (!speaker) $('sound-help').hidden = true;
        syncAudio();
    }

    function spaced(pattern) {
        return pattern.split(' ').map((word) => word.split('').join(' ')).join('   ');
    }

    function formatHint(hint) {
        if (!hint) return '';
        const lines = [];
        if (hint.title) lines.push(`🎵 ${spaced(hint.title)}`);
        if (hint.artist) lines.push(`🎤 ${spaced(hint.artist)}`);
        return lines.join('\n');
    }

    function playlistLabel(playlist, long) {
        if (!playlist) return long ? 'Aucune playlist chargée' : '';
        const base = `📀 ${playlist.name}${playlist.partial ? ' (100 premiers titres)' : ''}`;
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
            const found = [entry.found.title ? '🎵' : '', entry.found.artist ? '🎤' : ''].join('');
            const gained = withGains && entry.gained ? ` +${entry.gained}` : '';
            const team = entry.team ? ` [${entry.team}]` : '';
            const offline = entry.online === false;
            item.textContent = `${entry.name}${team} — ${entry.score}${gained} ${found}${offline ? ' 💤' : ''}`;
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

    function renderGuess() {
        $('countdown-big').hidden = state.phase !== 'countdown';
        $('guess-zone').hidden = state.phase !== 'guess';
        $('round-label').textContent = `Manche ${state.round}/${state.rounds}`;
        $('mode-label').textContent = { both: '🎵 titre + 🎤 artiste', title: '🎵 titre', artist: '🎤 artiste' }[state.mode];

        if (state.phase === 'countdown') {
            clearInterval(countdownTimer);
            const tick = () => {
                const left = Math.max(0, Math.ceil((state.paused ? state.pauseRemaining : state.phaseEndsAt - now()) / 1000));
                $('countdown-big').textContent = left || '🎶';
            };
            tick();
            countdownTimer = setInterval(tick, 100);
        } else {
            clearInterval(countdownTimer);
        }

        if (state.phase === 'guess') {
            const chips = [];
            if (state.mode !== 'artist') chips.push(myFound.title ? '✅ Titre trouvé' : '🎵 Titre ?');
            if (state.mode !== 'title') chips.push(myFound.artist ? '✅ Artiste trouvé' : '🎤 Artiste ?');
            const signature = chips.join('|');
            if (signature !== lastChips) {
                lastChips = signature;
                $('my-found').innerHTML = chips.map((chip) => `<li${chip.startsWith('✅') ? ' class="fresh"' : ''}>${chip}</li>`).join('');
            }
            const hint = formatHint(state.hint);
            if (hint !== $('hint').textContent) {
                $('hint').textContent = hint;
                $('hint').classList.remove('fresh');
                void $('hint').offsetWidth;
                if (hint) $('hint').classList.add('fresh');
            }
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
        const medals = ['🥇', '🥈', '🥉'];
        renderTeams(state.teams, $('podium-teams'));
        const list = $('podium-list');
        list.innerHTML = '';
        state.players.forEach((entry, index) => {
            const item = document.createElement('li');
            const score = document.createElement('b');
            score.textContent = entry.score;
            item.append(`${medals[index] || '•'} ${entry.name}${entry.team ? ` [${entry.team}]` : ''} — `, score, ' pts');
            list.appendChild(item);
        });
        const stats = state.stats || {};
        const lines = [];
        if (stats.fastest) lines.push(`⚡ Plus rapide : ${stats.fastest.name} en ${String(stats.fastest.seconds).replace('.', ',')} s sur « ${stats.fastest.track} »`);
        if (stats.firsts) lines.push(`🥇 Le plus souvent premier : ${stats.firsts.name} (${stats.firsts.count}×)`);
        if (stats.wildest) lines.push(`😅 Réponse la plus hors sujet : « ${stats.wildest.guess} » de ${stats.wildest.name} pour « ${stats.wildest.track} »`);
        const statsList = $('podium-stats');
        statsList.innerHTML = '';
        for (const line of lines) {
            const item = document.createElement('li');
            item.textContent = line;
            statsList.appendChild(item);
        }
        statsList.hidden = !lines.length;
    }

    function render() {
        if (!state) return;
        if (state.round !== lastRound) {
            lastRound = state.round;
            myFound = { title: false, artist: false };
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
        $('host-bar').hidden = !(isHost && running);
        document.body.classList.toggle('has-bar', isHost && running);
        document.body.classList.toggle('paused', Boolean(state.paused));
        $('bar-pause').textContent = state.paused ? '▶ Reprendre' : '⏸ Pause';
        $('host-pause').textContent = state.paused ? '▶ Reprendre' : '⏸ Pause';
        $('game-paused').hidden = !state.paused;
        $('guess-input').disabled = Boolean(state.paused);
        document.body.classList.toggle('is-host', isHost);
        $('host-playlist-info').textContent = playlistLabel(state.playlist, true);

        if (!token) {
            show('join');
        } else if (state.phase === 'lobby') {
            show('lobby');
            $('lobby-playlist').textContent = playlistLabel(state.playlist, false);
            $('lobby-notice').textContent = state.notice || '';
            $('lobby-notice').hidden = !state.notice;
            $('lobby-url').textContent = state.joinUrl || '';
            renderTeams(state.teams, $('lobby-teams'));
            renderPlayers(state.players, $('lobby-players'), false);
        } else if (state.phase === 'countdown' || state.phase === 'guess') {
            show('game');
            renderGuess();
            if (state.phase === 'guess' && lastPhase !== 'guess') $('guess-input').focus({ preventScroll: true });
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

    function feedback(message, ok) {
        const element = $('guess-feedback');
        element.className = '';
        void element.offsetWidth;
        element.textContent = message;
        element.className = ok ? 'ok' : 'ko';
    }

    function hostFeedback(message) {
        $('host-feedback').textContent = message;
    }

    async function hostAction(route, data) {
        try {
            hostFeedback('…');
            await post(route, data);
            hostFeedback('');
            return true;
        } catch (error) {
            hostFeedback('⚠ ' + error.message);
            return false;
        }
    }

    function startOptions() {
        return {
            rounds: Number($('opt-rounds').value),
            mode: $('opt-mode').value,
            guessSeconds: Number($('opt-duration').value),
            hints: $('opt-hints').value === 'on'
        };
    }

    function toggleHostPanel(open) {
        $('host-panel').hidden = !open;
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
            $('host-spotify').textContent = account.connected ? `🎧 Spotify : ${account.account ? account.account.name : 'compte connecté'}` : '🎧 Spotify : compte non connecté (liens publics OK ; connecte-le pour tes playlists privées)';
            $('host-connect').textContent = account.connected ? '🎧 Changer de compte Spotify' : '🎧 Connecter mon compte Spotify';
            $('host-playlists').hidden = !account.connected;
            const container = $('host-presets');
            container.innerHTML = '';
            container.hidden = !status.presets.length;
            for (const preset of status.presets) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = `📀 ${preset.name}`;
                button.addEventListener('click', () => hostAction(`${api}/host/playlist`, { url: preset.url }));
                container.appendChild(button);
            }
        } catch (error) {
            hostFeedback('⚠ ' + error.message);
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
        $('join-room').textContent = `Salle ${room}`;
        if (myName) $('join-name').value = myName;
        if (myTeam) $('join-team').value = myTeam;
        if (isHost) $('become-host').textContent = 'Hôte activé ✔ (re-clique pour désactiver)';
        $('host-speaker').textContent = `🔈 Son sur ce téléphone : ${speaker ? 'oui' : 'non'}`;
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
            if (result.title && result.artist) feedback(`🔥 Titre + artiste ! +${result.gained} pts`, true);
            else if (result.title) feedback(`🎵 Titre ! +${result.gained} pts`, true);
            else if (result.artist) feedback(`🎤 Artiste ! +${result.gained} pts`, true);
            else if (result.reason === 'throttle') feedback('Doucement… ⏳', false);
            else if (result.reason === 'paused') feedback('⏸ Pause', false);
            else if (result.accepted) feedback('❌ Non, essaie encore', false);
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
        $('become-host').textContent = isHost ? 'Hôte activé ✔ (re-clique pour désactiver)' : 'Je suis l\'hôte 🎛️';
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
    $('host-speaker').addEventListener('click', () => setSpeaker(!speaker));
    $('host-install').addEventListener('click', () => {
        location.href = `/install?key=${encodeURIComponent(hostKey)}`;
    });
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
            hostFeedback('⚠ ' + error.message);
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
            hostFeedback('⚠ ' + error.message);
        }
    });
    $('host-start').addEventListener('click', async () => {
        if (await hostAction(`${api}/host/start`, startOptions())) toggleHostPanel(false);
    });
    $('podium-replay').addEventListener('click', async () => {
        toggleHostPanel(true);
        if (await hostAction(`${api}/host/start`, startOptions())) toggleHostPanel(false);
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
