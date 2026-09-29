# 🎧 Blind Test de fin de soirée

Blind test multijoueur sur une playlist Spotify, hébergé sur un Raspberry Pi.
Chacun rejoint depuis son téléphone, la musique sort sur une enceinte connectée,
un Chromecast ou n'importe quel appareil Spotify Connect de l'hôte. 30 secondes
au milieu du morceau, on devine le titre et/ou l'artiste, les plus rapides
marquent le plus de points.

Deux façons de jouer :

- **À la maison** : le Pi sert le jeu sur le réseau local, la salle `MAISON`
  utilise ton compte Spotify.
- **Avec la famille, chacun chez soi** : le Pi est exposé en HTTPS par un tunnel
  Cloudflare, chaque hôte crée sa salle et connecte son propre compte Spotify
  Premium depuis son navigateur. La musique sort chez lui, sur son appareil.

Zéro dépendance runtime : Node ≥ 20, `node:http`, SSE et du JS vanilla.

> 🍓 **Première installation ?** Suis le guide pas à pas : **[INSTALL.md](INSTALL.md)**.

## Prérequis

- Un compte **Spotify Premium** par hôte (l'API de contrôle de lecture est réservée au Premium)
- Une app Spotify sur https://developer.spotify.com/dashboard avec le redirect URI `http://127.0.0.1:8888/callback`
  (et, pour la famille, `https://<ton-domaine>/auth/spotify/callback`)
- Node ≥ 20 (le Pi est installé automatiquement en Node 22 par `deploy/install.sh`)

## Connexion Spotify de la salle de la maison (une seule fois)

```bash
cp .env.example .env        # renseigne SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET
npm run auth                # ouvre l'URL affichée, autorise, colle le SPOTIFY_REFRESH_TOKEN dans .env
```

Spotify n'accepte que `127.0.0.1` en redirect HTTP : lance `npm run auth` sur la
machine où est ton navigateur. Pour le Pi, tunnel SSH puis ouvre l'URL sur ton PC :

```bash
ssh -L 8888:127.0.0.1:8888 pi@raspberrypi.local
```

Le refresh token n'expire pas. Avec lui, le serveur crée au démarrage la salle
`MAISON` (nom modifiable par `BLINDTEST_HOME_ROOM`) dont tu es l'hôte.

## Lancer en local

```bash
npm start                   # http://localhost:3000
```

## Déployer sur le Raspberry Pi

```bash
curl -fsSL https://raw.githubusercontent.com/Ghermin/blindtest-de-fin-de-soiree/main/deploy/install.sh | sudo bash
sudo nano /opt/blindtest/.env   # colle les variables SPOTIFY_*
sudo systemctl start blindtest
```

Le jeu est sur `http://<hostname>.local:3000`. Une mise à jour est tirée
automatiquement toutes les 30 min (`blindtest-update.timer`), mais jamais
pendant une partie : le script attend que toutes les salles soient au lobby ou
au podium.

## Jouer

1. Sur la page d'accueil, l'hôte clique **Créer une salle** (ou **Salle de la
   maison** sur le Pi). Il reçoit une clé hôte, gardée dans son navigateur.
2. Le lobby affiche l'adresse et un QR code : chacun scanne, entre un pseudo et,
   s'il veut, une équipe. On peut rejoindre en cours de partie.
3. L'hôte ouvre le panneau 🎛️, connecte Spotify si ce n'est pas déjà fait,
   choisit une playlist (lien, **Mes playlists**, ou préréglages), règle
   manches / mode / durée / indices.
4. **Le son** : caste Spotify une fois sur l'appareil voulu pour qu'il soit
   visible, ou choisis-le dans **Appareils Spotify**. `SPOTIFY_DEVICE_NAME`
   fixe l'appareil préféré de la salle de la maison.
5. ▶ Lancer : décompte de 3 s, extrait de 30 s pris au milieu du morceau, on tape
   ses réponses, révélation (la musique continue, la dernière réponse de chacun
   s'affiche), manche suivante, podium avec les statistiques de la soirée.

Les réponses tolèrent accents, majuscules, ponctuation, articles, « feat. »,
« (Remastered) », une petite faute de frappe, et un mot significatif suffit
(« billie » pour Billie Jean, « daft » pour Daft Punk).

**Indices** (option hôte, activée par défaut) : nombre de lettres à mi-temps,
première lettre dans les 10 dernières secondes.

**Équipes** : si des joueurs indiquent une équipe, le total par équipe apparaît
sur tous les écrans. Les points restent individuels.

**Joueurs déconnectés** : un téléphone qui a fermé la page apparaît en 💤 et
n'empêche pas la manche de se terminer quand tous les autres ont trouvé.

## Salles

- Une salle a un code de 4 lettres (`/r/CODE`), son propre hôte, son propre
  compte Spotify, son propre classement. Jusqu'à 50 salles et 60 joueurs par salle.
- La **clé hôte** protège les actions de l'hôte. Elle est donnée à la création
  de la salle, affichée dans le panneau hôte, et redonnée après chaque connexion
  Spotify. Pour la salle de la maison c'est `BLINDTEST_HOST_PIN`, ou un code à
  6 chiffres généré au premier démarrage et affiché dans les logs.
- Les salles sont **sauvegardées** dans `data/rooms.json` : un redémarrage du
  serveur conserve joueurs, scores et playlist, et remet une partie interrompue
  au lobby. Une salle inactive depuis 6 h disparaît.

## Écran TV

`/r/CODE/tv` affiche en grand le QR code pour rejoindre (même en cours de
partie), le classement avec les scores et les équipes, le chrono, les indices,
la révélation avec la pochette et le podium avec les statistiques. Un petit son
accompagne les bonnes réponses et le podium.

Attention au son : si la musique sort sur un Chromecast, Spotify prend l'écran
de cette TV dès le premier morceau et coupe tout ce qu'on y castait. Deux
montages qui marchent :

- **Le Pi branché en HDMI sur la TV** (recommandé) : `sudo /opt/blindtest/deploy/tv-setup.sh`
  installe [raspotify](https://github.com/dtcooper/raspotify), qui fait du Pi
  un appareil Spotify Connect « Blind Test TV » dont le son sort par le HDMI,
  et lance Chromium en plein écran sur `/r/MAISON/tv` au démarrage.
  Un seul câble, rien à caster.
- **Le son ailleurs que sur la TV** (enceinte Connect, Nest, téléphone sur une
  enceinte Bluetooth) : la TV est libre, caste l'onglet `/r/CODE/tv` depuis
  Chrome sur un PC, ou ouvre l'URL dans le navigateur de la TV.

## Ouvrir le jeu à la famille

Le Pi reste chez toi, aucun port n'est ouvert sur la box : un tunnel Cloudflare
(gratuit) donne une adresse HTTPS stable. Il faut un domaine géré par Cloudflare.

```bash
sudo /opt/blindtest/deploy/tunnel-setup.sh blindtest.ton-domaine.fr
```

Le script installe `cloudflared`, crée le tunnel, renseigne
`BLINDTEST_PUBLIC_URL` et `BLINDTEST_TRUST_PROXY` dans `.env`, puis affiche ce
qui reste à faire une seule fois :

1. Dans le dashboard Spotify, ajouter `https://blindtest.ton-domaine.fr/auth/spotify/callback`
   aux Redirect URIs, et l'e-mail Spotify de chaque hôte dans **User Management**
   (25 utilisateurs maximum en mode développement, Spotify n'accorde plus le
   quota étendu aux particuliers).
2. Recommandé : réserver l'adresse à la famille avec **Cloudflare Access**
   (Zero Trust → Access → Applications → Self-hosted, politique « Allow » avec
   les e-mails de la famille). Chacun reçoit un code à usage unique par e-mail,
   le jeu n'est pas visible du reste d'Internet.

Ensuite, un hôte de la famille ouvre l'adresse, **Créer une salle**, panneau
hôte → **Connecter Spotify** (son compte Premium), choisit une playlist et
lance. Les invités scannent le QR code affiché dans son lobby ou sur sa TV.

Ce que fait le serveur pour rester sain une fois exposé : HTTPS par Cloudflare,
en-têtes de sécurité stricts (CSP, pas de cadre), clé hôte comparée à temps
constant, limites de débit par adresse (création de salles, connexions,
réponses, actions hôte, tentatives Spotify), corps de requête bornés, pseudos et
réponses tronqués, plafond de salles, de joueurs et de connexions, jetons
Spotify stockés côté serveur dans `data/` en lecture seule pour les autres
utilisateurs, service systemd confiné.

## Scoring

| Trouvé | Points |
|---|---|
| Titre | 500 × vitesse |
| Artiste | 500 × vitesse |
| Les deux dans la manche | +200 |
| Premier sur le titre / l'artiste | +100 |

La vitesse décroît linéairement de 1.0 (immédiat) à 0.3 (dernière seconde).
Tous les temps sont mesurés côté serveur : pas de triche possible en trafiquant
son téléphone. Deux parties de suite sur la même playlist ne rejouent pas les
mêmes titres tant qu'il en reste.

Au podium : le plus rapide de la soirée, le plus souvent premier, et la réponse
la plus hors sujet.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | L'app créée sur le dashboard Spotify |
| `SPOTIFY_REFRESH_TOKEN` | Sortie de `npm run auth` : crée la salle de la maison |
| `SPOTIFY_DEVICE_NAME` | Nom (partiel) de l'appareil de sortie préféré de la salle de la maison, ex. `Salon` |
| `BLINDTEST_PORT` | Port HTTP (3000) |
| `BLINDTEST_HOST_PIN` | Clé hôte de la salle de la maison (sinon 6 chiffres générés, voir les logs) |
| `BLINDTEST_HOME_ROOM` | Code de la salle de la maison (`MAISON`) |
| `BLINDTEST_PUBLIC_URL` | Adresse publique HTTPS (tunnel), sert aux QR codes et à la connexion Spotify des hôtes |
| `BLINDTEST_TRUST_PROXY` | `1` derrière Cloudflare pour lire la vraie adresse des joueurs |
| `BLINDTEST_DATA_DIR` | Dossier des sauvegardes et des préréglages (`data/`) |

Préréglages de playlists : copie `presets.example.json` en `data/presets.json`
avec des liens de playlists **perso ou d'autres utilisateurs**. Les playlists
créées par Spotify (Top 50, Années 80…) ne sont pas accessibles aux apps en mode
développement.

## Dépannage

- **« Aucun appareil Spotify visible »** : les appareils Connect s'endorment.
  Ouvre Spotify sur ton téléphone ou caste 5 secondes, puis **Relancer la lecture**
  (bouton sur l'écran de l'hôte).
- **« Spotify n'a pas confirmé la lecture »** : la commande est partie mais rien
  ne joue. Vérifie l'appareil dans **Appareils Spotify** puis relance.
- **« Playlist introuvable »** : playlist éditoriale Spotify, privée d'un autre
  compte, ou lien erroné. Utilise une playlist perso ou **Mes playlists**.
- **« Clé hôte incorrecte »** : la clé est dans le panneau hôte de l'appareil qui
  a créé la salle, dans les logs pour la salle de la maison (`journalctl -u blindtest`),
  ou dans `BLINDTEST_HOST_PIN`.
- **« Connexion Spotify indisponible »** : hors `127.0.0.1`, la connexion depuis le
  navigateur exige `BLINDTEST_PUBLIC_URL` en HTTPS et le redirect URI déclaré chez Spotify.
- **La musique démarre en retard** : normal sur Chromecast (~1 s), le chrono ne
  démarre qu'une fois la lecture confirmée par Spotify.
- **Podium figé** : l'hôte a un bouton « ↩ Lobby » pour repartir sur une nouvelle partie.
- **Voir ce qui se passe** : `journalctl -u blindtest -f` trace les salles, joueurs,
  manches, erreurs Spotify. `GET /api/health` dit si une partie est en cours.

## Développement

```bash
npm test                    # matching, indices, QR code, partie, salles
npm run icons               # régénère les icônes PNG (écran d'accueil iOS/Android)
```
