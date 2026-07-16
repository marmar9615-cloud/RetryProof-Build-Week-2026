import { Link } from "wouter";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useMetaTags } from "@/lib/use-meta-tags";
import { SIGN_AI_SUPPORT_EMAIL, SignAIPolicyLayout } from "./signai-shared";

export default function MarketingSignAISupport() {
  useDocumentTitle("Support | SignAI");
  useMetaTags({
    title: "Support | SignAI",
    description: "Support options for SignAI account access, scanning, signing, subscriptions, and privacy requests.",
    canonicalUrl: "https://marmarlabs.com/signai/support",
  });

  return (
    <SignAIPolicyLayout
      title="Support"
      description="Help for account access, document scanning, electronic signatures, subscriptions, and privacy requests."
    >
      <p className="eyebrow">Last updated: June 4, 2026</p>

      <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm">
        <div className="eyebrow text-primary">Contact</div>
        <p className="mt-2 text-foreground">
          Need help with SignAI? Email{" "}
          <a
            href={`mailto:${SIGN_AI_SUPPORT_EMAIL}`}
            className="font-mono text-primary underline underline-offset-2"
          >
            {SIGN_AI_SUPPORT_EMAIL}
          </a>
          . SignAI is operated by MarMar Labs.
        </p>
      </div>

      <h2>Common topics</h2>
      <ul>
        <li>Account access and sign-in help.</li>
        <li>Document scanning, upload, and AI analysis questions.</li>
        <li>Electronic signature workflow support.</li>
        <li>Subscription, billing, cancellation, and restore-purchase questions.</li>
        <li>Privacy, data deletion, or account deletion requests.</li>
      </ul>

      <h2>Subscriptions and billing</h2>
      <p>
        SignAI Pro subscriptions are billed through Apple In-App Purchase on iOS.
        You can manage or cancel an Apple subscription in your Apple ID
        subscription settings. If a subscription is not recognized in SignAI, use
        Restore Purchases in the app or contact support with your Apple purchase
        date and the email address on your SignAI account.
      </p>

      <h2>AI processing and privacy</h2>
      <p>
        AI analysis is optional. If you enable it, SignAI asks for in-app
        permission before sending document text, images or PDF content, file
        name, basic metadata, an internal account identifier, relevant agreement
        context, or AI questions to OpenRouter and OpenAI via OpenRouter. For
        scanned PDFs, OpenRouter file parsing/OCR may also use Mistral OCR or
        Cloudflare AI when needed. You can upload and sign documents without
        third-party AI processing. For privacy questions, data deletion requests,
        or AI processing questions, email support and include the email address
        on your SignAI account.
      </p>

      <h2>Before you contact us</h2>
      <p>
        Please include the email address on your SignAI account, your device
        model, iOS version, and a short description of what happened.
      </p>

      <p>
        Helpful links: <Link href="/signai/privacy">Privacy Policy</Link> and{" "}
        <Link href="/signai/terms">Terms of Service</Link>.
      </p>
    </SignAIPolicyLayout>
  );
}
