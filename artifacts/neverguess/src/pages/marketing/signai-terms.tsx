import { useDocumentTitle } from "@/lib/use-document-title";
import { useMetaTags } from "@/lib/use-meta-tags";
import { SIGN_AI_SUPPORT_EMAIL, SignAIPolicyLayout } from "./signai-shared";

export default function MarketingSignAITerms() {
  useDocumentTitle("Terms of Service | SignAI");
  useMetaTags({
    title: "Terms of Service | SignAI",
    description: "Terms of Service for SignAI agreement review, electronic signatures, subscriptions, and support.",
    canonicalUrl: "https://marmarlabs.com/signai/terms",
  });

  return (
    <SignAIPolicyLayout
      title="Terms of Service"
      description="The rules for using SignAI as an agreement review, storage, and signing productivity tool."
    >
      <p className="eyebrow">Last updated: June 4, 2026</p>

      <p>These terms govern your use of SignAI. By using SignAI, you agree to these terms.</p>

      <h2>Service</h2>
      <p>
        SignAI provides document management, AI-assisted agreement review,
        electronic signature, deadline tracking, and related productivity
        features.
      </p>

      <h2>No legal advice</h2>
      <p>
        SignAI may help summarize agreements and identify possible issues, but it
        does not provide legal advice and does not replace review by a qualified
        attorney.
      </p>

      <h2>Optional AI processing</h2>
      <p>
        AI analysis and Ask AI are optional. Accepting these Terms is not consent
        to share a document with third-party AI. If you enable AI analysis or Ask
        AI, SignAI asks for explicit in-app permission before sending document
        text, images or PDF content, file name, basic document metadata, an
        internal account identifier, AI questions, or relevant agreement context
        to OpenRouter, OpenAI models through OpenRouter, and Mistral OCR or
        Cloudflare AI through OpenRouter for scanned PDF parsing/OCR when needed.
        This processing is used for summaries, risk detection, clause extraction,
        signing-field placement, and Q&A. You can upload, store, and sign
        documents without third-party AI processing.
      </p>

      <h2>Inputs and AI outputs</h2>
      <p>
        You are responsible for the documents, prompts, questions, signer
        details, and other information you provide to SignAI. You must have the
        rights and permissions needed to upload or submit that content.
        AI-generated summaries, risk notes, extracted clauses, signing-field
        suggestions, and answers may be incomplete or inaccurate. SignAI is a
        productivity tool, not a law firm, and AI outputs are not legal advice.
      </p>

      <h2>Your content</h2>
      <p>
        You are responsible for documents and information you upload, scan, share,
        or sign using SignAI. You must have the rights and permissions needed to
        use that content with the service.
      </p>

      <h2>Subscriptions</h2>
      <p>
        Paid features may be offered through auto-renewing subscriptions,
        including SignAI Pro Monthly and SignAI Pro Annual. Subscription billing,
        renewals, cancellation, and refunds are handled through the applicable
        app store or billing provider unless stated otherwise. Subscriptions renew
        automatically unless canceled at least 24 hours before the end of the
        current period, and you can manage or cancel them in your app-store
        account settings.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You may not misuse SignAI, interfere with the service, attempt
        unauthorized access, upload unlawful content, or use the service to
        violate another person's rights.
      </p>

      <h2>Limitations</h2>
      <p>
        SignAI is provided as a productivity tool. To the maximum extent allowed
        by law, we are not responsible for indirect, incidental, special,
        consequential, or punitive damages.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can be sent to{" "}
        <a href={`mailto:${SIGN_AI_SUPPORT_EMAIL}`}>{SIGN_AI_SUPPORT_EMAIL}</a>.
      </p>
    </SignAIPolicyLayout>
  );
}
