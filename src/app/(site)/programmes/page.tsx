import type { Metadata } from "next";
import { BookIcon, CapIcon, ClockIcon, CardIcon } from "@/components/icons";
import { HeroHighlight, PageHero } from "@/components/site/page-hero";
import { ProgrammeCard } from "@/components/site/programme-card";
import { EmptyState } from "@/components/ui";
import { getSettings } from "@/lib/data";
import { getPublishedProgrammes, programmeCourseMap, programmeFee } from "@/lib/programmes";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { visitorCurrencies } from "@/lib/visitor";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await seoConfig();
  return pageMetadata(seo, { title: "Programmes", description: "Career programmes that combine several courses into one path, with one duration and one fee.", path: "/programmes" });
}

export default async function ProgrammesPage() {
  const [settings, list] = await Promise.all([getSettings(), getPublishedProgrammes()]);
  const [included, { currencies }] = await Promise.all([programmeCourseMap(list.map((p) => p.id), { publishedOnly: true }), visitorCurrencies(settings)]);
  // A programme needs at least two live courses to be worth showing.
  const shown = list.filter((p) => (included.get(p.id)?.length ?? 0) >= 2);
  return (
    <>
      <PageHero
        eyebrow="Programmes"
        title={<>One path, <HeroHighlight>several courses</HeroHighlight></>}
        lead="Each programme combines courses that build on each other, so you go from the basics to job-ready with one plan and one fee."
        facts={[
          { icon: CapIcon, label: "Programmes", value: `${shown.length} to choose from` },
          { icon: BookIcon, label: "Made of", value: "Our live, cohort-based courses" },
          { icon: ClockIcon, label: "Pace", value: "Courses taken in sequence" },
          { icon: CardIcon, label: "Fees", value: "One price for the whole path" },
        ]}
      />
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 md:py-16">
        {shown.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => <ProgrammeCard key={p.id} programme={p} courses={included.get(p.id) ?? []} fee={programmeFee(p.prices, currencies)} />)}
          </div>
        ) : (
          <EmptyState icon={CapIcon} title="No programmes yet">Browse our individual courses in the meantime.</EmptyState>
        )}
      </div>
    </>
  );
}
