-- SecuredLanding marketplace media access policies
-- Allows signed-in users to read marketplace media objects.

DROP POLICY IF EXISTS "Authenticated users can view approved borrower videos"
ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can view borrower videos"
ON storage.objects;

CREATE POLICY "Authenticated users can view borrower videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'borrower-videos');

DROP POLICY IF EXISTS "Authenticated users can view property photos"
ON storage.objects;

CREATE POLICY "Authenticated users can view property photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'property-photos');

DROP POLICY IF EXISTS "Authenticated users can view approved property photos"
ON public.property_photos;

CREATE POLICY "Authenticated users can view approved property photos"
ON public.property_photos
FOR SELECT
TO authenticated
USING (review_status = 'approved');
