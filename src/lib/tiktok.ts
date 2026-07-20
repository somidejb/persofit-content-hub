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
 * Content Posting API's FILE_UPLOAD flow: init the post to get per-photo
 * upload URLs, then PUT each image's bytes directly to TikTok.
 * Field names follow TikTok's v2 content posting spec as of this writing —
 * verify against https://developers.tiktok.com/doc/content-posting-api-get-started
 * if TikTok has revised the schema.
 */
export async function postPhotoSlideshow({
  accessToken,
  images,
  caption,
  hashtags,
  musicId,
}: {
  accessToken: string;
  images: Buffer[];
  caption: string;
  hashtags: string;
  musicId?: string | null;
}): Promise<{ publishId: string }> {
  const description = [caption, hashtags].filter(Boolean).join("\n\n").slice(0, 2200);

  const postInfo: Record<string, unknown> = {
    title: description,
    privacy_level: "SELF_ONLY",
    disable_comment: false,
    disable_duet: false,
    disable_stitch: false,
  };
  if (musicId) postInfo.music_id = musicId;

  const initRes = await fetch(TIKTOK_INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      post_info: postInfo,
      source_info: {
        source: "FILE_UPLOAD",
        photo_images: images.map((img) => ({ image_size: img.length })),
        photo_cover_index: 0,
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
  const uploadUrls: string[] = initJson?.data?.upload_urls ?? initJson?.data?.photo_upload_urls ?? [];

  if (!publishId) {
    throw new TikTokApiError("TikTok init response did not include a publish_id");
  }

  await Promise.all(
    images.map((imageBuffer, i) => {
      const uploadUrl = uploadUrls[i];
      if (!uploadUrl) return Promise.resolve();
      return fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: new Uint8Array(imageBuffer),
      }).then((res) => {
        if (!res.ok) throw new TikTokApiError(`Failed to upload photo ${i + 1} to TikTok`);
      });
    })
  );

  return { publishId };
}
