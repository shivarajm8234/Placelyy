/** Only this account may upload, move, or delete documents. */
export const ADMIN_EMAIL = 'shivarajmani2005@gmail.com'

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === ADMIN_EMAIL
}
