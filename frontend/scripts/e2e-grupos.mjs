import { chromium } from 'playwright';

const BASE = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const results = [];

function log(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function loginApi(email, password) {
  const { status, data } = await api('POST', '/auth/login', {
    body: { email, password },
  });
  if (status !== 200 && status !== 201) {
    throw new Error(`Login API fallo: ${status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function loginUi(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('#email');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/grupos/, { timeout: 15000 });
}

async function setupTestUsers() {
  const admin = await loginApi('admin@nuclear.local', 'Admin123*');
  const suffix = Date.now();
  const profEmail = `prof.fe.${suffix}@test.local`;
  const estEmail = `est.fe.${suffix}@test.local`;

  let r = await api('POST', '/usuarios', {
    token: admin.accessToken,
    body: {
      fullName: 'Profesor Frontend',
      email: profEmail,
      password: 'Profesor123*',
      role: 'PROFESOR',
    },
  });
  if (r.status !== 201 && r.status !== 200) {
    throw new Error(`Crear profesor: ${r.status}`);
  }
  const profesor = r.data;

  r = await api('POST', '/usuarios', {
    token: admin.accessToken,
    body: {
      fullName: 'Estudiante Frontend',
      email: estEmail,
      password: 'Estudiante123*',
      role: 'ESTUDIANTE',
    },
  });
  if (r.status !== 201 && r.status !== 200) {
    throw new Error(`Crear estudiante: ${r.status}`);
  }
  const estudiante = r.data;

  const profLogin = await loginApi(profEmail, 'Profesor123*');
  const estLogin = await loginApi(estEmail, 'Estudiante123*');

  return { admin, profesor, estudiante, profEmail, estEmail, profLogin, estLogin };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let users;
  try {
    users = await setupTestUsers();
    log('Setup usuarios de prueba via API', true);
  } catch (e) {
    log('Setup usuarios de prueba via API', false, e.message);
    await browser.close();
    process.exit(1);
  }

  try {
    // 1. Login ADMIN + navegación
    await loginUi(page, 'admin@nuclear.local', 'Admin123*');
    const adminSubtitle = await page.textContent('.page-header__subtitle');
    log(
      'Login ADMIN y navegación a /grupos',
      adminSubtitle?.includes('Administración'),
      adminSubtitle ?? '',
    );

    const crearVisible = await page.locator('a:has-text("Crear grupo")').isVisible();
    log('ADMIN ve botón Crear grupo', crearVisible);

    // 2. Crear grupo (formulario)
    await page.click('a:has-text("Crear grupo")');
    await page.waitForURL(/\/grupos\/nuevo/);
    const nombreGrupo = `Grupo UI ${Date.now()}`;
    await page.fill('#nombre', nombreGrupo);
    await page.fill('#descripcion', 'Descripcion desde E2E');
    await page.selectOption('#profesorId', users.profesor.id);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/grupos\/[a-f0-9-]+$/i, { timeout: 15000 });
    log('ADMIN crea grupo (formulario + redirect detalle)', true);

    const grupoUrl = page.url();
    const grupoId = grupoUrl.split('/').pop();

    // 3. Asignar estudiante (ADMIN multiselect)
    await page.click('button:has-text("Asignar estudiantes")');
    await page.waitForSelector('#estudianteIds');
    await page.selectOption('#estudianteIds', [users.estudiante.id]);
    await page.click('button:has-text("Confirmar asignación")');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const rows = await page.locator('table tbody tr').count();
    log('ADMIN asigna estudiante y ve tabla', rows >= 1, `filas=${rows}`);

    // 4. Ver estudiantes
    const estudianteVisible = await page
      .locator('text=Estudiante Frontend')
      .isVisible();
    log('Ver estudiantes asignados en detalle', estudianteVisible);

    // 5. Editar grupo
    await page.click('a:has-text("Editar")');
    await page.waitForURL(/\/editar/);
    const nombreEditado = `${nombreGrupo} Editado`;
    await page.fill('#nombre', nombreEditado);
    await page.click('button[type="submit"]');
    await page.waitForURL(new RegExp(`/grupos/${grupoId}$`));
    const h1 = await page.locator('h1').first().textContent();
    log('ADMIN edita grupo', h1?.includes('Editado'), h1 ?? '');

    // Logout via UI
    await page.click('button:has-text("Salir")');
    await page.waitForURL(/\/login/);
    log('Logout y JWT limpiado (redirect login)', page.url().includes('/login'));

    // 6. Login PROFESOR
    await loginUi(page, users.profEmail, 'Profesor123*');
    const profSubtitle = await page.textContent('.page-header__subtitle');
    log(
      'Login PROFESOR',
      profSubtitle?.includes('Tus grupos'),
      profSubtitle ?? '',
    );

    await page.click('a:has-text("Crear grupo")');
    await page.waitForURL(/\/grupos\/nuevo/);
    const sinSelectorProfesor = (await page.locator('#profesorId').count()) === 0;
    log('PROFESOR formulario sin selector profesor', sinSelectorProfesor);

    const nombreProf = `Grupo Prof ${Date.now()}`;
    await page.fill('#nombre', nombreProf);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/grupos\/[a-f0-9-]+$/i);
    log('PROFESOR crea su grupo', true);

    await page.click('button:has-text("Salir")');
    await page.waitForURL(/\/login/);

    // 7. Login ESTUDIANTE - ver solo grupos asignados
    await loginUi(page, users.estEmail, 'Estudiante123*');
    const estSubtitle = await page.textContent('.page-header__subtitle');
    log(
      'Login ESTUDIANTE',
      estSubtitle?.includes('participas'),
      estSubtitle ?? '',
    );

    const crearOculto = (await page.locator('a:has-text("Crear grupo")').count()) === 0;
    log('ESTUDIANTE no ve Crear grupo', crearOculto);

    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const estRows = await page.locator('table tbody tr').count();
    log('ESTUDIANTE ve al menos 1 grupo asignado', estRows >= 1, `filas=${estRows}`);

    const editarOculto = (await page.locator('a:has-text("Editar")').count()) === 0;
    log('ESTUDIANTE no ve Editar en lista', editarOculto);

    await page.click('a:has-text("Ver")');
    await page.waitForURL(/\/grupos\/[a-f0-9-]+$/i);
    const assignOculto =
      (await page.locator('button:has-text("Asignar estudiantes")').count()) === 0;
    log('ESTUDIANTE detalle sin asignar/remover admin', assignOculto);

    // 8. Loading en login (credenciales inválidas)
    await page.click('button:has-text("Salir")');
    await page.waitForURL(/\/login/);
    await page.fill('#email', 'noexiste@test.local');
    await page.fill('#password', 'WrongPass1!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.alert-error', { timeout: 10000 });
    const errText = await page.locator('.alert-error').textContent();
    log(
      'Estado error en login (mensaje API)',
      Boolean(errText?.length),
      errText?.trim(),
    );

    // JWT: sin token no accede a grupos
    await page.goto(`${BASE}/grupos`);
    await page.waitForURL(/\/login/, { timeout: 10000 });
    log('Sin JWT redirige a login', page.url().includes('/login'));
  } catch (e) {
    log('Prueba E2E interrumpida', false, e.message);
    console.error(e);
  }

  await browser.close();

  console.log('\n=== RESUMEN ===');
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.name}`);
  }
  if (failed.length) {
    process.exit(1);
  }
  console.log('\nTodas las pruebas frontend pasaron.');
}

run();
