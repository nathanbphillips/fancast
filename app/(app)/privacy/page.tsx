import type { Metadata } from "next";
import { H2, LegalShell, Ph, Strong } from "@/components/Legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <H2>What we collect</H2>
      <p>
        Account (email, username, preferences); activity (messages, links,
        votes, flags, questions, talk requests, widget entries, follows, session
        join/leave times and listening mode, used for retention analytics);
        broadcast audio if you go on air; payment references via Stripe (never
        card numbers); technical data (IP, device/browser type, a device
        identifier for abuse prevention).
      </p>

      <H2>Why (legal bases)</H2>
      <p>
        Running the service (contract); room safety and ban enforcement
        (legitimate interest); going-live emails you opted into by following
        (consent, one-click withdrawal); legal obligations. We do not sell
        personal data and run no third-party advertising or tracking.
      </p>

      <H2>Processors</H2>
      <p>
        Supabase (database, auth, storage), LiveKit (audio), Ably (realtime),
        Vercel (hosting), Stripe (payments), Resend (email), Sportmonks (match
        data; receives no personal data). Data may be processed in the US under
        standard contractual clauses.
      </p>

      <H2>Retention</H2>
      <p>
        Room content <Ph>[12 months]</Ph>; session recordings and segments 90
        days unless pinned by the commentator; moderation logs{" "}
        <Ph>[24 months]</Ph>; account data until deletion. Deleting your account
        removes your profile and identifiers; your voice within a
        commentator&apos;s published recordings is part of their broadcast work
        (Terms §5).
      </p>

      <H2>Your rights</H2>
      <p>
        Access, correction, export, deletion, objection: <Ph>[CONTACT EMAIL]</Ph>
        , response within 30 days. EU/UK users may complain to their supervisory
        authority. Users must be 13+ (16+ where applicable); underage accounts
        deleted on discovery.
      </p>

      <p className="pt-2 text-xs">
        <Strong>Note:</Strong> bracketed values are placeholders pending founder
        confirmation before the first public session.
      </p>
    </LegalShell>
  );
}
