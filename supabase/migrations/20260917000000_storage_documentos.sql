-- Bucket para os documentos que o médico envia para leitura por IA.
--
-- O arquivo deixa de trafegar pelo servidor: o navegador envia direto para cá
-- com a sessão do próprio médico, e o backend só recebe o caminho e lê daqui.
-- Isso existe porque função serverless tem limite de corpo de requisição muito
-- abaixo dos 20 MB que o app aceita.
--
-- Privado. Nada aqui é servido por URL pública.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-clinicos',
  'documentos-clinicos',
  false,
  20971520, -- 20 MB, o mesmo limite que a tela informa ao médico
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/markdown'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- O caminho é sempre <auth.uid()>/<algo>, e é isso que a policy verifica.
-- USING controla o que o médico enxerga; WITH CHECK controla onde ele grava.
-- Só USING deixaria um médico escrever na pasta de outro.
drop policy if exists documentos_proprios on storage.objects;
create policy documentos_proprios on storage.objects
  for all to authenticated
  using (
    bucket_id = 'documentos-clinicos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'documentos-clinicos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Sem policy para anon significa negado — é o padrão do RLS e é o que queremos:
-- anon não toca em documento de paciente.
