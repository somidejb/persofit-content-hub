export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
      <h1 className="mb-6 text-2xl font-bold text-white">Terms of Service</h1>
      <p className="mb-4 text-sm text-zinc-400">Last updated: July 2026</p>

      <p className="mb-4">
        Persofit Content Hub is a private content management tool for generating and publishing
        AI-powered slideshows to TikTok. By using this application you agree to these terms.
      </p>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">Use of the Service</h2>
      <p className="mb-4">
        This tool is intended for personal and business use to manage and publish content to
        social media platforms. You are responsible for all content published through this service.
      </p>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">TikTok Integration</h2>
      <p className="mb-4">
        This application uses the TikTok Content Posting API to publish content on your behalf.
        By connecting your TikTok account, you authorize this application to post content to
        your TikTok profile as directed by you.
      </p>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">Limitation of Liability</h2>
      <p className="mb-4">
        This service is provided as-is. We are not liable for any content published, removed,
        or rejected by TikTok or any other platform.
      </p>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">Contact</h2>
      <p>For questions about these terms, contact the application owner.</p>
    </div>
  );
}
