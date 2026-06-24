import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Bind a single piece of UI state to one URL query-string key, so it survives a refresh and is
 * shareable/bookmarkable. Other params are left untouched; writes use `replace` so tweaking a
 * filter doesn't spam the back button. A value equal to `fallback` (via `serialize` returning
 * null) drops the key entirely, keeping default URLs clean.
 *
 * Navigating between tabs (a NavLink/navigate to a path with no search) clears the search string,
 * so one page's filters never leak onto another.
 */
export function useSearchParamState<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T,
  serialize: (value: T) => string | null
) {
  const [params, setParams] = useSearchParams()
  const raw = params.get(key)
  const value = raw === null ? fallback : parse(raw)

  const setValue = useCallback(
    (next: T) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          const s = serialize(next)
          if (s === null) p.delete(key)
          else p.set(key, s)
          return p
        },
        { replace: true }
      )
    },
    // serialize/parse are passed inline per call site; key identifies the slot.
    [key, setParams, serialize]
  )

  return [value, setValue] as const
}

/** String param; the empty string (or `fallback`) means "absent" so the URL stays clean. */
export function useStringParam<T extends string = string>(key: string, fallback: NoInfer<T>) {
  return useSearchParamState<T>(
    key,
    fallback,
    (raw) => raw as T,
    (v) => (v === fallback || v === '' ? null : v)
  )
}

/** Integer param; `fallback` is omitted from the URL. */
export function useIntParam(key: string, fallback: number) {
  return useSearchParamState<number>(
    key,
    fallback,
    (raw) => {
      const n = Number(raw)
      return Number.isFinite(n) ? n : fallback
    },
    (v) => (v === fallback || !Number.isFinite(v) ? null : String(v))
  )
}

/** Boolean param serialised as 1/0; `fallback` is omitted from the URL. */
export function useBoolParam(key: string, fallback: boolean) {
  return useSearchParamState<boolean>(
    key,
    fallback,
    (raw) => raw === '1',
    (v) => (v === fallback ? null : v ? '1' : '0')
  )
}
