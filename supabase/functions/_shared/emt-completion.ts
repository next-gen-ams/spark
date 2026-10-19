export function completionRequest(id: unknown, complete: unknown) {
  if (!Number.isSafeInteger(id) || Number(id) <= 0)
    throw new Error('Discussion ID is invalid.');
  if (typeof complete !== 'boolean')
    throw new Error('Completion must be true or false.');
  return { id: Number(id), complete };
}

export function isFollowUpOpen(topic: { completed_at?: string | null }) {
  return !topic.completed_at;
}
