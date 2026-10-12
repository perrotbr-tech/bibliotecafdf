# Revisión de la especificación 1.1

Fecha: 11-10-2026, America/Santiago. Solicitud: «resuelve todo lo necesario. dime si ejecutamos en cursor o en codex».

## Resultado

Paquete corregido para planificar la Etapa 1 en Cursor y contraprobar el código en Codex. Las decisiones técnicas de esta revisión se aplicaron a la especificación; todavía no existe implementación de la app oficial, reglas ejecutadas ni aprobación de producción. Esta es una revisión realizada en esta sesión, no una contraprueba por un agente independiente.

## Insumos

Los tres ZIP adjuntos tienen el mismo SHA-256 original:
`e468bbfe43085ba3ef69bffe9029950db1a3bb52a1c8cadda8a69400d68e8e9a`.

Los tres prompts y el incluido en el ZIP son idénticos, SHA-256 original:
`019e5d2e6857f1f2aed64a1465447c9d6fa504c9d64e192175b4692b96ca25e4`.

Se actualiza el ZIP sin sufijo y el prompt sin sufijo como versión canónica. Las copias _1/_2 no se modifican y no deben usarse como base de implementación de esta revisión.

## Hallazgos y decisiones aplicadas

| Ref. | Hallazgo | Resolución documental |
|---|---|---|
| H-01 | Reloj de teléfono permitido cuando falla sincronización | Reloj nulo y bloqueo temporal; muestra identificada y avance monotónico |
| H-02 | Préstamos permitidos cualquier día | Solo sábados para flujo normal; validación de servidor con calendario de confianza |
| H-03 | Papel registrado después cambia fechas y temporada | salidaDia y registroDiferido administrativos con motivo y fechas reales |
| H-04 | Existencia de documento confundida con éxito de operación | Identidad de creación/mutación y resultado no atribuible explícito |
| H-05 | Generar ID antes de transacción contradice correlativo del lector | Separar operacionId estable de correlativo asignado al confirmar |
| H-06 | Contador N+1 no vincula por sí solo un único préstamo/lector | Punteros de último documento y comprobación bidireccional |
| H-07 | Booleano de devolución calculado antes de conocer request.time | Derivación posterior a timestamp confirmado; corrección administrativa auditada |
| H-08 | Cierre basado en listeners puede mezclar estados concurrentes | Bloqueo breve, lectura del servidor, corte único y commit protegido |
| H-09 | Fotografía de 50 entradas puede perder empatados/ganadores | Conserva hasta 600 lectores sin truncar; bloqueo explícito si excede presupuesto |
| H-10 | Unión con 8 documentos ignora autorización y control en reglas | Grupos de hasta 2, conteo completo, raíz única, alias y recuperación remota |
| H-11 | Respaldo legible con mismos conteos no garantiza integridad | Mantenimiento, esquema, timestamps exactos, hash y restauración comparada |
| H-12 | Prueba de humo previa al merge carecía de publicación del candidato | Destino de Pages separado, solo ensayo y SHA registrado |
| H-13 | Faltaban configuraciones reales para comenzar | Permitir planificación y desarrollo demo con configuraciones remotas nulas |
| H-14 | Contador de snapshots confundido con lecturas facturadas | Métricas separadas, docChanges, reglas y contraste en consola de ensayo |
| H-15 | Prefijo ficticio presentado como reservado | Convención de fixture; prohibir usarlo para contactar personas |
| H-16 | Lista de dominios omitía origen propio y navegación explícita | Distinguir recursos, Auth, WhatsApp y herramientas de desarrollo |
| H-17 | «Recordado» certificaba más de lo observado | «WhatsApp abierto»; enlace inmediato y persistencia independiente |
| H-18 | Parámetro de reloj E2E confundible con reloj de reglas | UI determinística separada de request.time; pruebas relativas de integración |
| H-19 | Datos de otra cuenta y archivos personales sin prueba de salida | Limpiar escuchas/memoria; no persistir datos de lectores en disco; revisar procedencia |
| H-20 | Cambios de inicioJuego podían ocultar temporadas cerradas | Congelar ese ajuste desde la primera fotografía |
| H-21 | Fórmulas TSV con blancos y QR asumido por navegador | Neutralizar tras limpieza y detectar capacidad real de qr_code |

## Alcance preservado

Sitio estático, módulos ES, GitHub Pages, Firestore, Google Auth, sin Cloud Functions. Puntos 15/10/5/0, pausa por atraso, medallas compartidas, altas de libros por administrador, sin renovación. Se conserva la aprobación del plan y de cada etapa. Las piezas nuevas atienden contradicciones de fechas y consistencia, no crean pantallas para lectores ni otro producto.

## Evidencia y estado

- Se leyeron base, etapas 1–7, pasos del dueño, prompt y referencia HTML/CSS.
- Se compararon bytes de los adjuntos y del prompt interno.
- Se revisaron fuentes primarias; los límites y pendientes se documentan en FUENTES-VERIFICADAS.md.
- Se agregaron casos adversos con identificadores de cada etapa; son requisitos de prueba, no pruebas ejecutadas.
- La validación mecánica del paquete se informa en validacion-paquete.json. Comprueba archivos, referencias, unicidad de casos y fixture; no ejecuta Firebase ni la app.

## Pendiente antes de aprobar Etapa 1

Plan adaptado al computador, implementación, pruebas automatizadas, contraprueba del SHA, proyectos y publicación de ensayo, pruebas reales de acceso. No se crearon repositorios ni recursos Firebase desde esta sesión. El entorno de revisión tiene Git, Node y Java, pero no gh ni Firebase CLI preinstalados; no se infiere de ello el estado del computador de Eduardo.
