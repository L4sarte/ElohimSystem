import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Verificación segura de variables de entorno para evitar fallos catastróficos en build estático,
// pero alertando claramente si faltan en tiempo de ejecución.
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured && typeof window !== 'undefined') {
  console.warn(
    'Elohim Import ERP: Las variables de entorno de Supabase no están configuradas en .env.local. ' +
    'La conexión con la base de datos no funcionará hasta que se configuren.'
  );
}

// Exportamos el cliente de Supabase usando placeholders válidos en estructura si no están definidos
// para no romper la fase de compilación de Next.js.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

// Utilidad auxiliar para comprobar si la conexión está lista
export const isSupabaseConfigured = (): boolean => {
  return isConfigured && 
    supabaseUrl !== 'https://placeholder-project.supabase.co' &&
    supabaseAnonKey !== 'placeholder-anon-key';
};

// Cliente administrativo para Server Actions que requieren saltar RLS temporalmente o en desarrollo
export const getServiceSupabase = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL no configurado');
  }
  
  // Usar anon key como respaldo si no hay service key para evitar fallar en build estático
  return createClient(
    url,
    serviceKey || supabaseAnonKey || 'placeholder-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
};

