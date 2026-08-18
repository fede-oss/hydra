import React, { useCallback, useContext, useMemo } from "react";

import type { Post } from "../../api/Posts";
import { MediaViewerContext } from "../../contexts/MediaViewerContext";
import { PostMediaBrowsingContext } from "../../contexts/PostMediaBrowsingContext";
import { PostSettingsContext } from "../../contexts/SettingsContexts/PostSettingsContext";
import {
  buildPostMediaIndex,
  getPostMediaInitialIndex,
} from "../../utils/postMediaBrowsing";

type PostMediaBrowsingProviderProps = React.PropsWithChildren<{
  posts: readonly Post[];
  enabled?: boolean;
}>;

/**
 * Lets post media open as one vertically swipeable collection for the current
 * page while preserving the normal single-post viewer everywhere else.
 */
export default function PostMediaBrowsingProvider({
  posts,
  enabled = true,
  children,
}: PostMediaBrowsingProviderProps) {
  const { postCompactMode } = useContext(PostSettingsContext);
  const { displayMedia } = useContext(MediaViewerContext);

  const mediaIndex = useMemo(
    () => (enabled ? buildPostMediaIndex(posts, postCompactMode) : null),
    [enabled, posts, postCompactMode],
  );

  const openPostMedia = useCallback(
    (post: Post, requestedMediaIndex: number) => {
      if (!mediaIndex) return false;

      const initialIndex = getPostMediaInitialIndex(
        mediaIndex,
        post,
        requestedMediaIndex,
      );
      if (initialIndex === null) return false;

      displayMedia({
        media: mediaIndex.media,
        initialIndex,
        getCurrentPost: (rowIndex) => mediaIndex.posts[rowIndex] ?? null,
      });
      return true;
    },
    [displayMedia, mediaIndex],
  );

  const value = useMemo(() => ({ openPostMedia }), [openPostMedia]);

  return (
    <PostMediaBrowsingContext.Provider value={value}>
      {children}
    </PostMediaBrowsingContext.Provider>
  );
}
