import type { Post } from "../api/Posts";
import type {
  MediaItemCollection,
  MediaItemRow,
} from "../components/UI/MediaViewer.tsx/types";

export type PostMediaEntry = {
  post: Post;
  media: MediaItemRow;
};

export type PostMediaIndex = {
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
 * Mirrors the media that PostMedia/CompactPostMedia expose as a tappable media
 * viewer target. Full-size crossposts resolve to the nested post whose media is
 * rendered, while link cards and comment links retain their existing behavior.
 */
export function getPostMedia(
  post: Post,
  compactMode: boolean,
): PostMediaEntry | null {
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

export function buildPostMediaIndex(
  posts: readonly Post[],
  compactMode: boolean,
): PostMediaIndex {
  const media: MediaItemCollection = [];
  const indexedPosts: Post[] = [];
  const firstMediaIndexByPost = new Map<Post, number>();
  const rowIndexByPost = new Map<Post, number>();
  let flatMediaIndex = 0;

  for (const post of posts) {
    const entry = getPostMedia(post, compactMode);
    if (!entry || rowIndexByPost.has(entry.post)) continue;

    firstMediaIndexByPost.set(entry.post, flatMediaIndex);
    rowIndexByPost.set(entry.post, media.length);
    media.push(entry.media);
    indexedPosts.push(entry.post);
    flatMediaIndex += entry.media.length;
  }

  return {
    media,
    posts: indexedPosts,
    firstMediaIndexByPost,
    rowIndexByPost,
  };
}

export function getPostMediaInitialIndex(
  index: PostMediaIndex,
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
