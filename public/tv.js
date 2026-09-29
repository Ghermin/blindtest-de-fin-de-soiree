(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const screens = ['missing', 'lobby', 'countdown', 'guess', 'reveal', 'podium'];
    const medals = ['🥇', '🥈', '🥉'];
    const roomMatch = location.pathname.match(/^\/r\/([A-Za-z0-9]{3,12})\/tv$/);
    const castMode = location.pathname === '/cast';
    let room = roomMatch ? roomMatch[1].toUpperCase() : '';

    let state = null;
    let offset = 0;
    let frame = null;
    let source = null;
    let lastMessage = 0;
    let lastPhase = '';
    let audio = null;
    let playerSrc = '';
    const seen = new Map();
    const player = new Audio();
    player.preload = 'auto';

    function now() {
        return Date.now() + offset;
    }

    function show(name) {
        for (const screen of screens) $('tv-' + screen).hidden = screen !== name;
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

    function playlistLabel(playlist) {
        if (!playlist) return '';
        if (!playlist.ready) return `📀 ${playlist.name} · recherche des extraits ${playlist.resolved}/${playlist.total}…`;
        return `📀 ${playlist.name} · ${playlist.resolved} titres${playlist.missing ? `, ${playlist.missing} sans extrait` : ''}`;
    }

    function enableSound() {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (Context) {
            audio = audio || new Context();
            audio.resume().catch(() => null);
        }
        syncAudio(true);
    }

    function syncAudio(fromGesture) {
        const clip = state && state.audio;
        const active = clip && clip.url && ['countdown', 'guess', 'reveal'].includes(state.phase);
        if (!active) {
            if (!player.paused) player.pause();
            return;
        }
        if (playerSrc !== clip.url) {
            playerSrc = clip.url;
            player.src = clip.url;
            player.load();
        }
        if (!clip.startedAt) {
            if (!player.paused) player.pause();
            return;
        }
        if ((now() - clip.startedAt) / 1000 > 45) {
            if (!player.paused) player.pause();
            return;
        }
        const seek = () => {
            const target = Math.max(0, (now() - clip.startedAt) / 1000);
            if (Math.abs(player.currentTime - target) > 1.5) player.currentTime = target;
        };
        if (player.readyState >= 1) seek();
        else player.addEventListener('loadedmetadata', seek, { once: true });
        if (player.paused || fromGesture) {
            player.play().then(() => {
                $('tv-sound').hidden = true;
            }).catch(() => {
                $('tv-sound').hidden = false;
            });
        }
    }

    function tone(frequency, duration, type, when) {
        if (!audio || audio.state !== 'running') return;
        const start = audio.currentTime + when;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.05);
    }

    function ding() {
        tone(880, 0.18, 'sine', 0);
        tone(1320, 0.25, 'sine', 0.12);
    }

    function fanfare() {
        [523, 659, 784, 1047].forEach((frequency, index) => tone(frequency, 0.35, 'triangle', index * 0.16));
    }

    function renderTeams() {
        const list = $('tv-teams');
        const teams = state.teams || [];
        list.hidden = !teams.length;
        list.innerHTML = '';
        for (const team of teams) {
            const item = document.createElement('li');
            item.textContent = `${team.name} — ${team.score}`;
            list.appendChild(item);
        }
    }

    function renderRanking() {
        const list = $('tv-ranking');
        const previous = new Map([...list.children].map((item) => [item.dataset.name, item.getBoundingClientRect().top]));
        list.innerHTML = '';
        let scored = false;
        state.players.forEach((entry, index) => {
            const item = document.createElement('li');
            item.dataset.name = entry.name;
            if (seen.has(entry.name) && seen.get(entry.name) < entry.score) {
                item.classList.add('bump');
                scored = true;
            }
            seen.set(entry.name, entry.score);
            item.classList.toggle('offline', entry.online === false);
            const rank = document.createElement('span');
            rank.className = 'rank';
            rank.textContent = medals[index] || String(index + 1);
            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = entry.team ? `${entry.name} · ${entry.team}` : entry.name;
            const marks = document.createElement('span');
            marks.className = 'marks';
            marks.textContent = [entry.found.title ? '🎵' : '', entry.found.artist ? '🎤' : '', entry.online === false ? '💤' : ''].join('');
            const score = document.createElement('span');
            score.className = 'score';
            score.textContent = String(entry.score);
            item.append(rank, name, marks, score);
            if (entry.gained) {
                const gained = document.createElement('span');
                gained.className = 'gained';
                gained.textContent = `+${entry.gained}`;
                item.appendChild(gained);
            }
            if (entry.lastGuess) {
                const guess = document.createElement('span');
                guess.className = 'last-guess';
                guess.textContent = `« ${entry.lastGuess} »`;
                item.appendChild(guess);
            }
            list.appendChild(item);
        });
        $('tv-empty').hidden = state.players.length > 0;
        fitRanking(list);
        slideRows(list, previous);
        if (scored && state.phase === 'guess') ding();
    }

    function fitRanking(list) {
        let size = 1.25;
        list.style.fontSize = `${size}rem`;
        while (list.scrollHeight > list.clientHeight && size > 0.6) {
            size -= 0.05;
            list.style.fontSize = `${size}rem`;
        }
    }

    function slideRows(list, previous) {
        for (const item of list.children) {
            const before = previous.get(item.dataset.name);
            if (before === undefined) continue;
            const delta = before - item.getBoundingClientRect().top;
            if (!delta) continue;
            item.style.transition = 'none';
            item.style.transform = `translateY(${delta}px)`;
        }
        void list.offsetHeight;
        requestAnimationFrame(() => {
            for (const item of list.children) {
                item.style.transition = '';
                item.style.transform = '';
            }
        });
    }

    function renderPodium() {
        const list = $('tv-podium-list');
        list.innerHTML = '';
        state.players.slice(0, 3).forEach((entry, index) => {
            const item = document.createElement('li');
            const name = document.createElement('span');
            name.textContent = `${medals[index]} ${entry.name}`;
            const score = document.createElement('b');
            score.textContent = `${entry.score} pts`;
            item.append(name, score);
            list.appendChild(item);
        });
        const stats = state.stats || {};
        const lines = [];
        if (stats.fastest) lines.push(`⚡ Plus rapide : ${stats.fastest.name} en ${String(stats.fastest.seconds).replace('.', ',')} s sur « ${stats.fastest.track} »`);
        if (stats.firsts) lines.push(`🥇 Le plus souvent premier : ${stats.firsts.name} (${stats.firsts.count}×)`);
        if (stats.wildest) lines.push(`😅 Réponse la plus hors sujet : « ${stats.wildest.guess} » de ${stats.wildest.name} pour « ${stats.wildest.track} »`);
        const statsList = $('tv-stats');
        statsList.innerHTML = '';
        for (const line of lines) {
            const item = document.createElement('li');
            item.textContent = line;
            statsList.appendChild(item);
        }
        statsList.hidden = !lines.length;
    }

    function loop() {
        if (state.phase === 'countdown') {
            const left = Math.max(0, Math.ceil((state.phaseEndsAt - now()) / 1000));
            $('tv-count').textContent = left || '🎶';
        }
        if (state.phase === 'guess') {
            const remaining = Math.max(0, state.phaseEndsAt - now());
            const urgent = remaining < 8000;
            $('tv-bar').style.width = (remaining / state.guessMs * 100) + '%';
            $('tv-bar').classList.toggle('urgent', urgent);
            $('tv-seconds').classList.toggle('urgent', urgent);
            $('tv-seconds').textContent = String(Math.ceil(remaining / 1000));
        }
        if (state.phase === 'countdown' || state.phase === 'guess') frame = requestAnimationFrame(loop);
    }

    function render() {
        const url = state.joinUrl || '';
        $('tv-url').textContent = url.replace(/^https?:\/\//, '');
        $('tv-code').textContent = `Code : ${state.room || room}`;
        $('tv-lobby-url').textContent = url;
        $('tv-playlist').textContent = playlistLabel(state.playlist);
        $('tv-notice').textContent = state.notice || '';
        const round = state.round ? `Manche ${state.round}/${state.rounds}` : '';
        $('tv-round').textContent = round;
        $('tv-round-countdown').textContent = round;
        renderTeams();
        renderRanking();
        cancelAnimationFrame(frame);

        if (state.phase === 'lobby') {
            show('lobby');
        } else if (state.phase === 'countdown') {
            show('countdown');
            loop();
        } else if (state.phase === 'guess') {
            show('guess');
            const hint = formatHint(state.hint);
            if (hint !== $('tv-hint').textContent) {
                $('tv-hint').textContent = hint;
                $('tv-hint').classList.remove('fresh');
                void $('tv-hint').offsetWidth;
                if (hint) $('tv-hint').classList.add('fresh');
            }
            $('tv-mode').textContent = { both: 'Titre + artiste', title: 'Titre seul', artist: 'Artiste seul' }[state.mode] || '';
            loop();
        } else if (state.phase === 'reveal') {
            show('reveal');
            const track = state.track || {};
            $('tv-cover').src = track.image || '/favicon.svg';
            $('tv-title').textContent = track.name || '';
            $('tv-artists').textContent = (track.artists || []).join(', ');
        } else if (state.phase === 'podium') {
            show('podium');
            renderPodium();
            if (lastPhase !== 'podium') fanfare();
        }
        lastPhase = state.phase;
        syncAudio(false);
    }

    function connect() {
        if (source) source.close();
        lastMessage = Date.now();
        source = new EventSource(`/events?room=${encodeURIComponent(room)}`);
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

    async function startRoom() {
        const response = await fetch(`/api/r/${encodeURIComponent(room)}`).catch(() => null);
        if (!response || !response.ok) {
            show('missing');
            $('tv-missing-message').textContent = `La salle ${room} n'existe pas ou plus.`;
            return;
        }
        seen.clear();
        $('tv-qr').src = `/r/${room}/qr.svg`;
        $('tv-qr-big').src = `/r/${room}/qr.svg`;
        connect();
        enableSound();
    }

    function startCast() {
        show('missing');
        $('tv-missing-message').textContent = 'En attente du téléphone…';
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js';
        script.onload = () => {
            const framework = window.cast && window.cast.framework;
            if (!framework) {
                $('tv-missing-message').textContent = 'Réception Cast indisponible sur cet écran';
                return;
            }
            try {
                const context = framework.CastReceiverContext.getInstance();
                const options = new framework.CastReceiverOptions();
                options.disableIdleTimeout = true;
                options.customNamespaces = { 'urn:x-cast:fr.blindtest': framework.system.MessageType.JSON };
                context.addCustomMessageListener('urn:x-cast:fr.blindtest', (event) => {
                    const data = event.data || {};
                    if (data.room && String(data.room).toUpperCase() !== room) {
                        room = String(data.room).toUpperCase();
                        startRoom();
                    }
                });
                context.start(options);
            } catch (_error) {
                $('tv-missing-message').textContent = 'Réception Cast indisponible sur cet écran';
            }
        };
        script.onerror = () => {
            $('tv-missing-message').textContent = 'Impossible de charger le module Cast';
        };
        document.head.appendChild(script);
    }

    function init() {
        if (castMode) return startCast();
        if (!room) {
            show('missing');
            $('tv-missing-message').textContent = 'Ouvre cette page depuis une salle : /r/CODE/tv';
            return;
        }
        return startRoom();
    }

    $('tv-sound').addEventListener('click', enableSound);
    document.addEventListener('pointerdown', () => {
        if (!$('tv-sound').hidden) enableSound();
    }, { passive: true });
    setInterval(() => {
        if (source && Date.now() - lastMessage > 40000) connect();
        if (state) syncAudio(false);
    }, 5000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && source && Date.now() - lastMessage > 30000) connect();
    });

    init();
})();
