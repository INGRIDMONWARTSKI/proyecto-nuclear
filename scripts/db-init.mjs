import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sqlFiles = [
  'database/persona-1-auth.sql',
  'database/persona-1-auth-recovery.sql',
  'database/persona-1-auth-must-change-password.sql',
  'database/persona-2-grupos.sql',
  'database/persona-3-simulacion.sql',

  'database/persona-4-notificaciones-semestre.sql',
  'database/persona-5-tiempo-maximo-simulacion.sql',
  'database/persona-9-permisos-docente-casos.sql',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: root,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runPsqlQuery(sql) {
  const result = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'nuclear', '-At'],
    { input: `${sql}\n`, encoding: 'utf8', cwd: root },
  );

  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? '').trim(),
  };
}

function tableExists() {
  const { ok, stdout } = runPsqlQuery(
    "SELECT to_regclass('public.usuarios') IS NOT NULL;",
  );

  if (!ok) {
    console.warn('[db-init] No se pudo verificar la tabla usuarios. Aplicando esquema...');
    return false;
  }

  return stdout === 't';
}

function recoveryTableExists() {
  const { ok, stdout } = runPsqlQuery(
    "SELECT to_regclass('public.password_reset_tokens') IS NOT NULL;",
  );

  if (!ok) {
    console.warn(
      '[db-init] No se pudo verificar la tabla password_reset_tokens. Aplicando esquema...',
    );
    return false;
  }

  return stdout === 't';
}

function mustChangePasswordColumnExists() {
  const { ok, stdout } = runPsqlQuery(
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='mustChangePassword');",
  );

  if (!ok) {
    console.warn('[db-init] No se pudo verificar mustChangePassword. Aplicando migración...');
    return false;
  }

  return stdout === 't';
}

function gruposSemestreColumnExists() {

  const { ok, stdout } = runPsqlQuery(

    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='grupos' AND column_name='semestre');",

  );

  if (!ok) {

    console.warn('[db-init] No se pudo verificar grupos.semestre. Aplicando migracion...');

    return false;

  }

  return stdout === 't';

}

function notificacionesTableExists() {

  const { ok, stdout } = runPsqlQuery(

    "SELECT to_regclass('public.notificaciones') IS NOT NULL;",

  );

  if (!ok) {

    console.warn('[db-init] No se pudo verificar tabla notificaciones. Aplicando migracion...');

    return false;

  }

  return stdout === 't';

}

function tiempoMaximoCasoColumnExists() {
  const { ok, stdout } = runPsqlQuery(
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='casos' AND column_name='tiempo_maximo_minutos');",
  );

  if (!ok) {
    console.warn('[db-init] No se pudo verificar casos.tiempo_maximo_minutos. Aplicando migracion...');
    return false;
  }

  return stdout === 't';
}

function puedeCrearCasosColumnExists() {
  const { ok, stdout } = runPsqlQuery(
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='puedeCrearCasos');",
  );

  if (!ok) {
    console.warn('[db-init] No se pudo verificar usuarios.puedeCrearCasos. Aplicando migracion...');
    return false;
  }

  return stdout === 't';
}

function applySqlFile(file) {
  const sql = readFileSync(join(root, file), 'utf8');
  const apply = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'nuclear'],
    { input: sql, encoding: 'utf8', cwd: root },
  );

  if (apply.status !== 0) {
    console.error(`[db-init] Error aplicando ${file}`);
    process.exit(apply.status ?? 1);
  }
}

console.log('[db-init] Verificando esquema PostgreSQL...');

let shouldSeed = false;

if (!tableExists() || !recoveryTableExists()) {
  console.log('[db-init] Aplicando SQL base...');

  for (const file of sqlFiles) {
    applySqlFile(file);
  }

  run('docker', ['compose', 'restart', 'postgrest']);
  shouldSeed = true;
} else if (!mustChangePasswordColumnExists()) {
  console.log('[db-init] Aplicando migración mustChangePassword...');
  applySqlFile('database/persona-1-auth-must-change-password.sql');
  run('docker', ['compose', 'restart', 'postgrest']);
}

if (!shouldSeed && (!gruposSemestreColumnExists() || !notificacionesTableExists())) {

  console.log('[db-init] Aplicando migracion semestre/notificaciones...');

  applySqlFile('database/persona-4-notificaciones-semestre.sql');

  run('docker', ['compose', 'restart', 'postgrest']);

}

if (!shouldSeed && !tiempoMaximoCasoColumnExists()) {
  console.log('[db-init] Aplicando migracion de tiempo maximo de simulacion...');
  applySqlFile('database/persona-5-tiempo-maximo-simulacion.sql');
  run('docker', ['compose', 'restart', 'postgrest']);
}

if (!shouldSeed && !puedeCrearCasosColumnExists()) {
  console.log('[db-init] Aplicando migracion de permisos docente para casos...');
  applySqlFile('database/persona-9-permisos-docente-casos.sql');
  run('docker', ['compose', 'restart', 'postgrest']);
}



if (shouldSeed || process.env.DB_SEED === '1') {
  console.log('[db-init] Ejecutando seed de usuarios demo...');
  run('npm', ['run', 'db:seed'], { cwd: join(root, 'backend') });
} else {
  console.log(
    '[db-init] Seed omitido (BD ya inicializada). Usa npm run db:seed para crear usuarios demo faltantes.',
  );
}

console.log('[db-init] Base de datos lista.');
