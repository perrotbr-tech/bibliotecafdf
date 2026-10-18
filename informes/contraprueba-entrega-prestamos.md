# Contraprueba externa — entrega Préstamos

**SHA revisado:** `00a9de214cbf23221d5edad5cc6af021975696c1` (`00a9de2`)

La punta de `origin/entrega-prestamos` es ese mismo commit. No hay commits posteriores al informe. Revisor en otra sesión: no se modificó la rama `entrega-prestamos` ni ningún archivo de la entrega. Este archivo es el único entregable.

---

## 1. Ejecución de pruebas (esta máquina)

Entorno: Node `v22.14.0`, npm `10.9.9`, OpenJDK `21.0.12.1`, firebase-tools `15.33.0`, firebase SDK `12.19.0`, firebase-admin `14.5.0`, @firebase/rules-unit-testing `5.0.2`, @playwright/test `1.56.1`, Chromium de Playwright `141.0.7390.37`, proyecto `demo-biblioteca`.

El informe declara Node `v22.22.0`, npm `10.9.4` y OpenJDK `21.0.10`. Las versiones de los paquetes npm coinciden.

**Primera corrida de `npm test`:** `revisar`, unidad, reglas y scripts terminaron en verde con los números del informe. La suite e2e falló las 87 pruebas en unos 3,4 s cada una. Playwright no tenía su Chromium en la caché (en la máquina hay Google Chrome, que Playwright no usa). La sesión de terminal se cortó antes de guardar el texto del error. **Esas 87 no se dan por buenas.** Se instaló el Chromium de Playwright `141.0.7390.37` y se volvió a correr `npm test` entero. La tabla es la de esa segunda corrida.

| Suite | Declarado (§2) | Obtenido aquí | ¿Coincide? |
|---|---|---|---|
| `revisar` | sin hallazgos | sin hallazgos | Sí |
| unidad | 175 pass | 175 pass / 0 fail | Sí |
| reglas | 104 pass | 104 pass / 0 fail | Sí |
| scripts | 26 pass | 26 pass / 0 fail | Sí |
| e2e | 87 passed | 87 passed (1,6 min) | Sí, en la segunda corrida |
| carga | 12 passed | 12 passed (5,5 min) | Sí en conteo; los milisegundos no |

En esta red `www.gstatic.com` respondió: `[e2e] el SDK se baja de www.gstatic.com, como en producción.` El respaldo desde `node_modules` que describe el informe no se activó aquí.

### Tiempos y lecturas de `prueba:carga` (procesador a 1/4)

| Medida | Informe | Esta máquina |
|---|---|---|
| Arranque en frío hasta la jornada | 687 ms (535–972) | 458 ms (379–468) |
| Abrir Inicio, app ya abierta | 147 ms | 99 ms (96–103) |
| Abrir Prestar | 157 ms | 84 ms (83–88) |
| Abrir Préstamos (En curso) | 167 ms | 85 ms (80–92) |
| Trabajo al prestar (mediana) | 64 ms | 25 ms (22–218) |
| Trabajo al devolver (mediana) | **330 ms** | **139 ms** (137–253) |
| Sábado, 40 movimientos, 3 teléfonos | 7.497 lecturas (15,0 %) | **7.244 lecturas (14,5 %)**, 100 escrituras (0,5 %) |
| Abrir al volumen de specs/03 | 8.602 lecturas, 0 de 20.000 devueltos | 8.602 lecturas, 0 de 20.000 devueltos |
| Abrir Inicio a 5.000 libros | 10.498 ms | 5.582 ms |
| Abrir Atrasados / Para recordar | 73 ms / 284 ms | 26 ms / 158 ms |
| Lecturas al abrir esas dos pantallas | 1.602 → 1.602 | 1.602 → 1.602 |

Los milisegundos absolutos no se trasladan de un contenedor a otro. La conclusión cualitativa sí: teclas bajo 100 ms; navegación al tamaño real bajo 1 s; Inicio a 5.000 libros por encima de 1 s; abrir la app no lee el historial de devueltos. El 14,5 % que pide verificar el encargo se reprodujo (7.244 / 50.000). El 15,0 % del informe es otra corrida del mismo fenómeno.

La separación entre arranque en frío y navegación es la lectura que el documento permite: specs/03 no pone límite al arranque, y el segundo que sí pone se compara con abrir una pantalla ya con la app abierta. A 5.000 libros, Inicio sigue fuera de ese segundo (5.582 ms aquí). Está declarado en el informe y se reproduce. Es la misma forma que la Etapa 2 ya midió en el catálogo.

---

## 2. Los 82 casos

Recorridos P-01…P-58 y R-01…R-24 contra los nombres de prueba y contra §6 del informe.

Cada uno está en una de las dos listas. No hay un caso huérfano. El recuento 56 con ID en una prueba, 25 sin prueba de navegador y R-21 manual cuadra con los dos documentos. P-48 está en las dos, como dice el informe: la mitad de reglas tiene prueba y la de interfaz está en §6.

Eso no acredita que la prueba compruebe el caso. Los que no lo hacen están en la tabla.

---

## 3. Tabla de hallazgos

| ID | Archivo:línea | Qué está mal | Cómo reproducirlo | Gravedad | Criterio de corrección |
|---|---|---|---|---|---|
| **H-01** | `tests/e2e/prestamos.spec.mjs` 43–58 | La prueba se llama P-44 y afirma el rótulo «Orden por registro» con **un** préstamo devuelto. El caso pide buscar en Devueltos con 80 cargados, filtrar esos 80 y mostrar «Buscando en los 80 cargados». El informe lo da por pasado. El texto sí está en `docs/js/vistas/prestamos.js` 132–137; la prueba no lo toca. | Abrir la prueba: no hay siembra de 80, no hay `fill` en el buscador, no hay aserción de «Buscando en los». | **Menor** (el comportamiento está en la vista; la acreditación del caso es falsa) | Una prueba con el ID P-44 que cargue 80 devueltos, busque y exija el texto «Buscando en los 80 cargados» y que el filtro salga de esos 80. Hasta entonces P-44 no puede figurar como «Pasa». |
| **H-02** | `docs/js/vistas/libro.js` 68–84; `docs/js/vistas/lector.js` 5 y 60–69 | La ficha del libro sigue en la Etapa 2: estado, autor, categoría y veces prestado. No dice a quién está prestado, ni hasta cuándo, ni ofrece «Devolver», ni lee los últimos 5 préstamos (`libro == …`). La ficha del lector dice en el comentario que los préstamos «llegan en la Etapa 3» y no los muestra. specs/03 «Qué cambia» y P-47 lo piden. §6 anota P-47 como prueba de navegador pendiente: contra esta pantalla esa prueba no puede pasar, porque la pantalla no tiene el resultado. | Abrir la ficha de un libro prestado y la de un lector con préstamos. No hay lista ni botón «Devolver». Buscar `consultaDe` con `libro` o `lector` en `docs/js`: no hay ninguna. | **Impide fusionar** | Las dos fichas muestran lo que pide specs/03: libro prestado con lector, vencimiento y «Devolver», y sus últimos 5; lector con los abiertos (cada uno con «Devolver») y los 5 devueltos más recientes de los que tenga. Consultas `libro ==` y `lector ==` sin `orderBy`, ordenadas en el teléfono. P-47 deja de estar solo en §6 y tiene una prueba que exige 2 abiertos y 5 de 9 devueltos. |
| **H-03** | `docs/js/vistas/prestar.js` 288–301; `docs/js/main.js` 443; `docs/js/ui/avisos.js` 16–22; `docs/js/vistas/inicio.js` 226–227 | Tras prestar, la vista arma `deshacer` y `prestarOtro` y `alVolverInicio` los tira: navega a Inicio sin argumentos. `avisar` solo pinta un párrafo. No existe el botón «Deshacer» ni «Prestar otro a (nombre)» durante 10 segundos. El aviso de devolución es el mismo párrafo, sin «Deshacer». P-36 está en §6; el aviso que el caso usa no está construido. Anular y reabrir siguen en la ficha, dentro de la ventana de diez minutos. | Prestar un libro. El aviso dice «Prestado a …» y no ofrece los dos botones. Devolver desde Inicio: el aviso dice «Devuelto: …» y no ofrece «Deshacer». Buscar «Deshacer» y «Prestar otro» en `docs/js`: no hay controles con ese texto. | **Corregir antes de producción** | El aviso de préstamo, 10 segundos, ofrece «Deshacer» (anula ese préstamo) y «Prestar otro a (nombre)» (abre Prestar con ese lector y el libro vacío: P-36). El aviso de devolución ofrece «Deshacer» (reabre). Una prueba con esos ID cubre el toque. |
| **H-04** | `docs/js/vistas/recordatorio.js` 54–69 | Si el guardado del recordatorio falla, la vista llama `alActualizar({ errorApertura: true })`. Ningún llamador pasa `alActualizar`. La frase «No se pudo anotar la apertura» no está en el repositorio. El enlace `wa.me` sí se abre en el mismo toque. R-12 queda declarado como prueba pendiente de una fila que hoy no puede decir eso. | Buscar la frase en el árbol. Seguir los llamados de `botonesDeRecordatorio` en `inicio.js`, `prestamos.js` y `para-recordar.js`: ninguno pasa `alActualizar`. | **Menor** | Con el guardado fallido o sin conexión, la fila muestra «No se pudo anotar la apertura» y el enlace igual se abrió. R-12 deja de depender de un callback que nadie conecta. |
| **H-05** | `docs/js/operaciones.js` 533–563 | Un `permission-denied` de `prestarLibro` se reintenta hasta cinco veces y, si el libro no quedó prestado y el calendario existe, termina en «Hay mucho movimiento. Inténtalo de nuevo». Una cuenta desactivada a mitad, o un mantenimiento, sigue ese camino. El alta de lector ya distingue ese caso (líneas 157–162, pedido en la contraprueba de la Etapa 2). El préstamo no. | Con la sesión activa, desactivar al voluntario y llamar `prestarLibro` con libro libre y calendario presente. Tras los intentos, el mensaje es el de carrera. | **Menor** (no escribe de más; miente el motivo) | Si la relectura del libro o del contador viene `denegada`, devolver el denegado original, sin reetiquetarlo. Prueba de cliente que falle sin esa salida y pase con ella. |
| **H-06** | `docs/js/vistas/prestamo.js` 136–139; `firestore.rules` 278–280 | La regla cierra la ventana con `request.time < prestadoEn + 10 min` (y `devueltoEn` al reabrir). El botón usa `reloj.ahora()` y entra cuando la diferencia es `<=` 10 minutos. En el instante exacto de los diez minutos el botón se muestra y la regla lo deniega. Si la estimación va detrás del servidor, el botón sigue visible unos segundos después de que la regla ya cerró. La escritura sí usa `serverTimestamp()`; el desacuerdo es el del botón. | Comparar las dos expresiones. Con un préstamo cuyo `prestadoEn` es exactamente diez minutos antes de `request.time`, la ficha de quien lo creó muestra «Anular préstamo» y el lote de anulación se deniega. | **Menor** | El botón usa la misma cota que la regla (`<` diez minutos sobre la hora verificada) y, si la regla rechaza, el mensaje no invita a repetir como si el botón hubiera estado de más. Una prueba fija el borde. |
| **H-07** | `tests/carga/prestamos.carga.spec.mjs` 303–314; `docs/js/vistas/inicio.js` 160 y 269–278 | specs/03 pide menos de 200 ms de trabajo en el teléfono al devolver. En el contenedor de la entrega la mediana fue 330 ms y quedó sin corregir. Aquí la mediana fue **139 ms** (mínimo 137, máximo 253): la mediana cumple y el máximo no. La prueba imprime siempre «devolver NO cumple el límite de 200 ms» y solo afirma un techo de 500 ms, así que un verde de 139 ms queda escrito como incumplimiento. La causa del informe es real: cada evento de escucha repinta Inicio y relanza las dos consultas de «movimientos de hoy». En el sábado de 40 movimientos eso son 7.244 lecturas (14,5 % de 50.000), casi todas en `documentosDelServidor` (~2.000 por teléfono). Ese número crece con los movimientos del día y con los repintados, no con la cantidad de libros del catálogo. | `npm run prueba:carga` y leer la línea `[carga] devolver NO cumple` junto a la mediana. En esta máquina dice que no cumple con mediana 139. | **Menor** (el límite no se sostiene en todos los hosts; aquí la mediana sí entra; no corrompe datos ni se sale de la cuota del sábado medido) | La prueba compara la mediana con 200 ms y el mensaje dice lo que la comparación dio. Si en el host de entrega la mediana sigue sobre 200, coalescer los repintados o dejar de relanzar «movimientos de hoy» en cada evento, y volver a medir bajo 200. El informe deja de atribuir el crecimiento al tamaño del catálogo. |
| **H-08** | `tests/reglas/prestamos.test.mjs` 131–144, 181–190, 401–418, 440–451, 224–233 | Estos ID están en el nombre y el informe los da por pasados. La prueba cubre una parte del caso. **P-08:** solo un libro de baja; no hay libro inexistente, ni ya prestado, ni el mensaje. **P-55:** solo que el cliente no escribe el calendario; no hay préstamo con el sábado ausente. **P-22:** deniega anular ajeno y anular pasados diez minutos; no mira si el botón desaparece. **P-25:** deniega reabrir; no exige el mensaje «Ese libro ya salió otra vez». **R-09:** `assertSucceeds` del update; no lee `recordadoEn`/`recordadoPor` ni la fila «WhatsApp abierto hoy por…». | Leer cada prueba y el resultado esperado del caso en specs/03 y specs/04. | **Menor** | Cada prueba afirma el resultado que el caso escribe, o el informe parte el caso como ya hace con P-48 y mueve la mitad sin cubrir a §6. P-10 queda a salvo: `devueltoEn` distinto de la hora del servidor lo deniega P-53. |
| **H-09** | `docs/js/vistas/inicio.js` 64; `docs/js/vistas/prestar.js` 41–58 | Un martes, «Prestar un libro» queda habilitado si el rol es administrador, y Prestar le muestra los tres pasos. specs/03 bloquea Prestar hasta el sábado; el administrador entra por «Registrar desde papel», que es otra pantalla. `prestarLibro` sin diferido rechaza el día, y las reglas también: no se escribe. La persona llena el flujo y recibe el error. P-48 declara la mitad de interfaz como pendiente para el botón del voluntario; el hueco es la excepción del administrador. | Entrar como administrador con `?ahora=` en un martes. «Prestar un libro» se puede tocar y aparecen los tres pasos. | **Menor** | Fuera de sábado el flujo normal no se ofrece a nadie. El administrador ve «Registrar desde papel». El voluntario sigue viendo el bloqueo que ya tiene. |

### Puntos revisados sin hallazgos

| Área | Veredicto |
|---|---|
| Inventario de los 82 casos | **Revisado, sin hallazgos de caso huérfano.** Cada ID está en una prueba o en §6. Los que la prueba no acredita son H-01 y H-08. |
| Enlace préstamo + libro + contador, y el reintento | **Revisado, sin hallazgos de doble préstamo.** `prestamoId` se elige una vez, fuera del bucle (`operaciones.js` 513). `creacionId` es el `operacionId` que `guardar` reutiliza. Las reglas exigen con `getAfter` las tres puntas: libro apuntando a este id, contador N→N+1 con `ultimoPrestamoId`, préstamo con ese número. P-02, P-03 y P-51 cubren la carrera del libro, la del contador y dos altas que comparten un incremento. No apareció una secuencia que deje dos abiertos del mismo libro, dos con el mismo número, el contador subido sin préstamo, o `vecesPrestado` negativo: anular escribe −1 y la regla exige `vecesAntes >= 1`. El denegado real que se anuncia como carrera es H-05. |
| Calendario, cambio de hora y sábado futuro | **Revisado, sin hallazgos.** A mano: el 04-04-2026 empieza en `2026-04-04T03:00:00.000Z` y el 05-04 en `2026-04-05T04:00:00.000Z` (el sábado dura 25 h). `venceEl` de P-12 es `2026-04-05T03:59:59.999Z`, un milisegundo antes del domingo, y el delta con el préstamo de las 00:30 del 07-03 es 29 días y 30 minutos menos 1 ms. El 05-09 y el 06-09 empiezan ambos en `…T04:00:00.000Z`; el primer instante del 06-09 coincide con lo ya contraprobado en la Etapa 2. P-15 recorre 2026 y 2027 y pasó en la unidad. El diferido exige `inicio <= request.time` y no exige `request.time < finExclusivo`: salta la ventana de arriba y conserva la de abajo. P-50 deniega el sábado futuro. El cliente también lo rechaza con `diaSalida > diaEnChile(ahora)`. |
| Calendario sintético y reglas publicadas | **Revisado, sin hallazgos.** `generarCalendario` escribe `documentoDeCalendario`, solo sábados, sin marca de prueba. El sintético (`sintetico: true`, ventana de ±12 h) vive en la siembra de demo y en `documentoCalendarioSintetico`. Las reglas no tienen excepción de prueba: `match /calendario` niega create, update y delete. Los scripts comprueban `demo-` y los dos hosts de emulador. |
| P-56 | **Revisado, sin hallazgos de producto.** La prueba de reglas abre una ventana sintética de ±12 h alrededor de ahora y comprueba que `venceEl` sea el del documento y que `request.time` fuera de `inicio`/`finExclusivo` deniegue. No coloca `request.time` en la medianoche civil del sábado de cambio de hora: ese borde está en `documentoDeCalendario` y en P-12/P-15, revisados arriba. |
| Anular y reabrir | **Revisado, sin hallazgos de corrupción.** La ventana de la regla usa `request.time`, no la hora del teléfono. `vecesPrestado` baja uno al anular y no se mueve al devolver ni al reabrir. Un segundo anulado exige `estado == 'abierto'`. Reabrir exige libro libre y que el libro quede apuntando a este préstamo; si otro préstamo ya lo tomó, la transacción lo ve al reintentar. El desacuerdo del botón con la regla es H-06. La carrera reabrir/prestar no tiene prueba propia; la regla y el `throw` de `libroYaSalio` la cierran. |
| Recordatorio: sustitución, textos y gesto | **Revisado, sin hallazgos de patrón que se reinterprete.** `sustituirPlantilla` reemplaza en una pasada con función, así que `{titulo}`, `{fecha}`, `$&`, `$1`, `$$` y `$'` dentro del nombre o del título salen literales. R-04, R-05 y R-06 cubren los casos del documento; no apareció otra combinación que la función vuelva a leer. Los textos que existen dicen «WhatsApp abierto hoy por…» o «WhatsApp abierto el … por…». No dicen «enviado». La frase que falta es H-04. El `<a href>` navega en el toque y el guardado no se espera (R-22, declarado pendiente; el código hace esa parte). Ninguna prueba llama a un teléfono: los enlaces son `5690000…` de fixture. |
| Índices | **Revisado, sin hallazgos de índice faltante para las consultas que existen.** Son cuatro: `estado == 'abierto'` (escucha de `memoria.js`); `prestadoEn >=` y `devueltoEn >=` (movimientos de hoy, cada una sola); `estado == 'devuelto'` + `orderBy prestadoEn desc` (Devueltos). La última es el compuesto declarado en `firestore.indexes.json`. Las tres primeras usan el índice automático de un solo campo. No hay `orderBy` sobre otro campo. Las consultas `libro ==` y `lector ==` del documento no están en el código: son H-02. Si se agregan sin `orderBy`, el propio specs/03 dice que no piden otro compuesto. |
| Lecturas al abrir y cuota del sábado | **Revisado, sin hallazgos de diseño distinto al declarado.** 8.602 = 5.000 + 3.000 + 600 + 2, y 0 de los 20.000 devueltos. La escucha de préstamos es solo `estado == 'abierto'`. Devueltos se pide al abrir esa pestaña. El 14,5 % se reprodujo; de qué crece, en H-07. |
| specs/05, specs/06 y specs/07 | **Revisado, sin hallazgos.** No hay juego, ranking, cierre ni QR. `inicioJuego` y `juegoCerradoAlgunaVez` siguen siendo los de la Etapa 1. |
| Devolver a 330 ms, como número de esta máquina | La mediana de aquí es 139 ms. El juicio está en H-07: menor, y el mensaje de la prueba no puede seguir diciendo que no cumple cuando la mediana está bajo 200. |

---

## 4. Resumen para el implementador

Hay **un** hallazgo que impide fusionar: **H-02**, las fichas de libro y de lector no tienen los préstamos que specs/03 pide, y P-47 no es solo una prueba que falte.

Hay **uno** para corregir antes de producción: **H-03**, el aviso de diez segundos no ofrece «Deshacer» ni «Prestar otro». Por ese grado, la contraprueba se repite sobre el SHA de la corrección (AGENTS.md). H-02 tiene que ir en ese mismo SHA: no se cierra un bloqueo de fusión con una declaración.

H-01 y H-04…H-09 son menores. Se corrigen y se declaran, sin una segunda vuelta solo por ellos. H-01 pesa más que el resto de los menores: un ID en el nombre de una prueba que no mira lo que el caso pide.

Los 200 ms al devolver **no** se reproducen como mediana en esta máquina (139 ms, máximo 253). El 14,5 % de lecturas del sábado sí (7.244). Queda en H-07.
