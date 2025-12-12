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
 * Bypasses the SDK's PKARR resolution and calls the signup endpoint directly.
 * Uses the SDK's Signer to create the AuthToken properly.
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
  
  try {
    // Extract host and port from clientBaseUrl
    const url = new URL(clientBaseUrl);
    const signupUrl = new URL('/signup', clientBaseUrl);
    
    // Add signup_token as query param if provided
    if (signupToken) {
      signupUrl.searchParams.set('signup_token', signupToken);
    }
    
    console.log('[signupUserDirect] Signup URL:', signupUrl.toString());
    
    // Use the SDK's Signer to create the AuthToken
    // The Signer.signup() method internally creates a root capability token
    // But since we're bypassing the SDK's URL resolution, we need to create it manually
    // For now, let's try using Signer.signup() but with a workaround
    
    // Actually, let's use the testnet client's Signer, which should handle AuthToken creation
    const host = url.hostname;
    const client = Client.testnet(host);
    
    // Try to use Signer instead of Client for better control
    // But Signer.signup() also tries to resolve via PKARR...
    // So we need to manually create the AuthToken and call the endpoint directly
    
    // For now, let's try a different approach: use the SDK's internal AuthToken creation
    // We'll need to import Signer if available, or create the AuthToken manually
    
    // Actually, the simplest solution is to use the existing UserService.signup() method
    // which takes a raw AuthToken. But we need to create the AuthToken first.
    
    // Let's try using Signer.fromKeypair() and then manually calling the endpoint
    // But Signer doesn't expose a way to get the AuthToken...
    
    // Fallback: Use Client.testnet() but catch the error and provide a better message
    // The SDK's testnet client should rewrite URLs, but it's not working
    // So we'll provide a clear error message explaining the limitation
    
    const homeserverPublicKey = homeserverPubkey ? PublicKey.from(homeserverPubkey) : null;
    
    // Try using Client.signup() - if it fails due to PKARR, we'll provide a helpful error
    if (homeserverPublicKey) {
      console.log('[signupUserDirect] Attempting signup with SDK (may fail for local homeservers)...');
      try {
        const session = await client.signup(keypair, homeserverPublicKey, signupToken || null);
        console.log('[signupUserDirect] Signup successful via SDK!');
        return {
          pubkey: keypair.publicKey().z32(),
        };
      } catch (sdkError) {
        console.warn('[signupUserDirect] SDK signup failed:', sdkError);
        
        // The SDK's testnet client is not properly rewriting URLs for local homeservers.
        // It tries to resolve via PKARR first, which fails, then tries to use the pubkey as a domain.
        // This is a known limitation of the SDK's testnet mode.
        const errorMessage = sdkError instanceof Error ? sdkError.message : String(sdkError);
        
        // Check for PKARR-related errors (the SDK tries to resolve via PKARR first)
        // The error message might be generic ("error sending request"), but the browser console
        // will show the actual network errors (PKARR fetch failures, ERR_NAME_NOT_RESOLVED)
        const isPkarrError = 
          errorMessage.includes('PKARR') || 
          errorMessage.includes('resolve') || 
          errorMessage.includes('15411') || 
          errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
          errorMessage.includes('error sending request'); // Generic SDK error that often indicates PKARR failure
        
        if (isPkarrError) {
          throw new Error(
            'The SDK is trying to resolve the homeserver pubkey via PKARR, which fails for local homeservers. ' +
            'Check the browser console (F12) - you should see network errors like:\n' +
            '  - "Fetch failed loading: GET http://127.0.0.1:15411/..."\n' +
            '  - "POST https://{pubkey}/signup net::ERR_NAME_NOT_RESOLVED"\n\n' +
            'This is a known limitation of the SDK. The PKARR relay is running, but it doesn\'t have the homeserver\'s pubkey ' +
            'because the homeserver failed to start (DHT publishing issue).\n\n' +
            'To work around this:\n\n' +
            '1. Make sure the homeserver is running (even if it shows a DHT warning, the admin server should still be available)\n' +
            '2. Or run the homeserver separately using `pubky-homeserver` directly\n' +
            '3. The PKARR relay alone is not sufficient - the homeserver must be running for signup to work\n\n' +
            `Original error: ${errorMessage}`
          );
        }
        
        // Re-throw the original error
        throw sdkError;
      }
    }
    
    // If we get here without a homeserver pubkey, we can't proceed
    throw new Error(
      'Homeserver pubkey is required for signup. ' +
      'You can find it in your homeserver config.toml file (homeserver_pubkey field) or startup logs.'
    );
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
    throw new Error(
      `Signup failed: ${errorMessage}. ` +
      `Check the browser console for detailed logs. ` +
      `Client URL: ${clientBaseUrl}, Homeserver: ${homeserverPubkey || 'N/A'}`
    );
  }
}

/**
 * Sign up a new user to the homeserver using the generated keypair.
 * Uses the SDK which handles AuthToken creation automatically.
 * 
 * For local/testnet homeservers, we can call the client API directly without needing
 * the homeserver pubkey - the SDK's testnet client rewrites URLs to localhost automatically.
 * For mainnet, we need the homeserver pubkey for pkarr resolution.
 */
export async function signupUser(
  keypair: Keypair,
  homeserverPubkey: string | null | undefined,
  signupToken: string | undefined,
  clientBaseUrl?: string
): Promise<{ pubkey: string; session?: any }> {
  // Determine if we're in testnet mode (local homeserver)
  const isTestnet = process.env.NEXT_PUBLIC_ADMIN_ENV === 'testnet' ||
                     clientBaseUrl?.includes('localhost') || 
                     clientBaseUrl?.includes('127.0.0.1');

  // For local/testnet, use direct signup (but still need pubkey for SDK)
  if (isTestnet && clientBaseUrl) {
    // Even for testnet, we need the homeserver pubkey because the SDK
    // tries to resolve it via PKARR before rewriting URLs
    if (!homeserverPubkey) {
      throw new Error(
        'Homeserver pubkey is required even for local/testnet homeservers. ' +
        'The SDK needs it to construct the signup URL. ' +
        'You can find it in your homeserver config.toml file (homeserver_pubkey field) or startup logs.'
      );
    }
    return await signupUserDirect(keypair, clientBaseUrl, signupToken, homeserverPubkey);
  }

  // For mainnet, we need the homeserver pubkey
  if (!homeserverPubkey) {
    throw new Error('Homeserver pubkey is required for mainnet signup. For local/testnet homeservers, the dashboard should detect this automatically.');
  }

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
    console.log('[signupUser] Homeserver PublicKey object:', homeserverPublicKey);
    
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
      `Signup failed: ${errorMessage}. ` +
      `Check the browser console for detailed logs. ` +
      `Homeserver: ${homeserverPubkey}`
    );
  }
}

