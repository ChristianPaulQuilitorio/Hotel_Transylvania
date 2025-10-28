// Generates src/environments/environment.prod.ts from Vercel/CI env vars.
// Falls back to existing environment.ts values if vars are missing to avoid build breaks.

const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '..', 'src', 'environments', 'environment.prod.ts');

// Support multiple env var names (Vercel UI might use camelCase)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NG_SUPABASE_URL || process.env.supabaseUrl || process.env.supabaseUrl1 || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NG_SUPABASE_ANON_KEY || process.env.supabaseAnonKey || '';

let content = `// Auto-generated at build time\nexport const environment = {\n  supabaseUrl: '${supabaseUrl}',\n  supabaseAnonKey: '${supabaseAnonKey}'\n};\n`;

// Basic escape for backslashes and backticks (unlikely in URL/key)
content = content.replace(/`/g, '\\`');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, content, 'utf8');
if (!supabaseUrl || !supabaseAnonKey) {
	console.warn('[env] Warning: SUPABASE_URL/ANON_KEY missing. environment.prod.ts was written with empty values.');
} else {
	console.log('[env] Wrote environment.prod.ts with supplied env vars');
}
