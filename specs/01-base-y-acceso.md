# Etapa 1 — Base y acceso

> Revisión 1.1 · 11-10-2026. Leer también `specs/00-contrato-operativo.md`; define los detalles comunes y las correcciones de esta revisión.


## Objetivo

Dejar el repositorio, las pruebas y la forma de guardar funcionando, y que solo entren a la app las cuentas de Google autorizadas.

## Entrega demostrable

Servida en local contra el emulador: la app muestra la pantalla de entrada. Una cuenta autorizada entra y ve la estructura de la app con su navegación, todavía sin datos. Una cuenta no autorizada ve «Tu cuenta no tiene acceso» y no puede leer nada de la base. El administrador agrega un voluntario, y con la red cortada el botón queda deshabilitado en vez de fingir que guardó.

## Alcance

1. **Andamiaje.** Estructura de carpetas; `firebase.json` con emuladores de Authentication y Firestore bajo el proyecto `demo-biblioteca`; versiones fijadas y lockfile; `package.json` con las herramientas de prueba y de administración; `.gitignore` que excluye `datos/` y cualquier llave.
2. **Integración continua.** Un flujo de GitHub Actions que en cada solicitud de cambios corre las pruebas de unidad, las de reglas, las de extremo a extremo y `scripts/revisar-repositorio.mjs`.
3. **`scripts/revisar-repositorio.mjs`.** Falla si encuentra versionado algo de `datos/`, un archivo con forma de llave de servicio, o un número con forma de teléfono chileno que no sea ficticio: exactamente 11 dígitos seguidos, sin más dígitos pegados antes ni después, que empiecen con `569` y no con `5690000`, prefijo reservado a los datos de prueba.
4. **Cáscara de la app.** `docs/index.html` con `<!doctype html>`, `lang="es"`, metaetiqueta de ventana y manifiesto para instalarla en Android. Barra superior, cinco destinos en la barra inferior (Inicio, Prestar, Préstamos, Catálogo, Más) y manejo del botón Atrás con el historial del navegador.
5. **Entrada** con Google mediante `signInWithPopup`, y cierre de sesión.
   La app aplica la selección cerrada del contrato §1: loopback usa demo; la publicación de ensayo fuerza ensayo; una configuración nula bloquea su ambiente. Fuera del proyecto real muestra «EMULADOR» o «ENSAYO».
6. **Control de acceso** por lista de voluntarios y por rol.
7. **Forma de guardar** común a toda la app, implementada una sola vez en `datos.js`.
8. **Hora corregida** con la del servidor, en `reloj.js`.
9. **Pantalla Voluntarios** para el administrador.
10. **Reglas de seguridad** de `voluntarios` y `config` (incluido `config/control`), metadatos de operación, y negación por defecto de lo demás.
11. **`scripts/inicializar.mjs`**, que prepara una base vacía.

## Fuera del alcance de esta etapa

Libros, lectores, préstamos y ranking. Las pantallas de esos destinos muestran un estado vacío con el texto «Disponible pronto». La edición del nombre de la biblioteca, del plazo y de los mensajes llega en etapas posteriores; hasta entonces valen los valores iniciales.

## Datos que toca

`bib` vale `principal` y sale de una constante. Todos los documentos llevan `creadoEn` (hora del servidor) y `creadoPor` (correo).

**`bibliotecas/{bib}/voluntarios/{correo}`**, donde el identificador es el correo en minúsculas:

| Campo | Tipo | Regla |
|---|---|---|
| `nombre` | texto | 1 a 60 caracteres |
| `rol` | texto | `admin` o `voluntario` |
| `activo` | booleano | |
| `ultimaConexion` | marca de tiempo | hora del servidor; la escribe el propio voluntario |
| `sincronizacionId` | texto o nulo | ID de la muestra del dispositivo |

**`bibliotecas/{bib}/config/app`**

| Campo | Valor inicial |
|---|---|
| `nombreBiblioteca` | `Biblioteca` |
| `plazoSabadosPorDefecto` | 2 |
| `categorias` | Infantil (INF), Hombres y mujeres (HM), Familia (FAM), Vida Cristiana (VC), Novelas (NV), Teología (TEO) |
| `mensajeAtraso` | `Hola {nombre}, te escribimos de la biblioteca. El libro «{titulo}» venció el {fecha}. ¿Puedes traerlo este sábado? ¡Gracias!` |
| `mensajePrevio` | `Hola {nombre}, te recordamos que el libro «{titulo}» de la biblioteca vence este {fecha}. ¡Te esperamos!` |
| `inicioJuego` | la temporada de la fecha en que se ejecuta el script, por ejemplo `2026-6` |
| `juegoCerradoAlgunaVez` | false; el cliente no puede cambiarlo hasta la operación de cierre de Etapa 5 |

**`bibliotecas/{bib}/config/contadores`**, con `ultimoPrestamo` y `ultimoLector` en 0, `ultimoPrestamoId` y `ultimoLectorId` nulos.

**`bibliotecas/{bib}/config/control`**, con `bloqueo: null`. El contrato §6 define su uso. En esta etapa solo scripts del dueño pueden establecer mantenimiento; el cliente no puede tomar un cierre aún.

## `scripts/inicializar.mjs`

Usa Admin SDK sin credenciales reales en demo-biblioteca. Fuera del emulador solo lo ejecuta el dueño con sus credenciales locales, según PASOS-DEL-DUENO.md. Recibe el correo y el nombre del primer administrador.

- Crea `config/app` con los valores iniciales, `config/contadores` en 0 y el documento del administrador. Crea además `config/control` con `bloqueo: null`.
- Si alguno de esos documentos ya existe, no lo toca y lo informa.
- Contra el emulador se usa en la preparación de las pruebas.

## Forma de guardar

Aplica a toda escritura de la app, también a las de un solo documento, y se implementa una vez en `datos.js`:

1. Toda escritura se hace con `runTransaction`, con `maxAttempts` en 5. Así falla cuando no hay conexión en vez de quedar en cola.
2. Desde el toque hasta la respuesta, el botón muestra «Guardando…» y no acepta otro toque.
3. El aviso de éxito aparece solo cuando la transacción termina bien. Las listas no muestran datos con escrituras pendientes.
4. Usar la intención estable, metadatos y resolución por identidad del contrato §3. No confirmar una operación por la mera existencia del documento.
5. Mientras la transacción no termina, mostrar «Confirmando… no cierres la app» al superar 5 segundos. Después de un error recuperar desde servidor; conservar el formulario y distinguir éxito propio, ausencia comprobada, conflicto y resultado no atribuible.
6. Sin conexión, botones deshabilitados; no hay cola de escrituras.

## Hora verificada

Implementar íntegramente el contrato §2: muestra con `sincronizacionId`, `performance.now()`, vigencia máxima de cinco minutos y estado `null` sin una referencia fiable. No usar el reloj del teléfono como alternativa. Las pantallas temporales muestran «Hora pendiente»; consultar catálogo y lectores no requiere hora. La toma de la muestra siempre puede reintentarse con conexión.

Aplicar también las reglas de selección de ambiente del contrato §1: localhost y loopback usan exclusivamente demo; configuraciones reales ausentes no impiden las pruebas locales y nunca abren otro ambiente por error.

## Reglas de seguridad

- Una persona es **voluntaria** si inició sesión, su correo está verificado y existe `voluntarios/{su correo}` con `activo` verdadero.
- Es **administradora** si además su `rol` es `admin`.
- `voluntarios`: lo lee cualquier voluntario. Lo crea y lo modifica solo un administrador, con `nombre` de 1 a 60 caracteres, `rol` igual a `admin` o `voluntario` y `activo` booleano. Nadie lo borra. Un administrador no puede desactivarse ni quitarse el rol a sí mismo.
- Excepción: un voluntario puede modificar su propio documento cambiando únicamente `ultimaConexion` y `sincronizacionId`, con `ultimaConexion` igual a la hora del servidor y el ID con formato válido. Esta excepción no permite modificar rol, estado, creación ni datos personales.
- `config/app`: lo lee cualquier voluntario. Lo modifica solo un administrador, respetando tipos y largos; `juegoCerradoAlgunaVez` es inmutable desde el cliente en esta etapa.
- `config/contadores`: lo lee cualquier voluntario. En esta etapa nadie lo modifica desde la app.
- `config/control`: lectura por voluntarios activos; sin escrituras del cliente en esta etapa. Su bloqueo de mantenimiento se comprueba en las mutaciones de negocio.
- Cualquier otra ruta: denegada.

## Pantallas y comportamiento

**Entrada.** El nombre que trae `config-publica.js` (inicialmente «Biblioteca»), el botón «Entrar con Google» y una línea: «Solo entran los voluntarios autorizados». Esta pantalla no lee la base. Si el navegador bloquea la ventana emergente: «Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio y vuelve a tocar Entrar».

**Sin acceso.** Para una cuenta que no está en la lista o está inactiva: «Tu cuenta (correo) no tiene acceso. Pídele al administrador que te agregue». Botón «Usar otra cuenta».

**Cáscara.** Tras entrar: barra superior con `nombreBiblioteca` y la fecha de hoy en hora de Chile; barra inferior con los cinco destinos. En «Más» aparecen «Voluntarios» (solo administrador) y «Cerrar sesión».

**Voluntarios.** Lista con nombre, correo, rol y estado, ordenada por nombre. Formulario para agregar: correo, nombre y rol. El correo se guarda en minúsculas y sin espacios. Si el correo ya está en la lista: «Ese correo ya está en la lista». Botón para desactivar o reactivar.

**Pruebas de extremo a extremo.** Entran con `signInWithCredential` y una credencial de Google simulada del emulador de Authentication. Ese camino existe solo cuando la app corre contra el emulador.

## Índices

Ninguno en esta etapa.

## Casos de prueba

| ID | Situación | Resultado esperado |
|---|---|---|
| A-01 | Persona sin sesión intenta leer `voluntarios` o `config/app` | Denegado |
| A-02 | Sesión con cuenta que no está en la lista | Denegado en toda ruta; ve la pantalla «Sin acceso» |
| A-03 | Cuenta en la lista con `activo` falso | Denegado; ve «Sin acceso» |
| A-04 | Cuenta en la lista con correo no verificado | Denegado |
| A-05 | Voluntario activo lee `voluntarios` y `config/app` | Permitido |
| A-06 | Voluntario intenta crear un voluntario o cambiar el rol o el estado de alguien | Denegado |
| A-07 | Voluntario intenta modificar `config/app` o `config/contadores` | Denegado |
| A-08 | Administrador agrega un voluntario con rol válido | Permitido |
| A-09 | Administrador agrega un voluntario con rol `jefe` o sin nombre | Denegado |
| A-10 | Administrador intenta desactivarse o pasarse a `voluntario` | Denegado |
| A-11 | Cualquiera intenta borrar un documento de `voluntarios` | Denegado |
| A-12 | Voluntario lee una ruta que no figura en las reglas | Denegado |
| A-13 | Correo escrito como ` Ana.Rojas@Example.com ` al agregar | Se guarda `ana.rojas@example.com` |
| A-14 | Agregar un correo que ya está en la lista | Mensaje «Ese correo ya está en la lista»; el documento existente no cambia |
| A-15 | Un voluntario es desactivado mientras tiene la app abierta | En la siguiente lectura pasa a «Sin acceso», sin error sin tratar |
| A-16 | Doble toque en «Agregar voluntario» | Se crea un solo documento |
| A-17 | Sin conexión, pantalla Voluntarios | Botones de escritura deshabilitados con «Sin conexión: no se puede guardar» |
| A-18 | La red se corta entre el toque y la respuesta al agregar | No aparece confirmación; el botón sigue bloqueado y pasa a «Confirmando… no cierres la app»; cuando la transacción termina con error, «No se pudo confirmar el guardado»; el formulario conserva lo escrito |
| A-19 | Tras A-18, vuelve la red y la escritura sí se había aplicado | La app lo detecta y muestra «Sí quedó guardado»; no se crea un duplicado |
| A-20 | Tras A-18, vuelve la red y la escritura no se aplicó | «No se guardó. Inténtalo de nuevo» |
| A-21 | Voluntario sincroniza `ultimaConexion` + `sincronizacionId` con hora del servidor / otra hora / además cambia rol | Permitido / denegado / denegado |
| A-22 | Reloj del teléfono adelantado 3 días | `reloj.ahora()` devuelve la hora del servidor con un error menor a 5 segundos; la fecha de la barra es la real; aparece el aviso una vez |
| A-23 | No se puede obtener la hora del servidor al abrir | `reloj.ahora()` devuelve nulo; «Hora pendiente» y operaciones temporales bloqueadas; la consulta no temporal permanece disponible |
| A-24 | `?ahora=2026-10-10T15:00:00-03:00` contra el emulador / contra el proyecto de ensayo | La barra muestra sábado 10 de octubre de 2026 / el parámetro se ignora |
| A-25 | Botón Atrás del teléfono desde «Voluntarios» | Vuelve a «Más»; no sale de la app |
| A-26 | Nombre de biblioteca de 40 caracteres sin espacios, a 320 px | Sin desplazamiento horizontal |
| A-27 | Peticiones de red al abrir la app | Solo recursos del origen propio, Firebase/Google Auth y emuladores locales según contrato §8; navegaciones explícitas se registran aparte |
| A-28 | `scripts/inicializar.mjs` sobre base vacía y sobre base ya inicializada | Crea los cuatro documentos; la segunda vez no cambia nada y lo informa |
| A-29 | `scripts/revisar-repositorio.mjs` sobre una carpeta temporal creada por la prueba, con un archivo que contiene un número de 11 dígitos que empieza con `569` y sigue con `1`, y con otro que contiene `56900000012` | Falla; pasa. El archivo con el número no ficticio nunca se versiona |
| A-30 | Abrir en `localhost`, con `?ensayo=1` y sin parámetros | Usa el emulador, el proyecto de ensayo y el proyecto real; las dos primeras muestran su franja |
| A-31 | (manual) Entrar con Google en Chrome y en Samsung Internet de un teléfono Android real, y desde la app instalada | Entra en los tres casos. Anotar el resultado |

### Casos adicionales de la revisión 1.1

| ID | Situación | Resultado esperado |
|---|---|---|
| A-32 | La hora del teléfono cambia después de sincronizar | El reloj monotónico conserva la hora fiable |
| A-33 | Muestra tarda más de 4 s, vence a los 5 min o vuelve de suspensión | Se invalida y se bloquea lo temporal hasta resincronizar |
| A-34 | Dos teléfonos sincronizan la misma cuenta al mismo tiempo | Ninguno acepta una muestra cuyo ID no le pertenece |
| A-35 | Configuración real/ensayo ausente; localhost y 127.0.0.1 | No conecta por defecto a producción; emulador funciona sin credenciales reales |
| A-36 | Alta incierta y el documento fue creado por otra operación | No presenta éxito propio |
| A-37 | Salir de la cuenta o perder autorización | Cancela escuchas y borra datos de la sesión anterior |
| A-38 | Bloqueo de mantenimiento vigente | Reglas rechazan mutaciones de negocio, conservan lectura y sincronización |
| A-39 | Lectura de recuperación denegada o con red interrumpida | No afirma «No se guardó» ni repite automáticamente |
| A-40 | Intento de cambiar campos fuera de cada lista permitida | Denegado aunque se adjunte un operacionId válido |

## Carga y límites

- Lista de 200 voluntarios: la pantalla abre en menos de 1 segundo con el procesador reducido a un cuarto.
- Lecturas de una apertura de sesión, medidas con el contador de `datos.js`: anotarlas en el informe. Deben ser menos de 10 mientras no haya otros datos.

## Prueba de humo en el proyecto de ensayo (la ejecuta el dueño)

1. Desplegar reglas e índices.
2. Ejecutar `scripts/inicializar.mjs` con su correo.
3. Entrar desde un teléfono real, con `?ensayo=1` en la dirección: debe ver la app y la franja «ENSAYO».
4. Entrar con otra cuenta: debe ver «Tu cuenta no tiene acceso».
5. Agregar esa segunda cuenta como voluntaria y volver a entrar con ella.
6. Activar el modo avión y comprobar que los botones se deshabilitan.

## Lista de entrega

- [ ] La app corre en local con un solo comando, y otro comando corre todas las pruebas.
- [ ] Integración continua en verde.
- [ ] `firestore.rules` con negación por defecto.
- [ ] `README.md` con instrucciones para correr la app, las pruebas y los scripts.
- [ ] `informes/etapa-1.md` con salida de pruebas, lecturas medidas, pruebas manuales pendientes y lo que no está listo.
