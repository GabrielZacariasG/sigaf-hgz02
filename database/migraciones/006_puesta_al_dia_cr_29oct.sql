-- =====================================================================
-- SIGAF · Puesta al día · 006 · CR, pago, firmas y P&R de facturas en OOAD
-- Fecha: 29/10/2026 · Aprobado por Gabriel (Excel "PUESTA AL DIA SIGAF 29 OCT 2026", ¿Aplicar? = Sí)
--
-- 187 facturas que estaban "En trámite OOAD" SIN CR y que SÍ tienen comprobante en el sistema
-- (N_AP_IMSS_1043 emitidos 02/01–28/10/2026). 120 quedan pagadas y 67 siguen en trámite:
--   · se registra su CR (cr_contrarecibo)
--   · si el sistema la marca PAGADA → "gasto_reflejado" con fecha de pago
--       (fecha real del reporte de pagado 4006 cuando existe; si no, la fecha programada del 1043)
--   · firmas completas (adm. de contrato; Compra Emergente: servicio), porque ya tiene CR
--   · pedido-recepción "generado" con su número cuando el comprobante lo trae
--
-- SEGURO: solo cambia facturas que SIGUEN en OOAD, no anuladas y SIN CR (si alguien ya las movió, no se tocan).
-- No toca las 51 marcadas Revisar / Decide / No. El historial de estatus lo registra el trigger.
-- Cómo: SQL Editor de Supabase → Run. Debe mostrar UNA fila con los conteos.
-- =====================================================================
with pd (id, cr, gen, fir, pr, pedido, recepcion, fecha_pago) as (
values
  ('9c8ec310-21e5-4586-a283-6a01b4f2030a'::uuid, '00475169', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-29'::date),  -- AI-104961 | ABASTECEDORA MEDICA HOSPITALARIA DE AGUASCALIENTES
  ('5c3d629f-57ac-479b-91d3-ee1bf4f10df1'::uuid, '00475002', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-28'::date),  -- B1283 | ACE MEDICAL, S.A. de C.V.
  ('25f11d7b-4dc1-4e21-8196-086c8c6d6863'::uuid, '00475002', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-28'::date),  -- B1286 | ACE MEDICAL, S.A. de C.V.
  ('52a81b45-eeb6-4b6a-93cf-bdd6aa7f47eb'::uuid, '00474421', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- AR104611 | AR LOGISTICA MEDICA
  ('c2a2c4db-7aed-4854-a59f-56ea650744d5'::uuid, '00474421', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- AR104613 | AR LOGISTICA MEDICA
  ('4db728b9-f7ff-45e7-b45c-b51b5caa8303'::uuid, '00474421', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- AR104614 | AR LOGISTICA MEDICA
  ('2013f9c8-3841-4202-9743-98ab6b6707e9'::uuid, '00473965', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-15'::date),  -- 40265 | AUTOBUSES DE LA PIEDAD, S.A. DE C.V.
  ('26e813a7-9f2e-4d60-a832-dbfa8d93cea0'::uuid, '00471832', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45423', '44205', '2026-09-22'::date),  -- EF583373 | BAXTER S.A. DE C.V.
  ('347deb32-8d58-4259-b92e-bda76e1a2581'::uuid, '00471842', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45424', '44206', '2026-09-22'::date),  -- EF585502 | BAXTER S.A. DE C.V.
  ('265051a5-bb4d-4995-9fc7-9be0cddab831'::uuid, '00471839', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45421', '44203', '2026-09-22'::date),  -- EF587675 | BAXTER S.A. DE C.V.
  ('d855140f-06c4-428d-a4a8-17d391a13b66'::uuid, '00472937', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45625', '44409', '2026-10-01'::date),  -- EF589578 | BAXTER S.A. DE C.V.
  ('a76e6d94-4e70-4744-a359-71e5540dd9c2'::uuid, '00471834', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45422', '44204', '2026-09-22'::date),  -- EF589592 | BAXTER S.A. DE C.V.
  ('2a98bbdf-c377-4062-af6c-c5ef9ea080a6'::uuid, '00474350', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-21'::date),  -- 4583 | BEATRIZ IBARRA RODRIGUEZ
  ('448ac8db-caf8-40a5-ae1d-a8454c2ee562'::uuid, '00474350', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-21'::date),  -- 4585 | BEATRIZ IBARRA RODRIGUEZ
  ('96f0acee-65a7-4ad6-a22a-dca29656fb02'::uuid, '00473596', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-12'::date),  -- B4555 | BEATRIZ IBARRA RODRIGUEZ
  ('e85dedd7-b8ad-49c2-8b44-bb16fd1037d4'::uuid, '00473594', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-12'::date),  -- B4563 | BEATRIZ IBARRA RODRIGUEZ
  ('b1e6c5d7-e30c-404c-a390-518a38147403'::uuid, '00473624', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-13'::date),  -- B4575 | BEATRIZ IBARRA RODRIGUEZ
  ('45edd38f-bde1-462b-a361-27dd7264dc56'::uuid, '00473596', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-12'::date),  -- B4578 | BEATRIZ IBARRA RODRIGUEZ
  ('63852bdf-6ff7-4a8d-aec5-9cfb88936ab4'::uuid, '00473594', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-12'::date),  -- B4579 | BEATRIZ IBARRA RODRIGUEZ
  ('39deaeef-7aa7-4f3d-b66c-8a3d1cfb1c00'::uuid, '00474816', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B4580 | BEATRIZ IBARRA RODRIGUEZ
  ('ca7cd6be-eb99-425e-b02c-7d362f2ff1e2'::uuid, '00474422', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- B4586 | BEATRIZ IBARRA RODRIGUEZ
  ('18b0ed22-20ef-4028-96f7-d40521e78323'::uuid, '00474987', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B4591 | BEATRIZ IBARRA RODRIGUEZ
  ('846620f0-c1ac-43ad-8f30-9e302ce19100'::uuid, '00474995', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B4592 | BEATRIZ IBARRA RODRIGUEZ
  ('a60b81a4-cacf-494b-a8cb-148181086b63'::uuid, '00475001', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B4593 | BEATRIZ IBARRA RODRIGUEZ
  ('76b9588e-a448-45d9-94a8-3eabcb9deaae'::uuid, '00474987', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B4594 | BEATRIZ IBARRA RODRIGUEZ
  ('5d82b6ab-625f-467f-9099-660902def1bf'::uuid, '00475001', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B4595 | BEATRIZ IBARRA RODRIGUEZ
  ('664e514d-9bb4-4fd4-9b5c-6edbae8cff75'::uuid, '00475004', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B4596 | BEATRIZ IBARRA RODRIGUEZ
  ('fffd4ba0-1e77-4760-aca0-df8a9a978f52'::uuid, '00474984', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B4621 | BEATRIZ IBARRA RODRIGUEZ
  ('35149144-b7c9-4894-a728-5c758a8935b8'::uuid, '00474990', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B4622 | BEATRIZ IBARRA RODRIGUEZ
  ('1822fe3b-c55b-4788-a816-5cc0edecaf00'::uuid, '00474984', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B4623 | BEATRIZ IBARRA RODRIGUEZ
  ('0388643a-0491-473d-8706-44269f4b545f'::uuid, '00474423', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- B4624 | BEATRIZ IBARRA RODRIGUEZ
  ('912079a6-3472-441f-af11-b5cbdab8c987'::uuid, '00474815', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B4626 | BEATRIZ IBARRA RODRIGUEZ
  ('90b1c780-9e92-4afc-bf92-cc0a58c89963'::uuid, '00474815', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B4627 | BEATRIZ IBARRA RODRIGUEZ
  ('b827f27c-cab8-43cd-ba48-f1da38113fff'::uuid, '00474422', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- B4628 | BEATRIZ IBARRA RODRIGUEZ
  ('b859fb46-a413-42de-b51a-cb9b0e19088f'::uuid, '00474458', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- B4646 | BEATRIZ IBARRA RODRIGUEZ
  ('08303133-0337-4301-9e25-f7b455a0f0b8'::uuid, '00474458', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- B4647 | BEATRIZ IBARRA RODRIGUEZ
  ('8f76c7ab-c47b-45ae-9510-9234b5745c4c'::uuid, '00474461', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- B4648 | BEATRIZ IBARRA RODRIGUEZ
  ('682ab368-1d8c-4bdb-8e30-01ee54d30be3'::uuid, '00474461', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- B4649 | BEATRIZ IBARRA RODRIGUEZ
  ('c0627d09-16e6-41f1-b987-887e68fa8345'::uuid, '00473969', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45822', '44602', '2026-10-15'::date),  -- 6849 | BIODIST, S.A. de C.V.
  ('b8272776-4649-4b99-9f25-b5e388ba2f64'::uuid, '00474661', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45927', '44706', '2026-10-27'::date),  -- 7606 | BIODIST, S.A. de C.V.
  ('7595feac-8efd-456d-92b1-3891a8aa2bc6'::uuid, '00474654', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45912', '44691', '2026-10-27'::date),  -- 7844 | BIODIST, S.A. de C.V.
  ('4cbe8d93-2777-4c2c-8332-6bde33968e0f'::uuid, '00474464', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45871', '44650', '2026-10-22'::date),  -- 8903/6182 | BIODIST, S.A. de C.V.
  ('5c25e188-747c-47ee-b635-826b883592d5'::uuid, '00473968', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45823', '44603', '2026-10-15'::date),  -- 9009/6229 | BIODIST, S.A. de C.V.
  ('b4264063-d440-4cbb-87f0-ac18e92ab442'::uuid, '00474685', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45914', '44693', '2026-10-27'::date),  -- 9195 | BIODIST, S.A. de C.V.
  ('fec7cb23-f2ec-459a-adc7-1ec31f06de52'::uuid, '00474744', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45902', '44681', '2026-10-27'::date),  -- 9311/ 9240/7466 | BIODIST, S.A. de C.V.
  ('8e1cad42-3cba-4a86-b2eb-35efc786e1f7'::uuid, '00473995', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45788', '44568', '2026-10-15'::date),  -- 9356 | BIODIST, S.A. de C.V.
  ('7cb37573-9a61-46f2-bdc6-845bd629bb0a'::uuid, '00473992', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45789', '44569', '2026-10-15'::date),  -- 9363 | BIODIST, S.A. de C.V.
  ('a34a3f6c-770b-4758-a72a-6f67e48de65e'::uuid, '00471180', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45248', '44036', '2026-08-31'::date),  -- HD9094 | BIODIST, S.A. de C.V.
  ('86334f2f-73b2-4c76-8909-0cea223927e0'::uuid, '00471184', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45249', '44037', '2026-08-31'::date),  -- HD9291 | BIODIST, S.A. de C.V.
  ('0b9c83ca-a663-4338-90a3-70925331da70'::uuid, '00474785', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45976', '44754', '2026-10-27'::date),  -- HD9585 | BIODIST, S.A. de C.V.
  ('d4329867-771e-45f3-bf50-463adb57bfb1'::uuid, '00474953', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-28'::date),  -- INV/2026/00611 | COMERCIALIZADORA STÄDEL DEL NORTE, S.A. DE C.V.
  ('49620362-3077-460d-afd4-5ceb78d80c41'::uuid, '00472737', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-19'::date),  -- 10637 | COMERCIALIZADORA Y OPERADORA DE SERVICIOS ADEMEX
  ('be88b9ea-87db-4da6-82bc-70eb9f0f7119'::uuid, '00475006', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- 12278 | COMERCIALIZADORA Y OPERADORA DE SERVICIOS ADEMEX
  ('c1ecf917-df67-4861-a9e0-57fbbb251ad0'::uuid, '00475019', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- FA_26_ADE_11571 | COMERCIALIZADORA Y OPERADORA DE SERVICIOS ADEMEX
  ('c80f292d-80a5-4356-81c9-11da0e74bb09'::uuid, '00473240', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45652', '44434', '2026-10-07'::date),  -- 1729 | Derma Body, S.A. de C.V.
  ('e94a8243-3c03-4075-b62c-64e89f41e2f4'::uuid, '00474974', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45861', '44641', '2026-10-28'::date),  -- A1742 | Derma Body, S.A. de C.V.
  ('30de320c-426d-4109-8031-f4dd5d53f0ca'::uuid, '00475003', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- 3361 | DIEGO OSVALDO CABRERA ROMERO
  ('8305ce1a-757d-4345-b820-25d76a58f77b'::uuid, '00472725', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-16'::date),  -- FAC3301 | DIEGO OSVALDO CABRERA ROMERO
  ('a8e06cf1-0551-4b7f-9348-fb6807362134'::uuid, '00472725', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-16'::date),  -- FAC3302 | DIEGO OSVALDO CABRERA ROMERO
  ('7e8a4135-38e5-4d1c-8288-c99191bd6a30'::uuid, '00472725', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-16'::date),  -- FAC3304 | DIEGO OSVALDO CABRERA ROMERO
  ('c61ef074-b397-4cab-9c2f-292c4fcd63b4'::uuid, '00473588', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-19'::date),  -- FAC3318 | DIEGO OSVALDO CABRERA ROMERO
  ('9fb915a9-50ae-406d-88f9-517a73188659'::uuid, '00475011', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- 2609 | DISTRIBUIDORA MEDICALCORP
  ('14609feb-f3d2-44d2-9508-906672b6ed12'::uuid, '00475011', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- 2611 | DISTRIBUIDORA MEDICALCORP
  ('f0a79431-b6c3-434a-a198-946cde6a2ed5'::uuid, '00475012', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- 2613 | DISTRIBUIDORA MEDICALCORP
  ('8a505dec-3b04-4738-944d-e3ca581c1dfe'::uuid, '00475012', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- 2614 | DISTRIBUIDORA MEDICALCORP
  ('5cf6432f-2e40-48c5-a8f9-da117764824c'::uuid, '00474430', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-22'::date),  -- F92149 | FR MEDICAL SA DE CV
  ('6c9ca257-1ab9-47bc-b953-0aa7ec1a7073'::uuid, '00474429', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-22'::date),  -- F92151 | FR MEDICAL SA DE CV
  ('8107d177-4e08-4ec7-9ef4-689201dab8fc'::uuid, '00474428', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-22'::date),  -- F92554 | FR MEDICAL SA DE CV
  ('5d0dabd4-55f3-430b-ad56-a0019c67d450'::uuid, '00474428', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-22'::date),  -- F92555 | FR MEDICAL SA DE CV
  ('3a9352a2-855b-4b93-a451-54203e2cdf31'::uuid, '00475008', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- 23987 | GADMAR
  ('7664a5bb-4ce6-4730-92fe-58ce6d3aa289'::uuid, '00475016', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- F-GP-45 | GALBENI PHARMA
  ('5d3db4bf-1d4e-44d3-984d-a7dc6c3e7d52'::uuid, '00475016', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- F-GP-46 | GALBENI PHARMA
  ('e35d6c37-1e51-4490-9978-fc5c8dea9635'::uuid, '00469099', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', null, null, '2026-08-25'::date),  -- ALPF 110098342 | GRUPO EMEQUR
  ('be0244c5-8f4c-4265-b8d5-723a45be5d00'::uuid, '00471173', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45241', '44029', '2026-08-31'::date),  -- FVR00588 | IGSA MEDICAL SERVICES S.A. DE C.V.
  ('834cf9ab-7293-4b3e-a501-19908738b45f'::uuid, '00472742', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-19'::date),  -- JCB5742 | JESSICA CAROLINA BARRON CASTORENA
  ('25565236-f13e-4bf1-ae7c-928d437838b6'::uuid, '00474469', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- JCB6168 | JESSICA CAROLINA BARRON CASTORENA
  ('da4183a3-36f5-45f6-9d01-c6535599cd71'::uuid, '00464800', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', null, null, '2026-06-26'::date),  -- 20735/20644 | Jesús Manuel Romo Alba
  ('a9302bb9-fb45-4de0-b23a-57cd0d55fe5f'::uuid, '00475167', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-19'::date),  -- 21296 | Jesús Manuel Romo Alba
  ('c405cb63-315a-4488-90a4-8c3fe6ddd6f0'::uuid, '00475167', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-19'::date),  -- 21320 | Jesús Manuel Romo Alba
  ('7512ac8e-ced6-4559-8c6d-1d77159a2e39'::uuid, '00475171', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-29'::date),  -- 351 | JORGE HECTOR SALDIVAR VARGAS
  ('ecc45874-77a8-4558-afb4-41fc5f801585'::uuid, '00475005', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- 20516 | JUAN PABLO MENDOZA ROBLES
  ('24ed6563-b119-487a-8bc4-8b87d03778e1'::uuid, '00471193', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45125', '43915', '2026-09-14'::date),  -- 64085703 | LABORATORIOS PISA S.A. DE C.V.
  ('3d1a8ed9-b4bb-48ac-b106-a1f1eef3abc7'::uuid, '00471015', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45130', '43920', '2026-09-14'::date),  -- 64085704 | LABORATORIOS PISA S.A. DE C.V.
  ('680899b2-e9f4-44f1-bc2f-60e7d69e1c3c'::uuid, '00474747', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-27'::date),  -- F361 | LAURA MARTINEZ YAÑEZ
  ('fa286f5b-b0ef-4057-8e29-f360e8b84025'::uuid, '00474747', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-27'::date),  -- F362 | LAURA MARTINEZ YAÑEZ
  ('441508b9-8233-4f71-8d7b-e9cfa83c9585'::uuid, '00474437', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-22'::date),  -- MAN/2026/00376 | MANPREC, S.A. de C.V.
  ('bc4ebe8d-b84f-4cef-8108-07bff649125f'::uuid, '00472746', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-19'::date),  -- CD-2521 | MARTHA DELIA REYES RUIZ
  ('d757df38-e471-468d-95cd-675bf151de98'::uuid, '00475015', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- A3412 | MDSC PROJECT SAPI DE CV
  ('a1bc15a9-47a4-45e3-8a37-df2cc08caab5'::uuid, '00475090', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-19'::date),  -- 9822 | Mercedes Adriana Diaz Cano
  ('43c6f173-724b-402d-960f-5e01757c2ab7'::uuid, '00475698', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-27'::date),  -- 9823 | Mercedes Adriana Diaz Cano
  ('5bd7370a-6c1c-4ca2-80b6-78e9bda44f16'::uuid, '00475175', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-20'::date),  -- 9843 | Mercedes Adriana Diaz Cano
  ('d49d29a5-66a4-4c4f-bfad-5de73b32dbfc'::uuid, '00475176', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-20'::date),  -- 9847 | Mercedes Adriana Diaz Cano
  ('615d7c6d-6e48-4bca-b293-e693b6b566e0'::uuid, '00475176', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-20'::date),  -- 9853 | Mercedes Adriana Diaz Cano
  ('49d33578-6fd9-4d14-ac8a-7b6c15fdb857'::uuid, '00475175', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-20'::date),  -- 9854 | Mercedes Adriana Diaz Cano
  ('3043e1eb-3df8-4487-8f38-3d0a271b2e57'::uuid, '00473591', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-12'::date),  -- 27519 | OPERADORA MARTA S.A. DE C.V.
  ('58563cdd-91a1-4aaf-9be6-fa98859dc958'::uuid, '00470143', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45059', '43850', '2026-09-02'::date),  -- O22372 | OSTEO SCOPE S.A. DE C.V.
  ('f1a605c3-6c21-420d-bde6-26ccfb6e8267'::uuid, '00470146', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45060', '43851', '2026-09-02'::date),  -- O22502 | OSTEO SCOPE S.A. DE C.V.
  ('5c84861d-6a82-446a-ba38-ff63522fb326'::uuid, '00471703', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45240', '44028', '2026-09-07'::date),  -- O22630 | OSTEO SCOPE S.A. DE C.V.
  ('27daae0e-309c-4bf9-a163-f6c0fdfe020c'::uuid, '00469098', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-08-25'::date),  -- 2272 | PRO OMNIMEDIC
  ('4134a2de-c5bc-4a3c-bce2-0b94974e4d09'::uuid, '00471829', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45408', '44190', '2026-09-22'::date),  -- 4601553642 | PRODUCTOS HOSPITALARIOS S.A. DE C.V.
  ('c65bd6e3-ffbb-4587-8c92-908cedefa782'::uuid, '00474410', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', null, null, '2026-10-22'::date),  -- 86223 | PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.
  ('3ef5d9f4-8163-45da-be4a-63856cbeff44'::uuid, '00474779', 'gasto_reflejado', 'autorizada_admin_contrato', 'pendiente', null, null, '2026-10-27'::date),  -- 86256 | PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.
  ('2b7996c0-ab0f-400f-95c6-f0798360ba28'::uuid, '00472764', 'gasto_reflejado', 'autorizada_servicio', 'generado', null, null, '2026-10-19'::date),  -- PH24563 | PROVEEDORA HOSPITALARIA DEL BAJIO
  ('78f3de23-c334-4022-9da2-b1e41827dcab'::uuid, '00473585', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-12'::date),  -- PH24637 | PROVEEDORA HOSPITALARIA DEL BAJIO
  ('857c69e3-483e-4ce6-9243-7aeba045e326'::uuid, '00473585', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-12'::date),  -- PH24638 | PROVEEDORA HOSPITALARIA DEL BAJIO
  ('a08fb481-2588-4dab-8b64-c99362f70287'::uuid, '00474431', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- PH24681 | PROVEEDORA HOSPITALARIA DEL BAJIO
  ('d5297c1c-88e1-4ee3-a305-e06ed1ff2dea'::uuid, '00474970', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- PH24730 | PROVEEDORA HOSPITALARIA DEL BAJIO
  ('f3f96545-5a09-4e9b-a2d3-8693a3532420'::uuid, '00474970', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- PH24731 | PROVEEDORA HOSPITALARIA DEL BAJIO
  ('ea88a0cb-8578-49e9-8bd4-f004c26299fa'::uuid, '00473221', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45657', '44437', '2026-10-07'::date),  -- MTY26685 | REACTIVOS Y QUIMICOS S.A. DE C.V.
  ('a82e5a28-cefc-4743-9743-3fbcad669bc8'::uuid, '00473222', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45658', '44440', '2026-10-07'::date),  -- MTY26686 | REACTIVOS Y QUIMICOS S.A. DE C.V.
  ('fa1c8f71-645d-4ef6-878c-4f2c9d2a1147'::uuid, '00470138', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45069', '43860', '2026-09-02'::date),  -- FAC23666 | RELIABLE DE MÉXICO, S.A. DE C.V.
  ('c6d6667a-aac1-4b0d-ab97-39ea9b89d9b3'::uuid, '00472018', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45415', '44197', '2026-09-09'::date),  -- FAC23698 | RELIABLE DE MÉXICO, S.A. DE C.V.
  ('aa0758c8-d96c-4eeb-8568-76da4c598836'::uuid, '00474424', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- B03881 | REPRESENTACIONES MEDICAS Y DE LABORATORIOS DE GUADALAJARA
  ('90915737-b6e0-44da-8d90-bbb43c7984b4'::uuid, '00474424', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- B03882 | REPRESENTACIONES MEDICAS Y DE LABORATORIOS DE GUADALAJARA
  ('096a5b2a-abec-48bf-a99e-434abdd58d9d'::uuid, '00474424', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-22'::date),  -- B03883 | REPRESENTACIONES MEDICAS Y DE LABORATORIOS DE GUADALAJARA
  ('eecb1e66-d9dc-41e6-b9ed-f01efaa4deb5'::uuid, '00475168', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-29'::date),  -- B3946 | REPRESENTACIONES MEDICAS Y DE LABORATORIOS DE GUADALAJARA
  ('4c86526d-d286-4194-837c-425f7731eb38'::uuid, '00474964', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- B3948 | REPRESENTACIONES MEDICAS Y DE LABORATORIOS DE GUADALAJARA
  ('89ab16ae-6db1-4da7-afe7-57febced593c'::uuid, '00474966', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- A1156 | SIRAMEDIC SA DE CV
  ('967382b3-378c-403b-a678-7eaf8d50323c'::uuid, '00475009', 'gasto_reflejado', 'autorizada_servicio', 'pendiente', null, null, '2026-10-28'::date),  -- A1159 | SIRAMEDIC SA DE CV
  ('6741f696-ba0a-4d3f-b392-ca1ae85e2a8e'::uuid, '00474463', 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '45873', '44651', '2026-10-22'::date),  -- A10701 | Tecnología en Órtesis y Prótesis
  ('3d24f64c-55c1-4cf4-8013-5d26ef5ca486'::uuid, '00474438', 'en_tramite_ooad', 'autorizada_servicio', 'pendiente', null, null, null::date),  -- AI104693 | ABASTECEDORA MEDICA HOSPITALARIA DE AGUASCALIENTES
  ('5539d08f-c193-4b9f-8e0f-c07dfd7eacfa'::uuid, '00475896', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 4558 | Ana Karen Perez Alvarez
  ('8fc5eb00-0795-4b0d-9921-a181ef35807b'::uuid, '00475896', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 4559 | Ana Karen Perez Alvarez
  ('f1bc0980-9a11-4602-a5f4-a840c0e88365'::uuid, '00475896', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 4560 | Ana Karen Perez Alvarez
  ('e0fab324-8f7f-458e-8dca-71076e289e1b'::uuid, '00475896', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 4561 | Ana Karen Perez Alvarez
  ('b0e96213-7fc1-4e00-8885-6d287c5bb735'::uuid, '00475896', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 4562 | Ana Karen Perez Alvarez
  ('f1b39d12-6033-4e0a-881b-e8a3868b3ab3'::uuid, '00475900', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 4563 | Ana Karen Perez Alvarez
  ('eba03c8a-1a67-4721-abee-8ffb25cc65ad'::uuid, '00475900', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 4564 | Ana Karen Perez Alvarez
  ('dc1f4205-6867-4674-bf7c-3feebb0b2eae'::uuid, '00475900', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 4565 | Ana Karen Perez Alvarez
  ('ed034434-fc8d-4dd6-b3f3-9802541bbcf1'::uuid, '00475900', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 4566 | Ana Karen Perez Alvarez
  ('56592181-16e2-44dc-8bea-5a24a3c160de'::uuid, '00475900', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 4567 | Ana Karen Perez Alvarez
  ('60da62a2-0291-4d53-a3dc-0c40c0fe34a3'::uuid, '00475914', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 41096 | AUTOBUSES DE LA PIEDAD, S.A. DE C.V.
  ('c4c5b9a6-3594-4a29-88c8-14d754378b21'::uuid, '00475915', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 41375 | AUTOBUSES DE LA PIEDAD, S.A. DE C.V.
  ('752cfa4c-5eef-4600-84c5-f0c89dbb7958'::uuid, '00475385', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46175', '44949', null::date),  -- EF592307 | BAXTER S.A. DE C.V.
  ('f5ee53dc-892d-44e1-953b-c5ab941da7bf'::uuid, '00475488', 'en_tramite_ooad', 'autorizada_servicio', 'generado', null, null, null::date),  -- 4517 | BEATRIZ IBARRA RODRIGUEZ
  ('17d38b45-9319-4d7d-a04c-7584d5dd18ba'::uuid, '00475358', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46022', '44801', null::date),  -- HD9581 | BIODIST, S.A. de C.V.
  ('2550fbac-71eb-456d-bc18-f9d6bcdfb7f7'::uuid, '00475908', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46094', '44870', null::date),  -- HD9636 | BIODIST, S.A. de C.V.
  ('db1a8392-7c30-47bb-8618-c6d27e791fe4'::uuid, '00475911', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46095', '44871', null::date),  -- HD9637 | BIODIST, S.A. de C.V.
  ('f663eb03-4380-47e0-bb11-5e5cb279e76f'::uuid, '00476287', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46425', '45198', null::date),  -- HD9639 | BIODIST, S.A. de C.V.
  ('e9f997e4-3cfb-4598-9399-a8a3a0cf93b1'::uuid, '00475526', 'en_tramite_ooad', 'autorizada_servicio', 'generado', null, null, null::date),  -- A7B9DF62 | COMERCIALIZADORA NEUROQUIRURGICA DEL BAJIO
  ('a2157658-3cbc-4bd5-936f-c83508cf0d44'::uuid, '00475606', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- INV/2026/00530 | COMERCIALIZADORA STÄDEL DEL NORTE, S.A. DE C.V.
  ('659144ba-c593-4037-bdbd-4689f62f1fc4'::uuid, '00476338', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46409', '45183', null::date),  -- A1757 | Derma Body, S.A. de C.V.
  ('1211862f-664b-4400-aef2-3c1d5b1ab397'::uuid, '00476574', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46410', '45184', null::date),  -- A1772 | Derma Body, S.A. de C.V.
  ('82836b50-45db-4baa-8cf4-91f2c415b6ea'::uuid, '00476197', 'en_tramite_ooad', 'autorizada_servicio', 'pendiente', null, null, null::date),  -- FAC3346 | DIEGO OSVALDO CABRERA ROMERO
  ('e799aa4f-d449-49e2-90b1-6efb52b57154'::uuid, '00475330', 'en_tramite_ooad', 'autorizada_servicio', 'pendiente', null, null, null::date),  -- 2612 | DISTRIBUIDORA MEDICALCORP
  ('b1265edb-249d-4c71-99e6-9524cfe4472b'::uuid, '00475208', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46064', '44842', null::date),  -- FVR-01250 | IGSA MEDICAL SERVICES S.A. DE C.V.
  ('3aaf8a3e-74dc-415c-a29e-749e631f85de'::uuid, '00476315', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46394', '45168', null::date),  -- FVR-01506 | IGSA MEDICAL SERVICES S.A. DE C.V.
  ('ffa0911e-0b9e-484b-bfbe-aa71102dfbaf'::uuid, '00476484', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46548', '45319', null::date),  -- FVR-01550 | IGSA MEDICAL SERVICES S.A. DE C.V.
  ('d5776225-8f1f-400e-8e2d-30ee77ce604e'::uuid, '00476283', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46516', '45287', null::date),  -- 9687 MINS | INTERMET S.A. DE C.V.
  ('cc0a9968-91c8-48ef-9cf4-4fe8a5a991bf'::uuid, '00476335', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46421', '45195', null::date),  -- MINS 9633 | INTERMET S.A. DE C.V.
  ('bf9dc0e3-86d4-416f-bae5-dc29f782aae0'::uuid, '00475198', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 21289 | Jesús Manuel Romo Alba
  ('71ed454a-2430-43df-afe5-1561a87ea57a'::uuid, '00475198', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 21290 | Jesús Manuel Romo Alba
  ('93e7025f-4593-4a9e-9053-df3e9a1c8339'::uuid, '00475205', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 21318 | Jesús Manuel Romo Alba
  ('b67f15d3-01ab-4ef0-b96d-2ee6eca61b33'::uuid, '00475205', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 21319 | Jesús Manuel Romo Alba
  ('042644af-44cd-4e92-9151-951590a86cb2'::uuid, '00475203', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 21358 | Jesús Manuel Romo Alba
  ('ee74bdb8-20f7-440c-872c-d96c68311fbf'::uuid, '00475203', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 21359 | Jesús Manuel Romo Alba
  ('e11cab67-4397-4982-9485-b3d4cfdb3aa3'::uuid, '00475902', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 4295 | LABORATORIO CLINICO PROFESIONAL Y BACTERIOLOGICO
  ('1fcc06ce-4b12-4e67-8704-64460cb7e4c4'::uuid, '00476332', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46416', '45190', null::date),  -- 64157913 | LABORATORIOS PISA S.A. DE C.V.
  ('9f453954-f61f-4271-bfe1-8d9f6801dc12'::uuid, '00476319', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46414', '45188', null::date),  -- 64157915 | LABORATORIOS PISA S.A. DE C.V.
  ('dfb81d67-b469-4956-8598-d88ad13b31a6'::uuid, '00476318', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46415', '45189', null::date),  -- 64226119 | LABORATORIOS PISA S.A. DE C.V.
  ('b78ad1b2-487d-4075-9cdc-2afcfb14e83e'::uuid, '00474750', 'en_tramite_ooad', 'autorizada_servicio', 'pendiente', null, null, null::date),  -- F364 | LAURA MARTINEZ YAÑEZ
  ('4991679f-a28e-40b2-b46e-8601bb07521a'::uuid, '00475174', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 3779 | MEDICA SAN JUAN DE AGUASCALIENTES
  ('f351fd09-5247-4ffc-a48e-27750d5a112a'::uuid, '00475587', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 3780 | MEDICA SAN JUAN DE AGUASCALIENTES
  ('449911ab-6f96-4036-a7b8-7936a65a3407'::uuid, '00475173', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 3852 | MEDICA SAN JUAN DE AGUASCALIENTES
  ('a74df021-cf98-431b-bf10-dcd62ac23cb8'::uuid, '00475173', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 3853 | MEDICA SAN JUAN DE AGUASCALIENTES
  ('b7e8cb25-31bb-40e8-9d00-49ad8f237214'::uuid, '00475174', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 3868 | MEDICA SAN JUAN DE AGUASCALIENTES
  ('8acc4ed5-881b-48e1-bd52-57988656ffa9'::uuid, '00476288', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 3927 | MEDICA SAN JUAN DE AGUASCALIENTES
  ('e3df1c32-129b-4631-b9db-f90e0a00a9c7'::uuid, '00476285', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 9868 | Mercedes Adriana Diaz Cano
  ('8f5586cb-e540-4f44-be92-ded3faf17696'::uuid, '00476285', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 9869 | Mercedes Adriana Diaz Cano
  ('c015e065-fcef-4a07-b1ad-0b3c8324d7f3'::uuid, '00476286', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 9870 | Mercedes Adriana Diaz Cano
  ('4f532d84-cd69-4fa0-a2d6-8423a9807e1c'::uuid, '00476286', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 9871 | Mercedes Adriana Diaz Cano
  ('99d60f14-41c5-46e6-9013-af0cccc8cd45'::uuid, '00475602', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 2523 | PRO OMNIMEDIC
  ('8d1762f7-7562-4aea-866e-bd89de3015e0'::uuid, '00475357', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46181', '44955', null::date),  -- 4601580626 | PRODUCTOS HOSPITALARIOS S.A. DE C.V.
  ('1f056bb7-2c1d-412d-9c8f-f3f33963ad44'::uuid, '00474411', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', null, null, null::date),  -- 86222 | PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.
  ('26a084b6-7071-4ea0-b1bb-f160bee37081'::uuid, '00474408', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', null, null, null::date),  -- 86228 | PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.
  ('5b3561fe-6761-440f-95e7-ed5a542c1c28'::uuid, '00474773', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 86254 | PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.
  ('26b39e31-b54b-47f7-b6d9-4d54e4749237'::uuid, '00474776', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 86255 | PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.
  ('c2a1609d-7f4d-47d6-a716-0d4f8c2b2712'::uuid, '00475906', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 86335 | PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.
  ('da8d7f53-0224-4590-b917-c8f7f866cfcb'::uuid, '00476311', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46405', '45179', null::date),  -- MTY26760 | REACTIVOS Y QUIMICOS S.A. DE C.V.
  ('7512f857-3877-41af-bfc9-9ec2f56fa956'::uuid, '00476334', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46406', '45180', null::date),  -- MTY26935 | REACTIVOS Y QUIMICOS S.A. DE C.V.
  ('467904c2-bc57-4362-a759-75195c6e3e21'::uuid, '00476328', 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', '46397', '45171', null::date),  -- FAC 23835 | RELIABLE DE MÉXICO, S.A. DE C.V.
  ('e8321609-5eaa-49b9-b9e4-4433e8750ced'::uuid, '00476472', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 33002964 | SERVICIOS DE INGENIERIA EN MEDICINA, S.A. DE C.V.
  ('9ee99db8-a1da-4028-870b-8b6d9a5299c9'::uuid, '00476472', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 33002965 | SERVICIOS DE INGENIERIA EN MEDICINA, S.A. DE C.V.
  ('8c27826d-7eca-4d02-b771-f065b5a1e5fe'::uuid, '00476470', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 33002966 | SERVICIOS DE INGENIERIA EN MEDICINA, S.A. DE C.V.
  ('373643de-5251-4c80-aaf7-088cfbf3ccf4'::uuid, '00476470', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 33002967 | SERVICIOS DE INGENIERIA EN MEDICINA, S.A. DE C.V.
  ('29466dd9-2ca9-4363-8b47-9f509c3239e0'::uuid, '00476470', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date),  -- 33002968 | SERVICIOS DE INGENIERIA EN MEDICINA, S.A. DE C.V.
  ('295d83ed-140f-42ad-bf8a-f080e4a9e5e1'::uuid, '00476469', 'en_tramite_ooad', 'autorizada_admin_contrato', 'pendiente', null, null, null::date)   -- 33002969 | SERVICIOS DE INGENIERIA EN MEDICINA, S.A. DE C.V.
),
upd as (
  update facturas f set
    cr_contrarecibo          = pd.cr,
    estatus_general          = pd.gen::estatus_general,
    estatus_firmas           = pd.fir::estatus_firmas,
    estatus_pedido_recepcion = pd.pr::estatus_pedido_recepcion,
    numero_pedido            = coalesce(pd.pedido, f.numero_pedido),
    numero_recepcion         = coalesce(pd.recepcion, f.numero_recepcion),
    fecha_pago               = coalesce(pd.fecha_pago, f.fecha_pago)
  from pd
  where f.id = pd.id
    and f.anulada = false
    and f.estatus_general in ('enviada_ooad', 'en_tramite_ooad')
    and nullif(btrim(coalesce(f.cr_contrarecibo, '')), '') is null
  returning f.id, f.estatus_general
)
select (select count(*) from pd)                                     as propuestas,
       count(*)                                                      as actualizadas,
       count(*) filter (where estatus_general = 'gasto_reflejado')  as quedaron_pagadas,
       count(*) filter (where estatus_general = 'en_tramite_ooad')  as quedaron_en_tramite
from upd;