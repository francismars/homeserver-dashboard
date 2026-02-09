import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';

const CONFIG_PATH = process.env.HOMESERVER_CONFIG_PATH || '/app/homeserver-data/config.toml';

// Fields to redact from the config for security
const REDACT_PATTERNS = [/^admin_password\s*=\s*".*"/, /^database_url\s*=\s*".*"/];

function redactConfig(content: string): string {
  return content
    .split('\n')
    .map((line) => {
      for (const pattern of REDACT_PATTERNS) {
        if (pattern.test(line.trim())) {
          const key = line.split('=')[0];
          return `${key}= "********"`;
        }
      }
      return line;
    })
    .join('\n');
}

/**
 * GET /api/server-config
 * Returns the homeserver config.toml (read-only, with sensitive fields redacted).
 */
export async function GET() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const redacted = redactConfig(raw);
    return NextResponse.json({ config: redacted });
  } catch (e: unknown) {
    const isNotFound = (e as NodeJS.ErrnoException).code === 'ENOENT';
    if (isNotFound) {
      return NextResponse.json(
        { error: 'Config file not found. The homeserver may not have started yet.' },
        { status: 404 }
      );
    }
    console.error('Failed to read server config:', e);
    return NextResponse.json({ error: 'Failed to read config file' }, { status: 500 });
  }
}
