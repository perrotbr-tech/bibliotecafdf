# Plan de la Etapa 2 — Catálogo y lectores

12-10-2026. Plan previo que exige `PROMPT-MAESTRO-CURSOR.md`. **No hay código de
la Etapa 2 escrito.** Nada se construye hasta que lo apruebes.

## 1. Qué leí

`specs/02-catalogo-y-lectores.md` completo, y de nuevo las secciones del contrato
que esta etapa toca: §3 (correlativos y contadores enlazados), §6 (mantenimiento,
respaldo verificable y trabajos reanudables), §7 (claves de nombre y por qué una
clave no se redirige), y base §5 (modelo de `libros`, `lectores`, `lectoresClave`).

## 2. Dos cosas que ya comprobé, para no planificar sobre un supuesto

- **Dónde vive Lectores.** No es un sexto destino: el prototipo la pone dentro de
  «Más», junto a Ranking, Estadísticas y Ajustes. Va ahí, como Voluntarios.
- **`avisoDatos.fecha` con hora del servidor dentro de un mapa anidado.** De esto
  depende el alta de lector, así que lo probé contra el emulador antes de
  planificar: Firestore acepta el centinela anidado y la regla puede exigir
  `request.resource.data.avisoDatos.fecha == request.time`, denegando una hora
  puesta por el cliente. Funciona.

## 3. Contradicciones y decisiones

### D-1. La Etapa 2 cambia una regla de la Etapa 1

`config/contadores` hoy es `allow write: if false`, y la Etapa 2 necesita que
`ultimoLector` pase de N a N+1. El documento de la etapa no tiene sección «Qué
cambia de etapas anteriores», pero su Alcance §5 lo enumera, así que lo tomo como
autorizado. Consecuencia concreta: **una prueba de reglas de la Etapa 1 cambia**
—la que hoy afirma que ni el administrador escribe `config/contadores`—. Lo digo
porque significa tocar una prueba que hoy está en verde, y eso no debe pasar
inadvertido.

### D-2. `esDestinoFusion` no está en la tabla de la Etapa 2

La tabla de `lectores` de esta etapa no lo lista, pero base §5 y contrato §7 lo
exigen en **toda** alta («todas las altas inicializan el campo en falso»), y la
sección de carga de esta misma etapa sí lo escribe. Lo incluyo en el alta desde la
app y en la lista de campos permitidos de las reglas. Sin él, la Etapa 6 se
encuentra con lectores que no se pueden unir.

### D-3. Qué cuesta un alta de lector en accesos de reglas

Un alta toca tres documentos en una transacción: el lector, su clave y el
contador. Con los `getAfter` que el contrato §3 exige para enlazar contador y
documento, la cuenta estimada es:

| Documento de la transacción | Accesos |
|---|---|
| `lectores/{id}` (crear) | voluntario + control + getAfter(clave) + getAfter(contador) = **4** |
| `lectoresClave/{clave}` (crear) | voluntario + control + getAfter(lector) = **3** |
| `config/contadores` (subir) | voluntario + control + getAfter(lector) = **3** |

**10 por transacción**, contra el límite de 20, y ninguna operación pasa de 10.
Entra, pero con la mitad del presupuesto gastado en una sola alta: lo mido de
verdad y lo reporto, y si sale más alto simplifico antes de dar la etapa por
buena.

### D-4. La búsqueda no puede construir una expresión regular

C-26 pide que buscar `(.*[\` devuelva lista vacía con mensaje y sin error. Eso
descarta armar una expresión regular con lo que escribe la persona: la búsqueda
será subcadena sobre texto normalizado. Además, con 5.000 libros hay que
normalizar una sola vez al recibir la colección, no en cada tecla, para cumplir
los 100 ms por pulsación.

### D-5. La hoja emergente vuelve

La retiré en la Etapa 1 porque ninguna pantalla la abría. Las fichas de libro y
de lector y los formularios de alta son su primer uso real, así que vuelve —con
sus pruebas de foco y de botón Atrás, que en la Etapa 1 quedaron sin ejercitar.

### D-6. El límite de carga de esta etapa no cabe en el plan gratuito

La etapa pide medir con **5.000 libros y 3.000 lectores**. Leer eso en vivo son
8.000 documentos por apertura: unas **seis aperturas al día** contra el límite de
50.000 lecturas diarias. Para la biblioteca real —150 libros y 100 lectores— no
hay problema, y base §12 dice que la paginación se evalúa «sobre el tamaño real»,
así que **no la construyo**. Pero el número va al informe en grande, porque es el
techo de este diseño y conviene saberlo antes de ofrecerle la app a otra
biblioteca.

### D-7. Dos detalles de la carga que conviene tener a la vista

- El script escribe `prestamos`, una colección que **no tiene reglas hasta la
  Etapa 3**. Admin SDK no pasa por reglas, así que la carga funciona; el cliente
  no los puede leer, que es justo lo que esta etapa quiere.
- El fixture trae 36 préstamos abiertos y 20 devueltos sin fecha, que es el caso
  que base §5 manda cargar con `devueltoEn` nulo y `devueltoATiempo` verdadero.

## 4. Plan en pasos

1. **Funciones puras primero**, con sus pruebas: clave de nombre (incluidos
   ancho cero, `ı` y la `ñ` que no se pisa con `n`), nombre válido, teléfono en
   sus tres formas de entrada más los dígitos de ancho completo, normalización de
   código, código sugerido y normalización de búsqueda. Son C-03, C-04, C-05,
   C-09 a C-17, C-25 y C-26.
2. **Reglas de `libros`, `lectores`, `lectoresClave` y `contadores`**, con sus
   pruebas y el conteo de accesos: C-01, C-07, C-08, C-21, C-23, C-38, C-43, y el
   bloqueo de mantenimiento sobre las colecciones nuevas.
3. **Scripts**, que es la parte más pesada: `cargar-datos.mjs` con simulación,
   carga y reemplazo; `respaldar.mjs` con mantenimiento, hash SHA-256 y
   verificación; `restaurar.mjs` con comparación documento por documento y
   manifiesto reanudable. C-28 a C-35, C-41 y C-42.
4. **Pantallas**: Catálogo con búsqueda, filtros y «Mostrar más»; ficha de libro;
   agregar y editar libro; Lectores dentro de Más; ficha de lector; inscribir
   lector con su casilla obligatoria. C-02, C-06, C-18, C-22, C-24, C-27, C-36,
   C-37.
5. **Concurrencia**, que es donde esta etapa se puede romper de verdad: dos
   teléfonos inscribiendo el mismo nombre (C-19), cinco altas en paralelo
   (C-20) y el reintento que conserva su `operacionId` (C-39).
6. **Carga y mediciones** con 5.000 libros y 3.000 lectores, y el informe.

## 5. Archivos que voy a crear o tocar

| Grupo | Archivos |
|---|---|
| Puras | `docs/js/texto.js` (ampliar) |
| Componentes | `docs/js/ui/hoja.js` (vuelve) |
| Vistas | `catalogo.js` (reescribir), `libro.js`, `agregar-libro.js`, `lectores.js`, `lector.js`, `inscribir-lector.js`, `mas.js` (añadir Lectores) |
| Estilos | `docs/css/app.css` (tejuelo por categoría, fichas, listas largas) |
| Reglas | `firestore.rules` |
| Scripts | `cargar-datos.mjs`, `respaldar.mjs`, `restaurar.mjs`, y uno compartido para mantenimiento, manifiesto y hash |
| Pruebas | `tests/unidad/`, `tests/reglas/libros` y `lectores`, `tests/scripts/`, `tests/e2e/catalogo` y `lectores`, `tests/carga/` |
| Ajuste de la Etapa 1 | la prueba de reglas de `config/contadores` (D-1) |
| Entrega | `informes/etapa-2.md` |

## 6. Qué NO voy a hacer

Prestar y devolver, la ficha del lector con sus préstamos, unir lectores,
paginación, y cualquier pantalla de las etapas 3 a 7. `prestamoAbierto` solo
cambia por la carga inicial.

## 7. Qué necesito

Tu confirmación del plan. No hay ninguna duda que me bloquee: las seis decisiones
de arriba las tomo yo salvo que me corrijas, y las dos que más conviene mirar son
**D-1** (toco una prueba de la Etapa 1 que hoy está en verde) y **D-6** (el techo
de 8.000 documentos por apertura).
