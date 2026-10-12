# Informe de la Etapa 2 — Catálogo y lectores

Revisión 1.1 · 12-10-2026 (America/Santiago) · rama `etapa-2`

**SHA entregado:** `4453fce`, el último commit de CÓDIGO de `etapa-2`, que trae
las correcciones de las dos revisiones. Esta línea y la sección 10 se actualizan
con cada ronda, así que lo que se ensaya es el último commit de la rama. Los
datos completos de la entrega están en la sección 10.

**Hubo contraprueba externa.** La hizo una sesión distinta sobre `f64b78f`, y su
informe está en `informes/contraprueba-etapa-2.md`. Corrió las seis suites en
otra máquina, revisó las zonas del encargo y entregó **tres hallazgos**: uno a
corregir antes de producción y dos menores. Los tres están corregidos en este
SHA, con prueba automatizada cada uno. La sección 2.4 los detalla junto a los
quince que encontró la revisión del diff antes de esa contraprueba.

**Lo que la contraprueba confirmó sin hallazgos**, y que es tan importante como
lo que encontró: el enlace bidireccional del contador —no halló ninguna
secuencia que cree dos lectores con la misma clave, ni un lector sin clave, ni
un contador subido sin lector—, la identidad de la operación en el reintento, el
cálculo de cuatro préstamos del fixture hecho a mano, los bordes del cambio de
hora, la cuenta de 10 accesos verificada a mano, la cobertura real de los 43
casos y que no hay nada de las etapas 3 a 7 adelantado.

**Estado: los 43 casos del documento están escritos y ejecutados, y pasan.** No
queda ninguno pendiente de automatizar, y los dieciocho hallazgos de las dos
revisiones están corregidos. Lo que queda es del dueño: la prueba de
humo en el proyecto de ensayo (sección 6) y la carga de los datos reales.

**Un límite del documento NO se cumple, y conviene leerlo antes de nada:** abrir
el catálogo con 5.000 libros tarda 5,2 segundos, no menos de 1. La sección 3 lo
mide, lo desarma y explica por qué no es algo que se arregle afinando código.
Para el tamaño real de la biblioteca —150 libros y 100 lectores— sí se cumple,
con 736 ms.

## 1. Qué se construyó

- **Funciones puras** (`docs/js/texto.js`, `listas.js`, `fechas.js`). La clave de
  un nombre, el nombre válido, el teléfono chileno, el código y su sugerencia, la
  búsqueda sin tildes, el orden de los códigos, los filtros y las tandas de 40
  filas. En `fechas.js`, lo que la carga necesita para convertir una fecha del
  Excel en un instante: el mediodía y el fin de un día en Chile, el día de la
  semana y si una fecha existe en el calendario.
- **Reglas de seguridad** de `libros`, `lectores`, `lectoresClave` y
  `config/contadores`, con el enlace bidireccional del contrato §3 hecho con
  `getAfter`. Un alta de lector escribe tres documentos y las reglas exigen las
  tres cosas juntas: el lector, su clave apuntándolo y el contador subiendo
  exactamente hasta el número de su identificador.
- **Operaciones** (`docs/js/operaciones.js`): inscribir lector, cambiar teléfono,
  cambiar nombre, agregar libro, editar libro y dar de baja. Cada una con la
  forma de guardar de la Etapa 1 —transacción, botón bloqueado, éxito solo con
  respuesta del servidor, comprobación por identidad si el resultado queda
  incierto— y el alta con su propio reintento, que la sección 2.4 explica.
- **Pantallas**: Catálogo con buscador, fichas de categoría, selector de estado,
  40 filas y «Mostrar más»; ficha de libro; agregar y editar libro; Lectores
  dentro de «Más»; ficha de lector; inscribir lector con su casilla obligatoria;
  cambiar teléfono y cambiar nombre. Vuelve `ui/hoja.js`, ahora con uso real y
  con sus pruebas de foco y de botón Atrás. Nuevo `ui/campos.js` con los campos
  de formulario, que ya no se escriben dos veces.
- **Scripts del dueño**: `cargar-datos.mjs` con simulación, carga y reemplazo;
  `respaldar.mjs` con mantenimiento, SHA-256 y verificación completa;
  `restaurar.mjs` con comparación documento por documento y manifiesto
  reanudable. Debajo, `scripts/comun/` con el destino, el bloqueo de
  mantenimiento, el manifiesto, el recorrido de la biblioteca y la serialización
  canónica.
- **Pruebas**: 143 de unidad, 72 de reglas, 25 de scripts, 81 de extremo a
  extremo y 6 de carga.

## 2. Casos de prueba

### 2.1 Estado caso por caso

| ID | Qué exige | Dónde se prueba | Estado |
|---|---|---|---|
| C-01 | Voluntario no crea ni edita un libro | `reglas/libros`, `e2e/catalogo` | **Pasa** |
| C-02 | Código repetido avisa y no cambia el existente | `e2e/catalogo` | **Pasa** |
| C-03 | `inf 028` se guarda `INF028` | `unidad/lectores-y-libros`, `e2e/catalogo` | **Pasa** |
| C-04 | Código sugerido: `INF028`, `INF1000`, con huecos | `unidad/lectores-y-libros`, `unidad/listas`, `e2e/catalogo` | **Pasa** |
| C-05 | Título de 1 o de 121 caracteres, rechazado | `reglas/libros`, `e2e/catalogo` | **Pasa** |
| C-06 | Título con etiqueta HTML se muestra como texto | `reglas/libros`, `e2e/catalogo` | **Pasa** |
| C-07 | Editar no mueve `prestamoAbierto` ni `vecesPrestado` | `reglas/libros`, `e2e/catalogo` | **Pasa** |
| C-08 | Nadie borra un libro ni un lector | `reglas/libros`, `reglas/lectores` | **Pasa** |
| C-09 | «  rafaela   TOLEDO » cuando existe «Rafaela Toledo» | `unidad`, `reglas/lectores`, `e2e/lectores` | **Pasa** |
| C-10 | Ancho cero o `ı` que imitan un nombre | `unidad`, `e2e/lectores` | **Pasa** |
| C-11 | `...`, `a b`, solo espacios | `unidad`, `reglas/lectores`, `e2e/lectores` | **Pasa** |
| C-12 | Nombre de una sola palabra | `unidad`, `e2e/lectores` | **Pasa** |
| C-13 | 60 caracteres sí, 61 no | `unidad`, `reglas/lectores`, `e2e/lectores` | **Pasa** |
| C-14 | «Peña» con «Pena» existente | `unidad`, `reglas/lectores`, `e2e/lectores` | **Pasa** |
| C-15 | Tres formas de escribir un celular | `unidad`, `e2e/lectores` | **Pasa** |
| C-16 | Teléfonos inválidos, error visible | `unidad`, `reglas/lectores`, `e2e/lectores` | **Pasa** |
| C-17 | Teléfono vacío deja nulo | `unidad`, `e2e/lectores` | **Pasa** |
| C-18 | Sin marcar la casilla no se guarda | `reglas/lectores`, `e2e/lectores` | **Pasa** |
| C-19 | Dos teléfonos, el mismo nombre, a la vez | `e2e/concurrencia` | **Pasa** |
| C-20 | Cinco altas en paralelo | `e2e/concurrencia` | **Pasa** |
| C-21 | Lector sin clave, sin contador o saltándolo | `reglas/lectores` | **Pasa** |
| C-22 | Doble toque en «Inscribir» | `e2e/lectores` | **Pasa** |
| C-23 | Voluntario cambia teléfono, no el nombre | `reglas/lectores`, `e2e/lectores` | **Pasa** |
| C-24 | Administrador cambia el nombre; la clave antigua queda | `reglas/lectores`, `e2e/lectores` | **Pasa** |
| C-25 | Buscar «dios prodigo» e «inf 006» | `unidad/listas`, `e2e/catalogo` | **Pasa** |
| C-26 | Buscar `(.*[\` da lista vacía, sin error | `unidad/listas`, `e2e/catalogo` | **Pasa** |
| C-27 | Otro teléfono agrega un libro mientras escribo | `e2e/catalogo` | **Pasa** |
| C-28 | Simulación con el archivo ficticio | `unidad/carga`, `scripts/carga` | **Pasa** |
| C-29 | Dos préstamos abiertos, contadores por debajo | `unidad/carga` | **Pasa** |
| C-30 | `vence` que no es sábado, plazo de 15 sábados | `unidad/carga` | **Pasa** |
| C-31 | Carga real sobre colecciones con datos | `scripts/carga` | **Pasa** |
| C-32 | `--reemplazar` respalda y verifica antes | `scripts/carga` | **Pasa** |
| C-33 | Después de cargar: estado, cuenta y claves | `unidad/carga`, `scripts/carga` | **Pasa** |
| C-34 | Respaldar, vaciar y restaurar, idéntico | `scripts/respaldo` | **Pasa** |
| C-35 | Restaurar con datos, con y sin `--reemplazar` | `scripts/respaldo` | **Pasa** |
| C-36 | 60 letras de una palabra a 320 px | `e2e/catalogo` | **Pasa** |
| C-37 | Corregir una tilde y volver atrás | `reglas/lectores`, `e2e/lectores` | **Pasa** |
| C-38 | Subir el contador sin lector, o dos con un incremento | `reglas/lectores` | **Pasa** |
| C-39 | Reintento tras carrera conserva `operacionId` | `e2e/concurrencia` | **Pasa** |
| C-40 | Respaldo mientras otro teléfono escribe | `scripts/respaldo` | **Pasa** |
| C-41 | Fallo a mitad de importar o restaurar | `scripts/carga`, `scripts/respaldo` | **Pasa** |
| C-42 | Nombre, categoría o fecha imposible en la carga | `unidad/fechas`, `unidad/carga` | **Pasa** |
| C-43 | Redirigir una clave sin unión válida | `reglas/lectores`, `e2e/lectores` | **Pasa** |

### 2.2 Salida de la ejecución

Lo que sigue es la salida real de la última corrida completa sobre el commit
entregado, en este contenedor.

### npm run revisar
```
revisar-repositorio: sin hallazgos
```

### npm run prueba:unidad
```
# tests 143
# pass 143
# fail 0
```

### npm run prueba:reglas (firebase emulators:exec, demo-biblioteca)
```
# tests 72
# pass 72
# fail 0
```

### npm run prueba:scripts (firebase emulators:exec, demo-biblioteca)
```
# tests 25
# pass 25
# fail 0
```

### npm run prueba:e2e (Playwright, Chromium, contra el emulador)
```
81 passed (1.9m)
```

Antes de la primera corrida hace falta `npx playwright install chromium`. La
contraprueba lo encontró por el camino difícil: su primer `npm test` dio las
cuatro primeras suites en verde y dejó e2e y carga sin correr por falta del
binario. Ya está dicho en el README.

### npm run prueba:carga
```
[carga] sembrados 150 libros y 100 lectores (tamaño real)
[carga] Catálogo con 150 libros, procesador a 1/4: mediana 736 ms (mínimo 588, máximo 1608, medidas 588 · 736 · 1608)
[carga] contadores del catálogo real: {"documentosDelServidor":5,"eventosDeCache":0,"cambiosDeMetadatos":0,"documentosModificadosPorEscucha":150,"lecturasDeTransaccion":1,"reintentosDeTransaccion":0,"consultasVacias":0,"reconexiones":0,"lecturasDeReglasEstimadas":7}
[carga] Lectores con 100 lectores, procesador a 1/4: mediana 498 ms (mínimo 304, máximo 500, medidas 304 · 498 · 500)
[carga] sembrados 5000 libros y 3000 lectores
[carga] Catálogo con 5000 libros, procesador a 1/4: mediana 5225 ms (mínimo 5206, máximo 6158, medidas 5206 · 5225 · 6158)
[carga] eso es 1.04 ms por documento: la apertura crece con la colección
[carga] cada tecla en el buscador del catálogo: mediana 14 ms (mínimo 7, máximo 25)
[carga] Lectores con 3000 lectores, procesador a 1/4: mediana 2935 ms (mínimo 2496, máximo 3124)
[carga] cada tecla en el buscador de lectores: mediana 11 ms (mínimo 6, máximo 14)
[carga] lista de 202 voluntarios en frío, procesador a 1/4: mediana 580 ms (mínimo 437, máximo 794)
[carga] la misma lista con los documentos ya en el SDK: mediana 510 ms (mínimo 445, máximo 629)
6 passed (1.3m)
```

### 2.2.1 Las pruebas de navegador ahora sí corren aquí

En la Etapa 1 ninguna prueba de pantalla se pudo ejecutar en este contenedor: la
app baja el SDK de Firebase desde `www.gstatic.com` y esa red lo bloquea
(`CONNECT tunnel failed, response 403`). Se entregaron escritas, y en verde solo
en la integración continua.

Ahora corren en los dos lados. `tests/ayuda/navegador.mjs` comprueba UNA vez si
el host responde. Si responde, el navegador de prueba baja el SDK de ahí, como
en producción. Si no responde, recibe los MISMOS archivos de la MISMA versión
—12.19.0— desde `node_modules/firebase`, que es el paquete npm del mismo
proveedor y trae los mismos paquetes de navegador. La app no cambia: cambia de
dónde los baja el navegador de prueba, y la línea `[e2e] www.gstatic.com no
responde…` lo dice en la salida.

**Lo que ese respaldo NO prueba** es la descarga real desde gstatic, con su
latencia, su caché y su política de red. Eso lo cubre la prueba de humo del
dueño en un teléfono real, y sigue pendiente.

### 2.3 Qué encontraron las pruebas al construir

Esto es lo que falló mientras se construía, antes de las dos revisiones. No es
una lista de cosas que podrían pasar: es lo que falló de verdad y hubo que
arreglar.

1. **Un alta que pierde la carrera del contador termina en
   `permission-denied`, no en un aborto reintentable.** Esto es lo más
   importante que encontró esta etapa. Las reglas se evalúan al CONFIRMAR la
   transacción, y para entonces el contador que ese intento leyó ya no es el que
   está: la regla `ultimoLector == resource.data.ultimoLector + 1` deniega la
   escritura, y el SDK no reintenta una denegación. Medido con C-20: de cinco
   altas en paralelo, **una quedaba y cuatro recibían «Tu cuenta no tiene
   permiso»**, que además de falso es inútil para la persona.
   El arreglo: el alta distingue las dos causas mirando los datos, no
   adivinando. Si la clave ya está tomada, otra persona se quedó con el nombre y
   el mensaje es «Ya existe: (nombre)»; si sigue libre, lo que se movió fue el
   contador, y vuelve a intentarlo —hasta tres veces— con el MISMO
   `operacionId` y un contador recién leído. Con eso quedan cuatro de cinco, con
   identificadores consecutivos, y la que no queda dice «Inténtalo de nuevo» con
   el estado `carrera-perdida`, no «denegado».
   Es exactamente lo que el contrato §3 describe —«el ID final se obtiene del
   contador DENTRO de la transacción y puede cambiar entre intentos
   abortados»—, con una corrección: ese reintento hay que hacerlo en el cliente,
   porque Firestore no lo hace por uno cuando la causa es una regla.
2. **La hoja emergente no puede apilarse.** Al abrir el formulario de teléfono
   desde la ficha de un lector, con dos hojas vivas el botón Atrás dejaba
   entradas muertas de historial y el formulario tapaba la lista que lo abrió,
   de modo que el toque siguiente se quedaba esperando un elemento invisible.
   Ahora abrir una hoja REEMPLAZA la que estaba y solo la primera añade una
   entrada al historial: un Atrás devuelve siempre a la pantalla.
3. **Dos suposiciones mías sobre el calendario estaban equivocadas**, y las
   pruebas las corrigieron antes de que llegaran a la carga:
   - El día largo del año en Chile es el **sábado 4 de abril de 2026**, de 25
     horas, no el domingo 5. El reloj se mueve a las 00:00, así que la hora que
     sobra cae al final del día anterior. El domingo 6 de septiembre sí es el
     corto, de 23 horas, porque empieza a la 01:00.
   - Por eso el primer instante de un día **no se supone a las 00:00**: se busca
     por bisección entre dos mediodías. El 06-09-2026 esa medianoche no existe.
4. **El respaldo no se podía verificar dos veces.** Se toma con el
   mantenimiento puesto, así que el archivo guardaba el candado, y al releerlo
   más tarde —ya sin bloqueo— la comparación contra la base fallaba siempre por
   ese campo. Ahora el archivo guarda `config/control` con `bloqueo: null`, que
   además es lo que el contrato §6 pide para no trasladar un candado a otra
   base, y ese campo queda fuera de la comparación por escrito.
5. **Reponer sobre una base vacía era imposible.** `tomar` el mantenimiento
   exige el documento de control, y una base vacía no lo tiene. Ahora la
   restauración lo crea con el candado ya puesto, antes de escribir cualquier
   otra cosa: así la base no pasa ni un instante escribible y vacía.
6. **Reanudar un trabajo interrumpido también era imposible**: pedía un bloqueo
   nuevo, y el anterior seguía vigente a propósito. Ahora reusa el que quedó
   puesto, cuyo token está en el manifiesto, y comprueba además una huella del
   contenido para no mezclar dos cargas distintas.
7. **La prueba de carga de la Etapa 1 medía una sola vez**, y eso resultó
   optimista. Medida tres veces en frío, la mediana de abrir la lista de 202
   voluntarios oscila entre 580 y 1.098 ms según cuán cargado esté el
   contenedor: el límite de 1 segundo se cumple a veces y a veces no. La
   sección 3 lo desarma.
8. **Dos aserciones mías, no el código.** La clave de un nombre ELIMINA lo que
   no es letra, dígito o espacio, no lo reemplaza por un espacio: «Ana-María» y
   «AnaMaría» comparten clave y «Ana María» no. Y `INFO0281X` es un código
   válido según base §5: hasta 4 letras, 3 o 4 dígitos y una letra final.

### 2.4 Las dos revisiones del código, y lo que encontraron

Esta etapa pasó por dos miradas después de que las pruebas estuvieran en verde:
una revisión del diff completo hecha por el implementador —que NO es una
contraprueba, y así quedó dicho— y la contraprueba externa de otra sesión. La
primera encontró quince cosas; la segunda, tres. Las dieciocho están corregidas
en este SHA, y cada una dejó su prueba.

**Lo que encontró la revisión del diff.** Las cinco primeras podían perder o
corromper datos, y son las que más importan:

1. **Un carácter de control se convertía en «ñ».** La clave de un nombre
   protege la ñ con un carácter de control mientras quita los diacríticos, y
   ese carácter no se limpiaba antes: un nombre con un `\u0001` daba la misma
   clave que uno con ñ. Dos personas distintas colapsaban en un solo documento
   de clave, y las reglas no podían verlo porque solo comprueban la FORMA de la
   clave. Los controles ahora salen primero.
2. **Dos respaldos del mismo minuto se pisaban.** El nombre del archivo tenía
   precisión de minutos y se escribía sin comprobar si ya existía. El caso que
   importa es reintentar un `--reemplazar` que falló: el archivo pisado era la
   única copia de los datos que acababan de borrarse. Ahora el nombre lleva
   segundos y la escritura no sobrescribe nada: si el archivo existe, prueba
   `-2`, `-3`.
3. **Había un hueco escribible entre el respaldo y el borrado.** El respaldo
   previo de `--reemplazar` tomaba y soltaba su propio bloqueo, y recién
   entonces el reemplazo tomaba el suyo. En ese intervalo la app podía escribir,
   y esos documentos se borraban sin figurar en el respaldo verificado: justo la
   «copia incoherente mientras otra persona escribe» que el contrato §6
   prohíbe. Ahora el respaldo previo corre DENTRO del bloqueo de quien lo pide,
   con su token.
4. **La restauración soltaba el candado con una escritura directa**, sin
   comprobar el token, de modo que podía borrar el bloqueo de otro trabajo. Y si
   fallaba al cerrar el manifiesto justo después, el mensaje aseguraba que el
   mantenimiento seguía puesto cuando ya no lo estaba. Ahora el manifiesto se
   cierra antes y el candado se suelta con `liberar`, que comprueba el token.
5. **Un alta denegada de verdad decía «Inténtalo de nuevo».** El reintento del
   alta trataba cualquier `permission-denied` como carrera perdida, así que con
   el mantenimiento puesto o con una cuenta recién desactivada se gastaban tres
   transacciones y se invitaba a repetir algo que no podía funcionar. Ahora se
   distingue mirando el contador: si no se movió, no hubo carrera, y el mensaje
   es el que corresponde —incluido uno propio para el mantenimiento—.

Y las diez siguientes, por orden de lo que se nota:

6. **Un libro de baja no se podía reactivar.** La pantalla de confirmación
   prometía «Se puede volver a activar editándolo» y el formulario de edición no
   tenía la casilla: el libro quedaba atrapado fuera de «Disponibles» para
   siempre. Las reglas sí permitían el cambio; la pantalla no lo ofrecía.
7. **Las escrituras de esta etapa no anotaban su intención**, así que la
   recuperación tras recargar del contrato §3 —que la Etapa 1 construyó— nunca
   se enteraba de ellas. Ahora la anotan cuatro de las cinco. La quinta, el alta
   de un lector, NO la anota, y es deliberado: lo único que la localiza es su
   clave de nombre, y una clave es el nombre normalizado, que el contrato
   prohíbe guardar en `sessionStorage`. Esa asimetría queda declarada aquí y en
   el código.
8. **El catálogo repintaba sus filtros con cada evento de metadatos.** Escuchaba
   `config/app` por su cuenta, sin el filtro de «no cambió nada» que su otra
   escucha sí tenía: una pérdida de señal bastaba para soltar el foco de quien
   estaba filtrando y volver a preparar los cinco mil libros. Ahora la escucha
   es una sola, la de `main.js`, que avisa solo cuando las categorías de verdad
   cambian; y si la categoría filtrada desaparece de los ajustes, el filtro
   vuelve a «Todas» en vez de dejar una lista vacía sin explicación.
9. **Los seis colores del tejuelo eran hexadecimales fijos sin tema oscuro.**
   En un teléfono en modo oscuro, el catálogo mostraba seis manchas casi blancas
   —las únicas de la pantalla—, mientras el color de reserva, que sí usaba
   tokens, se adaptaba bien. Ahora son tokens con sus valores oscuros.
10. **Un `devuelto` que no fuera booleano se tragaba en silencio.** Un «si» de
    texto se convertía en falso, el préstamo quedaba abierto y el libro
    aparecía prestado para siempre. Los libros ya rechazaban una `baja` no
    booleana; los préstamos ahora también.
11. **Una fecha disparatada hacía caminar el calendario entero.** Un `vence`
    mal tecleado como `9999-10-17` pasaba la validación de formato y la cuenta
    de sábados recorría tres millones de días, en el paso que solo debía validar
    y no escribir nada. La cuenta ahora corta en el tope que le interesa a quien
    pregunta.
12. **Un catálogo vacío decía que la búsqueda no encontró nada.** Una biblioteca
    sin libros todavía no es una búsqueda sin resultados, y aconsejar «prueba
    con menos palabras» a quien no escribió nada no ayuda. La lista de lectores
    ya distinguía los dos vacíos; el catálogo no.
13. **La hoja emergente se apilaba.** Abrir el formulario de teléfono desde la
    ficha de un lector dejaba dos hojas vivas, entradas muertas de historial y
    un formulario tapando la lista que lo abrió. Ahora una hoja reemplaza a la
    anterior y solo la primera añade una entrada.
14. **`prepararLibros` calculaba un prefijo que nadie leía**: cinco mil
    expresiones regulares por evento de escucha para un campo que solo
    comprobaba su propia prueba. Fuera.
15. **Dos bucles de borrado podían girar para siempre** si un borrado no
    avanzaba, con el mantenimiento puesto. Ahora una pasada que no reduce la
    cuenta se detiene con un error que dice cuántos documentos quedan.

**Lo que encontró la contraprueba externa**, con su criterio de corrección
cumplido en los tres casos:

- **H-01, a corregir antes de producción.** La carga comparaba una huella del
  contenido antes de reanudar, y la restauración solo comparaba la RUTA del
  archivo. Sustituir el contenido de ese archivo por otro respaldo —mismo
  nombre— y reanudar dejaba una base híbrida: documentos del primer respaldo ya
  escritos, los del segundo pendientes. Ahora el manifiesto de la restauración
  guarda el SHA-256 del respaldo y lo compara. La prueba que lo fija está en
  `tests/scripts/respaldo.test.mjs`, y se comprobó que **falla sin la
  corrección y pasa con ella**.
- **H-02, menor.** El mismo hallazgo que el número 5 de la lista de arriba, que
  la revisión del diff había encontrado horas antes y ya estaba corregido. La
  contraprueba añadió un caso que faltaba: cuando la cuenta pierde el permiso,
  ni el contador se puede leer, y ahí también hay que devolver la denegación tal
  cual en vez de reetiquetarla como carrera.
- **H-03, menor, sobre este informe.** El «1,04 ms por documento» se presentaba
  como dato de la etapa sin anclarlo a la máquina. En la del revisor dio 0,67.
  La sección 3 ahora dice de dónde sale cada cifra y qué parte es del diseño.

**Y una cosa que la contraprueba señaló sin llamarla hallazgo**, con razón: una
prueba se llamaba «una hoja dentro de otra se cierra de a una con Atrás», y lo
que la hoja hace es reemplazar, no apilar. El nombre describía mal el
comportamiento. Cambiado.

**Lo que se revisó y se decidió NO cambiar**, para que quede dicho: el recorrido
de la biblioteca pregunta por subcolecciones documento por documento, y eso son
unas 11.000 llamadas extra en una base de 11.000 documentos. Es el precio de que
el respaldo no se pueda saltar una subcolección en silencio, que es lo que el
contrato §6 exige; el modelo de esta app no usa ninguna, pero el respaldo no
puede dar eso por supuesto. Para la biblioteca real —unos 250 documentos— son
250 llamadas que no se notan, y el volumen de 11.000 solo existe en la prueba de
carga, que no respalda.

### 2.5 Comprobaciones estáticas

`scripts/revisar-repositorio.mjs` pasa sin hallazgos sobre el commit entregado,
y **encontró algo real por el camino**: los textos de ayuda de los formularios
usaban «9 1234 5678» como ejemplo de celular, que puede ser el número de una
persona. Ahora los ejemplos usan el prefijo `5690000` de los fixtures, que no es
de nadie.

Y encontró algo peor, que es un error del escáner mismo: **no miraba los
archivos nuevos**. Listaba con `git ls-files`, que solo lista lo versionado, de
modo que un archivo recién escrito —el que está a punto de entrar al
repositorio, que es justo el que hay que revisar— se le escapaba. Por eso el
teléfono de ejemplo pasó el escáner en local y la integración continua lo
rechazó al commit siguiente, cuando el archivo ya estaba versionado: la corrida
29 de `etapa-2` (`2b556c6`) **falló**, y la 30 (`644f9c0`) pasó porque ese
commit traía el arreglo. Ahora el escáner lista también lo no versionado,
respetando `.gitignore`, y tiene dos pruebas nuevas: una con un archivo nuevo
sin versionar y otra que comprueba que `datos/` sigue fuera de su alcance.
`datos/` sigue fuera del repositorio, con los respaldos y los manifiestos que
generaron las pruebas y las corridas a mano. Ningún nombre ni teléfono real vive
en el código ni en la página publicada; los teléfonos de los fixtures empiezan
con `5690000`, un prefijo que **no** está acreditado como rango reservado y que
no se contacta (contrato §8).

## 3. Prueba de carga, medida y desarmada

El documento de la etapa pide medir con **5.000 libros y 3.000 lectores**, el
procesador reducido a un cuarto: abrir en menos de 1 segundo y responder a cada
tecla en menos de 100 milisegundos. Cada cosa se midió tres veces y se compara
la MEDIANA, porque una sola medida en un contenedor compartido se va al doble
sin que cambie nada del código.

| Qué | Mediana | Mínimo–máximo | Límite | ¿Se cumple? |
|---|---|---|---|---|
| Cada tecla, buscador de libros, 5.000 libros | 14 ms | 7–25 | 100 ms | **Sí**, con holgura |
| Cada tecla, buscador de lectores, 3.000 lectores | 11 ms | 6–14 | 100 ms | **Sí**, con holgura |
| Abrir Catálogo, 150 libros (tamaño real) | 736 ms | 588–1.608 | 1.000 ms | **Sí** en la mediana |
| Abrir Lectores, 100 lectores (tamaño real) | 498 ms | 304–500 | 1.000 ms | **Sí** |
| Abrir Catálogo, 5.000 libros | 5.225 ms | 5.206–6.158 | 1.000 ms | **No** |
| Abrir Lectores, 3.000 lectores | 2.935 ms | 2.496–3.124 | 1.000 ms | **No** |

Las mismas medidas en la máquina de la contraprueba, para que se vea cuánto
depende del host: Catálogo 150 → 407 ms; Lectores 100 → 166 ms; Catálogo 5.000 →
3.373 ms; Lectores 3.000 → 1.695 ms; tecla del catálogo → 9 ms; tecla de
lectores → 5 ms. Los veredictos no cambian.
| Abrir Voluntarios, 202 voluntarios, en frío | 580 ms | 437–794 | 1.000 ms | **A veces**; otra corrida dio 1.098 ms de mediana |
| La misma lista con los documentos ya en el SDK | 510 ms | 445–629 | — | referencia |

**El límite por tecla se cumple con holgura, y eso es lo que el diseño de esta
etapa compró.** El texto de cada libro se normaliza UNA vez al recibir la
colección, no en cada pulsación: preparar 5.000 libros cuesta unos 40 ms y
filtrarlos, 5 ms (medido en Node, sin freno). Si alguien moviera la
normalización al filtro, cada tecla pasaría de milisegundos a casi un segundo; hay
una prueba de unidad que vigila ese orden de magnitud.

**El límite de apertura no se cumple al volumen de la etapa, y no es algo que se
arregle afinando.** Abrir cuesta **1,04 ms por documento EN ESTE CONTENEDOR**,
proporcional al tamaño de la colección, porque la pantalla la lee en vivo.

Ese milisegundo no es una constante del diseño, y conviene no citarlo como tal:
la contraprueba midió lo mismo en otra máquina y le dio **0,67 ms por
documento**, con aperturas entre un 35 % y un 40 % más rápidas (Catálogo 5.000:
3.373 ms en vez de 5.225). Lo que sí es del diseño, y se reproduce en las dos
máquinas, es la FORMA: la apertura crece en proporción al número de documentos,
el límite por tecla se cumple con holgura y el de apertura a 5.000 no se cumple
en ninguna de las dos. El desglose, medido aquí:

- El emulador entrega esos 5.000 documentos al **Admin SDK en 330 ms**, sin
  reglas, sin navegador y sin freno.
- **Preparar** los 5.000 en el cliente son **40 ms** sin freno, unos 160 con el
  procesador a un cuarto.
- **Pintar** las filas no es el problema: la lista muestra 40, y pintar 202 filas
  completas cuesta unos 70 ms con el procesador frenado.
- El resto —unos 4,7 segundos— es el SDK del navegador armando 5.000
  instantáneas y el emulador evaluando la **regla de lectura documento por
  documento**, todo multiplicado por cuatro por el freno del procesador.

Lo mismo explica el caso de los 202 voluntarios: el tiempo se va en entregar y
procesar documentos, no en la pantalla. Por eso esa prueba ahora exige lo que la
app sí controla —con los documentos ya en el SDK, pintar 202 filas en menos de
un segundo— y anota el número en frío tal como sale.

**Qué significa para la biblioteca.** Con 150 libros y 100 lectores, abrir son
736 y 498 ms: dentro del límite. Base §12 dice que la paginación se evalúa
«sobre el tamaño real», y a ese tamaño no hace falta. **Pero el techo de este
diseño queda escrito aquí en grande:** leer el catálogo en vivo son tantas
lecturas como libros, y eso tiene dos consecuencias que importan antes de
ofrecerle esta app a una biblioteca más grande:

1. **Tiempo.** Por encima de unos 1.000 documentos, abrir pasa del segundo.
2. **Cuota.** Cada apertura del catálogo cuesta tantas lecturas como libros
   tenga. Con los 5.000 del ensayo son 5.000 lecturas por apertura: **diez
   aperturas al día** contra el límite gratuito de 50.000 lecturas diarias. Con
   los 150 reales son 150 por apertura, unas 330 aperturas diarias, que para una
   biblioteca con cinco voluntarios no se alcanza ni de lejos.

Para pasar de ahí hace falta otra versión, con consultas paginadas en vez de una
escucha de la colección completa. No está construida, y lo digo porque es el
límite del diseño, no un detalle de implementación.

## 4. Consultas a otros documentos en las reglas

El contrato §7 pone el techo en **10 accesos por operación y 20 por
transacción**, «sin depender de ahorro por caché». Hay dos cifras que conviene
no confundir, y aquí están las dos.

**La cuenta conservadora, que es la que se promete.** Cada `get()` y cada
`getAfter()` cuenta como un acceso, aunque repita documento:

| Operación | Accesos | De dónde salen |
|---|---|---|
| Leer cualquier colección | 1 | el propio voluntario |
| Sincronizar la hora | 1 | el propio voluntario |
| Alta o cambio de voluntario | 2 | voluntario + `config/control` |
| Cambio de `config/app` | 2 | voluntario + control |
| Alta o edición de libro | 2 | voluntario + control |
| Cambio de teléfono de un lector | 2 | voluntario + control |
| **Alta de lector (3 documentos, 1 transacción)** | **10** | ver abajo |
| Cambio de nombre de un lector | hasta 6 | 3 del lector + 3 de la clave nueva |

El alta de lector, desglosada por operación:

| Documento de la transacción | Accesos |
|---|---|
| `lectores/{id}` (crear) | 4 = voluntario + control + `getAfter(clave)` + `getAfter(contadores)` |
| `lectoresClave/{clave}` (crear) | 3 = voluntario + control + `getAfter(lector)` |
| `config/contadores` (subir) | 3 = voluntario + control + `getAfter(lector)` |

**10 por transacción contra el límite de 20, y 4 en la operación más cara contra
el límite de 10.** Es la cifra que el plan estimó, y se confirma.

**La cuenta medida, que es el margen real.** Está en
`tests/reglas/presupuesto.test.mjs`, y no es una estimación: construye un
instrumento —cada documento de clave que se crea consulta con `getAfter` a su
propio lector, que es un documento distinto— y busca dónde el emulador corta la
transacción. Lo que mide:

1. El techo son **20 documentos DISTINTOS** por transacción: 18 claves sueltas
   entran —18 lectores consultados más el voluntario y el control— y 19 no.
2. Un `getAfter` a un documento que la propia transacción **escribe** no cuesta
   nada: el alta añade tres —contadores, el lector y su clave— y el techo no se
   mueve ni un lugar.

De modo que el alta ocupa **2 de los 20** y deja 18 libres. No se promete esa
cifra: se mide para saber que la conservadora entra con holgura, y para que un
cambio futuro que gaste accesos de verdad se note en esa prueba.

### Índices

Ninguno compuesto en esta etapa, como dice el documento.
`firestore.indexes.json` sigue con el único índice declarado en la Etapa 1, que
es de la Etapa 3.

## 5. Telemetría, que no es facturación

Los contadores de `datos.js` son telemetría del cliente, no una factura
(contrato §8). Cada cosa se cuenta por separado y una escucha no vuelve a sumar
todos sus documentos en cada evento. Una apertura de Catálogo con los 150 libros
reales:

```
documentosDelServidor: 5          · documentos entregados por lectura puntual
documentosModificadosPorEscucha: 150 · los que CAMBIARON en la escucha
eventosDeCache: 0
cambiosDeMetadatos: 0
lecturasDeTransaccion: 1          · la muestra de hora
reintentosDeTransaccion: 0
consultasVacias: 0
reconexiones: 0
lecturasDeReglasEstimadas: 7      · estimación del cliente, no la factura
```

Las 150 lecturas de la colección son el costo real de abrir el catálogo, y la
sección 3 explica lo que eso significa para la cuota. `lecturasDeReglasEstimadas`
es una **estimación**: las reglas también se evalúan en las operaciones
denegadas, y eso no se ve desde el cliente. El panel del proyecto de ensayo es
el que manda, y contrastarlo es parte de la prueba de humo del dueño.

## 6. Pruebas manuales pendientes para el dueño

Ninguna de estas la puede hacer el agente, y ninguna está hecha.

1. **Prueba de humo en el proyecto de ensayo** (la lista del documento de la
   etapa): desplegar reglas e índices; cargar el archivo ficticio, primero en
   simulación y después de verdad; desde dos teléfonos reales, inscribir un
   lector en uno y verlo aparecer en el otro; inscribir el mismo nombre desde
   ambos casi a la vez, y comprobar que uno recibe «Ya existe…»; ejecutar un
   respaldo y comprobar que el archivo queda en `datos/`.
2. **La descarga real del SDK desde `www.gstatic.com`**, que en este contenedor
   está bloqueada (sección 2.2.1).
3. **A-31 de la Etapa 1**, el ensayo del enlace de WhatsApp con un teléfono que
   aporte el dueño, que sigue pendiente.
4. **La carga de los datos reales**, que según `PASOS-DEL-DUENO.md` se hace
   justo antes del primer sábado de uso, después de la Etapa 3.

## 7. Qué NO está preparado para producción, y por qué

- **Nada se ha probado en un proyecto real.** Todo corre contra
  `demo-biblioteca` en el emulador. El agente no despliega, no lee credenciales
  de producción y no fusiona a `main` (AGENTS.md).
- **La contraprueba revisó el SHA `f64b78f`, no este.** Sus tres hallazgos están
  corregidos aquí, y su propio informe lo pide expresamente: «tras corregir,
  contraprobar de nuevo el mismo SHA de corrección; no bastan afirmaciones
  documentales». Esa segunda pasada está pendiente, y es corta: son tres
  hallazgos con prueba cada uno.
- **El catálogo no escala más allá de unos mil documentos**, por tiempo y por
  cuota (sección 3).
- **Las reglas no comprueban dos cosas, a propósito y declarado en su
  cabecera:** que la `clave` corresponda al `nombre` —el lenguaje de reglas no
  reproduce la normalización Unicode, y base §5 lo deja explícitamente al
  cliente— y que la `categoria` de un libro sea una de `config/app.categorias`,
  porque las reglas no pueden recorrer una lista de mapas. Lo segundo lo validan
  el cliente y el script de carga, que rechaza una categoría inexistente antes
  de escribir.
- **`prestamos` se escribe en la carga y no tiene reglas de cliente hasta la
  Etapa 3.** Admin SDK no pasa por reglas, así que la carga funciona y el
  cliente no los puede leer, que es justo lo que esta etapa quiere.
- **Un alta de lector puede fallar bajo contención** y pedir que se intente de
  nuevo. Con tres intentos, cuatro de cinco altas simultáneas quedan; cinco
  voluntarios inscribiendo a la vez es un escenario que la biblioteca real no va
  a tener, pero el comportamiento está medido y el mensaje es honesto.
- **La restauración integral repone también voluntarios y configuración.** Es lo
  que el contrato §6 pide, y conviene saberlo: restaurar un respaldo viejo
  devuelve la lista de voluntarios de ese día.

## 8. Qué debe desplegar o configurar el dueño, paso a paso

1. **Crear los dos proyectos de Firebase** y entregar sus dos bloques de
   configuración web, que siguen en `null` en `config-publica.js`. Sin eso la
   app muestra «Falta configurar este ambiente» y no abre conexiones, que es el
   comportamiento correcto y está probado.
2. **Cambiar la rama por omisión a `main`** en Ajustes → General del
   repositorio. Sigue pendiente desde la Etapa 1: el proxy de esta sesión no
   permite escribir ajustes del repositorio.
3. **Desplegar reglas e índices en ensayo**:
   `firebase deploy --only firestore:rules,firestore:indexes --project <ensayo>`.
4. **Preparar `datos/carga.json`** con el Excel depurado, en el formato de la
   sección «Carga inicial» del documento de la etapa, y correr primero
   `node scripts/cargar-datos.mjs --archivo datos/carga.json --simular`.
5. **Cargar de verdad** con `--cargar`. Si hubiera que repetirlo,
   `--reemplazar` respalda y verifica antes de borrar nada.
6. **Respaldar después de cada sábado** con `node scripts/respaldar.mjs`, y
   guardar una copia fuera del computador. El plan gratuito no incluye respaldos
   automáticos.
7. **Si un trabajo se interrumpe**, el mantenimiento queda puesto a propósito:
   el mensaje de error trae el token y el manifiesto de `datos/` dice qué se
   alcanzó a escribir. Desde ahí se reanuda con `--reanudar`, o se repone un
   respaldo. Para soltar el bloqueo a mano, una vez comprobado que la base está
   íntegra:
   `node scripts/respaldar.mjs --liberar --token <el token del mensaje>`.

## 9. Lista de entrega del documento, comprobada

| Punto de la lista | Estado |
|---|---|
| Reglas de seguridad con sus pruebas, y consultas por operación anotadas | **Sí.** 72 pruebas de reglas; las consultas están en la sección 4, con la cuenta conservadora y la medida. |
| `texto.js` con pruebas de unidad de la clave, el nombre, el teléfono y el código sugerido | **Sí.** `tests/unidad/lectores-y-libros.test.mjs`, 22 pruebas. |
| Scripts de carga, respaldo y restauración con sus pruebas | **Sí.** 24 pruebas de scripts y 24 de unidad sobre la validación y la serialización. |

## 10. Datos de la entrega

| Dato | Valor |
|---|---|
| Rama | `etapa-2` |
| SHA entregado | `4453fce`, el último commit de código; encima solo va este informe |
| Commits de la etapa | `84c0e64` puras · `6e351fd` reglas · `33decf6` scripts · `2b556c6` pantallas y concurrencia · `644f9c0` informe · `d5a8e69` repaso del diff · `dcd9e5f` el escáner y los archivos nuevos · `f64b78f` encargo de contraprueba · `4453fce` las 18 correcciones |
| Corridas de integración continua | 26, 27, 28 y 30 en verde; la **29 falló** por el escáner (sección 2.5) y la 31 corre sobre el SHA entregado |
| Node | 22.22.0 (local) y 22 en la integración continua |
| npm | 10.9.4 |
| Java | OpenJDK 21.0.12.1 local; Temurin 21 en la integración continua |
| firebase-tools | 15.33.0 |
| Emulador de Firestore | cloud-firestore-emulator v1.22.0 |
| @firebase/rules-unit-testing | 5.0.2 |
| firebase (SDK en pruebas) | 12.19.0 |
| SDK que carga la app | 12.19.0, desde `www.gstatic.com`; en este contenedor, desde `node_modules/firebase` (sección 2.2.1) |
| firebase-admin | 14.5.0 |
| @playwright/test | 1.56.1 |
| Chromium | 141.0.7390.37 |
| Proyecto usado | `demo-biblioteca`, solo emulador |
| Pruebas ejecutadas | **327**: 143 unidad, 72 reglas, 25 scripts, 81 extremo a extremo, 6 carga |
| Pruebas en rojo | ninguna |
| Casos del documento cubiertos | **43 de 43**, todos automatizados y ejecutados |
| Límites del documento no cumplidos | abrir con 5.000 libros y 3.000 lectores (sección 3) |
| Datos personales versionados | ninguno; el escáner pasa sin hallazgos |
| Contraprueba independiente | **sí**, sobre `f64b78f`, en `informes/contraprueba-etapa-2.md`; tres hallazgos, los tres corregidos |
| Hallazgos de las dos revisiones | 18 en total: 15 de la revisión del diff y 3 de la contraprueba; todos corregidos con prueba |
| Pendiente de la contraprueba | la segunda pasada sobre el SHA de las correcciones |
