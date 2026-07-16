import { useDocumentTitle } from "@/lib/use-document-title";
import { useMetaTags } from "@/lib/use-meta-tags";
import { SIGN_AI_SUPPORT_EMAIL, SignAIPolicyLayout } from "./signai-shared";

export default function MarketingSignAIPrivacy() {
  useDocumentTitle("Privacy Policy | SignAI");
  useMetaTags({
    title: "Privacy Policy | SignAI",
    description: "Privacy policy for SignAI document scanning, AI-assisted agreement review, signing, and storage.",
    canonicalUrl: "https://marmarlabs.com/signai/privacy",
  });

  return (
    <SignAIPolicyLayout
      title="Privacy Policy"
      description="What SignAI collects, how it is used, and how to reach MarMar Labs about privacy requests."
    >
      <p className="eyebrow">Last updated: June 4, 2026</p>

      <p>
        SignAI helps users scan, understand, manage, and sign agreements. This
        policy explains what information we collect, how we use it, and the
        choices available to you.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account information, such as your name, email address, authentication identifiers, and subscription status.</li>
        <li>Documents and agreement data that you upload, scan, analyze, sign, or store in SignAI, including document text, images or PDF content, file names, and basic document metadata.</li>
        <li>Signature, audit, and workflow information, including timestamps, signing status, activity history, and related document metadata.</li>
        <li>Device and app information used for app functionality and security, such as app version, device type, notification settings, and signing workflow context.</li>
        <li>Payment and subscription information handled through payment processors and app-store billing providers.</li>
      </ul>

      <h2>How we collect information</h2>
      <p>
        We collect information directly from you when you create an account,
        upload or scan a document, enter signer details, create or store a
        signature, ask an AI question, complete a signing workflow, contact
        support, or manage a subscription. We also collect limited app and
        device information when the app is used so we can operate, secure, and
        troubleshoot the service.
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>To provide document scanning, optional AI-assisted agreement analysis, Ask AI Q&A, electronic signing, storage, and account features.</li>
        <li>To process subscriptions, provide support, maintain security, troubleshoot issues, and improve product reliability.</li>
        <li>To create audit trails and records needed for agreement workflows.</li>
        <li>To comply with legal, security, and fraud-prevention obligations.</li>
      </ul>

      <h2>AI processing and model providers</h2>
      <p>
        AI analysis and Ask AI are optional. Accepting the Terms of Service or
        Privacy Policy is not consent to share a document with third-party AI.
        Before SignAI sends personal data to a third-party AI service, the app
        asks for your explicit in-app permission.
      </p>
      <p>
        If you consent, SignAI may send document text, images or PDF content,
        file name, basic document metadata, an internal account identifier, your
        AI question, and relevant agreement context to OpenRouter, OpenAI models
        through OpenRouter, and Mistral OCR or Cloudflare AI through OpenRouter
        for scanned PDF parsing/OCR when needed. SignAI uses that AI processing
        only to generate summaries, risk notes, clause extraction, signing-field
        placement, and answers to your questions. SignAI does not sell agreement
        content and does not provide legal advice. AI output may be inaccurate,
        so you should review documents yourself before signing or sending them.
      </p>
      <p>
        Before sending data to third-party AI, SignAI records your AI-processing
        consent version, timestamp, agreement id, user id, purpose, source, data
        sent, recipients, Privacy Policy URL, and disclosure snapshot for audit
        and compliance. You may turn off AI analysis before upload when you only
        want to upload, store, and sign a document without third-party AI
        processing.
      </p>

      <h2>Sharing</h2>
      <p>
        We may share information with service providers that help operate SignAI,
        including cloud hosting, authentication, AI processing, storage, support,
        and payment services. These providers are required to
        protect information appropriately, process it only for SignAI service
        purposes, provide the same or equal protection for shared personal data,
        and not sell personal information. We do not sell personal information.
      </p>

      <h2>Retention, deletion, and AI choices</h2>
      <p>
        We keep account, document, signature, subscription, and audit information
        for as long as needed to provide SignAI, maintain agreement records,
        comply with legal obligations, resolve disputes, and protect the service.
        You can avoid future third-party AI sharing by turning off AI analysis
        before upload or by declining the Ask AI consent prompt. SignAI will not
        send that document or question to third-party AI services unless you
        consent. You may delete documents in the app or contact support to
        request account or data deletion, subject to legal and security retention
        requirements.
      </p>

      <h2>Security</h2>
      <p>
        We use technical and organizational safeguards designed to protect user
        information. No method of transmission or storage is perfectly secure, so
        we cannot guarantee absolute security.
      </p>

      <h2>Your choices</h2>
      <p>
        You may update account information, manage subscriptions through the
        applicable app store or billing provider, delete documents in the app, or
        contact us for help with privacy requests.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions or requests, contact{" "}
        <a href={`mailto:${SIGN_AI_SUPPORT_EMAIL}`}>{SIGN_AI_SUPPORT_EMAIL}</a>.
      </p>
    </SignAIPolicyLayout>
  );
}
