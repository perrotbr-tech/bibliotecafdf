# Etapa 6 — Estadísticas, herramientas del administrador y cierre

> Revisión 1.1 · 11-10-2026. Leer también `specs/00-contrato-operativo.md`; define los detalles comunes y las correcciones de esta revisión.


## Objetivo

Completar lo que el administrador necesita para mantener la biblioteca ordenada, sacar los datos a Excel y dejar la app revisada para uso real.

## Entrega demostrable

El administrador une dos fichas de un mismo lector después de ver un resumen y confirmarlo. Copia la tabla de préstamos y la pega en una planilla con cada dato en su columna. La app pasa una revisión de accesibilidad y una prueba de carga, y el informe final declara qué no está listo.

## Alcance

1. Pantalla **Estadísticas**.
2. **Copiar para Excel**.
3. **Unir lectores** (administrador).
4. **Ajustes** (administrador).
5. Revisión de accesibilidad, instalación en Android y prueba de carga final.

## Qué cambia de etapas anteriores

- **Ficha del lector.** Para el administrador agrega «Unir con otro lector» y, si hay una unión sin terminar, el aviso con «Continuar».
- **«Más».** Agrega Estadísticas, Copiar para Excel y Ajustes.
- **Reglas de seguridad** de `lectores`, `lectoresClave` y `prestamos`: se agregan los cambios que esta etapa describe para la unión.

## Fuera del alcance de esta etapa

Deshacer una unión de lectores. Detección automática de lectores duplicados.

## Datos que toca

- `bibliotecas/{bib}/lectores/{id}`: al unir, el lector que desaparece queda con `fusionadoEn` apuntando al que se conserva. No se borra.
- `bibliotecas/{bib}/lectoresClave/{clave}`: la clave del lector unido pasa a apuntar al que se conserva.
- `bibliotecas/{bib}/prestamos`: en los préstamos del lector unido cambia `lector` y los metadatos de operación; ningún otro campo de negocio. Se buscan con la consulta `lector == …`.
- `bibliotecas/{bib}/config/app`: `nombreBiblioteca` (1 a 40 caracteres), `plazoSabadosPorDefecto` (1 a 4) e `inicioJuego` (formato `AAAA-B`, con B de 1 a 6).

## Unir lectores

Unir B en A significa que A se conserva y B desaparece de las listas. Se hace en pasos, cada uno en su propia transacción, con grupos conservadores y conteo real de todas las reglas de autorización y control:

1. **Marca.** Una transacción pone `fusionadoEn: A` en B, hace que la clave de B apunte a A y, si A no tiene teléfono y B sí, lo copia a A. Desde este instante a B ya no se le puede prestar.
2. **Traslado.** La app consulta los préstamos con `lector == B` y los cambia a A en transacciones de hasta 2 préstamos, repitiendo la consulta hasta que no quede ninguno. La pantalla muestra el avance: «Movidos 40 de 57».
3. **Reanudación.** Si se interrumpe, B ya está marcado y la ficha de A muestra «Unión sin terminar: quedan N préstamos por mover», con el botón «Continuar».

Un lector con préstamos abiertos se puede unir: sus préstamos abiertos pasan a A.

## Reglas de seguridad

- Solo el administrador cambia el campo `lector` de un préstamo, y solo ese campo de negocio, además de los metadatos de operación, y solo desde un lector fusionado hacia el lector al que se fusionó.
- Solo el administrador pone `fusionadoEn`, y solo de nulo a una raíz existente no fusionada y distinta; el origen no puede tener esDestinoFusion verdadero. El receptor queda esDestinoFusion verdadero. Aplicar contrato §7.
- A un lector con `fusionadoEn` no se le puede prestar.
- Las temporadas cerradas no cambian con una unión: conservan los nombres con que se cerraron.
- `config/app`: solo el administrador; `nombreBiblioteca` de 1 a 40 caracteres, `plazoSabadosPorDefecto` de 1 a 4 e `inicioJuego` con formato `AAAA-B`.

## Pantallas y comportamiento

**Estadísticas.**
- Tres cifras: préstamos totales, lectores con al menos un préstamo y libros que nunca se han prestado.
- «Préstamos por mes»: una barra por cada uno de los últimos 18 meses. Bajo el gráfico se indica la suma de esas barras y el total histórico.
- «Nunca prestados»: libros con `vecesPrestado` en 0 y no dados de baja; lista de 40 con «Mostrar más».
- Las cifras que dependen del historial se cargan al abrir la pantalla, leyendo todos los préstamos una vez, con el aviso «Cargando historial». Los préstamos anulados no cuentan.

**Copiar para Excel.** Tres botones: Catálogo, Lectores y Préstamos. Cada uno copia una tabla separada por tabulaciones, con una fila de encabezados.

- Catálogo: código, título, autor, categoría, estado, veces prestado.
- Lectores: identificador, nombre, teléfono, préstamos, en curso.
- Préstamos: número, código, título, lector, fecha de préstamo, vencimiento, estado, fecha de devolución, a tiempo.
- Las fechas van como `AAAA-MM-DD`.
- Toda celda que empiece con `=`, `+`, `-` o `@` se antepone con un apóstrofo, para que la planilla no la tome como fórmula. Primero se eliminan controles, tabulaciones y saltos internos, y comillas iniciales; luego se verifica el primer carácter significativo tras espacios. Aplicar contrato §8 para no dejar fórmulas escondidas tras blancos.
- Si el navegador impide copiar, se abre una hoja con el texto seleccionable.

**Unir lectores** (administrador).
1. Desde la ficha de un lector: «Unir con otro lector». Se elige el otro.
2. Pantalla de confirmación con ambos lado a lado: nombre, teléfono, cantidad de préstamos y los últimos tres de cada uno. Se elige cuál se conserva.
3. Advertencia: «Los (N) préstamos de (nombre) pasarán a (nombre). Esta acción no se puede deshacer desde la app».
4. Botón «Unir», deshabilitado mientras trabaja, con el avance en pantalla.

**Ajustes** (administrador). Nombre de la biblioteca, plazo habitual e inicio del juego. Todo se guarda con un único botón «Guardar». `inicioJuego` no se puede cambiar después de existir una temporada cerrada; la restricción también se aplica en reglas. Si la validación falla, lo escrito se conserva.

## Revisión final

**Accesibilidad.**
- Toda la app se puede operar con teclado.
- Tras cada acción el foco queda donde corresponde: en el elemento que sigue, en el mensaje de error o de vuelta en el botón que abrió una hoja.
- Las hojas emergentes retienen el foco, y el contenido de fondo queda inerte.
- Contraste de texto de al menos 4,5:1 y de bordes de campos de al menos 3:1, en tema claro y oscuro. Adjuntar los valores medidos.
- Controles de al menos 44 × 44 px.
- La cantidad de atrasados en la barra inferior se anuncia como «Préstamos, 54 atrasados».
- Los cambios de resultados de búsqueda se anuncian a los lectores de pantalla.

**Instalación.** (manual) Android ofrece «Instalar app»; la app instalada abre a pantalla completa con su ícono y su nombre.

### Casos adicionales de la revisión 1.1

| ID | Situación | Resultado esperado |
|---|---|---|
| E-25 | Uniones simultáneas B→A y A→B | No se forma ciclo; solo una dirección queda válida |
| E-26 | Intentar fusionar la raíz que ya recibió lectores | Se rechaza ese sentido y se ofrece conservar la raíz |
| E-27 | Alias antiguo apunta a un lector ya unido | Resuelve la raíz; no permite crear otro lector bajo el alias |
| E-28 | Unión interrumpida y navegador cerrado | Una sesión nueva descubre y reanuda por consultas al servidor |
| E-29 | Puntaje/pausa durante traslado parcial | Se atribuye a raíz sin duplicar préstamos ni liberar una pausa antes de tiempo |
| E-30 | Cambiar inicioJuego tras una fotografía cerrada | Denegado; no oculta historial |
| E-31 | Fórmula precedida de espacios, tabulación o comillas | El TSV queda neutralizado y conserva nueve columnas |

## Carga y límites

Carga final, con 5.000 libros, 3.000 lectores, 600 préstamos abiertos y 20.000 devueltos en el emulador, y el procesador reducido a un cuarto:

| Operación | Límite |
|---|---|
| Abrir la app hasta ver Inicio | 3 segundos |
| Cambiar entre pantallas | 1 segundo |
| Cada tecla en cualquier buscador | 100 milisegundos |
| Abrir Estadísticas | 5 segundos, con el aviso «Cargando historial» |
| Copiar la tabla de préstamos completa | 5 segundos, con aviso de avance |
| Unir un lector con 60 préstamos | Termina en transacciones de hasta 2, mostrando el avance |

Además: lecturas y escrituras de un sábado de 40 movimientos con 3 teléfonos, comparadas con los límites diarios de 50.000 y 20.000; y cuántos sábados así caben en un día antes de alcanzarlos.

## Índices

Ninguno nuevo. `lector == …` usa un índice automático.

## Casos de prueba

| ID | Situación | Resultado esperado |
|---|---|---|
| E-01 | «Préstamos por mes» con datos de 30 meses | 18 barras; bajo el gráfico, la suma de esas barras y el total histórico |
| E-02 | «Nunca prestados» tras prestar uno de esos libros | El libro sale de la lista sin recargar |
| E-03 | Préstamo anulado | No cuenta en ninguna cifra |
| E-04 | Copiar Préstamos | Filas = préstamos + 1; todas las filas con 9 columnas |
| E-05 | Título `=HYPERLINK("http://x.example";"clic")`, nombre que empieza con `+` y nombre `"Comilla` | El texto copiado antepone apóstrofo y quita la comilla inicial; ninguna fila se une con otra |
| E-06 | Título con tabulación o salto de línea | La celda queda en una sola línea y la fila conserva sus columnas |
| E-07 | El portapapeles rechaza la copia | Hoja con el texto seleccionable |
| E-08 | (manual) Pegar en Excel la tabla de E-05 | Las celdas quedan como texto |
| E-09 | Voluntario intenta unir lectores o cambiar `lector` en un préstamo | Denegado |
| E-10 | Unir B en A | Los préstamos de B pasan a A; B queda con `fusionadoEn`; la clave de B apunta a A; nada se borra |
| E-11 | Unir un lector consigo mismo, o con uno ya fusionado | Denegado |
| E-12 | Administrador intenta cambiar `lector` de un préstamo hacia un lector cualquiera, sin unión | Denegado |
| E-13 | Prestar a un lector fusionado | Denegado; no aparece en el buscador de lectores |
| E-14 | Inscribir de nuevo el nombre de un lector fusionado | «Ya existe: (nombre del lector que se conservó)» |
| E-15 | Doble toque en «Unir» | Una sola unión |
| E-16 | La unión de un lector con 57 préstamos se interrumpe tras la primera transacción de traslado | B queda marcado; la ficha de A ofrece «Continuar»; al terminar no queda ningún préstamo en B |
| E-17 | Otro voluntario intenta prestar a B justo después de la marca | Falla con mensaje; nunca queda un préstamo nuevo en un lector fusionado |
| E-18 | Unir dos lectores con medalla en una temporada cerrada | La fotografía de esa temporada no cambia |
| E-19 | Unir un lector en pausa con uno que no lo está | El lector conservado queda en pausa, porque ahora debe ese libro |
| E-20 | Guardar Ajustes con nombre vacío o `inicioJuego` con formato inválido | Rechazado; el resto de lo escrito se conserva |
| E-21 | Recorrer Prestar y Devolver solo con teclado | Se completa; el foco nunca vuelve al inicio del documento |
| E-22 | Abrir y cerrar una hoja | El foco entra a la hoja, no sale de ella con Tab y vuelve al botón que la abrió |
| E-23 | Contraste de texto y de bordes de campos en ambos temas | 4,5:1 y 3:1 o más |
| E-24 | Todas las pantallas a 320 px con textos de una palabra de 60 letras | Sin desplazamiento horizontal |

## Prueba de humo en el proyecto de ensayo (la ejecuta el dueño)

1. Desplegar reglas.
2. Unir dos lectores ficticios, uno de ellos con 9 préstamos o más, y revisar que todos pasaron. Con más de 2 se prueba que el traslado continúa en varias transacciones; medir todas las consultas de reglas, no asumir una cifra por préstamo.
3. Copiar Préstamos y pegar en Excel.
4. Instalar la app en un teléfono Android y abrirla desde el ícono.
5. Ejecutar un respaldo y restaurarlo en el emulador.

## Informe final

Además del informe habitual de etapa, este cierra el proyecto e incluye:

- Tabla de tiempos de la carga final.
- Lecturas y escrituras medidas por jornada.
- Lista de lo que **no** está preparado para producción, con su motivo.
- Pasos de despliegue de reglas e índices para el dueño.
- Pasos de respaldo y de restauración, probados una vez en el emulador.

## Lista de entrega

- [ ] Todas las pruebas automatizables de las seis etapas en verde.
- [ ] `informes/etapa-6.md` con el informe final completo.
- [ ] `README.md` actualizado: cómo correr, probar, cargar datos, respaldar y restaurar.
