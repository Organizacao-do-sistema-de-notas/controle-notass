-- This function exists only in the validation session. Older backups have ten
-- tables; shared Excel is included whenever its table is present.
CREATE OR REPLACE FUNCTION pg_temp.resumo_controle_notas(tabela text, coluna text, ordenar_texto boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql AS $func$
DECLARE resultado jsonb;
BEGIN
  EXECUTE format(
    'SELECT jsonb_build_object(''quantidade'', count(*), ''sha256'', encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(x)::text, E''\n'' ORDER BY x.%I%s), ''''), ''UTF8'')), ''hex'')) FROM public.%I x',
    coluna, CASE WHEN ordenar_texto THEN ' COLLATE "C"' ELSE '' END, tabela
  ) INTO resultado;
  RETURN resultado;
END;
$func$;
SELECT jsonb_build_object('versao', 1, 'banco', current_database(), 'tabelas',
  jsonb_build_object(
    'Cliente', pg_temp.resumo_controle_notas('Cliente', 'id'),
    'Contabilidade', pg_temp.resumo_controle_notas('Contabilidade', 'id'),
    'ClienteNomeAlternativo', pg_temp.resumo_controle_notas('ClienteNomeAlternativo', 'id'),
    'ProcedimentoCliente', pg_temp.resumo_controle_notas('ProcedimentoCliente', 'id'),
    'HistoricoContabilidadeCliente', pg_temp.resumo_controle_notas('HistoricoContabilidadeCliente', 'id'),
    'Pendencia', pg_temp.resumo_controle_notas('Pendencia', 'id'),
    'HistoricoPendencia', pg_temp.resumo_controle_notas('HistoricoPendencia', 'id'),
    'ClienteConfere', pg_temp.resumo_controle_notas('ClienteConfere', 'codigo', true),
    'ContabilidadeConfere', pg_temp.resumo_controle_notas('ContabilidadeConfere', 'codigo', true),
    '_prisma_migrations', pg_temp.resumo_controle_notas('_prisma_migrations', 'id', true)
  ) || CASE WHEN to_regclass('public."ExcelCompartilhado"') IS NULL THEN '{}'::jsonb ELSE
    jsonb_build_object('ExcelCompartilhado', pg_temp.resumo_controle_notas('ExcelCompartilhado', 'id', true)) END
);
