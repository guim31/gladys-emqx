# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-10-25

### Added

- The EMQX broker (or cluster) as a Gladys device, read from the REST API v5 of EMQX 5 and 6 with an
  API key every 30 seconds: reachable, connected clients, subscriptions, topics, messages received,
  sent and dropped per minute, retained messages, alarms in progress, running nodes, uptime and
  version.
- Followed MQTT clients (up to 20, by client id): one device each, with "Connected" and "Last
  connection".
- Scene triggers: broker unreachable for N minutes, broker back, broker restarted, alarm raised,
  alarm cleared, client disconnected, client reconnected, fewer connected clients, message spike.
- Scene action "Broker summary": a sentence, the key numbers and the alarms of the broker.
- Dashboard widget "EMQX broker": state, version, uptime, nodes, alarms in progress and four live
  tiles.
- "Check the connection" action, and a connection status telling a refused key, an unreachable
  broker or an address without EMQX 5 API apart.
- English, French, German and Spanish texts and documentation.

[Unreleased]: https://github.com/guim31/gladys-emqx/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-emqx/releases/tag/v1.0.0
