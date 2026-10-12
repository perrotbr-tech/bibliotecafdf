# Encargo de contraprueba — Etapa 2

Para pegar en una sesión NUEVA de Cursor, sobre un clon limpio del repositorio.
No la hace quien escribió el código: eso es justamente lo que falta.

---

## Comando para pegar

> Eres el revisor de la Etapa 2 de este repositorio. No eres el implementador:
> **no modificas la rama**. Tu trabajo es describir hallazgos, con su
> reproducción, su gravedad y el criterio de corrección, para que el
> implementador los arregle y se vuelva a contraprobar (AGENTS.md).
>
> 1. Lee `AGENTS.md`, `specs/00-contrato-operativo.md`, `specs/00-base.md`,
>    `specs/02-catalogo-y-lectores.md` y `PROMPT-MAESTRO-CURSOR.md`.
> 2. Ponte en el SHA exacto que entrega el informe: `informes/etapa-2.md`,
>    primera línea. No revises la punta de la rama si no coincide.
> 3. Instala y corre TODO, sin saltarte nada:
>    `npm ci && npm test`. Anota los números que salgan y compáralos con los
>    que declara el informe en su sección 2.2. Si una suite no corre en tu
>    máquina, dilo: no la des por buena.
> 4. Revisa el diff de la etapa contra la Etapa 1:
>    `git diff etapa-1...etapa-2`.
> 5. Entrega un informe con una tabla de hallazgos: archivo y línea, qué está
>    mal, cómo reproducirlo, gravedad (impide fusionar / corregir antes de
>    producción / menor) y qué criterio usarías para considerarlo corregido.
>    Si no encuentras nada en un punto, dilo explícitamente: «revisado, sin
>    hallazgos» vale más que el silencio.

---

## Los tres lugares donde más puede haber un error

Esto no es para que mires solo ahí. Es para que empieces por ahí, porque es
donde el implementador tuvo que decidir cosas que la especificación no resolvía.

### 1. El enlace bidireccional del contador, y su reintento

`docs/js/operaciones.js` (`inscribirLector`, `unIntentoDeAlta`) y las reglas de
`config/contadores` y `lectores` en `firestore.rules`.

El implementador descubrió que un alta que pierde la carrera del contador
termina en `permission-denied` y no en un aborto reintentable, y lo resolvió
reintentando en el cliente hasta tres veces, distinguiendo «la clave está
tomada» (conflicto real) de «el contador se movió» (carrera).

Qué mirar con desconfianza:

- ¿Puede ese reintento crear **dos** lectores con la misma clave, o dos con el
  mismo identificador, en alguna secuencia de carreras? Las reglas deberían
  impedirlo; comprueba que de verdad lo impiden y no solo que las pruebas pasan.
- ¿Puede quedar un lector **sin** su documento de clave, o un contador subido
  sin lector? Es lo que C-21 y C-38 prueban: busca un camino que esas pruebas no
  cubran.
- Un `permission-denied` **real** —un voluntario desactivado a mitad de la
  operación— ¿termina diciendo «Inténtalo de nuevo» cuando debería decir otra
  cosa? ¿Importa?
- El `operacionId` tiene que sobrevivir al reintento y el `creacionId` del
  documento tiene que ser ese mismo. Si no, la comprobación por identidad del
  contrato §3 no sirve.

### 2. Los scripts del dueño, que tocan datos reales

`scripts/respaldar.mjs`, `scripts/restaurar.mjs`, `scripts/cargar-datos.mjs` y
`scripts/comun/`.

Son los únicos que van a correr contra la base de verdad, y un error ahí no se
nota hasta que hace falta el respaldo.

Qué mirar con desconfianza:

- **El respaldo guarda `config/control` con `bloqueo: null` y ese campo queda
  fuera de la comparación documento por documento.** ¿Esconde eso alguna
  diferencia que sí importe? ¿Hay otro campo que debería quedar fuera, o alguno
  que quedó fuera sin decirlo?
- **Reanudar reusa el bloqueo que quedó puesto**, cuyo token está en el
  manifiesto de `datos/`. ¿Puede alguien reanudar con un manifiesto de otra
  base, o de otro archivo? Hay una huella del contenido: comprueba que de
  verdad cierra ese camino.
- **El reemplazo borra las colecciones de negocio.** ¿Preserva voluntarios,
  configuración, calendario y fotografías, como exige el contrato §6? ¿Qué pasa
  si el borrado falla a mitad?
- La carga calcula `prestamoAbierto`, `vecesPrestado`, `venceEl`, `temporada` y
  `devueltoATiempo` desde el archivo. Toma el fixture
  `tests/fixtures/carga-ficticia.json`, elige tres préstamos a mano —uno
  abierto, uno devuelto con fecha y uno devuelto sin fecha— y **calcula a mano**
  lo que debería quedar escrito. Compáralo con lo que escribe el script.
- Las fechas se calculan con `Intl` en `America/Santiago`. Comprueba los bordes
  del cambio de hora: 04 y 05 de abril, 05 y 06 de septiembre de 2026. El
  implementador se equivocó una vez ahí y lo dejó anotado; comprueba que la
  corrección es correcta y no solo distinta.

### 3. La hoja emergente y lo que la pantalla promete no borrar

`docs/js/ui/hoja.js`, `docs/js/vistas/catalogo.js` y `docs/js/vistas/lectores.js`.

Qué mirar con desconfianza:

- La hoja **reemplaza** a la anterior en vez de apilarse, y solo la primera
  añade una entrada al historial. ¿Deja eso alguna entrada muerta, algún Atrás
  que no haga nada, o alguna hoja que se cierre sin devolver el foco?
- Las pantallas prometen que un cambio hecho en otro teléfono **no borra lo que
  la persona está escribiendo** (C-27). Busca un camino en que sí lo borre: por
  ejemplo, un cambio en `config/app` mientras alguien escribe en el buscador, o
  una pérdida de conexión con un formulario a medio llenar.
- El filtro no construye ninguna expresión regular con lo que escribe una
  persona (C-26). Comprueba que no quedó ninguna, en ningún camino.

---

## Lo que el informe declara y hay que verificar, no dar por bueno

| Lo que dice el informe | Cómo comprobarlo |
|---|---|
| Los 43 casos están cubiertos y pasan | Corre `npm test` y cuenta. Si un caso tiene su ID en el nombre de la prueba pero la prueba no comprueba lo que el caso pide, es un hallazgo. |
| El alta de lector gasta 10 accesos de reglas por transacción (cuenta conservadora) y 4 en su operación más cara | Cuenta a mano los `get()` y `getAfter()` de cada rama de `firestore.rules`. La prueba `tests/reglas/presupuesto.test.mjs` mide otra cosa: el techo efectivo. Las dos cifras deben seguir siendo verdad. |
| Abrir el catálogo cuesta 1,04 ms por documento | Corre `npm run prueba:carga` en tu máquina y compara. Si te da muy distinto, el informe debería decirlo. |
| Las reglas no comprueban que la clave corresponda al nombre, ni que la categoría exista | Son límites declarados. Comprueba que están declarados **donde se usan** y que el cliente sí los valida. |
| Las pruebas de navegador corren con el SDK servido desde `node_modules/firebase` cuando `gstatic` está bloqueado | En tu máquina `gstatic` probablemente responde, así que deberías ver la otra línea: `[e2e] el SDK se baja de www.gstatic.com`. Si no la ves, el respaldo se está activando cuando no corresponde. |

## Lo que NO tienes que revisar

- Préstamos, devoluciones, el calendario operativo, el juego de temporadas y la
  unión de lectores: son de las etapas 3 a 7 y no deben estar implementados. Si
  encuentras algo de eso escrito, **ese** es el hallazgo.
- La paginación del catálogo: el plan declara que no se construye (D-6).

## Al terminar

Entrega tu informe como un archivo aparte —no toques `informes/etapa-2.md`— y
deja claro en la primera línea el SHA que revisaste. Si tu informe no encuentra
nada, dilo igual: la etapa necesita constancia de que alguien que no la escribió
la miró.
