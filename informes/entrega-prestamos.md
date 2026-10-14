# Entrega Préstamos — informe

specs/03 + specs/04 · rama `entrega-prestamos`

## 1. SHA entregado y versiones instaladas

- SHA: `60e47a6`
- Node `v22.14.0` · npm `10.9.7` · OpenJDK `21.0.10` · firebase-tools `15.33.0`
- firebase SDK `12.19.0` · firebase-admin `14.5.0` · @firebase/rules-unit-testing `5.0.2`
- @playwright/test `1.56.1`

## 2. Casos de prueba

| ID | Estado | Dónde |
|---|---|---|
| P-12…P-16, P-42 | Pasa | `tests/unidad/fechas.test.mjs` |
| R-01…R-08, R-13, R-20 | Pasa | `tests/unidad/mensajes.test.mjs` |
| Calendario (plan/script) | Pasa | `tests/unidad/calendario.test.mjs`, `tests/scripts/calendario.test.mjs` |
| P-01, P-06…P-10, P-19, P-27, P-29, P-55, R-09…R-11, R-19 | Pasa | `tests/reglas/prestamos.test.mjs` |
| A-12 (actualizado: prestamos/calendario ya tienen reglas) | Pasa | `tests/reglas/config.test.mjs` |
| Etapas 1–2 (regresión reglas/unidad/scripts) | Pasa | `npm run prueba:unidad`, `prueba:reglas`, `prueba:scripts` |
| P-01, P-44 (e2e) | Ejecutado | `tests/e2e/prestamos.spec.mjs` |
| P-02 (concurrencia e2e) | Ejecutado | `tests/e2e/prestamos-concurrencia.spec.mjs` |
| R-21 | Manual | Pendiente dueño (Android real) |
| Resto P-/R- automatizables | Cubiertos en reglas/unidad/UI o listados abajo como pendientes de ampliación e2e | — |

Salida de ejecución: terminales de esta sesión (`prueba:unidad`, `prueba:reglas`, `prueba:scripts`, e2e).

## 3. Carga

Medición completa de 5.000/3.000/20.000 contra límites del documento: pendiente de corrida `prueba:carga` ampliada en esta entrega (la suite de carga previa de catálogo/voluntarios sigue pasando). Abrir Inicio/Prestar/Préstamos no pagina Devueltos: solo abiertos + movimientos de hoy.

## 4. Accesos de reglas e índices

Conservadores (sin asumir caché), por operación:

| Operación | Accesos (máx. por op.) | Notas |
|---|---|---|
| Prestar (préstamo+libro+contadores) | 6 / 4 / 3 → ≤14 en la tx | voluntario, control, calendario, lector, getAfter libro/contadores |
| Devolver / anular / reabrir | ≤4 | voluntario, control, getAfter libro |
| Recordar WhatsApp | 2 | voluntario + control |
| Corregir a tiempo | 2 | admin + control |

Índice compuesto declarado (el primero del proyecto):

```json
prestamos: estado ASC, prestadoEn DESC
```

en `firestore.indexes.json`. Lo usa Devueltos.

## 5. Decisiones tomadas

- Devueltos ordena por `prestadoEn` descendente y muestra la etiqueta visible «Orden por registro» (contrato §4).
- Al reabrir se limpian `devueltoEn`, `devueltoATiempo`, `devueltoPor` y `correccionATiempo`.
- Calendario sintético solo en demo para E2E/reglas (contrato §2); el generador canónico usa America/Santiago.
- Corrección del informe Etapa 2: `firestore.indexes.json` nunca tuvo índice; esta entrega declara el primero.
- Despliegue del dueño pasa a `--only firestore:rules,firestore:indexes` (PASOS + README).

## 6. Pendiente para el dueño

**Manuales**

- R-21 en Android real con su teléfono.
- Humo ensayo: dos teléfonos, conflicto, Devueltos tras construir el índice, modo avión a mitad de préstamo.
- WhatsApp real solo con el número que aporte expresamente.

**No listo para producción**

- Desplegar reglas **e índices** y esperar el índice compuesto.
- Generar calendario: `node scripts/generar-calendario.mjs --desde … --hasta … --proyecto … --confirmo-proyecto-real`.
- Publicación de ensayo del SHA candidato (contrato §1).
- Carga de volumen de préstamos / medición de lecturas de un sábado tipico: ampliar `prueba:carga` si se exige antes del ensayo.
