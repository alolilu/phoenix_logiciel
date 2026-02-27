import ChantierClient from "./ChantierClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChantierClient id={id} />;
}