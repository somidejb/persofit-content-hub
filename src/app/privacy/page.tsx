export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
      <h1 className="mb-6 text-2xl font-bold text-white">Privacy Policy</h1>
      <p className="mb-4 text-sm text-zinc-400">Last updated: July 2026</p>

      <p className="mb-4">
        Persofit Content Hub respects your privacy. This policy describes what data we collect
        and how it is used.
      </p>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">Data We Collect</h2>
      <ul className="mb-4 list-disc pl-5 text-sm space-y-1">
        <li>TikTok account tokens (OAuth access and refresh tokens) to post on your behalf</li>
        <li>Slideshow content, captions, and hashtags you create within the app</li>
        <li>Images you upload as reference material for AI generation</li>
      </ul>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">How We Use Your Data</h2>
      <ul className="mb-4 list-disc pl-5 text-sm space-y-1">
        <li>TikTok tokens are used solely to publish content to your connected TikTok account</li>
        <li>Uploaded images are stored to assist with AI-powered slide generation</li>
        <li>No data is sold or shared with third parties</li>
      </ul>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">TikTok Data</h2>
      <p className="mb-4">
        This application requests the minimum necessary TikTok permissions (<code>user.info.basic</code>{" "}
        and <code>video.publish</code>) to function. We do not access your TikTok followers,
        messages, or any data beyond what is required for publishing.
      </p>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">Data Deletion</h2>
      <p className="mb-4">
        You can disconnect your TikTok account at any time from the Accounts page, which removes
        all stored tokens. To request full data deletion, contact the application owner.
      </p>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">Contact</h2>
      <p>For privacy concerns, contact the application owner.</p>
    </div>
  );
}
