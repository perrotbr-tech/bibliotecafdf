# Entrega Préstamos — informe

specs/03 + specs/04 · rama `entrega-prestamos`

## 1. SHA entregado y versiones instaladas

**SHA entregado: la punta de `entrega-prestamos`, que es el head del PR.** Este
informe viaja en ese mismo commit y es el último de la rama; si aparece un commit
posterior, esta declaración deja de valer y hay que rehacerla. Se declara así, y
no con un número escrito a mano, porque un informe no puede contener el SHA del
commit que lo contiene: los dos intentos anteriores —`60e47a6` declarado en
`820ee62`, y `820ee62` declarado en `5aaabff`— se quedaron cada uno un commit
atrás. Base de la rama: `267866c` (`main`).

Las suites de §2 se corrieron sobre el árbol que publica ese commit, en este
contenedor:

- Node `v22.22.0` · npm `10.9.4` · OpenJDK `21.0.10` · firebase-tools `15.33.0`
- firebase SDK `12.19.0` · firebase-admin `14.5.0` · @firebase/rules-unit-testing `5.0.2`
- @playwright/test `1.56.1` · Chromium de Playwright

## 2. Casos de prueba

Los 82 casos de los dos documentos, cada uno con su estado. Salida de la
ejecución: `npm test` completo en este contenedor, cuyos totales están al final
de la tabla.

### specs/03 — Prestar y devolver (58 casos)

| ID | Estado | Dónde |
|---|---|---|
| P-01 | Pasa | `tests/reglas/prestamos.test.mjs`, `tests/e2e/prestamos.spec.mjs` |
| P-02 | Pasa | `tests/e2e/prestamos-concurrencia.spec.mjs` |
| P-03 | Pasa | `tests/e2e/prestamos-concurrencia.spec.mjs` |
| P-04, P-05 | **Sin prueba** | Doble toque en la pantalla. Declarado en §6 |
| P-06…P-11 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-12…P-16 | Pasa | `tests/unidad/fechas.test.mjs` |
| P-17, P-18 | Pasa | `tests/unidad/fechas.test.mjs` |
| P-19 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-20…P-26 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-27 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-28 | **Sin prueba** | Prestar → devolver → prestar, en pantalla. Declarado en §6 |
| P-29 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-30…P-32 | **Sin prueba** | Sin conexión y red cortada a mitad. Declarado en §6 |
| P-33, P-34 | **Sin prueba** | Dos teléfonos en vivo. Declarado en §6 |
| P-35…P-41 | **Sin prueba** | Navegación, avisos, medianoche y reloj. Declarado en §6 |
| P-42 | Pasa | `tests/unidad/fechas.test.mjs` |
| P-43 | **Sin prueba** | Préstamo con libro o lector fuera de memoria. Declarado en §6 |
| P-44 | Pasa | `tests/e2e/prestamos.spec.mjs` |
| P-45…P-47 | **Sin prueba** | 320 px, devolver y elegir, ficha de lector. Declarado en §6 |
| P-48 | Pasa en reglas; la mitad de interfaz, **sin prueba** | `tests/reglas/prestamos.test.mjs` |
| P-49…P-53 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-54 | Pasa | `tests/unidad/operaciones.test.mjs` |
| P-55, P-56 | Pasa | `tests/reglas/prestamos.test.mjs` |
| P-57 | Pasa | `tests/unidad/operaciones.test.mjs` |
| P-58 | Pasa | `tests/reglas/prestamos.test.mjs` |

### specs/04 — Atrasados y recordatorios (24 casos)

| ID | Estado | Dónde |
|---|---|---|
| R-01…R-08 | Pasa | `tests/unidad/mensajes.test.mjs` |
| R-09…R-11 | Pasa | `tests/reglas/prestamos.test.mjs` |
| R-12 | **Sin prueba** | Sin conexión al recordar. Declarado en §6 |
| R-13 | Pasa | `tests/unidad/mensajes.test.mjs` |
| R-14, R-15 | Pasa | `tests/unidad/listas.test.mjs` |
| R-16, R-17 | **Sin prueba** | Carácter no codificable y portapapeles. Declarado en §6 |
| R-18 | Pasa | `tests/reglas/prestamos.test.mjs` |
| R-19 | Pasa | `tests/reglas/prestamos.test.mjs` |
| R-20 | Pasa | `tests/unidad/mensajes.test.mjs` |
| R-21 | **Manual** | Android real, con el teléfono del dueño. Declarado en §6 |
| R-22…R-24 | **Sin prueba** | Transacción lenta, volver sin enviar, hora no verificada. Declarado en §6 |

### Recuento

| | specs/03 | specs/04 | total |
|---|---|---|---|
| Con su ID en una prueba | 39 | 17 | **56** |
| Sin prueba (interfaz) | 19 | 6 | **25** |
| Manual declarado | 0 | 1 | **1** |

La entrega llegó a contraprueba con 32 de los 82 y con una fila que decía «resto
P-/R- automatizables». Eso no cumplía la regla de AGENTS.md —cada caso
automatizable lleva su ID en la prueba— y por eso se cerraron 24 casos más antes
de pedir la revisión: anular y reabrir completos (P-20…P-26), los de reglas de la
revisión 1.1 (P-11, P-48…P-53, P-56, P-58), la concurrencia de cinco préstamos
(P-03), las dos decisiones de cliente ante un resultado incierto (P-54, P-57),
los bordes del vencimiento a las 23:00 (P-17, P-18), las listas del sábado
(R-14, R-15) y el largo de las plantillas (R-18). Los 25 que quedan son todos de
navegador y están listados uno por uno en §6.

### Totales de la corrida

| Suite | Resultado |
|---|---|
| `revisar` | sin hallazgos |
| unidad | **175** pass / 0 fail |
| reglas | **104** pass / 0 fail |
| scripts | **26** pass / 0 fail |
| e2e | **86** pass / 0 fail |
| carga | PENDIENTE-CARGA |

La entrega anterior declaraba 143 / 72 / 25 / 81 / 6. El crecimiento de unidad y
reglas son las pruebas que faltaban; el de e2e, P-03 y la regresión del reloj.

En este contenedor `www.gstatic.com` está bloqueado, así que las pruebas de
navegador sirven el SDK `12.19.0` desde `node_modules/firebase`, el mismo paquete
del mismo proveedor. Lo que queda sin probar aquí es la descarga real desde
gstatic; la cubre la prueba de humo del dueño en un teléfono.

### Dos correcciones sobre el SHA que fue a contraprueba

**1. La suite e2e estaba roja y el informe no lo decía.** El informe anterior
declaraba la regresión de las etapas 1 y 2 sobre unidad, reglas y scripts, y no
sobre e2e. Corriéndola completa, `acceso.spec.mjs` fallaba: exigía el texto
«Disponible pronto» en Inicio, que esta misma entrega implementó. La prueba
comprueba ahora lo que Inicio pinta —la jornada y sus cifras—.

**2. Y al corregirla apareció un fallo del producto: Inicio podía quedarse en
«Hora pendiente» para siempre.** La vista se monta antes de que vuelva la
sincronización del reloj, así que se pinta sin hora; `sincronizarYMostrarHora`
actualizaba la fecha de la barra pero no avisaba a la vista montada, y solo un
cambio en los datos la repintaba. Con una base pequeña las escuchas llegan antes
que el reloj, de modo que no llegaba ninguno: la primera pantalla del sábado se
quedaba en blanco hasta navegar a otra parte y volver. Es visible en la captura
del fallo: la barra mostraba la fecha y el cuerpo decía «Hora pendiente».

Corregido en `docs/js/main.js`, que ahora llama `alCambiarHora()` sobre la vista
montada, y en las cuatro pantallas que pintan según la hora —Inicio, Prestar,
Préstamos y Para recordar—, que lo implementan como ya implementaban
`alCambiarRed`.

Criterio falla/pasa comprobado en esta sesión: con la línea de aviso desactivada,
`tests/e2e/reloj.spec.mjs` «una pantalla pintada sin hora se repinta cuando la
hora del servidor llega» y `acceso.spec.mjs` fallan (2 failed / 21 passed); con
la línea puesta, 23 passed.

## 3. Tiempos y lecturas medidas

Todo con el procesador reducido a un cuarto, contra el emulador y en este
contenedor: no es una garantía de rendimiento en producción (base §3). La
prueba es `tests/carga/prestamos.carga.spec.mjs`.

### Abrir las pantallas, al tamaño real de la biblioteca (150 libros, 100 lectores, 20 préstamos abiertos, 200 devueltos)

Se miden dos cosas distintas, y el límite de 1 segundo del documento se compara
con la segunda:

| Qué | Mediana (mín.–máx.) | Límite | |
|---|---|---|---|
| Arranque en frío hasta la jornada pintada | 765 ms (517–1.139) | — | Entrar sincroniza el reloj con el servidor y levanta las tres escuchas. El documento no pone límite a esto |
| Abrir Inicio con la app ya abierta | 181 ms (162–183) | < 1 s | Cumple |
| Abrir Prestar | 180 ms (166–190) | < 1 s | Cumple |
| Abrir Préstamos (En curso) | 175 ms (151–192) | < 1 s | Cumple |

Abrir una pantalla es navegar a ella, que es como la Etapa 2 midió el catálogo.
El arranque en frío se declara aparte porque es lo primero que ve la persona del
sábado y no es comparable con las otras tres: incluye la sincronización del
reloj. Varía bastante entre corridas en este contenedor —765 ms de mediana aquí,
1.219 ms en la corrida anterior, con picos de 1,7 s—, así que el número que
importa es el orden de magnitud: alrededor de un segundo.

### El trabajo del teléfono al prestar y al devolver

Medido como tiempo de tarea del hilo principal, que no cuenta la espera de la
red, con el procesador a 1/4:

| Qué | Mediana (mín.–máx.) | Límite | |
|---|---|---|---|
| Prestar | 52 ms (44–425) | < 200 ms | Cumple |
| Devolver | **283 ms (266–457)** | < 200 ms | **No cumple** |

**Devolver no cumple el límite del documento, y la causa es la misma que
encarece las lecturas del sábado:** una devolución desde Inicio dispara dos
repintados completos de la pantalla —uno por el evento de escucha del préstamo y
otro por el del libro— y cada repintado relanza la consulta de «movimientos de
hoy». No es el guardado lo que cuesta: es pintar Inicio dos veces.

Queda declarado, no corregido: coalescer los repintados o dejar de relanzar esa
consulta en cada evento es un cambio en el arranque de la pantalla, más de lo que
una corrección de informe debería mover. La prueba fija un techo de 500 ms sobre
lo medido para que el número no empeore sin que nadie se entere, y el límite de
200 ms sigue escrito en la prueba sin tocar.

### Un sábado de 40 movimientos con 3 teléfonos

20 préstamos y 20 devoluciones repartidos entre tres teléfonos, sobre el tamaño
real de la biblioteca:

| | Medido | Cuota diaria | |
|---|---|---|---|
| Lecturas | 7.280 | 50.000 | 14,6 % |
| Escrituras | 100 | 20.000 | 0,5 % |

Las escrituras se cuentan por operación: prestar toca préstamo, libro y
contador; devolver toca préstamo y libro. Lo que domina las lecturas no es el
catálogo —que se lee una vez por apertura— sino la **consulta de «movimientos de
hoy», que se relanza en cada evento de escucha**: unos 2.000 de los 2.400
documentos que cada teléfono leyó. Es la misma causa de los 283 ms al devolver.
Con 150 libros cabe de sobra —un 14,6 % de la cuota del día— y es el número que
hay que volver a mirar cuando el catálogo crezca.

### Al volumen que pide specs/03 (5.000 libros, 3.000 lectores, 600 abiertos, 20.000 devueltos)

PENDIENTE-VOLUMEN

### Al volumen que pide specs/04 (600 abiertos, 400 atrasados)

PENDIENTE-RECORDAR

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

en `firestore.indexes.json`. Lo usa Devueltos. El emulador no exige índices
compuestos, así que esta declaración está comprobada leyendo las consultas, no
ejecutándolas contra un proyecto real: la prueba de humo del dueño es la que la
acredita.

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
  único número mezclaba la sincronización del reloj con el pintado de la
  pantalla y no se podía comparar con el límite del documento.
- `disponiblePronto` en `docs/js/ui/estados.js` **quedó sin usar**: esta entrega
  implementó Inicio, que era el último destino en espera. No se borra porque
  specs/05 y specs/06 vuelven a necesitar una pantalla en espera; queda
  declarado para que no pase por olvido.
- La siembra masiva de las pruebas de carga marcaba libros como prestados **sin**
  un préstamo detrás. Para préstamos eso es un estado imposible, así que
  `sembrarVolumen` lo hace opcional y la prueba de préstamos lo apaga.
- El escritor masivo de las pruebas de carga va **frenado** (300 operaciones por
  segundo): a su velocidad máxima el emulador devuelve `DEADLINE_EXCEEDED` antes
  de terminar las veinte mil escrituras.
- **P-54 y P-57 se prueban en unidad, no en reglas**, porque no son reglas: son
  la decisión del cliente ante una escritura cuyo resultado quedó incierto. La
  capa de datos que usan esas pruebas es la de verdad; lo falso es el SDK.
- El «trabajo del teléfono» de specs/03 se mide como **tiempo de tarea del hilo
  principal** (`Performance.TaskDuration` por CDP), que no cuenta la espera de la
  red. Es la lectura literal de «sin contar la red» del documento.

## 6. Pendiente para el dueño

### Pruebas manuales

- **R-21** en un Android real, con su teléfono.
- **Prueba de humo en el proyecto de ensayo** (la lista de specs/03 y specs/04):
  dos teléfonos, conflicto de préstamo, Devueltos después de que el índice
  termine de construirse, modo avión a mitad de un préstamo, y el recordatorio
  de WhatsApp abriendo el chat.
- El enlace de WhatsApp se ensaya **solo** con el número que Eduardo aporte
  expresamente.

### No listo para producción

- **Desplegar reglas e índices** en ensayo y esperar a que el índice compuesto
  termine de construirse:
  `firebase deploy --only firestore:rules,firestore:indexes --project biblioteca-fdf-ensayo`.
- **Generar el calendario**:
  `node scripts/generar-calendario.mjs --desde … --hasta … --proyecto … --confirmo-proyecto-real`.
- **Publicación de ensayo** del SHA candidato (contrato §1).
- **Los 25 casos de navegador sin prueba.** Todos necesitan pantalla, y algunos
  además dos teléfonos o cortar la red. Lo que falta, por grupos:
  - Doble toque: **P-04**, **P-05**.
  - Ciclo completo en pantalla: **P-28**.
  - Red: **P-30** (botones deshabilitados sin conexión), **P-31** y **P-32** (la
    red se corta entre el toque y la respuesta), **R-12** (recordar sin
    conexión), **R-22** (la navegación no espera el guardado).
  - Dos teléfonos en vivo: **P-33** (aparece en menos de 2 s), **P-34** (otro
    presta el libro elegido).
  - Flujo y avisos: **P-35** (aviso de atrasos), **P-36** («prestar otro»),
    **P-37** (salir a medio llenar), **P-41** (botón Atrás), **P-46** (devolver
    y elegir), **P-47** (ficha de lector con 2 abiertos y 9 devueltos),
    **P-43** (libro o lector fuera de memoria), **P-45** (título de 120 letras a
    320 px), **R-17** (el portapapeles rechaza la copia), **R-23** (volver sin
    enviar), la mitad de interfaz de **P-48** (el botón bloqueado un martes).
  - Reloj y día: **P-38** (sábado y martes), **P-39** (pasa la medianoche),
    **P-40** (teléfono con la fecha adelantada), **R-24** (hora no verificada).
  - Codificación: **R-16** (carácter que no se puede codificar).

  Son los que faltarían para cumplir del todo la regla de los IDs. La decisión de
  dejarlos declarados en vez de escribirlos ahora fue de Eduardo, para no
  retrasar la contraprueba; el criterio de gravedad lo pone el revisor.
