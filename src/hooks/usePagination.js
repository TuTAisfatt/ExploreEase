import { useState } from 'react';
import { PAGINATION_LIMIT } from '../utils/constants';

const usePagination = (fetchFn, deps = []) => {
  const [data, setData] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = async (reset = false) => {
    if (loading) return;
    setLoading(true);
    const cursor = reset ? null : lastDoc;
    const { items, last } = await fetchFn(cursor, PAGINATION_LIMIT);
    setData((prev) => (reset ? items : [...prev, ...items]));
    setLastDoc(last);
    setHasMore(items.length === PAGINATION_LIMIT);
    setLoading(false);
  };

  const refresh = () => load(true);
  const loadMore = () => { if (hasMore) load(false); };

  return { data, loading, hasMore, refresh, loadMore };
};

export default usePagination;
