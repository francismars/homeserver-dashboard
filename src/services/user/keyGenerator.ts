import { Keypair, PublicKey, Client } from '@synonymdev/pubky';

export type GeneratedKeypair = {
  keypair: Keypair;
  publicKey: string; // z-base-32 encoded
  secretKey: Uint8Array;
  secretKeyHex: string; // hex encoded for display/storage
};

/**
 * Generate a new ed25519 keypair for a user.
 */
export function generateKeypair(): GeneratedKeypair {
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey().z32();
  const secretKey = keypair.secretKey();
  
  // Convert secret key to hex for display/storage
  const secretKeyHex = Array.from(secretKey)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    keypair,
    publicKey,
    secretKey,
    secretKeyHex,
  };
}

/**
 * Sign up a new user directly to a local homeserver by calling the /signup endpoint.
 * 
 * Uses the SDK's testnet client which rewrites URLs to localhost, bypassing PKARR resolution.
 * This works for local homeservers even when running in mainnet mode.
 */
export async function signupUserDirect(
  keypair: Keypair,
  clientBaseUrl: string,
  signupToken?: string,
  homeserverPubkey?: string
): Promise<{ pubkey: string }> {
  console.log('[signupUserDirect] Starting direct signup...');
  console.log('[signupUserDirect] Client base URL:', clientBaseUrl);
  console.log('[signupUserDirect] Homeserver pubkey:', homeserverPubkey || '(not needed for direct signup)');
  console.log('[signupUserDirect] Signup token:', signupToken || '(none)');
  console.log('[signupUserDirect] User pubkey:', keypair.publicKey().z32());
  
  if (!homeserverPubkey) {
    throw new Error(
      'Homeserver pubkey is required for signup. ' +
      'You can find it in your homeserver startup logs (look for "Homeserver Pubky TLS listening on https://...").'
    );
  }

  try {
    // Extract hostname from clientBaseUrl for testnet client
    const url = new URL(clientBaseUrl);
    let host = url.hostname;
    
    // Normalize 127.0.0.1 and ::1 to localhost for testnet client
    // The testnet client expects 'localhost' to properly rewrite URLs
    if (host === '127.0.0.1' || host === '::1') {
      host = 'localhost';
    }
    
    // Use testnet client which rewrites URLs to localhost, bypassing PKARR resolution
    // This works for local homeservers even in mainnet mode
    const client = Client.testnet(host);
    const homeserverPublicKey = PublicKey.from(homeserverPubkey);
    
    console.log('[signupUserDirect] Using testnet client for local homeserver');
    console.log('[signupUserDirect] Host:', host);
    console.log('[signupUserDirect] Homeserver PublicKey:', homeserverPubkey);
    
    // The testnet client should rewrite the homeserver URL to localhost
    // and bypass PKARR resolution
    const session = await client.signup(keypair, homeserverPublicKey, signupToken || null);
    console.log('[signupUserDirect] Signup successful via SDK!');
    
    return {
      pubkey: keypair.publicKey().z32(),
    };
  } catch (error) {
    console.error('[signupUserDirect] Signup failed:', error);
    
    // Log full error details
    if (error instanceof Error) {
      console.error('[signupUserDirect] Error name:', error.name);
      console.error('[signupUserDirect] Error message:', error.message);
      console.error('[signupUserDirect] Error stack:', error.stack);
      
      if ('cause' in error) {
        console.error('[signupUserDirect] Error cause:', error.cause);
      }
    } else {
      console.error('[signupUserDirect] Unknown error type:', typeof error, error);
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Provide helpful error message
    throw new Error(
      `Signup failed: ${errorMessage}\n\n` +
      `Make sure:\n` +
      `1. The homeserver is running and accessible at ${clientBaseUrl}\n` +
      `2. The homeserver pubkey is correct: ${homeserverPubkey}\n` +
      `3. If using a signup token, it's valid and not already used\n\n` +
      `Check the browser console (F12) for detailed network errors.`
    );
  }
}

/**
 * Sign up a new user to the homeserver using the generated keypair.
 * Uses the SDK which handles AuthToken creation automatically.
 * 
 * Automatically detects local homeservers and uses testnet client to bypass PKARR resolution.
 * For remote/mainnet homeservers, uses mainnet client with PKARR resolution.
 */
export async function signupUser(
  keypair: Keypair,
  homeserverPubkey: string | null | undefined,
  signupToken: string | undefined,
  clientBaseUrl?: string
): Promise<{ pubkey: string; session?: any }> {
  if (!homeserverPubkey) {
    throw new Error(
      'Homeserver pubkey is required for signup. ' +
      'You can find it in your homeserver startup logs (look for "Homeserver Pubky TLS listening on https://...").'
    );
  }

  // Determine if we're calling a local homeserver
  const isLocalHomeserver = clientBaseUrl && (
    clientBaseUrl.includes('localhost') || 
    clientBaseUrl.includes('127.0.0.1') ||
    clientBaseUrl.includes('::1')
  );

  // For local homeservers, use testnet client which bypasses PKARR resolution
  if (isLocalHomeserver && clientBaseUrl) {
    console.log('[signupUser] Detected local homeserver, using testnet client');
    return await signupUserDirect(keypair, clientBaseUrl, signupToken, homeserverPubkey);
  }

  // For remote/mainnet homeservers, use mainnet client with PKARR resolution
  console.log('[signupUser] Using mainnet client with PKARR resolution');
  
  // Create mainnet Client instance
  const client = new Client({
    pkarr: { 
      relays: process.env.NEXT_PUBLIC_PKARR_RELAYS?.split(',') || [],
      requestTimeout: null 
    },
    userMaxRecordAge: null,
  });

  // Get homeserver public key
  const homeserverPublicKey = PublicKey.from(homeserverPubkey);

  try {
    console.log('[signupUser] Starting mainnet signup...');
    console.log('[signupUser] Homeserver pubkey:', homeserverPubkey);
    console.log('[signupUser] Signup token:', signupToken || '(none)');
    console.log('[signupUser] User pubkey:', keypair.publicKey().z32());
    
    // Sign up using Client.signup() (this should properly serialize the AuthToken)
    console.log('[signupUser] Calling client.signup()...');
    const session = await client.signup(keypair, homeserverPublicKey, signupToken || null);
    console.log('[signupUser] Signup successful!');
    console.log('[signupUser] Session:', session);

    return {
      pubkey: keypair.publicKey().z32(),
      session,
    };
  } catch (error) {
    console.error('[signupUser] Signup failed:', error);
    
    // Log full error details
    if (error instanceof Error) {
      console.error('[signupUser] Error name:', error.name);
      console.error('[signupUser] Error message:', error.message);
      console.error('[signupUser] Error stack:', error.stack);
      
      if ('cause' in error) {
        console.error('[signupUser] Error cause:', error.cause);
      }
    } else {
      console.error('[signupUser] Unknown error type:', typeof error, error);
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Signup failed: ${errorMessage}\n\n` +
      `Make sure:\n` +
      `1. The homeserver is accessible and running\n` +
      `2. The homeserver pubkey is correct: ${homeserverPubkey}\n` +
      `3. PKARR relays are configured correctly\n` +
      `4. If using a signup token, it's valid and not already used\n\n` +
      `Check the browser console (F12) for detailed network errors.`
    );
  }
}

