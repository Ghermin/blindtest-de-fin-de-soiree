const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const spotify = require('./spotify.js');
const matching = require('./matching.js');

const DEFAULTS = { rounds: 10, guessMs: 30000, countdownMs: 3000, revealMs: 8000, mode: 'both' };
const POINTS = { find: 500, both: 200, first: 100, minSpeed: 0.3 };

class Game extends EventEmitter {
    constructor() {
        super();
        this.players = new Map();
        this.playlist = null;
        this.allTracks = [];
        this.queue = [];
        this.settings = { ...DEFAULTS };
        this.phase = 'lobby';
        this.roundIndex = 0;
        this.track = null;
        this.phaseEndsAt = 0;
        this.guessStartedAt = 0;
        this.firstTitle = null;
        this.firstArtist = null;
        this.notice = null;
        this.timer = null;
        this.generation = 0;
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

    join(name, token) {
        const cleaned = String(name || '').trim().slice(0, 20);
        if (token && this.players.has(token)) {
            const player = this.players.get(token);
            if (cleaned) player.name = cleaned;
            this.changed();
            return player;
        }
        if (!cleaned) throw new Error('Il faut un pseudo');
        const player = {
            token: randomUUID(),
            name: cleaned,
            score: 0,
            gained: 0,
            found: { title: false, artist: false },
            lastGuessAt: 0
        };
        this.players.set(player.token, player);
        this.notice = null;
        this.changed();
        return player;
    }

    leave(token) {
        if (this.players.delete(token)) this.changed();
    }

    async setPlaylist(input) {
        if (this.phase !== 'lobby' && this.phase !== 'podium') throw new Error('Partie en cours');
        const id = spotify.parsePlaylistId(input);
        if (!id) throw new Error('Lien de playlist invalide');
        const data = await spotify.playlist(id);
        if (data.tracks.length < 3) throw new Error('Playlist trop courte ou titres indisponibles');
        this.playlist = { id, name: data.name, image: data.image, total: data.tracks.length };
        this.allTracks = data.tracks;
        this.phase = 'lobby';
        this.notice = null;
        this.changed();
        return this.playlist;
    }

    start(options = {}) {
        if (!this.allTracks || !this.allTracks.length) throw new Error('Choisis une playlist d\'abord');
        if (!this.players.size) throw new Error('Aucun joueur');
        const rounds = Math.max(1, Math.min(Number(options.rounds) || DEFAULTS.rounds, this.allTracks.length, 50));
        const guessSeconds = Math.max(10, Math.min(Number(options.guessSeconds) || 30, 90));
        const mode = ['title', 'artist', 'both'].includes(options.mode) ? options.mode : 'both';
        this.settings = { ...DEFAULTS, rounds, guessMs: guessSeconds * 1000, mode };
        this.queue = [...this.allTracks].sort(() => Math.random() - 0.5).slice(0, rounds);
        for (const player of this.players.values()) {
            player.score = 0;
            player.gained = 0;
            player.found = { title: false, artist: false };
        }
        this.roundIndex = 0;
        this.generation++;
        this.notice = null;
        this.nextRound();
    }

    nextRound() {
        this.roundIndex++;
        this.track = this.queue[this.roundIndex - 1];
        this.firstTitle = null;
        this.firstArtist = null;
        for (const player of this.players.values()) {
            player.gained = 0;
            player.found = { title: false, artist: false };
        }
        this.phase = 'countdown';
        this.phaseEndsAt = Date.now() + this.settings.countdownMs;
        this.notice = null;
        this.changed();
        this.schedule(this.settings.countdownMs, () => this.beginGuess());
    }

    async beginGuess() {
        const generation = this.generation;
        const track = this.track;
        const position = track.durationMs > this.settings.guessMs + 20000
            ? Math.floor(track.durationMs / 2) - Math.floor(this.settings.guessMs / 2)
            : 0;
        try {
            await spotify.ensurePlay(track.uri, Math.max(0, position));
            await spotify.confirmPlaying(track.uri);
        } catch (error) {
            if (generation !== this.generation) return;
            this.phase = 'stalled';
            this.notice = error.message;
            this.changed();
            return;
        }
        if (generation !== this.generation || this.track !== track) return;
        this.guessStartedAt = Date.now();
        this.phase = 'guess';
        this.phaseEndsAt = this.guessStartedAt + this.settings.guessMs;
        this.changed();
        this.schedule(this.settings.guessMs, () => this.endGuess());
    }

    retry() {
        if (this.phase !== 'stalled') throw new Error('Rien à relancer');
        this.beginGuess();
    }

    endGuess() {
        spotify.pause().catch(() => {});
        this.phase = 'reveal';
        this.phaseEndsAt = Date.now() + this.settings.revealMs;
        this.changed();
        this.schedule(this.settings.revealMs, () => {
            if (this.roundIndex >= this.settings.rounds || this.roundIndex >= this.queue.length) {
                this.phase = 'podium';
                this.phaseEndsAt = 0;
                this.changed();
            } else {
                this.nextRound();
            }
        });
    }

    skip() {
        if (this.phase === 'guess' || this.phase === 'stalled' || this.phase === 'countdown') {
            this.endGuess();
        } else if (this.phase === 'reveal') {
            clearTimeout(this.timer);
            if (this.roundIndex >= this.settings.rounds || this.roundIndex >= this.queue.length) {
                this.phase = 'podium';
                this.phaseEndsAt = 0;
                this.changed();
            } else {
                this.nextRound();
            }
        } else {
            throw new Error('Rien à passer');
        }
    }

    stop() {
        this.generation++;
        clearTimeout(this.timer);
        spotify.pause().catch(() => {});
        this.phase = this.roundIndex > 0 ? 'podium' : 'lobby';
        this.phaseEndsAt = 0;
        this.changed();
    }

    backToLobby() {
        this.generation++;
        clearTimeout(this.timer);
        this.phase = 'lobby';
        this.roundIndex = 0;
        this.track = null;
        this.notice = null;
        for (const player of this.players.values()) {
            player.gained = 0;
            player.found = { title: false, artist: false };
        }
        this.changed();
    }

    guess(token, text) {
        const player = this.players.get(token);
        if (!player) throw new Error('Joueur inconnu, rejoins la partie');
        if (this.phase !== 'guess') return { accepted: false, reason: 'wait' };
        const now = Date.now();
        if (now - player.lastGuessAt < 500) return { accepted: false, reason: 'throttle' };
        player.lastGuessAt = now;
        const cleaned = String(text || '').trim().slice(0, 80);
        if (!cleaned) return { accepted: false, reason: 'empty' };

        const mode = this.settings.mode;
        const elapsed = now - this.guessStartedAt;
        const speed = 1 - (1 - POINTS.minSpeed) * Math.min(1, elapsed / this.settings.guessMs);
        const result = { accepted: true, title: false, artist: false, gained: 0 };

        if (mode !== 'artist' && !player.found.title && matching.matchesTitle(cleaned, this.track.name)) {
            player.found.title = true;
            result.title = true;
            let points = Math.round(POINTS.find * speed);
            if (!this.firstTitle) {
                this.firstTitle = player.token;
                points += POINTS.first;
            }
            result.gained += points;
        }
        if (mode !== 'title' && !player.found.artist && matching.matchesArtist(cleaned, this.track.artists)) {
            player.found.artist = true;
            result.artist = true;
            let points = Math.round(POINTS.find * speed);
            if (!this.firstArtist) {
                this.firstArtist = player.token;
                points += POINTS.first;
            }
            result.gained += points;
        }
        if (mode === 'both' && result.gained && player.found.title && player.found.artist) {
            result.gained += POINTS.both;
        }
        if (result.gained) {
            player.score += result.gained;
            player.gained += result.gained;
            this.changed();
            if (this.everyoneDone()) this.schedule(1500, () => this.endGuess());
        }
        return result;
    }

    everyoneDone() {
        const mode = this.settings.mode;
        for (const player of this.players.values()) {
            if (mode !== 'artist' && !player.found.title) return false;
            if (mode !== 'title' && !player.found.artist) return false;
        }
        return this.players.size > 0;
    }

    publicState() {
        const showTrack = this.phase === 'reveal' || this.phase === 'podium';
        return {
            phase: this.phase,
            serverNow: Date.now(),
            phaseEndsAt: this.phaseEndsAt,
            round: this.roundIndex,
            rounds: this.settings.rounds,
            mode: this.settings.mode,
            guessMs: this.settings.guessMs,
            notice: this.notice,
            playlist: this.playlist,
            players: [...this.players.values()]
                .sort((a, b) => b.score - a.score)
                .map((player) => ({
                    name: player.name,
                    score: player.score,
                    gained: player.gained,
                    found: player.found
                })),
            track: showTrack && this.track ? {
                name: this.track.name,
                artists: this.track.artists,
                image: this.track.image
            } : null
        };
    }
}

module.exports = { Game };
