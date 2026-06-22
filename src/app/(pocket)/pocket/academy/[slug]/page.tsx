import Link from "next/link";
import { notFound } from "next/navigation";
import { ACADEMY_LESSONS, getLesson } from "@/lib/academy";

export function generateStaticParams() {
  return ACADEMY_LESSONS.map((l) => ({ slug: l.slug }));
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();

  return (
    <article>
      <Link href="/pocket/academy" className="text-sm text-blue-600 dark:text-blue-400">
        ← Academy
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{lesson.title}</h1>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{lesson.minutes} min read</p>
      <div className="mt-4 space-y-4">
        {lesson.body.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-gray-700 dark:text-slate-300">
            {p}
          </p>
        ))}
      </div>
      <p className="mt-8 text-xs text-gray-400 dark:text-slate-500">
        Education &amp; guidance only — not credit repair, not legal or financial advice.
      </p>
    </article>
  );
}
