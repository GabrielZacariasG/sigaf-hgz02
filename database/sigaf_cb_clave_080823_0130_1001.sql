-- SIGAF · Agregar la clave 080.823.0130.1001 al catálogo cb_claves.
-- El grupo 080.823 (controles/soluciones de laboratorio) mapea a
-- cuenta 51251022 · centro de costos 200205 (igual que 080.823.0130.0000).
-- >>> Ajusta la DESCRIPCIÓN y el PRECIO con los datos reales de la clave. <<<

insert into cb_claves (clave, descripcion, partida_sai, cuenta_prei, centro_costo, precio)
values (
  '080.823.0130.1001',
  'SOLUCIÓN AMORTIGUADORA PARA LA TINCIÓN DE WRIGHT (CONFIRMAR PRESENTACIÓN)',  -- <-- edítala
  null,                 -- partida_sai (si la tienes)
  '51251022',
  '200205',
  null                  -- precio de referencia (opcional)
)
on conflict (clave) do update
  set descripcion = excluded.descripcion,
      cuenta_prei = excluded.cuenta_prei,
      centro_costo = excluded.centro_costo,
      precio = coalesce(excluded.precio, cb_claves.precio);

-- Verificación:
select clave, descripcion, cuenta_prei, centro_costo, precio
from cb_claves where clave = '080.823.0130.1001';
