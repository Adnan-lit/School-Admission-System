import { useEffect } from 'react'

const SITE_NAME = 'স্কুল ভর্তি'

/** Names the browser tab, so that the admin and user panels can be told apart. */
export function usePageTitle(page: string) {
  useEffect(() => {
    document.title = `${page} | ${SITE_NAME}`
  }, [page])
}
