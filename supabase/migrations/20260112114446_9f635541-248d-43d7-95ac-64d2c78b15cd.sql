-- Create function to safely match user_id by email from auth.users
CREATE OR REPLACE FUNCTION public.match_user_id_by_email(p_email text)
RETURNS uuid AS $$
  SELECT id FROM auth.users WHERE LOWER(email) = LOWER(p_email) LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.match_user_id_by_email(text) TO authenticated;