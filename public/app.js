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
        } catch {
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
    let castContext = null;
    const seen = new Map();

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
            const entered = (prompt('Clé hôte ? (6 chiffres pour la salle de la maison, ou la clé reçue à la création de la salle)') || '').trim();
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
        } catch {
            wakeLock = null;
        }
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

    function renderPlayers(list, element, withGains) {
        element.innerHTML = '';
        for (const player of list) {
            const item = document.createElement('li');
            const key = `${element.id}:${player.name}`;
            if (!seen.has(key)) item.classList.add('fresh');
            else if (seen.get(key) < player.score) item.classList.add('bump');
            seen.set(key, player.score);
            const found = [player.found.title ? '🎵' : '', player.found.artist ? '🎤' : ''].join('');
            const gained = withGains && player.gained ? ` +${player.gained}` : '';
            const team = player.team ? ` [${player.team}]` : '';
            const offline = player.online === false;
            item.textContent = `${player.name}${team} — ${player.score}${gained} ${found}${offline ? ' 💤' : ''}`;
            item.classList.toggle('offline', offline);
            if (player.lastGuess) {
                const guess = document.createElement('span');
                guess.className = 'last-guess';
                guess.textContent = `« ${player.lastGuess} »`;
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
        $('stalled-zone').hidden = state.phase !== 'stalled';
        $('round-label').textContent = `Manche ${state.round}/${state.rounds}`;
        $('mode-label').textContent = { both: '🎵 titre + 🎤 artiste', title: '🎵 titre', artist: '🎤 artiste' }[state.mode];

        if (state.phase === 'countdown') {
            clearInterval(countdownTimer);
            const tick = () => {
                const left = Math.max(0, Math.ceil((state.phaseEndsAt - now()) / 1000));
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
                const remaining = Math.max(0, state.phaseEndsAt - now());
                const seconds = String(Math.ceil(remaining / 1000));
                bar.style.width = (remaining / total * 100) + '%';
                bar.classList.toggle('urgent', remaining < 8000);
                counter.classList.toggle('urgent', remaining < 8000);
                if (counter.textContent !== seconds) counter.textContent = seconds;
                if (remaining > 0 && state.phase === 'guess') timerFrame = requestAnimationFrame(animate);
            };
            animate();
        }

        if (state.phase === 'stalled') {
            $('stalled-message').textContent = state.notice || 'Lecture Spotify impossible';
            $('stalled-retry').hidden = !isHost;
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
        state.players.forEach((player, index) => {
            const item = document.createElement('li');
            const score = document.createElement('b');
            score.textContent = player.score;
            item.append(`${medals[index] || '•'} ${player.name}${player.team ? ` [${player.team}]` : ''} — `, score, ' pts');
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
        document.body.classList.toggle('is-host', isHost);
        $('host-retry').hidden = state.phase !== 'stalled';
        $('host-playlist-info').textContent = state.playlist
            ? `📀 ${state.playlist.name} (${state.playlist.total} titres)` : 'Aucune playlist chargée';

        if (!token) return show('join');
        if (state.phase === 'lobby') {
            show('lobby');
            $('lobby-playlist').textContent = state.playlist ? `📀 ${state.playlist.name}` : '';
            $('lobby-notice').textContent = state.notice || '';
            $('lobby-notice').hidden = !state.notice;
            $('lobby-url').textContent = state.joinUrl || '';
            $('lobby-spotify').hidden = state.spotify !== false;
            renderTeams(state.teams, $('lobby-teams'));
            renderPlayers(state.players, $('lobby-players'), false);
        } else if (state.phase === 'countdown' || state.phase === 'guess' || state.phase === 'stalled') {
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
        } catch (error) {
            hostFeedback('⚠ ' + error.message);
        }
    }

    function toggleHostPanel(open) {
        $('host-panel').hidden = !open;
        $('host-toggle').setAttribute('aria-expanded', String(open));
        if (open) refreshHost();
    }

    async function refreshHost() {
        try {
            const status = await post(`${api}/host/status`, null, 'GET');
            const account = status.spotify.account;
            $('host-key').textContent = `Clé hôte de la salle ${room} : ${status.key}`;
            $('host-spotify').textContent = status.spotify.connected
                ? `🎧 Spotify : ${account ? account.name : 'connecté'}${account && account.premium === false ? ' (pas Premium : la lecture échouera)' : ''}`
                : '🎧 Spotify : non connecté';
            $('host-connect').hidden = !status.auth;
            $('host-connect').textContent = status.spotify.connected ? '🎧 Changer de compte Spotify' : '🎧 Connecter Spotify';
            $('host-playlists').hidden = !status.spotify.connected;
        } catch (error) {
            hostFeedback('⚠ ' + error.message);
        }
        const { presets } = await post('/api/presets', null, 'GET').catch(() => ({ presets: [] }));
        const container = $('host-presets');
        container.innerHTML = '';
        container.hidden = !presets.length;
        for (const preset of presets) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `📀 ${preset.name}`;
            button.addEventListener('click', () => hostAction(`${api}/host/playlist`, { url: preset.url }));
            container.appendChild(button);
        }
    }

    function setupCast(appId) {
        const framework = window.cast && window.cast.framework;
        if (!framework || !window.chrome || !window.chrome.cast) return;
        castContext = framework.CastContext.getInstance();
        castContext.setOptions({ receiverApplicationId: appId, autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
        castContext.addEventListener(framework.CastContextEventType.SESSION_STATE_CHANGED, (event) => {
            const session = castContext.getCurrentSession();
            const started = event.sessionState === framework.SessionState.SESSION_STARTED || event.sessionState === framework.SessionState.SESSION_RESUMED;
            if (started && session) session.sendMessage('urn:x-cast:fr.blindtest', { room });
            $('host-cast').textContent = session ? '📺 Arrêter la diffusion TV' : '📺 Caster sur la TV';
        });
        $('host-cast').hidden = false;
    }

    function loadCast(appId) {
        if (!appId || !room || /iPhone|iPad|iPod/.test(navigator.userAgent)) return;
        window.__onGCastApiAvailable = (available) => {
            if (available) setupCast(appId);
        };
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
        document.head.appendChild(script);
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
        post('/api/info', null, 'GET').then((info) => loadCast(info.cast)).catch(() => null);
        $('join-room').textContent = `Salle ${room}`;
        if (myName) $('join-name').value = myName;
        if (myTeam) $('join-team').value = myTeam;
        if (isHost) $('become-host').textContent = 'Hôte activé ✔ (re-clique pour désactiver)';
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

    $('become-host').addEventListener('click', () => {
        if (!isHost && !hostKey) {
            const entered = (prompt('Clé hôte ? (6 chiffres pour la salle de la maison, ou la clé reçue à la création de la salle)') || '').trim();
            if (!entered) return;
            hostKey = entered;
            storage.set(`bt_hostkey_${room}`, hostKey);
        }
        isHost = !isHost;
        storage.set(`bt_host_${room}`, isHost ? '1' : '0');
        $('become-host').textContent = isHost ? 'Hôte activé ✔ (re-clique pour désactiver)' : 'Je suis l\'hôte 🎛️';
        render();
    });

    $('host-toggle').addEventListener('click', () => toggleHostPanel($('host-panel').hidden));
    $('host-close').addEventListener('click', () => toggleHostPanel(false));
    $('host-connect').addEventListener('click', () => {
        location.href = `/auth/spotify?room=${encodeURIComponent(room)}&key=${encodeURIComponent(hostKey)}`;
    });

    $('host-cast').addEventListener('click', async () => {
        if (!castContext) return;
        try {
            if (castContext.getCurrentSession()) {
                castContext.endCurrentSession(true);
                return;
            }
            hostFeedback('Choisis la TV dans la fenêtre…');
            await castContext.requestSession();
            hostFeedback('');
        } catch {
            hostFeedback('');
        }
    });

    $('host-playlists').addEventListener('click', async () => {
        const list = $('host-playlist-list');
        try {
            hostFeedback('…');
            const { playlists } = await post(`${api}/host/playlists`, null, 'GET');
            list.innerHTML = '';
            for (const playlist of playlists) {
                const item = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = `${playlist.name} (${playlist.total})`;
                button.addEventListener('click', () => {
                    list.innerHTML = '';
                    hostAction(`${api}/host/playlist`, { url: `spotify:playlist:${playlist.id}` });
                });
                item.appendChild(button);
                list.appendChild(item);
            }
            hostFeedback(playlists.length ? '' : 'Aucune playlist sur ce compte');
        } catch (error) {
            hostFeedback('⚠ ' + error.message);
        }
    });

    $('playlist-form').addEventListener('submit', (event) => {
        event.preventDefault();
        hostAction(`${api}/host/playlist`, { url: $('playlist-url').value });
    });
    $('host-start').addEventListener('click', () => {
        hostAction(`${api}/host/start`, {
            rounds: Number($('opt-rounds').value),
            mode: $('opt-mode').value,
            guessSeconds: Number($('opt-duration').value),
            hints: $('opt-hints').value === 'on'
        });
        toggleHostPanel(false);
    });
    $('host-skip').addEventListener('click', () => hostAction(`${api}/host/skip`));
    $('host-retry').addEventListener('click', () => hostAction(`${api}/host/retry`));
    $('stalled-retry').addEventListener('click', () => hostAction(`${api}/host/retry`));
    $('host-stop').addEventListener('click', () => hostAction(`${api}/host/stop`));
    $('host-lobby').addEventListener('click', () => hostAction(`${api}/host/lobby`));

    $('host-devices-refresh').addEventListener('click', async () => {
        try {
            const result = await post(`${api}/host/devices`, null, 'GET');
            const list = $('host-devices');
            list.innerHTML = '';
            for (const device of result.devices) {
                const item = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = `${device.is_active ? '🔊 ' : ''}${device.name} (${device.type})`;
                button.addEventListener('click', () => hostAction(`${api}/host/device`, { id: device.id }));
                item.appendChild(button);
                list.appendChild(item);
            }
            if (!result.devices.length) hostFeedback('Aucun appareil : ouvre Spotify sur ton tel ou caste sur la TV');
        } catch (error) {
            hostFeedback('⚠ ' + error.message);
        }
    });

    setInterval(() => {
        if (source && Date.now() - lastMessage > 40000) connect();
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
