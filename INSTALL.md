# Installation pas à pas 🍓

Trois blocs, dans l'ordre. Seul le premier est obligatoire.

| Bloc | Quoi | Durée | Il te faut |
|---|---|---|---|
| **A** | Le jeu à la maison | 10 min | le Pi allumé sur ton réseau, ton compte Spotify Premium, une enceinte ou un Chromecast pour le son |
| **B** | Le jeu affiché sur la TV | 5 à 15 min | un Chromecast ou une Google TV, et le bloc C pour caster depuis le téléphone |
| **C** | L'accès famille | 20 min | un nom de domaine géré par Cloudflare |

> ℹ️ Le PC ne sert que pour l'installation, **une seule fois**, et même pas
> forcément : tout se fait dans un terminal sur le Pi, en répondant à un
> assistant. Ensuite le jeu tourne en permanence sur le Pi (il démarre avec
> lui, se met à jour tout seul, jamais pendant une partie) et **tout se pilote
> depuis ton téléphone**.

---

## Avant de rentrer (depuis n'importe quel PC)

### Étape 1 — Créer ton app Spotify (5 min, une seule fois)

1. Ouvre https://developer.spotify.com/dashboard et connecte-toi avec **ton compte Spotify habituel** (celui qui a Premium).
2. Accepte les conditions développeur si on te les propose, puis clique **Create app**.
3. Remplis :
   - **App name** : `Blind Test` (peu importe)
   - **App description** : `blind test maison`
   - **Redirect URIs** : colle exactement `http://127.0.0.1:8888/callback` puis clique **Add**
   - **Which API/SDKs are you planning to use?** : coche **Web API**
4. Coche la case des conditions, **Save**.
5. Sur la page de ton app, va dans **Settings** :
   - copie le **Client ID**
   - clique **View client secret** et copie-le aussi

📝 Garde ces deux valeurs sous la main (bloc-notes ou téléphone), l'assistant
te les demande à l'étape 3.

### Étape 1 bis — Si tu veux le bloc C : un domaine chez Cloudflare

1. Crée un compte sur https://dash.cloudflare.com (gratuit).
2. Ajoute un domaine : soit tu en achètes un directement chez Cloudflare
   (quelques euros par an), soit tu transfères les DNS d'un domaine que tu as
   déjà (Cloudflare te donne deux serveurs de noms à renseigner chez ton
   registrar, compte quelques heures de propagation).
3. Note les adresses e-mail **Spotify** des membres de la famille qui voudront
   être hôtes (celles de leur compte Spotify Premium). Les simples joueurs n'ont
   besoin de rien.

---

## À la maison — Bloc A : le jeu

### Étape 2 — Une commande sur le Pi

Depuis ton PC, ouvre un terminal (PowerShell sur Windows) et connecte-toi au Pi :

```
ssh pi@raspberrypi.local
```

> Si `raspberrypi.local` ne répond pas, utilise l'adresse IP du Pi (visible
> dans l'interface de ta box). Adapte aussi `pi` si ton utilisateur s'appelle
> autrement.

Sur le Pi, lance :

```
curl -fsSL https://raw.githubusercontent.com/Ghermin/blindtest-de-fin-de-soiree/main/deploy/install.sh -o /tmp/install.sh && sudo bash /tmp/install.sh
```

Ça installe Node 22 si besoin, met le jeu dans `/opt/blindtest`, crée le
service, puis **l'assistant démarre tout seul**.

### Étape 3 — Répondre à l'assistant

Entrée garde la valeur proposée entre crochets. Tu peux tout relancer plus tard
avec `sudo /opt/blindtest/deploy/setup.sh`.

1. **Client ID** puis **Client secret** : colle ce que tu as copié à l'étape 1
   (le secret ne s'affiche pas quand tu le colles, c'est normal).
2. **Code hôte** : les chiffres que tu taperas sur ton téléphone pour prendre
   la main. Garde celui proposé ou choisis le tien.
3. **Enceinte préférée** : le nom, même partiel, de l'appareil Spotify sur
   lequel la musique doit sortir (ex. `Salon`). Vide si tu veux choisir à chaque
   partie.
4. **Connexion de ton compte Spotify** : l'assistant affiche une adresse
   `https://accounts.spotify.com/authorize?...`.
   - Ouvre-la sur ton téléphone ou ton PC (tape-la, ou copie-la depuis le terminal).
   - Connecte-toi si besoin, clique **Accepter**.
   - Le navigateur affiche alors une page d'erreur « **site inaccessible** » :
     c'est **normal**, la page n'existe que pour transporter un code.
   - Copie l'adresse **complète** de cette page (touche la barre d'adresse →
     tout sélectionner → copier ; elle commence par `http://127.0.0.1:8888/callback?code=`).
   - Colle-la dans le terminal, Entrée. L'assistant affiche
     `✅ Compte Spotify connecté`.
5. **Ouvrir le jeu à la famille ?** Réponds `N` pour l'instant si tu n'as pas
   encore de domaine (bloc C, plus bas). Sinon `o` et suis le bloc C.
6. **Le Pi est-il branché en HDMI sur une TV ?** `N` (pas de HDMI : la TV se
   fait au bloc B).

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

### Étape 4 — Première partie, tout seul (2 min)

1. Sur ton téléphone, ouvre Spotify, lance n'importe quoi sur l'enceinte ou le
   Chromecast 5 secondes, puis mets pause : l'appareil est maintenant visible.
2. Dans ta salle : pseudo → **Rejoindre** → **« Je suis l'hôte 🎛️ »** → ton code.
3. Manette en bas à droite :
   - **📚 Mes playlists** (ou colle un lien de playlist Spotify) puis **Charger** ;
   - **🔊 Appareils Spotify** → choisis ta sortie ;
   - **▶ Lancer**.
4. Décompte, musique, tu tapes une réponse, révélation, podium.

Sur ton téléphone, ajoute le jeu à l'écran d'accueil pour avoir une icône :
Chrome → menu ⋮ → **Ajouter à l'écran d'accueil** (Safari → Partager → **Sur
l'écran d'accueil**). Le soir venu, les invités scannent le QR code du lobby et
entrent un pseudo (et une équipe s'ils veulent).

🎉 Le bloc A est fini.

---

## Bloc B : le jeu affiché sur la TV

La règle à connaître : **l'appareil qui affiche le jeu ne peut pas être celui
qui joue la musique**. Dès que Spotify envoie un titre à un Chromecast, il en
prend l'écran. Donc :

- **le son** sort sur une enceinte : ton téléphone relié à une enceinte
  Bluetooth (dans **Appareils Spotify**, choisis ton téléphone), une enceinte
  Spotify Connect, un Nest, une barre de son ;
- **l'image** (`/r/MAISON/tv` : QR code, classement, chrono, indices,
  révélation, podium, rien de tes saisies) arrive sur la TV par l'une des
  méthodes ci-dessous.

### Méthode 1 — Caster depuis ton téléphone Android (le bouton 📺)

C'est celle qui marche pareil chez toi et chez la famille : le téléphone de
l'hôte demande au Chromecast d'afficher lui-même l'écran du jeu, puis reste
libre pour jouer. Elle a besoin du bloc C (le Chromecast charge la page par
l'adresse HTTPS) et d'un enregistrement chez Google, une seule fois, 5 $ :

1. https://cast.google.com/publish → connecte-toi avec ton compte Google, paie
   les frais d'inscription développeur Cast.
2. **Add new application** → **Custom Receiver** :
   - **Name** : `Blind Test`
   - **Receiver Application URL** : `https://blindtest.ton-domaine.fr/cast`
   - **Save**. Note l'**Application ID** (8 caractères).
3. Clique **Publish** sur l'application : disponible sur tous les Chromecast
   au bout de quelques minutes, sans validation de Google.
4. Sur le Pi : `sudo /opt/blindtest/deploy/setup.sh`, réponds `o` à la famille,
   Entrée pour garder le domaine, colle l'**Application ID** à la question Cast.

Ensuite, dans le panneau hôte, un bouton **📺 Caster sur la TV** apparaît
(Chrome sur Android ou sur PC ; jamais sur iPhone, iOS ne sait pas caster une
page). La TV affiche « En attente du téléphone… » une seconde puis le jeu.

### Méthode 2 — N'importe quel autre écran, sans rien enregistrer

Une tablette ou un vieux téléphone posé sur la table, un portable, ou le
navigateur de la TV elle-même (Android TV, Fire TV) ouvre
`https://blindtest.ton-domaine.fr/r/MAISON/tv` (ou `http://<ip-du-pi>:3000/r/MAISON/tv`
à la maison). Depuis Chrome sur un portable : menu ⋮ → **Caster…** → **Caster
l'onglet** → le Chromecast.

### Méthode 3 — Un jour, un câble HDMI pour le Pi

`sudo /opt/blindtest/deploy/tv-setup.sh` fait du Pi à la fois l'écran et
l'enceinte (raspotify, son par le HDMI). Chez toi uniquement.

---

## Bloc C : ouvrir le jeu à la famille

### Étape 5 — Le tunnel, via l'assistant

Sur le Pi :

```
sudo /opt/blindtest/deploy/setup.sh
```

Entrée sur les questions déjà remplies, `N` pour ne pas reconnecter Spotify,
puis `o` à **Ouvrir le jeu à la famille** et tape ton domaine complet, par
exemple `blindtest.ton-domaine.fr`.

L'assistant installe `cloudflared`. À la première fois il affiche une adresse
`https://dash.cloudflare.com/argotunnel?...` : **ouvre-la sur ton PC ou ton
téléphone**, choisis ton domaine, valide. Le reste est automatique : création du
tunnel, DNS, service au démarrage, `.env` mis à jour, redémarrage du jeu.
À la fin : « Tunnel prêt : https://blindtest.ton-domaine.fr ».

### Étape 6 — Côté Spotify (2 min)

Dans https://developer.spotify.com/dashboard → ton app → **Settings** :

1. **Redirect URIs** : ajoute `https://blindtest.ton-domaine.fr/auth/spotify/callback`, **Add**, **Save**.
2. **User Management** : ajoute le nom et l'e-mail Spotify de chaque membre de
   la famille qui sera hôte (25 maximum). Sans ça, Spotify refuse leur connexion.

### Étape 7 — Réserver l'adresse à la famille (recommandé, 5 min)

Sans cette étape, quiconque devine l'adresse peut jouer. Avec, chacun prouve
son e-mail par un code à usage unique, une fois par navigateur.

1. https://one.dash.cloudflare.com → choisis un nom d'équipe si on te le demande
   (plan **Free**, jusqu'à 50 utilisateurs ; une carte peut être demandée à
   l'inscription sans être débitée).
2. **Access** → **Applications** → **Add an application** → **Self-hosted**.
3. Application name `Blind Test`, domaine `blindtest.ton-domaine.fr`, **Next**.
4. Policy : nom `Famille`, action **Allow**, règle **Emails** avec les adresses
   de toute la famille (hôtes et joueurs). **Next**, **Add application**.

### Étape 8 — Test depuis la 4G

Sur ton téléphone, WiFi coupé : `https://blindtest.ton-domaine.fr`. Tu passes le
contrôle Cloudflare (code reçu par e-mail), tu arrives sur la page d'accueil.
**Créer une salle**, pseudo, puis panneau hôte → **🎧 Connecter Spotify** :
Spotify demande l'autorisation, tu reviens dans ta salle, le panneau affiche
« Spotify : ton nom ». Charge une playlist et lance : ça joue chez toi.

### Ce que fait un membre de la famille chez lui

1. Il ouvre `https://blindtest.ton-domaine.fr`, entre son e-mail, tape le code reçu.
2. **Créer une salle** → pseudo → **Rejoindre**.
3. Panneau 🎛️ → **🎧 Connecter Spotify** avec son compte Premium.
4. Il lance Spotify 5 secondes sur son enceinte pour la rendre visible, choisit
   la sortie dans **🔊 Appareils Spotify**, charge une playlist.
5. Pour l'image sur sa TV : **📺 Caster sur la TV** depuis Android (méthode 1),
   ou n'importe quel écran sur `/r/SONCODE/tv` (méthode 2).
6. **▶ Lancer**. Ses invités scannent le QR code de son lobby ou de sa TV.

Sa salle, ses scores et sa musique sont indépendants des tiens. Une salle sans
activité pendant 6 h disparaît toute seule.

---

## Vérification finale

| À voir | Où |
|---|---|
| `✅ C'est prêt !` et le QR code | à la fin de l'assistant |
| `active (running)` | `systemctl status blindtest` |
| La page d'accueil avec **Salle de la maison** | `http://<ip-du-pi>:3000` sur le téléphone |
| La musique qui part au ▶ Lancer | sur l'appareil choisi dans **Appareils Spotify** |
| Bloc B : le jeu sur la TV, pas tes saisies | après **📺 Caster** ou l'ouverture de `/tv` |
| Bloc C : la page d'accueil depuis la 4G | `https://blindtest.ton-domaine.fr` |

---

## Si ça coince

| Problème | Solution |
|---|---|
| « Aucun appareil Spotify visible » | Les appareils Connect s'endorment : lance 5 s de musique depuis ton téléphone puis bouton **🔄 Relancer la lecture** |
| « Spotify n'a pas confirmé la lecture » | La commande est partie mais rien ne joue : vérifie l'appareil dans **Appareils Spotify** puis relance |
| La TV affiche le jeu puis Spotify prend l'écran | La musique sort sur ce même Chromecast : choisis une autre sortie dans **Appareils Spotify** |
| Le bouton **📺 Caster** n'apparaît pas | Il faut Chrome sur Android ou PC, l'Application ID Cast dans l'assistant, et le bloc C |
| « Clé hôte incorrecte » | C'est le code hôte de l'assistant, aussi dans `journalctl -u blindtest -n 20` |
| « Playlist introuvable » | Playlist créée par Spotify (Top 50, Années 80…) ou privée d'un autre compte : utilise **Mes playlists** |
| « Connexion Spotify indisponible » | Bloc C non fait : la connexion depuis le navigateur exige l'adresse HTTPS du tunnel |
| Spotify refuse la connexion d'un membre de la famille | Son e-mail Spotify n'est pas dans **User Management** de ton app |
| « state ne correspond pas » dans l'assistant | Tu as collé une vieille adresse : recommence depuis l'adresse `accounts.spotify.com` affichée |
| La page ne charge pas sur un téléphone | Même WiFi que le Pi (pas la 4G, pas le réseau invité), IP plutôt que `.local` |
| Le serveur a redémarré pendant la partie | Les scores sont conservés, la salle revient au lobby : l'hôte relance |
| Voir ce qui se passe | `journalctl -u blindtest -f` sur le Pi |
| Redémarrer le jeu | `sudo systemctl restart blindtest` |
| Mettre à jour | Automatique toutes les 30 min hors partie, ou `sudo /opt/blindtest/deploy/update.sh` |

---

## Annexe — Connecter Spotify autrement

- **Depuis un PC avec Node ≥ 18** : `git clone`, `cp .env.example .env`, colle
  les identifiants, `npm run auth`, puis recopie la ligne `SPOTIFY_REFRESH_TOKEN=`
  dans `/opt/blindtest/.env` du Pi et `sudo systemctl restart blindtest`.
- **Par tunnel SSH** : `ssh -L 8888:127.0.0.1:8888 pi@raspberrypi.local` puis,
  dans ce terminal, `cd /opt/blindtest && sudo node scripts/auth.js --write` et
  ouvre l'adresse affichée sur le PC.
