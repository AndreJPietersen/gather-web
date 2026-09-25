// Who Gather is, for the privacy policy, terms and POPIA disclosures.
//
// PLACEHOLDERS: every value marked TODO must be replaced with real details
// before launch (L11). They are deliberately obvious so nobody ships them by
// accident — `LEGAL_IS_DRAFT` drives a visible "draft" banner on the legal
// pages until it is set to false. The wording of the policy pages is also a
// draft and should be reviewed by a South African attorney.
export const LEGAL_INFO = {
  /** Responsible party under POPIA (the legal entity running Gather). */
  companyName: "Gather (legal entity name TODO)",
  registeredAddress: "TODO: registered business address, South Africa",
  /** POPIA requires a named information officer. */
  informationOfficer: "TODO: information officer's full name",
  /** Where people send privacy requests (access, correction, deletion, export). */
  privacyEmail: "privacy@example.com",
  supportEmail: "support@example.com",
  lastUpdated: "2026-09-25",
} as const;

/** While true, the privacy and terms pages show a "draft, not yet reviewed" banner. */
export const LEGAL_IS_DRAFT = true;

/** The banned placeholder account that deleted people's leftover content is re-pointed at (migration 0057). */
export const DELETED_USER_ID = "00000000-0000-4000-8000-00000000dead";
