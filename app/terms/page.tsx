import { LegalLayout, LegalSection, LegalList } from "@/components/landing/LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout title="Terms and Conditions" updated="August 15, 2026">
      <LegalSection heading="1. Acceptance of terms">
        <p>
          By creating an account or using Hierarchy Class, you agree to these Terms and Conditions. If you are under
          18, a parent or guardian must review and accept these terms on your behalf. If you do not agree, do not use
          the platform.
        </p>
      </LegalSection>

      <LegalSection heading="2. The service">
        <p>
          Hierarchy Class is a school management and gamified academic tracking platform. It provides role-based
          workspaces for students, teachers, and administrators, including rank tracking, classroom grading, habits,
          messaging, a school feed, materials, and a campus currency (Florin). The platform is provided &ldquo;as is&rdquo; and
          &ldquo;as available.&rdquo;
        </p>
      </LegalSection>

      <LegalSection heading="3. Accounts and roles">
        <LegalList
          items={[
            "You must provide accurate information when creating an account and keep your credentials secure.",
            "Accounts are assigned a role: student, teacher, or administrator. Role access is enforced by the system.",
            "You are responsible for all activity that happens under your account.",
            "Administrators manage schools, programs, seasons, and enrollment. Teachers manage grades and course content within the subjects assigned to them.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Acceptable use">
        <LegalList
          items={[
            "Do not attempt to access another user's data, another school's data, or any part of the system you are not authorized to see.",
            "Do not post abusive, harassing, defamatory, or unlawful content to the school feed, messages, stories, or materials.",
            "Do not submit fake, misleading, or inflated grades, scores, or habit entries.",
            "Do not attempt to bypass authentication, row-level security, or any other safeguard.",
            "Do not use the platform to violate any law, regulation, or your school's code of conduct.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="5. Grading and the rank system">
        <LegalList
          items={[
            "Teachers input scores for the activities and categories they configure for their courses.",
            "Approved grades feed the rank engine. Each grade computes its own contribution using its category weight.",
            "Ranks, bars, and leaderboards are computed from approved data. Pending or rejected grades do not affect them.",
            "Administrators declare seasons with start and end dates. When a season ends, final and peak ranks are recorded and the ladder resets.",
            "We may correct rank or grade computations if an error is found, without retroactive penalty beyond restoring correct values.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="6. Content you submit">
        <LegalList
          items={[
            "You retain ownership of content you post, including feed posts, stories, materials, and messages.",
            "You grant the school and the platform a limited license to store, display, and distribute that content within the platform for its intended purpose.",
            "Teachers may remove or edit materials they uploaded. Administrators may moderate feed posts and submitted content.",
            "Deleted messages are removed from view for the conversation participants; history may remain in backups as required by law.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="7. Privacy">
        <p>
          Your data is handled as described in the Privacy Policy. Grade data is only visible to the student it belongs
          to, their teachers, and their school administrators. Aggregate averages may be shown on leaderboards.
        </p>
      </LegalSection>

      <LegalSection heading="8. Intellectual property">
        <p>
          The Hierarchy Class name, logo (crown mark), design, and software are the property of the project. You may
          not copy, redistribute, or reverse engineer the platform without permission.
        </p>
      </LegalSection>

      <LegalSection heading="9. Availability and liability">
        <LegalList
          items={[
            "We do not guarantee uninterrupted availability. Maintenance and outages may occur.",
            "To the maximum extent permitted by law, the platform is not liable for indirect, incidental, or consequential damages.",
            "Educational decisions remain the responsibility of the school. The platform is a tool, not a substitute for academic judgment.",
            "If a bug affects grades, ranks, or enrollment, we will work to correct the data and notify the affected school.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="10. Termination">
        <p>
          Your school administrator may suspend or remove accounts. You may stop using the platform at any time.
          Sections that by their nature survive termination (privacy, liability, intellectual property) remain in effect.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to these terms">
        <p>
          We may update these terms from time to time. Continued use of the platform after changes take effect means
          you accept the updated terms. The date at the top of this page reflects the latest revision.
        </p>
      </LegalSection>

      <LegalSection heading="12. Contact">
        <p>
          Questions about these terms can be directed to the project maintainer at{" "}
          <a
            href="https://github.com/joshan-lucmayan"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--gold)] underline underline-offset-2"
          >
            github.com/joshan-lucmayan
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
