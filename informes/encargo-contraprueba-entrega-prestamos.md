# Encargo de contraprueba — entrega Préstamos (specs/03 + specs/04)

Para pegar en una sesión NUEVA, sobre un clon limpio del repositorio. No la hace
quien escribió el código: eso es justamente lo que falta.

Es **una sola** contraprueba. Se repite solo si un hallazgo viene calificado
«antes de producción»; los menores se corrigen y quedan declarados en el informe
(AGENTS.md).

---

## Comando para pegar

> Eres el revisor de la entrega Préstamos de este repositorio. No eres el
> implementador: **no modificas la rama**. Tu trabajo es describir hallazgos, con
> su reproducción, su gravedad y el criterio de corrección, para que el
> implementador los arregle y se vuelva a contraprobar (AGENTS.md).
>
> 1. Lee `AGENTS.md`, `specs/00-contrato-operativo.md`, `specs/00-base.md`,
>    `specs/03-prestar-y-devolver.md`, `specs/04-atrasados-y-recordatorios.md` y
>    `PROMPT-MAESTRO-CURSOR.md`.
> 2. Ponte en el SHA que declara `informes/entrega-prestamos.md` §1. Es la punta
>    de `entrega-prestamos` y el head del PR. Si la rama tiene commits
>    posteriores, la declaración del informe ya no vale: dilo y revisa el SHA
>    declarado, no la punta.
> 3. Instala y corre TODO, sin saltarte nada: `npm ci && npm test`. Anota los
>    números y compáralos con los que declara el informe en §2. Si una suite no
>    corre en tu máquina, dilo: no la des por buena.
> 4. Revisa el diff de la entrega contra `main`: `git diff main...entrega-prestamos`.
> 5. Entrega un informe con una tabla de hallazgos: archivo y línea, qué está
>    mal, cómo reproducirlo, gravedad (impide fusionar / corregir antes de
>    producción / menor) y qué criterio usarías para considerarlo corregido. Si
>    no encuentras nada en un punto, dilo explícitamente: «revisado, sin
>    hallazgos» vale más que el silencio.

---

## Los cuatro lugares donde más puede haber un error

No es para que mires solo ahí. Es para que empieces por ahí, porque es donde la
especificación no alcanzaba o donde el implementador tuvo que decidir.

### 1. El enlace de tres documentos del préstamo, y su reintento

`docs/js/operaciones.js` (`prestarLibro`, `INTENTOS_DE_PRESTAMO`) y las reglas de
`prestamos`, `libros` y `config/contadores` en `firestore.rules`.

Prestar escribe tres documentos en una transacción: el préstamo, el libro y el
contador. Cada regla exige ver a las otras dos ya escritas con `getAfter`, así
que media escritura se deniega. Igual que en el alta de lector de la Etapa 2, una
carrera del contador llega como `permission-denied` y no como aborto
reintentable, y el cliente reintenta.

Qué mirar con desconfianza:

- ¿Puede ese reintento dejar **dos préstamos abiertos del mismo libro**, o dos
  con el mismo número, en alguna secuencia de carreras? P-02, P-03 y P-51 lo
  prueban: busca un camino que esas pruebas no cubran.
- ¿Puede quedar un préstamo **sin** que el libro apunte a él, o el contador
  subido sin préstamo? ¿Y `vecesPrestado` desalineado tras una anulación?
- El `prestamoId` y el `operacionId` tienen que sobrevivir al reintento, y el
  `creacionId` del documento tiene que ser ese mismo `operacionId`. Si no, la
  comprobación por identidad del contrato §3 no sirve.
- Un `permission-denied` **real** —un voluntario desactivado a mitad— ¿acaba
  diciendo «Inténtalo de nuevo» cuando debería decir otra cosa?

### 2. El calendario de confianza, y qué pasa cuando no está

`scripts/generar-calendario.mjs`, `docs/js/fechas.js` y `calendarioCoincide` en
`firestore.rules`.

El vencimiento y la temporada no los calcula el cliente: los copia del documento
de calendario, y la regla comprueba que coincidan exactamente. La ventana del
sábado decide si el registro normal entra; el diferido del administrador se salta
la ventana de arriba pero no la de abajo.

Qué mirar con desconfianza:

- Los bordes del cambio de hora en Chile: 04 y 05 de abril, 05 y 06 de
  septiembre de 2026. P-12, P-15 y P-56 los prueban; comprueba a mano que el
  vencimiento cae donde dice y que `venceEl` es un milisegundo antes del domingo.
- El calendario sintético de las pruebas (contrato §2) solo puede existir en
  demo. Comprueba que **ninguna** prueba lo siembra en otro proyecto y que las
  reglas publicadas no tienen ninguna excepción de prueba.
- ¿Qué pasa cuando el calendario se agota? El README declara el último sábado
  disponible. Comprueba que la app bloquea el préstamo con un mensaje claro
  (P-55) y no deja pasar un vencimiento inventado.
- El registro diferido conserva `salidaDia`, `plazoSabados`, `venceEl` y
  `temporada` del sábado, con hora de registro de ahora (P-49). ¿Puede un
  administrador registrar un sábado **futuro** con esa puerta?

### 3. Anular y reabrir: la ventana de diez minutos

Las reglas de `prestamos` (los tres bloques `allow update`) y
`docs/js/operaciones.js` (`anularPrestamo`, `reabrirPrestamo`).

Son las operaciones que deshacen, y las que más pueden corromper el estado: un
libro que queda prestado a nadie, un `vecesPrestado` que baja de cero, una
devolución reabierta cuando el libro ya salió otra vez.

Qué mirar con desconfianza:

- La ventana de diez minutos se mide contra `prestadoEn` al anular y contra
  `devueltoEn` al reabrir, con `request.time`. ¿Hay algún camino en que se mida
  contra una hora del cliente?
- `vecesPrestado` baja exactamente uno al anular y no se mueve al devolver o
  reabrir. ¿Puede quedar negativo? ¿Puede un administrador anular dos veces?
- Reabrir exige que el libro esté libre. P-25 prueba el caso del libro que ya
  salió otra vez; busca la carrera entre reabrir y prestar.
- El botón no aparece cuando la regla no lo permite, y una línea lo explica.
  ¿Coincide siempre lo que la pantalla oculta con lo que la regla deniega? Si la
  pantalla muestra un botón que la regla va a denegar, es un hallazgo.

### 4. El recordatorio de WhatsApp: lo que la app puede y no puede afirmar

`docs/js/mensajes.js`, `docs/js/vistas/recordatorio.js` y la regla de
`recordadoEn`.

La app abre un enlace `wa.me` y anota que lo abrió. No puede saber si el mensaje
se envió, y el contrato le prohíbe decir que sí.

Qué mirar con desconfianza:

- La sustitución de `{nombre}`, `{titulo}` y `{fecha}` no puede dejar que el
  contenido del lector o del título se interprete como patrón de reemplazo.
  R-04, R-05 y R-06 lo prueban; busca otra combinación que se cuele.
- La fila dice «WhatsApp abierto hoy por…», nunca «enviado». Comprueba cada
  texto de la pantalla, no solo el del caso (R-23).
- La navegación tiene que partir del toque original y no esperar el guardado
  (R-22). Si el enlace se abre después de una transacción lenta, el navegador del
  teléfono lo bloquea.
- Ningún número de los fixtures es real y **no se contacta** (contrato §…). Si
  encuentras una prueba que llame a un número de verdad, ese es el hallazgo.

---

## Lo que el informe declara y hay que verificar, no dar por bueno

| Lo que dice el informe | Cómo comprobarlo |
|---|---|
| Los casos con ID en §2 pasan | Corre `npm test` y cuenta. Si un caso tiene su ID en el nombre de una prueba pero la prueba no comprueba lo que el caso pide, es un hallazgo —y vale más que cualquier otro. |
| 56 de los 82 casos tienen su ID en una prueba; 19 de specs/03 y 6 de specs/04 **no tienen prueba**, y R-21 es manual | Comprueba que la lista de §6 está completa: recorre los 82 casos de los dos documentos y verifica que cada uno está o cubierto con su ID o declarado como pendiente. Un caso que no esté en ninguna de las dos listas es un hallazgo. Y si un ID está en el nombre de una prueba que no comprueba lo que el caso pide, eso vale más que cualquier otro hallazgo. |
| Abrir Inicio, Prestar y Préstamos cumple el límite de 1 s al tamaño real, y el arranque en frío no tiene límite en el documento | Corre `npm run prueba:carga` en tu máquina y compara. Las dos mediciones son distintas a propósito; si crees que el documento pedía la otra, dilo. |
| Un sábado de 40 movimientos con 3 teléfonos gasta un 14,5 % de las lecturas del día | Lo domina la consulta de «movimientos de hoy», que se repite en cada cambio. Comprueba la cuenta y si ese número crece con el catálogo real. |
| Abrir la app no lee el historial de devueltos | Es el diseño de `docs/js/memoria.js`: escucha solo `estado == 'abierto'`. Comprueba que ninguna pantalla abre otra escucha sobre devueltos sin pedirlo. |
| El índice compuesto `prestamos: estado ASC, prestadoEn DESC` es el único que hace falta | El emulador **no** exige índices. Recorre cada consulta del código y decide si alguna necesita otro; que las pruebas pasen no lo demuestra. |

## Lo que NO tienes que revisar

- El juego de temporadas, las estadísticas y el cierre: son specs/05 y specs/06 y
  no deben estar implementados. Si encuentras algo de eso escrito, **ese** es el
  hallazgo.
- Las etiquetas QR: specs/07, opcional y no pedida.
- Las pruebas manuales y la de humo del proyecto de ensayo: las hace el dueño con
  dos teléfonos reales, y están declaradas en §6.

## Al terminar

Entrega tu informe como un archivo aparte —no toques `informes/entrega-prestamos.md`—
y deja claro en la primera línea el SHA que revisaste. Si no encuentras nada,
dilo igual: la entrega necesita constancia de que alguien que no la escribió la
miró.
