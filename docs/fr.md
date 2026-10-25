# EMQX

Surveille la santé de votre broker MQTT **EMQX** dans Gladys : clients connectés, abonnements, débit
de messages, messages jetés, alarmes en cours, nœuds en marche, durée de fonctionnement et pannes,
ainsi que les clients MQTT que vous choisissez de suivre (Zigbee2MQTT, un Shelly, un pont…).

Cette intégration n'est pas affiliée à EMQ Technologies.

## Présentation

Gladys parle déjà MQTT : son intégration **MQTT** se connecte à un broker pour piloter vos appareils.
Elle ne montre rien du broker lui-même. Cette intégration, si : toutes les 30 secondes, elle lit l'API
REST d'EMQX (version 5 ou 6) avec une clé d'API et transforme ce qu'EMQX dit de lui en appareils
Gladys, neuf déclencheurs de scène, une action de scène et un widget de tableau de bord.

Elle ne fait que lire : elle ne publie aucun message, ne se connecte pas comme client MQTT et ne
modifie jamais la configuration d'EMQX. Tout reste sur votre réseau local.

Pour un broker **Eclipse Mosquitto**, installez plutôt l'intégration Mosquitto : EMQX publie d'autres
statistiques.

## Prérequis

- Gladys 5.1 ou plus récent.
- EMQX 5 ou 6 (testé avec 5.8.6 et 6.3.2), son port du tableau de bord (**18083** par défaut)
  joignable depuis Gladys.
- Une clé d'API d'EMQX et sa clé secrète.

EMQX 4 n'est pas pris en charge : son API est différente.

### Créer une clé d'API

1. Ouvrez le tableau de bord d'EMQX (`http://<adresse>:18083`).
2. Allez dans **System → API Key** (Système → Clé d'API), puis **Create**.
3. Donnez-lui un nom (par exemple `gladys`). Si EMQX propose un rôle, choisissez **Viewer** : un accès
   en lecture suffit.
4. Copiez l'**API Key** et la **Secret Key** : EMQX n'affiche le secret qu'une seule fois.

## Configuration

| Champ                             | Description                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Adresse d'EMQX                    | L'adresse du tableau de bord : `http://192.168.1.20:18083`, ou un simple hôte (le port 18083 est ajouté).              |
| Clé d'API                         | L'API Key créée plus haut.                                                                                             |
| Clé secrète                       | Sa Secret Key.                                                                                                         |
| Accepter un certificat auto-signé | Pour une adresse `https://` dont Gladys ne peut pas vérifier le certificat.                                            |
| Clients MQTT à suivre             | Identifiants de clients séparés par des virgules, 20 au plus. Chacun devient un appareil. Vide : aucun.                |
| Langue des textes                 | Noms des fonctionnalités des appareils à leur ajout, phrases des scènes et messages des actions (français par défaut). |

Le bouton **Vérifier la connexion** lit EMQX tout de suite et indique sa version, ses chiffres clés,
ses alarmes en cours et le nombre de clients suivis connectés.

Ouvrez ensuite l'onglet **Découverte** de l'intégration et ajoutez le broker et les clients voulus.

## L'appareil du broker

| Fonctionnalité          | Signification                                                                    |
| ----------------------- | -------------------------------------------------------------------------------- |
| Joignable               | 1 tant que l'API répond, 0 pendant une panne.                                    |
| Clients connectés       | Clients MQTT connectés en ce moment.                                             |
| Abonnements             | Abonnements de tous les clients.                                                 |
| Topics                  | Topics ayant au moins un abonné.                                                 |
| Messages reçus (/min)   | Messages publiés vers le broker, par minute.                                     |
| Messages envoyés (/min) | Messages remis aux abonnés, par minute.                                          |
| Messages jetés (/min)   | Messages qu'EMQX a jetés (souvent : personne n'est abonné au topic), par minute. |
| Messages retenus        | Messages gardés par le broker pour les nouveaux abonnés.                         |
| Alarmes en cours        | Alarmes d'EMQX en cours (mémoire, processeur, congestion…).                      |
| Nœuds en marche         | Nœuds du cluster en marche (1 pour un broker seul).                              |
| Durée de fonctionnement | En jours, depuis le démarrage du nœud le plus récent.                            |
| Version                 | Version d'EMQX.                                                                  |

Les débits viennent d'EMQX lui-même, qui les mesure toutes les 10 secondes. Pendant une panne, seul
**Joignable** change : les autres valeurs gardent leur dernière lecture.

## Clients suivis

Chaque identifiant du champ **Clients MQTT à suivre** devient un appareil qui porte son nom, avec deux
fonctionnalités :

- **Connecté** : 1 quand le client est connecté à EMQX, 0 sinon (y compris quand EMQX ne le connaît
  plus).
- **Dernière connexion** : date et heure de sa dernière connexion, dans le fuseau horaire de Gladys.

Les identifiants figurent sur la page **Clients** du tableau de bord. Zigbee2MQTT, par exemple, prend
le `client_id` de sa configuration (`mqttjs_…` s'il n'y en a pas : donnez-lui d'abord un identifiant
fixe).

## Widget du tableau de bord

Le widget **Broker EMQX** affiche l'état du broker, sa version, sa durée de fonctionnement, les nœuds
d'un cluster, les alarmes en cours (jusqu'à trois par leur nom) et quatre tuiles en direct : clients,
messages reçus, envoyés et jetés par minute. Choisissez le broker dans ses réglages.

## Déclencheurs de scène

| Déclencheur                | Quand                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Broker injoignable         | L'API ne répond plus depuis 1, 5, 15, 30 ou 60 minutes (au choix).                      |
| Broker revenu              | L'API répond de nouveau après une coupure d'au moins une minute.                        |
| Broker redémarré           | La durée de fonctionnement d'un nœud est revenue à zéro, même sans coupure visible.     |
| Alarme levée               | EMQX a levé une alarme. Variables : nom de l'alarme, message, nœud.                     |
| Alarme retombée            | Une alarme n'est plus en cours. Variable : sa durée en minutes.                         |
| Client déconnecté          | Un client suivi n'est plus connecté.                                                    |
| Client reconnecté          | Un client suivi est de nouveau connecté. Variable : minutes de déconnexion.             |
| Moins de clients connectés | Moins de clients que le nombre choisi pendant une minute.                               |
| Pic de messages            | Plus de messages reçus par minute que le nombre choisi ; au plus toutes les 30 minutes. |

Après un redémarrage de l'intégration, la première lecture sert de référence : une alarme déjà en
cours ou un client déjà absent ne déclenche rien.

## Action de scène

**État du broker** donne une phrase prête pour un message (« EMQX 5.8.6 fonctionne depuis 3 jours, 12
clients connectés, 64 messages reçus et 87 envoyés par minute, aucune alarme. ») et ses chiffres :
joignable, clients connectés, messages reçus, envoyés et jetés par minute, alarmes en cours et leurs
noms, durée de fonctionnement en heures, version.

## Idées de scènes

- **Alarme levée** → vous envoyer un message « Alarme EMQX : {{message}} sur {{node}} ».
- **Client déconnecté** sur Zigbee2MQTT → prévenir que les appareils Zigbee ne répondent plus.
- Chaque matin, **État du broker** → envoyer la phrase de synthèse sur Telegram.
- **Broker injoignable** depuis 5 minutes → passer une lampe en rouge.

## Dépannage

- **EMQX est injoignable** : vérifiez l'adresse et le port (18083 par défaut, pas le port MQTT 1883),
  et que Gladys l'atteint (pare-feu, réseau Docker).
- **EMQX refuse la clé d'API** : vérifiez la clé et le secret, que la clé est activée et pas expirée.
  Une clé supprimée dans le tableau de bord doit être recréée.
- **Pas d'API EMQX 5 à cette adresse** : l'adresse mène à autre chose (port MQTT, autre service) ou à
  EMQX 4.
- **Un client reste déconnecté** : vérifiez son identifiant exact sur la page **Clients** du tableau
  de bord (majuscules comprises).
- Plus de détails : réglez `LOG_LEVEL=debug` et lisez les journaux de l'intégration.

## Limites

- Lecture toutes les 30 secondes : une déconnexion plus courte peut passer inaperçue.
- Les débits sont des moyennes calculées par EMQX sur 10 secondes, affichées par minute.
- 20 clients suivis au plus ; un identifiant contenant une espace ne peut pas être suivi.
- Seules les alarmes d'EMQX sont lues, pas les règles, ponts ou plugins eux-mêmes.
- EMQX 4 n'est pas pris en charge.
