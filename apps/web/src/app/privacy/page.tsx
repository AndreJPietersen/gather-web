import type { Metadata } from "next";
import { LEGAL_INFO } from "@gather/shared/legal-info";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy policy · Gather" };

// Public, static. Written for South Africa's POPIA: who is responsible, what
// is collected and why, who sees it, how long it is kept, and the rights a
// person has (access, correction, deletion, export, complaint).
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        This policy explains what personal information Gather collects, why, who can see it and what your rights are
        under South Africa&apos;s Protection of Personal Information Act (POPIA).
      </p>

      <LegalSection title="Who is responsible">
        <p>
          {LEGAL_INFO.companyName}, {LEGAL_INFO.registeredAddress}. Our information officer is{" "}
          {LEGAL_INFO.informationOfficer}. Contact us about your information at{" "}
          <a className="underline" href={`mailto:${LEGAL_INFO.privacyEmail}`}>
            {LEGAL_INFO.privacyEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="What we collect and why">
        <ul className="list-disc pl-5">
          <li>
            <strong>Account details</strong> — email address, password (stored only as a secure hash), display name and
            optional phone number. To let you sign in and use Gather.
          </li>
          <li>
            <strong>Events you plan</strong> — event details, guest lists (names, emails, RSVP status), tasks, budgets,
            chat messages and mood boards. To provide the planning service.
          </li>
          <li>
            <strong>Business listings</strong> — for vendors: business name, description, contact details, photos,
            services and reviews. To show your business to people planning events.
          </li>
          <li>
            <strong>Support and safety</strong> — support cases, reports, and admin actions such as suspensions, so we
            can keep Gather safe.
          </li>
          <li>
            <strong>Email delivery</strong> — reminders you have switched on, and announcements you can unsubscribe from
            at any time.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Who can see it">
        <p>
          Other people see only what the feature is for: guests see the event they are invited to, vendors see a
          planner only after you contact or book them, and businesses are public once verified. Gather staff see
          information only as needed to run and support the service. We use trusted service providers (hosting,
          database, email delivery) who process information on our behalf. We do not sell your information.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          We keep your information while your account is open. When you delete your account, your personal details and
          the events you own are deleted, and your reviews are anonymised. Limited records may be kept where the law
          requires or where another person&apos;s records depend on them.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You can see and correct your details on your profile, delete your account there at any time, and ask us for
          a copy of your information (a data export), to restrict how we use it, or to object to its use, by emailing{" "}
          {LEGAL_INFO.privacyEmail}. If you are unhappy with how we handle your information you may complain to the
          Information Regulator (South Africa).
        </p>
      </LegalSection>

      <LegalSection title="Cookies and storage">
        <p>
          We use a sign-in cookie to keep you logged in, and your browser&apos;s local storage to remember your theme
          preference. We do not use advertising cookies.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>If we change this policy in a way that matters, we will tell you in the app or by email.</p>
      </LegalSection>
    </LegalPage>
  );
}
