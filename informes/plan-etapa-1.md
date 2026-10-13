# Plan de arranque — Etapa 1 (revisión 1.1)

12-10-2026. Este documento es el **plan** que pide `PROMPT-MAESTRO-CURSOR.md` y
`LEEME-ARRANQUE-BIBLIOTECA.md`, no el informe de la etapa. No hay código de la Etapa 1
escrito. Nada se construye hasta que apruebes este plan.

## 1. Qué leí

Completos: `AGENTS.md`, `PROMPT-MAESTRO-CURSOR.md`, `LEEME-ARRANQUE-BIBLIOTECA.md`,
`PASOS-DEL-DUENO.md`, `README.md`, `FUENTES-VERIFICADAS.md`, `.cursor/rules/biblioteca.mdc`,
`specs/00-contrato-operativo.md`, `specs/00-base.md`, `specs/01-base-y-acceso.md`,
`informes/validacion-paquete.json`.

`referencia/prototipo.html` lo revisé como referencia visual y de textos: variables de color
de `:root` en claro y oscuro, tejuelo por categoría, tono de los mensajes. No reutilizo su
lógica. Confirmo la diferencia ya listada en base §9: el prototipo nombra tipografías web
(Bricolage Grotesque, Figtree, JetBrains Mono) y la app usa tipografías del sistema.

De las etapas 2 a 7 leí solo lo necesario para no construir una base incompatible; no las
implemento.

## 2. Entorno comprobado

No declaro versiones «últimas»: estas son las que instalé y ejecuté en este contenedor.

| Pieza | Versión | Evidencia |
|---|---|---|
| Node | 22.22.0 | `node --version` |
| npm | 10.9.4 | `npm --version` |
| Java | OpenJDK 21.0.12.1 | `java -version`; sirve al emulador fijado |
| Git | 2.43.0 | `git --version` |
| firebase-tools | 15.33.0 | emuladores Auth 9099 y Firestore 8080 arrancados con `--project demo-biblioteca`; «All emulators ready» |
| JAR del emulador Firestore | cloud-firestore-emulator-v1.22.0 | se descargó solo; `storage.googleapis.com` sí está permitido |
| @firebase/rules-unit-testing | 5.0.2 | prueba real de negación por defecto: **ok** |
| firebase (SDK para pruebas) | 12.19.0 | par exigido por rules-unit-testing 5.x |
| firebase-admin | 14.5.0 | escribió y leyó `config/app` contra el emulador |
| @playwright/test | 1.56.1 | lanza el Chromium 141.0.7390.37 preinstalado sin descargar nada |

Por qué esas dos versiones y no las más nuevas: `@firebase/rules-unit-testing@6.0.0` declara
`engines: node >= 24.12.0` y exige `firebase ^13`. Este contenedor tiene Node 22 y no trae
Node 24. Con 6.0.0 la prueba igual pasó, pero quedaría corriendo fuera del motor declarado;
con **5.0.2 + firebase 12.19.0 el conjunto instala sin una sola advertencia de motor y pasa**.
Lo mismo con Playwright: 1.64.0 pide el Chromium 1248 y aquí está el 1194, que corresponde a
**1.56.1**, y la descarga de navegadores está bloqueada. El SDK que cargue la app desde
gstatic lo fijaría en **12.19.0**, el mismo mayor que usan las pruebas.

## 3. Límites del entorno, comprobados (no supuestos)

### 3.1 `www.gstatic.com` está bloqueado — afecta a casi todo el E2E

La política de red de este contenedor deniega el CONNECT a `www.gstatic.com`. Lo comprobé
dos veces: con `curl` (403 del proxy) y cargando una página real en el Chromium de Playwright,
que falló con `net::ERR_TUNNEL_CONNECTION_FAILED` al importar
`https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js`.

Base §3 fija que la app carga el SDK de Firebase desde ese host. Entonces, **aquí la app no
arranca en un navegador**, y con ella no puedo ejecutar los casos que necesitan la app
corriendo: A-02, A-03, A-08, A-13 (parte), A-14 a A-20, A-22 a A-27, A-30, A-33, A-35, A-36 y
A-37. Las pruebas de **reglas** y de **unidad** no dependen de ese host y corren sin problema;
también `scripts/inicializar.mjs` con Admin SDK.

Tres salidas, en mi orden de preferencia:

1. **Permitir `www.gstatic.com`** en Network access del entorno (menú del entorno en la barra
   de título → Edit; «Allowed domains», dejando marcada la casilla de gestores de paquetes).
   Pasos: https://code.claude.com/docs/en/cloud-environments#network-access. Con eso ejecuto
   los 39 casos automatizables aquí y te entrego salida real.
2. **E2E solo en integración continua.** Los runners de GitHub sí alcanzan gstatic. Te
   entregaría el E2E escrito pero ejecutado por el flujo de Actions, no por mí; el informe lo
   diría con esas palabras. No voy a declarar PASS de algo que no corrí.
3. **Ejecutarlo en tu computador**, que era el plan original con Cursor. Aquí quedaría el
   código y los commits.

No pienso sustituir el SDK por una copia en el repositorio ni por un doble de prueba: base §3
lo descarta expresamente y `AGENTS.md` prohíbe usar simulaciones como evidencia.

### 3.2 No hay IPv6

El emulador avisó `EAFNOSUPPORT` al probar `::1`. El contrato §1 exige que `[::1]` seleccione
el emulador. Esa rama la cubro con prueba de unidad de la función de selección de ambiente;
no se puede levantar un servidor en `[::1]` aquí para un E2E.

### 3.3 `cdn.playwright.dev` está bloqueado

Por eso la versión de Playwright queda amarrada al Chromium preinstalado (1.56.1). En tu
computador cualquier versión fijada sirve, porque puedes descargar el navegador.

## 4. Contradicciones y dudas que necesitan tu decisión

### D-1. La rama no es `etapa-1`

Las especificaciones piden rama `etapa-1`, una por etapa. Esta sesión viene configurada con la
rama **`claude/new-session-a430xs`** y con la instrucción de no empujar a otra sin permiso
explícito. No puedo cumplir las dos cosas. Trabajaría en la rama asignada salvo que me
autorices `etapa-1`.

### D-2. El repositorio está vacío

`perrotbr-tech/bibliotecafdf` no tiene ni un commit. El paquete de especificaciones solo
existe en el ZIP que subiste: no están en el repositorio `AGENTS.md`, `specs/`,
`referencia/prototipo.html`, `tests/fixtures/carga-ficticia.json`, `.gitignore` ni los informes.
`PASOS-DEL-DUENO.md` pone «copiar dentro el contenido de este paquete» como paso tuyo.

Comprobé el paquete contra la regla de A-29 y está limpio: todos los teléfonos que aparecen
son de la forma `5690000…` (fixture y ejemplos de las etapas 2 y 4); **ningún número de 11
dígitos que empiece con `569` y no sea ficticio**. Se puede versionar sin romper el escáner.

Pregunta: ¿comprometo yo el paquete como primer commit?

Un detalle del `README.md`: el del paquete describe el paquete de especificaciones, y la lista
de entrega de la Etapa 1 pide un `README.md` con instrucciones para correr la app, las pruebas
y los scripts. Propongo mover el actual a `specs/LEEME-PAQUETE.md` y escribir el README de la
app en la raíz.

### D-3. A-30 y el contrato §1 no dicen lo mismo sobre `?ensayo=1` en localhost

A-30 dice «Abrir en `localhost`, con `?ensayo=1` y sin parámetros → Usa el emulador, el
proyecto de ensayo y el proyecto real». El contrato §1 dice que el emulador se selecciona
**únicamente** en `localhost`, `127.0.0.1` o `[::1]`. En localhost **con** `?ensayo=1` las dos
frases chocan.

Mi propuesta: el host de loopback manda y siempre da emulador; `?ensayo=1` en loopback se
ignora y se deja dicho en la franja; fuera de loopback, `?ensayo=1` da ensayo y sin parámetros
da real; la publicación de ensayo fuerza ensayo pase lo que pase. Confírmalo o corrígelo.

Aparte: con las configuraciones de ensayo y real en `null`, los otros dos casos de A-30 solo
se pueden verificar hasta «Falta configurar este ambiente». La verificación completa queda
pendiente de que entregues los bloques web. Lo mismo con la mitad de A-24 («contra el proyecto
de ensayo, el parámetro se ignora»).

### D-4. ¿El documento de un voluntario lleva `creacionId`?

El contrato §3 dice que todo documento de negocio creado por la app lleva `creacionId`
inmutable, y cada mutación `ultimaOperacionId` y `modificadoEn`. La tabla de campos de
`voluntarios` en la Etapa 1 no los menciona.

Hacen falta, y no por simetría: el identificador del documento es el correo, así que cuando
una alta queda incierta, la existencia del documento no prueba nada —puede haberlo creado otro
administrador—. `creacionId` es justo lo que distingue «lo guardé yo» de «ya estaba», que es lo
que piden A-19, A-20 y A-36.

Propongo: las altas y los cambios de `voluntarios` hechos por un administrador llevan esos tres
campos, y van en la lista de campos permitidos de las reglas. La sincronización de hora **no**
los lleva, porque el contrato §2 dice que esa excepción permite exactamente `ultimaConexion` y
`sincronizacionId`. A-40 queda cubierto en ambos sentidos.

### D-5. ¿Qué bloquea el mantenimiento en una etapa sin colecciones de negocio?

A-38 exige que un bloqueo de mantenimiento vigente haga que las reglas rechacen las mutaciones
de negocio y conserven lectura y sincronización. En la Etapa 1 no existen libros, lectores ni
préstamos: las únicas escrituras del cliente son el alta de voluntarios (administrador) y la
muestra de hora. Si «mutación de negocio» no incluye a `voluntarios`, A-38 no tiene nada que
probar en esta etapa y se vuelve una prueba vacía.

Propongo que sí la incluya: con mantenimiento vigente, las escrituras de `voluntarios` y de
`config` quedan denegadas, y siguen permitidas la lectura y la sincronización de hora. Encaja
con «Sin documento de control no se escribe» del §6, y hace A-38 verificable ahora.

### D-6. `fechas.js` en la Etapa 1, hasta dónde

El contrato §9 prohíbe adelantar el calendario operativo, pero dos cosas de esta etapa
necesitan funciones de fecha: la barra superior muestra la fecha de hoy en hora de Chile, y
`scripts/inicializar.mjs` debe escribir `inicioJuego` con «la temporada de la fecha en que se
ejecuta el script», que es un bimestre.

Propongo crear `docs/js/fechas.js` con **solo** `diaEnChile`, el texto largo de la fecha y
`temporadaDe`, las tres puras y con pruebas de unidad, y dejar sábados, vencimientos y avance
de temporada para la Etapa 3. Si prefieres que `inicioJuego` lo pases como parámetro al script
y no calcularlo, lo hago así y `temporadaDe` también se va a la Etapa 3.

### D-7. Un módulo que no está en la lista de base §4

La selección de ambiente tiene que ser pura para poder probarla en Node (A-30, A-35), y no
puede vivir en `firebase.js`, que importa desde gstatic. Propongo `docs/js/ambiente.js`:
recibe host, parámetros y `sessionStorage`, devuelve el ambiente. Es un módulo más que la
estructura declarada, no una función nueva de producto. Si prefieres no agregar archivos a esa
lista, lo meto dentro de `config-publica.js`.

## 5. Decisiones que tomaría yo (irían en «Decisiones tomadas»)

- **Umbral del aviso de desfase (A-22).** La especificación pide el aviso pero no dice desde
  cuánto. Tomaría 60 segundos de diferencia entre el reloj del teléfono y el del servidor, una
  vez por sesión.
- **Franja de ambiente.** «EMULADOR» o «ENSAYO» con el proyecto configurado al lado, como pide
  el contrato §1; en producción no hay franja.
- **Íconos.** Dos PNG propios (192 y 512) más uno enmascarable, dibujados aquí, sin
  dependencias ni fuentes externas.
- **Reintentos de la muestra de hora.** «Número acotado de intentos» del contrato §2: tres,
  con espera creciente.

## 6. Plan en pasos

1. **Base del repositorio.** Paquete de especificaciones (según D-2), `.gitignore`,
   `package.json` y `package-lock.json` con las versiones exactas de la tabla, `firebase.json`
   con los emuladores Auth y Firestore bajo `demo-biblioteca`, `firestore.indexes.json` vacío
   (esta etapa no lleva índices), configuración de Playwright.
2. **Guardián del repositorio primero.** `scripts/revisar-repositorio.mjs` y su prueba A-29,
   antes de que entre cualquier otro archivo. Escanea los archivos versionados que entrega
   `git ls-files` y aplica la regla tal como está escrita: once dígitos exactos, sin dígitos
   pegados a los lados, que empiecen con `569` y no con `5690000`. Si un archivo generado como
   el lockfile diera un falso positivo, te lo informo; no lo excluyo a escondidas.
3. **Pruebas que fallan, por capas.** Reglas (A-01 a A-12, A-21, A-38, A-40), unidad
   (A-13, A-22 a A-24, A-29, A-30, A-32 a A-36, A-39) y E2E (el resto). Cada prueba lleva su ID
   en el nombre.
4. **`firestore.rules`** con negación por defecto, `voluntarios`, `config/app`,
   `config/contadores`, `config/control`, la excepción de los dos campos de la hora, las listas
   de campos permitidos y la comprobación del bloqueo. Cuento los accesos a otros documentos por
   operación y por transacción, contra el presupuesto de 10 y 20 del contrato §7.
5. **`scripts/inicializar.mjs`** y A-28: crea los cuatro documentos, idempotente, informa
   cuando ya existen.
6. **Módulos de la app.** `ambiente.js`, `config-publica.js` (demo real; ensayo y producción en
   `null`), `firebase.js`, `reloj.js` con el contrato §2 completo, `datos.js` con la forma de
   guardar y los contadores de telemetría separados del §8, `acceso.js`, `texto.js`,
   `fechas.js` recortado.
7. **Pantallas.** Entrada, Sin acceso, cáscara con las cinco destinaciones y el botón Atrás,
   Más, Voluntarios. Prestar, Préstamos y Catálogo con «Disponible pronto». Los cinco estados
   de cada pantalla: cargando, vacío, sin conexión, sin permiso y error.
8. **Carga y mediciones.** Lista de 200 voluntarios con el procesador a un cuarto, y lecturas
   de una apertura de sesión medidas con el contador de `datos.js`, contra el límite de menos de
   diez. Las dos necesitan la app en el navegador: dependen de §3.1.
9. **Integración continua.** `.github/workflows/pruebas.yml` con unidad, reglas, E2E y el
   escáner.
10. **Entrega.** `README.md`, `informes/etapa-1.md` con los ocho apartados, más SHA, versiones
    instaladas, pruebas realmente ejecutadas, conteo de accesos de reglas y pendientes manuales.

## 7. Archivos que voy a crear

| Grupo | Archivos |
|---|---|
| Configuración | `package.json`, `package-lock.json`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `.gitignore`, `playwright.config.mjs` |
| App | `docs/index.html`, `docs/manifest.json`, `docs/iconos/` (192, 512, enmascarable), `docs/css/app.css` |
| Módulos | `docs/js/main.js`, `ambiente.js`, `config-publica.js`, `firebase.js`, `acceso.js`, `datos.js`, `reloj.js`, `texto.js`, `fechas.js` |
| Vistas | `docs/js/vistas/`: `entrada.js`, `sin-acceso.js`, `inicio.js`, `prestar.js`, `prestamos.js`, `catalogo.js`, `mas.js`, `voluntarios.js` |
| Componentes | `docs/js/ui/`: `barra-superior.js`, `barra-inferior.js`, `hoja.js`, `boton-guardar.js`, `avisos.js`, `estados.js` |
| Pruebas | `tests/unidad/`, `tests/reglas/`, `tests/e2e/`, `tests/carga/`, `tests/ayuda/` (siembra con Admin SDK) |
| Administración | `scripts/inicializar.mjs`, `scripts/revisar-repositorio.mjs` |
| Entrega | `.github/workflows/pruebas.yml`, `README.md`, `informes/etapa-1.md` |
| Del paquete (D-2) | `AGENTS.md`, `specs/`, `referencia/prototipo.html`, `tests/fixtures/carga-ficticia.json`, `PASOS-DEL-DUENO.md`, `PROMPT-MAESTRO-CURSOR.md`, `FUENTES-VERIFICADAS.md`, `.cursor/rules/biblioteca.mdc` |

No creo nada de libros, lectores, préstamos, recordatorios, juego, estadísticas ni QR.
No agrego `cargar-datos.mjs`, `respaldar.mjs`, `restaurar.mjs` ni `generar-calendario.mjs`:
son de etapas posteriores.

## 8. Dónde queda cada caso de prueba

| Capa | Casos |
|---|---|
| Reglas, contra el emulador | A-01, A-02, A-03, A-04, A-05, A-06, A-07, A-08, A-09, A-10, A-11, A-12, A-14, A-21, A-34, A-38, A-40 |
| Unidad, `node --test` | A-13, A-19, A-20, A-22, A-23, A-24, A-29, A-30, A-32, A-33, A-34, A-35, A-36, A-39 |
| Extremo a extremo, Playwright | A-02, A-03, A-08, A-13, A-14, A-15, A-16, A-17, A-18, A-19, A-20, A-22, A-23, A-24, A-25, A-26, A-27, A-30, A-33, A-35, A-36, A-37 |
| Script contra el emulador | A-28 |
| Manual, tú | A-31 |

Varios casos aparecen dos veces a propósito: la regla prueba el permiso y el E2E prueba lo que
ve el voluntario. Los 39 automatizables quedan cubiertos; A-31 es tuyo.

## 9. Lo que no voy a hacer

No uso un proyecto real de Firebase ni pido llaves. No despliego reglas ni índices. No fusiono
ni empujo a `main`. No creo la solicitud de cambios salvo que me la pidas. No desactivo ni
salto una prueba para que la etapa pase. No declaro aprobado nada que no haya ejecutado.

## 10. Qué necesito que apruebes

1. La rama (D-1).
2. Si comprometo el paquete de especificaciones como primer commit (D-2).
3. La prioridad de ambiente en loopback (D-3).
4. `creacionId` en los documentos de voluntarios (D-4).
5. Si el mantenimiento bloquea las escrituras de `voluntarios` y `config` (D-5).
6. El recorte de `fechas.js` (D-6) y el módulo `ambiente.js` (D-7).
7. Cómo resolvemos el E2E: permitir `www.gstatic.com`, dejarlo a la integración continua, o
   ejecutarlo en tu computador (§3.1).
