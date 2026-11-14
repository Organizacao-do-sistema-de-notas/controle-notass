SELECT jsonb_build_object('versao', 1, 'banco', current_database(), 'tabelas', jsonb_build_object(
  'Cliente', (SELECT jsonb_build_object(
    'quantidade', count(*),
    'sha256', encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY x.id), ''), 'UTF8')), 'hex')
  ) FROM public."Cliente" x),
  'Contabilidade', (SELECT jsonb_build_object(
    'quantidade', count(*),
    'sha256', encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY x.id), ''), 'UTF8')), 'hex')
  ) FROM public."Contabilidade" x),
  'ClienteNomeAlternativo', (SELECT jsonb_build_object(
    'quantidade', count(*),
    'sha256', encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY x.id), ''), 'UTF8')), 'hex')
  ) FROM public."ClienteNomeAlternativo" x),
  'ProcedimentoCliente', (SELECT jsonb_build_object(
    'quantidade', count(*),
    'sha256', encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY x.id), ''), 'UTF8')), 'hex')
  ) FROM public."ProcedimentoCliente" x),
  'HistoricoContabilidadeCliente', (SELECT jsonb_build_object(
    'quantidade', count(*),
    'sha256', encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY x.id), ''), 'UTF8')), 'hex')
  ) FROM public."HistoricoContabilidadeCliente" x),
  'Pendencia', (SELECT jsonb_build_object(
    'quantidade', count(*),
    'sha256', encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY x.id), ''), 'UTF8')), 'hex')
  ) FROM public."Pendencia" x),
  'HistoricoPendencia', (SELECT jsonb_build_object(
    'quantidade', count(*),
    'sha256', encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY x.id), ''), 'UTF8')), 'hex')
  ) FROM public."HistoricoPendencia" x),
  'ClienteConfere', (SELECT jsonb_build_object(
    'quantidade', count(*),
    'sha256', encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY x.codigo COLLATE "C"), ''), 'UTF8')), 'hex')
  ) FROM public."ClienteConfere" x),
  'ContabilidadeConfere', (SELECT jsonb_build_object(
    'quantidade', count(*),
    'sha256', encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY x.codigo COLLATE "C"), ''), 'UTF8')), 'hex')
  ) FROM public."ContabilidadeConfere" x),
  '_prisma_migrations', (SELECT jsonb_build_object(
    'quantidade', count(*),
    'sha256', encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(x)::text, E'\n' ORDER BY x.id COLLATE "C"), ''), 'UTF8')), 'hex')
  ) FROM public."_prisma_migrations" x)
));
