# Real EMQX answers

Recorded on 25/10/2026 from the official `emqx/emqx` images (5.8.6 Opensource and
6.3.2) in Docker, with an API key in HTTP Basic, while `mosquitto_sub` (client id
`sensor-1`, persistent session) and a `mosquitto_pub` loop ran against the broker,
and with `sysmon.os.sysmem_high_watermark` lowered to raise the
`high_system_memory_usage` alarm.

| File                       | Request                                    |
| -------------------------- | ------------------------------------------ |
| `nodes.json`               | `GET /api/v5/nodes`                        |
| `monitor_current.json`     | `GET /api/v5/monitor_current`              |
| `alarms.json`              | `GET /api/v5/alarms?activated=true`        |
| `client-connected.json`    | `GET /api/v5/clients/sensor-1`, connected  |
| `client-disconnected.json` | same, after the client left (session kept) |
| `client-not-found.json`    | `GET /api/v5/clients/<unknown>` (HTTP 404) |
| `bad-auth.json`            | any request with a wrong key (HTTP 401)    |

Anonymized: node names, IP addresses and ports replaced by documentation values.
