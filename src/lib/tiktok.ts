export const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/content/init/";

/** Exchange an auth code (or refresh token) for access + refresh tokens */
export async function exchangeTikTokCode({
  clientKey,
  clientSecret,
  code,
  redirectUri,
}: {
  clientKey: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; openId: string; scope: string }> {
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new TikTokApiError(`Token exchange failed: ${json.error_description ?? json.error ?? res.status}`);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in ?? 86400,
    openId: json.open_id,
    scope: json.scope ?? "",
  };
}

/** Refresh an access token using a refresh token */
export async function refreshTikTokToken({
  clientKey,
  clientSecret,
  refreshToken,
}: {
  clientKey: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new TikTokApiError(`Token refresh failed: ${json.error_description ?? json.error ?? res.status}`);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresIn: json.expires_in ?? 86400,
  };
}

export class TikTokApiError extends Error {}

/**
 * Publishes a set of generated slide images as a TikTok photo post via the
 * Content Posting API's PULL_FROM_URL flow.
 *
 * IMPORTANT — Photo posts work differently from video posts:
 *  - The ONLY valid source for photos is PULL_FROM_URL (FILE_UPLOAD is videos-only).
 *  - photo_images must be an array of URL *strings*, not objects.
 *  - TikTok's server fetches the images itself; there is no separate upload step.
 *  - photo_cover_index is 1-indexed (1 = first image).
 *
 * Ref: https://developers.tiktok.com/doc/content-posting-api-get-started
 */
export async function postPhotoSlideshow({
  accessToken,
  imageUrls,
  caption,
  hashtags,
  musicId,
}: {
  accessToken: string;
  /** Public HTTPS URLs of the slide images. TikTok pulls them directly. */
  imageUrls: string[];
  caption: string;
  hashtags: string;
  musicId?: string | null;
}): Promise<{ publishId: string }> {
  const description = [caption, hashtags].filter(Boolean).join("\n\n").slice(0, 2200);

  // Only include fields that are documented for photo posts.
  // NOTE: TikTok's photo post API does NOT support music_id — the field is
  // video-only and silently ignored on photo posts. The only audio control
  // available is auto_add_music, which lets TikTok pick a recommended track.
  // Users can change the music inside the TikTok app after posting.
  // Ref: https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
  void musicId; // retained in DB / UI for future API support; unused in API call
  const postInfo: Record<string, unknown> = {
    title: description,
    privacy_level: "SELF_ONLY",
    disable_comment: false,
    auto_add_music: true,
  };

  const initRes = await fetch(TIKTOK_INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      post_info: postInfo,
      source_info: {
        source: "PULL_FROM_URL",   // Only valid source for photo posts
        photo_cover_index: 0,      // 0-indexed: 0 = first image
        photo_images: imageUrls,   // Array of URL strings — NOT objects
      },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
    }),
  });

  if (!initRes.ok) {
    const text = await initRes.text().catch(() => "");
    throw new TikTokApiError(`TikTok init failed (${initRes.status}): ${text.slice(0, 300)}`);
  }

  const initJson = await initRes.json();
  const publishId: string | undefined = initJson?.data?.publish_id;

  if (!publishId) {
    throw new TikTokApiError(
      `TikTok init succeeded but returned no publish_id. Response: ${JSON.stringify(initJson).slice(0, 300)}`
    );
  }

  // No upload step needed — TikTok pulls images directly from the provided URLs.
  return { publishId };
}
