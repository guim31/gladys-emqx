# EMQX

Watches the health of your **EMQX** MQTT broker in Gladys: connected clients, subscriptions, message
rates, dropped messages, alarms in progress, running nodes, uptime and outages, plus the MQTT clients
you choose to follow (Zigbee2MQTT, a Shelly, a bridge…).

This integration is not affiliated with EMQ Technologies.

## Overview

Gladys already speaks MQTT: its **MQTT** integration connects to a broker to drive your devices. It
shows nothing about the broker itself. This integration does: every 30 seconds it reads the REST API
of EMQX (version 5 or 6) with an API key and turns what EMQX says into Gladys devices, nine scene
triggers, a scene action and a dashboard widget.

It only reads: it never publishes a message, never connects as an MQTT client and never changes the
configuration of EMQX. Everything stays on your local network.

For an **Eclipse Mosquitto** broker, install the Mosquitto integration instead: EMQX publishes other
statistics.

## Requirements

- Gladys 5.1 or later.
- EMQX 5 or 6 (tested with 5.8.6 and 6.3.2), its dashboard port (**18083** by default) reachable from
  Gladys.
- An API key of EMQX and its secret key.

EMQX 4 is not supported: its API is different.

### Create an API key

1. Open the EMQX dashboard (`http://<address>:18083`).
2. Go to **System → API Key**, then **Create**.
3. Give it a name (for instance `gladys`). If EMQX offers a role, pick **Viewer**: read access is
   enough.
4. Copy the **API Key** and the **Secret Key**: EMQX shows the secret only once.

## Configuration

| Field                            | Description                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Address of EMQX                  | The address of the dashboard: `http://192.168.1.20:18083`, or a bare host (port 18083 is added).          |
| API key                          | The API Key created above.                                                                                |
| Secret key                       | Its Secret Key.                                                                                           |
| Accept a self-signed certificate | For an `https://` address whose certificate Gladys cannot check.                                          |
| MQTT clients to follow           | Client ids, separated by commas, 20 at most. Each becomes a device. Leave empty to follow none.           |
| Language of the texts            | Feature names of the devices when added, scene sentences and messages of the actions (French by default). |

The **Check the connection** button reads EMQX at once and tells its version, its key numbers, its
alarms in progress and how many followed clients are connected.

Then open the **Discovery** tab of the integration and add the broker and the clients you want.

## The broker device

| Feature                  | Meaning                                                                       |
| ------------------------ | ----------------------------------------------------------------------------- |
| Reachable                | 1 while the API answers, 0 during an outage.                                  |
| Connected clients        | MQTT clients connected right now.                                             |
| Subscriptions            | Subscriptions of all the clients.                                             |
| Topics                   | Topics with at least one subscriber.                                          |
| Messages received (/min) | Messages published to the broker, per minute.                                 |
| Messages sent (/min)     | Messages delivered to subscribers, per minute.                                |
| Messages dropped (/min)  | Messages EMQX threw away (often: nobody subscribed to the topic), per minute. |
| Retained messages        | Messages kept by the broker for new subscribers.                              |
| Active alarms            | Alarms of EMQX in progress (memory, CPU, congestion…).                        |
| Running nodes            | Nodes of the cluster running (1 for a single broker).                         |
| Uptime                   | In days, since the youngest node started.                                     |
| Version                  | Version of EMQX.                                                              |

The rates come from EMQX itself, which samples them every 10 seconds. During an outage only
**Reachable** changes: the other values keep their last reading.

## Followed clients

Each client id of the **MQTT clients to follow** field becomes a device named after it, with two
features:

- **Connected**: 1 when the client is connected to EMQX, 0 otherwise (including when EMQX no longer
  knows it).
- **Last connection**: date and time of its latest connection, in the time zone of Gladys.

The client ids are listed on the **Clients** page of the dashboard. Zigbee2MQTT, for instance, uses
the `client_id` of its configuration (`mqttjs_…` when none is set: give it a fixed one first).

## Dashboard widget

The **EMQX broker** widget shows the state of the broker, its version, its uptime, the nodes of a
cluster, the alarms in progress (up to three by name), and four live tiles: clients, messages
received, sent and dropped per minute. Pick the broker in its settings.

## Scene triggers

| Trigger                 | When                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Broker unreachable      | The API has not answered for 1, 5, 15, 30 or 60 minutes (your choice).              |
| Broker back             | The API answers again after an outage of at least one minute.                       |
| Broker restarted        | The uptime of a node went back to zero, even without a visible outage.              |
| Alarm raised            | EMQX raised an alarm. Variables: alarm name, message, node.                         |
| Alarm cleared           | An alarm is no longer in progress. Variable: its duration in minutes.               |
| Client disconnected     | A followed client is no longer connected.                                           |
| Client reconnected      | A followed client is connected again. Variable: minutes disconnected.               |
| Fewer connected clients | Fewer clients than the chosen number for a minute.                                  |
| Message spike           | More messages received per minute than the chosen number; at most every 30 minutes. |

After a restart of the integration, the first reading is a reference: an alarm already in progress or
a client already away fires nothing.

## Scene action

**Broker summary** gives a sentence ready for a message ("EMQX 5.8.6 has been running for 3 days, 12
clients connected, 64 messages received and 87 sent per minute, no alarm.") and its numbers: reachable,
connected clients, messages received, sent and dropped per minute, alarms in progress and their names,
uptime in hours, version.

## Scene ideas

- **Alarm raised** → send yourself a message "EMQX alarm: {{message}} on {{node}}".
- **Client disconnected** on Zigbee2MQTT → warn that the Zigbee devices no longer answer.
- Every morning, **Broker summary** → send the summary sentence to Telegram.
- **Broker unreachable** for 5 minutes → turn a light red.

## Troubleshooting

- **EMQX cannot be reached**: check the address and the port (18083 by default, not the MQTT port
  1883), and that Gladys reaches it (firewall, Docker network).
- **EMQX refused the API key**: check the key and the secret, that the key is enabled and not
  expired. A key deleted in the dashboard must be created again.
- **No EMQX 5 API at this address**: the address points to something else (MQTT port, another
  service) or to EMQX 4.
- **A client stays disconnected**: check its exact client id on the **Clients** page of the dashboard
  (it is case-sensitive).
- More details: set `LOG_LEVEL=debug` and read the logs of the integration.

## Limits

- Read every 30 seconds: a disconnection shorter than that may go unnoticed.
- Rates are averages computed by EMQX over 10 seconds, shown per minute.
- 20 followed clients at most; a client id containing a space cannot be followed.
- Only the alarms of EMQX are read, not the rules, bridges or plugins themselves.
- EMQX 4 is not supported.
