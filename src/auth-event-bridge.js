// Identity emits storage events for other tabs, including transient removals of
// gotrue.user. Check the actual session before hiding an authenticated account.
export function createAuthEventBridge(getUser, notify) {
 let generation = 0;
 return async (event, user) => {
  const pending = ++generation;
  if (event !== 'login' && event !== 'logout') return;
  try {
   const session = await getUser();
   if (pending !== generation) return;
   if (session?.id) notify('login', session);
   else notify('logout', null);
  } catch (error) {
   // A temporary Identity/network failure must not sign the user out.
   console.error('Identity session check failed', error);
  }
 };
}
