export type MicrosoftProfile = {
  id: string;
  displayName: string;
  email: string;
};
export const profile: MicrosoftProfile = {
  id: 'local-preview',
  displayName: 'Demo Owner',
  email: 'demo@example.test',
};
export const microsoftAuthConfigured = true;
export async function restoreMicrosoftSession() {
  return profile;
}
export async function connectMicrosoft() {
  return profile;
}
export async function disconnectMicrosoft() {
  /* Local visual preview has no account session. */
}
