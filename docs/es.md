# EMQX

Vigila la salud de su broker MQTT **EMQX** en Gladys: clientes conectados, suscripciones, flujo de
mensajes, mensajes descartados, alarmas activas, nodos en marcha, tiempo en marcha y caídas, además de
los clientes MQTT que usted elija seguir (Zigbee2MQTT, un Shelly, un puente…).

Esta integración no está afiliada a EMQ Technologies.

## Presentación

Gladys ya habla MQTT: su integración **MQTT** se conecta a un broker para controlar sus dispositivos.
No muestra nada del propio broker. Esta integración sí: cada 30 segundos lee la API REST de EMQX
(versión 5 o 6) con una clave de API y convierte lo que EMQX dice de sí mismo en dispositivos de
Gladys, nueve disparadores de escena, una acción de escena y un widget del panel.

Solo lee: no publica ningún mensaje, no se conecta como cliente MQTT y nunca modifica la configuración
de EMQX. Todo se queda en su red local.

Para un broker **Eclipse Mosquitto**, instale mejor la integración Mosquitto: EMQX publica otras
estadísticas.

## Requisitos

- Gladys 5.1 o posterior.
- EMQX 5 o 6 (probado con 5.8.6 y 6.3.2), con el puerto del panel (**18083** por defecto) accesible
  desde Gladys.
- Una clave de API de EMQX y su clave secreta.

EMQX 4 no es compatible: su API es distinta.

### Crear una clave de API

1. Abra el panel de EMQX (`http://<dirección>:18083`).
2. Vaya a **System → API Key** (Sistema → Clave de API) y luego a **Create**.
3. Póngale un nombre (por ejemplo `gladys`). Si EMQX ofrece un rol, elija **Viewer**: basta con acceso
   de lectura.
4. Copie la **API Key** y la **Secret Key**: EMQX muestra el secreto una sola vez.

## Configuración

| Campo                              | Descripción                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Dirección de EMQX                  | La dirección del panel: `http://192.168.1.20:18083`, o solo el host (se añade el puerto 18083).               |
| Clave de API                       | La API Key creada arriba.                                                                                     |
| Clave secreta                      | Su Secret Key.                                                                                                |
| Aceptar un certificado autofirmado | Para una dirección `https://` cuyo certificado Gladys no puede comprobar.                                     |
| Clientes MQTT que seguir           | Identificadores separados por comas, 20 como máximo. Cada uno se convierte en un dispositivo. Vacío: ninguno. |
| Idioma de los textos               | Nombres de las funciones al añadirlas, frases de escenas y mensajes de las acciones (francés por defecto).    |

El botón **Comprobar la conexión** lee EMQX al momento e indica su versión, sus cifras clave, sus
alarmas activas y cuántos clientes seguidos están conectados.

Abra después la pestaña **Descubrimiento** de la integración y añada el broker y los clientes que
desee.

## El dispositivo del broker

| Función                     | Significado                                                                     |
| --------------------------- | ------------------------------------------------------------------------------- |
| Accesible                   | 1 mientras la API responde, 0 durante una caída.                                |
| Clientes conectados         | Clientes MQTT conectados ahora mismo.                                           |
| Suscripciones               | Suscripciones de todos los clientes.                                            |
| Temas                       | Temas con al menos un suscriptor.                                               |
| Mensajes recibidos (/min)   | Mensajes publicados hacia el broker, por minuto.                                |
| Mensajes enviados (/min)    | Mensajes entregados a los suscriptores, por minuto.                             |
| Mensajes descartados (/min) | Mensajes que EMQX descartó (a menudo: nadie está suscrito al tema), por minuto. |
| Mensajes retenidos          | Mensajes que el broker guarda para los nuevos suscriptores.                     |
| Alarmas activas             | Alarmas de EMQX en curso (memoria, CPU, congestión…).                           |
| Nodos en marcha             | Nodos del clúster en marcha (1 para un broker solo).                            |
| Tiempo en marcha            | En días, desde el arranque del nodo más reciente.                               |
| Versión                     | Versión de EMQX.                                                                |

Los flujos vienen del propio EMQX, que los mide cada 10 segundos. Durante una caída solo cambia
**Accesible**: los demás valores conservan su última lectura.

## Clientes seguidos

Cada identificador del campo **Clientes MQTT que seguir** se convierte en un dispositivo con su
nombre y dos funciones:

- **Conectado**: 1 cuando el cliente está conectado a EMQX, 0 en caso contrario (también cuando EMQX
  ya no lo conoce).
- **Última conexión**: fecha y hora de su última conexión, en la zona horaria de Gladys.

Los identificadores aparecen en la página **Clients** del panel. Zigbee2MQTT, por ejemplo, usa el
`client_id` de su configuración (`mqttjs_…` si no hay ninguno: asígnele antes uno fijo).

## Widget del panel

El widget **Broker EMQX** muestra el estado del broker, su versión, su tiempo en marcha, los nodos de
un clúster, las alarmas activas (hasta tres por su nombre) y cuatro mosaicos en directo: clientes,
mensajes recibidos, enviados y descartados por minuto. Elija el broker en sus ajustes.

## Disparadores de escena

| Disparador                | Cuándo                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Broker inaccesible        | La API no responde desde hace 1, 5, 15, 30 o 60 minutos (a elegir).                  |
| Broker de vuelta          | La API vuelve a responder tras una caída de al menos un minuto.                      |
| Broker reiniciado         | El tiempo en marcha de un nodo volvió a cero, incluso sin caída visible.             |
| Alarma activada           | EMQX activó una alarma. Variables: nombre de la alarma, mensaje, nodo.               |
| Alarma desactivada        | Una alarma ya no está activa. Variable: su duración en minutos.                      |
| Cliente desconectado      | Un cliente seguido ya no está conectado.                                             |
| Cliente reconectado       | Un cliente seguido vuelve a estar conectado. Variable: minutos desconectado.         |
| Menos clientes conectados | Menos clientes que el número elegido durante un minuto.                              |
| Pico de mensajes          | Más mensajes recibidos por minuto que el número elegido; como mucho cada 30 minutos. |

Tras un reinicio de la integración, la primera lectura sirve de referencia: una alarma ya activa o un
cliente ya ausente no activa nada.

## Acción de escena

**Estado del broker** da una frase lista para un mensaje («EMQX 5.8.6 lleva en marcha 3 días, 12
clientes conectados, 64 mensajes recibidos y 87 enviados por minuto, ninguna alarma.») y sus cifras:
accesible, clientes conectados, mensajes recibidos, enviados y descartados por minuto, alarmas activas
y sus nombres, tiempo en marcha en horas, versión.

## Ideas de escenas

- **Alarma activada** → enviarse un mensaje «Alarma de EMQX: {{message}} en {{node}}».
- **Cliente desconectado** para Zigbee2MQTT → avisar de que los dispositivos Zigbee ya no responden.
- Cada mañana, **Estado del broker** → enviar la frase de resumen a Telegram.
- **Broker inaccesible** desde hace 5 minutos → poner una luz en rojo.

## Solución de problemas

- **No se puede acceder a EMQX**: compruebe la dirección y el puerto (18083 por defecto, no el puerto
  MQTT 1883) y que Gladys llegue a él (cortafuegos, red Docker).
- **EMQX rechaza la clave de API**: compruebe la clave y el secreto, que la clave esté activada y no
  caducada. Una clave borrada en el panel debe crearse de nuevo.
- **No hay API de EMQX 5 en esta dirección**: la dirección lleva a otra cosa (puerto MQTT, otro
  servicio) o a EMQX 4.
- **Un cliente sigue desconectado**: compruebe su identificador exacto en la página **Clients** del
  panel (distingue mayúsculas).
- Más detalles: ponga `LOG_LEVEL=debug` y lea los registros de la integración.

## Límites

- Lectura cada 30 segundos: una desconexión más corta puede pasar desapercibida.
- Los flujos son medias calculadas por EMQX sobre 10 segundos, mostradas por minuto.
- 20 clientes seguidos como máximo; un identificador con un espacio no se puede seguir.
- Solo se leen las alarmas de EMQX, no las reglas, puentes o plugins en sí.
- EMQX 4 no es compatible.
