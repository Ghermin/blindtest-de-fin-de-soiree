# Installation pas à pas

Le jeu tourne sur **ton téléphone Android**, dans l'appli Blind Test. Rien à
installer chez les invités : ils scannent un QR code. Rien à installer sur la
TV : son navigateur ouvre une adresse.

## 1. Installer une fois (2 min)

1. Sur le téléphone, ouvre **https://ghermin.github.io/blindtest-de-fin-de-soiree/**
   et touche **Télécharger l'appli (APK)**. Android demande d'autoriser ce
   navigateur à installer des applis : accepte, puis **Installer**.
2. Lance **Blind Test**. Choisis un **code hôte** (les chiffres qui te donnent
   la main sur ce téléphone), touche **C'est parti**.
3. Accepte **« Toujours autoriser en arrière-plan »** : sinon Android coupe le
   serveur quand l'écran s'éteint.

L'appli se met à jour toute seule : le contenu du jeu à chaque lancement, et
l'appli elle-même te propose d'installer la nouvelle version quand il y en a
une (aussi dans **Paramètres → Appli → Mettre à jour l'appli**, le bouton
« … » en bas à gauche).

## 2. À chaque soirée (30 s)

1. Connecte ton téléphone au Wi-Fi du lieu, ou active ton **partage de
   connexion** et fais-y connecter la TV et les invités. Évite le réseau invité
   d'une box, qui isole souvent les appareils entre eux.
2. Ouvre **Blind Test** : la salle s'affiche, déjà en mode hôte (le bouton
   engrenage en bas à droite est là). Pseudo → **Rejoindre**.
3. Sur la TV, ouvre le navigateur et tape l'adresse du cadre **Écran TV**
   du lobby (par exemple `192.168.1.23:3000/r/MAISON/tv`). Elle est aussi
   dans **Paramètres**, avec un bouton pour la copier. Valide
   **Activer le son** avec la télécommande. Mets la page en favori. Le
   thème clair ou sombre suit celui de chaque appareil ; sur la TV, le bouton
   soleil ou lune, en haut du classement, le change.
4. Les invités scannent le QR code (dans le lobby de ton téléphone ou sur la
   TV), entrent un pseudo et, s'ils veulent, rejoignent une équipe existante
   d'un tap ou en créent une.
5. Bouton engrenage → colle un lien ou tape un nom de playlist → **OK** →
   choisis dans la liste → **Lancer**. Le panneau se ferme d'un glissement
   vers le bas, d'un tap à côté ou avec la croix. Pas de bouton engrenage
   (page ouverte depuis le QR code, autre navigateur) ? **Je suis l'hôte** →
   ton code, sur l'écran de connexion ou dans le lobby.
6. Sur le podium : **Rejouer** relance avec les mêmes réglages,
   **Modifier la partie** ramène au lobby avec le panneau ouvert.
7. Pendant la partie, une barre en haut du téléphone : **Pause** (chrono,
   indices et extrait gelés partout ; un grand bouton lecture au milieu de
   l'écran pour reprendre), **Passer**, **Terminer** (podium), **Lobby**.
8. Les réglages du panneau (manches, durée, titre ou artiste, **clavier ou
   QCM**, **chacun pour soi ou un téléphone par équipe**, indices) s'appliquent
   tout de suite et s'affichent à tous dans le lobby. En QCM, quatre
   propositions à toucher et une seule réponse par manche. En mode équipe,
   chaque téléphone entre le nom de son équipe et tout le monde répond dessus.
9. Toujours dans le panneau hôte : la liste des **Joueurs** (déplacer dans une
   équipe, retirer quelqu'un qui a oublié de quitter), les **Équipes** (créer,
   renommer, supprimer), **Remettre les scores à zéro** et **Vider la salle**
   pour repartir de zéro. Le bouton **…** en bas à gauche ouvre les
   **Paramètres**, qui regroupent ce qui concerne l'appli : mise à jour,
   réglages, son sur ce téléphone, installation sur un autre téléphone, clé
   hôte.

Pour tester tout de suite, une playlist Deezer publique :
`https://www.deezer.com/fr/playlist/1743878062` (Soirée 80), ou tape « années
80 » dans le champ.

Sans écran pour la TV : **Paramètres → Son sur ce téléphone : oui**
et une enceinte Bluetooth sur ton téléphone.

La notification « Blind Test » reste affichée tant que la partie peut être
jouée ; **Arrêter** dessus (ou **Paramètres → Appli → Arrêter le serveur**)
coupe le serveur.

## 3. Les playlists

Rien à configurer : le champ du panneau hôte accepte le lien de n'importe
quelle playlist **publique** Spotify (éditoriales comprises) ou Deezer, et un
nom à chercher (« années 80 », « rap français ») qui interroge Deezer. Pour
Spotify, le jeu lit la page publique du lecteur intégré : elle donne les **100
premiers titres** et leurs extraits, et peut changer sans préavis. Les
playlists Deezer publiques passent toutes, en entier.

## 4. Installer sur un autre téléphone (l'hôte d'une autre maison)

Envoie-lui **https://ghermin.github.io/blindtest-de-fin-de-soiree/** ou, depuis
ta salle, **Paramètres → Installer sur un autre téléphone** : la page
affiche un QR code à scanner. L'autre téléphone (Android) télécharge l'appli,
choisit son code hôte, et a exactement la même chose que toi.

## Si ça coince

| Problème | Solution |
|---|---|
| Les invités ne voient pas la page | Même Wi-Fi que ton téléphone, pas le réseau invité ; sinon ton partage de connexion |
| La partie se coupe écran éteint | Paramètres → Applications → Blind Test → Batterie → Non restreinte |
| L'appli reste sur « Démarrage du serveur… » | Bouton **⋯** de l'écran de démarrage → **Arrêter et quitter**, puis relance l'appli |
| « Recherche des extraits en cours » | Patiente, le compteur avance dans le panneau hôte |
| « Pas assez d'extraits trouvés » | Titres trop rares : essaie la même playlist côté Deezer |
| « Playlist Spotify introuvable ou privée » | Vérifie le lien, et que la playlist est bien publique dans Spotify ; sinon la même playlist côté Deezer |
| Une playlist Spotify s'arrête à 100 titres | Limite de la page publique de Spotify : prends la même playlist côté Deezer, lue en entier |
| Pas de son sur l'écran TV | **Activer le son** sur cet écran (les navigateurs exigent un geste) |
| Deux appareils jouent le son | Désactive **Son sur ce téléphone** dans Paramètres |
| « Clé hôte incorrecte » | C'est le code hôte choisi dans les réglages de l'appli |
| Pas reconnu comme hôte | Ouvre la salle dans l'appli (elle porte la clé), ou **Je suis l'hôte** → ton code |
| La mise à jour de l'appli ne s'installe pas | La première fois, Android demande d'autoriser Blind Test à installer des applis (**Paramètres**, active l'option) et Play Protect propose une analyse (**Installer sans analyser** convient) ; relance ensuite **Paramètres → Appli → Mettre à jour l'appli** |
