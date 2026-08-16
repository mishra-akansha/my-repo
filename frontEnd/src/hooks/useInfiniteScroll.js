import { useState, useEffect, useCallback, useRef } from "react"
import { api } from "../api/client.js"

export default function useInfiniteScroll(endpoint, limit = 15, extraParams = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  // Use a ref for current data length to avoid stale closures in loadData
  const dataLengthRef = useRef(0)
  const loadingRef = useRef(false)

  // Stringify extraParams for stable dependency comparison
  const serializedParams = JSON.stringify(extraParams)

  const loadData = useCallback(async (pageNum, replace = false) => {
    // Use ref to prevent double-firing due to StrictMode or observer races
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)

    try {
      const params = {
        page: String(pageNum),
        limit: String(limit),
        ...JSON.parse(serializedParams)
      }
      const queryString = new URLSearchParams(params).toString()
      const res = await api.get(`${endpoint}?${queryString}`)

      const listData = Array.isArray(res) ? res : (res?.data || [])
      const total = Array.isArray(res) ? res.length : (res?.total || 0)
      setTotalCount(total)

      setData((prev) => {
        const next = replace ? listData : [...prev, ...listData]
        dataLengthRef.current = next.length
        return next
      })
      setPage(pageNum)

      // Only has more if a full page was returned AND we haven't reached total
      const currentLen = replace ? 0 : dataLengthRef.current
      const hasMoreData = !Array.isArray(res) &&
        listData.length === limit &&
        (currentLen + listData.length) < total
      setHasMore(hasMoreData)
    } catch (err) {
      console.error(`[useInfiniteScroll] Error loading page ${pageNum} from ${endpoint}:`, err)
      setHasMore(false)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [endpoint, limit, serializedParams])

  // Reset & reload whenever endpoint or filters (extraParams) change
  useEffect(() => {
    dataLengthRef.current = 0
    setData([])
    setPage(1)
    setHasMore(false)
    loadData(1, true)
  }, [endpoint, serializedParams]) // intentionally omit loadData to avoid loop

  const loadMore = useCallback(() => {
    if (!loadingRef.current && hasMore && dataLengthRef.current > 0) {
      loadData(page + 1)
    }
  }, [hasMore, page, loadData])

  const reload = useCallback(() => {
    dataLengthRef.current = 0
    return loadData(1, true)
  }, [loadData])

  // IntersectionObserver sentinel ref. Kept as a *stable* callback (no deps on
  // hasMore/loadMore) so React doesn't detach+reattach the observer on every page
  // change — reattaching on an already-visible sentinel (e.g. a short list that fits
  // on screen without scrolling) fires isIntersecting immediately, which used to
  // trigger loadMore() again before the previous page even finished, spiraling into
  // a request storm (ERR_INSUFFICIENT_RESOURCES). Latest hasMore/loadMore are read
  // from refs instead of the closure.
  const hasMoreRef = useRef(hasMore)
  hasMoreRef.current = hasMore
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore

  const observerRef = useRef(null)
  const observedNodeRef = useRef(null)
  const lastElementRef = useCallback((node) => {
    if (observedNodeRef.current === node) return
    observedNodeRef.current = node
    if (observerRef.current) observerRef.current.disconnect()
    if (!node || dataLengthRef.current === 0) return
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
          loadMoreRef.current()
        }
      },
      { rootMargin: "0px 0px 200px 0px" }
    )
    observerRef.current.observe(node)
  }, [])

  return { data, loading, hasMore, loadMore, reload, lastElementRef, setData, totalCount }
}
