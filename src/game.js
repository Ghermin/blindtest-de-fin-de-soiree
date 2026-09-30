const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const config = require('./config.js');
const matching = require('./matching.js');
const { hints } = require('./hints.js');
const sources = require('./sources.js');
const previews = require('./previews.js');

const DEFAULTS = { rounds: 10, guessMs: 30000, countdownMs: 3000, revealMs: 8000, mode: 'both', hints: true, answers: 'text', play: 'solo' };
const OPTION_VALUES = { rounds: [5, 10, 15, 20], guessSeconds: [15, 20, 30], mode: ['both', 'title', 'artist'], answers: ['text', 'choices'], play: ['solo', 'teams'] };
const POINTS = { find: 500, both: 200, first: 100, minSpeed: 0.3 };
const MAX_PLAYERS = 60;
const PREVIEW_MS = 30000;
const DEFAULT_SOURCES = config.sourcesModule ? require(config.sourcesModule) : { loadPlaylist: sources.loadPlaylist, resolveAll: previews.resolveAll, freshUrl: previews.freshUrl };

function shuffle(list) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function freshPlayer(base) {
    return {
        token: base.token || randomUUID(),
        id: base.id || randomUUID().slice(0, 8),
        name: base.name,
        team: base.team || '',
        score: base.score || 0,
        gained: 0,
        found: { title: false, artist: false },
        precision: { title: 0, artist: 0 },
        speedAt: { title: 0, artist: 0 },
        bothBonus: false,
        answered: false,
        lastGuess: '',
        lastGuessAt: 0,
        connections: 0,
        firsts: base.firsts || 0,
        fastestMs: base.fastestMs || 0,
        fastestTrack: base.fastestTrack || ''
    };
}

class Game extends EventEmitter {
    constructor(options = {}) {
        super();
        this.sources = options.sources || DEFAULT_SOURCES;
        this.code = options.code || '';
        this.timings = options.timings || {};
        this.players = new Map();
        this.teamList = new Set();
        this.playlist = null;
        this.allTracks = [];
        this.played = new Set();
        this.queue = [];
        this.settings = { ...DEFAULTS, ...this.timings };
        this.options = { rounds: 10, guessSeconds: 30, mode: 'both', hints: true, answers: 'text', play: 'solo' };
        this.choices = null;
        this.correctChoice = null;
        this.phase = 'lobby';
        this.roundIndex = 0;
        this.track = null;
        this.audio = null;
        this.phaseEndsAt = 0;
        this.guessStartedAt = 0;
        this.firstTitle = null;
        this.firstArtist = null;
        this.notice = null;
        this.timer = null;
        this.generation = 0;
        this.resolveGeneration = 0;
        this.hint = null;
        this.hintTimers = [];
        this.paused = false;
        this.pausedAt = 0;
        this.pauseRemaining = 0;
        this.wildest = null;
        this.stats = null;
    }

    log(message) {
        console.log(this.code ? `[${this.code}] ${message}` : message);
    }

    changed() {
        this.emit('update');
    }

    schedule(delay, fn) {
        clearTimeout(this.timer);
        const generation = this.generation;
        this.timer = setTimeout(() => {
            if (generation === this.generation) fn();
        }, delay);
    }

    join(name, token, team) {
        const cleaned = String(name || '').trim().slice(0, 20);
        const cleanedTeam = this.canonicalTeam(team);
        if (cleanedTeam) this.teamList.add(cleanedTeam);
        if (token && this.players.has(token)) {
            const player = this.players.get(token);
            if (cleaned && cleaned !== player.name) player.name = this.uniqueName(cleaned, token);
            if (team !== undefined) player.team = cleanedTeam;
            this.changed();
            return player;
        }
        if (!cleaned) throw new Error('Il faut un pseudo');
        if (this.players.size >= MAX_PLAYERS) throw new Error('La salle est pleine');
        const player = freshPlayer({ name: this.uniqueName(cleaned), team: cleanedTeam });
        this.players.set(player.token, player);
        this.log(`Joueur : ${player.name}${player.team ? ` (équipe ${player.team})` : ''}`);
        this.changed();
        return player;
    }

    uniqueName(name, except) {
        const taken = new Set([...this.players.values()]
            .filter((player) => player.token !== except)
            .map((player) => player.name.toLowerCase()));
        let candidate = name;
        for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${name} ${n}`;
        return candidate;
    }

    connect(token) {
        const player = this.players.get(token);
        if (!player) return;
        player.connections++;
        if (player.connections === 1) this.changed();
    }

    disconnect(token) {
        const player = this.players.get(token);
        if (!player) return;
        player.connections = Math.max(0, player.connections - 1);
        if (player.connections) return;
        this.changed();
        if (this.phase === 'guess' && !this.paused && this.everyoneDone()) this.schedule(1500, () => this.endGuess());
    }

    leave(token) {
        if (this.players.delete(token)) this.changed();
    }

    canonicalTeam(name) {
        const cleaned = String(name || '').trim().slice(0, 14);
        if (!cleaned) return '';
        const lower = cleaned.toLowerCase();
        for (const existing of this.teamList) {
            if (existing.toLowerCase() === lower) return existing;
        }
        return cleaned;
    }

    findPlayer(id) {
        const player = [...this.players.values()].find((entry) => entry.id === id);
        if (!player) throw new Error('Joueur introuvable');
        return player;
    }

    kick(id) {
        const player = this.findPlayer(id);
        this.players.delete(player.token);
        this.log(`Joueur retiré par l'hôte : ${player.name}`);
        this.changed();
        if (this.phase === 'guess' && !this.paused && this.everyoneDone()) this.schedule(1500, () => this.endGuess());
        return player;
    }

    resetPlayers() {
        for (const player of this.players.values()) {
            Object.assign(player, { score: 0, gained: 0, found: { title: false, artist: false }, precision: { title: 0, artist: 0 }, speedAt: { title: 0, artist: 0 }, bothBonus: false, answered: false, lastGuess: '', firsts: 0, fastestMs: 0, fastestTrack: '' });
        }
        this.wildest = null;
        this.stats = null;
    }

    resetScores() {
        this.resetPlayers();
        this.backToLobby();
        this.log('Scores remis à zéro');
    }

    clearPlayers() {
        const tokens = [...this.players.keys()];
        this.players.clear();
        this.resetPlayers();
        this.backToLobby();
        this.log('Salle vidée par l\'hôte');
        return tokens;
    }

    addTeam(name) {
        const team = this.canonicalTeam(name);
        if (!team) throw new Error('Il faut un nom d\'équipe');
        this.teamList.add(team);
        this.changed();
        return team;
    }

    renameTeam(from, to) {
        const source = this.canonicalTeam(from);
        if (!source || !this.teamList.has(source)) throw new Error('Équipe introuvable');
        const target = String(to || '').trim().slice(0, 14);
        if (!target) return this.removeTeam(source);
        this.teamList.delete(source);
        this.teamList.add(target);
        for (const player of this.players.values()) {
            if (player.team === source) player.team = target;
        }
        this.changed();
        return target;
    }

    removeTeam(name) {
        const team = this.canonicalTeam(name);
        this.teamList.delete(team);
        for (const player of this.players.values()) {
            if (player.team === team) player.team = '';
        }
        this.changed();
        return '';
    }

    assignTeam(id, name) {
        const player = this.findPlayer(id);
        const team = this.canonicalTeam(name);
        if (team) this.teamList.add(team);
        player.team = team;
        this.changed();
        return player;
    }

    async setPlaylist(input) {
        if (this.phase !== 'lobby' && this.phase !== 'podium') throw new Error('Partie en cours');
        const data = await this.sources.loadPlaylist(input);
        if (data.tracks.length < 3) throw new Error('Playlist trop courte');
        this.resolveGeneration++;
        const generation = this.resolveGeneration;
        this.allTracks = data.tracks.map((track) => ({ ...track }));
        this.playlist = { id: data.id, source: data.source, name: data.name, image: data.image, total: this.allTracks.length, partial: Boolean(data.partial), resolved: 0, missing: 0, ready: false };
        this.played.clear();
        this.phase = 'lobby';
        this.notice = null;
        this.log(`Playlist ${data.source} : ${data.name} (${this.allTracks.length} titres)`);
        this.changed();
        this.resolvePreviews(generation);
        return this.playlist;
    }

    async resolvePreviews(generation) {
        let lastEmit = 0;
        await this.sources.resolveAll(this.allTracks, {
            cancelled: () => generation !== this.resolveGeneration,
            onProgress: (track, match) => {
                if (match) this.playlist.resolved++;
                else this.playlist.missing++;
                if (Date.now() - lastEmit > 800) {
                    lastEmit = Date.now();
                    this.changed();
                }
            }
        });
        if (generation !== this.resolveGeneration) return;
        this.playlist.ready = true;
        this.log(`Extraits : ${this.playlist.resolved} trouvés, ${this.playlist.missing} manquants`);
        this.changed();
    }

    playable() {
        return this.allTracks.filter((track) => track.match);
    }

    setOptions(patch = {}) {
        const next = { ...this.options };
        if (patch.rounds !== undefined && OPTION_VALUES.rounds.includes(Number(patch.rounds))) next.rounds = Number(patch.rounds);
        if (patch.guessSeconds !== undefined && OPTION_VALUES.guessSeconds.includes(Number(patch.guessSeconds))) next.guessSeconds = Number(patch.guessSeconds);
        for (const key of ['mode', 'answers', 'play']) {
            if (patch[key] !== undefined && OPTION_VALUES[key].includes(patch[key])) next[key] = patch[key];
        }
        if (patch.hints !== undefined) next.hints = Boolean(patch.hints);
        this.options = next;
        this.changed();
        return this.options;
    }

    start(options = {}) {
        if (!this.playlist) throw new Error('Choisis une playlist d\'abord');
        if (!this.players.size) throw new Error('Aucun joueur');
        const playable = this.playable();
        if (playable.length < 3) {
            if (!this.playlist.ready) throw new Error(`Recherche des extraits en cours (${this.playlist.resolved}/${this.playlist.total}), patiente quelques secondes`);
            throw new Error('Pas assez d\'extraits trouvés pour cette playlist, essaie-en une autre');
        }
        const wanted = { ...this.options, ...options };
        const rounds = Math.max(1, Math.min(Number(wanted.rounds) || DEFAULTS.rounds, playable.length, 50));
        const guessSeconds = Math.max(10, Math.min(Number(wanted.guessSeconds) || 30, 30));
        const mode = ['title', 'artist', 'both'].includes(wanted.mode) ? wanted.mode : 'both';
        const answers = wanted.answers === 'choices' ? 'choices' : 'text';
        this.settings = {
            ...DEFAULTS,
            ...this.timings,
            rounds,
            guessMs: this.timings.guessMs || guessSeconds * 1000,
            mode,
            answers,
            play: wanted.play === 'teams' ? 'teams' : 'solo',
            hints: wanted.hints !== false && answers !== 'choices'
        };
        const fresh = playable.filter((track) => !this.played.has(track.uri));
        if (fresh.length < rounds) this.played.clear();
        this.queue = shuffle(fresh.length >= rounds ? fresh : playable).slice(0, rounds);
        for (const track of this.queue) this.played.add(track.uri);
        this.resetPlayers();
        this.roundIndex = 0;
        this.paused = false;
        this.generation++;
        this.notice = null;
        this.log(`Partie lancée : ${rounds} manches, mode ${mode}, ${this.players.size} joueur(s)`);
        this.nextRound();
    }

    async nextRound() {
        const generation = this.generation;
        this.clearHints();
        this.audio = null;
        this.roundIndex++;
        let track = this.queue[this.roundIndex - 1];
        let url = null;
        while (track && !url) {
            url = await this.sources.freshUrl(track.match).catch(() => null);
            if (generation !== this.generation) return;
            if (!url) {
                this.log(`Extrait indisponible, titre écarté : ${track.name}`);
                this.queue.splice(this.roundIndex - 1, 1);
                track = this.queue[this.roundIndex - 1];
            }
        }
        if (!track) {
            if (this.roundIndex === 1) {
                this.roundIndex = 0;
                this.phase = 'lobby';
                this.notice = 'Aucun extrait lisible pour cette playlist, essaie-en une autre';
                this.changed();
            } else {
                this.roundIndex--;
                this.podium();
            }
            return;
        }
        this.track = track;
        this.audio = { url, startedAt: 0, durationMs: PREVIEW_MS };
        this.firstTitle = null;
        this.firstArtist = null;
        for (const player of this.players.values()) {
            player.gained = 0;
            player.found = { title: false, artist: false };
            player.precision = { title: 0, artist: 0 };
            player.speedAt = { title: 0, artist: 0 };
            player.bothBonus = false;
            player.lastGuess = '';
            player.answered = false;
        }
        this.choices = this.settings.answers === 'choices' ? this.buildChoices(track) : null;
        this.log(`Manche ${this.roundIndex}/${this.queue.length} : ${track.name} — ${track.artists.join(', ')}`);
        this.phase = 'countdown';
        this.phaseEndsAt = Date.now() + this.settings.countdownMs;
        this.notice = null;
        this.changed();
        this.schedule(this.settings.countdownMs, () => this.beginGuess());
    }

    beginGuess() {
        this.guessStartedAt = Date.now();
        this.audio = { ...this.audio, startedAt: this.guessStartedAt };
        this.phase = 'guess';
        this.phaseEndsAt = this.guessStartedAt + this.settings.guessMs;
        this.changed();
        this.schedule(this.settings.guessMs, () => this.endGuess());
        this.scheduleHints();
    }

    hintDelays() {
        const half = Math.floor(this.settings.guessMs / 2);
        return [[half, 1], [Math.max(half, this.settings.guessMs - 10000), 2]];
    }

    scheduleHints(elapsed = 0) {
        for (const timer of this.hintTimers) clearTimeout(timer);
        this.hintTimers = [];
        if (!elapsed) this.hint = null;
        if (!this.settings.hints) return;
        const track = this.track;
        const generation = this.generation;
        for (const [delay, stage] of this.hintDelays()) {
            if (delay <= elapsed) continue;
            this.hintTimers.push(setTimeout(() => {
                if (generation !== this.generation || this.track !== track || this.phase !== 'guess' || this.paused) return;
                this.hint = hints(track, this.settings.mode, stage);
                this.changed();
            }, delay - elapsed));
        }
    }

    clearHints() {
        for (const timer of this.hintTimers) clearTimeout(timer);
        this.hintTimers = [];
        this.hint = null;
    }

    endGuess() {
        this.clearHints();
        this.recordWildest();
        this.phase = 'reveal';
        this.phaseEndsAt = Date.now() + this.settings.revealMs;
        this.changed();
        this.schedule(this.settings.revealMs, () => this.finishOrNext());
    }

    recordWildest() {
        if (!this.track) return;
        for (const player of this.players.values()) {
            if (!player.lastGuess || player.found.title || player.found.artist) continue;
            const ratio = Math.min(
                matching.distance(player.lastGuess, this.track.name),
                ...this.track.artists.map((artist) => matching.distance(player.lastGuess, artist))
            );
            if (!this.wildest || ratio > this.wildest.ratio) {
                this.wildest = { ratio, name: player.name, guess: player.lastGuess, track: this.track.name };
            }
        }
    }

    finishOrNext() {
        if (this.roundIndex >= this.queue.length) {
            this.podium();
        } else {
            this.nextRound();
        }
    }

    podium() {
        this.audio = null;
        this.phase = 'podium';
        this.phaseEndsAt = 0;
        this.stats = this.computeStats();
        const winner = [...this.players.values()].sort((a, b) => b.score - a.score)[0];
        if (winner) this.log(`Podium : ${winner.name} gagne avec ${winner.score} pts`);
        this.changed();
    }

    computeStats() {
        const players = [...this.players.values()];
        const fastest = players.filter((player) => player.fastestMs).sort((a, b) => a.fastestMs - b.fastestMs)[0];
        const firsts = players.filter((player) => player.firsts).sort((a, b) => b.firsts - a.firsts)[0];
        return {
            fastest: fastest ? { name: fastest.name, seconds: Math.round(fastest.fastestMs / 100) / 10, track: fastest.fastestTrack } : null,
            firsts: firsts ? { name: firsts.name, count: firsts.firsts } : null,
            wildest: this.wildest ? { name: this.wildest.name, guess: this.wildest.guess, track: this.wildest.track } : null
        };
    }

    pause() {
        if (this.paused) return;
        if (!['countdown', 'guess', 'reveal'].includes(this.phase)) throw new Error('Rien à mettre en pause');
        clearTimeout(this.timer);
        for (const timer of this.hintTimers) clearTimeout(timer);
        this.hintTimers = [];
        this.paused = true;
        this.pausedAt = Date.now();
        this.pauseRemaining = Math.max(0, this.phaseEndsAt - this.pausedAt);
        this.log('Pause');
        this.changed();
    }

    resume() {
        if (!this.paused) return;
        const now = Date.now();
        const pausedMs = now - this.pausedAt;
        this.paused = false;
        this.phaseEndsAt = now + this.pauseRemaining;
        if (this.guessStartedAt) this.guessStartedAt += pausedMs;
        if (this.audio && this.audio.startedAt) this.audio = { ...this.audio, startedAt: this.audio.startedAt + pausedMs };
        if (this.phase === 'countdown') {
            this.schedule(this.pauseRemaining, () => this.beginGuess());
        } else if (this.phase === 'guess') {
            this.schedule(this.pauseRemaining, () => this.endGuess());
            this.scheduleHints(now - this.guessStartedAt);
        } else if (this.phase === 'reveal') {
            this.schedule(this.pauseRemaining, () => this.finishOrNext());
        }
        this.log('Reprise');
        this.changed();
        if (this.phase === 'guess' && this.everyoneDone()) this.schedule(1500, () => this.endGuess());
    }

    skip() {
        this.paused = false;
        if (this.phase === 'guess' || this.phase === 'countdown') {
            this.endGuess();
        } else if (this.phase === 'reveal') {
            clearTimeout(this.timer);
            this.finishOrNext();
        } else {
            throw new Error('Rien à passer');
        }
    }

    stop() {
        this.generation++;
        this.paused = false;
        clearTimeout(this.timer);
        this.clearHints();
        this.audio = null;
        this.log('Partie arrêtée par l\'hôte');
        if (this.roundIndex > 0) {
            this.podium();
        } else {
            this.phase = 'lobby';
            this.phaseEndsAt = 0;
            this.changed();
        }
    }

    backToLobby() {
        this.generation++;
        this.paused = false;
        clearTimeout(this.timer);
        this.clearHints();
        this.audio = null;
        this.phase = 'lobby';
        this.roundIndex = 0;
        this.track = null;
        this.notice = null;
        for (const player of this.players.values()) {
            player.gained = 0;
            player.found = { title: false, artist: false };
            player.lastGuess = '';
            player.answered = false;
        }
        this.changed();
    }

    choiceLabel(track) {
        const artist = (track.artists || [])[0] || '';
        if (this.settings.mode === 'title') return track.name;
        if (this.settings.mode === 'artist') return artist;
        return `${track.name} — ${artist}`;
    }

    buildChoices(track) {
        const correct = this.choiceLabel(track);
        const seen = new Set([matching.normalize(correct)]);
        const others = [];
        for (const candidate of shuffle(this.allTracks.filter((entry) => entry.uri !== track.uri))) {
            const label = this.choiceLabel(candidate);
            const key = matching.normalize(label);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            others.push(label);
            if (others.length === 3) break;
        }
        const choices = shuffle([correct, ...others]).map((label, index) => ({ id: `c${index + 1}`, label }));
        this.correctChoice = choices.find((choice) => choice.label === correct).id;
        return choices;
    }

    answerChoice(player, id, now) {
        if (player.answered) return { accepted: false, reason: 'answered' };
        const choice = (this.choices || []).find((entry) => entry.id === id);
        if (!choice) return { accepted: false, reason: 'invalid' };
        player.answered = true;
        player.lastGuess = choice.label;
        const mode = this.settings.mode;
        const result = { accepted: true, choice: choice.id, correct: choice.id === this.correctChoice, title: false, artist: false, gained: 0 };
        if (result.correct) {
            const elapsed = now - this.guessStartedAt;
            const speed = 1 - (1 - POINTS.minSpeed) * Math.min(1, elapsed / this.settings.guessMs);
            let points = Math.round(POINTS.find * speed);
            if (!this.firstTitle) {
                this.firstTitle = player.token;
                player.firsts++;
                points += POINTS.first;
            }
            if (mode !== 'artist') {
                player.found.title = true;
                result.title = true;
            }
            if (mode !== 'title') {
                player.found.artist = true;
                result.artist = true;
            }
            if (mode === 'both') points += POINTS.both;
            result.gained = points;
            const ms = Math.max(1, elapsed);
            if (!player.fastestMs || ms < player.fastestMs) {
                player.fastestMs = ms;
                player.fastestTrack = this.track.name;
            }
            player.score += points;
            player.gained += points;
        }
        this.changed();
        if (!this.paused && this.everyoneDone()) this.schedule(1500, () => this.endGuess());
        return result;
    }

    guess(token, text) {
        const player = this.players.get(token);
        if (!player) throw new Error('Joueur inconnu, rejoins la partie');
        if (this.phase !== 'guess') return { accepted: false, reason: 'wait' };
        if (this.paused) return { accepted: false, reason: 'paused' };
        const now = Date.now();
        if (now - player.lastGuessAt < 500) return { accepted: false, reason: 'throttle' };
        player.lastGuessAt = now;
        if (this.settings.answers === 'choices') return this.answerChoice(player, String(text || ''), now);
        const cleaned = String(text || '').trim().slice(0, 80);
        if (!cleaned) return { accepted: false, reason: 'empty' };
        player.lastGuess = cleaned;

        const mode = this.settings.mode;
        const elapsed = now - this.guessStartedAt;
        const speed = 1 - (1 - POINTS.minSpeed) * Math.min(1, elapsed / this.settings.guessMs);
        const result = { accepted: true, title: false, artist: false, approx: false, gained: 0 };

        const parts = mode === 'both' ? matching.splitGuess(cleaned, this.track.name, this.track.artists) : null;
        if (mode !== 'artist') this.award(player, 'title', matching.titleQuality(parts ? parts.title : cleaned, this.track.name), speed, result);
        if (mode !== 'title') this.award(player, 'artist', matching.artistQuality(parts ? parts.artist : cleaned, this.track.artists), speed, result);
        if (mode === 'both' && !player.bothBonus && player.found.title && player.found.artist) {
            player.bothBonus = true;
            result.gained += POINTS.both;
        }
        result.precision = { ...player.precision };
        if (result.gained) {
            const ms = Math.max(1, elapsed);
            if (!player.fastestMs || ms < player.fastestMs) {
                player.fastestMs = ms;
                player.fastestTrack = this.track.name;
            }
            player.score += result.gained;
            player.gained += result.gained;
            this.changed();
            if (!this.paused && this.everyoneDone()) this.schedule(1500, () => this.endGuess());
        }
        return result;
    }

    award(player, part, quality, speed, result) {
        const previous = player.precision[part];
        if (!quality || quality <= previous) return;
        let points;
        if (previous) {
            points = Math.round(POINTS.find * player.speedAt[part] * (quality - previous));
        } else {
            points = Math.round(POINTS.find * speed * quality);
            player.speedAt[part] = speed;
            const first = part === 'title' ? 'firstTitle' : 'firstArtist';
            if (!this[first]) {
                this[first] = player.token;
                player.firsts++;
                points += POINTS.first;
            }
        }
        player.precision[part] = quality;
        player.found[part] = true;
        result[part] = true;
        if (quality < 1) result.approx = true;
        result.gained += points;
    }

    everyoneDone() {
        const mode = this.settings.mode;
        const online = [...this.players.values()].filter((player) => player.connections > 0);
        if (!online.length) return false;
        return online.every((player) => player.answered || ((mode === 'artist' || player.found.title) && (mode === 'title' || player.found.artist)));
    }

    publicState() {
        const showTrack = this.phase === 'reveal' || this.phase === 'podium';
        const players = [...this.players.values()].sort((a, b) => b.score - a.score);
        const teams = new Map([...this.teamList].map((name) => [name, { name, score: 0, members: 0 }]));
        for (const player of players) {
            if (!player.team) continue;
            const team = teams.get(player.team) || { name: player.team, score: 0, members: 0 };
            team.score += player.score;
            team.members++;
            teams.set(player.team, team);
        }
        return {
            room: this.code,
            phase: this.phase,
            serverNow: Date.now(),
            phaseEndsAt: this.phaseEndsAt,
            paused: this.paused,
            pauseRemaining: this.paused ? this.pauseRemaining : 0,
            round: this.roundIndex,
            rounds: this.queue.length || this.settings.rounds,
            mode: this.settings.mode,
            guessMs: this.settings.guessMs,
            notice: this.notice,
            hint: this.phase === 'guess' ? this.hint : null,
            options: this.options,
            answers: this.settings.answers,
            play: this.settings.play,
            choices: this.phase === 'guess' && this.settings.answers === 'choices' ? this.choices : null,
            correctChoice: showTrack ? this.correctChoice : null,
            audio: this.audio,
            playlist: this.playlist,
            players: players.map((player) => ({
                id: player.id,
                name: player.name,
                team: player.team,
                score: player.score,
                gained: player.gained,
                found: player.found,
                online: player.connections > 0,
                answered: Boolean(player.answered),
                ...(showTrack ? { lastGuess: player.lastGuess } : {})
            })),
            teams: [...teams.values()].sort((a, b) => b.score - a.score || b.members - a.members || a.name.localeCompare(b.name)),
            stats: this.phase === 'podium' ? this.stats : null,
            track: showTrack && this.track ? {
                name: this.track.name,
                artists: this.track.artists,
                image: this.track.image || (this.playlist ? this.playlist.image : null)
            } : null
        };
    }

    toJSON() {
        return {
            settings: this.settings,
            options: this.options,
            phase: this.phase,
            roundIndex: this.roundIndex,
            playlist: this.playlist,
            allTracks: this.allTracks,
            played: [...this.played],
            teams: [...this.teamList],
            stats: this.stats,
            players: [...this.players.values()].map(({ token, id, name, team, score, firsts, fastestMs, fastestTrack }) => ({ token, id, name, team, score, firsts, fastestMs, fastestTrack }))
        };
    }

    restore(data) {
        if (!data) return;
        this.settings = { ...DEFAULTS, ...(data.settings || {}) };
        this.options = { ...this.options, ...(data.options || {}) };
        this.allTracks = data.allTracks || [];
        const playable = this.playable().length;
        this.playlist = data.playlist ? { ...data.playlist, resolved: playable, missing: this.allTracks.length - playable, ready: true } : null;
        this.played = new Set(data.played || []);
        this.teamList = new Set(data.teams || []);
        this.stats = data.stats || null;
        for (const entry of data.players || []) {
            if (entry && entry.token && entry.name) this.players.set(entry.token, freshPlayer(entry));
        }
        const interrupted = !['lobby', 'podium'].includes(data.phase);
        this.phase = data.phase === 'podium' ? 'podium' : 'lobby';
        this.roundIndex = this.phase === 'podium' ? data.roundIndex || 0 : 0;
        this.notice = interrupted ? 'Partie interrompue par un redémarrage, les scores sont conservés' : null;
    }
}

module.exports = { Game, shuffle };
