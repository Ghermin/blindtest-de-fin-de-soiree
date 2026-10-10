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

- Chacun entre un pseudo et, s'il veut, rejoint une équipe existante ou en
  crée une. On peut rejoindre en cours de partie. Un téléphone qui a fermé la
  page est marqué d'une lune et ne bloque pas la fin de manche.
- Réglages, appliqués en direct et visibles de tous dans le lobby : manches,
  durée, titre et/ou artiste, **clavier ou QCM** (quatre propositions, une
  réponse par manche), **chacun pour soi ou un téléphone par équipe**, indices.
  En QCM, les propositions sont deux par ligne et toutes de la même taille.
- **Playlists de bandes originales** : quand la playlist en est une — son nom
  le dit (BO, OST, anime, films, Disney…) ou au moins trois titres sur dix
  sont reconnus — chaque proposition affiche son œuvre entre parenthèses
  (« Get Wild — TM Network (CITY HUNTER) »), les autres propositions aussi
  pour ne pas vendre la mèche, et le réglage **Titres joués** passe de
  lui-même sur *film, série ou anime identifié* : on ne tire que les titres
  reconnus. L'hôte peut revenir à *tous*. Ailleurs rien ne s'affiche : une
  chanson qu'un film a utilisée reste une chanson, pas une bande originale.
- Déroulé : décompte de 3 s, extrait de 30 s, réponses, révélation (la
  dernière réponse de chacun s'affiche), manche suivante, podium avec les
  statistiques de la soirée. Le son s'atténue en douceur avant de passer au
  titre suivant, pas de coupure sèche. Pendant la partie l'hôte peut mettre
  en pause, passer, terminer ou revenir au lobby ; sur le podium, rejouer ou
  modifier.
- L'hôte gère les équipes (créer, renommer, déplacer un joueur), retire un
  joueur parti, remet les scores à zéro ou vide la salle. Le bouton « … » en
  bas à gauche ouvre les Paramètres de l'appli. Thème clair ou sombre : celui
  du téléphone ; sur la TV, un bouton soleil ou lune.

Les réponses tolèrent accents, majuscules, ponctuation, articles, « feat. »,
« (Remastered) », une petite faute de frappe, titre et artiste dans la même
réponse, et un mot significatif suffit (« billie » pour Billie Jean).
Les titres et les artistes écrits en japonais comptent comme les autres :
残酷な天使のテーゼ se joue, s'affiche, se devine et donne ses indices comme
Billie Jean, en kana ou en kanji, pleine chasse ou demi-chasse. Le titre
garde sa graphie d'origine, mais **l'artiste s'affiche en lettres romaines**
quand on le connaît — « 残酷な天使のテーゼ — Yoko Takahashi (Neon Genesis
Evangelion) ». Au clavier, les deux graphies comptent : « a cruel angels
thesis » vaut autant que 残酷な天使のテーゼ, et l'indice donne le nombre de
lettres de la version romaine, celle qu'on peut taper.
**Indices** : nombre de lettres à mi-temps, première lettre dans les 10
dernières secondes.

## Scoring

| Trouvé | Points |
|---|---|
| Titre | 500 × vitesse × précision |
| Artiste | 500 × vitesse × précision |
| Les deux dans la manche | +200 |
| Premier sur le titre / l'artiste | +100 |

La vitesse décroît linéairement de 1.0 (immédiat) à 0.3 (dernière seconde).
La précision vaut 100 % pour la réponse exacte, 90 % avec une faute de frappe
ou les mots dans le désordre, 70 % pour un seul mot significatif ; en mode
titre + artiste on peut donner l'un puis l'autre, et préciser une réponse
approximative rapporte la différence.
Un titre déjà entendu ne revient pas, même après un changement de playlist ou
un redémarrage de l'appli ; le lobby indique combien de titres ont déjà été
joués. Quand tout a été entendu, l'historique de la playlist repart de zéro.
À la révélation, c'est la pochette du titre qui s'affiche (celle de l'extrait
trouvé si la playlist n'en fournit pas), pas celle de la playlist.
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
- `src/works.js` : reconnaît le film, la série ou l'anime d'un titre — mention
  « from … » du titre et sa forme japonaise (« 「Steins;Gate」より »,
  « TVアニメ『東京喰種』 »), nom de l'album, puis `src/works.json`, une table de
  8 500 génériques embarquée, chacun avec son interprète — c'est lui qui
  tranche, un titre courant ne prend jamais l'œuvre d'un homonyme. Un
  générique y figure sous chaque graphie connue : 残酷な天使のテーゼ comme
  Zankoku na Tenshi no Thesis mènent à Neon Genesis Evangelion.
  `npm run works` la régénère depuis Wikidata
  (films et séries, œuvres ayant au moins deux versions linguistiques, libellés
  japonais compris) et [animethemes.moe](https://animethemes.moe) (animes, en
  romaji seulement : un opening que seul animethemes connaît ne se reconnaît
  pas sous sa graphie japonaise) ; en cas de conflit Wikidata, plus notoire,
  l'emporte. Sur une playlist de bandes originales, une dernière passe
  interroge Deezer puis Apple Music pour les titres encore muets, et garde le
  résultat en cache.
- `src/romaji.js` : les graphies en lettres romaines (`src/romaji.json`, relevé
  sur Wikidata par le même `npm run works`) — 13 000 chanteurs, seiyuu et
  groupes japonais, et un millier de titres. L'artiste lisible passe devant à
  l'affichage, dans le QCM et dans les indices ; le titre garde sa graphie
  d'origine à l'écran mais donne ses indices en lettres romaines, et **les deux
  graphies valent une bonne réponse**. Ce dictionnaire sert aussi à retrouver
  l'œuvre : `紅蓮の弓矢` mène à `Guren no Yumiya`, donc à Shingeki no Kyojin.
  L'interprète reste le juge, donc une graphie approximative ne peut pas
  inventer une œuvre. Quand une œuvre est connue sous les deux graphies, c'est
  la latine qui s'affiche.
- `android/` : l'appli (Kotlin), qui embarque Node via
  [nodejs-mobile](https://github.com/nodejs-mobile/nodejs-mobile) et affiche la
  salle dans une WebView. L'APK est construit et signé par GitHub Actions à
  chaque changement, publié dans la release `apk`, et l'appli propose
  elle-même ses mises à jour.
- `docs/` : la page d'installation (GitHub Pages), générée par `npm run pages`.
- `public/icons.svg` : les icônes [Lucide](https://lucide.dev) (licence ISC),
  regroupées par `npm run sprite`, qui génère aussi celles du menu Android.

```bash
npm test        # matching, indices, œuvres, tables, QR code, extraits, partie, salles
npm start       # le serveur sur un ordinateur, pour développer (voir .env.example)
```

Node 22 (voir `.nvmrc`) : en dessous de 20, `npm run lint` ne démarre pas.
`test/tables.test.js` relit `works.json` et `romaji.json` à chaque `npm test` et
échoue si une clé n'est plus atteignable — c'est le garde-fou qui prévient
qu'un changement dans `normalize()` vient d'invalider les tables et qu'il faut
relancer `npm run works`.
