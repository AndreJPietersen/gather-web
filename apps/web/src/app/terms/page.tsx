import type { Metadata } from "next";
import { LEGAL_INFO } from "@gather/shared/legal-info";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of use · Gather" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p>By creating an account or using Gather you agree to these terms.</p>

      <LegalSection title="What Gather is">
        <p>
          Gather helps people plan events and find and manage vendors. Gather is a platform: agreements, payments and
          services between planners and vendors are between those people. Payment tracking in Gather is a record-keeping
          aid, not a payment service.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          Give accurate details, keep your password safe, and tell us if you think your account has been misused. You are
          responsible for what happens under your account.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          Do not post unlawful, misleading, abusive or infringing content, impersonate others, misuse the service (for
          example scraping, spamming or probing for security weaknesses), or list a business you are not entitled to
          represent. We may remove content, hide listings or suspend accounts that break these rules.
        </p>
      </LegalSection>

      <LegalSection title="Vendors and reviews">
        <p>
          Vendors are responsible for the accuracy of their listings and for the services they provide. Reviews must
          reflect a genuine experience. Verification shows we have checked a business&apos;s claim to a listing, not that
          we endorse its services.
        </p>
      </LegalSection>

      <LegalSection title="Availability and liability">
        <p>
          We work to keep Gather available and accurate but provide it as is. To the extent the law allows, we are not
          liable for indirect loss, or for anything a planner and a vendor agree or fail to deliver between themselves.
        </p>
      </LegalSection>

      <LegalSection title="Ending your account">
        <p>
          You can delete your account from your profile at any time. We may suspend or close accounts that break these
          terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact and law">
        <p>
          Questions: {LEGAL_INFO.supportEmail}. These terms are governed by the laws of the Republic of South Africa.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
