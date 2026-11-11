// =====================================================
// SUPABASE AUTH & ROUND SAVING
// =====================================================
const SUPABASE_URL = 'https://dstitvnkgefekmkcwndm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzdGl0dm5rZ2VmZWtta2N3bmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODkzNzgsImV4cCI6MjA4NjE2NTM3OH0.znndZ6B0bSWFWky2IVMYhsv_pcgXcd3t3lWM4AAxF9c';
export const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);