import { getMyProfile } from "@/features/users";
import { listClients } from "@/features/clients";
import { redirect } from "next/navigation";
import { OnboardingPage } from "./onboarding-page";

export default async function Page() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const clients = await listClients().catch(() => []);

  return <OnboardingPage myProfile={profile} clients={clients} />;
}
