import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { H2, LegalShell, Ph, Strong } from "@/components/Legal";

export const metadata: Metadata = { title: "Community Guidelines" };

export default function GuidelinesPage() {
  return (
    <LegalShell title="Community Guidelines">
      <p>
        <Strong>The short version:</Strong> {brand.name} is the pub for fans who
        don&apos;t have one. Talk like you&apos;re in a pub you&apos;d want to
        stay in: passionate, funny, blunt about football, decent to people.
      </p>

      <H2>The rules</H2>
      <ul className="space-y-2">
        <li>
          <Strong>Football arguments yes, personal attacks no.</Strong> Call a
          performance a disgrace; don&apos;t call a person one. Abuse,
          harassment, hate speech, slurs, or threats directed at anyone —
          players, refs, other fans — get messages hidden and accounts removed.
        </li>
        <li>
          <Strong>No links to unauthorized streams.</Strong> One strike. Links
          to pirated streams are removed and repeat sharing ends your account.
          This rule protects the platform&apos;s existence; it is not
          negotiable.
        </li>
        <li>
          <Strong>Rival fans are guests, not targets.</Strong> Opposition
          supporters are welcome. Wind-ups are football; pile-ons are not. The
          vote buttons exist so you can disagree without flooding the chat.
        </li>
        <li>
          <Strong>Flags are for conduct, votes are for opinion.</Strong>{" "}
          Downvote takes you disagree with. Flag only content that breaks these
          rules. Coordinated false flagging is itself a violation.
        </li>
        <li>
          <Strong>On air, the room hears you.</Strong> Calling in is live
          broadcasting, recorded as part of the show. The commentator can end
          any call at any time.
        </li>
        <li>
          <Strong>No spam, scams, or self-promo flooding.</Strong> Sharing your
          relevant blog or pod: fine. Posting it every five minutes: not.
        </li>
        <li>
          <Strong>Zero tolerance:</Strong> no doxxing, no content sexualizing
          minors, no incitement, nothing illegal. Immediate removal, reported
          where required.
        </li>
      </ul>

      <H2>Enforcement</H2>
      <p>
        Community flags hide messages automatically; commentators can hide
        instantly; moderators can remove messages, end calls, and ban accounts
        and devices. Appeals: <Ph>[CONTACT EMAIL]</Ph>. Session recordings and
        moderation logs keep decisions reviewable.
      </p>
    </LegalShell>
  );
}
