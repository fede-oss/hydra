import { describe, expect, test } from "bun:test";

import type { Post } from "../api/Posts";
import {
  buildPostMediaIndex,
  getPostMedia,
  getPostMediaInitialIndex,
} from "../utils/postMediaBrowsing";

const makePost = (id: string, overrides: Partial<Post> = {}): Post =>
  ({
    id,
    name: `t3_${id}`,
    type: "post",
    images: [],
    videos: [],
    crossPost: undefined,
    crossCommentLink: undefined,
    externalLink: undefined,
    openGraphData: undefined,
    ...overrides,
  }) as unknown as Post;

describe("getPostMedia", () => {
  test("uses videos before images, matching the post renderer", () => {
    const post = makePost("video", {
      images: ["preview"],
      videos: [{ source: "video.mp4" }],
    });

    const entry = getPostMedia(post, false);
    expect(entry?.post).toBe(post);
    expect(entry?.media).toEqual([
      { type: "video", source: { source: "video.mp4" } },
    ]);
  });

  test("matches regular and compact image visibility rules", () => {
    const plainImage = makePost("plain", { images: ["image"] });
    const linkWithoutMetadata = makePost("link-no-meta", {
      images: ["image"],
      externalLink: "https://example.com/image.jpg",
    });
    const linkWithMetadata = makePost("link-meta", {
      images: ["image"],
      externalLink: "https://example.com/article",
      openGraphData: {} as Post["openGraphData"],
    });

    expect(getPostMedia(plainImage, false)?.media.length).toBe(1);
    expect(getPostMedia(plainImage, true)?.media.length).toBe(1);
    expect(getPostMedia(linkWithoutMetadata, false)?.media.length).toBe(1);
    expect(getPostMedia(linkWithoutMetadata, true)).toBe(null);
    expect(getPostMedia(linkWithMetadata, false)).toBe(null);
    expect(getPostMedia(linkWithMetadata, true)).toBe(null);
  });

  test("resolves full-size crossposts to the nested post that renders the media", () => {
    const nested = makePost("nested", { images: ["nested-image"] });
    const parent = makePost("parent", {
      images: ["parent-preview"],
      crossPost: nested,
    });

    const regularEntry = getPostMedia(parent, false);
    expect(regularEntry?.post).toBe(nested);
    expect(regularEntry?.media).toEqual([
      { type: "image", source: "nested-image" },
    ]);

    const compactEntry = getPostMedia(parent, true);
    expect(compactEntry?.post).toBe(parent);
    expect(compactEntry?.media).toEqual([
      { type: "image", source: "parent-preview" },
    ]);
  });

  test("resolves nested crosspost chains and fails closed on cycles", () => {
    const leaf = makePost("leaf", {
      videos: [{ source: "leaf-video.mp4" }],
    });
    const middle = makePost("middle", { crossPost: leaf });
    const outer = makePost("outer", { crossPost: middle });

    const entry = getPostMedia(outer, false);
    expect(entry?.post).toBe(leaf);
    expect(entry?.media).toEqual([
      { type: "video", source: { source: "leaf-video.mp4" } },
    ]);

    const cycleA = makePost("cycle-a");
    const cycleB = makePost("cycle-b");
    cycleA.crossPost = cycleB;
    cycleB.crossPost = cycleA;
    expect(getPostMedia(cycleA, false)).toBe(null);
  });

  test("keeps comment links out of the swipeable media stream", () => {
    const commentLink = makePost("comment-link", {
      images: ["preview"],
      crossCommentLink: "https://www.reddit.com/r/test/comments/a/b/c/",
    });

    expect(getPostMedia(commentLink, false)).toBe(null);
    expect(getPostMedia(commentLink, true)).toBe(null);
  });
});

describe("buildPostMediaIndex", () => {
  test("preserves feed order and calculates flattened album offsets", () => {
    const first = makePost("first", { images: ["a", "b"] });
    const textOnly = makePost("text-only");
    const video = makePost("video", {
      videos: [{ source: "video.mp4" }],
    });
    const last = makePost("last", { images: ["c", "d", "e"] });

    const index = buildPostMediaIndex([first, textOnly, video, last], false);

    expect(index.posts).toEqual([first, video, last]);
    expect(index.media.map((row) => row.length)).toEqual([2, 1, 3]);
    expect(index.firstMediaIndexByPost.get(first)).toBe(0);
    expect(index.firstMediaIndexByPost.get(video)).toBe(2);
    expect(index.firstMediaIndexByPost.get(last)).toBe(3);
    expect(index.rowIndexByPost.get(first)).toBe(0);
    expect(index.rowIndexByPost.get(video)).toBe(1);
    expect(index.rowIndexByPost.get(last)).toBe(2);
    expect(index.rowIndexByPost.has(textOnly)).toBe(false);
  });

  test("builds the Home collection from only tappable media posts", () => {
    const image = makePost("image", { images: ["image.jpg"] });
    const text = makePost("text");
    const linkCard = makePost("link", {
      images: ["preview.jpg"],
      externalLink: "https://example.com/article",
      openGraphData: {} as Post["openGraphData"],
    });
    const video = makePost("video", {
      videos: [{ source: "video.mp4" }],
    });
    const album = makePost("album", { images: ["a", "b"] });

    const index = buildPostMediaIndex(
      [image, text, linkCard, video, album],
      false,
    );

    expect(index.posts).toEqual([image, video, album]);
    expect(index.media.map((row) => row.length)).toEqual([1, 1, 2]);
  });

  test("keeps distinct post objects even if Reddit ids collide", () => {
    const first = makePost("same", { images: ["a"] });
    const second = makePost("same", { images: ["b"] });

    const index = buildPostMediaIndex([first, second], false);

    expect(index.posts).toEqual([first, second]);
    expect(index.rowIndexByPost.get(first)).toBe(0);
    expect(index.rowIndexByPost.get(second)).toBe(1);
    expect(index.firstMediaIndexByPost.get(first)).toBe(0);
    expect(index.firstMediaIndexByPost.get(second)).toBe(1);
  });

  test("deduplicates the exact same rendered post object", () => {
    const shared = makePost("shared", { images: ["shared-image"] });
    const firstCrosspost = makePost("cross-a", { crossPost: shared });
    const secondCrosspost = makePost("cross-b", { crossPost: shared });

    const index = buildPostMediaIndex([firstCrosspost, secondCrosspost], false);

    expect(index.posts).toEqual([shared]);
    expect(index.media.length).toBe(1);
  });

  test("produces an empty browser for feeds without tappable media", () => {
    const index = buildPostMediaIndex(
      [makePost("text"), makePost("another-text")],
      false,
    );

    expect(index.media).toEqual([]);
    expect(index.posts).toEqual([]);
    expect(index.firstMediaIndexByPost.size).toBe(0);
    expect(index.rowIndexByPost.size).toBe(0);
  });
});

describe("getPostMediaInitialIndex", () => {
  test("opens the exact album item in the flattened media collection", () => {
    const first = makePost("first", { images: ["a", "b"] });
    const second = makePost("second", { images: ["c", "d", "e"] });
    const index = buildPostMediaIndex([first, second], false);

    expect(getPostMediaInitialIndex(index, first, 0)).toBe(0);
    expect(getPostMediaInitialIndex(index, first, 1)).toBe(1);
    expect(getPostMediaInitialIndex(index, second, 0)).toBe(2);
    expect(getPostMediaInitialIndex(index, second, 2)).toBe(4);
  });

  test("rejects unknown posts and invalid album indices", () => {
    const post = makePost("post", { images: ["a", "b"] });
    const sameIdDifferentObject = makePost("post", { images: ["a", "b"] });
    const index = buildPostMediaIndex([post], false);

    expect(getPostMediaInitialIndex(index, sameIdDifferentObject, 0)).toBe(
      null,
    );
    expect(getPostMediaInitialIndex(index, post, -1)).toBe(null);
    expect(getPostMediaInitialIndex(index, post, 2)).toBe(null);
    expect(getPostMediaInitialIndex(index, post, 0.5)).toBe(null);
  });
});
