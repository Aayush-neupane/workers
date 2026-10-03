import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Reset scroll on route change for predictable navigation. */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
