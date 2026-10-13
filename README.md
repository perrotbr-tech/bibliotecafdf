# App de préstamos de la biblioteca

Sitio estático sin paso de compilación: HTML, CSS y módulos ES nativos. Se publica
tal cual desde `docs/` con GitHub Pages. La base de datos es Cloud Firestore en
plan gratuito, y se entra con una cuenta de Google.

**Estado: Etapa 1 (base y acceso).** Catálogo, lectores, préstamos, recordatorios,
juego y estadísticas llegan en las etapas siguientes; sus pantallas dicen
«Disponible pronto».

La especificación manda sobre el código: `specs/00-contrato-operativo.md`,
`specs/00-base.md` y el documento de cada etapa. `referencia/prototipo.html` es
solo referencia visual y de textos.

## Qué necesitas

| Herramienta | Versión con la que se construyó y se probó |
|---|---|
| Node | 22.22.0 |
| npm | 10.9.4 |
| Java (para el emulador de Firestore) | OpenJDK 21 |
| Navegador | Chromium 141, que instala Playwright |

```bash
npm ci        # instala las versiones exactas del lockfile
```

## Correr la app en local

```bash
npm start
```

Levanta los emuladores de Authentication y Firestore con el proyecto
`demo-biblioteca`, inicializa la base demo y sirve `docs/` en
<http://127.0.0.1:5173>. Ctrl-C lo apaga todo.

En local **siempre** se usa el emulador: el contrato §1 fija que solo
`localhost`, `127.0.0.1` y `[::1]` lo seleccionan, y que `?ensayo=1` ahí se
ignora. Los tres ambientes viven en `docs/js/config-publica.js`: `emulador`
(`demo-biblioteca`), `ensayo` (`biblioteca-fdf-ensayo`) y `produccion`
(`biblioteca-fdf`). De cada bloque web solo se guardan los tres campos que la
app usa —`apiKey`, `authDomain` y `projectId`—; el resto corresponde a
servicios que no se cargan. Son valores públicos por diseño, no credenciales:
la seguridad la dan `firestore.rules` y Authentication.

Parámetros útiles, solo contra el emulador:

| Parámetro | Para qué |
|---|---|
| `?ahora=2026-10-10T15:00:00-03:00` | Mueve el reloj de la **interfaz**. No mueve `request.time` del servidor. |
| `?ensayo=1` | Fuera de loopback elige el proyecto de ensayo y lo recuerda en la sesión. |

## Correr las pruebas

```bash
npm test                # todo, en orden
npm run revisar         # escáner del repositorio (datos, llaves, teléfonos)
npm run prueba:unidad   # funciones puras, con node --test
npm run prueba:reglas   # reglas de seguridad contra el emulador
npm run prueba:scripts  # scripts de administración contra el emulador
npm run prueba:e2e      # flujos completos con Playwright contra el emulador
npm run prueba:carga    # volumen y mediciones
```

Cada prueba automatizada lleva en su nombre el identificador del caso del
documento de la etapa (`A-01`, `A-18`, …), así se puede ir del informe al código.

Antes de la primera corrida de `prueba:e2e` o `prueba:carga` hace falta el
navegador: `npx playwright install chromium`. Sin él, Playwright falla con
«Executable doesn't exist» y esas dos suites no corren aunque todo lo demás
pase.

Las pruebas de navegador bajan el SDK de Firebase desde `www.gstatic.com`, como
la app en producción. En una red que bloquee ese host, `tests/ayuda/navegador.mjs`
sirve los mismos archivos de la misma versión desde `node_modules/firebase` y lo
anuncia en la salida; lo que no queda probado así es la descarga real.

## Scripts de administración

```bash
# Prepara una base vacía: config/app, config/contadores, config/control
# y el primer administrador.
npx firebase emulators:exec --project demo-biblioteca --only auth,firestore \
  "node scripts/inicializar.mjs --correo tu@correo.cl --nombre 'Tu Nombre'"

# Carga inicial. Primero se simula: valida todo y no escribe nada.
npx firebase emulators:exec --project demo-biblioteca --only auth,firestore \
  "node scripts/cargar-datos.mjs --archivo datos/carga.json --simular"
# Y después se carga, solo si la simulación no rechazó nada y las colecciones
# de negocio están vacías. Para cargar encima: --reemplazar, que respalda y
# verifica antes de borrar.
npx firebase emulators:exec --project demo-biblioteca --only auth,firestore \
  "node scripts/cargar-datos.mjs --archivo datos/carga.json --cargar"

# Respaldo verificable: queda en datos/respaldo-AAAAMMDD-HHMM.json.
npx firebase emulators:exec --project demo-biblioteca --only auth,firestore \
  "node scripts/respaldar.mjs"

# Reponer un respaldo en una base vacía (o con --reemplazar, encima).
npx firebase emulators:exec --project demo-biblioteca --only auth,firestore \
  "node scripts/restaurar.mjs --archivo datos/respaldo-20261012-0530.json"
```

Los cuatro se niegan a escribir en un proyecto que no empiece con `demo-` salvo
que se les pase `--confirmo-proyecto-real`, y se niegan a correr contra un
proyecto demo si no están definidos `FIRESTORE_EMULATOR_HOST` y
`FIREBASE_AUTH_EMULATOR_HOST`. Esa bandera la usa el dueño en su computador,
nunca el agente.

La carga, el respaldo y la restauración toman el **bloqueo de mantenimiento**
mientras trabajan: mientras está puesto, la app no escribe —lo deniegan las
reglas— y se puede seguir consultando. Si uno de esos trabajos se corta a mitad,
el bloqueo **queda puesto a propósito**: una base incompleta no se reabre sola.
El mensaje de error indica el token y el manifiesto de `datos/` con lo que
alcanzó a escribirse; desde ahí se reanuda con `--reanudar`, o se repone un
respaldo. Los identificadores de la carga son deterministas, así que reanudar
reescribe los mismos documentos en vez de duplicarlos. Para soltar un bloqueo a
mano, cuando ya se comprobó que la base está íntegra:
`node scripts/respaldar.mjs --liberar --token <el token del mensaje>`.

`scripts/revisar-repositorio.mjs` falla si encuentra versionado algo de
`datos/`, un archivo con forma de llave de servicio, o un teléfono chileno que
no sea de prueba. Los teléfonos ficticios de este proyecto empiezan con
`5690000`; ese prefijo **no** está acreditado como rango reservado y esos
números no se contactan.

## Qué va y qué no va al repositorio

El repositorio es público, porque así lo exige GitHub Pages gratuito. La carpeta
`datos/` está en `.gitignore` y ahí viven la carga real, los respaldos y las
llaves. Ningún nombre, teléfono ni préstamo real vive en el código ni en la
página publicada.

## Despliegue

Lo hace el dueño, con sus credenciales, siguiendo `PASOS-DEL-DUENO.md`. El
agente no despliega reglas ni índices, no toca proyectos reales y no fusiona a
`main`.

## Dónde está cada cosa

```
docs/          la app publicada
  js/          main, ambiente, firebase, acceso, datos, reloj, fechas, texto,
               vistas/ y ui/
firestore.rules
tests/         unidad/, reglas/, scripts/, e2e/, carga/, ayuda/, fixtures/
scripts/       inicializar, cargar-datos, respaldar, restaurar,
               revisar-repositorio, servir, arrancar-local
  comun/       destino, mantenimiento, manifiesto, biblioteca, datos-exportados
specs/         la especificación; manda sobre el código
informes/      un informe por etapa
```
