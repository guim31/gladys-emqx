# EMQX for Gladys Assistant

Watches the health of your [EMQX](https://www.emqx.com/) MQTT broker in
[Gladys Assistant](https://gladysassistant.com): connected clients, message rates, dropped
messages, alarms in progress, cluster nodes, uptime and outages, plus the MQTT clients you choose to
follow (Zigbee2MQTT, a Shelly, a bridge…).

It reads the REST API v5 of EMQX with an API key, every 30 seconds, and never changes anything on
the broker. Everything stays on your local network.

User documentation: [English](docs/en.md), [Français](docs/fr.md), [Deutsch](docs/de.md),
[Español](docs/es.md).

## Features

- **Broker device**: reachable, connected clients, subscriptions, topics, messages received, sent
  and dropped per minute, retained messages, alarms in progress, running nodes, uptime, version.
- **Followed clients**: one device per client id (up to 20), with "Connected" and "Last connection".
- **Scene triggers**: broker unreachable (1 to 60 minutes), broker back, broker restarted, alarm
  raised, alarm cleared, client disconnected, client reconnected, fewer connected clients, message
  spike.
- **Scene action** "Broker summary": a sentence ready for a message, the key numbers and the alarms.
- **Dashboard widget** "EMQX broker": state, version, uptime, nodes, alarms and four live tiles.
- **Check the connection** action on the configuration page.
- Texts and documentation in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.1 or later.
- EMQX 5 or 6 (tested with 5.8.6 Opensource and 6.3.2), its dashboard port (18083 by default)
  reachable from Gladys.
- An API key and its secret, created in the dashboard (**System → API Key**; the Viewer role is
  enough when offered).

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-emqx`.
2. Fill in the address of EMQX, the API key and its secret, and optionally the client ids to follow.
3. Open the **Discovery** tab and add the broker and the clients.

## Limitations

- Read every 30 seconds: a disconnection shorter than that may go unnoticed.
- The rates are the 10-second averages of EMQX, shown per minute.
- 20 followed clients at most.
- EMQX 4 (API v4) is not supported.

## Development

Node.js 22+, ESM, no build step. Only runtime dependency:
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test              # node --test, on the SDK's fake Gladys and a fake EMQX answering with real recorded bodies
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store .   # store validator
```

```
index.js                  SDK wiring (src/app.js registers the handlers)
src/app.js                handlers: discovery, action, scene action, widget, configuration
src/hub.js                30 s reading loop, link state, changed states, scene events
src/devices.js            the broker and client devices, their features and states
src/triggers.js           outages, restarts, alarms, clients, thresholds
src/scenes.js             "Broker summary" scene action
src/widgets.js            "EMQX broker" dashboard widget
src/i18n.js               every text, in en/fr/de/es
src/emqx/client.js        REST client (HTTP Basic with the API key, GET only)
src/emqx/snapshot.js      API answers -> numbers
test/                     node --test; real answers of EMQX 5.8.6 and 6.3.2 in test/fixtures/emqx/
```

`test/gladys-rules.test.js` checks every discovered device against the category/type table
extracted from the Gladys core.

To run the integration outside Gladys:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="emqx" \
npm start
```

Releases are made by the **Release** workflow (Actions → Release); never edit the versions by
hand. A hand-pushed `vX.Y.Z` tag also builds the image and the GitHub Release, but then `version`
in `package.json` and in the manifest (with the `docker_image` tag) must be bumped and committed
before tagging. See [`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- [EMQX](https://github.com/emqx/emqx) by EMQ Technologies: its
  [REST API](https://docs.emqx.com/en/emqx/latest/admin/api.html). The fixtures are answers of the
  official `emqx/emqx` images; no code of EMQX is included.
- Cover: the official EMQX logo (`src/assets/img/emqx-logo-enterprise.svg` of the
  [EMQX Dashboard](https://github.com/emqx/emqx-dashboard5) repository), in white on the brand's
  purple.

## Disclaimer

This project is not affiliated with, endorsed or sponsored by EMQ Technologies. "EMQX" is a
trademark of EMQ Technologies Co., Ltd.

## License

[Apache-2.0](LICENSE).
