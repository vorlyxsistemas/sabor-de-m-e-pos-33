-- Atualizar o usuário teste@admin.com para role admin
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = 'a349f7ea-cf0e-46f5-9f5d-78fbfa38fe1b';