$base = 'http://localhost:3000/api'
$ErrorActionPreference = 'Stop'
$results = @()

function Test-Step($name, $script) {
  try {
    & $script
    $script:results += [pscustomobject]@{ Test = $name; Status = 'OK' }
    Write-Host "[OK] $name" -ForegroundColor Green
  } catch {
    $msg = $_.Exception.Message
    if ($_.ErrorDetails.Message) { $msg = $_.ErrorDetails.Message }
    $script:results += [pscustomobject]@{ Test = $name; Status = 'FAIL'; Error = $msg }
    Write-Host "[FAIL] $name : $msg" -ForegroundColor Red
    throw
  }
}

function Login($email, $password) {
  $r = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body (@{ email = $email; password = $password } | ConvertTo-Json)
  return @{ Token = $r.accessToken; User = $r.user }
}

function Headers($token) {
  return @{ Authorization = "Bearer $token" }
}

Write-Host '=== Login usuarios base ===' -ForegroundColor Cyan
$admin = Login 'admin@nuclear.local' 'Admin123*'
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Test-Step 'ADMIN crea PROFESOR' {
  $script:profEmail = "profesor+$suffix@test.local"
  $script:profesor = Invoke-RestMethod -Uri "$base/usuarios" -Method Post -Headers (Headers $admin.Token) -ContentType 'application/json' -Body (@{
    fullName = 'Profesor Test'
    email = $script:profEmail
    password = 'Profesor123*'
    role = 'PROFESOR'
  } | ConvertTo-Json)
}

Test-Step 'ADMIN crea ESTUDIANTE 1' {
  $script:est1Email = "estudiante1+$suffix@test.local"
  $script:est1 = Invoke-RestMethod -Uri "$base/usuarios" -Method Post -Headers (Headers $admin.Token) -ContentType 'application/json' -Body (@{
    fullName = 'Estudiante Uno'
    email = $script:est1Email
    password = 'Estudiante123*'
    role = 'ESTUDIANTE'
  } | ConvertTo-Json)
}

Test-Step 'ADMIN crea ESTUDIANTE 2' {
  $script:est2Email = "estudiante2+$suffix@test.local"
  $script:est2 = Invoke-RestMethod -Uri "$base/usuarios" -Method Post -Headers (Headers $admin.Token) -ContentType 'application/json' -Body (@{
    fullName = 'Estudiante Dos'
    email = $script:est2Email
    password = 'Estudiante123*'
    role = 'ESTUDIANTE'
  } | ConvertTo-Json)
}

$profLogin = Login $script:profEmail 'Profesor123*'
$estLogin = Login $script:est1Email 'Estudiante123*'

Write-Host '=== Grupos ===' -ForegroundColor Cyan

Test-Step 'ADMIN crea grupo' {
  $script:grupoAdmin = Invoke-RestMethod -Uri "$base/grupos" -Method Post -Headers (Headers $admin.Token) -ContentType 'application/json' -Body (@{
    nombre = 'Grupo Admin'
    descripcion = 'Creado por admin'
    profesorId = $script:profesor.id
  } | ConvertTo-Json)
  if (-not $script:grupoAdmin.id) { throw 'Sin id de grupo' }
}

Test-Step 'PROFESOR lista usuarios (catalogo estudiantes)' {
  $usuarios = Invoke-RestMethod -Uri "$base/usuarios" -Headers (Headers $profLogin.Token)
  $estudiantes = @($usuarios | Where-Object { $_.role -eq 'ESTUDIANTE' -and $_.isActive })
  if ($estudiantes.Count -lt 2) {
    throw "Se esperaban al menos 2 estudiantes activos, hay $($estudiantes.Count)"
  }
}

Test-Step 'PROFESOR crea grupo (profesorId propio)' {
  $script:grupoProf = Invoke-RestMethod -Uri "$base/grupos" -Method Post -Headers (Headers $profLogin.Token) -ContentType 'application/json' -Body (@{
    nombre = 'Grupo Profesor'
    descripcion = 'Creado por profesor'
  } | ConvertTo-Json)
  if ($script:grupoProf.profesorId -ne $profLogin.User.id) {
    throw "profesorId esperado $($profLogin.User.id) obtuvo $($grupoProf.profesorId)"
  }
}

Test-Step 'ESTUDIANTE no puede crear grupo (403)' {
  try {
    Invoke-RestMethod -Uri "$base/grupos" -Method Post -Headers (Headers $estLogin.Token) -ContentType 'application/json' -Body (@{ nombre = 'Grupo Est' } | ConvertTo-Json)
    throw 'Debio fallar con 403'
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 403) { throw }
  }
}

Test-Step 'Listar grupos ADMIN' {
  $lista = Invoke-RestMethod -Uri "$base/grupos" -Headers (Headers $admin.Token)
  if ($lista.Count -lt 2) { throw "Se esperaban al menos 2 grupos, hay $($lista.Count)" }
}

Test-Step 'Editar grupo PROFESOR' {
  $script:grupoProf = Invoke-RestMethod -Uri "$base/grupos/$($script:grupoProf.id)" -Method Patch -Headers (Headers $profLogin.Token) -ContentType 'application/json' -Body (@{
    nombre = 'Grupo Profesor Editado'
  } | ConvertTo-Json)
  if ($script:grupoProf.nombre -ne 'Grupo Profesor Editado') { throw 'Nombre no actualizado' }
}

Test-Step 'Asignar estudiantes al grupo del profesor' {
  $lista = Invoke-RestMethod -Uri "$base/grupos/$($script:grupoProf.id)/estudiantes" -Method Post -Headers (Headers $profLogin.Token) -ContentType 'application/json' -Body (@{
    estudianteIds = @($script:est1.id, $script:est2.id)
  } | ConvertTo-Json)
  if ($lista.Count -ne 2) { throw "Se esperaban 2 estudiantes, hay $($lista.Count)" }
}

Test-Step 'Evitar duplicados (409)' {
  try {
    Invoke-RestMethod -Uri "$base/grupos/$($script:grupoProf.id)/estudiantes" -Method Post -Headers (Headers $profLogin.Token) -ContentType 'application/json' -Body (@{
      estudianteIds = @($script:est1.id)
    } | ConvertTo-Json)
    throw 'Debio fallar con 409'
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 409) { throw }
  }
}

Test-Step 'Listar estudiantes del grupo' {
  $lista = Invoke-RestMethod -Uri "$base/grupos/$($script:grupoProf.id)/estudiantes" -Headers (Headers $profLogin.Token)
  if ($lista.Count -ne 2) { throw "Se esperaban 2, hay $($lista.Count)" }
}

Test-Step 'ESTUDIANTE lista sus grupos (1)' {
  $lista = Invoke-RestMethod -Uri "$base/grupos" -Headers (Headers $estLogin.Token)
  if ($lista.Count -ne 1) { throw "Estudiante1 debe ver 1 grupo, vio $($lista.Count)" }
}

Test-Step 'Detalle grupo ESTUDIANTE miembro' {
  $g = Invoke-RestMethod -Uri "$base/grupos/$($script:grupoProf.id)" -Headers (Headers $estLogin.Token)
  if ($g.id -ne $script:grupoProf.id) { throw 'Detalle incorrecto' }
}

Test-Step 'Remover estudiante del grupo' {
  Invoke-RestMethod -Uri "$base/grupos/$($script:grupoProf.id)/estudiantes/$($script:est1.id)" -Method Delete -Headers (Headers $profLogin.Token) | Out-Null
  $lista = Invoke-RestMethod -Uri "$base/grupos/$($script:grupoProf.id)/estudiantes" -Headers (Headers $profLogin.Token)
  if ($lista.Count -ne 1) { throw "Tras remover debe quedar 1, hay $($lista.Count)" }
}

Test-Step 'Desactivar grupo DELETE' {
  $r = Invoke-RestMethod -Uri "$base/grupos/$($script:grupoAdmin.id)" -Method Delete -Headers (Headers $admin.Token)
  if ($r.grupo.isActive) { throw 'Grupo admin debe quedar inactivo' }
}

Write-Host ''
Write-Host '=== RESUMEN ===' -ForegroundColor Cyan
$results | Format-Table -AutoSize
Write-Host 'Todas las pruebas pasaron.' -ForegroundColor Green
