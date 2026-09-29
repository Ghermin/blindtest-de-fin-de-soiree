# Installation pas à pas 🍓

Tout se fait depuis ton PC (n'importe lequel, rien à installer dessus) et ton
Raspberry Pi. Compte 15 minutes. Suis les étapes dans l'ordre, chacune te dit
ce que tu dois voir avant de passer à la suivante.

**Il te faut :**
- un Raspberry Pi allumé et branché sur ton réseau (câble ou WiFi)
- ton compte **Spotify Premium**
- une TV avec Chromecast (ou une enceinte connectée / l'appli Spotify d'un téléphone) sur le même réseau

---

## Étape 1 — Créer ton app Spotify (5 min, une seule fois)

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

---

## Étape 2 — Installer le jeu sur le Raspberry Pi (3 min)

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
   Renseigne /opt/blindtest/.env (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET puis npm run auth) et : sudo systemctl start blindtest
   Jeu : http://raspberrypi.local:3000 (réseau local)
   ```

---

## Étape 3 — Coller tes identifiants Spotify

Toujours sur le Pi :

```
sudo nano /opt/blindtest/.env
```

Remplis les deux premières lignes avec ce que tu as copié à l'étape 1 :

```
SPOTIFY_CLIENT_ID=ton_client_id_ici
SPOTIFY_CLIENT_SECRET=ton_client_secret_ici
```

Enregistre : `Ctrl+O`, `Entrée`, puis `Ctrl+X`.

---

## Étape 4 — Connecter ton compte Spotify (une seule fois)

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

5. Démarre le jeu :

   ```
   sudo systemctl restart blindtest
   ```

   Vérifie que tout va bien :

   ```
   systemctl status blindtest
   ```

   Tu dois voir `active (running)` en vert. Tu peux fermer les terminaux :
   ce token n'expire pas, tu ne referas jamais cette étape.

---

## Étape 5 — Trouver l'adresse du jeu pour les téléphones

Sur le Pi, tape `hostname -I` : la première adresse (ex. `192.168.1.42`) est
celle du Pi. L'adresse du jeu est donc :

```
http://192.168.1.42:3000
```

> `http://raspberrypi.local:3000` marche aussi sur PC et iPhone, mais certains
> Android ne connaissent pas les adresses en `.local` : donne plutôt l'IP.
> Astuce : génère un QR code de l'URL et laisse-le sur la table. 📱

---

## Étape 6 — Soirée 🎉

1. **Réveille la TV** : sur ton téléphone, ouvre Spotify, lance n'importe quoi
   et caste-le sur le Chromecast 5 secondes, puis mets pause. (À refaire si la
   TV est restée éteinte longtemps.)
2. Chaque joueur ouvre `http://<ip-du-pi>:3000` sur son téléphone
   (même WiFi que le Pi, pas la 4G !) et entre son pseudo.
3. Toi : bouton **« Je suis l'hôte 🎛️ »** puis la manette en bas à droite :
   - colle un **lien de playlist Spotify** (partager → copier le lien) et **Charger**
   - clique **🔊 Appareils Spotify** et choisis ta TV
   - règle manches / mode / durée, puis **▶ Lancer**
4. Décompte, 30 secondes de musique, tout le monde tape ses réponses,
   révélation, manche suivante… podium à la fin. 🏆

---

## Si ça coince

| Problème | Solution |
|---|---|
| « Aucun appareil Spotify visible » | Les Chromecast s'endorment : caste 5 s depuis ton téléphone puis bouton **🔄 Relancer la lecture** |
| La page ne charge pas sur un téléphone | Vérifie qu'il est sur le même WiFi (pas en 4G, pas le réseau invité de la box), et utilise l'IP plutôt que `.local` |
| « Refresh token refusé » dans les logs | Refais l'étape 4 (le token a mal été collé, il ne doit y avoir aucun espace) |
| La musique démarre avec 1 s de retard | Normal sur Chromecast : le chrono ne démarre qu'une fois la lecture réellement confirmée |
| Voir ce qui se passe | `journalctl -u blindtest -f` sur le Pi |
| Redémarrer le jeu | `sudo systemctl restart blindtest` |
| Mettre à jour | Automatique toutes les 30 min, ou `sudo /opt/blindtest/deploy/update.sh` |

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
