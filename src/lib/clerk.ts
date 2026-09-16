export const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string

if (!clerkPubKey) {
  console.warn('Medfluxo: VITE_CLERK_PUBLISHABLE_KEY nao configurada.')
}
