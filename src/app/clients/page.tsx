import { getMyProfile } from "@/features/users";
import { listClients } from "@/features/clients";
import { redirect } from "next/navigation";
import { ClientsListPage } from "./clients-list-page";

export default async function Page() {
  const profile = await getMyProfile();
  if (!profile) redirect('/login');

  const clients = await listClients();

  return <ClientsListPage myProfile={profile} clients={clients} />;
}
