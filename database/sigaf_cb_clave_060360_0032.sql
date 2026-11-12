-- SIGAF · Agregar la clave 060.360.0032.0002 (espejo vaginal desechable).
-- Mismo específico 0032 que la 060.360.0032.0101 ya existente → cuenta 51251017,
-- centro de costos 200217. Edita la DESCRIPCIÓN si la presentación 0002 difiere.

insert into cb_claves (clave, descripcion, partida_sai, cuenta_prei, centro_costo, precio)
values (
  '060.360.0032.0002',
  'ESPEJO VAGINAL DESECHABLE, MEDIANO (CONFIRMAR PRESENTACIÓN 0002)',   -- <-- edítala si cambia
  null,
  '51251017',
  '200217',
  null
)
on conflict (clave) do update
  set descripcion = excluded.descripcion,
      cuenta_prei = excluded.cuenta_prei,
      centro_costo = excluded.centro_costo,
      precio = coalesce(excluded.precio, cb_claves.precio);

-- 1) Confirma que quedó:
select clave, descripcion, cuenta_prei, centro_costo from cb_claves where clave = '060.360.0032.0002';

-- 2) ¿Hay marco de Compra Emergente para esa cuenta? (debe devolver 1 renglón)
select numero_interno from contratos where numero_interno = 'CE-51251017';
