# 🎧 Blind Test de fin de soirée

Blind test multijoueur sur une playlist Spotify, hébergé sur un Raspberry Pi.
Chacun rejoint depuis son téléphone sur le réseau local, la musique sort sur la TV
(Chromecast), une enceinte connectée ou n'importe quel appareil Spotify Connect.
30 secondes au milieu du morceau, on devine le titre et/ou l'artiste, les plus
rapides marquent le plus de points.

Zéro dépendance runtime : Node ≥ 20, `node:http`, SSE et du JS vanilla.

> 🍓 **Première installation ?** Suis le guide pas à pas : **[INSTALL.md](INSTALL.md)** —
> chaque étape avec les commandes exactes, de la création de l'app Spotify à la première partie.

## Prérequis

- Un compte **Spotify Premium** (obligatoire : l'API de contrôle de lecture est réservée au Premium)
- Une app Spotify sur https://developer.spotify.com/dashboard avec le redirect URI `http://127.0.0.1:8888/callback`
- Node ≥ 20 (le Pi est installé automatiquement en Node 22 par `deploy/install.sh`)

## Connexion Spotify (une seule fois)

```bash
cp .env.example .env        # renseigne SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET
npm run auth                # ouvre l'URL affichée, autorise, colle le SPOTIFY_REFRESH_TOKEN dans .env
```

Spotify n'accepte plus que `127.0.0.1` en redirect HTTP : lance `npm run auth`
sur la machine où est ton navigateur. Pour le Pi, tunnel SSH puis ouvre l'URL sur ton PC :

```bash
ssh -L 8888:127.0.0.1:8888 pi@raspberrypi.local
```

Le refresh token n'expire pas, tu ne refais jamais cette étape.

## Lancer en local

```bash
npm start                   # http://localhost:3000
```

## Déployer sur le Raspberry Pi

```bash
curl -fsSL https://raw.githubusercontent.com/Ghermin/blindtest-de-fin-de-soiree/main/deploy/install.sh | sudo bash
sudo nano /opt/blindtest/.env   # colle les 3 variables SPOTIFY_*
sudo systemctl start blindtest
```

Le jeu est sur `http://<hostname>.local:3000`. Une mise à jour est tirée
automatiquement toutes les 30 min (`blindtest-update.timer`), comme botto.

## Jouer

1. Chacun ouvre l'URL sur son téléphone et entre un pseudo.
2. L'hôte active « Je suis l'hôte », colle un lien de playlist, règle manches / mode / durée.
3. **Le son** : caste Spotify une fois sur la TV (ou lance une lecture n'importe où) pour
   que l'appareil soit visible, ou renseigne `SPOTIFY_DEVICE_NAME` dans `.env`.
   Le bouton « Appareils Spotify » du panneau hôte permet de choisir la sortie.
4. ▶ Lancer : décompte de 3 s, extrait de 30 s pris au milieu du morceau, on tape
   ses réponses, révélation, manche suivante, podium à la fin.

Les réponses tolèrent accents, majuscules, ponctuation, articles, « feat. »,
« (Remastered) » et une petite faute de frappe.

## Scoring

| Trouvé | Points |
|---|---|
| Titre | 500 × vitesse |
| Artiste | 500 × vitesse |
| Les deux dans la manche | +200 |
| Premier sur le titre / l'artiste | +100 |

La vitesse décroît linéairement de 1.0 (immédiat) à 0.3 (dernière seconde).
Tous les temps sont mesurés côté serveur : pas de triche possible en trafiquant son téléphone.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | L'app créée sur le dashboard Spotify |
| `SPOTIFY_REFRESH_TOKEN` | Sortie de `npm run auth` |
| `SPOTIFY_DEVICE_NAME` | Nom (partiel) de l'appareil de sortie préféré, ex. `Salon` |
| `BLINDTEST_PORT` | Port HTTP (3000) |
| `BLINDTEST_HOST_PIN` | Optionnel : code demandé pour les actions hôte |

## Dépannage

- **« Aucun appareil Spotify visible »** : les appareils Connect s'endorment.
  Ouvre Spotify sur ton téléphone ou caste 5 secondes sur la TV, puis « Relancer la lecture ».
- **La musique démarre en retard** : normal sur Chromecast (~1 s), le chrono ne
  démarre qu'une fois la lecture confirmée par Spotify.
- **Podium figé** : l'hôte a un bouton « ↩ Lobby » pour repartir sur une nouvelle partie.
