-- SIGAF · Agregar la clave 379.808.6587.0001 al catálogo cb_claves.
-- Grupo 379.808 (sensores / accesorios de equipo médico) → cuenta 51291007,
-- centro de costos 200217 (igual que el resto del grupo). Marco CE-51291007 ya existe.
-- >>> Edita la DESCRIPCIÓN (y el precio si lo tienes) con los datos reales. <<<

insert into cb_claves (clave, descripcion, partida_sai, cuenta_prei, centro_costo, precio)
values (
  '379.808.6587.0001',
  'DESCRIPCIÓN DEL ARTÍCULO (CONFIRMAR CON LA FACTURA/OC)',   -- <-- edítala
  null,                 -- partida_sai (si la tienes)
  '51291007',
  '200217',
  null                  -- precio de referencia (opcional)
)
on conflict (clave) do update
  set descripcion = excluded.descripcion,
      cuenta_prei = excluded.cuenta_prei,
      centro_costo = excluded.centro_costo,
      precio = coalesce(excluded.precio, cb_claves.precio);

-- Verificación:
select clave, descripcion, cuenta_prei, centro_costo, precio
from cb_claves where clave = '379.808.6587.0001';
