import { PartyStatement } from "@/features/vyora/screens/PartyStatement";

export default async function VyoraPartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PartyStatement partyId={id} />;
}
