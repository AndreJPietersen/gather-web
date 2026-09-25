// Shared by createEvent and updateEvent — both build an events row from the
// same three date fields, so this is the one place their ordering rules are
// enforced rather than each action re-deriving it.
//
// startAt/endAt are "YYYY-MM-DDTHH:mm" (a datetime-local input's own
// format, both always in SAST — see sastInputToIso), and rsvpDate is a
// plain "YYYY-MM-DD". All three sort correctly as plain strings because
// they share the same left-to-right, zero-padded shape (the same trick
// upcomingCutoffDate/isDateOverdue rely on) — no Date object, no timezone
// conversion needed just to compare them.
export function validateEventDates(startAt: string, endAt: string, rsvpDate: string): string | null {
  if (endAt && endAt < startAt) {
    return "End can't be before the start date/time.";
  }
  if (rsvpDate && rsvpDate > startAt.slice(0, 10)) {
    return "RSVP by can't be after the event's start date.";
  }
  return null;
}
