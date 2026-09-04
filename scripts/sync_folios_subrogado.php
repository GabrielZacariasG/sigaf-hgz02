<?php
/**
 * SIGAF · Sincronizador de folios de subrogado
 * -------------------------------------------------------------------
 * Lee los folios de las dos bases MySQL del servidor CD_SMS y los sube
 * a la tabla `folios_subrogado` de Supabase (SIGAF) por HTTPS.
 *
 * Corre EN el servidor 11.41.1.222 (ve MySQL en localhost y sale por 443).
 * Se puede correr por consola:   php sync_folios_subrogado.php
 * o programarlo (Programador de tareas de Windows) cada X minutos.
 *
 * ⚠️ Contiene la SERVICE_ROLE key de Supabase: guárdalo FUERA de la carpeta
 *    web (no accesible por navegador) y no lo compartas.
 * -------------------------------------------------------------------
 */

// ===================== CONFIGURA ESTO =====================
$MYSQL_HOST = '127.0.0.1';
$MYSQL_PORT = 3306;
$MYSQL_USER = 'PON_TU_USUARIO_MYSQL';
$MYSQL_PASS = 'PON_TU_PASSWORD_MYSQL';

$SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';     // sin diagonal al final
$SUPABASE_KEY = 'PON_AQUI_TU_SERVICE_ROLE_KEY';        // Settings → API → service_role

$SYNC_VIEJO = true;   // pon false si por ahora solo quieres el sistema nuevo
// =========================================================

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

function conectar($host,$port,$user,$pass){
  $c = new mysqli($host,$user,$pass,'',$port);
  $c->set_charset('utf8mb4');
  return $c;
}

/** Sube filas a Supabase en lotes (upsert por origen+folio). */
function upsertSupabase($url,$key,$filas){
  if (!count($filas)) return 0;
  $subidas = 0;
  foreach (array_chunk($filas, 500) as $lote) {
    $ch = curl_init("$url/rest/v1/folios_subrogado?on_conflict=origen,folio");
    curl_setopt_array($ch, [
      CURLOPT_POST => true,
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_HTTPHEADER => [
        "apikey: $key",
        "Authorization: Bearer $key",
        "Content-Type: application/json",
        "Prefer: resolution=merge-duplicates,return=minimal",
      ],
      CURLOPT_POSTFIELDS => json_encode($lote, JSON_UNESCAPED_UNICODE),
      CURLOPT_TIMEOUT => 60,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($resp === false) { echo "  ERROR curl: ".curl_error($ch)."\n"; }
    elseif ($code >= 300) { echo "  ERROR Supabase ($code): $resp\n"; }
    else { $subidas += count($lote); }
    curl_close($ch);
  }
  return $subidas;
}

$filas = [];

// -------- 1) SISTEMA NUEVO (subrogados_nuevo) --------
$db = conectar($MYSQL_HOST,$MYSQL_PORT,$MYSQL_USER,$MYSQL_PASS);
$sqlNuevo = "
  SELECT sr.folio, sr.fecha, c.code AS contrato_code, p.name AS proveedor,
         u.name AS unidad,
         COALESCE(pt.name,'') AS paciente,
         sr.subtotal, sr.iva, sr.total, sr.status AS estatus
  FROM subrogados_nuevo.subrogation_requests sr
  LEFT JOIN subrogados_nuevo.contracts c ON c.id = sr.contract_id
  LEFT JOIN subrogados_nuevo.providers p ON p.id = sr.provider_id
  LEFT JOIN subrogados_nuevo.units     u ON u.id = sr.unit_id
  LEFT JOIN subrogados_nuevo.patients pt ON pt.id = sr.patient_id
  WHERE sr.folio IS NOT NULL AND sr.folio <> ''
";
$res = $db->query($sqlNuevo);
$n1 = 0;
while ($r = $res->fetch_assoc()) {
  $filas[] = [
    'origen' => 'nuevo',
    'folio' => (string)$r['folio'],
    'fecha' => $r['fecha'] ?: null,
    'contrato_code' => $r['contrato_code'],
    'proveedor' => $r['proveedor'],
    'unidad' => $r['unidad'],
    'paciente' => trim($r['paciente']) ?: null,
    'subtotal' => $r['subtotal'], 'iva' => $r['iva'], 'total' => $r['total'],
    'estatus' => $r['estatus'], 'factura' => null, 'fecha_pago' => null,
    'actualizado_at' => date('c'),
  ];
  $n1++;
}
echo "Nuevo (subrogados_nuevo): $n1 folios leídos\n";

// -------- 2) SISTEMA VIEJO (subrogados) — best-effort desde la vista --------
$n2 = 0;
if ($SYNC_VIEJO) {
  // vista_excel trae folio + contrato + paciente + concepto/cantidad/precio (nivel línea);
  // agregamos por folio para el total. Ajustable si el histórico usa otra vista.
  $sqlViejo = "
    SELECT ve.folio,
           MIN(ve.fecha) AS fecha,
           MIN(ve.fk_contrato) AS contrato_code,
           MIN(TRIM(CONCAT_WS(' ', ve.nombre_p, ve.appaterno_p, ve.apmaterno_p))) AS paciente,
           ROUND(SUM(ve.cantidad * ve.precio_unitario), 2) AS total
    FROM subrogados.vista_excel ve
    WHERE ve.folio IS NOT NULL
    GROUP BY ve.folio
  ";
  try {
    $res2 = $db->query($sqlViejo);
    while ($r = $res2->fetch_assoc()) {
      $filas[] = [
        'origen' => 'viejo',
        'folio' => (string)$r['folio'],
        'fecha' => $r['fecha'] ?: null,
        'contrato_code' => $r['contrato_code'],
        'proveedor' => null,
        'unidad' => null,
        'paciente' => $r['paciente'] ?: null,
        'subtotal' => null, 'iva' => null, 'total' => $r['total'],
        'estatus' => null, 'factura' => null, 'fecha_pago' => null,
        'actualizado_at' => date('c'),
      ];
      $n2++;
    }
    echo "Viejo (subrogados.vista_excel): $n2 folios leídos\n";
  } catch (\Throwable $e) {
    echo "Aviso: no se pudo leer el histórico (subrogados.vista_excel): ".$e->getMessage()."\n";
    echo "  → revisa el nombre de la vista/tabla del histórico y ajusta \$sqlViejo.\n";
  }
}
$db->close();

// -------- 3) Subir a Supabase --------
echo "Subiendo ".count($filas)." folios a SIGAF (Supabase)...\n";
$subidas = upsertSupabase($SUPABASE_URL, $SUPABASE_KEY, $filas);
echo "Listo. $subidas folios sincronizados.\n";
