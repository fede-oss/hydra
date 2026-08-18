import { createContext } from "react";

import type { Post } from "../api/Posts";

export type PostMediaBrowsingContextValue = {
  openPostMedia: (post: Post, mediaIndex: number) => boolean;
};

export const PostMediaBrowsingContext =
  createContext<PostMediaBrowsingContextValue>({
    openPostMedia: () => false,
  });
