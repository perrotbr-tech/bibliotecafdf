# Reglas del proyecto Biblioteca

## Lectura y autoridad

Leer `specs/00-contrato-operativo.md`, `specs/00-base.md`, la etapa asignada y `PROMPT-MAESTRO-CURSOR.md`. El prototipo solo orienta apariencia y textos; sus fechas, guardado local y datos no se reutilizan como lógica oficial. La revisión documental no acredita que las pruebas de aplicación estén hechas.

## Flujo

Cursor es el implementador recomendado; Codex realiza la contraprueba del SHA entregado en otra sesión. Estas instrucciones también aplican si Eduardo decide usar Codex para implementar. Una etapa por rama y un único PR. No escribir código de una etapa antes de que Eduardo apruebe su plan, salvo autorización explícita vigente que ya lo cubra. No iniciar otra etapa por inferencia.

Antes de programar entregar plan, archivos y contradicciones. Si falta remoto o Firebase real, avanzar en planificación y, tras aprobar el plan, en desarrollo LOCAL. No pedir llaves ni inventar configuraciones. Si falta remoto, registrar el PR como pendiente y entregar commits locales.

Cada caso automatizable, incluidos los añadidos en revisión 1.1, lleva su ID en la prueba. Implementar solo después de demostrar la prueba que falla cuando corresponda. No saltar pruebas, fabricar salidas, afirmar PASS sin ejecución ni usar mocks como evidencia de reglas reales.

## Ambientes y datos

El agente solo ejecuta contra emuladores `demo-biblioteca`. Verificar ambos hosts de emulador antes de usar Admin SDK. No leer credenciales de producción, desplegar, cargar datos reales ni fusionar/empujar a main. El dueño realiza las acciones remotas con sus credenciales.

No versionar datos/, respaldos, exportaciones, teléfonos reales, nombres de lectores reales ni secretos. Validar el diff y el escáner antes de cada commit. No contactar números ficticios. Los enlaces WhatsApp solo se ensayan con el teléfono que Eduardo aporte expresamente.

## Entrega

`informes/etapa-N.md` usa los ocho apartados del prompt maestro. Añadir SHA, versiones instaladas, pruebas realmente ejecutadas, conteo de accesos de reglas, telemetría diferenciada de facturación, límites y pendientes manuales. El revisor recibe ese mismo SHA. No etiquetar lista para producción sin ensayo real de ese candidato.

En la revisión, el revisor no modifica la rama: describe hallazgo, reproducción, gravedad y criterio de corrección. La corrección vuelve al implementador y se contraprueba de nuevo.
