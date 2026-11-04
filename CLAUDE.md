# Bored Dev Playground

Ce projet fait partie du Bored Dev Playground : https://ghermin.github.io/ (repo `Ghermin/Ghermin.github.io`, en local `../bored-dev-playground`).
Sa page GitHub (`site/index.html` (gabarit ; `docs/` est généré par `npm run pages`, ne pas l'éditer à la main)) suit le kit commun du playground.

Avant de modifier la page ou le style, se demander si le changement est local ou global :

- **Global** (bandeau, cartes, boutons, puces, pied de page, couleurs neutres, comportement clair / sombre…) : ne pas le faire ici. `site/playground.css` est une copie de `kit/playground.css` du playground : modifier le kit là-bas, lancer `sh kit/sync.sh`, puis commiter dans chaque projet.
- **Local** (couleurs ou police du projet) : le faire dans la page, en redéfinissant les variables `--pg-*` après le kit.
- Si le nom, la description, les tags, l'icône ou l'adresse du projet changent, mettre à jour sa carte dans `index.html` du playground.
- Icônes (favicons, icônes Android et Windows, logo de la page) : générées par le playground à partir de `brand/icons/blindtest.svg` (`node build.js blindtest` dans `brand/`). Ne pas les redessiner ici : modifier le SVG là-bas, relancer, puis commiter dans les deux repos.

À garder sur la page : le bandeau `pg-strip` qui ramène au playground, le thème clair / sombre automatique, le responsive (pas de défilement horizontal sur mobile), 2 polices max (celle du projet + JetBrains Mono).

Après toute modification de `site/`, lancer `npm run pages` et commiter `docs/`.
