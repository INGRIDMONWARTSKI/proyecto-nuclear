import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbContainer = 'proyecto-nuclear-db-1';
const sqlFiles = [
  'database/persona-1-auth.sql',
  'database/persona-1-auth-recovery.sql',
  'database/persona-2-grupos.sql',
  'database/persona-3-simulacion.sql',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function tableExists() {
  const check = spawnSync(
    'docker',
    [
      'exec',
      dbContainer,
      'psql',
      '-U',
      'postgres',
      '-d',
      'nuclear',
      '-tAc',
      "SELECT to_regclass('public.usuarios') IS NOT NULL;",
    ],
    { encoding: 'utf8', shell: true },
  );

  if (check.status !== 0) {
    console.warn('[db-init] No se pudo verificar la tabla usuarios. Aplicando esquema...');
    return false;
  }

  return check.stdout.trim() === 't';
}

function recoveryTableExists() {
  const check = spawnSync(
    'docker',
    [
      'exec',
      dbContainer,
      'psql',
      '-U',
      'postgres',
      '-d',
      'nuclear',
      '-tAc',
      "SELECT to_regclass('public.password_reset_tokens') IS NOT NULL;",
    ],
    { encoding: 'utf8', shell: true },
  );

  if (check.status !== 0) {
    console.warn('[db-init] No se pudo verificar la tabla password_reset_tokens. Aplicando esquema...');
    return false;
  }

  return check.stdout.trim() === 't';
}

console.log('[db-init] Verificando esquema PostgreSQL...');

if (!tableExists() || !recoveryTableExists()) {
  console.log('[db-init] Aplicando SQL base...');

  for (const file of sqlFiles) {
    const sql = readFileSync(join(root, file), 'utf8');
    const apply = spawnSync(
      'docker',
      ['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', 'nuclear'],
      { input: sql, encoding: 'utf8', shell: true },
    );

    if (apply.status !== 0) {
      console.error(`[db-init] Error aplicando ${file}`);
      process.exit(apply.status ?? 1);
    }
  }

  run('docker', ['compose', 'restart', 'postgrest'], { cwd: root });
}

console.log('[db-init] Ejecutando seed de usuarios demo...');
run('npm', ['run', 'db:seed'], { cwd: join(root, 'backend') });
console.log('[db-init] Base de datos lista.');
