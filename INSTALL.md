# Installation pas à pas 🍓

Trois blocs, dans l'ordre. Seul le premier est obligatoire.

| Bloc | Quoi | Durée | Il te faut |
|---|---|---|---|
| **A** | Le jeu à la maison | 15 min | le Pi allumé sur ton réseau, ton compte Spotify Premium, une enceinte / Chromecast / téléphone Spotify |
| **B** | L'écran TV | 5 min | le Pi branché en HDMI sur la TV, Raspberry Pi OS **avec bureau** |
| **C** | L'accès famille | 20 min | un nom de domaine géré par Cloudflare |

> ℹ️ Le PC ne sert que pour l'installation, **une seule fois**. Ensuite le jeu
> tourne en permanence sur le Pi (il démarre avec lui, se met à jour tout seul,
> jamais pendant une partie) et **tout se pilote depuis ton téléphone**.

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

📝 Garde ces deux valeurs sous la main (bloc-notes), tu les colles à l'étape 3.

### Étape 1 bis — Si tu veux le bloc C : un domaine chez Cloudflare

1. Crée un compte sur https://dash.cloudflare.com (gratuit).
2. Ajoute un domaine : soit tu en achètes un directement chez Cloudflare
   (quelques euros par an), soit tu transfères les DNS d'un domaine que tu as déjà
   (Cloudflare te donne deux serveurs de noms à renseigner chez ton registrar,
   compte quelques heures de propagation).
3. Note les adresses e-mail **Spotify** des membres de la famille qui voudront
   être hôtes (celles de leur compte Spotify Premium). Les simples joueurs n'ont
   besoin de rien.

---

## À la maison — Bloc A : le jeu

### Étape 2 — Installer le jeu sur le Raspberry Pi (3 min)

1. Depuis ton PC, ouvre un terminal (PowerShell sur Windows) et connecte-toi au Pi :

   ```
   ssh pi@raspberrypi.local
   ```

   > Si `raspberrypi.local` ne répond pas, utilise l'adresse IP du Pi
   > (visible dans l'interface de ta box, ou `hostname -I` sur le Pi).
   > Adapte aussi `pi` si ton utilisateur s'appelle autrement.

2. Sur le Pi, lance l'installation :

   ```
   curl -fsSL https://raw.githubusercontent.com/Ghermin/blindtest-de-fin-de-soiree/main/deploy/install.sh | sudo bash
   ```

   Ça installe Node 22 si besoin, met le jeu dans `/opt/blindtest` et crée le
   service. À la fin tu dois voir :

   ```
   Renseigne /opt/blindtest/.env (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, puis npm run auth pour la salle de la maison) et : sudo systemctl start blindtest
   Jeu : http://raspberrypi.local:3000 (réseau local)
   ```

### Étape 3 — Coller tes identifiants Spotify

Toujours sur le Pi :

```
sudo nano /opt/blindtest/.env
```

Remplis les deux premières lignes avec ce que tu as copié à l'étape 1, et
choisis le code hôte de ta salle (4 à 8 chiffres, c'est ce que tu taperas sur
ton téléphone pour prendre la main) :

```
SPOTIFY_CLIENT_ID=ton_client_id_ici
SPOTIFY_CLIENT_SECRET=ton_client_secret_ici
BLINDTEST_HOST_PIN=1234
```

Enregistre : `Ctrl+O`, `Entrée`, puis `Ctrl+X`.

### Étape 4 — Connecter ton compte Spotify (une seule fois)

Spotify n'autorise la connexion que sur `127.0.0.1`, donc on fait un petit
tunnel entre ton PC et le Pi. C'est deux commandes :

1. **Sur ton PC**, ouvre un NOUVEAU terminal et tape (laisse-le ouvert ensuite) :

   ```
   ssh -L 8888:127.0.0.1:8888 pi@raspberrypi.local
   ```

   Tu te retrouves connecté au Pi, c'est normal — ce terminal fait le pont.

2. **Dans ce même terminal** (donc sur le Pi), lance :

   ```
   cd /opt/blindtest && sudo node scripts/auth.js
   ```

   Le script affiche une longue URL `https://accounts.spotify.com/authorize?...`

3. **Copie cette URL dans le navigateur de ton PC**, connecte-toi si demandé,
   clique **Accepter**. Le navigateur affiche « ✅ Connecté ! ».

4. Retourne dans le terminal : il affiche une ligne

   ```
   SPOTIFY_REFRESH_TOKEN=AQC...
   ```

   Copie-la, puis colle-la dans le fichier de config à la place de la ligne vide :

   ```
   sudo nano /opt/blindtest/.env
   ```

   (`Ctrl+O`, `Entrée`, `Ctrl+X` pour sauver.)

5. Démarre le jeu et vérifie :

   ```
   sudo systemctl restart blindtest
   systemctl status blindtest
   journalctl -u blindtest -n 5
   ```

   Tu dois voir `active (running)` en vert, et dans les logs :

   ```
   Blind test prêt : http://192.168.1.42:3000 (LAN : ..., local : ...)
   Salle de la maison : http://192.168.1.42:3000/r/MAISON — clé hôte : 1234
   ```

   Tu peux fermer les terminaux : ce token n'expire pas, tu ne referas jamais
   cette étape.

### Étape 5 — L'adresse pour les téléphones

L'adresse affichée dans les logs (`http://192.168.1.42:3000`) est celle à donner.
La page d'accueil propose **Salle de la maison**, qui mène à `/r/MAISON`.

> `http://raspberrypi.local:3000` marche aussi sur PC et iPhone, mais certains
> Android ne connaissent pas les adresses en `.local` : donne plutôt l'IP.
> Le lobby affiche cette adresse et un QR code : montre ton téléphone aux invités. 📱

Sur ton téléphone, ajoute le jeu à l'écran d'accueil pour avoir une icône
comme une vraie app : Chrome → menu ⋮ → **Ajouter à l'écran d'accueil**
(Safari → Partager → **Sur l'écran d'accueil**).

### Étape 6 — Premier test, tout seul (2 min)

1. Sur ton téléphone, ouvre Spotify, lance n'importe quoi sur l'enceinte ou la
   TV 5 secondes, puis mets pause : l'appareil est maintenant visible.
2. Ouvre `http://<ip-du-pi>:3000` → **Salle de la maison** → pseudo → **Rejoindre**.
3. **« Je suis l'hôte 🎛️ »**, tape ta clé (`1234`), puis la manette en bas à droite :
   - colle un **lien de playlist Spotify** (dans Spotify : partager → copier le
     lien) ou clique **📚 Mes playlists**, puis **Charger** ;
   - **🔊 Appareils Spotify** → choisis ta sortie ;
   - **▶ Lancer**.
4. Décompte, musique, tu tapes une réponse, révélation, podium. Si la musique
   ne part pas, regarde **Si ça coince** en bas.

🎉 Le bloc A est fini. Le soir venu : chaque joueur scanne le QR code du lobby,
entre un pseudo et, s'il veut, une équipe.

---

## Bloc B : l'écran TV (optionnel)

Le Pi doit être branché en HDMI sur la TV et tourner sous Raspberry Pi OS
**avec bureau** (si tu vois un bureau graphique quand tu branches un écran,
c'est bon ; en version « Lite », ce bloc ne s'applique pas).

Sur le Pi, depuis ta session habituelle :

```
sudo /opt/blindtest/deploy/tv-setup.sh
sudo reboot
```

Au redémarrage :
- la TV affiche `http://localhost:3000/r/MAISON/tv` en plein écran : QR code,
  classement, chrono, indices, révélation, podium ;
- un appareil Spotify **« Blind Test TV »** apparaît dans **🔊 Appareils
  Spotify** du panneau hôte : choisis-le, le son sort par le HDMI de la TV.

Si le son sort par la prise jack au lieu de la TV : `sudo raspi-config` →
System Options → Audio → HDMI. Si l'écran se met en veille : le script a
désactivé la mise en veille, sinon `sudo raspi-config` → Display Options →
Screen Blanking → Non.

Sans Pi sur la TV : ouvre `http://<ip-du-pi>:3000/r/MAISON/tv` dans le
navigateur d'un PC ou de la TV, à condition que la musique sorte ailleurs que sur
le Chromecast de cette TV (Spotify prend l'écran d'un Chromecast dès qu'il joue).

---

## Bloc C : ouvrir le jeu à la famille (optionnel)

### Étape 8.1 — Le tunnel (sur le Pi)

```
sudo /opt/blindtest/deploy/tunnel-setup.sh blindtest.ton-domaine.fr
```

Le script installe `cloudflared`. À la première exécution il affiche une URL
`https://dash.cloudflare.com/argotunnel?...` : **ouvre-la sur ton PC**, choisis
ton domaine, valide. Le script continue tout seul : création du tunnel, DNS,
service au démarrage, mise à jour de `.env`, redémarrage du jeu. À la fin il
affiche « Tunnel prêt : https://blindtest.ton-domaine.fr » et les réglages
restants ci-dessous.

### Étape 8.2 — Côté Spotify (sur ton PC, 2 min)

Dans https://developer.spotify.com/dashboard → ton app → **Settings** :

1. **Redirect URIs** : ajoute `https://blindtest.ton-domaine.fr/auth/spotify/callback`, **Add**, **Save**.
2. **User Management** : ajoute le nom et l'e-mail Spotify de chaque membre de
   la famille qui sera hôte (25 maximum). Sans ça, Spotify refuse leur connexion.

### Étape 8.3 — Réserver l'adresse à la famille (recommandé, 5 min)

Sans cette étape, quiconque devine l'adresse peut jouer. Avec, chacun doit
prouver son e-mail par un code à usage unique, une fois par navigateur.

1. https://one.dash.cloudflare.com → choisis un nom d'équipe si on te le demande
   (plan **Free**, jusqu'à 50 utilisateurs ; une carte peut être demandée à
   l'inscription sans être débitée).
2. **Access** → **Applications** → **Add an application** → **Self-hosted**.
3. Application name `Blind Test`, domaine `blindtest.ton-domaine.fr`, **Next**.
4. Policy : nom `Famille`, action **Allow**, règle **Emails** avec les adresses
   de toute la famille (hôtes et joueurs). **Next**, **Add application**.

### Étape 8.4 — Test depuis la 4G

Sur ton téléphone, WiFi coupé : `https://blindtest.ton-domaine.fr`. Tu passes le
contrôle Cloudflare (code reçu par e-mail), tu arrives sur la page d'accueil.
**Créer une salle**, pseudo, puis panneau hôte → **🎧 Connecter Spotify** :
Spotify demande l'autorisation, tu reviens dans ta salle, le panneau affiche
« Spotify : ton nom ». Charge une playlist et lance : ça joue chez toi.

### Étape 8.5 — Ce que fait un membre de la famille chez lui

1. Il ouvre `https://blindtest.ton-domaine.fr`, entre son e-mail, tape le code reçu.
2. **Créer une salle** → pseudo → **Rejoindre**.
3. Panneau 🎛️ → **🎧 Connecter Spotify** avec son compte Premium.
4. Il lance Spotify 5 secondes sur son enceinte pour la rendre visible, choisit
   la sortie dans **🔊 Appareils Spotify**, charge une playlist, **▶ Lancer**.
5. Ses invités scannent le QR code de son lobby (ou de `/r/SONCODE/tv` sur sa TV).

Sa salle, ses scores et sa musique sont indépendants des tiens. Une salle sans
activité pendant 6 h disparaît toute seule.

---

## Vérification finale

| À voir | Où |
|---|---|
| `active (running)` | `systemctl status blindtest` |
| `Salle de la maison : ... — clé hôte : ...` | `journalctl -u blindtest -n 20` |
| La page d'accueil avec **Salle de la maison** | `http://<ip-du-pi>:3000` sur le téléphone |
| Le QR code et l'adresse dans le lobby | après avoir rejoint |
| La musique qui part au ▶ Lancer | sur l'appareil choisi dans **Appareils Spotify** |
| Bloc B : QR + classement sur la TV | après `sudo reboot` |
| Bloc C : la page d'accueil depuis la 4G | `https://blindtest.ton-domaine.fr` |

---

## Si ça coince

| Problème | Solution |
|---|---|
| « Aucun appareil Spotify visible » | Les appareils Connect s'endorment : lance 5 s de musique depuis ton téléphone puis bouton **🔄 Relancer la lecture** |
| « Spotify n'a pas confirmé la lecture » | La commande est partie mais rien ne joue : vérifie l'appareil dans **Appareils Spotify** puis relance |
| « Clé hôte incorrecte » | C'est `BLINDTEST_HOST_PIN` dans `.env`, ou la clé affichée dans `journalctl -u blindtest -n 20` |
| « Playlist introuvable » | Playlist créée par Spotify (Top 50, Années 80…) ou privée d'un autre compte : utilise une playlist perso ou **Mes playlists** |
| « Connexion Spotify indisponible » | Bloc C non fait : la connexion depuis le navigateur exige l'adresse HTTPS du tunnel |
| Spotify refuse la connexion d'un membre de la famille | Son e-mail Spotify n'est pas dans **User Management** de ton app |
| La page ne charge pas sur un téléphone | Même WiFi que le Pi (pas la 4G, pas le réseau invité), IP plutôt que `.local` |
| « Refresh token refusé » dans les logs | Refais l'étape 4 (le token a mal été collé, il ne doit y avoir aucun espace) |
| La musique démarre avec 1 s de retard | Normal sur Chromecast : le chrono ne démarre qu'une fois la lecture confirmée |
| Le serveur a redémarré pendant la partie | Les scores sont conservés, la salle revient au lobby : l'hôte relance |
| Voir ce qui se passe | `journalctl -u blindtest -f` sur le Pi |
| Redémarrer le jeu | `sudo systemctl restart blindtest` |
| Mettre à jour | Automatique toutes les 30 min hors partie, ou `sudo /opt/blindtest/deploy/update.sh` |

---

## Annexe — Faire l'étape 4 sur un PC plutôt que sur le Pi

Possible si ton PC a **Node ≥ 18** (`node -v` pour vérifier — Node 16 ne marche pas) :

```
git clone https://github.com/Ghermin/blindtest-de-fin-de-soiree
cd blindtest-de-fin-de-soiree
cp .env.example .env      # colle CLIENT_ID et CLIENT_SECRET dedans
npm run auth              # ouvre l'URL affichée, autorise
```

Puis recopie la ligne `SPOTIFY_REFRESH_TOKEN=...` dans `/opt/blindtest/.env`
du Pi et `sudo systemctl restart blindtest`. Bonus : `npm start` sur le PC
permet aussi de tester le jeu en local sur `http://localhost:3000`.
