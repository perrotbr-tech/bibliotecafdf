# Fuentes oficiales y alcance de verificación

Consulta: 11-10-2026, hora de Chile. Las fuentes verifican capacidades de plataforma; no sustituyen pruebas de nuestra app. Sin afirmaciones de precios de Cursor/Codex ni garantía de saldo de cuentas.

| Tema | Fuente oficial | Resultado |
|---|---|---|
| Transacciones | https://firebase.google.com/docs/firestore/manage-data/transactions | Documenta reintentos, orden de lecturas/escrituras, fallo sin conexión y acceso al estado posterior con getAfter |
| Límites | https://firebase.google.com/docs/firestore/quotas | Documenta cuotas y límites de documento/accesos de reglas; cada implementación debe medirse y contarse |
| Emulador frente al servicio | https://firebase.google.com/docs/emulator-suite/connect_firestore | No exige índices compuestos ni reproduce todas las restricciones/transacciones; requiere ensayo real |
| Cadenas en reglas | https://firebase.google.com/docs/reference/rules/rules.String | lower, matches con RE2, replace, split, trim e índices/subcadenas documentados; no implica normalización Unicode completa |
| Fechas en reglas | https://firebase.google.com/docs/reference/rules/rules.Timestamp | Timestamp UTC; year, month, day, dayOfWeek y toMillis documentados; no aporta zona IANA America/Santiago |
| Acceso Google | https://firebase.google.com/docs/auth/web/redirect-best-practices | Popup es una alternativa documentada; puede bloquearse en dispositivos. El acceso desde app instalada continúa como prueba manual obligatoria |
| Facturación de lecturas | https://firebase.google.com/docs/firestore/pricing | Incluye lecturas necesarias para reglas y comportamiento de listeners/reconexiones; el contador de eventos cliente no es una factura |
| Permisos de scripts | https://firebase.google.com/docs/firestore/security/test-rules-emulator | Admin SDK omite reglas del cliente; se debe proteger la selección de proyecto y las credenciales administrativas |
| Codex | https://learn.chatgpt.com/docs/codex/ide | Página oficial consultada. La asignación Cursor=implementación/Codex=revisión es una decisión de organización de este proyecto, no un benchmark de capacidades |
| WhatsApp click-to-chat | https://faq.whatsapp.com/5913398998672934 y https://faq.whatsapp.com/425247423114725 | Referencias oficiales localizadas. La primera no pudo recuperarse completa y la segunda no devolvió cuerpo útil. El formato con texto precargado no se declara verificado de extremo a extremo; sigue siendo un criterio de prueba real |

## Pendientes que solo resuelve la implementación

- Compilar y ejecutar las reglas concretas, incluidos sus campos permitidos y presupuesto de accesos.
- Verificar el calendario de Chile con la zona horaria instalada y las fechas de cambio de hora.
- Probar Auth y WhatsApp desde cada navegador/dispositivo objetivo, incluidos ícono instalado y ventanas bloqueadas.
- Comprobar que cada consulta del commit funciona con los índices desplegados en ensayo.
- Medir carga, cuota observada y restauración. No hay resultados de rendimiento de una app que aún no se construyó.
