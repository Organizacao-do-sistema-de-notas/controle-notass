SELECT jsonb_build_object(
  'banco', current_database(),
  'instancia', (SELECT system_identifier::text FROM pg_control_system()),
  'objetosUsuario', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f'))
);
