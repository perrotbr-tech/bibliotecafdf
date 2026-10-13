# Contrato operativo — revisión 1.1

11-10-2026 (America/Santiago). Revisión de especificaciones, todavía sin implementación ni pruebas de la aplicación.

Este documento completa `00-base.md` y se lee antes de cualquier etapa. Sus decisiones ya están incorporadas en los puntos afectados de las etapas; aquí se concentra el detalle común. No autoriza desplegar ni saltar la aprobación entre etapas.

## 1. Arranque, herramientas y ambientes — Etapa 1

Cursor construye una etapa por rama. Codex hace la contraprueba en una sesión separada sobre el commit exacto entregado; el implementador corrige y el revisor vuelve a probar. No se trabaja simultáneamente sobre la misma rama. Una revisión del propio implementador no se presenta como contraprueba independiente.

Se puede preparar y construir la Etapa 1 contra `demo-biblioteca` sin cuentas reales. Las configuraciones web de ensayo y producción pueden estar en `null`: fuera del emulador, una configuración ausente muestra «Falta configurar este ambiente» y no inicia conexiones. Nunca inventar credenciales ni seleccionar producción como alternativa a un error.

El emulador se selecciona únicamente en `localhost`, `127.0.0.1` o `[::1]`; la configuración del SDK, Auth, Firestore y los scripts debe coincidir en `demo-biblioteca`. Una IP de la red local no activa el emulador por sí sola. `?ahora=` y el acceso simulado se rechazan fuera del emulador. `?ensayo=1` se recuerda en `sessionStorage` bajo una clave propia de esta app y ambiente. Al cambiar ambiente se cierran escuchas y sesión antes de inicializar el otro SDK. El proyecto configurado se muestra en la franja de ensayo.

Para el ensayo ANTES de fusionar, el dueño publica solo `docs/` del commit candidato en un repositorio de Pages separado, sugerido `biblioteca-app-ensayo`. En esa copia, `config-publica.js` contiene únicamente el proyecto de ensayo y declara ese ambiente fijo; no incluye configuración de producción. `README.md` registra el SHA candidato, URL y resultado manual. La app instalada debe conservar ese ambiente: `start_url`, `scope`, íconos y enlaces son relativos a la subcarpeta de publicación. El repositorio principal se mantiene en `main` hasta aprobar el candidato. Esta publicación la hace el dueño.

Dependencias de desarrollo con versiones exactas y lockfile: Node compatible, Java 21 o superior compatible con la versión fijada del emulador, Firebase CLI, Admin SDK, Rules Unit Testing y Playwright. Registrar versiones que realmente se instalan y pasan las pruebas; no declarar una versión «la última» sin verificarla. La app publicada continúa sin compilación. Npm y descargas de navegadores/JAR son herramientas de desarrollo, no peticiones de la app.

## 2. Hora verificada — Etapa 1

`reloj.ahora()` devuelve un instante fiable o `null`; nunca devuelve la hora del teléfono como sustituto silencioso ni avisado. Sin hora verificada se puede consultar catálogo y lectores, pero los estados calculados de fechas se muestran «Hora pendiente» y se bloquean préstamo, devolución, anulación, reapertura, cierre y registro temporal de recordatorios. La sincronización del reloj queda exceptuada de ese bloqueo para evitar un círculo imposible.

Se escribe `ultimaConexion: serverTimestamp()` y un `sincronizacionId` aleatorio en el propio voluntario mediante transacción, y se lee desde el servidor. La excepción de permisos del voluntario permite exactamente esos dos campos. Si otro dispositivo sobrescribe la muestra antes de leerla, el identificador no coincide: se descarta y se repite con un número acotado de intentos. No atribuir a este dispositivo la muestra de otro.

La muestra se ancla a `performance.now()` y al instante del servidor, con incertidumbre máxima conservadora igual a la duración de la ida y vuelta. Una muestra que tarde más de 4 segundos se descarta. La hora avanza con ese reloj monotónico, no con `Date.now()`. Se invalida al suspender/volver a primer plano, al perder/recuperar conexión y a los 5 minutos; se resincroniza antes de operar. Un cambio manual del reloj no altera la muestra. El reloj del teléfono solo sirve para mostrar el aviso de desfase.

Ni esta estimación ni un parámetro de prueba sustituyen `request.time` en las reglas. Si una operación cruza un límite temporal, las reglas prevalecen: refrescar y pedir repetir cuando corresponda, sin éxito anticipado. `?ahora=` sirve para pruebas de funciones y pantallas. Las pruebas E2E con escrituras protegidas por tiempo y las pruebas de reglas usan fechas relativas al reloj REAL del emulador; fijar el parámetro no mueve ese reloj.

Para que CI pueda probar préstamos cualquier día, la preparación de pruebas con privilegio administrativo puede sembrar exclusivamente en demo un calendario sintético cuya ventana incluya el request.time real, y coordinar salidaDia con el reloj de UI. Esa prueba demuestra la validación del contrato, no la exactitud del calendario civil. Por separado son obligatorias las pruebas del generador con America/Santiago, del calendario canónico que rechaza un día no sábado y del borde de sus ventanas. No añadir excepciones de prueba a las reglas publicadas, ni cargar ese calendario sintético en ensayo o producción. Cada prueba documenta cuál de esos dos calendarios emplea.

## 3. Confirmación y correlativos — Etapas 1–3

Cada intención de escritura recibe un `operacionId` aleatorio antes del primer intento. Todo documento de negocio creado por la app incorpora `creacionId` inmutable; cada mutación incorpora `ultimaOperacionId` y `modificadoEn: serverTimestamp()`. Los metadatos son parte de la lista de campos permitidos en cada transición; nunca abren permiso para cambiar otros campos. La actualización del reloj usa su identificador propio. Los documentos importados obtienen identificadores deterministas de importación y las fotografías siguen siendo inmutables.

Crear un préstamo usa un ID aleatorio de documento estable. Crear un lector conserva `L` + correlativo: el ID final se obtiene del contador DENTRO de la transacción y puede cambiar entre intentos abortados. Lo estable desde el primer toque es `operacionId`, no ese correlativo. Si el resultado es incierto, se localiza mediante su clave de nombre y se verifica `creacionId` del lector; una clave ocupada por otro cliente es conflicto, no éxito propio.

Después de un error de red se consulta al servidor, nunca solo la caché:

- En altas, éxito solo si el documento tiene el `creacionId` esperado.
- En cambios, éxito solo si `ultimaOperacionId` coincide y el resultado es compatible. La mera existencia de un préstamo no confirma una devolución.
- Una lectura denegada, agotada o sin conexión NO demuestra que no se guardó.
- Si hubo una operación posterior y ya no se puede atribuir el estado al intento, mostrar «El registro cambió. Revisa su estado antes de repetir». No ejecutar automáticamente una acción antigua, ni afirmar «No se guardó». El formulario se conserva en memoria; la interfaz deja consultar el estado actualizado.
- Se puede mantener en `sessionStorage` únicamente el ID de operación, tipo, ruta e identificadores necesarios para recuperar tras recargar; nunca nombres, teléfonos, tokens ni una cola de escrituras. Una recarga exige recuperar la sesión y releer el servidor antes de ofrecer repetir.

Los callbacks de `runTransaction` no alteran interfaz ni emiten mensajes: pueden repetirse. Todas sus lecturas ocurren antes de sus escrituras. `navigator.onLine` es una señal adicional, no prueba suficiente de conexión.

`config/contadores` agrega `ultimoPrestamoId` y `ultimoLectorId`, inicialmente nulos. Cada incremento enlaza el único documento que se crea. Las reglas del contador exigen mediante `getAfter` que ese documento es nuevo, tiene el número correcto y queda enlazado al contador; las reglas del documento comprueban la relación inversa. Se rechaza subir el contador solo o crear DOS préstamos con el mismo N+1 en una transacción. `vecesPrestado` cambia exactamente +1 al crear, −1 al anular y 0 al devolver/reabrir; nunca negativo. Los campos del otro contador no se alteran.

## 4. Sábado real y registro desde papel — Etapa 3

Los voluntarios prestan únicamente durante el sábado en `America/Santiago`. Devolver está disponible todos los días. Fuera del sábado, Prestar muestra cuándo será la próxima jornada. El administrador dispone en Más de «Registrar desde papel»: fecha de salida en sábado no futuro, libro, lector, plazo y motivo obligatorio de 10 a 200 caracteres. Conserva las mismas transacciones de unicidad y no modifica un préstamo ya registrado. Ante conflicto con un libro ya prestado se detiene para conciliación; no sobrescribe el movimiento posterior.

Se distinguen fecha de salida y registro:

| Campo | Significado |
|---|---|
| `prestadoEn` y `creadoEn` | Instante de registro, ambos `serverTimestamp()` |
| `salidaDia` | Fecha efectiva de salida, `AAAA-MM-DD` en Chile |
| `plazoSabados` | Entero de 1 a 4 |
| `registroDiferido` | Booleano; solo el administrador puede crearlo verdadero |
| `motivoRegistroDiferido` | Nulo en el flujo normal; obligatorio desde papel |
| `temporada` | Bimestre de `salidaDia`, no del día de digitación |
| `venceEl` | Fin del sábado correspondiente a la salida efectiva y al plazo |

Para exigir estas fechas también desde reglas sin servidor propio, `scripts/generar-calendario.mjs` prepara documentos de confianza `calendario/{salidaDia}`: `inicio`, `finExclusivo`, `temporada` y `vencimientos` (lista de cuatro Timestamp). Un documento por sábado. Los genera con `Intl` en `America/Santiago`, sin desplazamientos fijos, y valida cambios de hora. Las reglas niegan cualquier escritura del cliente a esta colección, incluso al administrador; solo el script administrativo del dueño la carga. No contiene datos personales.

Cobertura inicial: desde el menor año de la carga hasta el año de puesta en marcha +2, incluidos los cuatro vencimientos posteriores al último sábado. Inicializar la cobertura necesaria antes de la Etapa 3 y ampliarla anualmente antes del último año disponible. Si falta una fecha, la app bloquea ese préstamo y pide al administrador actualizar el calendario. No genera fechas permisivas como alternativa.

Al crear un préstamo normal las reglas exigen `inicio <= request.time < finExclusivo`; en diferido exigen administrador y `inicio <= request.time`. En ambos casos `temporada` y `venceEl` deben coincidir EXACTAMENTE con el calendario y `plazoSabados`. El vencimiento de un diferido puede estar en el pasado: se muestra atrasado. `origen` sigue siendo `app` o `excel`; un diferido es `app`. El legado Excel conserva sus fechas verificadas, aunque no sean sábados, y lleva `registroDiferido: false`, `plazoSabados: null`, `salidaDia: salio`.

La lista de movimientos de hoy usa instantes de registro; historia, meses y puntos usan `salidaDia`. La ficha distingue «Salió el…» de «Registrado el…» cuando son distintos. Se mantiene el índice de Devueltos por `prestadoEn`, rotulado orden por registro; no se promete orden por salida efectiva para los diferidos. Los ejemplos martes/viernes de `fechas.js` solo sirven para el legado importado y no autorizan préstamos nuevos en esos días.

## 5. Devoluciones sin carrera con el servidor — Etapas 3 y 5

En una devolución ordinaria el cliente guarda `devueltoEn: serverTimestamp()` y `devueltoATiempo: null`. Tras confirmar, la función pura `fueATiempo(prestamo)` compara los Timestamp definitivos del servidor: `devueltoEn <= venceEl`. De esta manera no se intenta adivinar el booleano antes de conocer el instante de commit.

Un valor booleano de `devueltoATiempo` significa corrección explícita del administrador o dato legado del Excel. La función usa ese booleano cuando existe; en caso contrario deriva el resultado. Solo el administrador puede fijar/quitar una corrección en un devuelto, acompañada de `correccionATiempo: {por, en, motivo}`; motivo de 10 a 200 caracteres y hora del servidor. La devolución ordinaria y la reapertura dejan la corrección en nulo. Un voluntario no puede enviar un booleano para reclamar puntos. Todas las pantallas, estadísticas y puntos usan la misma función.

Para una devolución anotada en papel se registra la recepción y el administrador corrige «Fue devuelto a tiempo» con motivo. `devueltoEn` siempre documenta cuándo se registró en el sistema; no se inventa una hora exacta de recepción que no consta en el papel.

## 6. Exclusión temporal, respaldo y cierre — Etapas 1, 2 y 5

La Etapa 1 inicializa `config/control` con `bloqueo: null`. Un bloqueo válido tiene `{tipo, token, por, iniciadoEn, hasta, temporada}`; temporada es el ID al cerrar y nulo para mantenimiento. Tipos: `mantenimiento` (solo script del dueño, hasta nulo y liberación explícita tras verificar) y `cierre` (administrador desde la Etapa 5, hasta timestamp obligatorio). Mantenimiento no expira automáticamente: un trabajo parcial debe seguir cerrado. La app escucha este documento. Todas las mutaciones de negocio deben quedar denegadas si existe un bloqueo vigente, excepto las operaciones estrictamente necesarias del dueño del cierre sobre su fotografía y su desbloqueo. Sin documento de control no se escribe. Lectura y sincronización de hora siguen disponibles. El bloqueo no se salta por ocultar un botón.

Un cierre toma el bloqueo en transacción por como máximo 120 segundos, con hora del servidor y token. Después obtiene desde el servidor catálogo, lectores, TODOS los préstamos de esa temporada y TODOS los abiertos. Calcula usando un único instante de corte, igual a `iniciadoEn` del bloqueo. Guarda la fotografía y libera el bloqueo en una sola transacción que vuelve a comprobar propietario, token y vigencia. Si vence o se pierde, descarta el cálculo y vuelve a empezar tras informar; no guarda una fotografía calculada antes de adquirir el bloqueo. Las reglas deben verificar también los campos de la fotografía y el enlace al bloqueo. Una segunda persona no puede cerrar a la vez. La expiración se evalúa con `request.time`; no depende de un temporizador del teléfono.

El servidor garantiza exclusión e inmutabilidad, pero no recalcula una tabla agregada de cientos de documentos mediante reglas. El administrador es de confianza para el cálculo del resultado; se contraprueba con un cálculo independiente. Declarar ese límite explícitamente.

La fotografía conserva TODAS las entradas hasta 600 lectores entre `tabla` y `pausados`, `instanteCorte`, el denominador de libros de cada categoría y el título de los libros destacados. El cierre rechaza resultados que excedan ese límite o el presupuesto conservador de 750 KiB de serialización UTF-8 antes de escribir; no trunca medallas ni empates. Las reglas limitan la cantidad de entradas y tipos validables; Firestore impone su límite de documento. Sobre ese tamaño hace falta otra versión con fotografías paginadas. Un cambio posterior de nombre, título o categoría no altera el resultado cerrado.

El respaldo administrativo adquiere mantenimiento y verifica que no haya un cierre activo; se aborta si pierde el bloqueo. Exporta todas las rutas de la biblioteca, incluidas subcolecciones, marcas de tiempo como `{seconds,nanoseconds}`, esquema, proyecto y conteos, y un SHA-256 de los datos serializados canónicamente. Su validez exige lectura completa y verificación de hash/referencias; contar documentos o poder abrir el JSON no basta. La restauración de prueba en emulador compara documento por documento. El control se normaliza a `bloqueo:null` al restaurar para no trasladar un candado de otra base.

Importar/reemplazar/restaurar puede exceder una transacción: son trabajos administrativos reanudables con manifiesto de progreso y mantenimiento. Admin SDK no usa las reglas del cliente. Los scripts usan lotes acotados o transacciones según la operación, nunca prometen atomicidad de toda la biblioteca. Un fallo conserva el bloqueo operativo y el manifiesto; el dueño reanuda o restaura antes de reabrir. El script comprueba el token antes de cada bloque y solo libera mantenimiento al verificar que la tarea terminó o que la restauración quedó íntegra. Un dueño puede recuperar manualmente un trabajo interrumpido tras revisar el manifiesto. No se guardan respaldos ni manifiestos en Git. El reemplazo de carga afecta solo libros, lectores, claves y préstamos: preserva voluntarios, calendario y fotografías, y rechaza una recarga de negocio si ya hay temporadas cerradas incompatibles. La restauración integral sí repone todas las colecciones bajo mantenimiento.

## 7. Unión de lectores y reglas — Etapas 2 y 6

La reserva de nombre comprueba unicidad de la `clave` suministrada. No certifica identidad civil ni permite distinguir homónimos: la app sigue con esa limitación. Las reglas validan forma, permisos y enlaces; no se afirma que reproduzcan toda la normalización Unicode del cliente.

La unión conserva una única raíz. El receptor A queda con `esDestinoFusion:true`; no se permite después usar A como origen de otra unión. Sí se puede unir C en A. Si se elige el sentido inverso, la interfaz propone conservar A. Este límite deliberado evita cadenas y ciclos sin un proceso nuevo de migración. Todas las altas inicializan el campo en falso.

La marca de B en A y el cambio de clave actual ocurren atómicamente. Los alias de nombres anteriores pueden seguir apuntando a B: al encontrarlos se resuelve un solo salto B→A. No se liberan alias antiguos para crear duplicados. Las reglas solo permiten cambiar un índice de nombre como parte de una unión válida hacia su raíz; no basta ser administrador para redirigirlo arbitrariamente.

Trasladar préstamos en transacciones de hasta DOS documentos, verificando origen y destino en cada una; no se asume que ocho caben. Descubrir uniones incompletas consultando lectores con `fusionadoEn == A` y luego sus préstamos; no depende de memoria local. Mientras se trasladan, puntos y pausa resuelven B→A incluso antes de mover los documentos, y deduplican por ID de préstamo. No se puede cerrar una temporada con una unión incompleta. Dos uniones opuestas deben dejar exactamente una orientación válida y nunca un ciclo.

El informe cuenta accesos de reglas por operación y por transacción incluyendo autorización, control, calendario, contadores y referencias; máximo 10 por operación y 20 por transacción, sin depender de ahorro por caché. Si una operación excede el presupuesto, se debe simplificar y demostrar un contrato equivalente antes de aprobar esa etapa. Este paquete no afirma que una implementación de reglas aún inexistente ya cumpla esos límites.

## 8. Datos, red y mediciones — todas las etapas

El prefijo `5690000` es una convención de estos fixtures, NO se ha acreditado como rango telefónico reservado. Nunca contactar esos números. Las pruebas de WhatsApp reales usan exclusivamente un número aportado por el dueño para ese ensayo, nunca versionado.

El listado de dominios se refiere a recursos cargados por la app. Se permite su propio origen, módulos en `www.gstatic.com`, hosts concretos de Firebase/Google Auth, incluido `accounts.google.com`, y los endpoints de emuladores solo en local. Las navegaciones externas explícitas al iniciar Google y tocar WhatsApp son excepciones esperadas, no recursos embebidos. No cargar fotos de perfil desde dominios adicionales. El reporte de red registra hosts efectivamente observados, sin convertir la lista de ejemplos en garantía universal del proveedor.

WhatsApp abre en el mismo gesto del usuario, sin esperar una transacción ni perder la activación del navegador. El registro es un intento independiente y confirmado. La interfaz dice «WhatsApp abierto el…» o «Mensaje preparado el…», nunca certifica contacto ni envío. Si falla el registro o la hora, indica «No se pudo anotar la apertura». El enlace con `encodeURIComponent` y teléfono internacional sin `+` se contraprueba en Android/iPhone.

Los contadores de la app son telemetría, no facturación exacta. Separar documentos entregados por servidor, eventos de caché, cambios de metadatos, documentos modificados por listener, lecturas de transacciones y reintentos. No sumar de nuevo TODOS los documentos en cada evento de una escucha. Añadir estimación de lecturas de reglas, consultas vacías y reconexiones, y contrastar con el panel del proyecto de ensayo. El costo cero es un objetivo dentro de cuotas, no una promesa ilimitada. Las cargas masivas se hacen en emulador; el ensayo usa un conjunto pequeño.

El permiso «sin acceso» y cerrar sesión cancelan todas las escuchas, vacían datos en memoria y reinician vistas. No habilitar persistencia Firestore en disco para lectores/préstamos. Las pruebas deben comprobar que otra cuenta no recibe datos residuales. Un escáner de repositorio detecta patrones de secretos/teléfonos; no prueba por sí solo ausencia de nombres reales: también se revisa procedencia de fixtures y el diff de publicación.

`config/app.inicioJuego` se fija antes de la primera temporada cerrada; después no se puede mover desde la app. Para comprobarlo sin consultar una colección desde reglas, config/app agrega `juegoCerradoAlgunaVez:false` al inicializar. El primer cierre lo cambia a true en la misma transacción que fotografía y desbloqueo; las reglas exigen esa relación mediante el ID de temporada incluido en el bloqueo. Nunca vuelve a false. No puede cambiar inicioJuego junto con ese primer cierre. Una restauración valida el indicador contra las fotografías existentes. Nunca se oculta una fotografía cerrada con un cambio de ajustes. Las tablas exportadas eliminan controles/tabulaciones/saltos, quitan comillas iniciales y verifican el primer carácter significativo después de espacios; si es `=`, `+`, `-` o `@`, anteponen apóstrofo.

## 9. Puertas de aprobación

La Etapa 1 debe incorporar este contrato de hora, ambientes, control e intención de escritura, y dejar extensibles los metadatos. No implementar catálogo, calendario operativo, préstamos ni juego por anticipado. Las etapas siguientes implementan las secciones indicadas.

No declarar pruebas aprobadas por haber revisado documentos. El informe separa: comprobado documentalmente; probado con código; pendiente de dispositivo real. El emulador no sustituye el proyecto de ensayo ni el cálculo independiente del juego. La aprobación de una etapa requiere exactamente el SHA que se ensayó.
