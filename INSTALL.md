# Installation pas à pas 🍓

Deux façons d'héberger le jeu, au choix ou les deux :

- **Le téléphone hôte** (Android) : le jeu tourne sur ton téléphone, les
  invités et la TV s'y connectent. Marche partout, chez toi comme chez la
  famille. C'est le **bloc T**, cinq minutes.
- **Le Raspberry Pi** à la maison, toujours allumé : blocs A, B, C.

---

## Bloc T : le téléphone hôte comme serveur (Android)

### Ce qu'il faut savoir

- Il faut un **Android**. Un iPhone ne peut pas héberger le jeu.
- Tout le monde doit être sur **le même réseau** : le Wi-Fi de la maison
  visitée, ou le **partage de connexion** de ton téléphone (les invités et la
  TV s'y connectent, les extraits passent alors par ta 4G).
- Sur le Wi-Fi d'une box, évite le **réseau invité** : il isole souvent les
  appareils entre eux et les invités ne verraient pas ton téléphone.
- Ton téléphone reste allumé et connecté pendant la partie ; tu joues dessus
  normalement, le serveur tourne en arrière-plan.

### Étape T1 — Installer une fois (5 min)

1. Installe **Termux** depuis F-Droid : https://f-droid.org/packages/com.termux/
   (pas celui du Play Store, il est abandonné). Ouvre-le une première fois.
2. Dans Termux, colle ces deux lignes en remplaçant `github_pat_xxx` par ton
   jeton GitHub (voir « Le jeton GitHub » plus bas si tu n'en as pas) :

   ```
   T=github_pat_xxx
   curl -fsSL -H "Authorization: token $T" https://raw.githubusercontent.com/Ghermin/blindtest-de-fin-de-soiree/main/deploy/termux.sh -o termux.sh && GITHUB_TOKEN=$T bash termux.sh
   ```

   Le script installe Node, télécharge le jeu, demande ton **code hôte** et,
   si tu en as, les identifiants Spotify (Entrée pour passer, les playlists
   Deezer suffisent).
3. Android : **Paramètres → Applications → Termux → Batterie → Non restreinte**,
   sinon Android tue le serveur au bout de quelques minutes d'écran éteint.
4. Optionnel : l'appli **Termux:Widget** (F-Droid) donne un bouton
   « Blind Test » sur l'écran d'accueil.

### Étape T2 — À chaque soirée (30 s)

1. Connecte ton téléphone au Wi-Fi du lieu, ou active ton partage de connexion
   et fais-y connecter la TV et les invités.
2. Ouvre Termux et tape `blindtest` (ou le widget). L'écran affiche l'adresse
   de la salle, le code hôte et un **QR code**. Laisse Termux ouvert, il peut
   passer en arrière-plan.
3. Sur la TV, ouvre le navigateur, tape l'adresse « Écran TV » affichée
   (par exemple `http://192.168.1.23:3000/r/MAISON/tv`), valide **Activer le
   son**. La TV affiche le jeu et joue les extraits.
4. Les invités scannent le QR code (dans Termux ou sur la TV), entrent un
   pseudo. Toi : la même adresse dans Chrome sur ton téléphone → **Je suis
   l'hôte** → code hôte → playlist → **▶ Lancer**.

Sans smart TV mais avec un Chromecast : ton téléphone ne peut pas y envoyer la
page tout seul. Un autre téléphone ou une tablette, qui ne joue pas, ouvre
l'adresse « Écran TV » et **diffuse son écran** vers le Chromecast (Google
Home → Diffuser l'écran) : la TV montre le jeu et le son suit. Ou un portable
avec Chrome : menu ⋮ → **Caster…** → **Caster l'onglet**.

Pour arrêter : Ctrl+C dans Termux, ou ferme Termux. Le jeu se met à jour tout
seul au lancement suivant si le téléphone a Internet.

---

## Le Raspberry Pi à la maison

Trois blocs, dans l'ordre. Seul le premier est obligatoire.

| Bloc | Quoi | Durée | Il te faut |
|---|---|---|---|
| **A** | Le jeu à la maison | 5 min | le Pi allumé sur ton réseau, ton téléphone |
| **B** | Le jeu et la musique sur la TV | 2 à 15 min | un écran qui ouvre une page web, ou un Chromecast |
| **C** | L'accès famille | 20 min | un nom de domaine géré par Cloudflare |

> ℹ️ Tout se fait dans un terminal sur le Pi, en répondant à un assistant.
> Ensuite le jeu tourne en permanence sur le Pi (il démarre avec lui, se met à
> jour tout seul, jamais pendant une partie) et **tout se pilote depuis ton
> téléphone**. Pas besoin de Spotify Premium, ni pour toi ni pour la famille.

---

## Avant de rentrer (depuis n'importe quel PC)

### Le jeton GitHub du dépôt privé (2 min, obligatoire)

Le dépôt est privé : le Pi a besoin d'un jeton en lecture seule pour
télécharger le jeu et se mettre à jour.

1. https://github.com/settings/personal-access-tokens/new (Settings → Developer
   settings → Fine-grained tokens → **Generate new token**).
2. **Token name** `blindtest-pi`, **Expiration** : la durée la plus longue
   proposée, **Repository access** : **Only select repositories** →
   `blindtest-de-fin-de-soiree`.
3. **Permissions** → **Repository permissions** → **Contents** : **Read-only**.
   Rien d'autre. **Generate token**.
4. Copie le jeton (il commence par `github_pat_`), tu ne le reverras pas.

📝 Garde-le sous la main, il va dans la commande de l'étape 1. À son
expiration, le jeu continue de tourner, seule la mise à jour automatique
s'arrête : relance l'étape 1 avec un nouveau jeton.

### Si tu veux coller des playlists Spotify : une app Spotify (5 min, optionnel)

Les playlists **Deezer** marchent sans rien. Pour accepter aussi les liens de
playlists **Spotify**, le serveur a besoin des identifiants d'une app Spotify :

1. https://developer.spotify.com/dashboard → connecte-toi → **Create app**.
2. **App name** `Blind Test`, **App description** `blind test maison`,
   **Redirect URIs** `http://127.0.0.1:8888/callback` (obligatoire dans le
   formulaire, inutilisé), **Web API** coché, **Save**.
3. **Settings** → copie le **Client ID** et, via **View client secret**, le secret.

📝 Garde-les sous la main, l'assistant les demande. Seules les playlists
**publiques** faites par des utilisateurs sont lisibles, pas celles créées par
Spotify (Top 50, Années 80…). Côté Deezer, toutes les playlists publiques
passent, y compris celles de Deezer.

### Si tu veux le bloc C : un domaine chez Cloudflare

1. Compte gratuit sur https://dash.cloudflare.com.
2. Ajoute un domaine : acheté chez Cloudflare (quelques euros par an) ou
   transféré depuis ton registrar (deux serveurs de noms à renseigner, quelques
   heures de propagation).
3. Note les e-mails des membres de la famille pour l'étape d'accès.

---

## À la maison — Bloc A : le jeu

### Étape 1 — Une commande sur le Pi

Depuis ton PC, ouvre un terminal (PowerShell sur Windows) et connecte-toi au Pi :

```
ssh pi@raspberrypi.local
```

> Si `raspberrypi.local` ne répond pas, utilise l'adresse IP du Pi (visible
> dans l'interface de ta box). Adapte aussi `pi` si ton utilisateur s'appelle
> autrement.

Sur le Pi, lance ces deux lignes en remplaçant `github_pat_xxx` par ton jeton :

```
T=github_pat_xxx
curl -fsSL -H "Authorization: token $T" https://raw.githubusercontent.com/Ghermin/blindtest-de-fin-de-soiree/main/deploy/install.sh -o /tmp/install.sh && sudo GITHUB_TOKEN=$T bash /tmp/install.sh
```

Ça enregistre le jeton pour les mises à jour (dans `/root/.git-credentials`,
lisible par root seulement), installe Node 22 si besoin, met le jeu dans
`/opt/blindtest`, crée le service, puis **l'assistant démarre tout seul**.

> Si tu passes un jour le dépôt en public, la même commande marche sans le
> jeton : `curl -fsSL <url> -o /tmp/install.sh && sudo bash /tmp/install.sh`.

### Étape 2 — Répondre à l'assistant

Entrée garde la valeur proposée entre crochets. Tu peux tout relancer plus tard
avec `sudo /opt/blindtest/deploy/setup.sh`.

1. **Code hôte** : les chiffres que tu taperas sur ton téléphone pour prendre
   la main. Garde celui proposé ou choisis le tien.
2. **Client ID / Client secret Spotify** : colle-les si tu les as, sinon Entrée
   (les playlists Deezer suffisent).
3. **Ouvrir le jeu à la famille ?** `N` pour l'instant si tu n'as pas encore de
   domaine (bloc C). Sinon `o` et suis le bloc C.
4. **Le Pi est-il branché en HDMI sur une TV ?** `N` sans câble HDMI.

L'assistant démarre le jeu et affiche :

```
✅ C'est prêt !
  Adresse à la maison      : http://192.168.1.42:3000
  Ta salle                 : http://192.168.1.42:3000/r/MAISON
  Écran TV (navigateur)    : http://192.168.1.42:3000/r/MAISON/tv
  Ton code hôte            : 1234
```

suivi d'un **QR code dans le terminal** : scanne-le avec ton téléphone, tu es
dans ta salle.

### Étape 3 — Première partie, tout seul (2 min)

1. Dans ta salle : pseudo → **Rejoindre** → **« Je suis l'hôte 🎛️ »** → ton code.
2. Manette en bas à droite → colle un lien de playlist et **Charger**. Pour
   tester tout de suite, une playlist Deezer publique :
   `https://www.deezer.com/fr/playlist/1743878062` (Soirée 80).
   Avec une playlist Spotify, le panneau affiche « recherche des extraits
   12/95… » quelques secondes, puis « extraits prêts ».
3. **Le son** : ouvre `http://192.168.1.42:3000/r/MAISON/tv` sur n'importe quel
   écran (PC, tablette, TV) et clique **Activer le son**. Ou, sans écran,
   **🔈 Son sur ce téléphone : oui** dans le panneau hôte.
4. **▶ Lancer**. Décompte, extrait, tu tapes une réponse, révélation, podium.

Sur ton téléphone, ajoute le jeu à l'écran d'accueil pour avoir une icône :
Chrome → menu ⋮ → **Ajouter à l'écran d'accueil** (Safari → Partager → **Sur
l'écran d'accueil**). Le soir venu, les invités scannent le QR code du lobby ou
de la TV, entrent un pseudo et une équipe s'ils veulent.

🎉 Le bloc A est fini.

---

## Bloc B : le jeu et la musique sur la TV

L'écran de la salle (`/r/MAISON/tv`) affiche le QR code, le classement, le
chrono, les indices, la révélation, le podium, **et joue les extraits**. Rien
de tes saisies n'y apparaît. Trois façons de l'avoir sur la TV :

### Méthode 1 — Le navigateur de la smart TV (2 min, gratuit, recommandé)

1. Sur la TV, ouvre le navigateur (Samsung, LG, Android TV, Fire TV…) et tape
   `http://192.168.1.42:3000/r/MAISON/tv` (chez la famille : l'adresse HTTPS
   de sa salle suivie de `/tv`). Mets la page en favori ou en page d'accueil.
2. La page affiche **Activer le son sur cet écran** : pointe le bouton avec la
   télécommande et valide. Les navigateurs exigent ce geste une fois.
3. Passe le navigateur en plein écran si la TV le propose, et laisse la page
   ouverte : elle suit la partie toute seule, manche après manche.

Ça marche sur les TV de 2019 et après. Sur une plus ancienne, le navigateur
peut refuser la page : une tablette, un vieux téléphone ou un portable branché
à la TV ouvrent la même adresse. Depuis Chrome sur un portable, tu peux aussi
envoyer l'onglet à un Chromecast : menu ⋮ → **Caster…** → **Caster l'onglet**
(le son suit). Chez la famille avec Cloudflare Access, la TV demande une fois
le code reçu par e-mail.

### Méthode 2 — Caster depuis ton téléphone Android (le bouton 📺)

Le téléphone de l'hôte demande au Chromecast d'afficher lui-même l'écran du
jeu, avec le son, puis reste libre pour jouer. Ça marche pareil chez toi et
chez la famille. Il faut le bloc C (le Chromecast charge la page par l'adresse
HTTPS) et un enregistrement chez Google, une seule fois, 5 $ :

1. https://cast.google.com/publish → connecte-toi avec ton compte Google, paie
   les frais d'inscription développeur Cast.
2. **Add new application** → **Custom Receiver** : **Name** `Blind Test`,
   **Receiver Application URL** `https://blindtest.ton-domaine.fr/cast`, **Save**.
   Note l'**Application ID** (8 caractères).
3. **Publish** : disponible sur tous les Chromecast au bout de quelques minutes.
4. Sur le Pi : `sudo /opt/blindtest/deploy/setup.sh`, `o` à la famille, Entrée
   pour garder le domaine, colle l'**Application ID** à la question Cast.

Dans le panneau hôte apparaît **📺 Caster sur la TV** (Chrome sur Android ou
PC ; jamais sur iPhone). La TV affiche « En attente du téléphone… » une seconde
puis le jeu, son compris.

### Méthode 3 — Un jour, un câble HDMI pour le Pi

`sudo /opt/blindtest/deploy/tv-setup.sh` lance l'écran de la salle en plein
écran au démarrage du Pi, son par le HDMI. Chez toi uniquement.

---

## Bloc C : ouvrir le jeu à la famille

### Étape 4 — Le tunnel, via l'assistant

Sur le Pi :

```
sudo /opt/blindtest/deploy/setup.sh
```

Entrée sur les questions déjà remplies, puis `o` à **Ouvrir le jeu à la
famille** et tape ton domaine complet, par exemple `blindtest.ton-domaine.fr`.

L'assistant installe `cloudflared`. À la première fois il affiche une adresse
`https://dash.cloudflare.com/argotunnel?...` : **ouvre-la sur ton PC ou ton
téléphone**, choisis ton domaine, valide. Le reste est automatique. À la fin :
« Tunnel prêt : https://blindtest.ton-domaine.fr ».

### Étape 5 — Réserver l'adresse à la famille (recommandé, 5 min)

Sans cette étape, quiconque devine l'adresse peut jouer. Avec, chacun prouve
son e-mail par un code à usage unique, une fois par navigateur.

1. https://one.dash.cloudflare.com → choisis un nom d'équipe si on te le demande
   (plan **Free**, jusqu'à 50 utilisateurs ; une carte peut être demandée à
   l'inscription sans être débitée).
2. **Access** → **Applications** → **Add an application** → **Self-hosted**.
3. Application name `Blind Test`, domaine `blindtest.ton-domaine.fr`, **Next**.
4. Policy : nom `Famille`, action **Allow**, règle **Emails** avec les adresses
   de toute la famille. **Next**, **Add application**.

### Étape 6 — Test depuis la 4G

Sur ton téléphone, WiFi coupé : `https://blindtest.ton-domaine.fr`. Tu passes le
contrôle Cloudflare (code reçu par e-mail), tu arrives sur la page d'accueil.
**Créer une salle**, pseudo, playlist, écran TV sur `/r/TONCODE/tv` ou bouton
📺, **▶ Lancer**.

### Ce que fait un membre de la famille chez lui

1. Il ouvre `https://blindtest.ton-domaine.fr`, entre son e-mail, tape le code reçu.
2. **Créer une salle** → pseudo → **Rejoindre** → **Je suis l'hôte**.
3. Panneau 🎛️ → colle une playlist Spotify ou Deezer → attend « extraits prêts ».
4. Pour la TV : **📺 Caster sur la TV** depuis Android, ou n'importe quel écran
   sur `/r/SONCODE/tv` avec **Activer le son**. Sans écran : **Son sur ce
   téléphone** et une enceinte.
5. **▶ Lancer**. Ses invités scannent le QR code de son lobby ou de sa TV.

Sa salle, ses scores et sa musique sont indépendants des tiens. Aucun compte,
aucune installation chez lui. Une salle sans activité pendant 6 h disparaît.

---

## Vérification finale

| À voir | Où |
|---|---|
| `✅ C'est prêt !` et le QR code | à la fin de l'assistant |
| `active (running)` | `systemctl status blindtest` |
| La page d'accueil avec **Salle de la maison** | `http://<ip-du-pi>:3000` sur le téléphone |
| « extraits prêts » après le chargement d'une playlist | panneau hôte |
| L'extrait qui joue au ▶ Lancer | sur l'écran TV ou le téléphone de l'hôte |
| Bloc B : le jeu sur la TV, pas tes saisies | `/r/MAISON/tv` ou 📺 Caster |
| Bloc C : la page d'accueil depuis la 4G | `https://blindtest.ton-domaine.fr` |

---

## Si ça coince

| Problème | Solution |
|---|---|
| Téléphone hôte : les invités ne voient pas la page | Même Wi-Fi que le téléphone, pas le réseau invité de la box ; sinon partage de connexion du téléphone |
| Téléphone hôte : la partie se coupe écran éteint | Termux → Batterie → Non restreinte, et garde Termux ouvert en arrière-plan |
| « Recherche des extraits en cours » | Patiente : le compteur avance dans le panneau hôte |
| « Pas assez d'extraits trouvés » | Titres trop rares : essaie la même playlist côté Deezer |
| « Playlist introuvable » | Playlist créée par Spotify (Top 50…) ou privée : playlist publique perso, ou Deezer |
| « Playlists Spotify indisponibles » | Pas d'identifiants Spotify : lien Deezer, ou relance l'assistant |
| Pas de son sur l'écran TV | Clique **Activer le son** sur cet écran (les navigateurs exigent un geste) |
| Deux appareils jouent le son | Désactive **Son sur ce téléphone** dans le panneau hôte |
| La TV castée affiche le jeu mais reste muette | Monte le volume du Chromecast / de la TV |
| Le bouton **📺 Caster** n'apparaît pas | Chrome sur Android ou PC, l'Application ID Cast dans l'assistant, et le bloc C |
| « Clé hôte incorrecte » | C'est le code hôte de l'assistant, aussi dans `journalctl -u blindtest -n 20` |
| « Impossible d'accéder au dépôt » à l'installation | Jeton absent, expiré ou sans la permission Contents : refais le jeton et relance avec `GITHUB_TOKEN=` |
| « Mise à jour impossible : dépôt inaccessible » dans les logs | Le jeton a expiré : relance l'étape 1 avec un nouveau jeton |
| La page ne charge pas sur un téléphone | Même WiFi que le Pi (pas la 4G, pas le réseau invité), IP plutôt que `.local` |
| Le serveur a redémarré pendant la partie | Les scores sont conservés, la salle revient au lobby : l'hôte relance |
| Voir ce qui se passe | `journalctl -u blindtest -f` sur le Pi |
| Redémarrer le jeu | `sudo systemctl restart blindtest` |
| Mettre à jour | Automatique toutes les 30 min hors partie, ou `sudo /opt/blindtest/deploy/update.sh` |
