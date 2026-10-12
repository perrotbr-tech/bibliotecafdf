# Etapa 4 — Atrasados y recordatorios

> Revisión 1.1 · 11-10-2026. Leer también `specs/00-contrato-operativo.md`; define los detalles comunes y las correcciones de esta revisión.


## Objetivo

Que recordarle a un lector tome un toque: el voluntario abre WhatsApp con el mensaje ya escrito, y la app deja anotado que se le recordó.

## Entrega demostrable

En la lista de atrasados, un toque en «Recordar por WhatsApp» abre el chat del lector con el mensaje listo. Al volver a la app, el préstamo muestra «WhatsApp abierto hoy por Ana». Un jueves, la pantalla «Para recordar» muestra a quienes les vence un libro el sábado.

## Alcance

1. Botones «Recordar por WhatsApp» y «Copiar mensaje» en cada préstamo abierto de las listas de atrasados y de próximos a vencer.
2. Pantalla **Para recordar**, en «Más», con dos grupos: los que vencen el próximo sábado y los atrasados.
3. Registro del último recordatorio de cada préstamo.
4. Pantalla **Mensajes** para que el administrador edite las dos plantillas.

## Qué cambia de etapas anteriores

- En **Préstamos › Atrasados**, cada fila agrega los dos botones y la línea de último recordatorio.
- En **Inicio en día que no es sábado**, las listas «Vuelven ese día» y «Atrasados» agregan los mismos botones. No se crea una lista nueva en Inicio.
- En **Inicio en sábado** no cambia nada.

## Fuera del alcance de esta etapa

Envío automático de mensajes. El voluntario siempre envía desde su propio WhatsApp.

## Datos que toca

**`bibliotecas/{bib}/prestamos/{id}`**: se usan `recordadoEn` (hora del servidor) y `recordadoPor` (correo), nulos hasta el primer recordatorio.

**`bibliotecas/{bib}/lectores/{id}`**: se lee `telefono`, con formato `569XXXXXXXX` o nulo. Los lectores ya están en memoria; no hay lecturas adicionales.

**`bibliotecas/{bib}/config/app`**: `mensajeAtraso` y `mensajePrevio`, de 10 a 400 caracteres. Valores iniciales:

- Atraso: `Hola {nombre}, te escribimos de la biblioteca. El libro «{titulo}» venció el {fecha}. ¿Puedes traerlo este sábado? ¡Gracias!`
- Previo: `Hola {nombre}, te recordamos que el libro «{titulo}» de la biblioteca vence este {fecha}. ¡Te esperamos!`

## Reglas

**Sustitución.** `{nombre}` es la primera palabra del nombre del lector; `{titulo}`, el título del libro; `{fecha}`, el día de vencimiento escrito como «sábado 24 de octubre», con el año al final cuando no es el año en curso («sábado 21 de junio de 2025»). La sustitución se hace en **una sola pasada** sobre la plantilla, con una función de reemplazo: si un nombre o un título contiene `{titulo}`, `{nombre}`, `$&` o `$1`, ese texto sale tal cual y no se vuelve a interpretar.

**Enlace.** `https://wa.me/<telefono>?text=<mensaje codificado>`, con el teléfono del lector. El enlace es un `<a>` real que abre en otra pestaña dentro del gesto del usuario, sin esperar la transacción; usar `rel="noopener noreferrer"`. La persistencia de la apertura es independiente, según contrato §8. Si el lector no tiene teléfono, no hay botón de WhatsApp: se muestra «Sin teléfono» y queda «Copiar mensaje».

**Registro.** Al tocar «Recordar por WhatsApp» se guarda `recordadoEn` y `recordadoPor` en una transacción. Este botón es la única escritura que no se deshabilita sin conexión, porque su función principal es abrir el enlace. La app no puede saber si el mensaje se envió: el texto en pantalla dice «WhatsApp abierto» o «Mensaje preparado»: no afirma contacto ni envío. Si el guardado falla, el enlace se abre igual y la fila muestra «No se pudo anotar la apertura».

**Para no insistir de más.** Un préstamo recordado en los últimos 6 días muestra «WhatsApp abierto el (día) por (nombre)» y su botón pasa a segundo plano, aunque sigue disponible.

**Texto que no se puede codificar.** Si el mensaje no se puede codificar para el enlace, la fila muestra «No se pudo armar el mensaje» y el resto de la pantalla sigue funcionando.

## Reglas de seguridad

- Un voluntario puede modificar un préstamo `abierto` cambiando únicamente `recordadoEn`, `recordadoPor` y metadatos de operación, con `recordadoEn` igual a la hora del servidor y `recordadoPor` igual a su correo.
- `config/app.mensajeAtraso` y `mensajePrevio`: solo el administrador, con largo de 10 a 400 caracteres.

## Pantallas y comportamiento

**Préstamos › Atrasados.** Orden: primero los nunca recordados, luego del atraso más antiguo al más reciente. La lista completa se muestra de a 40 con «Mostrar más».

**Para recordar** (en «Más»).
- «Vencen el sábado (N)»: préstamos abiertos que vencen el próximo sábado. Usa `mensajePrevio`. Si hoy es sábado, son los del sábado siguiente; los de hoy están en «Vuelven hoy».
- «Atrasados (N)»: usa `mensajeAtraso`.
- Un lector con varios libros aparece una vez por libro; no se agrupan mensajes.

**Copiar mensaje.** Copia al portapapeles dentro del mismo toque. Si el navegador lo impide, abre una hoja con el texto seleccionable.

**Mensajes** (administrador, en «Más»). Dos cuadros de texto con vista previa en vivo usando un lector y un libro de ejemplo. «Guardar» valida el largo. Si la validación falla, lo escrito se conserva.

## Índices

Ninguno nuevo.

## Casos de prueba

| ID | Situación | Resultado esperado |
|---|---|---|
| R-01 | Lector «Ana Rojas», libro «Radical», vence 24-10-2026, hoy 31-10-2026 | «Hola Ana, … «Radical» venció el sábado 24 de octubre…» |
| R-02 | Vencimiento del 21-06-2025 visto en 2026 | `{fecha}` da «sábado 21 de junio de 2025» |
| R-03 | Lector de un solo nombre, «Pepita» | `{nombre}` da «Pepita» |
| R-04 | Lector llamado `{titulo}` | El saludo muestra `{titulo}` literal |
| R-05 | Título `{fecha} y {nombre}` | Sale literal dentro del mensaje |
| R-06 | Nombre o título con `$&`, `$1`, `$$` o comillas | Salen tal cual; el mensaje no se duplica |
| R-07 | Enlace de un lector con teléfono `56900000012` | `https://wa.me/56900000012?text=…`; no quedan llaves sin sustituir |
| R-08 | Lector sin teléfono | Sin botón de WhatsApp; «Sin teléfono» y «Copiar mensaje» |
| R-09 | Tocar «Recordar por WhatsApp» | Se guarda `recordadoEn` con la hora del servidor y `recordadoPor`; la fila muestra «WhatsApp abierto hoy por…» |
| R-10 | Voluntario intenta cambiar `venceEl` o `lector` junto con `recordadoEn` | Denegado |
| R-11 | Recordar un préstamo devuelto o anulado | Denegado |
| R-12 | Sin conexión, tocar «Recordar por WhatsApp» | El enlace se abre; la fila muestra «No se pudo anotar la apertura» |
| R-13 | Préstamo recordado hace 3 días / hace 7 días | Botón en segundo plano / botón principal |
| R-14 | Un jueves, «Vencen el sábado» | Solo préstamos abiertos que vencen ese sábado |
| R-15 | Un sábado, «Vencen el sábado» | Los del sábado siguiente; no los de hoy |
| R-16 | Título con un carácter que no se puede codificar | La fila avisa el problema; la lista completa sigue visible |
| R-17 | El portapapeles rechaza la copia | Se abre la hoja con el texto seleccionable |
| R-18 | Mensaje de 9 caracteres o de 401 al guardar | Rechazado; el texto escrito se conserva |
| R-19 | Voluntario intenta cambiar las plantillas | Denegado |
| R-20 | Mensaje con emojis y saltos de línea | Se codifica bien en el enlace |
| R-21 | (manual) En un teléfono Android real | El enlace abre el chat correcto con el mensaje escrito. Anotar el resultado |

### Casos adicionales de la revisión 1.1

| ID | Situación | Resultado esperado |
|---|---|---|
| R-22 | Transacción lenta o fallida al abrir WhatsApp | La navegación parte del toque original y no espera el guardado |
| R-23 | Abrir chat y volver sin enviar | La app solo informa apertura; nunca certifica envío/contacto |
| R-24 | Hora no verificada | Se permite abrir el enlace; no se presenta el registro temporal como confirmado |

## Carga y límites

Con 600 préstamos abiertos, 400 de ellos atrasados, y el procesador reducido a un cuarto:

- Abrir «Atrasados» y «Para recordar»: menos de 1 segundo.
- Abrir estas pantallas no produce lecturas nuevas: usan lo que ya está en memoria. Verificarlo con el contador de lecturas.

## Prueba de humo en el proyecto de ensayo (la ejecuta el dueño)

1. Desplegar reglas.
2. Poner su propio teléfono en un lector ficticio con un préstamo atrasado.
3. Tocar «Recordar por WhatsApp» desde un teléfono real: debe abrirse el chat con el mensaje.
4. Volver a la app: la fila debe decir «WhatsApp abierto hoy por…».

## Lista de entrega

- [ ] Pruebas de unidad de la plantilla y del enlace.
- [ ] Pruebas de reglas del registro de recordatorio y de las plantillas.
- [ ] `informes/etapa-4.md` con tiempos, lecturas medidas, pruebas manuales pendientes y lo que no está listo.
