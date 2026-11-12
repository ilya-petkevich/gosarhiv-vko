import { InfoPage, infoMetadata } from "@/components/InfoPage";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P) {
  return infoMetadata((await params).lang, "anticorruption");
}

export default async function Page({ params }: P) {
  return <InfoPage lang={(await params).lang} slug="anticorruption" />;
}
