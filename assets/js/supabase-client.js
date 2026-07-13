const SUPABASE_URL = "https://wtyralabvgrxxedhqrfj.supabase.co";
const SUPABASE_KEY = "sb_publishable_zHbnogYy1cf7Nksso92mgA_phtXZd3p";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function uploadPastaImage(file) {
  if (!file) return null;
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseClient.storage.from("pasta-images").upload(path, file);
  if (error) throw error;
  const { data } = supabaseClient.storage.from("pasta-images").getPublicUrl(path);
  return data.publicUrl;
}
