-- Create the storage bucket for PEP evaluation PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('pep-evaluations', 'pep-evaluations', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to PDFs
CREATE POLICY "Public can view PEP PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'pep-evaluations');

-- Allow authenticated users to upload PDFs (edge function uses service role, but this is a fallback)
CREATE POLICY "Authenticated users can upload PEP PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pep-evaluations');

-- Allow updates to PEP PDFs
CREATE POLICY "Authenticated users can update PEP PDFs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'pep-evaluations');