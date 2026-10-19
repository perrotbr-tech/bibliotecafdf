# Contraprueba externa — entrega Préstamos, ronda 2

**SHA revisado:** `aaab6ee64aa0b9837ee59cecb43c8594361d0a8f` (`aaab6ee`)

La punta de `origin/entrega-prestamos` es ese mismo commit. Base `267866c`. Revisor en otra sesión: no se modificó la rama `entrega-prestamos` ni ningún archivo de la entrega. Este archivo es el único entregable.

## Veredicto de los nueve hallazgos de la ronda 1

| ID | Veredicto | Comprobado |
|---|---|---|
| H-01 | **CERRADO** | `tests/e2e/prestamos.spec.mjs` 160–186 siembra 120 devueltos, carga dos tandas hasta 80, busca y exige «Buscando en los 80 cargados». El filtro es `filtrarPrestamos` sobre ese arreglo (`docs/js/vistas/prestamos.js` 129–136), no una consulta nueva. La prueba no afirma que un título solo presente en los 40 no cargados quede fuera; el código sí lo deja fuera. |
| H-02 | **CERRADO** | `prestamos-de-ficha.js`: el libro muestra a quién, «Hasta el …» y «Devolver», y los 5 últimos; el lector, los abiertos con «Devolver» y 5 devueltos. La consulta es `libro ==` / `lector ==` sin `orderBy` (línea 138) y ordena en el cliente (145). No hay índice compuesto nuevo: `firestore.indexes.json` no cambió respecto de `00a9de2`. P-47 exige 2 abiertos, 2 «Devolver», 5 de 9 devueltos, «Libro 11» y «Libro 7», y niega «Libro 6». La ficha que queda vieja al deshacer es H-10, no este hallazgo. |
| H-03 | **CERRADO** | `avisos-de-prestamo.js` 44–51 llama a `anularPrestamo`; 73–78 llama a `reabrirPrestamo`. Diez segundos (`DURACION_AVISO_MS`). Si la regla deniega, el aviso pinta `resultado.mensaje` («Tu cuenta no tiene permiso para esta acción»), no un éxito. P-36 toca «Prestar otro a Ana» y exige el lector elegido y el libro vacío. P-45, a 320 px, exige «Deshacer» dentro de la pantalla y sin scroll horizontal. Ninguna de las dos pulsa «Deshacer» hasta la escritura: eso está en el código, no en la prueba. |
| H-04 | **CERRADO** | `recordatorio.js` 46–54 pinta «No se pudo anotar la apertura» en la propia fila cuando `anotarRecordatorio` no es éxito. R-12 corta la red, exige ese texto y que no aparezca «WhatsApp abierto…». El enlace es `wa.me` de fixture. |
| H-05 | **CERRADO** | `operaciones.js` 540–596: libro ya prestado → conflicto; calendario ausente → su mensaje; libro o contador `denegada`, o contador quieto, → la denegación (y mantenimiento si hay bloqueo); contador que se mueve → cinco intentos, mismo `operacionId`, `carrera-perdida`. Las tres pruebas de denegación en `tests/unidad/operaciones.test.mjs` exigen un intento y un mensaje que el bucle anterior no devolvía; la cuarta exige que la carrera siga siendo carrera. No se revirtió el árbol: las aserciones contradicen el código de `00a9de2`. |
| H-06 | **CERRADO** | `dentroDeDiezMinutos` usa `transcurrido < VENTANA_DE_DESHACER_MS` (`fechas.js` 363). La regla usa `request.time < desde + duration.value(10, 'm')` (`firestore.rules` 279). Anular mira `prestadoEn` (`prestamo.js` 37); reabrir mira `devueltoEn` (73). No se cruzan. P-22 de unidad fija el milisegundo: dentro a `ventana − 1`, fuera en el instante exacto. Con `<=` esa aserción falla. |
| H-07 | **CERRADO** | En esta corrida el mensaje fue «devolver cumple el límite de 200 ms del documento: mediana 150 ms (mínimo 124 ms, máximo 222 ms)». §3 ya no atribuye el crecimiento de lecturas al tamaño del catálogo: lo atribuye a «movimientos de hoy» relanzada en cada evento. La mediana de 362 ms del host de entrega sigue declarada y sin coalescer; el criterio del menor lo permitía. |
| H-08 | **CERRADO CON RESERVA** | P-08 afirma baja, inexistente y ya prestado en reglas, y los tres mensajes en unidad. P-55 afirma el préstamo sin calendario y la escritura del calendario denegada, dentro de la misma prueba (reglas sigue en 32 `test()` y en 104: no se perdieron casos, se alargaron P-08, P-55 y R-09). P-22 afirma denegación, borde y botón. P-25 afirma la denegación y «Ese libro ya salió otra vez». R-09 afirma `recordadoPor`, marca de ahora y la fila «WhatsApp abierto hoy por…». **Reserva:** la e2e de R-09 puede fallar al cruzar la medianoche de Chile. Ver abajo. |
| H-09 | **CERRADO** | `inicio.js` 70: `disabled: !esSab` para todos. El administrador ve «Registrar desde papel». `prestar.js` 49 cierra los tres pasos también para el administrador. P-48 entra como voluntaria y como administrador un martes (`2026-10-13`) y exige el botón deshabilitado y cero buscador. `papel.js` no está en el diff desde `00a9de2`: el diferido sigue llamando a `prestarLibro` con `registroDiferido: true`. |

## 1. Ejecución de pruebas (esta máquina)

Entorno: Node `v22.14.0`, npm `10.9.9`, OpenJDK `21.0.12.1`, firebase-tools `15.33.0`, firebase SDK `12.19.0`, firebase-admin `14.5.0`, @firebase/rules-unit-testing `5.0.2`, @playwright/test `1.56.1`, Chromium de Playwright `141.0.7390.37`, proyecto `demo-biblioteca`.

El informe declara Node `v22.22.0` y npm `10.9.4`. OpenJDK `21.0.12.1` coincide con la corrección que el propio informe anota. Chromium se instaló antes de `npm test`. Los puertos 8080 y 9099 estaban cerrados. Una sola pasada, `EXIT:0`.

| Suite | Declarado (§2) | Obtenido aquí | ¿Coincide? |
|---|---|---|---|
| `revisar` | sin hallazgos | sin hallazgos | Sí |
| unidad | 183 pass | 183 pass / 0 fail | Sí |
| reglas | 104 pass | 104 pass / 0 fail | Sí |
| scripts | 26 pass | 26 pass / 0 fail | Sí |
| e2e | 96 passed | 96 passed (1,6 min) | Sí |
| carga | 12 passed | 12 passed (5,7 min) | Sí en conteo; los milisegundos no |

En esta red `www.gstatic.com` respondió: `[e2e] el SDK se baja de www.gstatic.com, como en producción.`

Unidad creció 175 → 183 por ocho pruebas: A-34 (reloj), cuatro H-05, P-08, P-22 y P-25. Reglas no añadió `test()`: P-08, P-55 y R-09 se completaron dentro de las que ya existían. E2e creció 87 → 96 por las nueve pruebas nuevas de `prestamos.spec.mjs`.

### Tiempos y lecturas de `prueba:carga` (procesador a 1/4)

| Medida | Informe (su host) | Esta máquina |
|---|---|---|
| Arranque en frío hasta la jornada | 712 ms (691–998) | 394 ms (275–447) |
| Abrir Inicio, app ya abierta | 182 ms | 98 ms (96–98) |
| Abrir Prestar | 183 ms | 81 ms (78–85) |
| Abrir Préstamos (En curso) | 193 ms | 84 ms (81–94) |
| Trabajo al prestar (mediana) | 67 ms | 13 ms (12–199) |
| Trabajo al devolver (mediana) | **362 ms** | **150 ms** (124–222), mensaje «cumple» |
| Sábado, 40 movimientos, 3 teléfonos | 7.339 lecturas (14,7 %) | **7.480 lecturas (15,0 %)**, 100 escrituras (0,5 %) |
| Abrir al volumen de specs/03 | 8.602 lecturas, 0 de 20.000 devueltos | 8.602 lecturas, 0 de 20.000 devueltos |
| Abrir Inicio a 5.000 libros | 12.606 ms | 5.647 ms |
| Abrir Atrasados / Para recordar | 61 ms / 436 ms | 23 ms / 135 ms |
| Lecturas al abrir esas dos pantallas | 1.602 → 1.602 | 1.602 → 1.602 |

La mediana al devolver cae bajo 200 ms aquí y el máximo (222) no. Es el mismo filo que en la ronda 1 (139 ms, máximo 253). El 15,0 % del sábado se reprodujo (7.480 / 50.000). Inicio a 5.000 libros sigue fuera del segundo (5.647 ms), declarado.

## 2. Los 82 casos

Recorridos P-01…P-58 y R-01…R-24 contra los nombres de prueba y contra §2 y §7.

El recuento 60 con ID en una prueba, 21 de navegador, 1 manual y 0 sin implementar **no cuadra del todo**. 60 + 21 + 1 = 82 y no hay ID huérfano, pero **R-24 está en «sin prueba» y el resultado del caso no está en el producto**. Es H-11. El resto de los 21 tiene el comportamiento en el código y le falta la prueba de navegador: P-04 y P-05 (un toque, `prepararBotonGuardar`), P-30 (el botón se deshabilita con `!hayRed()`; la frase vive en el rechazo de `datos.js`), P-35, P-43, P-46, P-41 (la hoja cierra con Atrás), R-16, R-17, R-22 y R-23. No volvió a aparecer un P-47: una pantalla sin el resultado, anotada como prueba pendiente.

## 3. Hallazgos nuevos

| ID | Archivo:línea | Qué está mal | Cómo reproducirlo | Gravedad | Criterio de corrección |
|---|---|---|---|---|---|
| **H-10** | `docs/js/vistas/avisos-de-prestamo.js` 20–31; `docs/js/vistas/prestamos-de-ficha.js` 68–70; `docs/js/vistas/libro.js` 21 y 73–77 | La ficha lee una vez. Devolver desde ella sí relee la lista. «Deshacer» de ese aviso llama a `reabrirPrestamo` y no vuelve a leer: la hoja sigue mostrando el préstamo como devuelto, sin «Devolver», mientras el aviso dice que la devolución quedó deshecha. El rótulo de estado del libro se calcula al abrir y tampoco se repinta: tras devolver, la lista pasa a «Últimos préstamos» y el rótulo sigue en «Prestado». Anular desde otra pantalla del mismo teléfono no convive con la hoja: es modal y `ir` la cierra. Otro teléfono, con la hoja abierta, la deja vieja; eso está declarado en §5 del informe. El deshacer de la misma hoja, no. | Devolver un libro desde su ficha y tocar «Deshacer» antes de que pasen diez segundos. La lista sigue en «Devuelto». | **Menor** (la base queda reabierta; miente la hoja abierta) | Tras un deshacer exitoso disparado desde la ficha, la ficha vuelve a leer. Tras devolver, el rótulo de estado del libro coincide con la lista. |
| **H-11** | `docs/js/vistas/para-recordar.js` 26–28; `docs/js/vistas/inicio.js` 42–44 | R-24 pide abrir el enlace de WhatsApp sin hora verificada y no presentar el registro temporal como confirmado. El contrato bloquea el registro temporal, no el enlace. Sin `reloj.ahora()` las dos pantallas pintan solo «Hora pendiente» y no ofrecen el enlace. §2 lo lista como «sin prueba». Es «sin implementar». | Abrir Para recordar con el reloj en nulo. No hay «Recordar por WhatsApp». | **Menor** | Con la hora en nulo la fila ofrece el enlace y no afirma «WhatsApp abierto hoy…». R-24 deja de contarse como pantalla que ya hace el caso. |

### Puntos revisados sin hallazgos

| Área | Veredicto |
|---|---|
| `reloj` y `memoria` hasta las fichas | **Revisado, sin hallazgos.** `main.js` se los pasa a catálogo y lectores, y esos son los únicos que abren ficha. Si falta `memoria`, el bloque de préstamos no se monta (`memoria &&`), no lanza. Si falta `reloj` y hay memoria, la fecha sale «…». Ninguna ruta de la app abre la ficha sin los dos. |
| `alPrestarOtro` con `reemplazar: true` | **Revisado, sin hallazgos de producto.** Tras prestar, `alVolverInicio` ya reemplazó la entrada de Prestar por Inicio. «Prestar otro» reemplaza esa entrada por Prestar con el lector. Atrás vuelve a la pantalla que estaba debajo del Prestar original (Inicio, si se entró desde ahí). El lector vive en `opcionesVista`, no en el estado del historial: si se visita otra pantalla y se vuelve con Atrás, Prestar abre sin ese lector. P-36 no pide esa vuelta. |
| R-09 y la medianoche de Chile | El razonamiento es correcto y el informe lo dice mal: la prueba **sí** usa `?ahora=`, puesto en el instante real, no en 2026 fijo. El emulador escribe la hora real; un `?ahora=` de octubre de 2026 haría que la fila dijera «el …» en vez de «hoy». El reloj de prueba arranca en ese instante y avanza con `performance.now()`, unos segundos por detrás del sello del servidor. Solo falla si ese hueco cruza la medianoche de Chile. Es la reserva de H-08. |
| Aviso de diez segundos a 320 px, y el reemplazo por `id` | **Revisado, sin hallazgos.** `#avisos` va en el flujo, entre la barra y la pantalla: empuja, no tapa. Las acciones hacen `flex-wrap`. P-45 pasó. `quitarAviso` saca el nodo anterior; el temporizador viejo solo elimina ese nodo, no el aviso nuevo. |
| Índices | **Revisado, sin hallazgos.** Sigue habiendo un solo compuesto, `estado` + `prestadoEn`, para Devueltos. Las fichas no piden otro. |
| specs/05, specs/06 y specs/07 | **Revisado, sin hallazgos.** No hay juego, ranking, cierre ni QR. |

## 4. ¿Se puede fusionar?

**Sí.** No queda un hallazgo que impida fusionar ni uno «corregir antes de producción». H-02 y H-03, que obligaban a esta vuelta, están cerrados. H-10 y H-11 son menores: se corrigen y se declaran, sin una tercera contraprueba externa. Sigue fuera de este SHA lo que el informe deja para Eduardo: desplegar reglas e índice, generar el calendario, el humo en ensayo, R-21, y los 200 ms al devolver en un host lento.
