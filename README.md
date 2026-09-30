# Blind Test de fin de soirée

Blind test multijoueur qui tourne **dans une appli Android, sur le téléphone de
l'hôte**. Les invités rejoignent en scannant un QR code et répondent sur leur
téléphone, la TV affiche le classement, le chrono, les indices et joue les
extraits de 30 secondes. Marche chez toi comme chez la famille : il suffit
d'être sur le même Wi-Fi, ou sur le partage de connexion du téléphone.

> **Installer : https://ghermin.github.io/blindtest-de-fin-de-soiree/**
> (un APK à ouvrir, deux minutes). Le pas à pas et le dépannage :
> [INSTALL.md](INSTALL.md).

## Comment ça marche

1. L'hôte ouvre **Blind Test** sur son Android. L'appli héberge la partie
   (moteur Node embarqué), met à jour le jeu au lancement et affiche la salle,
   déjà en mode hôte, avec l'adresse et le QR code à donner aux autres.
2. La TV ouvre l'adresse « Écran TV » dans son navigateur et valide **Activer
   le son**. Les invités scannent le QR code, rien à installer.
3. L'hôte colle un lien de playlist Spotify ou Deezer, ou tape un nom
   (« années 80 »), attend « extraits prêts », règle la partie et lance.
4. À chaque manche, la TV joue l'extrait ; sans écran, le téléphone de l'hôte
   peut jouer le son sur une enceinte.

## Jouer

- Chacun entre un pseudo et, s'il veut, une équipe. On peut rejoindre en cours
  de partie. Un téléphone qui a fermé la page est marqué d'une lune et ne bloque pas
  la fin de manche.
- Réglages, appliqués en direct et visibles de tous dans le lobby : manches,
  durée, titre et/ou artiste, **clavier ou QCM** (quatre propositions, une
  réponse par manche), **chacun pour soi ou un téléphone par équipe**, indices.
- Déroulé : décompte de 3 s, extrait de 30 s, réponses, révélation (la
  dernière réponse de chacun s'affiche), manche suivante, podium avec les
  statistiques de la soirée. Pendant la partie l'hôte peut mettre en pause,
  passer, terminer ou revenir au lobby ; sur le podium, rejouer ou modifier.

Les réponses tolèrent accents, majuscules, ponctuation, articles, « feat. »,
« (Remastered) », une petite faute de frappe, titre et artiste dans la même
réponse, et un mot significatif suffit (« billie » pour Billie Jean).
**Indices** : nombre de lettres à mi-temps, première lettre dans les 10
dernières secondes.

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
propositions du QCM, révélation avec la pochette, podium, et le son. Rien des
saisies de l'hôte. Le navigateur d'une smart TV de 2019 ou plus récente
suffit ; sinon une tablette ou un portable.

## Playlists et extraits

Deezer : toutes les playlists publiques, en entier, sans rien configurer.
Spotify : les playlists publiques se lisent par la page de leur lecteur intégré
(100 premiers titres, extraits Spotify inclus) ; avec des identifiants d'app
Spotify, la recherche par nom inclut Spotify et le compte connecté donne accès
à **Mes playlists** (en entier pour celles que tu possèdes, règle Spotify de
mars 2026).

Les extraits de 30 secondes sont les aperçus publics fournis par Spotify,
Deezer et Apple Music, les mêmes que sur leurs sites. Ils sont destinés à la
découverte : ce jeu s'en sert dans un cadre privé et affiche leur provenance.
Rien n'est téléchargé ni conservé, seuls les identifiants des titres sont mis
en cache.

## Sous le capot

- `index.js`, `src/`, `public/` : le serveur Node (zéro dépendance, `node:http`
  et SSE) et le front vanilla, mis à jour dans l'appli à chaque lancement.
- `android/` : l'appli (Kotlin), qui embarque Node via
  [nodejs-mobile](https://github.com/nodejs-mobile/nodejs-mobile) et affiche la
  salle dans une WebView. L'APK est construit et signé par GitHub Actions à
  chaque changement, publié dans la release `apk`, et l'appli propose
  elle-même ses mises à jour.
- `docs/` : la page d'installation (GitHub Pages), générée par `npm run pages`.
- `public/icons.svg` : les icônes [Lucide](https://lucide.dev) (licence ISC),
  regroupées par `npm run sprite`, qui génère aussi celles du menu Android.

```bash
npm test        # matching, indices, QR code, extraits, partie, salles
npm start       # le serveur sur un ordinateur, pour développer (voir .env.example)
```
