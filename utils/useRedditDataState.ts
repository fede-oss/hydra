import { DependencyList, useEffect, useRef, useState } from "react";

import { RedditDataObject } from "../api/RedditApi";
import { BannedSubredditError, PrivateSubredditError } from "../api/Posts";
import { BannedUserError, UserDoesNotExistError } from "../api/User";

export type FilterFunction<T extends RedditDataObject> = (
  newData: T[],
  data: T[],
) => Promise<T[]> | T[];

type UseRedditDataStateProps<T extends RedditDataObject> = {
  loadData: (
    after: string | undefined,
    limit: number | undefined,
  ) => Promise<T[]>;
  filterRules?: FilterFunction<T>[];
  filterRetries?: number;
  limitRampUp?: number[];
  refreshDependencies?: DependencyList;
};

const filterExisting = async <T extends RedditDataObject>(
  newData: T[],
  data: T[],
) => {
  return newData.filter(
    (newItem) =>
      !data.find(
        (datum) => datum.id === newItem.id && datum.type === newItem.type,
      ),
  );
};

export type ErrorType = "postLoadingError" | "userLoadingError" | null;

export type ErrorTypeResolver<
  E extends "postLoadingError" | "userLoadingError" | null,
> = E extends "postLoadingError"
  ? BannedSubredditError | PrivateSubredditError
  : E extends "userLoadingError"
    ? BannedUserError | UserDoesNotExistError
    : never;

export default function useRedditDataState<
  T extends RedditDataObject,
  E extends ErrorType = null,
>({
  loadData,
  filterRules = [],
  filterRetries = 5,
  limitRampUp,
  refreshDependencies = [],
}: UseRedditDataStateProps<T>) {
  const unfilteredAfter = useRef<string | undefined>(undefined);
  const loadMorePromise = useRef<Promise<void> | null>(null);
  const refreshPromise = useRef<Promise<void> | null>(null);

  const [data, setData] = useState<T[]>([]);
  const [fullyLoaded, setFullyLoaded] = useState(false);
  const [hitFilterLimit, setHitFilterLimit] = useState(false);
  const [accessFailure, setAccessFailure] =
    useState<ErrorTypeResolver<E> | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const applyFilters = async (newData: T[], filters: FilterFunction<T>[]) => {
    if (filters.length === 0) return newData;
    return filters.reduce(async (acc, filterRule) => {
      return filterRule(await acc, data);
    }, Promise.resolve(newData));
  };

  const loadDataWithFailureHandling: typeof loadData = async (...props) => {
    try {
      return await loadData(...props);
    } catch (e) {
      if (
        e instanceof BannedSubredditError ||
        e instanceof PrivateSubredditError ||
        e instanceof BannedUserError ||
        e instanceof UserDoesNotExistError
      ) {
        setAccessFailure(e as ErrorTypeResolver<E>);
        return [];
      }

      const error =
        e instanceof Error
          ? e
          : new Error("Unable to load Reddit data. Please try again.");
      setLoadError(error);
      throw error;
    }
  };

  const loadMoreDataInternal = async () => {
    if (hitFilterLimit) return;
    let newData: T[] = [];
    for (let i = 0; i < filterRetries; i++) {
      const potentialData = await loadDataWithFailureHandling(
        unfilteredAfter.current,
        limitRampUp?.[i],
      );
      if (potentialData.length === 0) {
        setFullyLoaded(true);
        return;
      }
      unfilteredAfter.current = potentialData.slice(-1)[0]?.after;
      newData = await applyFilters(potentialData, [
        filterExisting,
        ...filterRules,
      ]);
      if (newData.length > 0) {
        break;
      }
    }
    if (newData.length > 0) {
      setData((currentData) => [...currentData, ...newData]);
    } else {
      setHitFilterLimit(true);
    }
  };

  const loadMoreData = (): Promise<void> => {
    if (refreshPromise.current) return refreshPromise.current;
    if (loadMorePromise.current) return loadMorePromise.current;

    setLoadError(null);
    const promise = loadMoreDataInternal().finally(() => {
      if (loadMorePromise.current === promise) {
        loadMorePromise.current = null;
      }
    });
    loadMorePromise.current = promise;
    return promise;
  };

  const refreshDataInternal = async ({ clearBeforeLoading = false } = {}) => {
    if (clearBeforeLoading) {
      setData([]);
    }
    unfilteredAfter.current = undefined;
    setHitFilterLimit(false);
    let newData: T[] = [];
    for (let i = 0; i < filterRetries; i++) {
      const potentialData = await loadDataWithFailureHandling(
        unfilteredAfter.current,
        limitRampUp?.[i],
      );
      if (potentialData.length === 0) {
        setData([]);
        setFullyLoaded(true);
        return;
      }
      unfilteredAfter.current = potentialData.slice(-1)[0]?.after;
      newData = await applyFilters(potentialData, filterRules);
      if (newData.length > 0) {
        break;
      }
    }
    setHitFilterLimit(newData.length === 0);
    setFullyLoaded(false);
    setData(newData);
  };

  const refreshData = (options: { clearBeforeLoading?: boolean } = {}) => {
    if (refreshPromise.current) return refreshPromise.current;

    setLoadError(null);
    const pendingLoadMore = loadMorePromise.current;
    const waitForLoadMore = pendingLoadMore
      ? pendingLoadMore.catch(() => undefined)
      : Promise.resolve();
    const promise = waitForLoadMore
      .then(() => {
        setLoadError(null);
        return refreshDataInternal(options);
      })
      .finally(() => {
        if (refreshPromise.current === promise) {
          refreshPromise.current = null;
        }
      });
    refreshPromise.current = promise;
    return promise;
  };

  const modifyData = (modifiedData: T[]) => {
    setData((data) => {
      const newData = [...data];
      modifiedData.forEach((newItem) => {
        const index = newData.findIndex(
          (datum) => datum.id === newItem.id && datum.type === newItem.type,
        );
        if (index !== -1) {
          newData[index] = newItem;
        }
      });
      return newData;
    });
  };

  const deleteData = (deletedData?: T[]) => {
    if (!deletedData) {
      setData([]);
      return;
    }
    setData((data) => {
      return data.filter(
        (datum) =>
          !deletedData.find(
            (deletedDatum) =>
              deletedDatum.id === datum.id && datum.type === deletedDatum.type,
          ),
      );
    });
  };

  const initialLoad = useRef(true);
  useEffect(() => {
    if (initialLoad.current) {
      void loadMoreData().catch(() => undefined);
      initialLoad.current = false;
    } else {
      void refreshData({ clearBeforeLoading: true }).catch(() => undefined);
    }
  }, refreshDependencies);

  return {
    data,
    loadMoreData,
    refreshData,
    modifyData,
    deleteData,
    fullyLoaded,
    hitFilterLimit,
    accessFailure,
    loadError,
  };
}
