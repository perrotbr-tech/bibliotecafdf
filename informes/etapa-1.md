# Informe de la Etapa 1 — Base y acceso

Revisión 1.1 · 12-10-2026 (America/Santiago) · rama `etapa-1`

**SHA entregado para la contraprueba:** el último commit de `etapa-1`. Se anota
en la sección 9 apenas queda empujado; ese es el commit exacto que debe revisar
Codex y el que debe publicarse en ensayo.

> **Lo primero, porque cambia cómo se lee todo lo demás:** las pruebas de
> extremo a extremo y de carga están **escritas pero NO ejecutadas**. El
> contenedor donde se construyó esta etapa tiene denegado por política de red el
> host `www.gstatic.com`, de donde la app carga el SDK de Firebase, así que la
> app no arranca en un navegador ahí. Las pruebas de unidad, de reglas y de los
> scripts sí se ejecutaron y están en verde. No se declara aprobado nada que no
> se haya corrido.

## 1. Qué se construyó

- **Andamiaje.** `package.json` y `package-lock.json` con versiones exactas,
  `firebase.json` con los emuladores de Auth y Firestore bajo `demo-biblioteca`,
  `firestore.rules`, `firestore.indexes.json` vacío, `.gitignore` que excluye
  `datos/` y las llaves, configuración de Playwright.
- **Integración continua.** `.github/workflows/pruebas.yml` corre en cada
  solicitud de cambios el escáner, unidad, reglas, scripts, extremo a extremo y
  carga.
- **`scripts/revisar-repositorio.mjs`.** Falla si encuentra versionado algo de
  `datos/`, un archivo con forma de llave de servicio o un teléfono chileno que
  no sea ficticio, con la regla exacta del documento: once dígitos seguidos, sin
  dígitos pegados a los lados, que empiecen con `569` y no con `5690000`.
- **Cáscara de la app.** `docs/index.html` con `lang="es"`, metaetiqueta de
  ventana y manifiesto instalable; franja de ambiente; barra superior con el
  nombre de la biblioteca y la fecha de Chile; cinco destinos en la barra
  inferior; botón Atrás manejado con el historial.
- **Entrada** con Google por `signInWithPopup`, cierre de sesión, y la selección
  cerrada de ambiente del contrato §1.
- **Control de acceso** por lista de voluntarios y por rol, con escucha viva del
  propio documento para que una desactivación se note en la siguiente lectura.
- **Forma de guardar** completa, implementada una sola vez en `docs/js/datos.js`:
  transacción con `maxAttempts` 5, botón bloqueado, éxito solo con respuesta,
  intención estable, aviso de demora a los 5 segundos y resolución de resultado
  incierto por identidad de la operación.
- **Hora verificada** en `docs/js/reloj.js`, con el contrato §2 entero.
- **Pantalla Voluntarios** para el administrador: lista ordenada por nombre con
  nombre, correo, rol y estado, formulario para agregar y botón para desactivar
  o reactivar.
- **Reglas de seguridad** de `voluntarios` y `config` (incluido `config/control`),
  con metadatos de operación y negación por defecto.
- **`scripts/inicializar.mjs`**, que prepara una base vacía y es idempotente.
- **Iconos** propios (SVG más tres PNG), dibujados en el repositorio, sin
  dependencias ni fuentes externas.

## 2. Casos de prueba

### 2.1 Estado caso por caso

| ID | Dónde está la prueba | Estado |
|---|---|---|
| A-01 | `tests/reglas/voluntarios.test.mjs` | **Pasa** |
| A-02 | reglas **Pasa**; `tests/e2e/acceso.spec.mjs` sin ejecutar | Parcial |
| A-03 | reglas **Pasa**; e2e sin ejecutar | Parcial |
| A-04 | reglas **Pasa**; e2e sin ejecutar | Parcial |
| A-05 | `tests/reglas/voluntarios.test.mjs` | **Pasa** |
| A-06 | `tests/reglas/voluntarios.test.mjs` | **Pasa** |
| A-07 | `tests/reglas/config.test.mjs` | **Pasa** |
| A-08 | reglas **Pasa**; e2e sin ejecutar | Parcial |
| A-09 | `tests/reglas/voluntarios.test.mjs` (2 pruebas) | **Pasa** |
| A-10 | reglas **Pasa**; e2e sin ejecutar | Parcial |
| A-11 | `tests/reglas/voluntarios.test.mjs` | **Pasa** |
| A-12 | `tests/reglas/config.test.mjs` (2 pruebas) | **Pasa** |
| A-13 | `tests/unidad/texto.test.mjs` **Pasa**; e2e sin ejecutar | Parcial |
| A-14 | reglas **Pasa**; e2e sin ejecutar | Parcial |
| A-15 | solo `tests/e2e/acceso.spec.mjs` | **Sin ejecutar** |
| A-16 | solo `tests/e2e/voluntarios.spec.mjs` | **Sin ejecutar** |
| A-17 | `tests/unidad/datos.test.mjs` **Pasa**; e2e sin ejecutar | Parcial |
| A-18 | solo `tests/e2e/voluntarios.spec.mjs` | **Sin ejecutar** |
| A-19 | `tests/unidad/datos.test.mjs` **Pasa**; e2e sin ejecutar | Parcial |
| A-20 | `tests/unidad/datos.test.mjs` **Pasa**; e2e sin ejecutar | Parcial |
| A-21 | `tests/reglas/voluntarios.test.mjs` | **Pasa** |
| A-22 | `tests/unidad/reloj.test.mjs` **Pasa**; e2e sin ejecutar | Parcial |
| A-23 | `tests/unidad/reloj.test.mjs` **Pasa**; e2e sin ejecutar | Parcial |
| A-24 | `tests/unidad/reloj.test.mjs` y `fechas.test.mjs` **Pasan**; e2e sin ejecutar | Parcial |
| A-25 | solo `tests/e2e/acceso.spec.mjs` | **Sin ejecutar** |
| A-26 | solo `tests/e2e/acceso.spec.mjs` (2 pruebas) | **Sin ejecutar** |
| A-27 | solo `tests/e2e/acceso.spec.mjs` | **Sin ejecutar** |
| A-28 | `tests/scripts/inicializar.test.mjs` (4 pruebas) | **Pasa** |
| A-29 | `tests/unidad/revisar-repositorio.test.mjs` (6 pruebas) | **Pasa** |
| A-30 | `tests/unidad/ambiente.test.mjs` (5 pruebas) **Pasa**; e2e sin ejecutar | Parcial |
| A-31 | manual, para el dueño | Pendiente |
| A-32 | `tests/unidad/reloj.test.mjs` | **Pasa** |
| A-33 | `tests/unidad/reloj.test.mjs` (4 pruebas) **Pasa**; e2e sin ejecutar | Parcial |
| A-34 | `tests/unidad/reloj.test.mjs` y `tests/reglas/voluntarios.test.mjs` | **Pasa** |
| A-35 | `tests/unidad/ambiente.test.mjs` (2 pruebas) **Pasa**; e2e sin ejecutar | Parcial |
| A-36 | `tests/unidad/datos.test.mjs` **Pasa**; e2e sin ejecutar | Parcial |
| A-37 | solo `tests/e2e/acceso.spec.mjs` (2 pruebas) | **Sin ejecutar** |
| A-38 | `tests/reglas/voluntarios.test.mjs` (2 pruebas) | **Pasa** |
| A-39 | `tests/unidad/datos.test.mjs` **Pasa**; e2e sin ejecutar | Parcial |
| A-40 | `tests/reglas/voluntarios.test.mjs` (2 pruebas) | **Pasa** |

Resumen: **32 de los 39 automatizables tienen evidencia ejecutada** (completa o
parcial); **7 no tienen ninguna** porque solo viven en extremo a extremo (A-15,
A-16, A-18, A-25, A-26, A-27, A-37); A-31 es manual.

### 2.2 Salida de la ejecución

Las tres suites que sí corrieron, en esta máquina, el 12-10-2026:

```
### npm run revisar
revisar-repositorio: sin hallazgos

### npm run prueba:unidad
# tests 52
# pass 52
# fail 0

### npm run prueba:reglas        (firebase emulators:exec, demo-biblioteca)
# tests 26
# pass 26
# fail 0
# duration_ms 10277.919263

### npm run prueba:scripts       (firebase emulators:exec, demo-biblioteca)
# tests 7
# pass 7
# fail 0
# duration_ms 11812.839231
```

**85 pruebas ejecutadas, 85 en verde, 0 en rojo.** Ninguna se saltó ni se
desactivó.

### 2.3 Comprobaciones estáticas y de humo

Separadas a propósito de lo anterior, porque no son pruebas de los casos:

- Los 23 módulos de `docs/js/` y los scripts pasan `node --check` y se importan
  en Node sin error.
- La cáscara servida desde `docs/` y abierta en Chromium 141 a 320 px: franja
  «EMULADOR · demo-biblioteca», `?ensayo=1` ignorado con su aviso, `lang="es"`,
  manifiesto e íconos servidos, **0 px de desplazamiento horizontal**, ningún
  error de JavaScript, y los únicos hosts pedidos son el propio origen y
  `www.gstatic.com`. El SDK no cargó, por lo dicho arriba.

## 3. Prueba de carga

**No ejecutada**, por la misma razón: necesita la app corriendo en el navegador.
Está escrita en `tests/carga/voluntarios.carga.spec.mjs` y mide los dos límites
del documento:

| Medición | Límite del documento | Medido |
|---|---|---|
| Lista de 200 voluntarios, procesador a un cuarto | menos de 1 s | sin medir |
| Lecturas de una apertura de sesión (contador de `datos.js`) | menos de 10 | sin medir |

El contador separa, como pide el contrato §8, documentos entregados por el
servidor, eventos de caché, cambios de metadatos, documentos modificados por
escucha, lecturas de transacción, reintentos, consultas vacías, reconexiones y
una estimación de lecturas de reglas. Una escucha **no** vuelve a sumar todos
sus documentos en cada evento: solo los que cambiaron, y eso sí está probado en
`tests/unidad/datos.test.mjs`.

**Telemetría no es facturación.** Estos contadores son del cliente. No incluyen
las lecturas que consume la evaluación de reglas aunque la operación se deniegue,
ni los reintentos internos del SDK. El contraste con el panel del proyecto queda
para el ensayo.

## 4. Consultas a otros documentos en las reglas, e índices

Cada `get()` se hace una sola vez y su resultado se pasa como argumento a las
funciones que lo examinan, en vez de repetir la llamada. El conteo es por
análisis del archivo, sin suponer ahorro por caché:

| Operación | Documentos consultados | Accesos |
|---|---|---|
| Leer `voluntarios`, `config/app`, `config/contadores`, `config/control` | el propio voluntario | **1** |
| Sincronizar la hora (el propio voluntario) | el propio voluntario | **1** |
| Crear un voluntario | el propio voluntario + `config/control` | **2** |
| Cambiar un voluntario | el propio voluntario + `config/control` | **2** |
| Cambiar `config/app` | el propio voluntario + `config/control` | **2** |

Máximo observado: **2 por operación y 2 por transacción**, contra el presupuesto
de 10 y 20 del contrato §7. Las transacciones de esta etapa escriben un solo
documento.

**Índices compuestos declarados: ninguno.** La etapa no hace ninguna consulta
que pida orden por otro campo. `firestore.indexes.json` va vacío a propósito.

## 5. Decisiones tomadas donde la especificación no alcanzaba

Las cinco primeras las aprobaste antes de construir; el resto son de detalle.

1. **Prioridad de ambiente en loopback (D-3).** A-30 y el contrato §1 chocaban.
   Manda el host: `localhost`, `127.0.0.1` y `[::1]` usan siempre el emulador, y
   ahí `?ensayo=1` se ignora y se dice en pantalla. Fuera de loopback,
   `?ensayo=1` elige ensayo y se recuerda en `sessionStorage`; sin parámetro,
   producción; y una publicación con ambiente fijo manda sobre todo lo anterior.
2. **`creacionId` en los documentos de voluntarios (D-4).** El identificador del
   documento es el correo, así que la existencia no prueba autoría. Las altas
   llevan `creacionId` inmutable y los cambios `ultimaOperacionId` y
   `modificadoEn`; los tres están en las listas de campos permitidos de las
   reglas. La sincronización de hora **no** los lleva: el contrato §2 dice que
   esa excepción permite exactamente `ultimaConexion` y `sincronizacionId`.
3. **Qué bloquea el mantenimiento (D-5).** Con un bloqueo vigente se deniegan las
   escrituras de `voluntarios` y de `config`; la lectura y la sincronización de
   hora siguen disponibles. Sin documento de control no se escribe nada.
4. **Recorte de `fechas.js` (D-6).** Solo `diaEnChile`, `textoFechaLarga`,
   `temporadaDe` y `temporadaDeInstante`, porque la barra superior y el
   `inicioJuego` del script las necesitan. Sábados, vencimientos y avance de
   temporada quedan para la Etapa 3.
5. **Módulo `ambiente.js` (D-7).** La selección de ambiente tiene que ser pura
   para probarse en Node, y no puede vivir en `firebase.js`, que carga el SDK.
6. **Umbral del aviso de desfase.** 60 segundos de diferencia entre el reloj del
   teléfono y el del servidor, una sola vez por sesión.
7. **Reintentos de la muestra de hora.** «Número acotado» del contrato §2: tres,
   con espera creciente de 200 ms por intento.
8. **El SDK se importa de forma dinámica** dentro de `firebase.js`, no arriba del
   archivo. Así `datos.js`, `reloj.js` y `acceso.js` se pueden cargar en Node
   para las pruebas de unidad sin pedir nada por la red, y la app sigue sin paso
   de compilación.
9. **`BIB` y las rutas viven en `config-publica.js`.** Ninguna ruta se escribe
   fija; el script y las pruebas usan la misma constante que la app.
10. **Dos carpetas de prueba más de las que enumera la base §4:**
    `tests/ayuda/` (siembra y utilería compartida) y `tests/scripts/` (A-28, que
    necesita el emulador pero no prueba reglas). Preferí nombrarlas bien antes
    que meter A-28 en `tests/reglas/`.
11. **Recuperación tras recargar.** El contrato §3 pide que una recarga relea el
    servidor antes de ofrecer repetir. Al entrar, si quedó una intención
    pendiente, la app la relee y dice si quedó guardada, si se comprobó que no, o
    si no se pudo comprobar. Nunca repite la operación sola.
12. **Versiones fijadas.** `@firebase/rules-unit-testing@5.0.2` con
    `firebase@12.19.0`, en vez de la 6.0.0, que declara `engines: node >=24.12.0`
    y exige `firebase ^13`: con la 5.0.2 el conjunto instala sin una sola
    advertencia de motor en Node 22 y pasa. `@playwright/test@1.56.1` porque es
    la que corresponde al Chromium disponible.
13. **Un script más en `scripts/`:** `servir.mjs` (servidor estático sin
    dependencias, para desarrollo y para Playwright) y `arrancar-local.mjs`
    (el «un solo comando» de la lista de entrega).

## 6. Pruebas manuales pendientes para el dueño

1. **A-31.** Entrar con Google en Chrome y en Samsung Internet de un teléfono
   Android real, y desde la app instalada. Anotar el resultado de los tres casos.
2. **La prueba de humo completa** del documento de la etapa, en el proyecto de
   ensayo: desplegar reglas e índices, correr `inicializar.mjs`, entrar desde un
   teléfono con `?ensayo=1` y ver la franja «ENSAYO», entrar con otra cuenta y
   ver «Tu cuenta no tiene acceso», agregarla como voluntaria y volver a entrar,
   y comprobar en modo avión que los botones se deshabilitan.
3. **Las siete pruebas sin ejecutar** (A-15, A-16, A-18, A-25, A-26, A-27, A-37)
   y la de carga: o se corren en la integración continua, o se corren en tu
   computador con `npm run prueba:e2e` y `npm run prueba:carga`.
4. **La mitad de A-24 y de A-30 que necesita configuración real:** que `?ahora=`
   se ignore contra el proyecto de ensayo, y que ensayo y producción elijan el
   proyecto correcto. Hoy no se puede comprobar porque sus bloques están en
   `null`.

## 7. Qué NO está preparado para producción, y por qué

- **Las pruebas de extremo a extremo y de carga no se han ejecutado nunca.** Esto
  es lo más importante de esta lista. Hasta que corran, de la pantalla Voluntarios
  solo está demostrado lo que prueban las reglas y las funciones puras.
- **Los ambientes de ensayo y de producción no existen.** `config-publica.js` los
  tiene en `null`. La app se comporta bien con eso (lo dice y no conecta), pero
  no se ha probado contra un proyecto real.
- **El emulador no es producción.** No exige índices compuestos, no aplica todos
  los límites y no reproduce todo el comportamiento de las transacciones. Esta
  etapa no declara índices, pero esa comprobación es del ensayo.
- **La entrada con Google por ventana emergente puede ser bloqueada** por el
  teléfono o por la app instalada. La app muestra el mensaje que pide el
  documento, pero eso solo se valida a mano en teléfonos reales.
- **Las reglas no reproducen la normalización del cliente.** Comprueban forma,
  permisos y enlaces. Que el correo guardado sea el normalizado lo garantiza el
  cliente y lo cubren las pruebas de unidad.
- **La interceptación de red de A-18, A-19, A-20, A-36 y A-39** en las pruebas de
  extremo a extremo usa rutas de Playwright contra los extremos del emulador. Al
  no haberse ejecutado, es probable que los patrones de URL necesiten ajuste en
  la primera corrida. Está señalado aquí para que la contraprueba no lo lea como
  un verde.
- **Los contadores son telemetría, no facturación.** El costo cero es un objetivo
  dentro de cuotas, no una promesa.
- **Sin hora verificada no se bloquea nada todavía**, porque esta etapa no tiene
  operaciones temporales: préstamo, devolución, anulación, reapertura y cierre
  llegan después. Lo que sí está es el reloj y el «Hora pendiente» de la barra.

## 8. Qué debe desplegar o configurar el dueño, paso a paso

1. **Red, si quieres que las pruebas de extremo a extremo corran en la nube.**
   Permitir `www.gstatic.com` en Network access del entorno (menú del entorno en
   la barra de título → Edit → Allowed domains, dejando marcada la casilla de
   gestores de paquetes). Los pasos están en
   <https://code.claude.com/docs/en/cloud-environments#network-access>.
   Alternativa: correr `npm run prueba:e2e` en tu computador.
2. **Revisar que la integración continua quede en verde** en la solicitud de
   cambios. Ahí sí corren las seis suites, porque los runners de GitHub alcanzan
   `gstatic`.
3. **Pasar el SHA a Codex** para la contraprueba, con este informe.
4. **Crear los dos proyectos de Firebase** (real y ensayo), gratuitos y
   separados, con Firestore en modo de producción y región
   `southamerica-west1`, activar el inicio de sesión con Google y agregar el
   dominio de GitHub Pages a los dominios autorizados.
5. **Entregar los dos bloques web** para `docs/js/config-publica.js`. Son
   públicos por diseño; no son secretos y no reemplazan credenciales.
6. **Preparar la publicación de ensayo** en el repositorio aparte, con
   `AMBIENTE_FIJO = 'ensayo'` y `produccion` en `null`, y anotar en su README el
   SHA candidato, la URL y el resultado manual.
7. **Desplegar reglas e índices en ensayo:**
   `firebase deploy --only firestore:rules,firestore:indexes --project <ensayo>`.
8. **Ejecutar `inicializar.mjs` en ensayo** con tu correo, usando tus
   credenciales locales:
   `node scripts/inicializar.mjs --correo tu@correo.cl --nombre "Tu Nombre" --proyecto <ensayo> --confirmo-proyecto-real`.
9. **Hacer la prueba de humo con teléfonos reales** y las pruebas manuales de la
   sección 6.
10. **Recién con todo eso en verde**, fusionar y repetir los pasos 7 y 8 en el
    proyecto real, activar GitHub Pages desde `docs/` de `main`, y autorizar la
    Etapa 2.

## 9. Datos de la entrega

| Dato | Valor |
|---|---|
| Rama | `etapa-1` |
| SHA entregado | se anota al empujar; es el último commit de la rama |
| Node | 22.22.0 |
| npm | 10.9.4 |
| Java | OpenJDK 21.0.12.1 (Temurin en la integración continua) |
| firebase-tools | 15.33.0 |
| Emulador de Firestore | cloud-firestore-emulator v1.22.0 |
| @firebase/rules-unit-testing | 5.0.2 |
| firebase (SDK en pruebas) | 12.19.0 |
| SDK que carga la app desde gstatic | 12.19.0 |
| firebase-admin | 14.5.0 |
| @playwright/test | 1.56.1 |
| Chromium | 141.0.7390.37 |
| Proyecto usado | `demo-biblioteca`, solo emulador |
| Pruebas ejecutadas | 85 (52 unidad, 26 reglas, 7 scripts), todas en verde |
| Pruebas escritas sin ejecutar | 32 de extremo a extremo y 2 de carga |
| Datos personales versionados | ninguno; el escáner pasa sin hallazgos |
