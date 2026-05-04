create or replace function public.delete_auth_user(target_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() not in ('MASTER', 'ADMIN', 'SUPERVISOR') then
    raise exception 'Permissão negada para excluir usuário.';
  end if;

  -- Excluir de auth.users dispara ON DELETE CASCADE em profiles.auth_user_id
  delete from auth.users where id = target_auth_user_id;
end;
$$;
