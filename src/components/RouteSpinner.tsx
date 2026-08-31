/**
 * The route-level loading fallback for signed-in sections.
 *
 * This deliberately does NOT live at src/app/loading.tsx. A loading file wraps
 * its whole segment in a Suspense boundary, and Next flushes the response shell
 * as soon as that boundary renders — which locks the HTTP status at 200 before
 * the page has run. With one at the app root, every notFound() in the app
 * returned "200 OK" carrying 404 content: uptime checks read it as healthy and
 * Google indexed pages that do not exist.
 *
 * So the rule is: signed-in sections opt in (a spinner is worth more than a
 * status code behind a login), and public routes stay out of it so /lp, /forms
 * and friends can return an honest 404.
 */
export default function RouteSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
