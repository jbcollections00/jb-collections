import { redirect } from "next/navigation"

export default async function CategoryRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/categories/${id}`)
}