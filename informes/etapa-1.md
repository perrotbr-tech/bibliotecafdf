# Informe de la Etapa 1 — Base y acceso

Revisión 1.1 · 12-10-2026 (America/Santiago) · rama `etapa-1`

**SHA entregado para la contraprueba:** `f191a6cbd6ad3b80c4a51c7b1f2b8787d7401e74`
(`f191a6c`), el último commit de código de `etapa-1`. Ese es el commit exacto
que debe revisar Codex y el que debe publicarse en ensayo. Los datos completos
de la entrega están en la sección 10.

**Estado: las 39 pruebas automatizables de la etapa están escritas y ejecutadas,
y pasan.** A-31 es manual y queda para el dueño.

## 1. Qué se construyó

- **Andamiaje.** `package.json` y `package-lock.json` con versiones exactas,
  `firebase.json` con los emuladores de Auth y Firestore bajo `demo-biblioteca`,
  `firestore.rules`, `firestore.indexes.json` vacío, `.gitignore` que excluye
  `datos/` y las llaves, configuración de Playwright.
- **Integración continua.** `.github/workflows/pruebas.yml` corre en cada
  solicitud de cambios —y también al empujar una rama `etapa-*`— el escáner,
  unidad, reglas, scripts, extremo a extremo y carga.
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
  propio documento.
- **Forma de guardar** completa, implementada una sola vez en `docs/js/datos.js`:
  transacción con `maxAttempts` 5, botón bloqueado, éxito solo con respuesta,
  intención estable, aviso de demora a los 5 segundos y resolución de resultado
  incierto por identidad de la operación, incluida la recuperación tras recargar.
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

Todas pasan. «reglas» corre contra el emulador de Firestore; «unidad» con
`node --test`; «e2e» con Playwright contra el emulador y entrando con
`signInWithCredential`.

| ID | Dónde está la prueba | Estado |
|---|---|---|
| A-01 | reglas | Pasa |
| A-02 | reglas + e2e | Pasa |
| A-03 | reglas + e2e | Pasa |
| A-04 | reglas + unidad + e2e | Pasa |
| A-05 | reglas | Pasa |
| A-06 | reglas | Pasa |
| A-07 | reglas | Pasa |
| A-08 | reglas + e2e | Pasa |
| A-09 | reglas (2 pruebas) | Pasa |
| A-10 | reglas (2) + e2e | Pasa |
| A-11 | reglas | Pasa |
| A-12 | reglas (2 pruebas) | Pasa |
| A-13 | unidad + e2e | Pasa |
| A-14 | reglas + e2e | Pasa |
| A-15 | unidad (2) + e2e | Pasa |
| A-16 | e2e | Pasa |
| A-17 | unidad + e2e | Pasa |
| A-18 | unidad (3) + e2e | Pasa |
| A-19 | unidad + e2e | Pasa |
| A-20 | unidad + e2e | Pasa |
| A-21 | reglas | Pasa |
| A-22 | unidad + e2e | Pasa |
| A-23 | unidad + e2e | Pasa |
| A-24 | unidad (2) + e2e (2) | Pasa |
| A-25 | e2e | Pasa |
| A-26 | e2e (2 pruebas) | Pasa |
| A-27 | e2e | Pasa |
| A-28 | scripts (4 pruebas) | Pasa |
| A-29 | unidad (6 pruebas) | Pasa |
| A-30 | unidad (5) + e2e (2) | Pasa |
| A-31 | **manual, para el dueño** | Pendiente |
| A-32 | unidad | Pasa |
| A-33 | unidad (4) + e2e | Pasa |
| A-34 | unidad (2) + reglas | Pasa |
| A-35 | unidad (2) | Pasa |
| A-36 | unidad (2) + e2e | Pasa |
| A-37 | e2e (2 pruebas) | Pasa |
| A-38 | reglas (2 pruebas) | Pasa |
| A-39 | unidad + e2e | Pasa |
| A-40 | reglas (2 pruebas) | Pasa |

**Dónde se comprueba cada mitad de A-18.** El plazo de cinco segundos antes de
mostrar «Confirmando… no cierres la app» se prueba en `tests/unidad/datos.test.mjs`
con reloj simulado: a los 4,999 s no avisa, a los 5,001 s sí, y si la respuesta
llega antes el aviso queda cancelado. No se puede comprobar en el navegador,
porque al bloquear el tráfico el SDK se declara sin conexión y hace fallar la
transacción antes de ese plazo. La prueba de extremo a extremo cubre lo que solo
se ve en pantalla: no aparece confirmación, sale el error y el formulario
conserva lo escrito. Está dicho así en el propio archivo de prueba.

### 2.2 Salida de la ejecución

```
### npm run revisar
revisar-repositorio: sin hallazgos

### npm run prueba:unidad
# tests 63
# pass 63
# fail 0

### npm run prueba:reglas        (firebase emulators:exec, demo-biblioteca)
# tests 37
# pass 37
# fail 0

### npm run prueba:scripts       (firebase emulators:exec, demo-biblioteca)
# tests 7
# pass 7
# fail 0

### npm run prueba:e2e           (Playwright, Chromium, contra el emulador)
32 passed (1.3m)

### npm run prueba:carga
2 passed (6.2s)
```

**141 pruebas, 141 en verde, 0 en rojo.** Ninguna se saltó ni se desactivó. Las
seis suites corren juntas en la integración continua sobre el commit entregado.

### 2.2.1 Escenarios adversos contra las reglas

Además de los casos del documento, `tests/reglas/adversario.test.mjs` tiene 11
intentos de colarse, marcados «EXTRA» para no confundirlos con A-01 a A-40.
Todos quedan denegados:

| Intento | Resultado |
|---|---|
| Una cuenta de fuera se inscribe sola creando su propio documento | Denegado |
| …y encima con rol `admin` | Denegado |
| Un voluntario desactivado se reactiva a sí mismo | Denegado |
| …o entra por la puerta de la muestra de hora | Denegado |
| Un administrador desactivado sigue mandando | Denegado: deja de ser administrador |
| Un alta firmada a nombre de otra persona | Denegado |
| Un voluntario de `principal` lee o escribe en `bibliotecas/otra` | Denegado |
| Un cierre ya vencido sigue bloqueando | No bloquea; uno vigente sí |
| El documento de control llega con basura en `bloqueo` | Denegado: falla hacia el lado seguro |
| Reenviar el documento con los metadatos viejos | Denegado |
| Con mantenimiento vigente se toca `config/app` | Denegado; la lectura se conserva |

Dos comportamientos quedan documentados como deliberados, no como hallazgos: el
correo del token se compara en minúsculas, así que una cuenta que llega como
`Ana@Example.com` encuentra su documento; y un administrador **sí** puede bajar
de rango a otro administrador —la especificación solo prohíbe hacérselo a uno
mismo, con lo que siempre queda al menos un administrador activo.

**Esto no es la contraprueba.** Son escenarios que se me ocurrieron
construyendo, y una revisión del propio implementador no es independiente
(AGENTS.md). Codex tiene que buscar los suyos.

### 2.3 Qué encontraron las pruebas

Tres fallos reales de la app, corregidos con su prueba. Se dejan anotados porque
dos de ellos se van a repetir en las etapas siguientes:

1. **Un corte de red echaba a la gente de su cuenta.** La escucha del permiso
   trataba cualquier error como pérdida de acceso, así que quedarse sin señal
   mandaba a «Sin acceso» a alguien que sí tiene acceso. Ahora solo
   `permission-denied` lo es; lo demás se avisa como problema de conexión y la
   sesión se conserva.
2. **Un cambio de red borraba el formulario a medio llenar.** La app volvía a
   dibujar la pantalla entera al perder o recuperar la conexión, y también en
   cada aviso de la escucha del permiso, que llega hasta por cambios de
   metadatos. Eso contradice de frente la promesa de la forma de guardar de no
   perder lo que la persona estaba haciendo. Ahora solo se redibuja cuando el
   permiso cambia de verdad, y los cambios de red solo ajustan botones.
3. **Un botón volvía a habilitarse aunque la red se hubiera caído** justo
   mientras se guardaba: quedaba ofreciendo guardar cuando no se podía.

Y dos trampas de las pruebas mismas, por si reaparecen: el emulador de
Authentication **no se limpia solo** entre pruebas (una cuenta creada sin
verificar queda así y contamina las siguientes), y abortar las peticiones de
Firestore **no** hace fallar una transacción: el SDK reintenta y se queda
colgada.

### 2.4 Comprobaciones estáticas

Separadas a propósito, porque no son pruebas de los casos: los 23 módulos de
`docs/js/` y los scripts pasan `node --check` y se importan en Node sin error.

## 3. Prueba de carga

Medida en la integración continua, contra el emulador, en el commit entregado:

| Medición | Límite del documento | Medido |
|---|---|---|
| Lista de 202 voluntarios, procesador a un cuarto | menos de 1 s | **640 ms** |
| Lecturas de una apertura de sesión | menos de 10 | **4 documentos del servidor** |

Contadores de `datos.js` en una apertura de sesión:

```
documentosDelServidor: 4      lecturasDeTransaccion: 1
eventosDeCache: 0             reintentosDeTransaccion: 0
cambiosDeMetadatos: 0         consultasVacias: 0
documentosModificadosPorEscucha: 0   reconexiones: 0
lecturasDeReglasEstimadas: 1
```

Y al abrir la lista de 202 voluntarios: `documentosDelServidor: 4`,
`documentosModificadosPorEscucha: 201`, `eventosDeCache: 1`, el resto en cero.
La escucha suma los documentos que cambiaron, no toda la lista en cada evento.

**Telemetría no es facturación** (contrato §8). Estos contadores son del
cliente: no incluyen las lecturas que consume la evaluación de reglas aunque la
operación se deniegue, ni los reintentos internos del SDK. El contraste con el
panel del proyecto queda para el ensayo. Y son medidas en emulador: no son una
garantía de rendimiento en producción.

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
   ahí `?ensayo=1` se ignora y se dice en la franja. Fuera de loopback,
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
   `temporadaDe` y `temporadaDeInstante`. Sábados, vencimientos y avance de
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
    necesita el emulador pero no prueba reglas).
11. **Recuperación tras recargar.** El contrato §3 pide que una recarga relea el
    servidor antes de ofrecer repetir. Al entrar, si quedó una intención
    pendiente, la app la relee y dice si quedó guardada, si se comprobó que no, o
    si no se pudo comprobar. Nunca repite la operación sola.
12. **Versiones fijadas.** `@firebase/rules-unit-testing@5.0.2` con
    `firebase@12.19.0`, en vez de la 6.0.0, que declara `engines: node >=24.12.0`
    y exige `firebase ^13`: con la 5.0.2 el conjunto instala sin una sola
    advertencia de motor en Node 22 y pasa. `@playwright/test@1.56.1` porque es
    la que corresponde al Chromium disponible.
13. **Dos scripts más en `scripts/`:** `servir.mjs` (servidor estático sin
    dependencias, para desarrollo y para Playwright) y `arrancar-local.mjs` (el
    «un solo comando» de la lista de entrega).
14. **La integración continua corre también al empujar `etapa-*`.** Sigue
    corriendo en cada solicitud de cambios, como pide la etapa, pero el
    repositorio todavía no tiene rama base y así se pueden ver las pruebas sin
    abrir el PR. También cancela la corrida anterior de la misma rama.
15. **El plazo de cinco segundos de A-18 se prueba en unidad, no en el
    navegador.** Explicado en §2.1.

## 6. Pruebas manuales pendientes para el dueño

1. **A-31.** Entrar con Google en Chrome y en Samsung Internet de un teléfono
   Android real, y desde la app instalada. Anotar el resultado de los tres casos.
2. **La prueba de humo completa** del documento de la etapa, en el proyecto de
   ensayo: desplegar reglas e índices, correr `inicializar.mjs`, entrar desde un
   teléfono con `?ensayo=1` y ver la franja «ENSAYO», entrar con otra cuenta y
   ver «Tu cuenta no tiene acceso», agregarla como voluntaria y volver a entrar,
   y comprobar en modo avión que los botones se deshabilitan.
3. **La mitad de A-24 y de A-30 que necesita configuración real:** que `?ahora=`
   se ignore contra el proyecto de ensayo, y que ensayo y producción elijan el
   proyecto correcto. Hoy no se puede comprobar porque sus bloques están en
   `null`; lo que sí está probado es que una configuración ausente bloquea su
   ambiente y no abre otro por error.

## 7. Qué NO está preparado para producción, y por qué

- **Los ambientes de ensayo y de producción no existen.** `config-publica.js` los
  tiene en `null`. La app se comporta bien con eso (lo dice y no conecta), pero
  nada se ha probado contra un proyecto real.
- **El emulador no es producción.** No exige índices compuestos, no aplica todos
  los límites y no reproduce todo el comportamiento de las transacciones. Esta
  etapa no declara índices, pero esa comprobación es del ensayo.
- **La entrada con Google por ventana emergente puede ser bloqueada** por el
  teléfono o por la app instalada. La app muestra el mensaje que pide el
  documento, pero eso solo se valida a mano en teléfonos reales. Las pruebas
  automatizadas entran con `signInWithCredential`, que es otro camino.
- **Las reglas no reproducen la normalización del cliente.** Comprueban forma,
  permisos y enlaces. Que el correo guardado sea el normalizado lo garantiza el
  cliente y lo cubren las pruebas de unidad.
- **La hoja emergente está construida pero ninguna pantalla la abre.** Base §9
  exige que retenga el foco, lo devuelva al cerrar y que el botón Atrás la
  cierre. El componente está escrito y conectado al historial, pero la Etapa 1
  no tiene ninguna pantalla que use una hoja: el formulario de Voluntarios va en
  línea. Esa mitad de la regla del botón Atrás queda **sin ejercitar** hasta que
  una etapa siguiente abra la primera hoja.
- **Después de cinco minutos sin actividad la barra dice «Hora pendiente».** Es
  lo que manda el contrato §2: la muestra caduca a los cinco minutos y se
  resincroniza «antes de operar» o al volver a primer plano. Como esta etapa no
  tiene operaciones temporales, no hay nada que dispare la resincronización
  salvo volver a la app o recuperar la conexión.
- **Los contadores son telemetría, no facturación.** El costo cero es un objetivo
  dentro de cuotas, no una promesa.
- **Las mediciones de carga son de emulador y de un runner de integración
  continua**, no de un teléfono. El límite del documento se cumple con holgura
  (640 ms contra 1 s), pero el ensayo con teléfonos reales sigue siendo
  obligatorio.

## 8. Qué debe desplegar o configurar el dueño, paso a paso

1. **Pasar el SHA a Codex** para la contraprueba, con este informe.
2. **Crear los dos proyectos de Firebase** (real y ensayo), gratuitos y
   separados, con Firestore en modo de producción y región
   `southamerica-west1`, activar el inicio de sesión con Google y agregar el
   dominio de GitHub Pages a los dominios autorizados.
3. **Entregar los dos bloques web** para `docs/js/config-publica.js`. Son
   públicos por diseño; no son secretos y no reemplazan credenciales.
4. **Preparar la publicación de ensayo** en el repositorio aparte, con
   `AMBIENTE_FIJO = 'ensayo'` y `produccion` en `null`, y anotar en su README el
   SHA candidato, la URL y el resultado manual.
5. **Desplegar reglas e índices en ensayo:**
   `firebase deploy --only firestore:rules,firestore:indexes --project <ensayo>`.
6. **Ejecutar `inicializar.mjs` en ensayo** con tu correo, usando tus
   credenciales locales:
   `node scripts/inicializar.mjs --correo tu@correo.cl --nombre "Tu Nombre" --proyecto <ensayo> --confirmo-proyecto-real`.
7. **Hacer la prueba de humo con teléfonos reales** y las pruebas manuales de la
   sección 6.
8. **Recién con todo eso en verde**, fusionar y repetir los pasos 5 y 6 en el
   proyecto real, activar GitHub Pages desde `docs/` de `main`, y autorizar la
   Etapa 2.

Cuatro cosas del repositorio que conviene saber:

- **`main` existe pero está vacía.** El repositorio se creó sin ningún commit, así
  que no había rama base contra la cual abrir la solicitud de cambios. Se creó
  una rama huérfana con un commit vacío, con tu autorización expresa. El código
  de la etapa entra a `main` solo cuando tú la fusiones. GitHub no deja comparar
  dos ramas sin historia común, así que `etapa-1` trae esa base con un commit de
  mezcla que no cambia ningún archivo; desde ahí la fusión es limpia. La
  solicitud de cambios muestra el árbol completo como diferencia, que para una
  primera etapa es justo lo que el revisor necesita ver.
- **La solicitud de cambios es
  [perrotbr-tech/bibliotecafdf#1](https://github.com/perrotbr-tech/bibliotecafdf/pull/1)**,
  con este informe en la descripción.
- **La rama por defecto del repositorio sigue siendo `etapa-1`.** Intenté
  cambiarla a `main` y no pude: el proxy de esta sesión no permite escribir
  ajustes del repositorio. Hay que hacerlo a mano en Settings → General →
  Default branch.
- **Para correr el extremo a extremo desde una sesión en la nube** hay que
  permitir `www.gstatic.com` en la configuración de red de ese entorno. No
  bloquea la contraprueba: la integración continua de GitHub ya corre las seis
  suites.

## 9. Lista de entrega del documento, comprobada

| Punto de la lista | Estado |
|---|---|
| La app corre en local con un solo comando | **Comprobado.** `npm start` levanta los emuladores, siembra la base demo e inicializa los cuatro documentos, y sirve `docs/` en <http://127.0.0.1:5173>. |
| Otro comando corre todas las pruebas | **Comprobado.** `npm test` encadena escáner, unidad, reglas, scripts, extremo a extremo y carga. |
| Integración continua en verde | **Sí**, las seis suites sobre el commit entregado. |
| `firestore.rules` con negación por defecto | **Sí**, y probado: A-12 recorre nueve rutas que no figuran en las reglas. |
| `README.md` con instrucciones para la app, las pruebas y los scripts | **Sí.** |
| `informes/etapa-1.md` con salida de pruebas, lecturas medidas, pruebas manuales pendientes y lo que no está listo | **Este documento.** |

## 10. Datos de la entrega

| Dato | Valor |
|---|---|
| Rama | `etapa-1` |
| SHA entregado | `f191a6cbd6ad3b80c4a51c7b1f2b8787d7401e74` (`f191a6c`) |
| Corrida de integración continua en verde | `f191a6c`, las seis suites |
| Node | 22.22.0 (local) y 22 en la integración continua |
| npm | 10.9.4 |
| Java | OpenJDK 21.0.12.1 local; Temurin 21 en la integración continua |
| firebase-tools | 15.33.0 |
| Emulador de Firestore | cloud-firestore-emulator v1.22.0 |
| @firebase/rules-unit-testing | 5.0.2 |
| firebase (SDK en pruebas) | 12.19.0 |
| SDK que carga la app desde gstatic | 12.19.0 |
| firebase-admin | 14.5.0 |
| @playwright/test | 1.56.1 |
| Chromium | 141.0.7390.37 |
| Proyecto usado | `demo-biblioteca`, solo emulador |
| Pruebas ejecutadas | **141**: 63 unidad, 37 reglas (26 de los casos + 11 adversas), 7 scripts, 32 extremo a extremo, 2 carga |
| Pruebas en rojo | ninguna |
| Casos del documento cubiertos | 39 de 39 automatizables; A-31 es manual |
| Datos personales versionados | ninguno; el escáner pasa sin hallazgos |
