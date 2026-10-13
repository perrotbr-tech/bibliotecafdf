# Etapa 2 — Catálogo y lectores

> Revisión 1.1 · 11-10-2026. Leer también `specs/00-contrato-operativo.md`; define los detalles comunes y las correcciones de esta revisión.


## Objetivo

Tener los libros y los lectores en la base, con búsqueda rápida, altas seguras, la carga inicial de los datos y el respaldo.

## Entrega demostrable

Con los datos ficticios cargados en el emulador, un voluntario busca un libro por título sin tildes, abre su ficha, inscribe un lector nuevo y ve el cambio aparecer en un segundo teléfono sin recargar. El dueño ejecuta un respaldo y lo restaura en una base vacía.

## Alcance

1. Lectura en vivo de libros y lectores.
2. Pantalla **Catálogo**: búsqueda, filtro por categoría y por estado, ficha del libro.
3. Pantalla **Lectores**: búsqueda y ficha del lector.
4. Alta de lector y cambio de teléfono por cualquier voluntario. Alta, edición y baja de libro por el administrador. Cambio de nombre de lector por el administrador.
5. Reglas de seguridad de `libros`, `lectores`, `lectoresClave` y `config/contadores`.
6. Scripts `cargar-datos.mjs`, `respaldar.mjs` y `restaurar.mjs`.

## Fuera del alcance de esta etapa

Prestar y devolver. El estado del libro se muestra según `prestamoAbierto`, que en esta etapa solo cambia por la carga inicial. La ficha del lector todavía no muestra préstamos. Unir lectores llega en la etapa 6.

## Datos que toca

Todos los documentos llevan `creadoEn` (hora del servidor) y `creadoPor` (correo, o `carga-inicial`).

**`bibliotecas/{bib}/libros/{codigo}`**

| Campo | Tipo | Regla |
|---|---|---|
| `codigo` | texto | igual al identificador; `^[A-Z]{2,4}[0-9]{3,4}[A-Z]?$` |
| `titulo` | texto | 2 a 120 caracteres |
| `autor` | texto | 0 a 80 caracteres |
| `categoria` | texto | una de `config/app.categorias` |
| `baja` | booleano | |
| `prestamoAbierto` | texto o nulo | |
| `vecesPrestado` | entero, 0 o más | |

**`bibliotecas/{bib}/lectores/{id}`**, con identificador `L` más el correlativo de al menos tres cifras (`L099`, `L1204`):

| Campo | Tipo | Regla |
|---|---|---|
| `nombre` | texto | 3 a 60 caracteres, con al menos 3 letras |
| `clave` | texto | nombre normalizado; `^[a-z0-9ñ ]+$` |
| `telefono` | texto o nulo | `^569[0-9]{8}$` |
| `avisoDatos` | `{fecha, por}` o nulo | quién le informó el uso de sus datos y cuándo |
| `fusionadoEn` | texto o nulo | nulo en esta etapa |

**`bibliotecas/{bib}/lectoresClave/{clave}`** con el campo `lector`. Garantiza que dos lectores no compartan nombre normalizado.

**`bibliotecas/{bib}/config/contadores`** con `ultimoLector` y `ultimoPrestamo`, enteros que solo suben de uno en uno.

**Clave de un nombre:** minúsculas; quitar tildes y diacríticos conservando la `ñ`; convertir `ı` en `i`; eliminar todo lo que no sea una letra de la `a` a la `z`, `ñ`, un dígito o un espacio, lo que incluye los caracteres de ancho cero y las letras de otros alfabetos; unir espacios repetidos; recortar extremos. «  María  José PÉREZ » da `maria jose perez`. «Peña» da `peña`, distinta de `pena`. Las reglas de seguridad comprueban solo el formato de la clave; que corresponda al nombre lo garantiza el cliente y lo cubren las pruebas de unidad.

**Nombre válido:** entre 3 y 60 caracteres después de recortar y unir espacios, y cuya clave tenga al menos 3 letras. Si no las tiene, el mensaje es «Escribe al menos 3 letras». Se acepta un nombre de una sola palabra, porque hay lectores inscritos por su apodo.

**Teléfono:** se aceptan 9 dígitos que empiezan con 9, o 11 dígitos que empiezan con 569; se ignoran espacios, guiones y el signo `+`. Se guarda como `569XXXXXXXX`. Cualquier otro texto no vacío es un error visible; nunca se descarta en silencio. Los dígitos de ancho completo se convierten a dígitos normales antes de validar.

**Código sugerido:** el prefijo de la categoría más el mayor número existente en esa categoría más uno, con al menos tres cifras. Después de `INF027` viene `INF028`; después de `INF999`, `INF1000`. No se rellenan huecos.

## Operaciones

Todas en transacción, con el botón deshabilitado hasta la respuesta y el aviso de éxito solo después de ella.

**Inscribir lector.** Lee el contador y `lectoresClave/{clave}`. Si la clave existe, falla con el nombre del lector vigente. Si no, crea el lector con identificador `L` + (`ultimoLector` + 1), crea el documento de clave y sube el contador, enlazando `ultimoLectorId`. El `operacionId` es estable; el ID L+correlativo se resuelve dentro de cada intento (contrato §3).

**Cambiar teléfono** (cualquier voluntario). Cambia `telefono` y los metadatos de operación; ningún otro campo de negocio.

**Cambiar nombre** (administrador). Cambia `nombre` y `clave`. Si la clave nueva no tiene documento, lo crea; si ya existe y apunta a este mismo lector, lo deja como está; si apunta a otro lector, falla con «Ya existe: (nombre)». El documento de la clave anterior sigue apuntando al lector, para que el nombre antiguo quede reservado. Corregir solo una tilde o una mayúscula no cambia la clave.

**Agregar libro** (administrador). Lee `libros/{codigo}`; si existe, falla con «El código ya existe».

## Reglas de seguridad

- `libros`: los lee cualquier voluntario. Los crea el administrador, con `prestamoAbierto` nulo y `vecesPrestado` en 0. Al editar, el administrador puede cambiar solo `titulo`, `autor`, `categoria` y `baja`. Nadie los borra.
- `lectores`: los lee cualquier voluntario. Los crea cualquier voluntario, solo si en la misma transacción queda creado su documento de `lectoresClave` y el contador sube exactamente en uno hasta el número del identificador. Un voluntario puede cambiar solo `telefono`. El administrador puede cambiar además `nombre` y `clave`. Nadie los borra.
- `lectoresClave`: se crea solo si no existe y solo si en la misma transacción queda un lector con esa clave. Solo el administrador lo modifica en una unión válida de Etapa 6; en esta etapa no se redirige una clave existente.
- `config/contadores`: lo lee cualquier voluntario; `ultimoLector` solo puede pasar de N a N+1, con `ultimoLectorId` enlazado al lector creado, sin tocar `ultimoPrestamo` ni `ultimoPrestamoId`.
- Anotar en el informe cuántas consultas a otros documentos usa cada operación. Máximo 10 por operación y 20 por transacción; incluir todas las lecturas de autorización, control y referencias, sin asumir caché.

## Pantallas y comportamiento

**Catálogo.** Campo de búsqueda que filtra mientras se escribe por título, autor o código, sin distinguir mayúsculas ni tildes y aceptando el código con espacios («inf 006» encuentra INF006). Fichas de categoría y selector de estado: Todos, Disponibles, Prestados. Cada fila muestra el código en su etiqueta de color, el título, el autor y el estado. Orden por código. Se muestran 40 filas y un botón «Mostrar más».

**Ficha del libro.** Código, categoría, autor, estado y veces prestado. Para el administrador: «Editar» y «Dar de baja», esta última con una pantalla de confirmación propia.

**Agregar libro** (administrador). Categoría, código sugerido, título y autor.

**Lectores.** Búsqueda por nombre. Orden alfabético. Cada fila muestra el nombre y, si no tiene teléfono, la marca «Sin teléfono».

**Ficha del lector.** Nombre, teléfono y botón «Agregar teléfono» o «Cambiar teléfono». Para el administrador: «Cambiar nombre».

**Inscribir lector.** Nombre, teléfono opcional y una casilla obligatoria: «Le avisé que su nombre y su teléfono se usan solo para los préstamos de la biblioteca». Al guardar se registra `avisoDatos` con la hora del servidor y el correo del voluntario. Si ya existe un lector con la misma clave: «Ya existe: (nombre del lector vigente). Búscalo en la lista». Si el nombre no es válido: «Escribe al menos 3 letras».

**Actualización en vivo.** Los cambios hechos en otro teléfono aparecen sin recargar y sin mover la posición de la lista ni borrar lo que la persona está escribiendo.

## Carga inicial de datos

`scripts/cargar-datos.mjs` usa Admin SDK: sin llaves contra demo, y solo por el dueño con credenciales locales fuera del emulador. Lee un archivo JSON con este formato, el mismo de `tests/fixtures/carga-ficticia.json`:

```json
{
  "categorias": [{"nombre": "Infantil", "prefijo": "INF"}],
  "libros": [{"codigo": "INF003", "titulo": "…", "autor": "…", "categoria": "Infantil", "baja": false}],
  "lectores": [{"id": "L001", "nombre": "…", "telefono": "56900000001"}],
  "prestamos": [{"numero": 1, "libro": "INF003", "lector": "L001", "salio": "2026-10-03", "vence": "2026-10-17", "devuelto": true, "devolvio": "2026-10-10"}],
  "contadores": {"ultimoPrestamo": 1, "ultimoLector": 1}
}
```

La limpieza del Excel no es parte de este script: el archivo llega ya depurado. Las claves que empiezan con `_` se ignoran.

Comportamiento:

- `--simular` valida todo, no escribe nada y entrega un informe: cantidades por colección, registros rechazados con su motivo y advertencias.
- `--cargar` escribe solo si la simulación no tuvo rechazos y las colecciones de destino están vacías.
- «Colecciones vacías» se refiere a libros, lectores, claves y préstamos, no a la configuración/voluntarios que creó la Etapa 1. Si las colecciones de negocio no están vacías, el script se detiene. Para reemplazar exige `--reemplazar`, y antes de tocar nada ejecuta `respaldar.mjs` y verifica integridad, SHA-256 y referencias del respaldo según contrato §6.
- Lo que escribe:
  - `config/app.categorias` con la lista del archivo; `config/contadores` con los valores del archivo.
  - Cada libro, con `prestamoAbierto` y `vecesPrestado` calculados desde los préstamos.
  - Cada lector, con su `clave`, `avisoDatos` nulo, `esDestinoFusion:false`, `fusionadoEn:null` y su documento de `lectoresClave`.
  - Cada préstamo con: `prestadoEn` al mediodía de Chile del día `salio`; `venceEl` un milisegundo antes del primer instante del día siguiente a `vence`, en hora de Chile; `temporada` por el bimestre de `salio`; `origen: excel`; `creadoPor: carga-inicial`; `estado` `devuelto` o `abierto`; además `salidaDia: salio`, `plazoSabados:null`, `registroDiferido:false`, motivo y corrección nulos, y metadatos de importación del contrato §3.
  - Un préstamo devuelto con `devolvio` nulo: `devueltoEn` nulo y `devueltoATiempo` verdadero. Con `devolvio`: `devueltoEn` al mediodía de Chile de ese día y `devueltoATiempo` según si `devolvio` supera o no a `vence`.
- Rechazos: código, identificador o número repetido; referencia a un libro o lector inexistente; dos lectores con la misma clave; nombre inválido o categoría inexistente; fecha que no existe en el calendario; devolución anterior a salida o posterior al día de importación; préstamo abierto con fecha de devolución; un libro con más de un préstamo abierto; `vence` anterior a `salio`; teléfono o código con formato inválido; `contadores` menores que el mayor número o identificador del archivo.
- Advertencias, que no impiden cargar: un préstamo abierto de un libro que tiene otro préstamo posterior; un `vence` que no cae en sábado; un plazo mayor a 4 sábados.

## Respaldo y restauración

- `scripts/respaldar.mjs` exporta todas las colecciones de la biblioteca a `datos/respaldo-AAAAMMDD-HHMM.json`, con timestamps exactos, rutas, versión de esquema y hash. Usa mantenimiento y validación del contrato §6; no toma una copia incoherente mientras otra persona escribe.
- `scripts/restaurar.mjs` repone un respaldo en una base vacía. Si la base no está vacía, se detiene. Para reponer sobre datos existentes exige `--reemplazar`, y antes de tocar nada ejecuta `respaldar.mjs` y verifica el archivo generado.
- El dueño ejecuta el respaldo después de cada sábado. El plan gratuito de Firestore no incluye respaldos automáticos.

## Índices

Ninguno compuesto en esta etapa.

## Casos de prueba

| ID | Situación | Resultado esperado |
|---|---|---|
| C-01 | Voluntario crea o edita un libro | Denegado |
| C-02 | Administrador agrega un libro cuyo código ya existe | «El código ya existe»; el libro existente no cambia |
| C-03 | Administrador agrega un libro con código `inf 028` | Se guarda `INF028` |
| C-04 | Código sugerido con mayor `INF027` / con mayor `INF999` / con huecos en la numeración | `INF028` / `INF1000` / mayor más uno |
| C-05 | Título de 121 caracteres o de 1 carácter | Rechazado con mensaje |
| C-06 | Título `<img src=x onerror=…>` | Se guarda y se muestra como texto; no se ejecuta nada |
| C-07 | Administrador intenta cambiar `prestamoAbierto` o `vecesPrestado` al editar un libro | Denegado |
| C-08 | Cualquiera intenta borrar un libro o un lector | Denegado |
| C-09 | Inscribir «  rafaela   TOLEDO » cuando existe «Rafaela Toledo» | Rechazado: «Ya existe: Rafaela Toledo…» |
| C-10 | Nombre con un espacio de ancho cero o con `ı` que imita a uno existente | Rechazado por nombre repetido |
| C-11 | Nombres `...`, `a b` y solo espacios | Rechazados: «Escribe al menos 3 letras» |
| C-12 | Nombre de una sola palabra, «Pepita» | Aceptado |
| C-13 | Nombre de 60 caracteres / de 61 | Aceptado / rechazado |
| C-14 | «Peña» cuando existe «Pena» | Aceptado: son claves distintas |
| C-15 | Teléfonos `900000012`, `+56 9 0000 0012`, `56900000012` | Se guardan como `56900000012` |
| C-16 | Teléfonos `12345`, `800000012`, `no tiene`, `5690000001234` | Error visible; no se guarda |
| C-17 | Teléfono vacío | Lector con `telefono` nulo |
| C-18 | Inscribir sin marcar la casilla de aviso | No se puede guardar |
| C-19 | Dos teléfonos inscriben a la vez el mismo nombre | Uno se crea; el otro recibe «Ya existe…» |
| C-20 | Cinco altas de lector en paralelo | Las que terminan tienen identificadores distintos y consecutivos; las que no, muestran «Inténtalo de nuevo» y nada queda a medias |
| C-21 | Crear un lector sin su documento de clave, o sin subir el contador, o saltándolo | Denegado |
| C-22 | Doble toque en «Inscribir» | Un solo lector |
| C-23 | Voluntario cambia el teléfono de un lector / intenta cambiar el nombre | Permitido / denegado |
| C-24 | Administrador cambia el nombre de un lector | Nueva clave creada; la clave antigua sigue apuntando al lector; inscribir el nombre antiguo responde «Ya existe: (nombre nuevo)» |
| C-37 | Administrador corrige «Maria Lagos» a «María Lagos», y después vuelve al nombre anterior | Ambos cambios se guardan; no se crea ni falla ningún documento de clave |
| C-25 | Buscar «dios prodigo» y «inf 006» | Encuentra «El Dios pródigo» e INF006 |
| C-26 | Buscar `(.*[\` | Lista vacía con mensaje; sin error |
| C-27 | Otro teléfono agrega un libro mientras escribo en el buscador | Aparece sin perder el texto ni el foco |
| C-28 | Carga en modo simulación con el archivo ficticio | Informe sin rechazos; nada escrito |
| C-29 | Carga con un libro con dos préstamos abiertos, o con `contadores` menores que el máximo | Rechazo que nombra los registros |
| C-30 | Carga con un `vence` que no es sábado o un plazo de 15 sábados | Advertencia; se carga con el `vence` del archivo |
| C-31 | Carga real sobre colecciones con datos, sin `--reemplazar` | Se detiene sin escribir |
| C-32 | `--reemplazar` | Genera y verifica el respaldo antes de escribir |
| C-33 | Después de cargar | Cada libro con préstamo abierto tiene `prestamoAbierto`; `vecesPrestado` coincide con sus préstamos; cada lector tiene su documento de clave |
| C-34 | Respaldar, vaciar el emulador y restaurar | La base queda idéntica documento por documento, incluidas las marcas de tiempo |
| C-35 | Restaurar sobre una base con datos, sin `--reemplazar` / con `--reemplazar` | Se detiene sin escribir / respalda, verifica y luego repone |
| C-36 | Nombre o título de una sola palabra de 60 letras, a 320 px | Sin desplazamiento horizontal en lista ni en ficha |

### Casos adicionales de la revisión 1.1

| ID | Situación | Resultado esperado |
|---|---|---|
| C-38 | Subir contador de lectores sin crear lector o crear dos con un incremento | Denegado; enlace bidireccional a ultimoLectorId |
| C-39 | Reintento de alta de lector tras carrera con otro nombre | Conserva operacionId; solo el intento confirmado determina el correlativo |
| C-40 | Respaldo mientras otro teléfono intenta escribir | Mantenimiento impide nuevas mutaciones; hash y restauración coinciden |
| C-41 | Fallo a mitad de importar/restaurar | Manifiesto permite reanudar y mantenimiento impide usar una base parcial |
| C-42 | Nombre inválido, categoría inexistente o fecha imposible en carga | Rechazo antes de escribir |
| C-43 | Administrador redirige una clave a otro lector sin unión válida | Denegado |

## Carga y límites

Con 5.000 libros y 3.000 lectores generados en el emulador, y el procesador reducido a un cuarto:

- Abrir Catálogo y Lectores: menos de 1 segundo.
- Cada tecla en los buscadores: menos de 100 milisegundos.
- Lecturas de una apertura de la app con los datos ficticios, medidas con el contador de `datos.js`: anotarlas y compararlas con el límite diario de 50.000.

## Prueba de humo en el proyecto de ensayo (la ejecuta el dueño)

1. Desplegar reglas e índices.
2. Cargar el archivo ficticio: primero simulación, luego carga.
3. Desde dos teléfonos reales, inscribir un lector en uno y verlo aparecer en el otro.
4. Inscribir el mismo nombre desde ambos casi a la vez: uno debe recibir «Ya existe…».
5. Ejecutar un respaldo y comprobar que el archivo queda en `datos/`.

## Lista de entrega

- [ ] Reglas de seguridad con sus pruebas, y consultas por operación anotadas.
- [ ] `texto.js` con pruebas de unidad de la clave, el nombre, el teléfono y el código sugerido.
- [ ] Scripts de carga, respaldo y restauración con sus pruebas.
- [ ] `informes/etapa-2.md` con tiempos, lecturas medidas y lo que no está listo.
