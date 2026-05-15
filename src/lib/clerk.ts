export const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string

if (!clerkPubKey) {
  console.warn('Doutor Ajuda: VITE_CLERK_PUBLISHABLE_KEY nao configurada.')
}
