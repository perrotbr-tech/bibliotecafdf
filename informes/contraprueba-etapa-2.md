# Contraprueba externa — Etapa 2

**SHA revisado:** `f64b78fbcbec1e482f43dc5625607afde58c0796` (`f64b78f`)  
**Confirmación:** `git log -1 --oneline` → `f64b78f Encargo de contraprueba para Cursor`  
**Nota de alcance:** el informe de entrega declara como último commit de *código* `dcd9e5f`. Entre `dcd9e5f` y `f64b78f` solo hay documentación (`436fe3b` actualiza el SHA del informe; `f64b78f` añade el encargo). El código de aplicación revisado es el de `dcd9e5f`.  
**Revisor:** sesión distinta a la del implementador. **No se modificó** la rama `etapa-2` ni ningún archivo de aplicación; este archivo es el único entregable.

---

## 1. Ejecución de pruebas (esta máquina)

Entorno: Node `v22.14.0`, npm `10.9.7`, OpenJDK `21.0.10`, firebase-tools `15.33.0`, firebase SDK `12.19.0`, firebase-admin `14.5.0`, @firebase/rules-unit-testing `5.0.2`, @playwright/test `1.56.1`, Chromium Playwright `141.0.7390.37`, proyecto `demo-biblioteca`.

| Suite | Declarado (informe §2.2) | Obtenido aquí | ¿Coincide? |
|---|---|---|---|
| `revisar-repositorio` | sin hallazgos | sin hallazgos | Sí |
| unidad | 140 pass | 140 pass / 0 fail | Sí |
| reglas | 72 pass | 72 pass / 0 fail | Sí |
| scripts | 24 pass | 24 pass / 0 fail | Sí |
| e2e | 76 passed | 76 passed (tras instalar Chromium) | Sí en resultado; ver abajo |
| carga | 6 passed | 6 passed | Sí en conteo; **números distintos** |

**Primera corrida de `npm test`:** e2e y carga **no corrieron**: Playwright no tenía el binario (`browserType.launch: Executable doesn't exist … chromium_headless_shell-1194`). Tras `npx playwright install chromium`, e2e y carga pasaron. **No se dan por buenas** las 76+6 de la primera pasada; sí las de la segunda.

**SDK en e2e:** `[e2e] el SDK se baja de www.gstatic.com, como en producción.` (gstatic respondió aquí; el respaldo `node_modules` no se activó.)

**Carga (mediana, procesador a 1/4), comparada con el informe:**

| Medida | Informe | Esta máquina |
|---|---|---|
| Catálogo 150 | 736 ms | 407 ms |
| Lectores 100 | 498 ms | 166 ms |
| Catálogo 5.000 | 5.225 ms (1,04 ms/doc) | 3.373 ms (**0,67 ms/doc**) |
| Lectores 3.000 | 2.935 ms | 1.695 ms |
| Tecla catálogo | 14 ms | 9 ms |
| Tecla lectores | 11 ms | 5 ms |

La conclusión cualitativa del informe (tecla OK; apertura a 5.000 no cumple el 1 s) se reproduce. Los milisegundos absolutos **no** son portables; ver hallazgo H-03.

---

## 2. Tabla de hallazgos

| ID | Archivo:línea | Qué está mal | Cómo reproducirlo | Gravedad | Criterio de corrección |
|---|---|---|---|---|---|
| **H-01** | `scripts/restaurar.mjs` ~152–163 (y `crearManifiesto` sin `huella`) | La **carga** cierra el camino de reanudar con otro contenido mediante `huella` (`cargar-datos.mjs` 504–512). La **restauración** solo compara `manifiesto.origen` con la ruta del `--archivo`. Si se reemplaza el *contenido* del mismo path (o se apunta a un archivo distinto copiado encima), `--reanudar` mezcla documentos del respaldo A (ya en `hechos`) con el respaldo B (pendientes). El encargo pedía comprobar exactamente este cierre. | 1) Cortar una restauración a mitad (como C-41). 2) Sustituir el JSON de `--archivo` por otro respaldo distinto, **misma ruta**. 3) `node scripts/restaurar.mjs --archivo <misma-ruta> --reanudar`. Observar base híbrida. | **Corregir antes de producción** (scripts del dueño sobre datos reales) | Al crear el manifiesto de restauración guardar `huella: hashCanonico(respaldo)` (o del cuerpo canónico de documentos). Al reanudar, rechazar si la huella no coincide. Prueba automatizada que falle sin el check y pase con él. |
| **H-02** | `docs/js/operaciones.js` 86–107 | Tras `permission-denied`, si la clave sigue libre se reintenta y, al agotar intentos, se reporta `carrera-perdida` + «Inténtalo de nuevo». Un **denegado real** (voluntario desactivado a mitad, o lectura de clave `denegada`) sigue el mismo camino y **no** conserva el mensaje de permiso. El informe §2.3 vende la distinción carrera/conflicto; la distinción denegado-real/carrera queda incompleta. | Con sesión activa, desactivar el voluntario en Admin SDK y disparar un alta cuya clave esté libre; o forzar `permission-denied` sin ocupación de clave. Tras tres intentos: mensaje de carrera, no de permiso. | **Menor** (no corrompe datos; sí miente el motivo) | Si tras denegado la clave no está tomada **y** una lectura/escritura de prueba sigue denegada por auth/permiso, devolver `denegado` sin reetiquetar. Prueba e2e o de reglas+cliente que lo fije. |
| **H-03** | `informes/etapa-2.md` §2.2 / §3 («1,04 ms por documento») | La cifra se presenta como dato de la etapa sin anclarla al contenedor. En esta máquina la mediana fue **0,67 ms/doc** (y aperturas ~35–40 % más rápidas). El encargo pide no dar por bueno ese número si difiere. | `npm run prueba:carga` en otra máquina y comparar. | **Menor** (documentación / honestidad del informe) | Cualificar: «medido en \<entorno\>, mediana de 3 corridas; no es garantía de otro host». No tratar 1,04 como constante del diseño. |

### Puntos revisados sin hallazgos

| Área | Veredicto |
|---|---|
| Enlace bidireccional contador ↔ lector ↔ clave (reglas + C-21/C-38) | **Revisado, sin hallazgos.** `getAfter` exige lector recién creado, clave apuntando al id, y contador N→N+1 con `ultimoLectorId`. No se encontró secuencia que cree dos lectores con la misma clave/id, ni lector sin clave, ni contador subido sin lector. Las transacciones son atómicas ante denegación de reglas. |
| `operacionId` / `creacionId` en reintento (C-39 + código) | **Revisado, sin hallazgos.** El bucle reusa el mismo `operacionId`; el documento lleva `creacionId: idOperacion`. |
| Respaldo con `bloqueo: null` fuera de la comparación | **Revisado, sin hallazgos.** Solo se excluye `bloqueo` (y `bloqueo.*`) en `config/control`. Otros campos del control sí se comparan. Coherente con contrato §6. |
| Huella al reanudar **carga** | **Revisado, sin hallazgos** en carga (sí hay `huella`). El hueco está en restauración → H-01. |
| `--reemplazar` de carga preserva voluntarios / config / calendario / fotografías | **Revisado, sin hallazgos.** Solo borra `COLECCIONES_DE_NEGOCIO` = libros, lectores, lectoresClave, prestamos. Rechaza si hay temporadas. Borrado a mitad deja mantenimiento. |
| Cálculo manual de 3 préstamos del fixture (+ uno atrasado) | **Revisado, sin hallazgos.** P#14 abierto, P#25 a tiempo, P#1 sin fecha, P#60 atrasado: `prestadoEn`, `venceEl`, `temporada`, `devueltoEn`, `devueltoATiempo`, `prestamoAbierto`/`vecesPrestado` coinciden con el script. |
| Bordes DST 04–05 abr / 05–06 sep 2026 | **Revisado, sin hallazgos.** 04-04 = 25 h; 05-04 = 24 h; 05-09 = 24 h; 06-09 = 23 h; primer instante del 06-09 = `2026-09-06T04:00:00.000Z`. Alineado con las pruebas de `fechas.test.mjs` y con la corrección descrita en el informe. |
| Hoja: historial / Atrás / foco | **Revisado, sin hallazgos** de entradas muertas: una sola entrada; reemplazo en lugar de pila. Trade-off documentado: al abrir teléfono desde ficha, un Atrás vuelve a la lista (no a la ficha). El nombre del e2e «se cierra de a una» describe mal el comportamiento real (reemplazo), pero no es un defecto de producto. |
| C-27 / no borrar lo escrito | **Revisado, sin hallazgos** en código: buscador y filtros viven fuera de `pintarLista`; escucha con `cambios === 0` no repinta. Cambio de `config/app` solo repinta fichas/lista. C-27 e2e cubre alta remota de libro; el camino `config/app` no tiene e2e propio, pero no se halló borrado. |
| Filtro sin `RegExp` del usuario (C-26) | **Revisado, sin hallazgos.** `coincideBusqueda` usa `includes` sobre texto normalizado; no hay `new RegExp` en vistas ni en el filtro. |
| 43 casos cubiertos de verdad | **Revisado, sin hallazgos de cobertura falsa.** Cada C-01…C-43 aparece en al menos una prueba que ejercita el comportamiento pedido (reglas, unidad, scripts y/o e2e). Se muestrearon C-21/38 (reglas), C-19/20/39 (concurrencia), C-27/26, C-30/32/34/41, C-43. |
| Cuenta conservadora 10 accesos / máx. 4 por operación en alta | **Revisado, sin hallazgos.** A mano: crear lector = `esVoluntario`+`sinBloqueo`+`getAfter(clave)`+`getAfter(contadores)` → 4; clave = 3; contadores = 3; total 10. Cabecera de `firestore.rules` coincide. |
| Límites no garantizados por reglas (clave↔nombre, categoría) | **Revisado, sin hallazgos.** Declarados en cabecera de reglas. Cliente: `claveDeNombre` + `esNombreDeLectorValido`; `revisarLibro` exige categoría en la lista. Carga rechaza categoría inexistente y nombre inválido (C-42). |
| Filtración etapas 3–7 (préstamos app, devoluciones, calendario operativo, juego, unión) | **Revisado, sin hallazgos.** `prestar.js` / `prestamos.js` son placeholders «Llega en la Etapa 3». No hay UI ni reglas de préstamo/devolución/unión/cierre. `prestamos` solo se escribe por Admin en la carga, como declara el informe. |

---

## 3. Resumen para el implementador

Hay **un** hallazgo que debe cerrarse antes de tratar los scripts del dueño como listos para datos reales (**H-01**: huella en restauración). **H-02** y **H-03** son menores.

Tras corregir, contraprobar de nuevo el mismo SHA de corrección (no bastan afirmaciones documentales). No se modifica código en esta contraprueba.
