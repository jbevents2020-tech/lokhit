alter table public.news
add column if not exists seo_keywords text[] not null default '{}';
