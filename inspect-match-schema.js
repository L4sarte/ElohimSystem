const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
let secretKey = '';
let supabaseUrl = '';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    if (line.trim().startsWith('#') || !line.includes('=')) return;
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    const trimmedKey = key.trim();
    if (trimmedKey === 'SUPABASE_SERVICE_ROLE_KEY') {
      secretKey = value;
    } else if (trimmedKey === 'NEXT_PUBLIC_SUPABASE_URL') {
      supabaseUrl = value;
    }
  });
}

async function run() {
  if (!secretKey) return;
  const url = `${supabaseUrl}/rest/v1/`;
  const response = await fetch(url, {
    headers: {
      'apikey': secretKey,
      'Authorization': `Bearer ${secretKey}`,
      'Accept': 'application/openapi+json'
    }
  });

  const schema = await response.json();
  ['products', 'clients'].forEach(t => {
    if (schema.definitions && schema.definitions[t]) {
      console.log(`\n=== ${t.toUpperCase()} TABLE SCHEMA ===`);
      const props = schema.definitions[t].properties;
      Object.keys(props).forEach(name => {
        console.log(`- ${name}: ${props[name].type} (${props[name].format || ''})`);
      });
    }
  });
}

run();
