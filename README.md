# 🎧 Blind Test de fin de soirée

Blind test multijoueur hébergé sur un Raspberry Pi. L'hôte colle une playlist
Spotify ou Deezer, chacun rejoint depuis son téléphone en scannant un QR code,
et **l'écran TV de la salle joue lui-même un extrait de 30 secondes** tout en
affichant le classement, le chrono et les indices. On devine le titre et/ou
l'artiste, les plus rapides marquent le plus de points.

- **À la maison** : le Pi sert le jeu sur le réseau local, la salle `MAISON`
  est prête au démarrage.
- **Avec la famille, chacun chez soi** : le Pi est exposé en HTTPS par un
  tunnel Cloudflare, chaque hôte crée sa salle en un clic. Aucun compte à
  créer, pas besoin de Spotify Premium.

Zéro dépendance runtime : Node ≥ 20, `node:http`, SSE et du JS vanilla. Les
extraits viennent des catalogues publics de Deezer et d'Apple Music.

> 🍓 **Première installation ?** Suis le guide pas à pas : **[INSTALL.md](INSTALL.md)**.

## Comment ça marche

1. L'hôte colle un lien de playlist. **Deezer** : les extraits sont déjà là.
   **Spotify** : le serveur lit la playlist avec les identifiants de ton app
   Spotify, puis retrouve chaque titre chez Deezer (ou Apple Music en secours)
   par titre, artiste et durée. Quelques secondes pour une centaine de titres,
   les titres sans extrait sont écartés et comptés.
2. À chaque manche, le serveur donne à tous les écrans l'extrait à jouer et
   l'instant de départ. **L'écran TV** de la salle le joue ; sans écran, l'hôte
   active « Son sur ce téléphone » et branche une enceinte.
3. Les joueurs répondent sur leur téléphone. Tout est mesuré côté serveur.

## Installer sur le Raspberry Pi

```bash
curl -fsSL https://raw.githubusercontent.com/Ghermin/blindtest-de-fin-de-soiree/main/deploy/install.sh -o /tmp/install.sh
sudo bash /tmp/install.sh
```

L'installation enchaîne sur un **assistant** : code hôte, identifiants Spotify
(optionnels, seulement pour les liens Spotify), accès famille, écran TV, puis
démarrage et QR code de ta salle dans le terminal. Relançable à tout moment :
`sudo /opt/blindtest/deploy/setup.sh`.

Une mise à jour est tirée automatiquement toutes les 30 min, jamais pendant
une partie.

## Lancer en local (développement)

```bash
cp .env.example .env
npm start                   # http://localhost:3000
```

## Jouer

1. Page d'accueil → **Créer une salle**, ou **Salle de la maison** sur le Pi.
   L'hôte reçoit une clé hôte, gardée dans son navigateur.
2. Le lobby affiche l'adresse et un QR code : chacun scanne, entre un pseudo
   et, s'il veut, une équipe. On peut rejoindre en cours de partie.
3. L'hôte ouvre le panneau 🎛️, colle une playlist (lien, ou préréglages),
   attend « extraits prêts », règle manches / mode / durée / indices.
4. **Le son** : l'écran TV ouvert sur la salle joue les extraits (bouton
   **Activer le son** au premier affichage dans un navigateur). Sans écran :
   **Son sur ce téléphone** dans le panneau hôte, téléphone sur une enceinte.
5. ▶ Lancer : décompte de 3 s, extrait de 30 s, on tape ses réponses,
   révélation (l'extrait continue, la dernière réponse de chacun s'affiche),
   manche suivante, podium avec les statistiques de la soirée.

Les réponses tolèrent accents, majuscules, ponctuation, articles, « feat. »,
« (Remastered) », une petite faute de frappe, et un mot significatif suffit
(« billie » pour Billie Jean, « daft » pour Daft Punk).

**Indices** (option hôte, activée par défaut) : nombre de lettres à mi-temps,
première lettre dans les 10 dernières secondes.

**Équipes** : si des joueurs indiquent une équipe, le total par équipe apparaît
sur tous les écrans. Les points restent individuels.

**Joueurs déconnectés** : un téléphone qui a fermé la page apparaît en 💤 et
n'empêche pas la manche de se terminer quand tous les autres ont trouvé.

## Afficher le jeu sur la TV

`/r/CODE/tv` est l'écran de la salle : QR code permanent pour rejoindre,
classement avec scores et équipes, chrono, indices, révélation avec la
pochette, podium avec les statistiques, **et le son des extraits**. Rien des
saisies de l'hôte n'y apparaît. Trois façons de le mettre sur la TV :

1. **Caster depuis un téléphone Android** : bouton **📺 Caster sur la TV** dans
   le panneau hôte. Le Chromecast charge lui-même la page et joue le son, le
   téléphone reste libre pour jouer. Il faut l'accès famille (adresse HTTPS,
   section suivante) et un récepteur Cast enregistré une fois chez Google pour
   5 $ : https://cast.google.com/publish → **Add new application** → **Custom
   Receiver** → URL `https://ton-domaine/cast` → l'**Application ID** va dans
   `BLINDTEST_CAST_APP_ID` → **Publish**. Pas depuis un iPhone : les navigateurs
   iOS ne savent pas caster une page.
2. **N'importe quel autre écran** ouvre `/r/CODE/tv` : une tablette, un
   portable avec Chrome (menu → **Caster** → cet onglet), le navigateur d'une
   Android TV ou d'une Fire TV. Un clic sur **Activer le son** et c'est parti.
3. **Le Pi branché en HDMI sur la TV** : `sudo /opt/blindtest/deploy/tv-setup.sh`
   lance Chromium en plein écran sur `/r/MAISON/tv` au démarrage, son par le HDMI.

## Salles

- Une salle a un code de 4 lettres (`/r/CODE`), son propre hôte, sa playlist,
  son classement. Jusqu'à 50 salles et 60 joueurs par salle.
- La **clé hôte** protège les actions de l'hôte. Elle est donnée à la création
  de la salle et affichée dans le panneau hôte. Pour la salle de la maison
  c'est `BLINDTEST_HOST_PIN`, sinon un code à 6 chiffres généré au premier
  démarrage et affiché dans les logs.
- Les salles sont **sauvegardées** dans `data/rooms.json` : un redémarrage
  conserve joueurs, scores et playlist, et remet une partie interrompue au
  lobby. Une salle inactive depuis 6 h disparaît. Les appariements d'extraits
  sont mis en cache dans `data/previews.json`.

## Ouvrir le jeu à la famille

Le Pi reste chez toi, aucun port n'est ouvert sur la box : un tunnel Cloudflare
(gratuit) donne une adresse HTTPS stable. Il faut un domaine géré par Cloudflare.

```bash
sudo /opt/blindtest/deploy/tunnel-setup.sh blindtest.ton-domaine.fr
```

Recommandé ensuite : réserver l'adresse à la famille avec **Cloudflare Access**
(Zero Trust → Access → Applications → Self-hosted, politique « Allow » avec les
e-mails de la famille). Chacun reçoit un code à usage unique par e-mail, le
jeu n'est pas visible du reste d'Internet.

Un hôte de la famille ouvre l'adresse, **Créer une salle**, colle une playlist,
met l'écran TV sur `/r/SONCODE/tv` ou caste depuis Android, et lance. Aucun
compte, aucune configuration chez lui.

Ce que fait le serveur pour rester sain une fois exposé : HTTPS par Cloudflare,
en-têtes stricts (CSP, pas de cadre), clé hôte comparée à temps constant,
limites de débit par adresse, corps de requête bornés, pseudos et réponses
tronqués, plafond de salles, de joueurs et de connexions, service systemd
confiné, aucune donnée personnelle stockée hors pseudos et scores.

## Scoring

| Trouvé | Points |
|---|---|
| Titre | 500 × vitesse |
| Artiste | 500 × vitesse |
| Les deux dans la manche | +200 |
| Premier sur le titre / l'artiste | +100 |

La vitesse décroît linéairement de 1.0 (immédiat) à 0.3 (dernière seconde).
Deux parties de suite sur la même playlist ne rejouent pas les mêmes titres
tant qu'il en reste. Au podium : le plus rapide de la soirée, le plus souvent
premier, et la réponse la plus hors sujet.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Optionnels : app Spotify, pour accepter les liens de playlists Spotify |
| `BLINDTEST_PORT` | Port HTTP (3000) |
| `BLINDTEST_HOST_PIN` | Clé hôte de la salle de la maison |
| `BLINDTEST_HOME_ROOM` | Code de la salle de la maison (`MAISON`, vide pour ne pas en créer) |
| `BLINDTEST_PUBLIC_URL` | Adresse publique HTTPS (tunnel), sert aux QR codes et au Cast |
| `BLINDTEST_TRUST_PROXY` | `1` derrière Cloudflare pour lire la vraie adresse des joueurs |
| `BLINDTEST_CAST_APP_ID` | Application ID du récepteur Cast : active le bouton « Caster sur la TV » |
| `BLINDTEST_COUNTRY` | Pays du catalogue Apple Music de secours (`FR`) |
| `BLINDTEST_DATA_DIR` | Dossier des sauvegardes, du cache d'extraits et des préréglages (`data/`) |

Préréglages de playlists : copie `presets.example.json` en `data/presets.json`
avec des liens Spotify ou Deezer. Les playlists créées par Spotify (Top 50,
Années 80…) ne sont pas lisibles par une app en mode développement ; les
playlists Deezer publiques, dont celles de Deezer, le sont toutes.

## Dépannage

- **« Recherche des extraits en cours »** : patiente, le compteur avance dans le
  panneau hôte. Une playlist Spotify de 100 titres prend une quinzaine de secondes.
- **« Pas assez d'extraits trouvés »** : titres trop rares ou mal orthographiés
  sur Spotify. Essaie la même playlist côté Deezer.
- **« Playlist introuvable »** : playlist éditoriale Spotify, privée, ou lien
  erroné. Utilise une playlist publique perso ou une playlist Deezer.
- **« Playlists Spotify indisponibles »** : pas d'identifiants Spotify dans
  `.env`. Colle un lien Deezer, ou relance l'assistant pour les renseigner.
- **Pas de son sur l'écran TV** : clique **Activer le son** (les navigateurs
  exigent un geste), ou vérifie que l'hôte n'a pas activé le son sur son
  téléphone en plus.
- **« Clé hôte incorrecte »** : la clé est dans le panneau hôte de l'appareil qui
  a créé la salle, ou `BLINDTEST_HOST_PIN`, ou `journalctl -u blindtest -n 20`.
- **La TV affiche le jeu depuis un Chromecast mais reste muette** : le
  récepteur Cast joue le son du Chromecast ; monte le volume de la TV.
- **Podium figé** : l'hôte a un bouton « ↩ Lobby » pour repartir sur une nouvelle partie.
- **Voir ce qui se passe** : `journalctl -u blindtest -f` trace les salles,
  playlists, manches, extraits écartés. `GET /api/health` dit si une partie est en cours.

## Les extraits

Les extraits de 30 secondes sont les aperçus publics fournis par Deezer et
Apple Music, les mêmes que ceux qu'on entend en survolant un titre sur leurs
sites. Ils sont destinés à la découverte, pas à l'écoute : ce jeu s'en sert
dans un cadre privé et affiche leur provenance. Rien n'est téléchargé ni
conservé sur le serveur, seuls les identifiants des titres sont mis en cache.

## Développement

```bash
npm test                    # matching, indices, QR code, extraits, partie, salles
npm run icons               # régénère les icônes PNG (écran d'accueil iOS/Android)
```
