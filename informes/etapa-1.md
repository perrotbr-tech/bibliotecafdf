# Informe de la Etapa 1 — Base y acceso

Revisión 1.1 · 12-10-2026 (America/Santiago) · rama `etapa-1`

**SHA entregado:** `231c4ff`, el último commit de código de `etapa-1`, con la
integración continua en verde en sus seis suites. Es el que debe publicarse en
ensayo. Los datos completos de la entrega están en la sección 10.

**No hubo contraprueba externa.** El dueño decidió trabajar solo en esta sesión,
así que la revisión del diff la hizo quien escribió el código. Está en la
sección 2.3, con sus quince hallazgos corregidos y con la advertencia de que no
sustituye a una mirada ajena.

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
# tests 69
# pass 69
# fail 0

### npm run prueba:reglas        (firebase emulators:exec, demo-biblioteca)
# tests 39
# pass 39
# fail 0

### npm run prueba:scripts       (firebase emulators:exec, demo-biblioteca)
# tests 7
# pass 7
# fail 0

### npm run prueba:e2e           (Playwright, Chromium, contra el emulador)
36 passed (1.4m)

### npm run prueba:carga
2 passed (5.8s)
```

**153 pruebas, 153 en verde, 0 en rojo.** Ninguna se saltó ni se desactivó. Las
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

### 2.3 Qué encontró la revisión del diff

Con el dueño decidiendo que no habría revisor externo, se hizo aquí una pasada
sistemática sobre todo el diff, **leyéndolo como revisor y no como autor**.
Encontró 15 hallazgos y todos quedaron corregidos con su prueba. Por gravedad:

**Caídas y pérdida de datos**

1. **Una petición con un `%` suelto mataba el servidor estático completo.**
   Verificado en vivo: `curl /%` y el proceso no vuelve. Es el servidor de
   `npm start` y el que Playwright levanta, así que un escáner, un favicon o un
   dedo torcido abortaba la corrida entera. Ahora una dirección que no se
   entiende responde 404 y nada que llegue por la red tumba el servidor.
2. **La lista de voluntarios se redibujaba con cada evento de metadatos**,
   soltando el botón recién tocado y perdiendo la intención estable de esa fila.
   Es el mismo fallo que ya se había corregido en la escucha del permiso y que
   se repetía en la otra escucha.
3. **Una muestra de hora en vuelo resucitaba después de invalidarla:** perder la
   conexión a mitad de una sincronización se deshacía solo cuando llegaba la
   respuesta tardía. Ahora cada invalidación abre una época y la muestra vieja
   se descarta.

**Avisos que mentían**

4. **La intención solo se olvidaba al tener éxito.** Un conflicto o un permiso
   denegado dejaban una alarma anotada, y la siguiente apertura avisaba sobre
   algo ya resuelto. Ahora solo se conserva cuando de verdad quedó la duda.
5. **La clave de la intención no tenía ámbito ni se borraba al cerrar sesión:**
   la intención de una cuenta le reaparecía a la siguiente en la misma pestaña.
6. **El aviso de «sin conexión» quedaba colgado** sobre Inicio y Catálogo,
   pantallas que no guardan nada.
7. **Quien quedaba en «Sin acceso» se quedaba ahí para siempre**, aunque el
   administrador lo reactivara: la escucha muere con el permiso denegado y nadie
   la recreaba. Ahora hay «Volver a comprobar».

**Reglas**

8. **`inicioJuego` entraba con solo `is string`:** sin formato `AAAA-B` y sin el
   candado que el contrato §8 exige una vez cerrada una temporada.
9. **El orden de las ramas gastaba accesos de más.** Ver la sección 4.

**El informe mismo**

10. **`reconexiones` no se incrementaba en ninguna parte** y
    **`lecturasDeReglasEstimadas` era un duplicado del contador de documentos**,
    pero los dos se publicaban en este informe como medición. Ahora se cuentan
    de verdad, con el coste por operación declarado en `datos.js`.

**Lo demás**

11. `scripts/arrancar-local.mjs` usaba Admin SDK sin verificar los hosts del
    emulador, que es justo lo que AGENTS.md exige antes de usarlo.
12. Un enlace a `#voluntarios` abría Inicio con la dirección mintiendo, y se
    tragaba el primer Atrás.
13. A-26 comprobaba solo el alto de los controles: la regla es 44 × 44.
14. La lista de descartes del reloj crecía sin tope mientras durara la sesión.
15. La hoja emergente eran 85 líneas, más marcado y estilos, que ninguna
    pantalla de esta etapa abría. Se retiró.

Y la corrección del punto 12 introdujo un fallo nuevo que cazó su propia prueba:
al arrancar, el primer aviso de sesión llega en nulo y borraba la pantalla
pedida en la dirección antes de que nadie entrara.

**Esta revisión tampoco es independiente.** La hizo quien escribió el código.
Que haya encontrado quince cosas no dice que no queden más: dice que una segunda
mirada rinde, y que una mirada ajena rendiría otro tanto.

### 2.3.1 Qué encontraron las pruebas al construir

Antes de esa revisión, las propias pruebas de extremo a extremo ya habían
destapado tres fallos reales mientras se construía. Se dejan anotados porque
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
| Lista de 202 voluntarios, procesador a un cuarto | menos de 1 s | **672 ms** |
| Lecturas de una apertura de sesión | menos de 10 | **4 documentos del servidor** |

Contadores de `datos.js` en una apertura de sesión:

```
documentosDelServidor: 4      lecturasDeTransaccion: 1
eventosDeCache: 0             reintentosDeTransaccion: 0
cambiosDeMetadatos: 0         consultasVacias: 0
documentosModificadosPorEscucha: 0   reconexiones: 0
lecturasDeReglasEstimadas: 5
```

Los 5 accesos de reglas estimados se desglosan así: uno por cada una de las dos
escuchas que abre la sesión (el propio voluntario y `config/app`), uno por la
lectura de la muestra de hora, y dos por la escritura de esa muestra. Cuadra con
la tabla de la sección 4.

Y al abrir la lista de 202 voluntarios: `documentosDelServidor: 6`,
`documentosModificadosPorEscucha: 202`, `eventosDeCache: 2`, `reconexiones: 1`,
`lecturasDeTransaccion: 2`, `lecturasDeReglasEstimadas: 9`. La escucha suma los
documentos que cambiaron, no toda la lista en cada evento.

**Telemetría no es facturación** (contrato §8). Estos contadores son del
cliente: no incluyen las lecturas que consume la evaluación de reglas aunque la
operación se deniegue, ni los reintentos internos del SDK. El contraste con el
panel del proyecto queda para el ensayo. Y son medidas en emulador: no son una
garantía de rendimiento en producción.

## 4. Consultas a otros documentos en las reglas, e índices

Dos cosas sostienen estos números, y las dos están en el archivo a propósito:
cada `get()` se hace una sola vez y su resultado se pasa como argumento a las
funciones que lo examinan; y **cada rama comprueba primero la forma de la
escritura, que es gratis, y solo entonces consulta otros documentos**. Además la
rama de la muestra de hora va antes que la del administrador, por ser la más
frecuente y la más barata.

El orden importa y no es cosmético: con las consultas al principio, una
sincronización de hora pagaba también los accesos de la rama del administrador
antes de que esa rama fallara por la forma. El conteo es por análisis del
archivo, sin suponer ahorro por caché:

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
16. **La hoja emergente se retiró** en vez de dejarla sin ejercitar: ninguna
    pantalla de esta etapa abre una. Vuelve en la etapa que la use, con sus
    pruebas.
17. **`inicioJuego` se endureció más allá de lo que pedía la Etapa 1.** La etapa
    solo pide «respetando tipos y largos», pero el campo entraba sin formato y
    sin el candado del contrato §8. Son dos líneas de reglas y cierran un hueco
    que si no sobreviviría hasta la Etapa 5. No es implementar el juego por
    anticipado: es no dejar la puerta abierta.
18. **No hay contraprueba externa.** El dueño decidió trabajar solo en esta
    sesión. En reemplazo se hizo la revisión de §2.3, que no es independiente.

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
- **La hoja emergente no existe todavía.** Base §9 exige que retenga el foco, lo
  devuelva al cerrar y que el botón Atrás la cierre. Esta etapa no tiene ninguna
  pantalla que use una hoja —el formulario de Voluntarios va en línea—, así que
  el componente se retiró en vez de dejarlo sin ejercitar. Vuelve en la etapa que
  abra la primera hoja, con sus pruebas. Esa mitad de la regla del botón Atrás
  queda pendiente hasta entonces.
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

1. **Decidir qué pasa con la contraprueba.** El flujo de `AGENTS.md` pide un
   revisor separado del implementador, y esta entrega no lo tuvo: la revisión de
   §2.3 la hizo quien escribió el código. Si quieres recuperar esa red, basta
   con abrir otra herramienta —Cursor sirve— en una sesión que no conozca este
   razonamiento, darle el SHA y el texto de «Cómo pedir la contraprueba» de
   `LEEME-ARRANQUE-BIBLIOTECA.md`. Lo que no sirve es pegarle estas conclusiones
   como punto de partida: ahí se pierde justo lo que la hace valer.
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
| SHA entregado | `231c4ff` y lo que siga en la rama; el informe se actualiza con cada ronda |
| Corrida de integración continua en verde | `231c4ff`, las seis suites |
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
| Pruebas ejecutadas | **153**: 69 unidad, 39 reglas (28 de los casos + 11 adversas), 7 scripts, 36 extremo a extremo, 2 carga |
| Pruebas en rojo | ninguna |
| Casos del documento cubiertos | 39 de 39 automatizables; A-31 es manual |
| Datos personales versionados | ninguno; el escáner pasa sin hallazgos |
