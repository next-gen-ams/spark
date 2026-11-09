alter table public.content
  add column additional_publish_links jsonb not null default '[]'::jsonb
  constraint uq_content_additional_publish_links_array
  check (jsonb_typeof(additional_publish_links) = 'array');
