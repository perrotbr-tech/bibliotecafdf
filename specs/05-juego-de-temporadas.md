# Etapa 5 — Juego de temporadas

> Revisión 1.1 · 11-10-2026. Leer también `specs/00-contrato-operativo.md`; define los detalles comunes y las correcciones de esta revisión.


## Objetivo

Convertir la lectura en un juego simple: cada dos meses hay una temporada, los lectores suman puntos por pedir libros y devolverlos a tiempo, y los tres primeros reciben medalla.

## Entrega demostrable

Al devolver un libro a tiempo aparece «Devuelto a tiempo · Ana queda con 45 puntos». El pie de la pantalla muestra el podio de la temporada y cambia en vivo. En la pantalla Ranking se recorren las temporadas. El administrador cierra una temporada terminada y sus ganadores quedan guardados para siempre.

## Alcance

1. Cálculo de puntos y de la tabla de una temporada, en `puntos.js`.
2. Pantalla **Ranking**.
3. **Pie de pantalla** con el podio, visible en toda la app.
4. **Aviso de puntos** al devolver.
5. **Avance de la temporada** por sábados, en Inicio.
6. **Cierre de temporada** con ceremonia y fotografía de ganadores.
7. Categoría que más sale y libro más pedido de la temporada.

Estos cuatro elementos lúdicos (aviso de puntos, podio al pie, avance por sábados y ceremonia de cierre) son la lista completa. No se agregan insignias, rachas ni niveles.

## Qué cambia de etapas anteriores

- **Inicio** agrega, bajo la fecha, la línea de avance de la temporada, y cuando corresponde el aviso de temporada por cerrar.
- **El aviso tras devolver** cambia de «Devuelto: (título)» al aviso de puntos de esta etapa. Conserva «Deshacer».
- **El aviso tras prestar** no cambia.
- **Toda la app** gana el pie con el podio, y el contenido de cada pantalla deja espacio para que no lo tape.

## Fuera del alcance de esta etapa

Un ranking de todo el historial; premios, insignias o niveles; desempate automático para premiar. Si hay empate en un puesto, la biblioteca decide cómo premiar.

## Datos que toca

**`bibliotecas/{bib}/prestamos`**: los de la temporada en curso se escuchan en vivo con la consulta `temporada == "AAAA-B"`. Los de otra temporada se leen al abrirla en Ranking. Los préstamos abiertos ya están en memoria.

**`bibliotecas/{bib}/config/app.inicioJuego`**: identificador de la primera temporada del juego. El juego no muestra temporadas anteriores.

**`bibliotecas/{bib}/temporadas/{id}`**: fotografía de una temporada cerrada.

| Campo | Tipo |
|---|---|
| `inicio`, `fin` | texto `AAAA-MM-DD` |
| `cerradaEn`, `cerradaPor` | hora del servidor y correo |
| `totalPrestamos` | entero |
| `tabla` | lista de entradas (hasta 600 lectores entre tabla y pausados) `{puesto, lector, nombre, puntos, libros, aTiempo, conAtraso}` |
| `pausados` | lista de entradas (hasta 600 lectores entre tabla y pausados) `{lector, nombre, puntos, debe}` |
| `categorias` | lista `{nombre, prestamos}` |
| `librosTop` | lista de hasta 10 entradas `{codigo, titulo, prestamos}` |

## Reglas del juego

**Temporadas.** Duran dos meses de calendario: enero–febrero, marzo–abril, mayo–junio, julio–agosto, septiembre–octubre y noviembre–diciembre. `2026-5` va del 01-09-2026 al 31-10-2026. Un préstamo pertenece a la temporada del día en que salió, en hora de Chile.

**Puntos por libro.** Los préstamos anulados no cuentan.

| Situación del libro | Puntos |
|---|---|
| Devuelto a tiempo (hasta el día del vencimiento inclusive) | 15 |
| En curso, dentro del plazo | 10 |
| Devuelto con atraso | 5 |
| Atrasado sin devolver | 0 |

«A tiempo» sale de `fueATiempo(prestamo)`: corrección booleana explícita si existe, o comparación de timestamps definitivos (contrato §5). Un libro en curso vale 10 mientras está en plazo; al devolverse pasa a valer 15 o 5, no se suman.

**Pausa.** Quien tiene cualquier libro atrasado sin devolver, de cualquier temporada y de cualquier origen, queda en pausa: conserva sus puntos pero no ocupa puesto ni recibe medalla. Al devolverlo vuelve a competir de inmediato.

**Puestos.** La tabla ordena de mayor a menor puntaje a los lectores que no están en pausa y tienen más de 0 puntos. Los empates comparten puesto, y el siguiente puesto se salta: dos primeros lugares dejan al siguiente en el tercero. Dentro de un empate, el orden en pantalla es por más libros a tiempo y luego alfabético; eso no rompe el empate. Los lectores fusionados no aparecen: mientras se completa el traslado, sus préstamos se atribuyen a la raíz resolviendo un salto, sin duplicarlos.

**Medallas.** Oro, plata y bronce para los puestos 1, 2 y 3. Si varios comparten un puesto, todos reciben esa medalla.

**Temporada abierta y temporada cerrada.** Mientras una temporada no esté cerrada, su tabla se calcula en vivo; si ya terminó, se rotula «Resultado provisional». Una temporada terminada se cierra con una acción del administrador, que guarda la fotografía. Desde ese momento la temporada se muestra siempre desde la fotografía, y una devolución tardía ya no la cambia.

## Reglas de seguridad

- `temporadas/{id}`: lo lee cualquier voluntario. Lo crea solo un administrador, solo si no existe, con identificador de formato `^[0-9]{4}-[1-6]$`, y solo si la hora del servidor ya pasó el fin de esa temporada. Nadie lo modifica ni lo borra.
- Las reglas de seguridad solo conocen la hora en UTC. El fin de temporada se comprueba así: la hora del servidor debe ser igual o posterior al primer día del mes siguiente a la temporada, a las 04:00 UTC. Esa hora cubre los dos horarios de Chile. Es la única parte del sistema que usa un desfase fijo. El aviso y el botón de cierre aparecen desde ese mismo instante, para que la app nunca ofrezca un cierre que la regla va a denegar.
- `tabla` y `pausados` juntas admiten hasta 600 lectores, sin truncar; `librosTop`, 10. Aplicar límites y fotografía completa del contrato §6.

## Pantallas y comportamiento

**Ranking.**
- Navegador de temporadas con flechas, desde `inicioJuego` hasta la que está en curso. Bajo el nombre: «En curso · sábado 6 de 9», «Terminó · resultado provisional» o «Temporada cerrada».
- **Podio** con tres escalones y medallas. Si más lectores empatan en un puesto de los que caben, una línea lo dice: «14 lectores más empatan en el puesto 3 con 15 puntos».
- **Cómo se gana**: las cuatro filas de puntos, siempre visibles.
- **Tabla de puntos**: puesto o medalla, nombre, detalle («3 libros: 2 a tiempo, 1 en curso») y puntos. Muestra 10 y «Mostrar más».
- **En pausa por atrasos (N)**: nombre, puntos y cuántos libros debe. Al tocar se abre la ficha del lector, donde se puede registrar la devolución.
- **Ganadores de cada temporada**: una fila por temporada cerrada, con el primer puesto. Con más de dos ganadores: «Ana Rojas, Luis Vera y 3 más».
- **Categoría que más sale** y **Libro más pedido** de la temporada. La categoría se muestra de dos formas: por total de préstamos y por préstamos por libro, porque las categorías tienen distinto tamaño.
- «Copiar los 10 primeros»: texto con el nombre de la temporada y una línea por lector, con puesto, nombre y puntos.

**Pie de pantalla.** Una franja sobre la barra de navegación, en toda la app salvo en Ranking. Muestra la etiqueta de la temporada y los tres primeros con su medalla, nombre de pila y puntos. Si en la temporada en curso todavía nadie tiene medalla, muestra a los ganadores de la temporada cerrada más reciente que tenga ganadores, con la etiqueta «Ganadores jul–ago». Para eso lee por identificador las fotografías de las tres temporadas anteriores a la que está en curso; no usa una consulta. Si tampoco hay: «Todavía sin medallas. Toca para ver cómo se gana». Al tocarla abre Ranking.

**Aviso de puntos al devolver.** El texto se arma así:

| Situación | Texto |
|---|---|
| Devuelto a tiempo, préstamo de la temporada en curso | «Devuelto a tiempo · Ana queda con 45 puntos» |
| Devuelto con atraso, préstamo de la temporada en curso | «Devuelto con atraso · Ana queda con 35 puntos» |
| Préstamo de otra temporada | «Devuelto a tiempo» o «Devuelto con atraso» |
| Con esta devolución deja de deber libros | se agrega «· vuelve a competir» |
| Sigue debiendo otros libros | se agrega «· sigue en pausa: debe 1 libro» |
| Entra al podio o cambia de medalla | se agrega «· sube al 2.º puesto» |

**Avance de la temporada.** En Inicio, bajo la fecha: «Temporada sep–oct · sábado 6 de 9», con una barra de tantos segmentos como sábados tenga la temporada (8 o 9). Antes del primer sábado: «Temporada nov–dic · primer sábado: 7 de noviembre».

**Cierre de temporada.**
- Desde el primer día del mes siguiente a una temporada sin cerrar, a las 04:00 UTC, Inicio muestra un aviso. Para el administrador: «Terminó jul–ago. Revisa y cierra la temporada». Para un voluntario: «Terminó jul–ago. Falta que el administrador la cierre».
- La pantalla de cierre muestra la tabla final y dos líneas informativas, cuando aplican: «Hay 12 libros de esta temporada atrasados sin devolver. Sus lectores quedan fuera del resultado» y «3 libros siguen en plazo y cuentan 10 puntos cada uno». Una tercera línea orienta: «Conviene cerrar al terminar el primer sábado después del fin de la temporada».
- Al confirmar se adquiere el bloqueo de cierre, se relee el servidor y se calcula al instante de corte; solo entonces se guarda y desbloquea atómicamente (contrato §6). Después se abre la **ceremonia**: podio a pantalla completa con los escalones subiendo, y el botón «Copiar resultado» con un texto para anunciar a los ganadores.
- Si hay más de una temporada terminada sin cerrar, se cierran de la más antigua a la más reciente.
- La animación respeta `prefers-reduced-motion`: con esa preferencia, el podio aparece ya armado.

## Índices

Ninguno nuevo. `temporada == …` usa un índice automático.

## Casos de prueba

| ID | Situación | Resultado esperado |
|---|---|---|
| J-01 | Lector con un libro devuelto a tiempo, uno en curso y uno devuelto tarde | 30 puntos; detalle «3 libros: 1 a tiempo, 1 en curso, 1 con atraso» |
| J-02 | Lector con un libro atrasado sin devolver | Ese libro vale 0; el lector aparece en «En pausa», no en la tabla |
| J-03 | Lector en pausa por un libro de una temporada anterior | Queda en pausa también en la temporada en curso |
| J-04 | El lector en pausa devuelve su libro atrasado | Sale de la pausa al instante; ese libro pasa a valer 5 |
| J-05 | Devolución el mismo día del vencimiento / al día siguiente | 15 / 5 |
| J-06 | El administrador corrige «Fue devuelto a tiempo» en un préstamo de la temporada en curso | El libro pasa de 5 a 15 y la tabla cambia |
| J-07 | Préstamo anulado | No suma puntos ni cuenta como libro |
| J-08 | Préstamo de origen Excel devuelto sin fecha | 15 |
| J-09 | Puntajes 30, 30, 15, 15, 15, 10 | Puestos 1, 1, 3, 3, 3, 6; oro a los dos primeros, bronce a los tres siguientes, sin plata |
| J-10 | Puntajes 45, 30, 15 | Puestos 1, 2, 3 con oro, plata y bronce |
| J-11 | Seis lectores empatados en el primer puesto | El podio muestra tres y la línea «3 lectores más empatan en el puesto 1…»; los seis llevan oro en la tabla |
| J-12 | Temporada sin préstamos | «No hay préstamos en esta temporada», sin errores |
| J-13 | Temporada en que todos están en pausa | «Nadie tiene medalla todavía», y la lista de pausa completa |
| J-14 | Cálculo puro de temporada del 31-10 a las 23:30 y del 01-11 a las 00:10, hora de Chile | Temporadas `2026-5` y `2026-6` |
| J-15 | Fechas de temporada: `2026-1`, `2028-1`, `2026-6` | 01-01 a 28-02; 01-01 a 29-02; 01-11 a 31-12 |
| J-16 | Avance el 10-10-2026, el 03-11-2026 y el 07-11-2026 | «sábado 6 de 9»; «primer sábado: 7 de noviembre»; «sábado 1 de 8» |
| J-17 | Otro teléfono registra una devolución | El pie y la tabla cambian en menos de 2 segundos, sin recargar |
| J-18 | Pie cuando nadie tiene medalla en la temporada en curso | Muestra «Ganadores» de la temporada cerrada más reciente con ganadores |
| J-19 | Pie sin ninguna temporada con ganadores | «Todavía sin medallas. Toca para ver cómo se gana» |
| J-20 | Pie con nombres de pila de 20 letras, a 320 px | Se cortan con puntos suspensivos; los puntos siguen visibles; sin desplazamiento horizontal |
| J-21 | Último elemento de cualquier pantalla con el pie visible | Queda por encima del pie y se puede tocar |
| J-22 | Aviso al devolver: a tiempo en la temporada en curso; con atraso; de otra temporada; saliendo de pausa; siguiendo en pausa; subiendo al podio | «Devuelto a tiempo · Ana queda con 45 puntos»; «Devuelto con atraso · Ana queda con 35 puntos»; «Devuelto a tiempo» sin puntos; agrega «· vuelve a competir»; agrega «· sigue en pausa: debe 1 libro»; agrega «· sube al 2.º puesto» |
| J-23 | Voluntario intenta crear `temporadas/{id}` | Denegado |
| J-24 | Regla, en relación con la hora en que corre la prueba: el administrador intenta cerrar la temporada en curso o una futura | Denegado |
| J-25 | Regla: el administrador cierra la temporada anterior a la que está en curso | Fotografía creada con tabla, pausados, categorías y libros |
| J-26 | Cálculo del instante de cierre, con la hora como parámetro: temporada `2026-5` a las 03:30 UTC del 01-11-2026 / a las 04:00 UTC; temporada `2026-6` | No disponible / disponible; disponible desde el 01-01-2027 a las 04:00 UTC |
| J-27 | (manual) Leer la regla de cierre y comprobar que usa el primer día del mes siguiente a las 04:00 UTC, incluido el paso de diciembre a enero | Coincide con el cálculo de la app |
| J-28 | Cerrar dos veces, o modificar o borrar una fotografía | Denegado |
| J-29 | Devolución tardía de un libro de una temporada ya cerrada | La temporada cerrada no cambia; la temporada en curso refleja que el lector sale de la pausa |
| J-30 | Doble toque en «Cerrar temporada» | Una sola fotografía |
| J-31 | Tabla con 120 lectores con puntos al cerrar | La fotografía guarda las 120 entradas y todos sus empates; totalPrestamos refleja el total real |
| J-32 | Temporada anterior a `inicioJuego` | No aparece en el navegador ni pide cierre |
| J-33 | Lector unido a otro | Sus préstamos cuentan para el lector que se conservó; el fusionado no aparece |
| J-34 | Preferencia de movimiento reducido | Podio y ceremonia sin animación |
| J-35 | Recalcular con un programa aparte la temporada `2026-4` de los datos ficticios, con `?ahora=` fijado en el 10-10-2026 | Los puntos, los puestos y los pausados coinciden con la pantalla |

### Casos adicionales de la revisión 1.1

| ID | Situación | Resultado esperado |
|---|---|---|
| J-36 | Otro teléfono devuelve mientras el administrador cierra | Bloqueo evita fotografía mezclada; captura un único corte |
| J-37 | Bloqueo expira o dos administradores cierran | No guarda cálculo obsoleto; solo una fotografía |
| J-38 | Más de 50 lectores empatan con medalla | Se conservan todos hasta el límite total; nunca se corta el empate |
| J-39 | Más de 600 lectores o presupuesto de 750 KiB superado | Cierre se rechaza con explicación; no se trunca |
| J-40 | Nombre/título/categoría cambian después del cierre | La fotografía conserva los textos y denominadores originales |
| J-41 | Unión incompleta | No cierra; indica que primero debe completarse la unión |
| J-42 | Temporada pasada abierta y otra persona devuelve | La tabla provisional se actualiza; al salir se cancela su escucha |

## Carga y límites

Con 2.000 préstamos en una temporada y 600 lectores con puntos, y el procesador reducido a un cuarto:

- Abrir Ranking: menos de 1 segundo.
- Recalcular el pie tras una devolución: menos de 100 milisegundos.
- Lecturas al abrir la app: los préstamos de la temporada en curso y las tres fotografías anteriores, existan o no. No se leen préstamos de temporadas anteriores. Verificarlo con el contador de lecturas.
- Abrir una temporada pasada sin cerrar escucha sus préstamos mientras esa vista está abierta y cancela al salir; una cerrada lee un solo documento. No afirmar actualización en vivo usando una única lectura.

## Prueba de humo en el proyecto de ensayo (la ejecuta el dueño)

1. Desplegar reglas.
2. Con dos teléfonos reales: devolver un libro en uno y ver cambiar el pie en el otro.
3. Desde la consola de Firebase, poner `config/app.inicioJuego` en una temporada ya terminada de los datos ficticios; cerrarla como administrador y ver la ceremonia.
4. Intentar cerrarla otra vez: no debe ofrecerlo.

## Lista de entrega

- [ ] `puntos.js` puro y con pruebas de unidad para todas las filas de la tabla de puntos, la pausa y los empates.
- [ ] Pruebas de reglas del cierre de temporada, incluida la hora límite en UTC.
- [ ] Prueba de extremo a extremo con dos teléfonos y el pie cambiando en vivo.
- [ ] `informes/etapa-5.md` con tiempos, lecturas medidas y lo que no está listo.
