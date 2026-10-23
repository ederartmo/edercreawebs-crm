-- Migration: Change project_type from single enum to array
-- Apply in Supabase SQL Editor.

alter table public.projects
  alter column project_type type public.project_type[]
  using array[project_type];
