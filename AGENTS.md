# Reglas del proyecto Biblioteca

## Lectura y autoridad

Leer `specs/00-contrato-operativo.md`, `specs/00-base.md`, la etapa asignada y `PROMPT-MAESTRO-CURSOR.md`. El prototipo solo orienta apariencia y textos; sus fechas, guardado local y datos no se reutilizan como lógica oficial. La revisión documental no acredita que las pruebas de aplicación estén hechas.

## Flujo

Cursor es el implementador recomendado; Codex realiza la contraprueba del SHA entregado en otra sesión. Estas instrucciones también aplican si Eduardo decide usar Codex para implementar. No escribir código antes de que Eduardo apruebe el plan, salvo autorización explícita vigente que ya lo cubra. No iniciar otra entrega por inferencia.

Una entrega por rama y un único PR. Las especificaciones siguen siendo siete documentos, pero se entregan agrupadas: los documentos de cada entrega se construyen juntos, con un plan, un informe y un PR.

| Entrega | Documentos | Rama |
|---|---|---|
| Base y acceso | `specs/01-base-y-acceso.md` | `etapa-1` (entregada) |
| Catálogo y lectores | `specs/02-catalogo-y-lectores.md` | `etapa-2` (entregada) |
| Préstamos | `specs/03-prestar-y-devolver.md` + `specs/04-atrasados-y-recordatorios.md` | `entrega-prestamos` |
| Juego y cierre | `specs/05-juego-de-temporadas.md` + `specs/06-estadisticas-y-cierre.md` | `entrega-juego` |
| QR (opcional) | `specs/07-etiquetas-qr-opcional.md` | solo si Eduardo la pide |

Una sola contraprueba externa por entrega. Se repite únicamente si un hallazgo viene calificado «antes de producción»; los menores se corrigen y se declaran en el informe, sin una segunda vuelta externa.

Antes de programar entregar plan, archivos y contradicciones. Si falta remoto o Firebase real, avanzar en planificación y, tras aprobar el plan, en desarrollo LOCAL. No pedir llaves ni inventar configuraciones. Si falta remoto, registrar el PR como pendiente y entregar commits locales.

Cada caso automatizable, incluidos los añadidos en revisión 1.1, lleva su ID en la prueba. Implementar solo después de demostrar la prueba que falla cuando corresponda. No saltar pruebas, fabricar salidas, afirmar PASS sin ejecución ni usar mocks como evidencia de reglas reales.

## Ambientes y datos

El agente solo ejecuta contra emuladores `demo-biblioteca`. Verificar ambos hosts de emulador antes de usar Admin SDK. No leer credenciales de producción, desplegar, cargar datos reales ni fusionar/empujar a main. El dueño realiza las acciones remotas con sus credenciales.

No versionar datos/, respaldos, exportaciones, teléfonos reales, nombres de lectores reales ni secretos. Validar el diff y el escáner antes de cada commit. No contactar números ficticios. Los enlaces WhatsApp solo se ensayan con el teléfono que Eduardo aporte expresamente.

## Entrega

El informe de cada entrega vive en `informes/` y cabe en una página. Seis apartados, sin relato: SHA entregado y versiones instaladas; tabla de casos con su identificador y su estado, más dónde está la salida de la ejecución; tiempos y lecturas medidas contra los límites del documento; accesos de reglas por operación e índices declarados; decisiones tomadas donde la especificación no alcanzaba; y lo pendiente para Eduardo, separando las pruebas manuales de lo que no está listo para producción. Lo que se construyó no se narra: está en el diff. Si un apartado no tiene contenido, dice «Nada».

El revisor recibe ese mismo SHA. No etiquetar lista para producción sin ensayo real de ese candidato.

En la revisión, el revisor no modifica la rama: describe hallazgo, reproducción, gravedad y criterio de corrección. La corrección vuelve al implementador y se contraprueba de nuevo.
