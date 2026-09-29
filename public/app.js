(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const screens = ['join', 'lobby', 'game', 'reveal', 'podium'];

    let token = localStorage.getItem('bt_token') || '';
    let myName = localStorage.getItem('bt_name') || '';
    let isHost = localStorage.getItem('bt_host') === '1';
    let pin = localStorage.getItem('bt_pin') || '';
    let state = null;
    let offset = 0;
    let lastRound = 0;
    let myFound = { title: false, artist: false };
    let timerFrame = null;
    let countdownTimer = null;

    async function post(route, data) {
        const response = await fetch(route, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Host-Pin': pin },
            body: JSON.stringify(data || {})
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 403) {
            pin = prompt('Code hôte ?') || '';
            localStorage.setItem('bt_pin', pin);
            if (pin) return post(route, data);
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

    function renderPlayers(list, element, withGains) {
        element.innerHTML = '';
        for (const player of list) {
            const item = document.createElement('li');
            const found = [player.found.title ? '🎵' : '', player.found.artist ? '🎤' : ''].join('');
            const gained = withGains && player.gained ? ` +${player.gained}` : '';
            item.textContent = `${player.name} — ${player.score}${gained} ${found}`;
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
            $('my-found').innerHTML = chips.map((chip) => `<li>${chip}</li>`).join('');
            renderPlayers(state.players, $('live-scores'), true);
            cancelAnimationFrame(timerFrame);
            const bar = $('timer-bar');
            const animate = () => {
                const total = state.guessMs;
                const left = Math.max(0, state.phaseEndsAt - now());
                bar.style.width = (left / total * 100) + '%';
                bar.classList.toggle('urgent', left < 8000);
                if (left > 0 && state.phase === 'guess') timerFrame = requestAnimationFrame(animate);
            };
            animate();
        }

        if (state.phase === 'stalled') {
            $('stalled-message').textContent = state.notice || 'Lecture Spotify impossible';
            $('host-retry').hidden = !isHost;
        }
    }

    function renderReveal() {
        const track = state.track;
        if (!track) return;
        $('reveal-cover').src = track.image || '/favicon.svg';
        $('reveal-title').textContent = track.name;
        $('reveal-artists').textContent = track.artists.join(', ');
        renderPlayers(state.players, $('reveal-scores'), true);
    }

    function renderPodium() {
        const medals = ['🥇', '🥈', '🥉'];
        $('podium-list').innerHTML = state.players
            .map((player, index) => `<li>${medals[index] || '•'} ${player.name} — <b>${player.score}</b> pts</li>`)
            .join('');
    }

    function render() {
        if (!state) return;
        if (state.round !== lastRound) {
            lastRound = state.round;
            myFound = { title: false, artist: false };
            $('guess-feedback').textContent = '';
            $('guess-input').value = '';
        }

        $('host-toggle').hidden = !isHost;
        $('host-retry').hidden = state.phase !== 'stalled';
        $('host-playlist-info').textContent = state.playlist
            ? `📀 ${state.playlist.name} (${state.playlist.total} titres)` : 'Aucune playlist chargée';

        if (!token) return show('join');
        if (state.phase === 'lobby') {
            show('lobby');
            $('lobby-playlist').textContent = state.playlist ? `📀 ${state.playlist.name}` : '';
            renderPlayers(state.players, $('lobby-players'), false);
        } else if (state.phase === 'countdown' || state.phase === 'guess' || state.phase === 'stalled') {
            show('game');
            renderGuess();
        } else if (state.phase === 'reveal') {
            show('reveal');
            renderReveal();
        } else if (state.phase === 'podium') {
            show('podium');
            renderPodium();
        }
    }

    function connect() {
        const source = new EventSource('/events');
        source.addEventListener('state', (event) => {
            state = JSON.parse(event.data);
            offset = state.serverNow - Date.now();
            render();
        });
    }

    function feedback(message, ok) {
        const element = $('guess-feedback');
        element.textContent = message;
        element.className = ok ? 'ok' : 'ko';
    }

    $('join-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const result = await post('/api/join', { name: $('join-name').value, token });
            token = result.token;
            myName = result.name;
            localStorage.setItem('bt_token', token);
            localStorage.setItem('bt_name', myName);
            state = result.state;
            render();
        } catch (error) {
            alert(error.message);
        }
    });

    $('guess-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const text = $('guess-input').value.trim();
        if (!text) return;
        $('guess-input').value = '';
        try {
            const result = await post('/api/guess', { token, text });
            if (result.title && result.artist) feedback(`🔥 Titre + artiste ! +${result.gained} pts`, true);
            else if (result.title) feedback(`🎵 Titre ! +${result.gained} pts`, true);
            else if (result.artist) feedback(`🎤 Artiste ! +${result.gained} pts`, true);
            else if (result.reason === 'throttle') feedback('Doucement… ⏳', false);
            else if (result.accepted) feedback('❌ Non, essaie encore', false);
            if (result.title) myFound.title = true;
            if (result.artist) myFound.artist = true;
            render();
        } catch (error) {
            if (error.message.includes('inconnu')) {
                token = '';
                localStorage.removeItem('bt_token');
                render();
            } else {
                feedback(error.message, false);
            }
        }
    });

    $('become-host').addEventListener('click', () => {
        isHost = !isHost;
        localStorage.setItem('bt_host', isHost ? '1' : '0');
        $('become-host').textContent = isHost ? 'Hôte activé ✔ (re-clique pour désactiver)' : 'Je suis l\'hôte 🎛️';
        render();
    });

    $('host-toggle').addEventListener('click', () => {
        $('host-panel').hidden = !$('host-panel').hidden;
    });

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

    $('playlist-form').addEventListener('submit', (event) => {
        event.preventDefault();
        hostAction('/api/host/playlist', { url: $('playlist-url').value });
    });
    $('host-start').addEventListener('click', () => {
        hostAction('/api/host/start', {
            rounds: Number($('opt-rounds').value),
            mode: $('opt-mode').value,
            guessSeconds: Number($('opt-duration').value)
        });
        $('host-panel').hidden = true;
    });
    $('host-skip').addEventListener('click', () => hostAction('/api/host/skip'));
    $('host-retry').addEventListener('click', () => hostAction('/api/host/retry'));
    $('host-stop').addEventListener('click', () => hostAction('/api/host/stop'));
    $('host-lobby').addEventListener('click', () => hostAction('/api/host/lobby'));

    $('host-devices-refresh').addEventListener('click', async () => {
        try {
            const result = await post('/api/host/devices', {});
            const list = $('host-devices');
            list.innerHTML = '';
            for (const device of result.devices) {
                const item = document.createElement('li');
                const button = document.createElement('button');
                button.textContent = `${device.is_active ? '🔊 ' : ''}${device.name} (${device.type})`;
                button.addEventListener('click', () => hostAction('/api/host/device', { id: device.id }));
                item.appendChild(button);
                list.appendChild(item);
            }
            if (!result.devices.length) hostFeedback('Aucun appareil : ouvre Spotify sur ton tel ou caste sur la TV');
        } catch (error) {
            hostFeedback('⚠ ' + error.message);
        }
    });

    if (myName) $('join-name').value = myName;
    if (isHost) $('become-host').textContent = 'Hôte activé ✔ (re-clique pour désactiver)';
    show('join');
    connect();
})();
