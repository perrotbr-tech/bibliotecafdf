# Biblioteca — especificación 1.1 lista para planificar

Paquete revisado el 11-10-2026 para construir por etapas. Empezar por LEEME-ARRANQUE-BIBLIOTECA.md. Este ZIP no contiene una aplicación oficial implementada ni acredita pruebas E2E aprobadas.

## Qué hay aquí

| Archivo | Para qué sirve |
|---|---|
| `AGENTS.md` | Reglas comunes para Cursor y Codex |
| `specs/00-contrato-operativo.md` | Correcciones de hora, sábados, concurrencia, respaldo y cierre |
| `LEEME-ARRANQUE-BIBLIOTECA.md` | Decisión de herramientas, plan de Etapa 1 y comando para empezar |
| `informes/revision-especificacion-1.1.md` | Hallazgos, decisiones y límites de esta revisión |
| `FUENTES-VERIFICADAS.md` | Fuentes oficiales consultadas y pendientes reales |
| `PROMPT-MAESTRO-CURSOR.md` | Los textos que se pegan en Cursor: reglas de trabajo, arranque de cada etapa y corrección tras una revisión |
| `PASOS-DEL-DUENO.md` | Las decisiones y los pasos que le tocan al dueño antes y después de cada etapa |
| `specs/00-base.md` | Lo común a todas las etapas: principios, tecnología, modelo de datos, forma de guardar y definición de terminado |
| `specs/01-base-y-acceso.md` | Etapa 1: repositorio, forma de guardar y entrada con lista de voluntarios |
| `specs/02-catalogo-y-lectores.md` | Etapa 2: libros, lectores, carga inicial de datos y respaldo |
| `specs/03-prestar-y-devolver.md` | Etapa 3: jornada del sábado, préstamos y devoluciones sin duplicados |
| `specs/04-atrasados-y-recordatorios.md` | Etapa 4: recordatorios por WhatsApp |
| `specs/05-juego-de-temporadas.md` | Etapa 5: puntos, medallas, podio y cierre de temporada |
| `specs/06-estadisticas-y-cierre.md` | Etapa 6: estadísticas, copia para Excel, unión de lectores y revisión final |
| `specs/07-etiquetas-qr-opcional.md` | Etapa 7, opcional: etiquetas QR y escaneo con la cámara |
| `referencia/prototipo.html` | Prototipo navegable: referencia visual y de textos |
| `tests/fixtures/carga-ficticia.json` | Datos de prueba en el formato de carga |
| `.gitignore` | Excluye la carpeta `datos/` y las llaves |

## Cómo se usa

1. El dueño toma las decisiones y hace los pasos previos de `PASOS-DEL-DUENO.md`.
2. Pega en Cursor el prompt maestro y luego el arranque de la Etapa 1.
3. Cursor propone su plan, el dueño lo confirma, Cursor construye y entrega una solicitud de cambios con su informe.
4. La solicitud pasa por una contraprueba externa y por una prueba de humo en el proyecto de ensayo. Recién entonces se fusiona y se autoriza la etapa siguiente.

## Datos personales

Este repositorio es público. Los nombres, teléfonos y préstamos reales viven solo en la base de datos y en la carpeta `datos/` del computador del dueño, que no se versiona.

El prototipo y los datos de prueba de este paquete son inventados: los lectores, sus teléfonos y sus préstamos se generaron al azar. Solo el catálogo usa títulos y autores de libros publicados. Los teléfonos de prueba empiezan con `5690000` por convención del proyecto. No se ha acreditado que sea un rango reservado: no contactar esos números; el ensayo de WhatsApp usa solo el número de prueba aportado por el dueño.
