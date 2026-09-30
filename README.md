# 🎧 Blind Test de fin de soirée

Blind test multijoueur qui tourne **sur le téléphone de l'hôte**. Les invités
rejoignent en scannant un QR code, la TV affiche le classement, le chrono, les
indices et joue les extraits de 30 secondes, chacun répond sur son téléphone.
Marche chez toi comme chez la famille : il suffit d'être sur le même Wi-Fi, ou
sur le partage de connexion du téléphone.

Zéro dépendance runtime : Node, `node:http`, SSE et du JS vanilla. Les extraits
viennent des catalogues publics de Deezer et d'Apple Music. Pas besoin de
Spotify Premium.

> 📱 **Installer sur un téléphone : https://ghermin.github.io/blindtest-de-fin-de-soiree/**
> (appli Android à télécharger, ou une commande à coller dans Termux). Le pas à pas
> complet : [INSTALL.md](INSTALL.md).

## Comment ça marche

1. Sur son Android, l'hôte lance **Blind Test** (widget ou commande `blindtest`
   dans Termux). Le téléphone devient le serveur, se met à jour depuis ce dépôt
   s'il a Internet, affiche l'adresse de la salle et un QR code, et ouvre Chrome
   sur la salle.
2. La TV ouvre l'adresse de la salle suivie de `/tv` dans son navigateur et
   valide **Activer le son**. Les invités scannent le QR code.
3. L'hôte colle le lien d'une playlist **Spotify** ou **Deezer** publique, ou
   la cherche par nom (Deezer, et Spotify avec des identifiants d'app), attend
   « extraits prêts », lance.
4. À chaque manche, le serveur donne à l'écran TV l'extrait et l'instant de
   départ ; sans écran, le téléphone de l'hôte peut jouer le son sur une
   enceinte. Tout est mesuré côté serveur.

## Jouer

- Page d'accueil → **Salle de la maison** (ou **Créer une salle** pour une
  salle indépendante). L'hôte prend la main avec son **code hôte**.
- Chacun entre un pseudo et, s'il veut, une équipe. On peut rejoindre en cours
  de partie. Un téléphone qui a fermé la page apparaît en 💤 et ne bloque pas
  la fin de manche.
- ▶ Lancer : décompte de 3 s, extrait de 30 s, réponses, révélation (l'extrait
  continue, la dernière réponse de chacun s'affiche), manche suivante, podium
  avec les statistiques de la soirée.

Les réponses tolèrent accents, majuscules, ponctuation, articles, « feat. »,
« (Remastered) », une petite faute de frappe, et un mot significatif suffit
(« billie » pour Billie Jean, « daft » pour Daft Punk). **Indices** : nombre
de lettres à mi-temps, première lettre dans les 10 dernières secondes.

## Scoring

| Trouvé | Points |
|---|---|
| Titre | 500 × vitesse |
| Artiste | 500 × vitesse |
| Les deux dans la manche | +200 |
| Premier sur le titre / l'artiste | +100 |

La vitesse décroît linéairement de 1.0 (immédiat) à 0.3 (dernière seconde).
Deux parties de suite sur la même playlist ne rejouent pas les mêmes titres.
Au podium : le plus rapide, le plus souvent premier, la réponse la plus hors
sujet.

## Écran TV

`/r/CODE/tv` : QR code permanent, classement avec équipes, chrono, indices,
révélation avec la pochette, podium, et le son. Rien des saisies de l'hôte.
Le navigateur d'une smart TV de 2019 ou plus récente suffit ; sinon une
tablette, un portable, ou un deuxième téléphone qui diffuse son écran vers un
Chromecast.

## Configuration (`.env` sur le téléphone, réglée par l'assistant)

| Variable | Rôle |
|---|---|
| `BLINDTEST_HOST_PIN` | Code hôte de la salle de la maison |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Optionnels : app Spotify pour la recherche de playlists et le bouton « Mes playlists » |
| `BLINDTEST_HOME_ROOM` | Code de la salle de la maison (`MAISON`) |
| `BLINDTEST_PORT` | Port HTTP (3000) |
| `BLINDTEST_COUNTRY` | Pays du catalogue Apple Music de secours (`FR`) |

Préréglages de playlists : `data/presets.json` (modèle dans
`presets.example.json`), liens Spotify ou Deezer. Une playlist Spotify publique
se lit par la page de son lecteur intégré (100 premiers titres, extraits
Spotify inclus) ; l'API officielle ne donne la liste complète que des playlists
possédées par le compte connecté (règle Spotify de mars 2026). Les playlists
Deezer publiques passent toutes, en entier.

## Les extraits

Les extraits de 30 secondes sont les aperçus publics fournis par Spotify, Deezer et
Apple Music, les mêmes que sur leurs sites. Ils sont destinés à la découverte :
ce jeu s'en sert dans un cadre privé et affiche leur provenance. Rien n'est
téléchargé ni conservé, seuls les identifiants des titres sont mis en cache.

## Développement

```bash
cp .env.example .env
npm start                   # http://localhost:3000
npm test                    # matching, indices, QR code, extraits, partie, salles
npm run icons               # régénère les icônes PNG
```

Le serveur tourne aussi sur n'importe quelle machine avec Node ≥ 20 (`npm start`),
derrière un reverse proxy HTTPS avec `BLINDTEST_PUBLIC_URL` et `BLINDTEST_TRUST_PROXY=1`.
