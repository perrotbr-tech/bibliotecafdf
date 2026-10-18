# Entrega Préstamos — informe

specs/03 + specs/04 · rama `entrega-prestamos` · **segunda vuelta**, tras la
contraprueba de `00a9de2` (`informes/contraprueba-entrega-prestamos.md`, rama
`cursor/contraprueba-prestamos`)

## 1. SHA entregado y versiones instaladas

**SHA entregado: la punta de `entrega-prestamos`, que es el head del PR.** Este
informe viaja en ese mismo commit y es el último de la rama; si aparece un commit
posterior, esta declaración deja de valer y hay que rehacerla. Se declara así, y
no con un número escrito a mano, porque un informe no puede contener el SHA del
commit que lo contiene. Base de la rama: `267866c` (`main`).

La contraprueba revisó `00a9de2`. Este SHA es el de la corrección: lleva H-02 y
H-03 —el bloqueo de fusión y el de «antes de producción»— en el mismo commit de
entrega, como pide AGENTS.md, y los siete menores.

Versiones de este contenedor, verificadas en esta sesión:

- Node `v22.22.0` · npm `10.9.4` · OpenJDK `21.0.12.1` · firebase-tools `15.33.0`
- firebase SDK `12.19.0` · firebase-admin `14.5.0` · @firebase/rules-unit-testing `5.0.2`
- @playwright/test `1.56.1` · Chromium de Playwright

Corrección sobre el informe anterior: declaraba OpenJDK `21.0.10` y el instalado
es `21.0.12.1`. Node y npm sí eran los de este contenedor; los `v22.14.0` /
`10.9.9` del informe de contraprueba son los de la máquina del revisor.

## 2. Casos de prueba

Los 82 casos, cada uno con su estado. Un caso puede estar en tres sitios, y la
contraprueba enseñó a no mezclarlos: **sin prueba** es que la pantalla hace lo
que el caso pide y falta la prueba de navegador que lo acredite; **sin
implementar** es que el resultado del caso no existe todavía en el producto.
El informe anterior puso P-36, P-45 y P-47 en la primera lista cuando eran de la
segunda, y dio P-44 por pasado con una prueba que no miraba su caso (H-01, H-02 y
H-03). En este SHA no queda ninguno sin implementar.

Salida de la ejecución: un `npm test` completo en el terminal de esta sesión, de
una sola pasada y con las seis suites en verde; los totales están al final.

### specs/03 — Prestar y devolver (58 casos)

| ID | Estado | Dónde |
|---|---|---|
| P-01 | Pasa | `tests/reglas/prestamos.test.mjs`, `tests/e2e/prestamos.spec.mjs` |
| P-02, P-03 | Pasa | `tests/e2e/prestamos-concurrencia.spec.mjs` |
| P-04, P-05 | **Sin prueba** | Doble toque en la pantalla. Declarado en §7 |
| P-06, P-07, P-09…P-11 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-08 | Pasa | `tests/reglas/prestamos.test.mjs` (baja, inexistente, ya prestado) + `tests/unidad/operaciones.test.mjs` (el mensaje de cada uno) |
| P-12…P-16 | Pasa | `tests/unidad/fechas.test.mjs` |
| P-17, P-18 | Pasa | `tests/unidad/fechas.test.mjs` |
| P-19…P-21, P-23, P-24, P-26 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-22 | Pasa | `tests/reglas/prestamos.test.mjs` (la denegación) + `tests/unidad/fechas.test.mjs` (el borde al ms) + `tests/e2e/prestamos.spec.mjs` (el botón) |
| P-25 | Pasa | `tests/reglas/prestamos.test.mjs` + `tests/unidad/operaciones.test.mjs` (el mensaje «Ese libro ya salió otra vez») |
| P-27 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-28 | **Sin prueba** | Prestar → devolver → prestar, en pantalla. Declarado en §7 |
| P-29 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-30…P-32 | **Sin prueba** | Sin conexión y red cortada a mitad. Declarado en §7 |
| P-33, P-34 | **Sin prueba** | Dos teléfonos en vivo. Declarado en §7 |
| P-35, P-37…P-41 | **Sin prueba** | Aviso de atrasos, salir a medio llenar, día, medianoche, reloj adelantado, botón Atrás. Declarado en §7 |
| P-36 | Pasa | `tests/e2e/prestamos.spec.mjs` |
| P-42 | Pasa | `tests/unidad/fechas.test.mjs` |
| P-43 | **Sin prueba** | Préstamo con libro o lector fuera de memoria. Declarado en §7 |
| P-44 | Pasa | `tests/e2e/prestamos.spec.mjs` (80 devueltos cargados, filtro sobre esos 80 y el texto «Buscando en los 80 cargados») |
| P-45 | Pasa | `tests/e2e/prestamos.spec.mjs` |
| P-46 | **Sin prueba** | Devolver desde el paso 1 y quedarse con el libro elegido. Declarado en §7 |
| P-47 | Pasa | `tests/e2e/prestamos.spec.mjs` |
| P-48 | Pasa | `tests/reglas/prestamos.test.mjs` (la llamada directa) + `tests/e2e/prestamos.spec.mjs` (el martes en pantalla, voluntaria y administrador) |
| P-49…P-53 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-54 | Pasa | `tests/unidad/operaciones.test.mjs` |
| P-55 | Pasa | `tests/reglas/prestamos.test.mjs` (préstamo sin calendario + escritura denegada) |
| P-56 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-57 | Pasa | `tests/unidad/operaciones.test.mjs` |
| P-58 | Pasa | `tests/reglas/prestamos.test.mjs` |

### specs/04 — Atrasados y recordatorios (24 casos)

| ID | Estado | Dónde |
|---|---|---|
| R-01…R-08 | Pasa | `tests/unidad/mensajes.test.mjs` |
| R-09 | Pasa | `tests/reglas/prestamos.test.mjs` (marca del servidor y quién) + `tests/e2e/prestamos.spec.mjs` (la fila «WhatsApp abierto hoy por…») |
| R-10, R-11 | Pasa | `tests/reglas/prestamos.test.mjs` |
| R-12 | Pasa | `tests/e2e/prestamos.spec.mjs` (sin conexión: el enlace se abre y la fila dice «No se pudo anotar la apertura») |
| R-13 | Pasa | `tests/unidad/mensajes.test.mjs` |
| R-14, R-15 | Pasa | `tests/unidad/listas.test.mjs` |
| R-16, R-17 | **Sin prueba** | Carácter no codificable y portapapeles. Declarado en §7 |
| R-18, R-19 | Pasa | `tests/reglas/prestamos.test.mjs` |
| R-20 | Pasa | `tests/unidad/mensajes.test.mjs` |
| R-21 | **Manual** | Android real, con el teléfono del dueño. Declarado en §7 |
| R-22…R-24 | **Sin prueba** | Transacción lenta, volver sin enviar, hora no verificada. Declarado en §7 |

### Recuento

| | specs/03 | specs/04 | total |
|---|---|---|---|
| Con su ID en una prueba | 42 | 18 | **60** |
| Sin prueba (navegador) | 16 | 5 | **21** |
| Manual declarado | 0 | 1 | **1** |
| Sin implementar | 0 | 0 | **0** |

La entrega llegó a la primera contraprueba con 32 de los 82; el SHA revisado
tenía 56, de los que cuatro no acreditaban su caso. Este tiene 60 y ninguno
prestado. Los 21 que faltan son todos de navegador y están uno por uno en §7.

### Totales de la corrida

| Suite | Resultado | En `00a9de2` |
|---|---|---|
| `revisar` | sin hallazgos | sin hallazgos |
| unidad | **183** pass / 0 fail | 175 |
| reglas | **104** pass / 0 fail | 104 |
| scripts | **26** pass / 0 fail | 26 |
| e2e | **96** passed / 0 failed | 87 |
| carga | **12** passed / 0 failed | 12 |

Reglas se queda en 104 porque P-08, P-55 y R-09 se completaron **dentro** de las
pruebas que ya existían, en vez de añadir otras: el caso lo pide entero, no en
tres pruebas con el mismo ID.

En este contenedor `www.gstatic.com` está bloqueado, así que las pruebas de
navegador sirven el SDK `12.19.0` desde `node_modules/firebase`, el mismo paquete
del mismo proveedor; en la red del revisor sí respondió gstatic y la suite pasó
igual. Lo que queda sin probar aquí es la descarga real; la cubre la prueba de
humo del dueño en un teléfono.

## 3. Tiempos y lecturas medidas

Todo con el procesador reducido a un cuarto, contra el emulador (base §3: no es
una garantía de rendimiento en producción). La prueba es
`tests/carga/prestamos.carga.spec.mjs`. Se declaran **dos** columnas: este
contenedor y la máquina del revisor, porque la contraprueba demostró que los
milisegundos absolutos no se trasladan de un host a otro y que en algún límite
eso cambia el veredicto. Lo que sí se traslada es la forma, y es lo que cada
tabla concluye.

### Abrir las pantallas, al tamaño real (150 libros, 100 lectores, 20 abiertos, 200 devueltos)

| Qué | Aquí | Revisor | Límite | |
|---|---|---|---|---|
| Arranque en frío hasta la jornada pintada | 712 ms (691–998) | 458 ms (379–468) | — | El documento no pone límite a esto |
| Abrir Inicio con la app ya abierta | 182 ms (170–212) | 99 ms | < 1 s | Cumple |
| Abrir Prestar | 183 ms (165–186) | 84 ms | < 1 s | Cumple |
| Abrir Préstamos (En curso) | 193 ms (167–197) | 85 ms | < 1 s | Cumple |

El límite de 1 segundo se compara con abrir una pantalla estando la app abierta,
que es como la Etapa 2 midió el catálogo. El arranque en frío va aparte porque
incluye la sincronización del reloj y el levantamiento de las tres escuchas; es
también la medida que más varía aquí (687, 712, 765 y 1.219 ms de mediana en
cuatro corridas, con picos de 1,7 s).

### El trabajo del teléfono al prestar y al devolver

Tiempo de tarea del hilo principal, que no cuenta la espera de la red:

| Qué | Aquí | Revisor | Límite | |
|---|---|---|---|---|
| Prestar | 67 ms (63–496) | 25 ms (22–218) | < 200 ms | Cumple en los dos |
| Devolver | **362 ms** (261–565) | **139 ms** (137–253) | < 200 ms | Cumple allá, no aquí |

Las medianas al devolver medidas aquí en cuatro corridas: 283, 330, 331 y 362 ms.
El incumplimiento en este host no es un pico, es el número.

**El límite cae de un lado o del otro según el host, y la causa es la misma en
los dos:** una devolución desde Inicio dispara dos repintados completos de la
pantalla —uno por el evento de escucha del préstamo y otro por el del libro— y
cada repintado relanza la consulta de «movimientos de hoy». No es el guardado lo
que cuesta: es pintar Inicio dos veces. Eso crece con los movimientos del día y
con los repintados, **no con el tamaño del catálogo**; el informe anterior lo
atribuía al catálogo y era falso (H-07).

Queda declarado, no corregido: coalescer los repintados o dejar de relanzar esa
consulta en cada evento es un cambio en el arranque de la pantalla, más de lo que
una corrección de contraprueba debería mover sin pedirlo. La prueba compara la
mediana con los 200 ms del documento y **dice lo que la comparación dio** —antes
imprimía siempre «NO cumple», así que el verde de 139 ms del revisor quedaba
escrito como incumplimiento—; lo que exige es un techo de 500 ms sobre lo medido,
para que el número no empeore sin que nadie se entere.

### Un sábado de 40 movimientos con 3 teléfonos

| | Aquí | Revisor | Cuota diaria |
|---|---|---|---|
| Lecturas | 7.339 (14,7 %) | 7.244 (14,5 %) | 50.000 |
| Escrituras | 100 (0,5 %) | 100 (0,5 %) | 20.000 |
| Accesos de reglas estimados | 682 | — | — |

Las escrituras se cuentan por operación: prestar toca préstamo, libro y
contador; devolver toca préstamo y libro. Lo que domina las lecturas es la
consulta de «movimientos de hoy» relanzada en cada evento —unos 2.000 de los
2.400 documentos de cada teléfono—, la misma causa del punto anterior. Al tamaño
real cabe de sobra, y es el número que hay que volver a mirar cuando crezcan los
movimientos de un sábado.

### Al volumen que pide specs/03 (5.000 libros, 3.000 lectores, 600 abiertos, 20.000 devueltos)

**Abrir la app no lee el historial de devueltos.** Es la medición que el
documento pide con el contador de lecturas, y acredita el diseño de `memoria.js`
—escuchar solo `estado == 'abierto'`—. Idéntica en los dos hosts:

| | Documentos |
|---|---|
| Por escucha (catálogo + lectores + préstamos abiertos) | 8.600 = 5.000 + 3.000 + 600 |
| Lecturas puntuales (configuración y movimientos de hoy) | 2 |
| **Total leído** | **8.602** |
| De los 20.000 devueltos sembrados | **0** |

| Qué | Aquí | Revisor | Límite | |
|---|---|---|---|---|
| Cada tecla en el buscador de libros de Prestar | 18 ms (11–25) | — | < 100 ms | Cumple |
| Cada tecla en el buscador de Préstamos | 21 ms (7–30) | — | < 100 ms | Cumple |
| Abrir Prestar | 202 ms | — | < 1 s | Cumple |
| Abrir Inicio | 12.606 ms | 5.582 ms | < 1 s | **No cumple a este volumen** |

Abrir Inicio a 5.000 libros no cumple en ninguno de los dos hosts, y no es nuevo:
es la misma forma que la Etapa 2 midió en el catálogo —la apertura crece con el
número de documentos, porque la pantalla los lee en vivo—. Al tamaño real son
147 ms. La paginación sobre el tamaño real es lo que base §12 manda evaluar, y
ahí se cumple.

### Al volumen que pide specs/04 (700 libros, 300 lectores, 600 abiertos, 400 atrasados)

| Qué | Aquí | Revisor | Límite | |
|---|---|---|---|---|
| Abrir Atrasados | 61 ms (58–109) | 26 ms | < 1 s | Cumple |
| Abrir Para recordar, **antes** de paginar | 1.676 ms (1.533–1.688) | — | < 1 s | No cumplía |
| Abrir Para recordar, **ya paginada** | **436 ms** (432–456) | 158 ms | < 1 s | Cumple |
| Lecturas nuevas al abrir las dos pantallas | **0** (1.602 → 1.602) | 0 (1.602 → 1.602) | ninguna | Cumple |

### Margen fino que conviene vigilar

La prueba de carga del catálogo (Etapa 2, `tests/carga/catalogo.carga.spec.mjs`)
midió aquí 1.385 ms en una corrida, 875 ms en la siguiente y 886 ms (máximo
1.640) en la de esta entrega, contra un límite de 1.000 ms: el margen es del
ancho de la variación de este contenedor compartido. No es un hallazgo de
producto —el revisor midió la misma forma con holgura— pero una corrida roja de
esa prueba en este host no significa por sí sola una regresión.

Las medidas de carga de este informe son las de la corrida de `npm run
prueba:carga` de esta sesión, 12 pass / 0 fail. El contenedor estuvo más lento
que en la corrida anterior —se ve en las tres aperturas y en el catálogo—, y es
justo lo que la segunda columna existe para poner en contexto.

## 4. Accesos de reglas e índices

Conservadores (sin asumir caché), por operación:

| Operación | Accesos (máx. por op.) | Notas |
|---|---|---|
| Prestar (préstamo+libro+contadores) | 6 / 4 / 3 → ≤14 en la tx | voluntario, control, calendario, lector, getAfter libro/contadores |
| Devolver / anular / reabrir | ≤4 | voluntario, control, getAfter libro |
| Recordar WhatsApp | 2 | voluntario + control |
| Corregir a tiempo | 2 | admin + control |

Índice compuesto declarado (el primero del proyecto):

```json
prestamos: estado ASC, prestadoEn DESC
```

en `firestore.indexes.json`. Lo usa Devueltos. Las consultas nuevas de las fichas
—`libro ==` y `lector ==`— van **sin** orden del servidor y se resuelven con el
índice automático de un solo campo: specs/03 lo pide así para no declarar otro
compuesto, y la contraprueba lo confirmó. El emulador no exige índices
compuestos, así que la declaración está comprobada leyendo las consultas, no
ejecutándolas contra un proyecto real: la prueba de humo del dueño es la que la
acredita. El diagnóstico del proyecto de ensayo dice que **el compuesto todavía
no existe allí**.

## 5. Decisiones tomadas

- **Devueltos** ordena por `prestadoEn` descendente y muestra la etiqueta visible
  «Orden por registro» (contrato §4).
- Al **reabrir** se limpian `devueltoEn`, `devueltoATiempo`, `devueltoPor` y
  `correccionATiempo`.
- **Calendario sintético** solo en demo para E2E, reglas y carga (contrato §2);
  el generador canónico usa America/Santiago.
- Corrección del informe de la Etapa 2: `firestore.indexes.json` nunca tuvo
  índice; esta entrega declara el primero.
- El despliegue del dueño pasa a `--only firestore:rules,firestore:indexes`
  (PASOS + README).
- **El SHA de entrega se declara por la punta de la rama**, no por un número
  escrito dentro del propio commit. §1 explica por qué.
- **La apertura se mide partida** en arranque en frío y navegación, porque un
  único número mezclaba la sincronización del reloj con el pintado de la pantalla
  y no se podía comparar con el límite del documento.
- **Los tiempos se declaran en dos columnas**, este contenedor y el del revisor.
  Un solo host no decide un límite que cae a un lado o a otro según la máquina.
- `disponiblePronto` en `docs/js/ui/estados.js` **quedó sin usar**: esta entrega
  implementó Inicio, que era el último destino en espera. No se borra porque
  specs/05 y specs/06 vuelven a necesitar una pantalla en espera.
- La siembra masiva de carga marcaba libros como prestados **sin** un préstamo
  detrás; para préstamos es un estado imposible, así que `sembrarVolumen` lo hace
  opcional y la prueba de préstamos lo apaga.
- El escritor masivo de carga va **frenado** (300 operaciones por segundo): a su
  velocidad máxima el emulador devuelve `DEADLINE_EXCEEDED`.
- **P-54 y P-57 se prueban en unidad, no en reglas**, porque no son reglas: son
  la decisión del cliente ante una escritura cuyo resultado quedó incierto. La
  capa de datos de esas pruebas es la de verdad; lo falso es el SDK. Lo mismo
  vale ahora para los mensajes de P-08 y P-25: una regla no devuelve texto.
- El «trabajo del teléfono» de specs/03 se mide como **tiempo de tarea del hilo
  principal** (`Performance.TaskDuration` por CDP), que no cuenta la espera de la
  red. Es la lectura literal de «sin contar la red».
- **«Para recordar» pagina de 40 en 40 por grupo**, con el total en el título.
  specs/04 no dice nada de tandas ahí; se le aplica la convención del repositorio
  porque sin ella no cumplía su propio límite de 1 segundo.
- **Las fichas leen una vez, al abrirse, y no dejan escucha.** Una ficha es una
  hoja que se mira y se cierra, y el historial de un libro no cambia mientras
  está abierta; tras devolver desde la ficha, se relee.
- **«Deshacer» no es un truco de interfaz**: es la operación que corresponde
  —anular el préstamo recién hecho, reabrir la devolución recién hecha— y las
  reglas solo la permiten dentro de los diez minutos y a quien la hizo. Si la
  ventana se pasó, el servidor deniega y el aviso lo dice.
- **La ventana de los diez minutos vive en `docs/js/fechas.js`**
  (`dentroDeDiezMinutos`), no en la ficha: es la misma clase de regla de fecha que
  el resto de ese archivo y así su borde se fija al milisegundo en unidad.
- **Fuera de sábado, Prestar está cerrado para todos**, administrador incluido.
  Su camino es «Registrar desde papel», que es otra pantalla y pide el motivo.
- La prueba de navegador de **R-09 usa la hora real, no `?ahora=`**: la marca la
  pone el servidor y el emulador escribe la hora real, así que una hora falsa de
  2026 haría que la fila dijera «el domingo 18 de octubre» en vez de «hoy» por un
  desacuerdo del fixture y no del producto.

## 6. Lo que hizo la contraprueba

Los nueve hallazgos de `informes/contraprueba-entrega-prestamos.md`, qué se hizo
con cada uno y cómo se demostró. Lo que se construyó no se narra: está en el
diff.

| Hallazgo | Gravedad | Qué se hizo | Falla/pasa |
|---|---|---|---|
| **H-02** fichas de libro y lector sin préstamos | Impide fusionar | `docs/js/vistas/prestamos-de-ficha.js`: el libro muestra quién lo tiene, hasta cuándo y «Devolver», más sus últimos 5; el lector, los abiertos con «Devolver» y los 5 devueltos más recientes. Consultas `libro ==` / `lector ==` sin orden del servidor, ordenadas en el teléfono | Sin la implementación, 4 de las 8 pruebas de `prestamos.spec.mjs` fallan; con ella, 8 pasan |
| **H-03** el aviso no ofrece «Deshacer» ni «Prestar otro» | Antes de producción | `docs/js/vistas/avisos-de-prestamo.js` y `avisar(..., { acciones })`: diez segundos con «Deshacer» (anula o reabre) y «Prestar otro a (nombre)», que abre Prestar con ese lector y el libro vacío | Igual que H-02: las pruebas P-36 y P-45 fallan sin ella |
| **H-01** la prueba P-44 no miraba su caso | Menor | Prueba rehecha: 80 devueltos cargados, filtro sobre esos 80 y el texto «Buscando en los 80 cargados». La antigua se queda con el nombre que le corresponde, el del rótulo «Orden por registro» | — |
| **H-04** «No se pudo anotar la apertura» no existía | Menor | La fila lo dice ella misma (`docs/js/vistas/recordatorio.js`), sin depender de un `alActualizar` que nadie conectaba | Sin la línea, la prueba R-12 falla; con ella, pasa |
| **H-05** un denegado de verdad acababa en «Hay mucho movimiento» | Menor | `prestarLibro` distingue los cuatro casos como ya hacía el alta de lector: libro ya prestado, falta de calendario, denegación real (ni el libro ni el contador se pueden leer, o el contador no se movió) y carrera | Sin la salida, 3 de las 4 pruebas H-05 de unidad fallan; con ella, 4 pasan, y la carrera sigue acabando en `carrera-perdida` |
| **H-06** el botón abría la ventana un instante más que la regla | Menor | La cota pasa a estricta, `<` diez minutos, en `dentroDeDiezMinutos` | Con `<=`, la prueba P-22 de unidad falla; con `<`, pasa |
| **H-07** la prueba de carga imprimía siempre «NO cumple» | Menor | El mensaje dice lo que la comparación dio, con mínimo y máximo; §3 declara las dos medianas y deja de atribuir el crecimiento al catálogo | En la corrida de esta entrega, con mediana 362 ms, imprime «devolver NO cumple el límite de 200 ms del documento: mediana 362 ms (mínimo 261 ms, máximo 565 ms)»; con una mediana bajo 200 diría «cumple» |
| **H-08** cinco pruebas cubrían parte de su caso | Menor | P-08 (baja, inexistente, ya prestado + los tres mensajes), P-55 (préstamo sin calendario + escritura denegada), P-22 (denegación + borde + botón), P-25 (+ el mensaje «Ese libro ya salió otra vez») y R-09 (+ la marca del servidor y la fila «WhatsApp abierto hoy por…») | — |
| **H-09** el administrador entraba a Prestar un martes | Menor | Fuera de sábado la pantalla está cerrada para todos; el administrador ve «Registrar desde papel» | Sin el cambio, la prueba P-48 de navegador falla; con él, pasa |

### Lo que ya traía este SHA de antes de la contraprueba

- La suite e2e del SHA anterior estaba roja y el informe no lo decía:
  `acceso.spec.mjs` exigía «Disponible pronto» en Inicio, que esta entrega
  implementó. Corregida para comprobar lo que Inicio pinta.
- Al corregirla apareció un fallo del producto: **Inicio podía quedarse en «Hora
  pendiente» para siempre**. La vista se monta antes de que vuelva la
  sincronización del reloj y nada la repintaba. Corregido con `alCambiarHora()`
  (2 failed / 21 passed sin la línea; 23 passed con ella).
- **El reloj verificado se quedaba en la cinta de correr.** Cada intento escribía
  un `sincronizacionId` nuevo y leía el del intento anterior, así que descartaba
  las tres muestras y la app se quedaba sin hora: es lo que el diagnóstico del
  proyecto de ensayo vio tres veces de tres, sin que recargar lo arreglara.
  Corregido en `docs/js/reloj.js` aceptando la muestra propia con su propio
  ancla (13 pass / 1 fail sin el arreglo; 14 pass con él).
- **«Para recordar» pintaba todas sus filas de golpe** y pasaba del segundo
  (1.676 ms con 400 atrasados). Paginada: 284 ms.

## 7. Pendiente para el dueño

### Pruebas manuales

- **R-21** en un Android real, con su teléfono.
- **Prueba de humo en el proyecto de ensayo** (la lista de specs/03 y specs/04):
  dos teléfonos, conflicto de préstamo, Devueltos después de que el índice
  termine de construirse, modo avión a mitad de un préstamo, y el recordatorio de
  WhatsApp abriendo el chat.
- El enlace de WhatsApp se ensaya **solo** con el número que Eduardo aporte
  expresamente.

### No listo para producción

- **Desplegar reglas e índices** en ensayo y esperar a que el compuesto termine
  de construirse:
  `firebase deploy --only firestore:rules,firestore:indexes --project biblioteca-fdf-ensayo`.
  El diagnóstico dice que allí hay reglas reales desplegadas y **ningún índice
  compuesto**.
- **Generar el calendario** en ensayo, que está vacío:
  `node scripts/generar-calendario.mjs --desde … --hasta … --proyecto … --confirmo-proyecto-real`.
  Sin él no se puede prestar.
- **Limpiar los dos registros de prueba** que quedaron en ensayo: el libro
  `INF001` y el lector «Lector Prueba Ensayo».
- **Publicación de ensayo** del SHA candidato (contrato §1). Lo publicado hoy son
  las etapas 1 y 2 desde `main/docs`.
- **Los 21 casos de navegador sin prueba.** Todos necesitan pantalla, y algunos
  además dos teléfonos o cortar la red:
  - Doble toque: **P-04**, **P-05**.
  - Ciclo completo en pantalla: **P-28**.
  - Red: **P-30** (botones deshabilitados sin conexión), **P-31** y **P-32** (la
    red se corta entre el toque y la respuesta), **R-22** (la navegación no
    espera el guardado).
  - Dos teléfonos en vivo: **P-33** (aparece en menos de 2 s), **P-34** (otro
    presta el libro elegido).
  - Flujo y avisos: **P-35** (aviso de atrasos), **P-37** (salir a medio llenar),
    **P-41** (botón Atrás), **P-43** (libro o lector fuera de memoria), **P-46**
    (devolver y elegir), **R-17** (el portapapeles rechaza la copia), **R-23**
    (volver sin enviar).
  - Reloj y día: **P-38** (sábado y martes), **P-39** (pasa la medianoche),
    **P-40** (teléfono con la fecha adelantada), **R-24** (hora no verificada).
  - Codificación: **R-16** (carácter que no se puede codificar).

- **Devolver sobre 200 ms en hosts lentos** (§3). Está medido, declarado y con
  techo en la prueba; corregirlo es cambiar el arranque de Inicio.
