/**
 * The one canonical restart instruction, used verbatim anywhere the dashboard
 * (or an API route message) asks the operator to restart the app. Keeping a
 * single sentence avoids the previous drift between "restart the app",
 * "stop and start the app", and the guide explaining that those differ.
 *
 * Shared by client components and server routes; keep this module free of
 * React and Node-only imports.
 */
export const RESTART_APP_SENTENCE = "Restart the Pubky Homeserver app from Umbrel (open the app's tile, then Restart).";
