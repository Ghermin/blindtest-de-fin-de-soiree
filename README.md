# Blind Test de fin de soirée

Un blind test à plusieurs, hébergé par une appli Android.
Les invités jouent sur leur téléphone. La TV affiche le jeu et joue la musique.
Il suffit d'être sur le même Wi-Fi.

**Installer : https://ghermin.github.io/blindtest-de-fin-de-soiree/**
Pas à pas et dépannage : [INSTALL.md](INSTALL.md).

## Lancer une partie

1. L'hôte ouvre l'appli **Blind Test**.
2. Sur la TV, ouvre l'adresse affichée dans le cadre **Écran TV**, puis touche **Activer le son**.
3. Les invités scannent le QR code. Rien à installer.
4. L'hôte colle un lien de playlist Spotify ou Deezer, ou cherche un nom (« années 80 »).
5. Il règle la partie et lance.

Pas de TV ? Le téléphone de l'hôte peut jouer le son sur une enceinte.

## Jouer

- Chacun choisit un pseudo, et une équipe s'il veut.
- On répond au clavier ou en QCM (4 propositions).
- On peut jouer chacun pour soi, ou un téléphone par équipe.
- Les fautes de frappe, accents et majuscules sont tolérés.
- Un titre déjà joué ne revient pas.
- L'hôte peut mettre en pause, passer, arrêter, gérer les joueurs et les équipes.
- Le thème clair ou sombre suit celui de l'appareil.

## Points

| Trouvé | Points |
|---|---|
| Titre | jusqu'à 500 |
| Artiste | jusqu'à 500 |
| Les deux | +200 |
| Le premier à trouver | +100 |

Plus on répond vite et juste, plus on gagne.

## Playlists

- Deezer : toutes les playlists publiques, en entier.
- Spotify : les playlists publiques, 100 premiers titres.
- Aucun compte à connecter.

Les extraits de 30 secondes sont ceux que Spotify, Deezer et Apple Music
proposent en écoute libre. Rien n'est téléchargé.

Pour les playlists de films, séries et animes, le nom de l'œuvre s'affiche
à côté du titre. Les titres japonais s'affichent aussi en lettres latines.

## Pour développer

```bash
npm test
npm start
```

- Node 22 (voir `.nvmrc`).
- `index.js`, `src/`, `public/` : le serveur et les pages. L'appli les met à jour à chaque lancement.
- `android/` : l'appli Android. GitHub Actions construit l'APK à chaque changement.
- `docs/` : la page d'installation, générée par `npm run pages`.
- `npm run works` régénère les tables d'œuvres et de noms japonais (`src/works.json`, `src/romaji.json`).
- `npm run sprite` régénère les icônes ([Lucide](https://lucide.dev), licence ISC).

Si `npm test` signale une table invalide après un changement de `normalize()`, relance `npm run works`.
