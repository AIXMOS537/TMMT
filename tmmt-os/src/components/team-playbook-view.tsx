import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TeamPlaybook } from "@/lib/team-playbooks/content";

export function TeamPlaybookView({
  playbook,
  portalHome,
}: {
  playbook: TeamPlaybook;
  portalHome: string;
}) {
  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{playbook.title}</h1>
        <p className="text-muted-foreground">{playbook.description}</p>
      </header>

      {playbook.sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-lg">{section.title}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">{section.body}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.checklist && section.checklist.length > 0 && (
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                {section.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {section.links && section.links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {section.links.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <Button variant="outline" size="sm">
                      {link.label}
                    </Button>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Link href={portalHome}>
        <Button variant="outline">Back to dashboard</Button>
      </Link>
    </div>
  );
}
