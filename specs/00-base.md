# Base común — App de préstamos de la biblioteca

> Revisión 1.1 · 11-10-2026. Leer también `specs/00-contrato-operativo.md`; define los detalles comunes y las correcciones de esta revisión.


Versión 1.1 · 11-10-2026 · lista para planificación; implementación pendiente

Este documento define lo que comparten todas las etapas: para quién es la app, los principios que resuelven cualquier duda, la tecnología, el modelo de datos, la forma de guardar, las reglas que nunca se rompen y la definición de terminado. Cada etapa tiene su propio documento y repite lo que necesita de aquí.

---

## 1. Qué es y quién la usa

Una biblioteca de iglesia presta libros **solo los sábados**. Hoy lleva el registro en un Excel que se desordenó: ID repetidos, nombres escritos a mano, devoluciones sin marcar. La app lo reemplaza.

| Dato | Valor |
|---|---|
| Libros | unos 150, en 6 categorías |
| Lectores | unos 100 |
| Préstamos | unos 170 en 15 meses; entre 5 y 10 movimientos por sábado; máximo observado, 35 préstamos en un mes |
| Quién usa la app | voluntarios que registran préstamos y devoluciones desde teléfonos Android, y un administrador |
| Quién no la usa | los lectores no entran a la app |
| Costo objetivo | cero al mes |

La app se construye primero para esta biblioteca y debe quedar preparada para ofrecerse después a otras.

## 2. Principios de diseño

Ante cualquier duda de diseño, manda el primer principio que aplique.

1. **No mentir sobre el guardado.** Nada se muestra como hecho hasta que la base de datos lo confirma. Si no hay conexión o falla la escritura, se dice con claridad y no se pierde lo que la persona estaba haciendo.
2. **Sábado primero.** La pantalla de inicio es la jornada del sábado: qué vuelve hoy, prestar, devolver. Los plazos se cuentan en sábados, no en días.
3. **Sencilla.** Prestar toma como máximo tres decisiones (libro, lector, confirmar). Devolver toma un toque. No hay configuración obligatoria. Una persona que nunca vio la app debe poder prestar un libro sin que le expliquen. Ante dos soluciones, se elige la que tiene menos piezas.
4. **Dinámica.** Lo que registra un voluntario aparece en los demás teléfonos sin recargar.
5. **Lúdica, con mesura.** Hay puntos, medallas y podio. Los elementos lúdicos son una lista cerrada: aviso de puntos al devolver, podio al pie de la pantalla, avance de la temporada por sábados y ceremonia de cierre. No se agregan otros sin pedirlos.
6. **Datos personales solo en la base.** Ningún nombre, teléfono ni préstamo real vive en el código, en el repositorio ni en la página publicada.

## 3. Tecnología y restricciones

| Tema | Decisión | Motivo |
|---|---|---|
| Sitio | Estático, sin paso de compilación: HTML, CSS y JavaScript en módulos ES nativos. Sin frameworks ni empaquetadores. | Se publica tal cual y cualquiera puede mantenerlo |
| Publicación | GitHub Pages desde la carpeta `docs/` de la rama `main`. El archivo de entrada se llama `docs/index.html`. | Gratis; el dueño ya publica así |
| Base de datos | Cloud Firestore, plan gratuito (Spark), región `southamerica-west1` (Santiago). La región no se puede cambiar después de creada. | Tiempo real y sin costo |
| Acceso | Firebase Authentication con cuenta de Google, usando `signInWithPopup`. | El inicio por redirección falla en navegadores que bloquean almacenamiento de terceros cuando el sitio no está en Firebase Hosting |
| Servidor propio | No hay. Cloud Functions no está disponible: desplegarlas exige el plan de pago. | Las reglas y transacciones protegen permisos y relaciones; la normalización completa y el cálculo agregado del cierre tienen los límites de confianza explícitos del contrato operativo |
| SDK de Firebase | Módulos ES oficiales, versión fija, cargados desde `https://www.gstatic.com/firebasejs/<versión>/`. | Los módulos oficiales se importan entre sí desde esa dirección; copiarlos al repositorio obligaría a reescribirlos |
| Dominios externos permitidos | Solo los de Google que Firebase necesita: `gstatic.com`, `googleapis.com`, `apis.google.com` y el dominio `firebaseapp.com` del proyecto. Ningún otro. | Sin dependencias de terceros |
| Tipografías | Las del sistema. Ninguna hoja de estilos ni fuente externa. | Una hoja externa bloquea el primer pintado en redes lentas |
| Idioma y zona | Español de Chile. Toda fecha se calcula en la zona `America/Santiago` mediante `Intl`; nunca con un desfase horario fijo. La única excepción es la regla de seguridad del cierre de temporada, que se describe en la etapa 5. | Chile cambia de hora dos veces al año |
| Navegadores | Chrome y Samsung Internet para Android, versiones vigentes. Debe funcionar también en Safari de iPhone. | Los voluntarios usan Android |

Límites del plan gratuito que condicionan el diseño:

- 50.000 lecturas y 20.000 escrituras por día. Las lecturas dependientes necesarias para evaluar reglas pueden consumir cuota incluso si se deniega la operación; el contador del cliente no mide toda la facturación.
- Las reglas de seguridad admiten como máximo 10 consultas a otros documentos por operación y 20 por transacción. Ninguna transacción de la app puede superar 20 consultas, contadas sin suponer que las repetidas se ahorran.
- Las transacciones fallan sin conexión. Las escrituras simples y los lotes no: quedan en cola y se aplican al reconectar.
- Las reglas de seguridad solo conocen la hora en UTC.

**El emulador no es producción.** El emulador de Firestore no exige índices compuestos, no aplica todos los límites y no reproduce todo el comportamiento de las transacciones. Por eso cada etapa enumera sus índices y termina con una prueba de humo que el dueño ejecuta en un proyecto de ensayo real.

**A qué base apunta la app.** Aplicar la selección cerrada de ambientes del contrato operativo, sección 1. En local se usa `demo-biblioteca`; configuración ausente bloquea el ambiente correspondiente. El ensayo se publica desde el commit candidato antes de fusionar, en su destino separado y con ambiente de ensayo fijo.

## 4. Estructura del repositorio

```
docs/                      app publicada por GitHub Pages
  index.html
  manifest.json
  iconos/
  css/app.css
  js/
    main.js                arranque y navegación
    config-publica.js      configuración pública de Firebase (proyecto real y de ensayo) y nombre para la pantalla de entrada
    firebase.js            inicialización
    acceso.js              inicio de sesión y permisos
    datos.js               lecturas, escuchas, transacciones y conteo de lecturas
    reloj.js               hora corregida con la del servidor
    fechas.js              sábados, vencimientos y temporadas (funciones puras)
    puntos.js              puntaje y tabla (funciones puras)
    texto.js               normalización, escape y plantillas (funciones puras)
    vistas/                una por pantalla
    ui/                    componentes compartidos
firestore.rules
firestore.indexes.json
firebase.json              emuladores, con el proyecto `demo-biblioteca`
package.json               herramientas de prueba y scripts de administración
tests/
  unidad/                  funciones puras, con `node --test`
  reglas/                  reglas de seguridad contra el emulador
  e2e/                     flujos completos con Playwright contra el emulador
  carga/                   generador de volumen y mediciones
  fixtures/carga-ficticia.json
scripts/
  inicializar.mjs          crea la configuración, los contadores y el primer administrador
  cargar-datos.mjs         carga inicial (simulación y carga real)
  respaldar.mjs            exporta toda la biblioteca a un archivo
  restaurar.mjs            repone un respaldo en una base vacía
  revisar-repositorio.mjs  falla si hay datos o llaves versionados
datos/                     NO se versiona: carga real, respaldos y llaves de servicio
informes/                  un informe por etapa
specs/
referencia/prototipo.html  referencia visual y de textos, con datos inventados
.github/workflows/pruebas.yml
```

`datos/` está en `.gitignore`. El repositorio es público porque así lo exige GitHub Pages gratuito: nada de esa carpeta puede llegar a un commit.

## 5. Modelo de datos

Todo cuelga de `bibliotecas/{bib}`. Para esta biblioteca, `bib` vale `principal`. Ninguna ruta se escribe fija en el código: sale de una constante.

Todos los documentos llevan `creadoEn` (hora del servidor) y `creadoPor` (correo de quien lo creó, o `carga-inicial`).

### `bibliotecas/{bib}/config/app`
| Campo | Tipo | Regla |
|---|---|---|
| `nombreBiblioteca` | texto | 1 a 40 caracteres; inicial `Biblioteca` |
| `plazoSabadosPorDefecto` | entero | 1 a 4; inicial 2 |
| `categorias` | lista de `{nombre, prefijo}` | el prefijo forma el código del libro (INF, HM, FAM, VC, NV, TEO) |
| `mensajeAtraso` | texto | 10 a 400 caracteres; admite `{nombre}`, `{titulo}` y `{fecha}` |
| `mensajePrevio` | texto | 10 a 400 caracteres; admite `{nombre}`, `{titulo}` y `{fecha}` |
| `inicioJuego` | texto | identificador de la primera temporada en que el juego cuenta, por ejemplo `2026-6` |
| `juegoCerradoAlgunaVez` | booleano | inicial false; primer cierre lo fija true e impide mover inicioJuego |

Lo lee cualquier voluntario. Lo escribe solo el administrador. Lo crea `scripts/inicializar.mjs`. Si falta un campo, la app usa su valor inicial.

### `bibliotecas/{bib}/config/contadores`
| Campo | Tipo | Regla |
|---|---|---|
| `ultimoPrestamo` | entero | solo puede subir de uno en uno |
| `ultimoLector` | entero | solo puede subir de uno en uno |
| `ultimoPrestamoId`, `ultimoLectorId` | texto o nulo | enlazan el documento creado con cada incremento |

Lo crea `scripts/inicializar.mjs` con ambos números en 0 y ambos identificadores en nulo. También crea `config/control` con `bloqueo: null` (contrato operativo §6).

### `bibliotecas/{bib}/voluntarios/{correo}`
El identificador es el correo de Google en minúsculas.

| Campo | Tipo | Regla |
|---|---|---|
| `nombre` | texto | 1 a 60 caracteres |
| `rol` | texto | `admin` o `voluntario` |
| `activo` | booleano | un voluntario inactivo no entra |
| `ultimaConexion` | marca de tiempo | muestra de hora del servidor |
| `sincronizacionId` | texto o nulo | identifica la muestra del dispositivo que la solicitó |

### `bibliotecas/{bib}/libros/{codigo}`
| Campo | Tipo | Regla |
|---|---|---|
| `codigo` | texto | igual al identificador; mayúsculas, sin espacios; formato `^[A-Z]{2,4}[0-9]{3,4}[A-Z]?$` |
| `titulo` | texto | 2 a 120 caracteres |
| `autor` | texto | 0 a 80 caracteres |
| `categoria` | texto | una de las de `config/app` |
| `baja` | booleano | un libro dado de baja no se presta ni se borra |
| `prestamoAbierto` | texto o nulo | identificador del préstamo vigente; nulo si está en el estante |
| `vecesPrestado` | entero | sube con cada préstamo y baja si el préstamo se anula |

### `bibliotecas/{bib}/lectores/{id}`
El identificador es `L` más el correlativo con al menos tres cifras (`L099`, `L1204`).

| Campo | Tipo | Regla |
|---|---|---|
| `nombre` | texto | 3 a 60 caracteres, con al menos 3 letras |
| `clave` | texto | nombre normalizado; formato `^[a-z0-9ñ ]+$` |
| `telefono` | texto o nulo | formato `^569[0-9]{8}$` |
| `avisoDatos` | `{fecha, por}` o nulo | quién le informó al lector el uso de sus datos y cuándo; nulo en los lectores de la carga inicial |
| `fusionadoEn` | texto o nulo | si no es nulo, este lector se unió a otro y no se le presta |
| `esDestinoFusion` | booleano | inicialmente falso; impide cadenas y ciclos tras recibir una unión |

### `bibliotecas/{bib}/lectoresClave/{clave}`
Índice de unicidad: un documento por nombre normalizado, con el campo `lector`. Se crea en la misma transacción que el lector.

La **clave** se obtiene así: minúsculas; quitar tildes y diacríticos conservando la `ñ`; convertir `ı` en `i`; eliminar todo lo que no sea una letra de la `a` a la `z`, `ñ`, un dígito o un espacio, lo que incluye los caracteres de ancho cero y las letras de otros alfabetos; unir espacios repetidos; recortar extremos. «  María  José PÉREZ » da `maria jose perez`. «Peña» da `peña`. Las reglas de seguridad solo pueden comprobar el formato de la clave; que corresponda al nombre lo garantiza el cliente y lo cubren las pruebas de unidad.

### `bibliotecas/{bib}/prestamos/{id}`
El identificador lo genera el cliente antes de la transacción. Los préstamos nunca se borran.

| Campo | Tipo | Regla |
|---|---|---|
| `numero` | entero | correlativo único; se muestra como `P172` |
| `libro` | texto | código de un libro existente y vigente |
| `lector` | texto | identificador de un lector existente y no fusionado |
| `prestadoEn` | marca de tiempo | hora del servidor al registrar; en Excel, mediodía del día de salida |
| `salidaDia` | texto | fecha efectiva en Chile, base de temporada e historia |
| `plazoSabados` | entero o nulo | 1 a 4 en app; nulo en legado |
| `registroDiferido`, `motivoRegistroDiferido` | booleano y texto o nulo | registro administrativo desde papel, según contrato §4 |
| `venceEl` | marca de tiempo | un milisegundo antes del primer instante del domingo que sigue al sábado de vencimiento, en hora de Chile |
| `temporada` | texto | `AAAA-B`, con B de 1 a 6, bimestre de `salidaDia` |
| `estado` | texto | `abierto`, `devuelto` o `anulado` |
| `devueltoEn` | marca de tiempo o nulo | la hora del servidor al devolver |
| `devueltoATiempo` | booleano o nulo | nulo en devolución ordinaria: se deriva de timestamps; booleano solo como corrección o legado |
| `correccionATiempo` | mapa o nulo | autor, hora y motivo de la corrección (contrato §5) |
| `devueltoPor` | texto o nulo | correo del voluntario |
| `anuladoEn`, `anuladoPor` | marca de tiempo y texto, o nulos | |
| `recordadoEn`, `recordadoPor` | marca de tiempo y texto, o nulos | último recordatorio |
| `origen` | texto | `app` o `excel` |

Un préstamo anulado no cuenta para nada: ni puntos, ni estadísticas, ni veces prestado.

Los préstamos cargados desde el Excel llevan `origen: excel`. Los que figuran devueltos sin fecha se cargan con `devueltoEn` nulo y `devueltoATiempo` verdadero.

### `bibliotecas/{bib}/temporadas/{id}`
Fotografía de una temporada cerrada. Una vez escrita no se modifica ni se borra.

| Campo | Tipo |
|---|---|
| `inicio`, `fin` | texto `AAAA-MM-DD` |
| `cerradaEn`, `cerradaPor` | hora del servidor y correo |
| `totalPrestamos` | entero |
| `tabla` | lista de entradas (hasta 600 lectores entre tabla y pausados) `{puesto, lector, nombre, puntos, libros, aTiempo, conAtraso}` |
| `pausados` | lista de entradas (hasta 600 lectores entre tabla y pausados) `{lector, nombre, puntos, debe}` |
| `categorias` | lista `{nombre, prestamos}` |
| `librosTop` | lista de hasta 10 entradas `{codigo, titulo, prestamos}` |

### Índices

Un solo índice compuesto, declarado en `firestore.indexes.json`: colección `prestamos`, campos `estado` ascendente y `prestadoEn` descendente. Lo usa la lista de devueltos. Las demás consultas usan índices automáticos de un campo: `estado == "abierto"`, `temporada == …`, `lector == …`, `libro == …`, `prestadoEn >= …` y `devueltoEn >= …`. Ninguna de ellas pide orden por otro campo; si hace falta ordenar, se ordena en el teléfono.

## 6. Cómo se guarda

Esta sección aplica a toda escritura de la app, también a las de un solo documento.

1. **Siempre en transacción.** Toda escritura se hace con `runTransaction`, con `maxAttempts` en 5. Así falla cuando no hay conexión en vez de quedar en cola.
2. **Botón deshabilitado.** Desde el toque hasta la respuesta, el botón muestra «Guardando…» y no acepta otro toque. La fila no se mueve mientras tanto.
3. **Éxito solo con respuesta.** El aviso de éxito aparece cuando la transacción termina bien. Las listas no muestran datos con escrituras pendientes.
4. **Intención e identificadores.** Cada toque genera un `operacionId` estable. Préstamos usan ID previo; lectores obtienen el correlativo dentro de la transacción. Aplicar metadatos y comprobación de identidad del contrato §3.
5. **Resultado incierto.** Esperar la terminación de `runTransaction`; a los 5 segundos mostrar «Confirmando… no cierres la app». Si termina con error de red, conservar lo elegido y comprobar desde el servidor la operación exacta. La existencia de un documento no basta. Un estado posterior que impide atribuir el resultado requiere revisión, no reintento automático.
6. **Conflicto.** Mensaje concreto, refrescar estado, conservar entradas y no mostrar éxito.
7. **Sin conexión.** No se escribe ni se encola. WhatsApp puede abrir por navegación explícita aunque no se registre la apertura.

**Hora verificada.** Aplicar contrato §2: muestra del servidor identificada, avance monotónico, caducidad y bloqueo temporal si no hay muestra válida. Nunca se calculan vencimientos con el reloj del teléfono sin verificar.

**Hora en las pruebas.** Las funciones puras reciben el instante. `?ahora=` solo cambia el reloj de UI contra el emulador. Las escrituras protegidas por `request.time` se prueban con tiempo relativo real del emulador; no afirmar que ese parámetro cambia el servidor.

## 7. Reglas que nunca se rompen

1. Solo entra quien tiene un documento activo en `voluntarios` con el correo de su cuenta de Google verificada. Iniciar sesión con Google no basta.
2. Un libro tiene como máximo un préstamo abierto. Lo garantiza una transacción que lee y escribe `libros/{codigo}.prestamoAbierto`, y lo exigen las reglas de seguridad.
3. Dos préstamos nunca comparten número. El número sale de `config/contadores` dentro de la misma transacción.
4. No se presta un libro dado de baja ni a un lector fusionado.
5. Los instantes de registro y devolución son del servidor. `salidaDia` registra el sábado efectivo, incluso al transcribir papel.
6. Los préstamos no se borran. Deshacer un préstamo abierto lo anula; deshacer una devolución lo reabre solo si el libro sigue libre.
7. Una temporada cerrada no cambia.
8. Dos lectores no comparten nombre normalizado.
9. Ninguna acción muestra éxito antes de la confirmación del servidor, y un doble toque ejecuta la acción una sola vez.
10. Todo texto escrito por una persona se muestra como texto, nunca como HTML, y se sustituye en plantillas en una sola pasada.

## 8. Sábados, vencimientos y temporadas

Estas funciones viven en `docs/js/fechas.js`, son puras y reciben la hora como parámetro para poder probarlas.

**Día de la biblioteca.** Es la fecha en `America/Santiago` de una marca de tiempo. Las 23:30 de un sábado en Chile siguen siendo sábado, aunque en UTC ya sea domingo.

**Vencimiento.** Un préstamo con plazo de `k` sábados vence el k-ésimo sábado posterior al día en que salió. Si salió un sábado, vence `7 × k` días después. `venceEl` es un milisegundo antes del primer instante del domingo siguiente, en hora de Chile. Esa definición no es ambigua los días de cambio de hora.

| Sale el | Plazo | Vence el |
|---|---|---|
| sábado 10-10-2026 | 1 sábado | sábado 17-10-2026 |
| sábado 10-10-2026 | 2 sábados | sábado 24-10-2026 |
| sábado 10-10-2026 | 4 sábados | sábado 07-11-2026 |
| martes 13-10-2026 | 1 sábado | sábado 17-10-2026 |
| martes 13-10-2026 | 2 sábados | sábado 24-10-2026 |
| viernes 16-10-2026 | 1 sábado | sábado 17-10-2026 |
| sábado 26-12-2026 | 2 sábados | sábado 09-01-2027 |

**Atraso.** Un préstamo abierto está atrasado cuando la hora corregida supera `venceEl`. Se expresa según los días transcurridos entre el día de vencimiento y hoy, ambos en hora de Chile:

| Días transcurridos | Texto |
|---|---|
| 1 a 6 | «Venció el sábado» (o «Venció el (día)» si el vencimiento no fue sábado) |
| 7 a 62 | «Atrasado N sábados», con N = días ÷ 7 sin decimales. Quince días dan «Atrasado 2 sábados»; siete, «Atrasado 1 sábado» |
| 63 o más | «Atrasado N meses», con N = días ÷ 30 sin decimales |

**Temporada.** Dura dos meses de calendario: enero–febrero, marzo–abril, mayo–junio, julio–agosto, septiembre–octubre, noviembre–diciembre. Un préstamo pertenece a la temporada de `salidaDia`, la fecha en que salió. La temporada `2026-5` va del 01-09-2026 al 31-10-2026; la `2028-1`, del 01-01-2028 al 29-02-2028.

**Avance de temporada.** Se muestra como «sábado N de M», donde M es la cantidad de sábados de la temporada (8 o 9) y N el ordinal del sábado en curso o del último que pasó. El 10-10-2026 es «sábado 6 de 9». Antes del primer sábado de la temporada se muestra «Primer sábado: (fecha)».

## 9. Interfaz

`referencia/prototipo.html` es la referencia visual y de textos: colores, componentes, tono de los mensajes y aspecto general. Se abre directo en el navegador y trae datos inventados. **Su lógica no se reutiliza**, y **donde difiera de estas especificaciones, mandan las especificaciones.** Diferencias conocidas:

| En el prototipo | En la app |
|---|---|
| Plazos en días (7, 14, 21, 28) y atrasos en días o meses | Plazos y atrasos en sábados |
| Inicio con tres cifras grandes | Inicio como jornada del sábado: «Vuelven hoy», «Atrasados» y «Movimientos de hoy» |
| Un solo mensaje de recordatorio | Dos mensajes: de atraso y previo |
| Pantalla «Datos por revisar» | No existe; la depuración se hace antes de cargar |
| Ranking con «Todo el historial» y cálculo en vivo de temporadas pasadas | Solo temporadas; las cerradas se muestran desde su fotografía |
| Sin inicio de sesión, voluntarios, cierre de temporada ni ceremonia | Existen, según cada etapa |
| Nombra tipografías web que no carga | Tipografías del sistema |
| Botón «Escanear etiqueta» en Prestar | Solo existe si se hace la etapa 7 |
| Cantidad junto a «Devueltos» | Devueltos no muestra cantidad |
| «Quedan N días» en Ranking | «Sábado N de M» |
| Guarda en el teléfono | Guarda en la base, con confirmación |

Colores de partida, tema claro y oscuro (definidos como variables CSS en `:root`):

| Uso | Claro | Oscuro |
|---|---|---|
| Fondo | `#F3F6F2` | `#0F1512` |
| Superficie | `#FFFFFF` | `#18211C` |
| Texto | `#16211B` | `#E7EEE9` |
| Texto secundario | `#5A6860` | `#97A79E` |
| Borde de campos | `#7C8A82` | `#7E8E85` |
| Acento | `#1D6A50` | `#5FC6A1` |
| Atraso | `#B3301C` | `#FF8D77` |
| Oro, plata, bronce | `#D9A514`, `#9BA6AF`, `#B8743C` | `#EDBE3A`, `#BAC4CC`, `#D08D55` |

Exigencias para toda pantalla:

- Funciona a 320 px de ancho sin desplazamiento horizontal, también con una palabra de 60 letras sin espacios en un nombre o un título.
- Botones y controles de al menos 44 × 44 px.
- Los bordes de los campos tienen contraste de al menos 3:1 con su fondo; el texto, al menos 4,5:1. En ambos temas.
- Después de cada acción el foco queda en un lugar con sentido; nunca vuelve al inicio del documento. Las hojas emergentes retienen el foco y lo devuelven al cerrar.
- El botón Atrás del teléfono cierra la hoja abierta o vuelve a la pantalla anterior. En una pantalla principal sin hojas abiertas, sale de la app como en cualquier sitio.
- El documento declara `lang="es"`. Los íconos decorativos llevan `aria-hidden`.
- Respeta `prefers-reduced-motion`.
- Cada pantalla tiene diseñados sus estados: cargando, vacío, sin conexión, sin permiso y error.
- Un préstamo que apunta a un libro o a un lector que no está en memoria se muestra con el código o el identificador y el texto «(no encontrado)»; nunca rompe la pantalla.

## 10. Definición de terminado

Una etapa está terminada cuando:

1. Todos los casos de prueba automatizables de su documento pasan, y la salida de las pruebas está en el informe. Los casos marcados «(manual)» quedan listados para el dueño.
2. Las pruebas de las etapas anteriores siguen pasando.
3. La integración continua corre en cada solicitud de cambios las pruebas de unidad, de reglas y de extremo a extremo, y `scripts/revisar-repositorio.mjs`.
4. Se ejecutó la prueba de carga de la etapa y sus tiempos y lecturas están en el informe. Se registra telemetría del cliente y estimación de cuota por separado, según contrato §8; no se vuelve a sumar toda una escucha por cada cambio.
5. Ningún archivo versionado contiene datos personales ni llaves.
6. El informe declara qué quedó sin hacer y qué no está preparado para producción. Si no hay nada, dice «Nada».
7. La app, servida en local desde `docs/` contra el emulador con los datos ficticios, muestra lo que el documento llama «entrega demostrable».
8. El informe está en `informes/etapa-N.md` y en la descripción de la solicitud de cambios.

La etapa se **aprueba** después: el dueño la pasa por una contraprueba externa, despliega reglas e índices en el proyecto de ensayo y ejecuta ahí la prueba de humo del documento. El agente no despliega nada.

## 11. Fuera del alcance de esta versión

- Cuentas o vistas para lectores, catálogo público y reservas.
- Envío automático de mensajes por la API de WhatsApp.
- Multas o bloqueos automáticos por atraso.
- Renovar un préstamo. Se devuelve y se presta de nuevo.
- Pantallas para administrar varias bibliotecas. La estructura de datos ya lo permite; la interfaz no.
- Búsqueda de libros por ISBN en servicios externos.
- Uso sin conexión para registrar. Si un sábado no hay señal, se anota en papel y se registra después; el administrador corrige las devoluciones que fueron a tiempo.

## 12. Límites conocidos

- **Tamaño por biblioteca.** La apertura lee catálogo, lectores y consultas operativas. Su costo depende también de reglas, reconexiones y reintentos: no se promete un número de aperturas diarias sin medir. Las pruebas masivas son de rendimiento en emulador, no garantía de cabida gratuita. Sobre el tamaño real de la biblioteca se evalúa paginación antes de ampliar.
- **Cuenta ajena.** Una cuenta de Google no autorizada puede intentar lecturas que las reglas deniegan; cada intento consume cuota.
- **Origen compartido.** Todas las páginas de una misma cuenta de GitHub Pages comparten origen, y con él la sesión y el almacenamiento local. Un dominio propio lo aísla.
- **Respaldo.** El plan gratuito no incluye respaldos automáticos. El respaldo es un script que el dueño ejecuta.
- **Enlace de WhatsApp.** Se localizó la referencia oficial de click-to-chat; su contenido completo no fue recuperable en esta revisión. La plantilla y la apertura del chat requieren pruebas de unidad y prueba real (ver fuentes).
- **Entrada con Google.** La ventana emergente puede ser bloqueada por el teléfono o por la app instalada; se valida a mano en teléfonos reales.
