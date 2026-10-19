export function safeStorageError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/\b401\b|invalid_grant|unauthorized/i.test(message)) return "Google authorization expired or was revoked; reconnect this profile";
  if (/\b403\b|forbidden|permission/i.test(message)) return "Connected Google account lacks permission for this folder";
  if (/\b404\b|not found/i.test(message)) return "Google Drive folder was not found for this credential";
  if (/storageQuotaExceeded|insufficientStorage|storage quota/i.test(message)) return "Storage account is full";
  if (/\b429\b|rateLimitExceeded|quotaExceeded/i.test(message)) return "Google Drive rate limit reached; retry later";
  return "Storage provider request failed; check credentials and folder access";
}
