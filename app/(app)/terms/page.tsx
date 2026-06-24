import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { LegalShell, Ph, Strong } from "@/components/Legal";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <ol className="list-decimal space-y-3 pl-5">
        <li>
          <Strong>Who we are.</Strong> {brand.name} is operated by{" "}
          <Ph>[ENTITY NAME, JURISDICTION]</Ph>. By creating an account or using
          the Platform you agree to these Terms and the Community Guidelines.
        </li>
        <li>
          <Strong>Eligibility.</Strong> You must be at least 13 (16 where local
          law requires). Accounts are personal and non-transferable.
        </li>
        <li>
          <Strong>What the Platform is, and is not.</Strong> The Platform hosts
          live audio commentary by fans, with chat, link sharing, and match
          data. It does not transmit or provide access to televised match video
          or audio, and does not authorize sharing access to unauthorized
          streams. Users supply their own lawful means of watching. The Platform
          is unofficial and not affiliated with any club, league, or rights
          holder.
        </li>
        <li>
          <Strong>Your content.</Strong> You grant a non-exclusive license to
          host and display chat, links, questions, and widget entries within the
          service.{" "}
          <Strong>
            Broadcast audio is different: commentators (and on-air guests as part
            of the show) retain all rights to broadcast recordings. The Platform
            claims no ownership and takes no license beyond what is technically
            necessary to record, process, and deliver the files to the
            commentator.
          </Strong>
        </li>
        <li>
          <Strong>Going on air.</Strong> Requesting to talk constitutes consent
          to your voice being broadcast live and recorded as part of the session
          recording, which the commentator may publish (for example as a
          podcast). If you do not consent, do not request to talk.
        </li>
        <li>
          <Strong>Tips and recurring support.</Strong> Processed by Stripe.
          Voluntary, non-refundable except where law requires; support for
          commentary, not purchases. Recurring support cancellable anytime via
          the customer portal. The Platform retains a <Ph>[X]%</Ph> service fee,
          displayed at the point of payment.
        </li>
        <li>
          <Strong>Acceptable use.</Strong> The Community Guidelines are part of
          these Terms. We may remove content, end calls, suspend or terminate
          accounts, and preserve/disclose records where law requires.
        </li>
        <li>
          <Strong>Copyright complaints.</Strong> DMCA notices to our designated
          agent: <Ph>[DMCA AGENT EMAIL / ADDRESS]</Ph>. Repeat infringers are
          terminated.
        </li>
        <li>
          <Strong>Disclaimers and liability.</Strong> Provided as-is during a
          test phase; live audio, data feeds, and recordings may fail. Liability
          limited to amounts paid to the Platform in the prior 12 months, to the
          maximum extent permitted by law.
        </li>
        <li>
          <Strong>Changes, governing law.</Strong> Updates with in-app notice.
          Governing law and venue: <Ph>[JURISDICTION]</Ph>.
        </li>
      </ol>
    </LegalShell>
  );
}
