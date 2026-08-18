import type { Post } from "../api/Posts";
import type { UserContent } from "../api/User";
import type {
  MediaItemCollection,
  MediaItemRow,
} from "../components/UI/MediaViewer.tsx/types";

export type UserProfileMediaEntry = {
  post: Post;
  media: MediaItemRow;
};

export type UserProfileMediaIndex = {
  media: MediaItemCollection;
  posts: Post[];
  firstMediaIndexByPost: Map<Post, number>;
  rowIndexByPost: Map<Post, number>;
};

function getRenderedPost(post: Post, compactMode: boolean): Post | null {
  if (compactMode) return post;

  const visited = new Set<Post>();
  let renderedPost = post;
  while (renderedPost.crossPost) {
    if (visited.has(renderedPost)) return null;
    visited.add(renderedPost);
    renderedPost = renderedPost.crossPost;
  }
  return renderedPost;
}

/**
 * Mirrors the media that PostMedia/CompactPostMedia actually expose as a
 * tappable media viewer target. Full-size crossposts resolve to the nested post
 * whose media is rendered, while link cards and comment links retain their
 * existing navigation behavior.
 */
export function getUserProfilePostMedia(
  post: Post,
  compactMode: boolean,
): UserProfileMediaEntry | null {
  const renderedPost = getRenderedPost(post, compactMode);
  if (!renderedPost || renderedPost.crossCommentLink) return null;

  if (renderedPost.videos.length > 0) {
    return {
      post: renderedPost,
      media: renderedPost.videos.map((video) => ({
        type: "video" as const,
        source: video,
      })),
    };
  }

  const canShowImages =
    renderedPost.images.length > 0 &&
    (compactMode
      ? !renderedPost.externalLink
      : !renderedPost.externalLink || !renderedPost.openGraphData);
  if (!canShowImages) return null;

  return {
    post: renderedPost,
    media: renderedPost.images.map((image) => ({
      type: "image" as const,
      source: image,
    })),
  };
}

export function buildUserProfileMediaIndex(
  content: UserContent[],
  compactMode: boolean,
): UserProfileMediaIndex {
  const media: MediaItemCollection = [];
  const posts: Post[] = [];
  const firstMediaIndexByPost = new Map<Post, number>();
  const rowIndexByPost = new Map<Post, number>();
  let flatMediaIndex = 0;

  for (const item of content) {
    if (!item || item.type !== "post") continue;

    const entry = getUserProfilePostMedia(item, compactMode);
    if (!entry || rowIndexByPost.has(entry.post)) continue;

    firstMediaIndexByPost.set(entry.post, flatMediaIndex);
    rowIndexByPost.set(entry.post, media.length);
    media.push(entry.media);
    posts.push(entry.post);
    flatMediaIndex += entry.media.length;
  }

  return {
    media,
    posts,
    firstMediaIndexByPost,
    rowIndexByPost,
  };
}

export function getUserProfileMediaInitialIndex(
  index: UserProfileMediaIndex,
  post: Post,
  mediaIndex: number,
): number | null {
  const rowIndex = index.rowIndexByPost.get(post);
  const firstMediaIndex = index.firstMediaIndexByPost.get(post);
  if (rowIndex === undefined || firstMediaIndex === undefined) return null;

  const row = index.media[rowIndex];
  if (
    !row ||
    !Number.isInteger(mediaIndex) ||
    mediaIndex < 0 ||
    mediaIndex >= row.length
  ) {
    return null;
  }

  return firstMediaIndex + mediaIndex;
}
