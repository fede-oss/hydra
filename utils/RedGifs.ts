import KeyStore from "./KeyStore";
import safeFetch from "./safeFetch";

type RedGifUrls = {
  sd: string;
  hd?: string;
  poster?: string;
  thumbnail?: string;
  vthumbnail?: string;
  silent?: string;
  html: string;
  file_url?: string;
  embed_url?: string;
};

type RedGifGif = {
  id: string;
  createDate?: number;
  hasAudio: boolean;
  width: number;
  height: number;
  likes: number;
  tags: string[];
  verified: boolean;
  views?: number;
  duration: number;
  published: boolean;
  urls: RedGifUrls;
  userName: string;
  type: number;
  avgColor: string;
  canBoost?: boolean;
  contentType?: string;
  cta?: string | null;
  description?: string | null;
  folders?: unknown | null;
  gallery?: string | null;
  hideHome?: boolean;
  hideTrending?: boolean;
  hls?: boolean;
  niches?: string[];
  sexuality?: string[];
  promoted?: unknown | null;
};

type RedGifUser = {
  creationtime?: number;
  description?: string | null;
  followers: number;
  following: number;
  gifs: number;
  name?: string | null;
  profileImageUrl?: string | null;
  profileUrl?: string | null;
  publishedCollections?: number;
  publishedGifs: number;
  status: string;
  subscription: number;
  url: string;
  username: string;
  verified: boolean;
  views: number;
  poster?: string;
  preview?: string;
  thumbnail?: string;
  premium?: {
    subscription_outbound_link: string | null;
  };
  studio?: boolean;
  socialUrl1?: string | null;
  socialUrl2?: string | null;
  socialUrl3?: string | null;
  socialUrl4?: string | null;
  socialUrl5?: string | null;
  socialUrl6?: string | null;
  socialUrl7?: string | null;
  socialUrl8?: string | null;
  socialUrl9?: string | null;
  socialUrl10?: string | null;
  socialUrl11?: string | null;
  socialUrl12?: string | null;
  socialUrl13?: string | null;
  socialUrl14?: string | null;
  socialUrl15?: string | null;
  socialUrl16?: string | null;
  socialUrl17?: string | null;
  socialUrl18?: string | null;
};

type RedGifNiche = {
  id: string;
  name: string;
  description?: string | null;
  cover?: string;
  thumbnail?: string;
  gifs: number;
  subscribers: number;
  owner?: string;
  rules?: string;
};

type RedGifResponse = {
  gif: RedGifGif;
  user?: RedGifUser;
  niches?: RedGifNiche[];
};

type RedGifAuthResponse = {
  token?: string;
};

const REDGIFS_TOKEN_STORAGE_KEY = "redgifsToken";
let tokenRefreshPromise: Promise<string> | null = null;

const failedMediaResult = {
  videoURL: "",
  sourceLoadError: "Failed to load video from RedGifs",
};

export default class Redgifs {
  static async getMediaURL(
    url: string,
    attemptsLeft = 1,
  ): Promise<{ videoURL: string; sourceLoadError?: string }> {
    const videoId = url.split(/watch\/|\?|#/)[1];
    if (!videoId) return failedMediaResult;

    try {
      let token = Redgifs.getStoredToken();
      if (!token) {
        token = await Redgifs.refreshStoredToken();
      }

      const res = await safeFetch(
        `https://api.redgifs.com/v2/gifs/${videoId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "Hydra",
          },
        },
      );

      if (res.status === 410) {
        return { videoURL: "", sourceLoadError: "Video has been deleted" };
      }

      if ([401, 403].includes(res.status) && attemptsLeft > 0) {
        await Redgifs.refreshStoredToken();
        return await Redgifs.getMediaURL(url, attemptsLeft - 1);
      }

      if (!res.ok) return failedMediaResult;

      const json = (await res.json()) as RedGifResponse;
      const videoURL = json.gif?.urls?.hd ?? json.gif?.urls?.sd;
      return videoURL ? { videoURL } : failedMediaResult;
    } catch (_) {
      return failedMediaResult;
    }
  }

  static getStoredToken() {
    return KeyStore.getString(REDGIFS_TOKEN_STORAGE_KEY);
  }

  static async refreshStoredToken(): Promise<string> {
    if (tokenRefreshPromise) return await tokenRefreshPromise;

    const refreshPromise = (async () => {
      const res = await safeFetch(
        "https://api.redgifs.com/v2/auth/temporary",
        {
          headers: {
            "User-Agent": "Hydra",
          },
        },
      );
      if (!res.ok) {
        throw new Error(`RedGifs token refresh failed (${res.status})`);
      }

      const json = (await res.json()) as RedGifAuthResponse;
      if (!json.token) {
        throw new Error("RedGifs token refresh returned no token");
      }

      KeyStore.set(REDGIFS_TOKEN_STORAGE_KEY, json.token);
      return json.token;
    })();

    tokenRefreshPromise = refreshPromise;
    try {
      return await refreshPromise;
    } finally {
      if (tokenRefreshPromise === refreshPromise) {
        tokenRefreshPromise = null;
      }
    }
  }
}
