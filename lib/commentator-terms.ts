import { brand } from "@/lib/brand";

/**
 * Commentator terms (FR-18.1). Shown in the self-serve upgrade flow; the
 * accepted version is recorded on the profile. Bump the version whenever the
 * copy changes materially so re-acceptance can be required later. Copy follows
 * docs/LEGAL_PAGES.md conventions: recording ownership per the founder's
 * recording-rights policy, and the no-rebroadcast rule that underpins the
 * platform's legal position (golden rule 1).
 */

export const COMMENTATOR_TERMS_VERSION = "2026-07-03";

export const COMMENTATOR_TERMS: { heading: string; body: string }[] = [
  {
    heading: "Your recordings are yours",
    body:
      "Every broadcast you host is recorded and cut into downloadable segments. " +
      "You own those recordings completely. " +
      `${brand.name} takes no rights, no license, and no exclusivity.`,
  },
  {
    heading: "Audio only, never the match",
    body:
      "Your broadcast is your own voice and your guests. Never play, restream, " +
      "or rebroadcast match video or broadcast audio through your show, even in " +
      "the background. This rule is the legal foundation of the platform and " +
      "breaking it means suspension.",
  },
  {
    heading: "You are responsible for your show",
    body:
      "You are the moderator of your room: the community guidelines apply to " +
      "you, your co-hosts, and your callers. Callers consent to being recorded " +
      "as part of your show before they go on air.",
  },
  {
    heading: "Hosting can be suspended",
    body:
      `${brand.name} can revert a commentator account to a listener account ` +
      "for breaking these terms or the community guidelines. Scheduled rooms " +
      "are canceled on suspension. Your listener account and its history stay " +
      "intact.",
  },
];
