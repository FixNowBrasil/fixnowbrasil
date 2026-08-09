import type { RequestStatus } from "./fixnow";

/**
 * Client-side representation of the request lifecycle.
 *
 * This is intentionally defensive: the database remains the source of truth
 * and must reject invalid transitions through RLS/triggers/RPCs.
 */
export const REQUEST_STATUS_TRANSITIONS: Readonly<
  Record<RequestStatus, readonly RequestStatus[]>
> = {
  sent: ["analyzing", "cancelled"],
  analyzing: ["confirmed", "cancelled"],
  confirmed: ["on_the_way", "cancelled"],
  on_the_way: ["in_progress"],
  in_progress: ["completed"],
  completed: ["rated"],
  rated: [],
  cancelled: [],
};

export function canTransitionRequestStatus(from: RequestStatus, to: RequestStatus): boolean {
  if (from === to) return true;
  return REQUEST_STATUS_TRANSITIONS[from].includes(to);
}

export function getNextRequestStatuses(status: RequestStatus): readonly RequestStatus[] {
  return REQUEST_STATUS_TRANSITIONS[status];
}
