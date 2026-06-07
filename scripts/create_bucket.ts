import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  const { data, error } = await supabase.storage.createBucket('slips', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
    fileSizeLimit: 5242880, // 5MB
  });
  
  if (error) {
    console.error('Error creating bucket:', error);
  } else {
    console.log('Bucket created:', data);
  }
}

main();
