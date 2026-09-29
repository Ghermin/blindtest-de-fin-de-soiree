# Installation pas à pas 📱

Le jeu tourne sur **ton téléphone Android**. Rien à installer chez les
invités : ils scannent un QR code. Rien à installer sur la TV : son navigateur
ouvre une adresse.

## 1. Installer une fois (5 min)

### Ce qu'il faut

- Un **Android** (un iPhone ne peut pas héberger le jeu).
- Un **jeton GitHub** en lecture seule sur ce dépôt privé, pour télécharger le
  jeu et ses mises à jour : https://github.com/settings/personal-access-tokens/new
  → nom `blindtest-phone`, expiration la plus longue, **Only select
  repositories** → `blindtest-de-fin-de-soiree`, **Repository permissions →
  Contents : Read-only**, **Generate token**. Copie-le (`github_pat_…`).

### Les étapes

1. Installe **Termux** depuis F-Droid (https://f-droid.org/packages/com.termux/)
   ou ses versions GitHub, pas celui du Play Store, abandonné. Installe aussi
   **Termux:Widget** (même source) pour le raccourci d'écran d'accueil.
2. Ouvre Termux et colle, en remplaçant `github_pat_xxx` par ton jeton :

   ```
   T=github_pat_xxx
   curl -fsSL -H "Authorization: token $T" https://raw.githubusercontent.com/Ghermin/blindtest-de-fin-de-soiree/main/deploy/termux.sh -o termux.sh && GITHUB_TOKEN=$T bash termux.sh
   ```

   Le script télécharge Node et le jeu, puis demande ton **code hôte** (les
   chiffres pour prendre la main depuis ton téléphone) et, si tu en as, les
   identifiants Spotify (Entrée pour passer, voir plus bas).
3. Android : **Paramètres → Applications → Termux → Batterie → Non restreinte**,
   sinon Android tue le serveur écran éteint.
4. Écran d'accueil : appui long → **Widgets** → **Termux:Widget** → pose le
   raccourci, il liste **Blind Test**.

## 2. À chaque soirée (30 s)

1. Connecte ton téléphone au Wi-Fi du lieu, ou active ton **partage de
   connexion** et fais-y connecter la TV et les invités. Évite le réseau invité
   d'une box, qui isole souvent les appareils entre eux.
2. Touche **Blind Test** (ou tape `blindtest` dans Termux). Termux se met à
   jour si besoin, affiche l'adresse de la salle, ton code hôte et un QR code,
   puis **Chrome s'ouvre sur ta salle**. Laisse Termux en arrière-plan.
3. Sur la TV, ouvre le navigateur, tape l'adresse « Écran TV » affichée dans
   Termux (par exemple `http://192.168.1.23:3000/r/MAISON/tv`), valide
   **Activer le son** avec la télécommande. Mets la page en favori.
4. Les invités scannent le QR code (dans Termux, dans le lobby de ton
   téléphone ou sur la TV), entrent un pseudo et une équipe s'ils veulent.
5. Toi, dans Chrome : pseudo → **Rejoindre** → **Je suis l'hôte** → ton code →
   manette 🎛️ → playlist → **▶ Lancer**. Oublié « Je suis l'hôte » ? Le lien
   est aussi dans le lobby, à côté de « Changer de pseudo ».
6. Sur le podium : **🔁 Rejouer** relance avec les mêmes réglages,
   **⚙️ Modifier la partie** ramène au lobby avec le panneau ouvert (playlist,
   manches, durée, indices).

Pour tester tout de suite, une playlist Deezer publique :
`https://www.deezer.com/fr/playlist/1743878062` (Soirée 80).

Sans écran pour la TV : **🔈 Son sur ce téléphone : oui** dans le panneau hôte
et une enceinte Bluetooth sur ton téléphone.

## 3. Spotify (optionnel, 5 min, une seule fois)

Sans rien configurer, tu peux coller le lien de n'importe quelle playlist
Spotify **publique** (éditoriales comprises) ou Deezer. Pour Spotify, le jeu lit
la page publique du lecteur intégré : elle donne les **100 premiers titres** et
leurs extraits. Les identifiants d'une app Spotify ajoutent la **recherche de
playlists** dans le panneau hôte et, avec ton compte connecté, **Mes
playlists** (privées comprises, en entier si tu les possèdes).

1. https://developer.spotify.com/dashboard → **Create app** : nom `Blind Test`,
   description `blind test maison`, **Redirect URIs** :
   `http://127.0.0.1:3000/auth/spotify/callback` (clique **Add**), **Web API**
   coché, **Save**. Dans **Settings**, copie le **Client ID** et le secret.
   Spotify exige un abonnement Premium sur le compte qui crée l'app.
2. Dans Termux : `bash ~/blindtest/deploy/termux.sh`, Entrée sur le code hôte,
   colle le Client ID puis le secret.
3. Dans le panneau hôte de ta salle : **🎧 Connecter mon compte Spotify** →
   Spotify demande l'autorisation → tu reviens dans ta salle. Le bouton
   **📚 Mes playlists** liste alors tes playlists, privées comprises.

Seul ton téléphone peut connecter le compte (l'adresse de retour est locale).
Les invités n'ont rien à faire. L'autorisation dure 6 mois, puis le panneau
hôte te redemande de connecter le compte.

**Règle Spotify (mars 2026)** : l'API officielle ne livre les titres complets
que des playlists **que tu possèdes** ou auxquelles tu collabores. Pour les
autres, le jeu passe par la page publique du lecteur intégré, limitée aux 100
premiers titres et susceptible de changer sans préavis. Si une playlist suivie
de plus de 100 titres te manque, copie-la dans Spotify (⋮ → **Ajouter à une
playlist** → **Nouvelle playlist**) et charge la copie. Les playlists Deezer
publiques passent toutes, en entier.

## Si ça coince

| Problème | Solution |
|---|---|
| Les invités ne voient pas la page | Même Wi-Fi que ton téléphone, pas le réseau invité ; sinon ton partage de connexion |
| La partie se coupe écran éteint | Termux → Batterie → Non restreinte, et garde Termux ouvert en arrière-plan |
| « Impossible d'accéder au dépôt » | Jeton absent, expiré ou sans la permission Contents : refais-en un et relance l'installation |
| « Pas de mise à jour (hors ligne ou jeton expiré) » | Le jeu se lance quand même ; refais un jeton quand tu veux |
| « Recherche des extraits en cours » | Patiente, le compteur avance dans le panneau hôte |
| « Pas assez d'extraits trouvés » | Titres trop rares : essaie la même playlist côté Deezer |
| « Playlist Spotify introuvable ou privée » | Vérifie le lien ; la playlist privée d'un autre compte est inaccessible : Deezer, ou une copie dans ton compte |
| Une playlist Spotify s'arrête à 100 titres | Limite de la page publique : copie-la dans Spotify (⋮ → Ajouter à une playlist → Nouvelle playlist) et charge la copie avec ton compte connecté |
| « Spotify a expiré l'autorisation » | Reconnecte ton compte dans le panneau hôte, Spotify coupe l'accès au bout de 6 mois |
| Pas de son sur l'écran TV | **Activer le son** sur cet écran (les navigateurs exigent un geste) |
| Deux appareils jouent le son | Désactive **Son sur ce téléphone** dans le panneau hôte |
| « Clé hôte incorrecte » | C'est le code hôte affiché au lancement dans Termux |
| Chrome s'ouvre sur une salle vide | Rejoins avec ton pseudo, puis **Je suis l'hôte** |
| Spotify : « INVALID_CLIENT: Invalid redirect URI » | Ajoute `http://127.0.0.1:3000/auth/spotify/callback` dans les Redirect URIs de ton app Spotify |
