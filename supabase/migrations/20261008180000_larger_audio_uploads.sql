-- Allow backing tracks up to 50 MB so WAV files fit (about 10 MB per minute).
-- The app still caps sheet music at 20 MB per file.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
      'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav'
    ]
where id = 'music';
