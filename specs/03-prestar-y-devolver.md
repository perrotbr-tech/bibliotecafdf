# Etapa 3 — Prestar y devolver

> Revisión 1.1 · 11-10-2026. Leer también `specs/00-contrato-operativo.md`; define los detalles comunes y las correcciones de esta revisión.


## Objetivo

Registrar préstamos y devoluciones de forma que dos voluntarios trabajando a la vez nunca dupliquen un préstamo ni un número, y que la pantalla de inicio sea la jornada del sábado.

## Entrega demostrable

Dos teléfonos abiertos el mismo sábado. En uno se presta un libro en tres decisiones; en el otro aparece al instante como prestado. Si ambos intentan prestar el mismo libro a la vez, uno lo logra y el otro recibe «Ese libro acaba de prestarse en otro teléfono». Una devolución toma un toque y se puede deshacer.

## Alcance

1. Pantalla **Inicio** como jornada del sábado.
2. Flujo **Prestar**.
3. **Devolver** desde Inicio, desde la pantalla Préstamos y desde las fichas de libro y de lector.
4. Pantalla **Préstamos** con tres vistas: En curso, Atrasados y Devueltos.
5. **Ficha del préstamo**, con las correcciones permitidas.
6. Reglas de seguridad de `prestamos` y de los campos de `libros` y `config/contadores` que cambian al prestar y devolver.
7. Calendario de confianza y `scripts/generar-calendario.mjs`, registro administrativo desde papel y fechas efectivas según contrato §4. El agente solo carga el calendario en demo; el dueño lo prepara en ensayo y real.

## Qué cambia de etapas anteriores

- **Ficha del libro.** Si está prestado, muestra a quién y hasta cuándo, con el botón «Devolver». Agrega sus últimos 5 préstamos, leídos al abrir la ficha con la consulta `libro == …`.
- **Ficha del lector.** Agrega sus préstamos abiertos, cada uno con «Devolver», y sus últimos 5 préstamos devueltos, leídos al abrir la ficha con la consulta `lector == …`.
- Esas dos consultas no piden orden al servidor, para no necesitar otro índice compuesto: los resultados se ordenan en el teléfono y se muestran los 5 más recientes.
- **Inicio, Prestar y Préstamos** dejan de mostrar «Disponible pronto».
- **Reglas de seguridad** de `libros` y de `config/contadores`: se agregan los cambios que esta etapa describe para `prestamoAbierto`, `vecesPrestado` y `ultimoPrestamo`.

## Fuera del alcance de esta etapa

Recordatorios por WhatsApp, puntos y ranking. Renovar un préstamo: se devuelve y se presta de nuevo.

## Datos que toca

**`bibliotecas/{bib}/prestamos/{id}`**. El identificador lo genera el cliente antes de la transacción y lo reutiliza si reintenta.

| Campo | Tipo | Regla |
|---|---|---|
| `numero` | entero | igual a `config/contadores.ultimoPrestamo` después de la operación; se muestra como `P172` |
| `libro` | texto | código de un libro existente, no dado de baja |
| `lector` | texto | identificador de un lector existente con `fusionadoEn` nulo |
| `prestadoEn` | marca de tiempo | hora del servidor al registrar |
| `salidaDia`, `plazoSabados` | texto y entero | salida efectiva en sábado y plazo 1–4, cotejados con calendario |
| `registroDiferido`, `motivoRegistroDiferido` | booleano y texto o nulo | solo administrador registra desde papel, contrato §4 |
| `venceEl` | marca de tiempo | idéntico al vencimiento de calendario para salidaDia y plazo; puede estar vencido en registro diferido |
| `temporada` | texto | `AAAA-B`, con B de 1 a 6 |
| `estado` | texto | `abierto` al crear; luego `devuelto` o `anulado` |
| `devueltoEn` | marca de tiempo o nulo | la hora del servidor al devolver |
| `devueltoATiempo` | booleano o nulo | nulo en devolución normal; fueATiempo deriva resultado tras confirmar; booleano reservado a corrección/legado |
| `correccionATiempo` | mapa o nulo | motivo, autor y hora de corrección administrativa |
| `devueltoPor` | texto o nulo | correo |
| `anuladoEn`, `anuladoPor` | marca de tiempo y texto, o nulos | |
| `creadoEn`, `creadoPor` | marca de tiempo y correo | |
| `origen` | texto | `app` |

**`bibliotecas/{bib}/libros/{codigo}`**: cambian `prestamoAbierto` (identificador del préstamo vigente o nulo) y `vecesPrestado`.

**`bibliotecas/{bib}/config/contadores`**: `ultimoPrestamo` sube en uno por préstamo.

**Vencimiento.** Con plazo de `k` sábados, el préstamo vence el k-ésimo sábado posterior al día de salida en hora de Chile; si sale un sábado, `7 × k` días después. `venceEl` es un milisegundo antes del primer instante del domingo siguiente, en `America/Santiago`. Un préstamo del sábado 10-10-2026 a 2 sábados vence el sábado 24-10-2026. Uno del martes 13-10-2026 a 1 sábado vence el sábado 17-10-2026. El plazo se guarda en `plazoSabados`; `salidaDia`, `temporada` y `venceEl` se validan contra el calendario de confianza del contrato §4. Los ejemplos en martes son solo funciones para datos legados.

**Temporada.** Bimestre del día de salida en hora de Chile: un préstamo del 10-10-2026 pertenece a `2026-5`.

**Hora.** Todos los cálculos usan la hora corregida con la del servidor, no el reloj del teléfono.

**Atraso.** Un préstamo abierto está atrasado cuando la hora corregida supera `venceEl`. Se expresa según los días entre el día de vencimiento y hoy, en hora de Chile: de 1 a 6 días, «Venció el sábado»; de 7 a 62, «Atrasado N sábados» con N = días ÷ 7 sin decimales; 63 o más, «Atrasado N meses» con N = días ÷ 30 sin decimales.

## Operaciones

Cada una es una sola transacción con `maxAttempts` en 5. El botón que la dispara queda deshabilitado hasta que la base responde, y el éxito se muestra solo entonces.

**Prestar.**
1. Lee el libro, el lector y el contador.
2. Falla si el libro no existe, está de baja o tiene `prestamoAbierto`; si el lector no existe o está fusionado.
3. Escribe el préstamo con `numero = ultimoPrestamo + 1` y `estado: abierto`, valida el calendario, la fecha efectiva y el modo de registro, sube el contador enlazando `ultimoPrestamoId`, pone `prestamoAbierto` en el libro y suma uno a `vecesPrestado`.

**Devolver.**
1. Lee el préstamo y el libro.
2. Falla si el préstamo no está `abierto`.
3. Pasa a `devuelto`, con `devueltoEn` en la hora del servidor, `devueltoATiempo:null`, `correccionATiempo:null` y `devueltoPor`; pone `prestamoAbierto` en nulo.

**Anular un préstamo abierto.** Pasa a `anulado`, con `anuladoEn` y `anuladoPor`; libera el libro y resta uno a `vecesPrestado`. El número no se reutiliza. Un préstamo devuelto no se anula: primero se reabre.

**Reabrir una devolución.** Solo si el libro sigue con `prestamoAbierto` nulo. Vuelve a `abierto`, limpia `devueltoEn`, `devueltoATiempo` y `devueltoPor`, y vuelve a poner `prestamoAbierto`.

**Corregir «a tiempo»** (administrador). En un préstamo `devuelto`, cambia `devueltoATiempo` y `correccionATiempo`, además de los metadatos de operación; exige motivo. El resultado ordinario se deriva, según contrato §5. Sirve para una devolución que se recibió a tiempo pero se registró después, por ejemplo un sábado sin señal.

## Reglas de seguridad

- **Crear un préstamo** exige, en la misma transacción: ser voluntario; `creadoPor` igual al correo de la sesión; `prestadoEn` y `creadoEn` iguales a la hora del servidor; `salidaDia`, `plazoSabados`, `venceEl` y `temporada` cotejados exactamente con el calendario inmutable; sábado vigente en el flujo normal o administrador con motivo para registro diferido no futuro; libro vigente cuyo `prestamoAbierto` era nulo y queda apuntando a este préstamo; lector no fusionado; `numero` igual al contador anterior más uno e igual al contador nuevo, cuyo `ultimoPrestamoId` enlaza este documento; `estado` `abierto`; campos de devolución y anulación en nulo.
- **Modificar un préstamo.** Un voluntario solo puede hacer estas transiciones, sin tocar ningún otro campo de negocio; las transiciones también actualizan los metadatos de operación:
  - **devolver:** de `abierto` a `devuelto`, con `devueltoEn` igual a la hora del servidor, `devueltoPor` igual a su correo, `devueltoATiempo` y `correccionATiempo` nulos, calculando el resultado después del commit, y el libro quedando libre;
  - **reabrir:** de `devuelto` a `abierto`, solo quien devolvió y dentro de los 10 minutos siguientes a `devueltoEn`, o el administrador en cualquier momento; el libro queda apuntando a este préstamo;
  - **anular:** de `abierto` a `anulado`, solo quien creó el préstamo y dentro de los 10 minutos siguientes a `prestadoEn`, o el administrador en cualquier momento; el libro queda libre.
- **Corregir «a tiempo»:** solo el administrador, solo en un préstamo `devuelto`, cambiando únicamente `devueltoATiempo`, su mapa de corrección auditado y metadatos de operación.
- `libros.prestamoAbierto` y `vecesPrestado` solo cambian junto con un préstamo que lo justifique en la misma transacción: de nulo a un identificador cuando ese préstamo queda `abierto`; de un identificador a nulo cuando ese préstamo queda `devuelto` o `anulado`.
- `config/contadores.ultimoPrestamo` solo pasa de N a N+1, enlazando `ultimoPrestamoId` al préstamo nuevo y sin tocar `ultimoLector` ni `ultimoLectorId`. El cambio aislado del contador está denegado.
- Nadie borra un préstamo.
- Anotar en el informe cuántas consultas a otros documentos usa cada operación. Máximo 10 por operación y 20 por transacción; incluir todas las lecturas de autorización, control y referencias, sin asumir caché.

## Pantallas y comportamiento

**Inicio en sábado.**
- Encabezado: «Sábado 10 de octubre».
- Dos botones grandes: «Prestar un libro» y «Registrar devolución». El segundo abre Préstamos en la vista En curso con el buscador listo.
- «Vuelven hoy (N)»: préstamos abiertos que vencen hoy, cada uno con su botón «Devolver».
- «Atrasados (N)»: los tres más antiguos y un enlace a la lista completa.
- «Movimientos de hoy»: préstamos y devoluciones del día, en vivo, con el voluntario que los hizo. Sale de dos consultas: préstamos con `prestadoEn` desde el inicio del día en Chile, y préstamos con `devueltoEn` desde ese mismo instante.

**Inicio en otro día.** El encabezado dice «Próximo sábado, 17 de octubre» y la primera lista pasa a ser «Vuelven ese día (N)», sin botón de devolver destacado. Devolver sigue disponible; Prestar se bloquea hasta el sábado. Solo el administrador puede «Registrar desde papel» con salida efectiva en sábado y motivo, según contrato §4.

**Prestar.** Una sola pantalla con tres pasos que se van completando:
1. **Libro.** Búsqueda por título, autor o código entre los disponibles. Si lo buscado está prestado, lo dice: «Está prestado a (lector) hasta el (fecha)», y ofrece «Registrar su devolución». Ese botón devuelve el libro y lo deja elegido en este paso, para el caso en que el libro está en la mano y su devolución nunca se anotó.
2. **Lector.** Búsqueda por nombre; no aparecen los lectores fusionados. Si tiene libros atrasados, se muestra una advertencia; el préstamo se permite igual. Botón «Inscribir un lector nuevo» sin salir del flujo.
3. **Plazo.** Cuatro opciones que muestran la fecha: «1 sábado · 17 oct», «2 sábados · 24 oct», y así hasta 4. Viene marcada la de `plazoSabadosPorDefecto`.

Botón final: «Prestar a (nombre)». Tras la confirmación de la base vuelve a Inicio con el aviso «Prestado a (nombre) hasta el sábado 24 de octubre», que durante 10 segundos ofrece «Deshacer» y «Prestar otro a (nombre)». Esta última abre Prestar con el mismo lector ya elegido.

El libro y el lector elegidos se limpian al salir del flujo; no quedan búsquedas ni errores viejos al volver.

**Devolver.** Un toque en «Devolver». Mientras espera, el botón muestra «Guardando…» y la fila no se mueve, para que un segundo toque no caiga sobre otro préstamo. Tras la confirmación, aviso «Devuelto: (título)» con «Deshacer» durante 10 segundos.

**Préstamos.**
- **En curso (N)** y **Atrasados (N)**: salen de los préstamos abiertos que la app ya tiene en memoria. Búsqueda por título, código, lector o número. En curso se ordena por vencimiento; Atrasados, del más antiguo al más reciente.
- **Devueltos**: sin cantidad. Carga de a 40 con «Cargar más», ordenada por fecha de salida descendente. El buscador busca solo entre los ya cargados y lo dice: «Buscando en los 80 cargados».
- Cada fila: código, título, lector, «salió el…», «vence el…» y estado.

**Ficha del préstamo.** Se abre al tocar una fila. Muestra número, libro, lector, fechas, quién lo registró y quién lo recibió. Acciones según el estado y las reglas:
- Abierto: «Devolver» y «Anular préstamo».
- Devuelto: «Reabrir» y, para el administrador, el interruptor «Fue devuelto a tiempo».
- Si la regla no lo permite (pasaron los 10 minutos y no es administrador), el botón no aparece y una línea lo explica: «Solo el administrador puede corregirlo».
- Anular y reabrir piden confirmación en la misma hoja.

**Conflictos y red.** Si la transacción falla porque otro voluntario se adelantó: «Ese libro acaba de prestarse en otro teléfono», y la pantalla se actualiza. Si agota los reintentos por congestión: «Hay mucho movimiento. Inténtalo de nuevo». Mientras la transacción no termina, el botón sigue bloqueado y, pasados 5 segundos, dice «Confirmando… no cierres la app». Si termina con error de red: «No se pudo confirmar el guardado»; al volver la conexión aplica la comprobación por operación del contrato §3. La existencia previa del préstamo no confirma una devolución o corrección; un estado sobrescrito se informa para revisión. Lo elegido se conserva y el nuevo intento reutiliza el mismo identificador.

## Índices

Uno compuesto, en `firestore.indexes.json`: colección `prestamos`, `estado` ascendente y `prestadoEn` descendente. Lo usa la vista Devueltos. Las consultas `estado == "abierto"`, `prestadoEn >= …`, `devueltoEn >= …`, `libro == …` y `lector == …` usan índices automáticos, siempre que no pidan orden por otro campo.

## Casos de prueba

| ID | Situación | Resultado esperado |
|---|---|---|
| P-01 | Prestar un libro disponible | Préstamo `abierto`; libro con `prestamoAbierto`; contador +1; `vecesPrestado` +1 |
| P-02 | Dos clientes prestan el mismo libro al mismo tiempo | Exactamente uno lo logra; el otro recibe el mensaje de conflicto; queda un solo préstamo abierto |
| P-03 | Cinco clientes prestan cinco libros distintos al mismo tiempo | Los que terminan tienen números distintos y consecutivos, sin huecos; los que no, muestran «Inténtalo de nuevo» y no dejan nada a medias |
| P-04 | Doble toque en «Prestar a…» | Un solo préstamo |
| P-05 | Doble toque sobre «Devolver» en una lista | Se devuelve un solo préstamo; el siguiente de la lista no cambia |
| P-06 | Crear un préstamo escribiendo directo en la base sin tocar el libro | Denegado |
| P-07 | Crear un préstamo con un número ya usado o saltando el contador | Denegado |
| P-08 | Prestar un libro dado de baja, inexistente o ya prestado | Denegado; mensaje claro |
| P-09 | Prestar a un lector fusionado o inexistente | Denegado |
| P-10 | `prestadoEn` o `devueltoEn` distintos de la hora del servidor | Denegado |
| P-11 | Regla: vencimiento o temporada distintos del calendario / registro normal fuera de sábado / registro desde papel con fecha válida por administrador | Denegado / denegado / permitido aunque el vencimiento ya pasó |
| P-12 | Cálculo, con la hora como parámetro: préstamo del sábado 07-03-2026 a las 00:30 hora de Chile, a 4 sábados | Vence el 04-04-2026, día de cambio de hora; `venceEl` es un milisegundo antes del domingo 05-04 en Chile, a 29 días y 30 minutos menos un milisegundo del préstamo |
| P-13 | Vencimientos: sábado 10-10 a 1, 2 y 4 sábados; martes 13-10 a 1; viernes 16-10 a 1; sábado 26-12-2026 a 2 | 17-10, 24-10 y 07-11; 17-10; 17-10; 09-01-2027 |
| P-14 | Préstamo a las 23:30 de un sábado en hora de Chile | El día de salida es ese sábado, aunque en UTC ya sea domingo |
| P-15 | Vencimientos calculados en cada sábado de 2026 y 2027 | Siempre caen en sábado y terminan un milisegundo antes del domingo en Chile |
| P-16 | Cálculo puro de temporada para fechas del 31-10 a las 23:30 y del 01-11 a las 00:10, hora de Chile | `2026-5` y `2026-6` |
| P-17 | Devolver el mismo día del vencimiento a las 23:00 | `fueATiempo(prestamo)` verdadero con timestamp confirmado |
| P-18 | Devolver al día siguiente del vencimiento | `fueATiempo(prestamo)` falso con timestamp confirmado |
| P-19 | Voluntario devuelve enviando un booleano de corrección en vez de nulo | Denegado |
| P-20 | Devolver un préstamo ya devuelto o anulado | Denegado |
| P-21 | Anular un préstamo abierto dentro de 10 minutos, por quien lo creó | Queda `anulado`; libro libre; `vecesPrestado` -1; el número no se reutiliza |
| P-22 | Anular un préstamo ajeno, o propio pasados 10 minutos, sin ser administrador | Denegado; el botón no aparece |
| P-23 | Administrador anula un préstamo abierto de hace un mes | Permitido |
| P-24 | Anular un préstamo devuelto | Denegado |
| P-25 | Reabrir una devolución cuando el libro ya fue prestado de nuevo | Denegado; mensaje «Ese libro ya salió otra vez» |
| P-26 | Reabrir dentro de 10 minutos por quien devolvió | Vuelve a `abierto`; campos de devolución en nulo; libro apuntando al préstamo |
| P-27 | Administrador corrige «Fue devuelto a tiempo» / un voluntario lo intenta / el administrador intenta cambiar otro campo a la vez | Permitido / denegado / denegado |
| P-28 | Prestar → devolver → prestar el mismo libro | Dos préstamos; nunca dos abiertos |
| P-29 | Borrar un préstamo | Denegado |
| P-30 | Sin conexión, tocar Prestar o Devolver | Botones deshabilitados con «Sin conexión: no se puede guardar»; nada se muestra como hecho |
| P-31 | La red se corta entre el toque y la respuesta, y el préstamo sí se aplicó | Sin aviso de éxito inmediato; al volver la red, «Sí quedó guardado»; no hay duplicado |
| P-32 | La red se corta y el préstamo no se aplicó | Al volver la red, «No se guardó. Inténtalo de nuevo»; libro y lector siguen elegidos |
| P-33 | Un préstamo hecho en otro teléfono | Aparece en Inicio y en Préstamos en menos de 2 segundos, sin recargar |
| P-34 | Otro teléfono presta el libro que tengo elegido en el paso 1 | El paso 1 avisa que ya no está disponible y pide elegir otro |
| P-46 | Buscar en el paso 1 un libro prestado y tocar «Registrar su devolución» | El préstamo queda devuelto y el libro queda elegido en el paso 1 |
| P-47 | Ficha de un lector con 2 préstamos abiertos y 9 devueltos | Muestra los 2 abiertos con «Devolver» y los 5 devueltos más recientes |
| P-35 | Lector con atrasos elegido en el paso 2 | Advertencia visible; el préstamo se permite |
| P-36 | «Prestar otro a (nombre)» desde el aviso | Abre Prestar con ese lector elegido y el libro vacío |
| P-37 | Salir del flujo a medio llenar y volver | Pasos vacíos, sin búsquedas ni errores anteriores |
| P-38 | Inicio en sábado y en martes | Encabezado y listas según el día, con el próximo sábado correcto |
| P-39 | La app queda abierta y pasa la medianoche | Al volver a primer plano, la fecha, «Vuelven hoy» y los atrasos se recalculan |
| P-40 | Teléfono con la fecha adelantada 3 días | El préstamo vence el sábado correcto y los atrasos se calculan con la hora real |
| P-41 | Botón Atrás con una ficha abierta | Cierra la ficha |
| P-42 | Atraso de 3, 7, 15 y 70 días | «Venció el sábado», «Atrasado 1 sábado», «Atrasado 2 sábados», «Atrasado 2 meses» |
| P-43 | Préstamo cuyo libro o lector no está en memoria | Se muestra con su código o identificador y «(no encontrado)»; la pantalla no falla |
| P-44 | Buscar en Devueltos con 80 cargados | Filtra esos 80 y muestra «Buscando en los 80 cargados» |
| P-45 | Título de una palabra de 120 letras en el aviso de devolución, a 320 px | El botón «Deshacer» sigue visible y dentro de la pantalla |

### Casos adicionales de la revisión 1.1

| ID | Situación | Resultado esperado |
|---|---|---|
| P-48 | Préstamo normal el martes desde interfaz y llamada directa | Bloqueado en UI y denegado en reglas |
| P-49 | Administrador registra el lunes un préstamo anotado el sábado | Conserva salidaDia, plazo, vencimiento y temporada del sábado; registro con hora actual |
| P-50 | Voluntario intenta diferido; fecha futura o no sábado; falta motivo | Denegado |
| P-51 | Dos préstamos distintos intentan compartir un único incremento | Denegado, incluso dentro de una sola transacción |
| P-52 | Contador aislado, incremento arbitrario de vecesPrestado o libro sin transición válida | Denegado |
| P-53 | Devolución iniciada antes de vencer y confirmada después | Se guarda una vez; fueATiempo usa la hora definitiva, sin booleano adelantado |
| P-54 | Préstamo ya existe pero la devolución incierta no ocurrió | No se confirma devolución por existencia del préstamo |
| P-55 | Falta calendario o el cliente intenta modificarlo | Préstamo bloqueado; escritura del calendario denegada |
| P-56 | Sábado de cambio horario y borde de medianoche | Límites coinciden con calendario; request.time decide aceptación |
| P-57 | Se recarga tras perder respuesta de escritura | Relee el servidor y evita reejecución automática de una intención antigua |
| P-58 | Registrado desde papel con conflicto de libro ya prestado | Se detiene para conciliación y conserva el préstamo existente |

## Carga y límites

Con 5.000 libros, 3.000 lectores, 600 préstamos abiertos y 20.000 devueltos en el emulador, y el procesador reducido a un cuarto:

- Abrir Inicio, Prestar y Préstamos: menos de 1 segundo cada una.
- Cada tecla en los buscadores: menos de 100 milisegundos.
- Trabajo en el teléfono al prestar y al devolver, sin contar la red: menos de 200 milisegundos.
- Abrir la app no lee el historial de devueltos: solo los abiertos y los movimientos de hoy. Verificarlo con el contador de lecturas.
- Lecturas y escrituras de un sábado de 40 movimientos con 3 teléfonos, comparadas con los límites diarios de 50.000 y 20.000.

## Prueba de humo en el proyecto de ensayo (la ejecuta el dueño)

1. Desplegar reglas e índices y esperar a que el índice termine de construirse.
2. Con dos teléfonos reales: prestar un libro en uno y verlo aparecer en el otro.
3. Elegir el mismo libro en ambos y tocar «Prestar» casi a la vez: uno debe recibir el mensaje de conflicto.
4. Devolver, deshacer y volver a devolver.
5. Abrir Préstamos › Devueltos: debe cargar sin error. Si falta el índice, aquí falla.
6. Activar el modo avión a mitad de un préstamo y comprobar el mensaje.

## Lista de entrega

- [ ] Transacciones y reglas con sus pruebas, incluidas las de concurrencia.
- [ ] Pruebas de unidad de `fechas.js` para los casos P-12 a P-16 y P-42.
- [ ] Pruebas de extremo a extremo con dos clientes simultáneos.
- [ ] `informes/etapa-3.md` con consultas por operación, tiempos, lecturas medidas y lo que no está listo.
